/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

import cron from 'node-cron';

export type JobHandler = () => Promise<void> | void;

export interface SchedulerService {
  register(name: string, cronExpression: string, handler: JobHandler): void;
  start(): void;
  stop(): void;
}

interface RegisteredJob {
  name: string;
  expression: string;
  handler: JobHandler;
}

export function createScheduler(): SchedulerService {
  const jobDefinitions: RegisteredJob[] = [];
  const activeTasks: cron.ScheduledTask[] = [];

  return {
    register(name: string, cronExpression: string, handler: JobHandler) {
      jobDefinitions.push({ name, expression: cronExpression, handler });
    },

    start() {
      console.info(`[Scheduler] Starting scheduler with ${jobDefinitions.length} registered jobs...`);
      for (const job of jobDefinitions) {
        const task = cron.schedule(job.expression, async () => {
          try {
            console.info(`[Scheduler] Executing job: ${job.name}`);
            await job.handler();
          } catch (error) {
            console.error(`[Scheduler] Error executing job ${job.name}:`, error);
          }
        });
        activeTasks.push(task);
        console.info(`[Scheduler] Registered job '${job.name}' [${job.expression}]`);
      }
    },

    stop() {
      console.info('[Scheduler] Stopping all active tasks...');
      for (const task of activeTasks) {
        task.stop();
      }
      activeTasks.length = 0;
      console.info('[Scheduler] All tasks stopped.');
    },
  };
}
