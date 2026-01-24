import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const nodeSchema = z.object({
    nodeId: z.string().min(1, "Node ID is required"),
    nodeName: z.string().min(1, "Node Name is required"),
    host: z.string().optional().nullable(),
    hostname: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false)
});

export default defineEventHandler(async (event) => {
    // Require authentication
    await requireUserSession(event);

    const body = await readBody(event);
    const data = nodeSchema.parse(body);

    // Check if nodeId already exists
    const existingNode = await prisma.node.findUnique({
        where: { nodeId: data.nodeId }
    });

    if (existingNode) {
        throw createError({
            statusCode: 400,
            message: "A node with this ID already exists"
        });
    }

    // If this node is set as primary, unset all other primary nodes
    if (data.isPrimary) {
        await prisma.node.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
        });
    }

    const node = await prisma.node.create({
        data: {
            nodeId: data.nodeId,
            nodeName: data.nodeName,
            host: data.host,
            hostname: data.hostname,
            location: data.location,
            isPrimary: data.isPrimary,
            status: "unknown"
        }
    });

    return node;
});
