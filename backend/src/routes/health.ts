import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const checks: Record<string, string> = { api: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
    await redis.ping();
    checks.redis = "ok";
    redis.disconnect();
  } catch {
    checks.redis = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({
    service: "contentflow-api",
    status: healthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
});
