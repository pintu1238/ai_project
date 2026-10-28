import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export const brandRouter = Router();
brandRouter.use(requireAuth);

const brandSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1).max(120),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontHeading: z.string().max(80),
  fontBody: z.string().max(80),
});

brandRouter.get("/:workspaceId", async (req, res) => {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: req.params.workspaceId },
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const kits = await prisma.brandKit.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ brandKits: kits });
});

brandRouter.put("/", async (req, res) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: parsed.data.workspaceId },
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const existing = await prisma.brandKit.findFirst({
    where: { workspaceId: parsed.data.workspaceId },
  });
  const kit = existing
    ? await prisma.brandKit.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.brandKit.create({ data: parsed.data });
  res.json({ brandKit: kit });
});
