import { prisma } from "../../config/prisma.js";

export async function listDemoUsers() {
  const users = await prisma.user.findMany({
    orderBy: {
      role: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return {
    data: users,
  };
}
