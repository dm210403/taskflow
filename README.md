# TaskFlow

Full-stack AI task manager.

**Stack:** Next.js (App Router) · shadcn/ui · better-auth · Hono (mounted as a Next.js route handler) · Prisma + PostgreSQL · Vercel AI SDK (Anthropic)

## What's included

- Email/password auth via **better-auth**, with session cookies checked in Next.js middleware and verified server-side per request.
- A **Hono** app (`server/app.ts`) that handles all `/api/*` routes (tasks CRUD + AI endpoints), mounted through `app/api/[[...route]]/route.ts`. Auth routes (`/api/auth/*`) are handled separately by better-auth's own Next.js handler.
- **Prisma** schema with the tables better-auth needs (`User`, `Session`, `Account`, `Verification`) plus your `Task` model.
- Two AI features via the **Vercel AI SDK**:
  - `/api/ai/parse-task` — turns a sentence like *"call the client tomorrow at 5pm, high priority"* into a structured task (`generateObject`).
  - `/api/ai/assistant` — a streaming chat assistant that sees your open tasks and gives focus/priority advice (`streamText`).
- A Kanban-style dashboard (To do / In progress / Done) with a manual "New task" dialog and an AI quick-add bar.
- Hand-written shadcn-style primitives (Button, Card, Input, Dialog, Label, Textarea, Badge) so the project runs without needing the shadcn CLI — but you can regenerate any of them with `npx shadcn@latest add <component>` if you want the canonical version.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up Postgres

Use a local Docker container, or a free hosted instance (Neon, Supabase, Railway all work fine).

```bash
docker run --name taskflow-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=taskflow -p 5432:5432 -d postgres:16
```

## 3. Environment variables

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — your Postgres connection string
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

## 4. Push the schema and generate the client

```bash
npm run db:push
npm run db:generate
```

(Use `npm run db:migrate` instead of `db:push` once you want tracked migrations.)

## 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login` → sign up → lands on `/dashboard`.

## How auth flows through the stack

1. `signUp.email()` / `signIn.email()` (client) hit `/api/auth/*`, handled by `toNextJsHandler(auth)`.
2. better-auth sets an HttpOnly session cookie.
3. `middleware.ts` does a cheap cookie-presence check to redirect unauthenticated users away from `/dashboard` before any page code runs.
4. Server components (like `app/dashboard/page.tsx`) call `auth.api.getSession()` directly for the real, DB-verified session.
5. The Hono app (`server/app.ts`) does its own `auth.api.getSession()` check on every `/tasks/*` and `/ai/*` route, so the API is protected independent of the frontend.

## Extending it

- **Drag-and-drop between columns**: swap the click-to-advance status button in `task-item.tsx` for `@dnd-kit/core`.
- **Due-date reminders**: add a cron (Vercel Cron or a simple `node-cron` script) that queries tasks due soon and emails via Resend.
- **Real shadcn components**: run `npx shadcn@latest init` then `npx shadcn@latest add button card dialog input label textarea badge` — it will offer to overwrite the stub files in `components/ui/` with the canonical versions (same import paths, so nothing else needs to change).
