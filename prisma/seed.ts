import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const reporter = await prisma.user.upsert({
    where: { email: "reporter@example.com" },
    update: {},
    create: {
      name: "Demo Reporter",
      email: "reporter@example.com",
      passwordHash,
      role: "CUSTOMER",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      name: "Demo Agent",
      email: "agent@example.com",
      passwordHash,
      role: "AGENT",
    },
  });

  await prisma.holiday.upsert({
    where: { date: new Date("2026-08-15T00:00:00.000Z") },
    update: {},
    create: {
      name: "Sample Holiday",
      date: new Date("2026-08-15T00:00:00.000Z"),
    },
  });

  console.log("Seed complete");
  console.log("Reporter: reporter@example.com / Password123!");
  console.log("Agent: agent@example.com / Password123!");

  console.log("Demo users created:", reporter.id, agent.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
