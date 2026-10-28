import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { enqueuePublish } from "../lib/queue.js";

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

scheduleRouter.get("/:workspaceId", async (req, res) => {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: req.auth!.userId, workspaceId: req.params.workspaceId },
    },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86400000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 60 * 86400000);

  const scheduled = await prisma.scheduledPost.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      post: { project: { workspaceId: req.params.workspaceId } },
    },
    include: { post: true },
    orderBy: { scheduledAt: "asc" },
  });
  res.json({ scheduled });
});

const createSchema = z.object({
  postId: z.string(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1),
});

scheduleRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const post = await prisma.post.findUnique({
    where: { id: parsed.data.postId },
    include: { project: { include: { workspace: { include: { memberships: { where: { userId: req.auth!.userId } } } } } } },
  });
  if (!post || post.project.workspace.memberships.length === 0) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.status !== "APPROVED") {
    res.status(400).json({ error: "Only approved posts can be scheduled" });
    return;
  }

  const idempotencyKey = crypto.createHash("sha256").update(`${post.id}:${parsed.data.scheduledAt}`).digest("hex");
  const scheduled = await prisma.scheduledPost.create({
    data: {
      postId: post.id,
      scheduledAt: new Date(parsed.data.scheduledAt),
      timezone: parsed.data.timezone,
      idempotencyKey,
      status: "PENDING",
    },
  });
  await prisma.post.update({ where: { id: post.id }, data: { status: "SCHEDULED" } });

  const delay = Math.max(0, scheduled.scheduledAt.getTime() - Date.now());
  await enqueuePublish(scheduled.id, idempotencyKey, delay);

  res.status(201).json({ scheduledPost: scheduled });
});

scheduleRouter.post("/:scheduledPostId/cancel", async (req, res) => {
  const scheduled = await prisma.scheduledPost.findUnique({
    where: { id: req.params.scheduledPostId },
    include: { post: { include: { project: { include: { workspace: { include: { memberships: { where: { userId: req.auth!.userId } } } } } } } } },
  });
  if (!scheduled || scheduled.post.project.workspace.memberships.length === 0) {
    res.status(404).json({ error: "Scheduled post not found" });
    return;
  }
  if (scheduled.status === "PUBLISHED") {
    res.status(400).json({ error: "Cannot cancel published post" });
    return;
  }
  const updated = await prisma.scheduledPost.update({
    where: { id: scheduled.id },
    data: { status: "CANCELLED" },
  });
  res.json({ scheduledPost: updated });
});

scheduleRouter.post("/:scheduledPostId/retry", async (req, res) => {
  const scheduled = await prisma.scheduledPost.findUnique({
    where: { id: req.params.scheduledPostId },
    include: { post: { include: { project: { include: { workspace: { include: { memberships: { where: { userId: req.auth!.userId } } } } } } } } },
  });
  if (!scheduled || scheduled.post.project.workspace.memberships.length === 0) {
    res.status(404).json({ error: "Scheduled post not found" });
    return;
  }
  await enqueuePublish(scheduled.id, `${scheduled.idempotencyKey}:retry:${Date.now()}`);
  res.json({ ok: true });
});
