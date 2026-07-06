import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { TaskBoard } from "@/components/task-board";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DashboardHeader name={session.user.name} />
      <TaskBoard />
    </div>
  );
}
