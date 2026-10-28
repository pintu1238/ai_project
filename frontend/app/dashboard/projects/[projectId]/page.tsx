"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell, Card, StatusBadge } from "@/components/app-shell";
import { api } from "@/lib/api";

type Project = {
  id: string;
  title: string;
  status: string;
  errorMessage?: string | null;
  mediaAsset?: { originalName: string; processingStatus: string } | null;
  transcript?: { id: string } | null;
};

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [transcript, setTranscript] = useState<{ fullText: string; segments: { startSec: number; endSec: number; text: string }[] } | null>(null);
  const [moments, setMoments] = useState<
    { id: string; title: string; relevanceScore: number; reason: string; transcriptText: string }[]
  >([]);
  const [posts, setPosts] = useState<
    { id: string; platform: string; hook: string; body: string; status: string; assets: { storagePath: string }[] }[]
  >([]);
  const [search, setSearch] = useState("");

  async function refresh() {
    const { project: p } = await api<{ project: Project }>(`/api/projects/${params.projectId}`);
    setProject(p);
    if (["TRANSCRIBED", "MOMENTS_READY", "POSTS_READY", "REVIEW", "COMPLETED"].includes(p.status)) {
      try {
        const t = await api<{ transcript: typeof transcript }>(
          `/api/projects/${params.projectId}/transcript?q=${encodeURIComponent(search)}`,
        );
        setTranscript(t.transcript);
      } catch {
        /* not ready */
      }
    }
    if (["MOMENTS_READY", "POSTS_READY", "REVIEW", "COMPLETED"].includes(p.status)) {
      const m = await api<{ moments: typeof moments }>(`/api/projects/${params.projectId}/moments`);
      setMoments(m.moments);
    }
    if (["POSTS_READY", "REVIEW", "COMPLETED"].includes(p.status)) {
      const ps = await api<{ posts: typeof posts }>(`/api/posts/project/${params.projectId}`);
      setPosts(ps.posts);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- poll project pipeline status
    void refresh();
    const timer = setInterval(() => {
      if (project && !["REVIEW", "COMPLETED", "FAILED"].includes(project.status)) void refresh();
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId, search]);

  return (
    <AppShell title={project?.title ?? "Project"}>
      {!project ? (
        <p className="text-slate-400">Loading project…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.title}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.errorMessage ? <p className="text-sm text-rose-300">{project.errorMessage}</p> : null}
          <Card>
            <h2 className="font-medium">Processing</h2>
            <p className="mt-2 text-sm text-slate-400">
              Media: {project.mediaAsset?.originalName ?? "—"} ({project.mediaAsset?.processingStatus ?? "none"})
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Pipeline runs in the background worker. Start it with <code className="text-indigo-200">npm run worker</code> in{" "}
              <code className="text-indigo-200">backend/</code>.
            </p>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">Transcript</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transcript"
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm"
              />
            </div>
            {!transcript ? (
              <p className="mt-3 text-sm text-slate-400">Transcript not available yet.</p>
            ) : (
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto text-sm">
                {transcript.segments.map((s, i) => (
                  <p key={i} className="rounded-lg bg-black/20 p-3">
                    <span className="text-xs text-indigo-300">
                      [{s.startSec.toFixed(1)}–{s.endSec.toFixed(1)}]
                    </span>{" "}
                    {s.text}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-medium">Top moments ({moments.length})</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {moments.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="font-medium text-white">{m.title}</p>
                  <p className="text-xs text-slate-400">Score {m.relevanceScore.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-slate-300">{m.transcriptText}</p>
                  <p className="mt-2 text-xs text-slate-500">{m.reason}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-medium">Generated posts ({posts.length})</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {posts.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-indigo-300">{p.platform}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-2 font-medium">{p.hook}</p>
                  <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{p.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
