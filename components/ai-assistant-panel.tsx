"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiAssistantPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me what to focus on today, and I'll look at your open tasks.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Add an empty assistant message we will stream tokens into.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages }),
    });

    if (!res.body) {
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: updated[updated.length - 1].content + chunk,
        };
        return updated;
      });
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }

    setStreaming(false);
  }

  return (
    <Card className="flex h-fit flex-col">
      <CardHeader>
        <CardTitle className="text-base">AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-6 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-6 rounded-md bg-muted px-3 py-2 text-sm"
              }
            >
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What should I focus on today?"
            disabled={streaming}
          />
          <Button type="submit" disabled={streaming}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
