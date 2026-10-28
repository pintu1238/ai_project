"use client";

import { useEffect, useState } from "react";
import { AppShell, Card, StatusBadge } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";

type Post = {
  id: string;
  platform: string;
  hook: string;
  body: string;
  status: string;
  hashtags: string[];
  project: { title: string };
};

export default function ReviewPage() {
  const { workspaces } = useAuth();
  const workspace = workspaces[0];
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!workspace) return;
    api<{ projects: { id: string }[] }>(`/api/projects?workspaceId=${workspace.id}`).then(async (data) => {
      const all: Post[] = [];
      for (const p of data.projects) {
        const res = await api<{ posts: Post[] }>(`/api/posts/project/${p.id}`);
        all.push(...res.posts.map((post) => ({ ...post, project: { title: (post as Post).project?.title ?? p.id } })));
      }
      setPosts(all);
    });
  }, [workspace]);

  async function setApproval(postId: string, action: "APPROVED" | "REJECTED") {
    await api(`/api/posts/${postId}/approval`, { method: "POST", body: JSON.stringify({ action }) });
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: action } : p)));
  }

  async function bulk(action: "APPROVED" | "REJECTED") {
    const ids = [...selected];
    if (!ids.length) return;
    await api("/api/posts/bulk-approval", { method: "POST", body: JSON.stringify({ postIds: ids, action }) });
    setPosts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, status: action } : p)));
    setSelected(new Set());
  }

  return (
    <AppShell title="Review">
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => bulk("APPROVED")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm">
          Bulk approve
        </button>
        <button onClick={() => bulk("REJECTED")} className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm">
          Bulk reject
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {posts.map((post) => (
          <Card key={post.id}>
            <div className="flex items-start justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={selected.has(post.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(post.id);
                    else next.delete(post.id);
                    setSelected(next);
                  }}
                />
                {post.platform}
              </label>
              <StatusBadge status={post.status} />
            </div>
            <textarea
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm"
              rows={6}
              defaultValue={`${post.hook}\n\n${post.body}`}
              onBlur={async (e) => {
                const [hook, ...rest] = e.target.value.split("\n\n");
                await api(`/api/posts/${post.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ hook, body: rest.join("\n\n") }),
                });
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setApproval(post.id, "APPROVED")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm">
                Approve
              </button>
              <button onClick={() => setApproval(post.id, "REJECTED")} className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm">
                Reject
              </button>
              <button
                onClick={async () => {
                  await api(`/api/posts/${post.id}/regenerate-caption`, { method: "POST" });
                  alert("Caption regenerated — refresh to see changes");
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm"
              >
                Regenerate caption
              </button>
            </div>
          </Card>
        ))}
      </div>
      {!posts.length ? <Card>No posts ready for review yet.</Card> : null}
    </AppShell>
  );
}
