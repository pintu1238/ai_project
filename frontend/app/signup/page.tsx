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
  name: z.string().min(1).max(120),
  email: z.email(),
  password: z.string().min(8),
  workspaceName: z.string().min(1).max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const data = await api("/api/auth/signup", { method: "POST", body: JSON.stringify(values) });
      setSession(data as never);
      router.push("/dashboard");
    } catch (err) {
      form.setError("root", { message: err instanceof Error ? err.message : "Signup failed" });
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-white">Create account</h1>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <label className="block text-sm">
            <span className="text-slate-300">Name</span>
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register("name")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input type="email" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register("email")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Password</span>
            <input type="password" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register("password")} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Workspace name</span>
            <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" {...form.register("workspaceName")} />
          </label>
          {form.formState.errors.root ? (
            <p className="text-sm text-rose-300">{form.formState.errors.root.message}</p>
          ) : null}
          <button type="submit" className="w-full rounded-xl bg-indigo-500 py-2.5 font-medium text-white hover:bg-indigo-400">
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-300">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
