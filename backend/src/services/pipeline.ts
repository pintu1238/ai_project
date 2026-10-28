import path from "node:path";
import { prisma } from "../lib/prisma.js";
import { enqueuePipeline } from "../lib/queue.js";
import { extractAudio, probeDuration } from "./ffmpeg.js";
import { transcribeAudio } from "./transcription.js";
import { detectMoments } from "./moments.js";
import { generatePosts } from "./posts.js";
import { buildQuoteCardSvg, renderSvgToPng, type BrandStyle } from "./graphics.js";
import { env } from "../config/env.js";
import { loggerScope } from "../lib/logger.js";

const log = loggerScope("pipeline");

export async function runTranscribeStage(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { mediaAsset: true },
  });
  if (!project?.mediaAsset) throw new Error("Project has no media asset");

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "PROCESSING", errorMessage: null },
  });
  await prisma.mediaAsset.update({
    where: { id: project.mediaAsset.id },
    data: { processingStatus: "PROCESSING" },
  });

  const audioPath = path.join(env.UPLOAD_DIR, `${project.mediaAsset.id}.wav`);
  await extractAudio(project.mediaAsset.storagePath, audioPath);

  const duration = await probeDuration(project.mediaAsset.storagePath);
  if (duration) {
    await prisma.mediaAsset.update({
      where: { id: project.mediaAsset.id },
      data: { durationSec: duration },
    });
  }

  const transcription = await transcribeAudio(audioPath);

  await prisma.transcript.deleteMany({ where: { projectId } });
  const transcript = await prisma.transcript.create({
    data: {
      projectId,
      fullText: transcription.fullText,
      language: transcription.language,
      model: transcription.model,
      metadata: { demoMode: transcription.demoMode },
      segments: {
        create: transcription.segments.map((s) => ({
          index: s.index,
          startSec: s.startSec,
          endSec: s.endSec,
          text: s.text,
          speaker: s.speaker,
        })),
      },
    },
  });

  await prisma.mediaAsset.update({
    where: { id: project.mediaAsset.id },
    data: { processingStatus: "COMPLETED" },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "TRANSCRIBED" },
  });

  log.info("Transcription complete", { projectId, transcriptId: transcript.id });
  await enqueuePipeline(projectId, "detect-moments");
}

export async function runMomentsStage(projectId: string): Promise<void> {
  const transcript = await prisma.transcript.findUnique({
    where: { projectId },
    include: { segments: { orderBy: { index: "asc" } } },
  });
  if (!transcript) throw new Error("Transcript missing");

  const segments = transcript.segments.map((s) => ({
    index: s.index,
    startSec: s.startSec,
    endSec: s.endSec,
    text: s.text,
    speaker: s.speaker ?? undefined,
  }));

  const { moments, demoMode } = await detectMoments(segments);
  await prisma.moment.deleteMany({ where: { projectId } });
  await prisma.moment.createMany({
    data: moments.map((m, rank) => ({
      projectId,
      externalId: m.id,
      startSec: m.startSec,
      endSec: m.endSec,
      transcriptText: m.transcriptText,
      title: m.title,
      topic: m.topic,
      relevanceScore: m.relevanceScore,
      reason: m.reason,
      rank: rank + 1,
    })),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "MOMENTS_READY" },
  });
  await prisma.transcript.update({
    where: { id: transcript.id },
    data: { metadata: { ...(transcript.metadata as object), momentsDemoMode: demoMode } },
  });

  await enqueuePipeline(projectId, "generate-posts");
}

export async function runPostsStage(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { moments: { orderBy: { rank: "asc" } } },
  });
  if (!project) throw new Error("Project not found");

  const { posts, demoMode } = await generatePosts(
    project.moments.map((m) => ({
      id: m.externalId,
      startSec: m.startSec,
      endSec: m.endSec,
      transcriptText: m.transcriptText,
      title: m.title,
      topic: m.topic ?? "",
      relevanceScore: m.relevanceScore,
      reason: m.reason,
    })),
    project.title,
  );

  await prisma.post.deleteMany({ where: { projectId } });
  for (const p of posts) {
    const momentRecords = await prisma.moment.findMany({
      where: { projectId, externalId: { in: p.momentIds } },
    });
    await prisma.post.create({
      data: {
        projectId,
        platform: p.platform,
        hook: p.hook,
        body: p.body,
        hashtags: p.hashtags,
        callToAction: p.callToAction,
        threadOrder: p.threadOrder,
        status: "PENDING_REVIEW",
        moments: { connect: momentRecords.map((m) => ({ id: m.id })) },
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "POSTS_READY" },
  });

  if (demoMode) {
    log.warn("Posts generated in demo mode", { projectId });
  }

  await enqueuePipeline(projectId, "render-graphics");
}

export async function runGraphicsStage(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      posts: true,
      workspace: { include: { brandKits: { take: 1 } } },
    },
  });
  if (!project) throw new Error("Project not found");

  const kit = project.workspace.brandKits[0];
  const brand: BrandStyle = {
    primaryColor: kit?.primaryColor ?? "#6366f1",
    secondaryColor: kit?.secondaryColor ?? "#0f172a",
    accentColor: kit?.accentColor ?? "#22c55e",
    fontHeading: kit?.fontHeading ?? "Inter",
    fontBody: kit?.fontBody ?? "Inter",
    brandName: kit?.name ?? project.workspace.name,
  };

  for (const post of project.posts) {
    const svg = buildQuoteCardSvg({
      quote: post.body,
      hook: post.hook,
      brand,
    });
    const filename = `${post.id}.png`;
    const storagePath = await renderSvgToPng(svg, filename);
    await prisma.postAsset.create({
      data: {
        postId: post.id,
        storagePath,
        template: "quote-card",
        layoutJson: { hook: post.hook },
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "REVIEW" },
  });
}
