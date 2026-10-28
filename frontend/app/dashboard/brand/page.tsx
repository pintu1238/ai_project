"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppShell, Card } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontHeading: z.string(),
  fontBody: z.string(),
});

type FormValues = z.infer<typeof schema>;

export default function BrandPage() {
  const { workspaces } = useAuth();
  const workspace = workspaces[0];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "ContentFlow Default",
      primaryColor: "#6366f1",
      secondaryColor: "#0f172a",
      accentColor: "#22c55e",
      fontHeading: "Inter",
      fontBody: "Inter",
    },
  });

  useEffect(() => {
    if (!workspace) return;
    api<{ brandKits: FormValues[] }>(`/api/brand/${workspace.id}`).then((data) => {
      if (data.brandKits[0]) form.reset(data.brandKits[0]);
    });
  }, [workspace, form]);

  async function onSubmit(values: FormValues) {
    if (!workspace) return;
    await api("/api/brand", { method: "PUT", body: JSON.stringify({ ...values, workspaceId: workspace.id }) });
    alert("Brand kit saved");
  }

  return (
    <AppShell title="Brand kit">
      <Card className="max-w-xl">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {(["name", "primaryColor", "secondaryColor", "accentColor", "fontHeading", "fontBody"] as const).map((field) => (
            <label key={field} className="block text-sm capitalize">
              <span className="text-slate-300">{field.replace(/([A-Z])/g, " $1")}</span>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register(field)} />
            </label>
          ))}
          <button type="submit" className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium">
            Save brand kit
          </button>
        </form>
      </Card>
    </AppShell>
  );
}
