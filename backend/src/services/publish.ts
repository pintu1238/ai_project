import type { PostPlatform, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decryptSecret } from "../lib/crypto.js";
import { env } from "../config/env.js";

export type PublishResult = {
  success: boolean;
  externalPostId?: string;
  errorMessage?: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
};

export async function publishScheduledPost(scheduledPostId: string): Promise<void> {
  const scheduled = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: {
      post: {
        include: {
          assets: true,
          project: { include: { workspace: true } },
        },
      },
    },
  });
  if (!scheduled) throw new Error("Scheduled post not found");
  if (scheduled.status === "CANCELLED") return;

  await prisma.scheduledPost.update({
    where: { id: scheduledPostId },
    data: { status: "PROCESSING", lastError: null },
  });

  const workspaceId = scheduled.post.project.workspaceId;
  const social = await prisma.socialAccount.findUnique({
    where: { workspaceId_platform: { workspaceId, platform: scheduled.post.platform as unknown as "INSTAGRAM" | "LINKEDIN" | "X" } },
  });

  let result: PublishResult;
  if (!social?.connected || !social.accessTokenEnc) {
    result = {
      success: false,
      errorMessage: `${scheduled.post.platform} account not connected. Configure OAuth credentials and connect in Settings.`,
    };
  } else {
    const token = decryptSecret(social.accessTokenEnc);
    result = await publishToPlatform(scheduled.post.platform, token, scheduled.post, social.accountName);
  }

  await prisma.publishingLog.create({
    data: {
      scheduledPostId,
      platform: scheduled.post.platform,
      success: result.success,
      externalPostId: result.externalPostId,
      requestPayload: result.requestPayload as Prisma.InputJsonValue | undefined,
      responsePayload: result.responsePayload as Prisma.InputJsonValue | undefined,
      errorMessage: result.errorMessage,
    },
  });

  if (result.success) {
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await prisma.post.update({
      where: { id: scheduled.postId },
      data: { status: "PUBLISHED" },
    });
  } else {
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: "FAILED", lastError: result.errorMessage },
    });
    await prisma.post.update({
      where: { id: scheduled.postId },
      data: { status: "FAILED" },
    });
  }
}

async function publishToPlatform(
  platform: PostPlatform,
  accessToken: string,
  post: {
    hook: string;
    body: string;
    hashtags: string[];
    assets: { storagePath: string }[];
  },
  accountName: string | null,
): Promise<PublishResult> {
  const payload = {
    platform,
    accountName,
    text: `${post.hook}\n\n${post.body}`,
    hashtags: post.hashtags,
    mediaPath: post.assets[0]?.storagePath,
  };

  switch (platform) {
    case "LINKEDIN":
      return publishLinkedIn(accessToken, payload);
    case "X":
      return publishX(accessToken, payload);
    case "INSTAGRAM":
      return publishInstagram(accessToken, payload);
    default:
      return { success: false, errorMessage: "Unsupported platform" };
  }
}

async function publishLinkedIn(
  token: string,
  payload: Record<string, unknown>,
): Promise<PublishResult> {
  if (!env.LINKEDIN_CLIENT_ID) {
    return {
      success: false,
      errorMessage: "LinkedIn API credentials not configured (LINKEDIN_CLIENT_ID)",
      requestPayload: payload,
    };
  }
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: "urn:li:person:CONFIGURED",
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: payload.text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        errorMessage: `LinkedIn API error: ${res.status}`,
        requestPayload: payload,
        responsePayload: body as Record<string, unknown>,
      };
    }
    return {
      success: true,
      externalPostId: (body as { id?: string }).id,
      requestPayload: payload,
      responsePayload: body as Record<string, unknown>,
    };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : "LinkedIn publish failed",
      requestPayload: payload,
    };
  }
}

async function publishX(
  token: string,
  payload: Record<string, unknown>,
): Promise<PublishResult> {
  if (!env.X_CLIENT_ID) {
    return {
      success: false,
      errorMessage: "X API credentials not configured (X_CLIENT_ID)",
      requestPayload: payload,
    };
  }
  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: String(payload.text).slice(0, 280) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        errorMessage: `X API error: ${res.status}`,
        requestPayload: payload,
        responsePayload: body as Record<string, unknown>,
      };
    }
    return {
      success: true,
      externalPostId: (body as { data?: { id?: string } }).data?.id,
      requestPayload: payload,
      responsePayload: body as Record<string, unknown>,
    };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : "X publish failed",
      requestPayload: payload,
    };
  }
}

async function publishInstagram(
  token: string,
  payload: Record<string, unknown>,
): Promise<PublishResult> {
  if (!env.META_APP_ID) {
    return {
      success: false,
      errorMessage: "Meta API credentials not configured (META_APP_ID)",
      requestPayload: payload,
    };
  }
  return {
    success: false,
    errorMessage:
      "Instagram publishing requires a configured Business/Creator account and media container flow. Connect account and upload media URL in production setup.",
    requestPayload: payload,
  };
}
