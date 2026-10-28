import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

export type AuthPayload = {
  userId: string;
  email: string;
};

const COOKIE_NAME = "contentflow_token";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[COOKIE_NAME];
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const workspaceId = String(req.params.workspaceId ?? req.body.workspaceId ?? "");
  if (!req.auth?.userId || !workspaceId) {
    res.status(400).json({ error: "Workspace context required" });
    return;
  }
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: req.auth.userId, workspaceId } },
  });
  if (!membership) {
    res.status(403).json({ error: "Access denied to workspace" });
    return;
  }
  req.workspaceRole = membership.role;
  req.workspaceId = workspaceId;
  next();
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      workspaceId?: string;
      workspaceRole?: string;
    }
  }
}
