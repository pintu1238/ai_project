"use client";

import { useEffect, useState } from "react";
import { AppShell, Card } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";

export default function SocialPage() {
  const { workspaces } = useAuth();
  const workspace = workspaces[0];
  const [accounts, setAccounts] = useState<{ platform: string; connected: boolean; accountName?: string }[]>([]);
  const [setup, setSetup] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!workspace) return;
    api<{ accounts: typeof accounts; setup: Record<string, boolean> }>(`/api/social/${workspace.id}/accounts`).then((data) => {
      setAccounts(data.accounts);
      setSetup(data.setup);
    });
  }, [workspace]);

  return (
    <AppShell title="Social accounts">
      <Card className="mb-4">
        <h2 className="font-medium">Platform setup status</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          <li>LinkedIn credentials: {setup.linkedinConfigured ? "configured" : "missing in .env"}</li>
          <li>X credentials: {setup.xConfigured ? "configured" : "missing in .env"}</li>
          <li>Meta / Instagram: {setup.metaConfigured ? "configured" : "missing in .env"}</li>
        </ul>
        <p className="mt-3 text-sm text-slate-400">
          OAuth flows require registered developer apps. For local testing, connect tokens via the API{" "}
          <code className="text-indigo-200">POST /api/social/connect-manual</code> (admin/owner only). Tokens are encrypted
          server-side and never sent to the browser.
        </p>
      </Card>
      <Card>
        <h2 className="font-medium">Connected accounts</h2>
        <div className="mt-4 space-y-2">
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-400">No accounts connected yet.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.platform} className="flex justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
                <span>{a.platform}</span>
                <span className={a.connected ? "text-emerald-300" : "text-slate-400"}>
                  {a.connected ? a.accountName ?? "Connected" : "Not connected"}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </AppShell>
  );
}
