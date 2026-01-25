// server/jobs/node-cleanup.ts
// Node lifecycle cleanup job
// - Marks stale nodes as offline
// - Cleans up long-offline node records
// - Reassigns monitors from offline nodes

import { prisma } from "../utils/prisma";
import { isClusterMode, getCurrentNodeId } from "../utils/cluster-config";
import { emitNodeStatusChange, emitNodeList } from "../services/socket/index";

// Configuration constants
const NODE_OFFLINE_THRESHOLD = 90 * 1000;      // 90 seconds - mark as offline
const STALE_NODE_THRESHOLD = 60 * 60 * 1000;   // 1 hour - delete old records

/**
 * Node cleanup job
 * Only runs on the primary node in cluster mode
 */
export async function nodeCleanup(): Promise<void> {
    // Skip if not in cluster mode
    if (!isClusterMode()) {
        return;
    }

    const currentNodeId = getCurrentNodeId();

    try {
        // Check if current node is primary
        const currentNode = await prisma.node.findUnique({
            where: { nodeId: currentNodeId },
            select: { isPrimary: true }
        });

        if (!currentNode?.isPrimary) {
            // Only primary node runs cleanup
            return;
        }

        const now = new Date();
        let statusChanged = false;

        // Step 1: Mark stale nodes as offline
        const offlineThreshold = new Date(now.getTime() - NODE_OFFLINE_THRESHOLD);

        const staleNodes = await prisma.node.findMany({
            where: {
                lastSeen: { lt: offlineThreshold },
                status: "online",
                nodeId: { not: currentNodeId } // Don't mark self as offline
            }
        });

        for (const node of staleNodes) {
            console.log(`[NodeCleanup] Node ${node.nodeId} marked as offline (no heartbeat for ${NODE_OFFLINE_THRESHOLD / 1000}s)`);

            await prisma.node.update({
                where: { nodeId: node.nodeId },
                data: {
                    status: "offline"
                }
            });

            // Emit status change event
            emitNodeStatusChange(node.nodeId, "offline");
            statusChanged = true;

            // Reassign monitors from this node
            await reassignMonitorsFromNode(node.nodeId);
        }

        // Step 2: Clean up long-offline node records
        const staleThreshold = new Date(now.getTime() - STALE_NODE_THRESHOLD);

        const deleteResult = await prisma.node.deleteMany({
            where: {
                lastSeen: { lt: staleThreshold },
                status: "offline",
                nodeId: { not: currentNodeId }
            }
        });

        if (deleteResult.count > 0) {
            console.log(`[NodeCleanup] Cleaned up ${deleteResult.count} stale node records`);
            statusChanged = true;
        }

        // Broadcast updated node list if there were changes
        if (statusChanged) {
            await emitNodeList();
        }

    } catch (error) {
        console.error("[NodeCleanup] Cleanup failed:", error);
    }
}

/**
 * Reassign monitors from an offline node to online nodes
 */
async function reassignMonitorsFromNode(offlineNodeId: string): Promise<void> {
    try {
        // Get all online nodes (excluding the offline one)
        const onlineNodes = await prisma.node.findMany({
            where: {
                status: "online",
                nodeId: { not: offlineNodeId }
            },
            select: { nodeId: true }
        });

        if (onlineNodes.length === 0) {
            console.warn("[NodeCleanup] No online nodes available for reassignment");
            return;
        }

        // Get monitors that need reassignment
        // Only reassign monitors where assignedNode (override) matches the offline node
        const monitors = await prisma.monitor.findMany({
            where: {
                OR: [
                    { assignedNode: offlineNodeId },
                    { assignedNode: null, nodeId: offlineNodeId }
                ],
                active: true
            },
            select: { id: true, name: true }
        });

        if (monitors.length === 0) {
            return;
        }

        console.log(`[NodeCleanup] Reassigning ${monitors.length} monitors from ${offlineNodeId}`);

        // Distribute monitors evenly across online nodes
        for (let i = 0; i < monitors.length; i++) {
            const targetNode = onlineNodes[i % onlineNodes.length];

            await prisma.monitor.update({
                where: { id: monitors[i].id },
                data: {
                    assignedNode: targetNode.nodeId,
                    // Keep original nodeId as the "home" node for when it comes back online
                }
            });

            console.log(`[NodeCleanup] Reassigned monitor ${monitors[i].id} (${monitors[i].name}) to ${targetNode.nodeId}`);
        }

    } catch (error) {
        console.error("[NodeCleanup] Monitor reassignment failed:", error);
    }
}

/**
 * Revert monitors back to their original nodes when they come online
 * This should be called when a node status changes to online
 */
export async function revertMonitorsToNode(nodeId: string): Promise<void> {
    try {
        // Find monitors that were reassigned from this node
        const result = await prisma.monitor.updateMany({
            where: {
                nodeId: nodeId,
                assignedNode: { not: nodeId }
            },
            data: {
                assignedNode: null // Clear override, let it use the original nodeId
            }
        });

        if (result.count > 0) {
            console.log(`[NodeCleanup] Reverted ${result.count} monitors back to node ${nodeId}`);
        }

    } catch (error) {
        console.error("[NodeCleanup] Monitor revert failed:", error);
    }
}

/**
 * Update node heartbeat and status
 * Called periodically to keep node alive
 */
export async function sendNodeHeartbeat(): Promise<void> {
    const currentNodeId = getCurrentNodeId();

    if (!currentNodeId) {
        return;
    }

    try {
        const node = await prisma.node.findUnique({
            where: { nodeId: currentNodeId },
            select: { status: true }
        });

        const wasOffline = node?.status === "offline";

        await prisma.node.update({
            where: { nodeId: currentNodeId },
            data: {
                status: "online",
                lastSeen: new Date()
            }
        });

        // If node was offline, revert monitors and notify
        if (wasOffline) {
            console.log(`[NodeCleanup] Node ${currentNodeId} came back online`);
            await revertMonitorsToNode(currentNodeId);
            emitNodeStatusChange(currentNodeId, "online");
        }

    } catch (error) {
        // Ignore heartbeat errors - node might not exist yet
    }
}
