import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@contentflow.local" },
    update: {},
    create: {
      email: "demo@contentflow.local",
      name: "Demo User",
      passwordHash,
      timezone: "UTC",
      memberships: {
        create: {
          role: "OWNER",
          workspace: {
            create: {
              name: "Demo Workspace",
              slug: "demo-workspace",
              brandKits: {
                create: {
                  name: "ContentFlow Default",
                  primaryColor: "#6366f1",
                  secondaryColor: "#0f172a",
                  accentColor: "#22c55e",
                },
              },
            },
          },
        },
      },
    },
    include: { memberships: { include: { workspace: true } } },
  });

  console.log("Seed complete:", {
    user: user.email,
    workspace: user.memberships[0]?.workspace.slug,
    password: "password123",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
