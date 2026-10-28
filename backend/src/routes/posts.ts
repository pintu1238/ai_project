import { Router } from "express";
import { z } from "zod";
import { ApprovalAction, PostStatus } from "@prisma/client";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { generatePosts } from "../services/posts.js";
import { buildQuoteCardSvg, renderSvgToPng, type BrandStyle } from "../services/graphics.js";

export const postsRouter = Router();
postsRouter.use(requireAuth);

postsRouter.get("/project/:projectId", async (req, res) => {
  const access = await assertProjectAccess(req.params.projectId, req.auth!.userId);
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const posts = await prisma.post.findMany({
    where: { projectId: req.params.projectId },
    include: { assets: true, moments: true, approvalHistory: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
  });
  res.json({ posts });
});

const updateSchema = z.object({
  hook: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  hashtags: z.array(z.string()).max(15).optional(),
  callToAction: z.string().max(200).optional(),
});

postsRouter.patch("/:postId", async (req, res) => {
  const post = await loadPost(req.params.postId, req.auth!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.post.update({
    where: { id: post.id },
    data: parsed.data,
  });
  res.json({ post: updated });
});

postsRouter.post("/:postId/regenerate-caption", async (req, res) => {
  const post = await loadPost(req.params.postId, req.auth!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const moments = post.moments.map((m) => ({
    id: m.externalId,
    startSec: m.startSec,
    endSec: m.endSec,
    transcriptText: m.transcriptText,
    title: m.title,
    topic: m.topic ?? "",
    relevanceScore: m.relevanceScore,
    reason: m.reason,
  }));
  const generated = await generatePosts(moments, post.project.title);
  const candidate = generated.posts.find((p) => p.platform === post.platform) ?? generated.posts[0];
  if (!candidate) {
    res.status(500).json({ error: "Could not regenerate caption" });
    return;
  }
  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      hook: candidate.hook,
      body: candidate.body,
      hashtags: candidate.hashtags,
      callToAction: candidate.callToAction,
    },
  });
  res.json({ post: updated, demoMode: generated.demoMode });
});

postsRouter.post("/:postId/regenerate-image", async (req, res) => {
  const post = await loadPost(req.params.postId, req.auth!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const kit = await prisma.brandKit.findFirst({
    where: { workspaceId: post.project.workspaceId },
  });
  const brand: BrandStyle = {
    primaryColor: kit?.primaryColor ?? "#6366f1",
    secondaryColor: kit?.secondaryColor ?? "#0f172a",
    accentColor: kit?.accentColor ?? "#22c55e",
    fontHeading: kit?.fontHeading ?? "Inter",
    fontBody: kit?.fontBody ?? "Inter",
    brandName: kit?.name ?? "ContentFlow",
  };
  const svg = buildQuoteCardSvg({ quote: post.body, hook: post.hook, brand });
  const storagePath = await renderSvgToPng(svg, `${post.id}-${Date.now()}.png`);
  const asset = await prisma.postAsset.create({
    data: { postId: post.id, storagePath, template: "quote-card" },
  });
  res.json({ asset });
});

const approvalSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

postsRouter.post("/:postId/approval", async (req, res) => {
  const post = await loadPost(req.params.postId, req.auth!.userId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const parsed = approvalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const status: PostStatus = parsed.data.action === "APPROVED" ? "APPROVED" : "REJECTED";
  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { status },
  });
  await prisma.approvalHistory.create({
    data: {
      postId: post.id,
      userId: req.auth!.userId,
      action: parsed.data.action as ApprovalAction,
      note: parsed.data.note,
    },
  });
  res.json({ post: updated });
});

postsRouter.post("/bulk-approval", async (req, res) => {
  const schema = z.object({
    postIds: z.array(z.string()).min(1),
    action: z.enum(["APPROVED", "REJECTED"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const status: PostStatus = parsed.data.action === "APPROVED" ? "APPROVED" : "REJECTED";
  let count = 0;
  for (const postId of parsed.data.postIds) {
    const post = await loadPost(postId, req.auth!.userId);
    if (!post) continue;
    await prisma.post.update({ where: { id: postId }, data: { status } });
    await prisma.approvalHistory.create({
      data: {
        postId,
        userId: req.auth!.userId,
        action: parsed.data.action as ApprovalAction,
      },
    });
    count++;
  }
  res.json({ updated: count });
});

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: { include: { memberships: { where: { userId } } } } },
  });
  if (!project || project.workspace.memberships.length === 0) return null;
  return project;
}

async function loadPost(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      moments: true,
      project: { include: { workspace: { include: { memberships: { where: { userId } } } } } },
    },
  });
  if (!post || post.project.workspace.memberships.length === 0) return null;
  return post;
}
