import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

export type TranscriptSegmentResult = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  speaker?: string;
};

export type TranscriptionResult = {
  fullText: string;
  language?: string;
  model: string;
  segments: TranscriptSegmentResult[];
  demoMode: boolean;
};

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/transcribe.py",
);

export async function transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
  try {
    return await runWhisperScript(audioPath);
  } catch (err) {
    if (env.DEMO_MODE) {
      return demoTranscription(audioPath, String(err));
    }
    throw err;
  }
}

async function runWhisperScript(audioPath: string): Promise<TranscriptionResult> {
  const output = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      env.PYTHON_PATH,
      [
        scriptPath,
        "--audio",
        audioPath,
        "--model",
        env.WHISPER_MODEL,
        "--device",
        env.WHISPER_DEVICE,
        "--compute-type",
        env.WHISPER_COMPUTE_TYPE,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Whisper script failed (${code}): ${stderr || stdout}`));
    });
  });

  const parsed = JSON.parse(output) as TranscriptionResult;
  return { ...parsed, demoMode: false };
}

async function demoTranscription(audioPath: string, reason: string): Promise<TranscriptionResult> {
  const stat = await fs.stat(audioPath).catch(() => null);
  const placeholder = `[Demo transcript — Whisper unavailable: ${reason}] This is sample content for local UI testing. Replace with real media once faster-whisper is installed.`;
  return {
    fullText: placeholder,
    language: "en",
    model: "demo",
    demoMode: true,
    segments: [
      { index: 0, startSec: 0, endSec: 30, text: placeholder.slice(0, 120) },
      { index: 1, startSec: 30, endSec: 60, text: "Discuss actionable insights your audience can apply today." },
      { index: 2, startSec: 60, endSec: 90, text: "Share a story that illustrates the main lesson clearly." },
    ],
  };
}
