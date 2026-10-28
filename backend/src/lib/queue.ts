import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

let connection: Redis | null = null;
let pipelineQueue: Queue | null = null;
let publishQueue: Queue | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  }
  return connection;
}

function getPipelineQueue(): Queue {
  if (!pipelineQueue) {
    pipelineQueue = new Queue("contentflow-pipeline", { connection: getConnection() });
  }
  return pipelineQueue;
}

function getPublishQueue(): Queue {
  if (!publishQueue) {
    publishQueue = new Queue("contentflow-publish", { connection: getConnection() });
  }
  return publishQueue;
}

export type PipelineJobName =
  | "transcribe"
  | "detect-moments"
  | "generate-posts"
  | "render-graphics";

export type PipelineJobData = {
  projectId: string;
  stage: PipelineJobName;
};

export async function enqueuePipeline(projectId: string, stage: PipelineJobName) {
  const jobId = `${projectId}:${stage}`;
  await getPipelineQueue().add(
    stage,
    { projectId, stage } satisfies PipelineJobData,
    {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  );
}

export async function enqueuePublish(
  scheduledPostId: string,
  idempotencyKey: string,
  delayMs = 0,
) {
  await getPublishQueue().add(
    "publish",
    { scheduledPostId },
    {
      jobId: idempotencyKey,
      delay: delayMs,
      removeOnComplete: 200,
      removeOnFail: 200,
      attempts: 5,
      backoff: { type: "exponential", delay: 10000 },
    },
  );
}
