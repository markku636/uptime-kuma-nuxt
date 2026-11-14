import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const nodeUpdateSchema = z.object({
    nodeName: z.string().min(1, "Node Name is required"),
    host: z.string().optional().nullable(),
    hostname: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false)
});

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

    const body = await readBody(event);
    const data = nodeUpdateSchema.parse(body);

    // If this node is set as primary, unset all other primary nodes
    if (data.isPrimary && !existingNode.isPrimary) {
        await prisma.node.updateMany({
            where: {
                isPrimary: true,
                id: { not: nodeId }
            },
            data: { isPrimary: false }
        });
    }

    const node = await prisma.node.update({
        where: { id: nodeId },
        data: {
            nodeName: data.nodeName,
            host: data.host,
            hostname: data.hostname,
            location: data.location,
            isPrimary: data.isPrimary
        }
    });

    return node;
});
