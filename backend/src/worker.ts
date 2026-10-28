import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./config/env.js";
import type { PipelineJobData } from "./lib/queue.js";
import {
  runTranscribeStage,
  runMomentsStage,
  runPostsStage,
  runGraphicsStage,
} from "./services/pipeline.js";
import { publishScheduledPost } from "./services/publish.js";
import { prisma } from "./lib/prisma.js";
import { loggerScope } from "./lib/logger.js";

const log = loggerScope("worker");
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

async function handlePipeline(jobName: string, projectId: string) {
  switch (jobName) {
    case "transcribe":
      await runTranscribeStage(projectId);
      break;
    case "detect-moments":
      await runMomentsStage(projectId);
      break;
    case "generate-posts":
      await runPostsStage(projectId);
      break;
    case "render-graphics":
      await runGraphicsStage(projectId);
      break;
    default:
      throw new Error(`Unknown pipeline job: ${jobName}`);
  }
}

new Worker<PipelineJobData>(
  "contentflow-pipeline",
  async (job) => {
    log.info("Processing pipeline job", { jobId: job.id, stage: job.name });
    try {
      await handlePipeline(job.name, job.data.projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      await prisma.project.update({
        where: { id: job.data.projectId },
        data: { status: "FAILED", errorMessage: message },
      });
      throw err;
    }
  },
  { connection },
);

new Worker(
  "contentflow-publish",
  async (job) => {
    const { scheduledPostId } = job.data as { scheduledPostId: string };
    await publishScheduledPost(scheduledPostId);
  },
  { connection },
);

log.info("Workers started");
