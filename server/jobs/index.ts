// server/jobs/index.ts
// Background job manager using croner for cron-based scheduling

import { Cron } from "croner";
import { clearOldData } from "./clear-old-data";
import { reconcileMonitors } from "./reconcile-monitors";
import { prisma } from "../utils/prisma";

interface BackgroundJob {
    name: string;
    interval: string;
    handler: () => Promise<void>;
    instance?: Cron;
}

const jobs: BackgroundJob[] = [
    {
        name: "clear-old-data",
        interval: "14 03 * * *", // Every day at 03:14 AM
        handler: clearOldData
    },
    {
        name: "reconcile-monitors",
        interval: "*/1 * * * *", // Every 1 minute
        handler: reconcileMonitors
    }
];

/**
 * Get server timezone from settings or default to UTC
 */
async function getServerTimezone(): Promise<string> {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: "serverTimezone" }
        });
        return setting?.value || "UTC";
    } catch {
        return "UTC";
    }
}

/**
 * Initialize all background jobs
 * Should be called after database is ready
 */
export async function initBackgroundJobs(): Promise<void> {
    const timezone = await getServerTimezone();
    console.log(`[Jobs] Initializing background jobs with timezone: ${timezone}`);

    for (const job of jobs) {
        try {
            job.instance = new Cron(
                job.interval,
                {
                    name: job.name,
                    timezone,
                    catch: (error: unknown) => {
                        console.error(`[Jobs] Error in job ${job.name}:`, error);
                    }
                },
                async () => {
                    console.log(`[Jobs] Running job: ${job.name}`);
                    try {
                        await job.handler();
                    } catch (error) {
                        console.error(`[Jobs] Job ${job.name} failed:`, error);
                    }
                }
            );

            const nextRun = job.instance.nextRun();
            console.log(`[Jobs] Started: ${job.name} (next run: ${nextRun?.toISOString() || "unknown"})`);
        } catch (error) {
            console.error(`[Jobs] Failed to start job ${job.name}:`, error);
        }
    }

    console.log(`[Jobs] ${jobs.filter(j => j.instance).length} background jobs initialized`);
}

/**
 * Stop all background jobs
 * Should be called during graceful shutdown
 */
export function stopBackgroundJobs(): void {
    console.log("[Jobs] Stopping all background jobs...");

    for (const job of jobs) {
        if (job.instance) {
            job.instance.stop();
            job.instance = undefined;
            console.log(`[Jobs] Stopped: ${job.name}`);
        }
    }

    console.log("[Jobs] All background jobs stopped");
}

/**
 * Get status of all jobs
 */
export function getJobsStatus(): { name: string; running: boolean; nextRun: string | null }[] {
    return jobs.map(job => ({
        name: job.name,
        running: !!job.instance?.isRunning(),
        nextRun: job.instance?.nextRun()?.toISOString() || null
    }));
}

/**
 * Manually trigger a job by name
 */
export async function triggerJob(jobName: string): Promise<boolean> {
    const job = jobs.find(j => j.name === jobName);
    if (!job) {
        console.warn(`[Jobs] Job not found: ${jobName}`);
        return false;
    }

    console.log(`[Jobs] Manually triggering job: ${jobName}`);
    try {
        await job.handler();
        return true;
    } catch (error) {
        console.error(`[Jobs] Manual trigger failed for ${jobName}:`, error);
        return false;
    }
}
