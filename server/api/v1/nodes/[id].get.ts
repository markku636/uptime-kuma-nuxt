import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
    // Require authentication
    await requireUserSession(event);

    const id = getRouterParam(event, "id");

    if (!id) {
        throw createError({
            statusCode: 400,
            message: "Node ID is required"
        });
    }

    const nodeId = parseInt(id);
    if (isNaN(nodeId)) {
        throw createError({
            statusCode: 400,
            message: "Invalid node ID"
        });
    }

    const node = await prisma.node.findUnique({
        where: { id: nodeId }
    });

    if (!node) {
        throw createError({
            statusCode: 404,
            message: "Node not found"
        });
    }

    return node;
});
