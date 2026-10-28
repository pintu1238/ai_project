import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.get("/", async (req, res) => {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: req.auth!.userId },
    include: { workspace: true },
  });
  res.json({
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
});

workspacesRouter.get("/:workspaceId/dashboard", async (req, res) => {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: req.params.workspaceId },
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { mediaAsset: true },
  });

  const statusCounts = await prisma.project.groupBy({
    by: ["status"],
    where: { workspaceId: req.params.workspaceId },
    _count: true,
  });

  res.json({
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      errorMessage: p.errorMessage,
      updatedAt: p.updatedAt,
      media: p.mediaAsset
        ? {
            id: p.mediaAsset.id,
            originalName: p.mediaAsset.originalName,
            processingStatus: p.mediaAsset.processingStatus,
          }
        : null,
    })),
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count })),
  });
});
