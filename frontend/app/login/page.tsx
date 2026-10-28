"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/app-shell";

const schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const data = await api<{ user: FormValues & { id: string; name?: string; timezone: string }; workspaces: unknown[] }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify(values) },
      );
      setSession(data as never);
      router.push("/dashboard");
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "Login failed" });
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-white">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">Access your ContentFlow workspace</p>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              {...form.register("email")}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.root ? (
            <p className="text-sm text-rose-300">{form.formState.errors.root.message}</p>
          ) : null}
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          No account?{" "}
          <Link href="/signup" className="text-indigo-300 hover:text-indigo-200">
            Create one
          </Link>
        </p>
      </Card>
    </div>
  );
}
