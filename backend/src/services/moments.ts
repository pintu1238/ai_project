import { ollamaJson } from "./ollama.js";
import type { TranscriptSegmentResult } from "./transcription.js";

export type MomentCandidate = {
  id: string;
  startSec: number;
  endSec: number;
  transcriptText: string;
  title: string;
  topic: string;
  relevanceScore: number;
  reason: string;
};

const SCHEMA = `Return JSON: {"moments":[{"id":"m1","startSec":0,"endSec":12,"transcriptText":"exact quote from transcript","title":"short title","topic":"topic","relevanceScore":0.9,"reason":"why selected"}]}
Rules: Use ONLY text from the provided transcript segments. Do not invent quotes. Pick up to 10 non-redundant high-value moments.`;

export async function detectMoments(
  segments: TranscriptSegmentResult[],
): Promise<{ moments: MomentCandidate[]; demoMode: boolean }> {
  const chunkSize = 40;
  const allCandidates: MomentCandidate[] = [];

  for (let i = 0; i < segments.length; i += chunkSize) {
    const chunk = segments.slice(i, i + chunkSize);
    const transcriptBlock = chunk
      .map((s) => `[${s.startSec.toFixed(1)}-${s.endSec.toFixed(1)}] ${s.text}`)
      .join("\n");

    const result = await ollamaJson<{ moments?: MomentCandidate[] }>(
      `Transcript segments:\n${transcriptBlock}`,
      SCHEMA,
    );

    if (result.demoMode) {
      return { moments: demoMoments(segments), demoMode: true };
    }
    for (const m of result.data.moments ?? []) {
      if (validateMoment(m, segments)) allCandidates.push(m);
    }
  }

  const ranked = dedupeMoments(allCandidates)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);

  if (ranked.length === 0) {
    return { moments: heuristicMoments(segments), demoMode: false };
  }
  return { moments: ranked, demoMode: false };
}

function validateMoment(m: MomentCandidate, segments: TranscriptSegmentResult[]): boolean {
  if (!m.transcriptText?.trim()) return false;
  const haystack = segments.map((s) => s.text).join(" ").toLowerCase();
  const needle = m.transcriptText.trim().toLowerCase().slice(0, 40);
  return haystack.includes(needle.slice(0, 20));
}

function dedupeMoments(moments: MomentCandidate[]): MomentCandidate[] {
  const seen = new Set<string>();
  return moments.filter((m) => {
    const key = `${Math.round(m.startSec)}:${m.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function heuristicMoments(segments: TranscriptSegmentResult[]): MomentCandidate[] {
  return segments
    .filter((s) => s.text.length > 40)
    .slice(0, 10)
    .map((s, idx) => ({
      id: `h${idx + 1}`,
      startSec: s.startSec,
      endSec: s.endSec,
      transcriptText: s.text,
      title: s.text.slice(0, 60),
      topic: "General",
      relevanceScore: 0.5,
      reason: "Selected by length heuristic when LLM output was empty",
    }));
}

function demoMoments(segments: TranscriptSegmentResult[]): MomentCandidate[] {
  return heuristicMoments(segments).map((m, i) => ({
    ...m,
    id: `demo${i + 1}`,
    relevanceScore: 0.75,
    reason: "Demo mode moment (Ollama unavailable)",
  }));
}
