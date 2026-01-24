import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
    // Require authentication
    await requireUserSession(event);

    const nodes = await prisma.node.findMany({
        orderBy: [
            { isPrimary: "desc" },
            { createdAt: "desc" }
        ]
    });

    return nodes;
});
