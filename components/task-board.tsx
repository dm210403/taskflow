"use client";

import { useEffect, useState } from "react";
import { Task, TaskStatus } from "@/lib/types";
import { TaskItem } from "@/components/task-item";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { AiQuickAdd } from "@/components/ai-quick-add";
import { AiAssistantPanel } from "@/components/ai-assistant-panel";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
];

export function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function loadTasks() {
    const res = await fetch("/api/tasks");
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleStatusChange(id: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex items-center gap-3">
          <AiQuickAdd onCreated={(task) => setTasks((prev) => [task, ...prev])} />
          <Button onClick={() => setDialogOpen(true)} size="icon" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.key}>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {col.label} ({tasks.filter((t) => t.status === col.key).length})
                </h2>
                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.status === col.key)
                    .map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AiAssistantPanel />

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(task) => setTasks((prev) => [task, ...prev])}
      />
    </div>
  );
}
