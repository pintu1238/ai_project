"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, Card, StatusBadge } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  errorMessage?: string | null;
  media?: { originalName: string; processingStatus: string } | null;
};

export default function DashboardPage() {
  const { workspaces, user, logout } = useAuth();
  const workspace = workspaces[0];
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<{ status: string; count: number }[]>([]);

  useEffect(() => {
    if (!workspace) return;
    api<{ projects: ProjectRow[]; statusCounts: { status: string; count: number }[] }>(
      `/api/workspaces/${workspace.id}/dashboard`,
    ).then((data) => {
      setProjects(data.projects);
      setStatusCounts(data.statusCounts);
    });
  }, [workspace]);

  return (
    <AppShell
      title="Dashboard"
      actions={
        <button onClick={() => logout()} className="text-sm text-slate-400 hover:text-white">
          Sign out ({user?.email})
        </button>
      }
    >
      {!workspace ? (
        <Card>No workspace found. Complete signup or contact support.</Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{workspace.name}</h1>
              <p className="text-sm text-slate-400">Recent projects and pipeline status</p>
            </div>
            <Link
              href="/dashboard/projects/new"
              className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              New project
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statusCounts.map((s) => (
              <Card key={s.status} className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{s.status.replaceAll("_", " ")}</p>
                <p className="mt-1 text-2xl font-semibold">{s.count}</p>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-lg font-medium text-white">Recent projects</h2>
            <div className="mt-4 divide-y divide-white/10">
              {projects.length === 0 ? (
                <p className="py-6 text-sm text-slate-400">No projects yet. Upload your first media file.</p>
              ) : (
                projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/projects/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-white/5"
                  >
                    <div>
                      <p className="font-medium text-white">{p.title}</p>
                      <p className="text-xs text-slate-400">
                        {p.media?.originalName ?? "No media"} · updated {new Date(p.updatedAt).toLocaleString()}
                      </p>
                      {p.errorMessage ? <p className="text-xs text-rose-300">{p.errorMessage}</p> : null}
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
