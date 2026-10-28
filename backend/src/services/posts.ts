import { PostPlatform } from "@prisma/client";
import { ollamaJson } from "./ollama.js";
import type { MomentCandidate } from "./moments.js";

export type GeneratedPost = {
  platform: PostPlatform;
  hook: string;
  body: string;
  hashtags: string[];
  callToAction?: string;
  momentIds: string[];
  threadOrder?: number;
};

const LIMITS = {
  INSTAGRAM: { body: 2200, hook: 120 },
  LINKEDIN: { body: 3000, hook: 150 },
  X: { body: 280, hook: 100 },
} as const;

const SCHEMA = `Return JSON: {"posts":[{"platform":"INSTAGRAM|LINKEDIN|X","hook":"...","body":"...","hashtags":["tag"],"callToAction":"...","momentIds":["m1"],"threadOrder":null}]}
Generate distinct, non-duplicative posts grounded in the moments. Target 12-15 total across platforms. If source is thin, return fewer and include "note" field explaining why.`;

export async function generatePosts(
  moments: MomentCandidate[],
  projectTitle: string,
): Promise<{ posts: GeneratedPost[]; demoMode: boolean; note?: string }> {
  const momentBlock = moments
    .map(
      (m) =>
        `${m.id} [${m.startSec}-${m.endSec}] ${m.title}: "${m.transcriptText}"`,
    )
    .join("\n");

  const result = await ollamaJson<{ posts?: GeneratedPost[]; note?: string }>(
    `Project: ${projectTitle}\nMoments:\n${momentBlock}`,
    SCHEMA,
  );

  if (result.demoMode) {
    return { posts: demoPosts(moments), demoMode: true };
  }

  const posts = (result.data.posts ?? [])
    .map((p) => normalizePost(p))
    .filter(Boolean) as GeneratedPost[];

  if (posts.length === 0) {
    return { posts: demoPosts(moments), demoMode: false, note: "Fell back to template posts" };
  }

  return { posts, demoMode: false, note: result.data.note };
}

function normalizePost(raw: GeneratedPost): GeneratedPost | null {
  const platform = raw.platform as PostPlatform;
  if (!["INSTAGRAM", "LINKEDIN", "X"].includes(platform)) return null;
  const limits = LIMITS[platform];
  return {
    platform,
    hook: raw.hook?.slice(0, limits.hook) ?? "",
    body: raw.body?.slice(0, limits.body) ?? "",
    hashtags: (raw.hashtags ?? []).slice(0, 10).map((h) => h.replace(/^#/, "")),
    callToAction: raw.callToAction?.slice(0, 200),
    momentIds: raw.momentIds ?? [],
    threadOrder: raw.threadOrder ?? undefined,
  };
}

function demoPosts(moments: MomentCandidate[]): GeneratedPost[] {
  const platforms: PostPlatform[] = ["INSTAGRAM", "LINKEDIN", "X"];
  const posts: GeneratedPost[] = [];
  moments.slice(0, 5).forEach((m, i) => {
    for (const platform of platforms) {
      posts.push({
        platform,
        hook: m.title,
        body:
          platform === "X"
            ? m.transcriptText.slice(0, 260)
            : `${m.transcriptText}\n\nKey takeaway: ${m.reason}`,
        hashtags: ["contentflow", "repurpose", m.topic?.replace(/\s+/g, "") ?? "insights"].filter(Boolean),
        callToAction: "Save this for later",
        momentIds: [m.id],
        threadOrder: platform === "X" ? i + 1 : undefined,
      });
    }
  });
  return posts.slice(0, 15);
}
