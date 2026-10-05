export type Job = {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
};

/**
 * Minimal in-process scheduler: runs each job immediately, then on its interval,
 * never overlapping two runs of the same job.
 */
export function startScheduler(jobs: Job[], log: (msg: string) => void = console.log) {
  const timers: NodeJS.Timeout[] = [];
  for (const job of jobs) {
    let running = false;
    const tick = async () => {
      if (running) {
        log(`[${job.name}] previous run still in progress, skipping`);
        return;
      }
      running = true;
      const started = Date.now();
      try {
        await job.run();
        log(`[${job.name}] ok in ${Date.now() - started}ms`);
      } catch (err) {
        log(`[${job.name}] failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        running = false;
      }
    };
    void tick();
    timers.push(setInterval(tick, job.intervalMs));
  }
  return () => timers.forEach(clearInterval);
}
