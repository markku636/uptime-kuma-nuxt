import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
    // Require authentication
    await requireRequestSession(event);

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

    // Check if node exists
    const existingNode = await prisma.node.findUnique({
        where: { id: nodeId }
    });

    if (!existingNode) {
        throw createError({
            statusCode: 404,
            message: "Node not found"
        });
    }

    // TODO: Check if this is the current node and prevent deletion
    // This would require comparing with the server's nodeId from config

    await prisma.node.delete({
        where: { id: nodeId }
    });

    return { ok: true,
        message: "Node deleted successfully" };
});
