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

    // Get monitor counts for each node
    const monitorCounts = await prisma.monitor.groupBy({
        by: ['nodeId'],
        _count: {
            id: true
        },
        where: {
            nodeId: {
                not: null
            }
        }
    });

    // Create a map for quick lookup
    const countMap = new Map(
        monitorCounts.map(mc => [mc.nodeId, mc._count.id])
    );

    // Also count monitors without nodeId (unassigned - count as available for all nodes)
    const unassignedCount = await prisma.monitor.count({
        where: {
            OR: [
                { nodeId: null },
                { nodeId: '' }
            ]
        }
    });

    // Add monitorCount to each node
    const nodesWithCounts = nodes.map(node => ({
        ...node,
        monitorCount: (countMap.get(node.nodeId) || 0) + unassignedCount
    }));

    return nodesWithCounts;
});
