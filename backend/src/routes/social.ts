import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export const socialRouter = Router();
socialRouter.use(requireAuth);

socialRouter.get("/:workspaceId/accounts", async (req, res) => {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: req.params.workspaceId },
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: req.params.workspaceId },
  });
  res.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      accountName: a.accountName,
      connected: a.connected,
      scopes: a.scopes,
      tokenExpiresAt: a.tokenExpiresAt,
    })),
    setup: {
      linkedinConfigured: Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
      xConfigured: Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET),
      metaConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET),
    },
  });
});

const manualConnectSchema = z.object({
  workspaceId: z.string(),
  platform: z.enum(["INSTAGRAM", "LINKEDIN", "X"]),
  accessToken: z.string().min(10),
  accountName: z.string().optional(),
});

/** Dev-friendly manual token connect when OAuth apps are not registered yet. */
socialRouter.post("/connect-manual", async (req, res) => {
  const parsed = manualConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: parsed.data.workspaceId },
    },
  });
  if (!membership || membership.role === "MEMBER") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { encryptSecret } = await import("../lib/crypto.js");
  const account = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform: {
        workspaceId: parsed.data.workspaceId,
        platform: parsed.data.platform,
      },
    },
    create: {
      workspaceId: parsed.data.workspaceId,
      platform: parsed.data.platform,
      accessTokenEnc: encryptSecret(parsed.data.accessToken),
      accountName: parsed.data.accountName,
      connected: true,
    },
    update: {
      accessTokenEnc: encryptSecret(parsed.data.accessToken),
      accountName: parsed.data.accountName,
      connected: true,
    },
  });
  res.json({
    account: {
      id: account.id,
      platform: account.platform,
      connected: account.connected,
      accountName: account.accountName,
    },
  });
});

socialRouter.get("/oauth/:platform/start", (_req, res) => {
  res.status(501).json({
    error: "OAuth start routes require platform app registration. Use /connect-manual for local dev or configure client IDs in .env",
  });
});
