"use client";

import { useEffect, useState } from "react";
import { AppShell, Card, StatusBadge } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";

type Scheduled = {
  id: string;
  scheduledAt: string;
  timezone: string;
  status: string;
  lastError?: string | null;
  post: { id: string; platform: string; hook: string; status: string };
};

export default function CalendarPage() {
  const { workspaces, user } = useAuth();
  const workspace = workspaces[0];
  const [items, setItems] = useState<Scheduled[]>([]);
  const [postId, setPostId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  async function load() {
    if (!workspace) return;
    const data = await api<{ scheduled: Scheduled[] }>(`/api/schedule/${workspace.id}`);
    setItems(data.scheduled);
  }

  useEffect(() => {
    if (!workspace) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load calendar from API
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  async function schedule() {
    if (!postId || !scheduledAt) return;
    await api("/api/schedule", {
      method: "POST",
      body: JSON.stringify({ postId, scheduledAt: new Date(scheduledAt).toISOString(), timezone: user?.timezone ?? "UTC" }),
    });
    setPostId("");
    setScheduledAt("");
    await load();
  }

  return (
    <AppShell title="Calendar">
      <Card className="mb-6 max-w-xl">
        <h2 className="font-medium">Schedule approved post</h2>
        <div className="mt-4 space-y-3">
          <input
            placeholder="Post ID (from review screen / API)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
          />
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <button onClick={schedule} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium">
            Schedule
          </button>
        </div>
      </Card>
      <Card>
        <h2 className="font-medium">Queue</h2>
        <div className="mt-4 space-y-3">
          {items.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3">
              <div>
                <p className="font-medium">{s.post.hook}</p>
                <p className="text-xs text-slate-400">
                  {s.post.platform} · {new Date(s.scheduledAt).toLocaleString()} ({s.timezone})
                </p>
                {s.lastError ? <p className="text-xs text-rose-300">{s.lastError}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status} />
                {s.status === "FAILED" ? (
                  <button
                    className="text-xs text-indigo-300"
                    onClick={async () => {
                      await api(`/api/schedule/${s.id}/retry`, { method: "POST" });
                      await load();
                    }}
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-slate-400">No scheduled posts in range.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
