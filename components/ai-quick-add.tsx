"use client";

import { useState } from "react";
import { Task } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function AiQuickAdd({ onCreated }: { onCreated: (task: Task) => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    const res = await fetch("/api/ai/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      onCreated(data.task);
      setPrompt("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
      <div className="relative flex-1">
        <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder='Try "call the client tomorrow at 5pm, high priority"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add with AI"}
      </Button>
    </form>
  );
}
