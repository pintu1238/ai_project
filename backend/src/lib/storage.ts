import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  await fs.mkdir(env.ASSET_DIR, { recursive: true });
}

export function resolveUploadPath(filename: string): string {
  return path.resolve(env.UPLOAD_DIR, filename);
}

export function resolveAssetPath(filename: string): string {
  return path.resolve(env.ASSET_DIR, filename);
}
