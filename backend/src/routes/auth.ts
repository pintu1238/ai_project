import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../lib/auth.js";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
  workspaceName: z.string().min(1).max(120).optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password, name, workspaceName } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const wsName = workspaceName ?? `${name ?? email.split("@")[0]}'s Workspace`;
  let slug = slugify(wsName);
  const slugTaken = await prisma.workspace.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          workspace: { create: { name: wsName, slug } },
        },
      },
    },
    include: { memberships: { include: { workspace: true } } },
  });

  const token = signToken({ userId: user.id, email: user.email });
  setAuthCookie(res, token);
  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone },
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { include: { workspace: true } } },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email });
  setAuthCookie(res, token);
  res.json({
    user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone },
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { memberships: { include: { workspace: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone },
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
});
