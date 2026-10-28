"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell, Card } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api, apiForm } from "@/lib/api";
import { useState } from "react";

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewProjectPage() {
  const { workspaces } = useAuth();
  const workspace = workspaces[0];
  const router = useRouter();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { title: "Untitled project" } });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string>("");

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    try {
      setProgress("Creating project…");
      const { project } = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ ...values, workspaceId: workspace.id }),
      });
      if (file) {
        setProgress("Uploading media…");
        const fd = new FormData();
        fd.append("media", file);
        await apiForm(`/api/projects/${project.id}/upload`, fd);
      }
      setProgress("Starting pipeline…");
      await api(`/api/projects/${project.id}/process`, { method: "POST" });
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "Failed to create project" });
      setProgress("");
    }
  }

  return (
    <AppShell title="New project">
      <Card className="max-w-2xl">
        <h1 className="text-xl font-semibold">Upload media</h1>
        <p className="mt-1 text-sm text-slate-400">Supported: MP4, MOV, MP3, WAV (max size configured on server)</p>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="block text-sm">
            <span className="text-slate-300">Project title</span>
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register("title")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Description</span>
            <textarea className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" rows={3} {...form.register("description")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Media file</span>
            <input
              type="file"
              accept=".mp4,.mov,.mp3,.wav,audio/*,video/*"
              className="mt-2 block w-full text-sm text-slate-300"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {progress ? <p className="text-sm text-indigo-200">{progress}</p> : null}
          {form.formState.errors.root ? <p className="text-sm text-rose-300">{form.formState.errors.root.message}</p> : null}
          <button type="submit" className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white">
            Upload & process
          </button>
        </form>
      </Card>
    </AppShell>
  );
}
