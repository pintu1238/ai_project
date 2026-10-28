import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(16).optional(),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  ASSET_DIR: z.string().default("./storage/assets"),
  MAX_UPLOAD_BYTES: z.coerce.number().default(524_288_000),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  PYTHON_PATH: z.string().default("python"),
  WHISPER_MODEL: z.string().default("base"),
  WHISPER_DEVICE: z.string().default("cpu"),
  WHISPER_COMPUTE_TYPE: z.string().default("int8"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2:3b"),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  TOKEN_ENCRYPTION_KEY: z.string().min(16),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
