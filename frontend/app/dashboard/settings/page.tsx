"use client";

import { AppShell, Card } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const { user } = useAuth();
  return (
    <AppShell title="Settings">
      <Card className="max-w-xl space-y-3 text-sm text-slate-300">
        <p>
          <span className="text-slate-400">Email:</span> {user?.email}
        </p>
        <p>
          <span className="text-slate-400">Timezone:</span> {user?.timezone}
        </p>
        <p className="text-slate-400">
          Configure Ollama model, Whisper, FFmpeg paths, and OAuth credentials in the root <code>.env</code> file. See{" "}
          <code>README.md</code> for hardware requirements and optional services.
        </p>
        <p className="text-slate-400">
          Set <code>DEMO_MODE=true</code> only when Whisper/Ollama are unavailable — API responses will label demo inference
          in transcript metadata.
        </p>
      </Card>
    </AppShell>
  );
}
