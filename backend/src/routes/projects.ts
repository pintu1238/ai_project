import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { resolveUploadPath, ensureStorageDirs } from "../lib/storage.js";
import { enqueuePipeline } from "../lib/queue.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
]);

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureStorageDirs();
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Unsupported file type. Allowed: MP4, MOV, MP3, WAV"));
      return;
    }
    cb(null, true);
  },
});

projectsRouter.get("/", async (req, res) => {
  const workspaceId = String(req.query.workspaceId ?? "");
  if (!workspaceId) {
    res.status(400).json({ error: "workspaceId required" });
    return;
  }
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: req.auth!.userId, workspaceId } },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { mediaAsset: true, transcript: true, _count: { select: { posts: true, moments: true } } },
  });
  res.json({
    projects: projects.map((p) => ({
      ...p,
      mediaAsset: p.mediaAsset
        ? { ...p.mediaAsset, sizeBytes: p.mediaAsset.sizeBytes.toString() }
        : null,
    })),
  });
});

projectsRouter.post("/", async (req, res) => {
  const schema = z.object({
    workspaceId: z.string(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  });
  const parsed = schema.safeParse(req.body);
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
  const project = await prisma.project.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "DRAFT",
    },
  });
  res.status(201).json({ project });
});

projectsRouter.get("/:projectId", async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ project });
});

projectsRouter.delete("/:projectId", async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await prisma.project.delete({ where: { id: project.id } });
  res.json({ ok: true });
});

projectsRouter.post("/:projectId/upload", upload.single("media"), async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const storagePath = resolveUploadPath(req.file.filename);
  const asset = await prisma.mediaAsset.create({
    data: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: BigInt(req.file.size),
      storagePath,
      processingStatus: "UPLOADED",
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      mediaAssetId: asset.id,
      status: "UPLOADED",
    },
  });

  res.json({
    mediaAsset: {
      id: asset.id,
      originalName: asset.originalName,
      sizeBytes: asset.sizeBytes.toString(),
      processingStatus: asset.processingStatus,
    },
  });
});

projectsRouter.post("/:projectId/process", async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project?.mediaAssetId) {
    res.status(400).json({ error: "Upload media before processing" });
    return;
  }
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "QUEUED", errorMessage: null },
  });
  await prisma.mediaAsset.update({
    where: { id: project.mediaAssetId },
    data: { processingStatus: "QUEUED" },
  });
  await enqueuePipeline(project.id, "transcribe");
  res.json({ ok: true, status: "QUEUED" });
});

projectsRouter.get("/:projectId/transcript", async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const q = String(req.query.q ?? "").toLowerCase();
  const transcript = await prisma.transcript.findUnique({
    where: { projectId: project.id },
    include: { segments: { orderBy: { index: "asc" } } },
  });
  if (!transcript) {
    res.status(404).json({ error: "Transcript not ready" });
    return;
  }
  const segments = q
    ? transcript.segments.filter((s) => s.text.toLowerCase().includes(q))
    : transcript.segments;
  res.json({ transcript: { ...transcript, segments } });
});

projectsRouter.get("/:projectId/moments", async (req, res) => {
  const project = await loadProjectForUser(String(req.params.projectId), req.auth!.userId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const moments = await prisma.moment.findMany({
    where: { projectId: project.id },
    orderBy: { rank: "asc" },
  });
  res.json({ moments });
});

async function loadProjectForUser(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      mediaAsset: true,
      workspace: { include: { memberships: { where: { userId } } } },
    },
  });
  if (!project || project.workspace.memberships.length === 0) return null;
  return project;
}
