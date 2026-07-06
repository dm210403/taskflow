import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { streamText, generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Hono is mounted under /api by the Next.js route handler, so paths here
// are relative to that (e.g. this becomes /api/tasks).
const app = new Hono<{ Variables: { userId: string } }>().basePath("/api");
app.use("/*", cors());

// ---------- auth middleware ----------
// Attaches `user` to context if the request has a valid better-auth session.
app.use("/tasks/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  await next();
});

app.use("/ai/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  await next();
});

// ---------- validation schemas ----------
const taskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

// ---------- task CRUD ----------

// GET /api/tasks
app.get("/tasks", async (c) => {
  const userId = c.get("userId") as string;
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return c.json({ tasks });
});

// POST /api/tasks
app.post("/tasks", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json();
  const parsed = taskInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const task = await prisma.task.create({
    data: {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      userId,
    },
  });
  return c.json({ task }, 201);
});

// PATCH /api/tasks/:id
app.patch("/tasks/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json();
  const parsed = taskInput.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...parsed.data,
      dueDate:
        parsed.data.dueDate === undefined
          ? undefined
          : parsed.data.dueDate
            ? new Date(parsed.data.dueDate)
            : null,
    },
  });
  return c.json({ task });
});

// DELETE /api/tasks/:id
app.delete("/tasks/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  await prisma.task.delete({ where: { id } });
  return c.json({ success: true });
});

// ---------- AI: natural-language task creation ----------
// e.g. "remind me to call the client tomorrow at 5pm, high priority"
app.post("/ai/parse-task", async (c) => {
  const userId = c.get("userId") as string;
  const { prompt } = await c.req.json();
  if (!prompt || typeof prompt !== "string") {
    return c.json({ error: "prompt is required" }, 400);
  }

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
      dueDate: z.string().datetime().optional().nullable(),
    }),
    prompt: `Extract a structured task from this request. Today's date is ${new Date().toISOString()}.
Request: "${prompt}"`,
  });

  const task = await prisma.task.create({
    data: {
      title: object.title,
      description: object.description,
      priority: object.priority,
      dueDate: object.dueDate ? new Date(object.dueDate) : null,
      userId,
    },
  });

  return c.json({ task });
});

// ---------- AI: streaming task assistant chat ----------
// Answers questions like "what should I focus on today?" using the user's tasks as context.
app.post("/ai/assistant", async (c) => {
  const userId = c.get("userId") as string;
  const { messages } = await c.req.json();

  const tasks = await prisma.task.findMany({
    where: { userId, status: { not: "DONE" } },
    orderBy: { dueDate: "asc" },
  });

  const context = tasks
    .map(
      (t) =>
        `- [${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate.toDateString()})` : ""} — ${t.status}`
    )
    .join("\n");

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are a helpful productivity assistant inside a task manager app. Here are the user's current open tasks:\n${context || "(no open tasks)"}\n\nGive concise, practical advice. Reference specific tasks by name when relevant.`,
    messages,
  });

  return result.toTextStreamResponse();
});

export { app };
export type AppType = typeof app;
