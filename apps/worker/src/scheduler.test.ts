import { afterEach, describe, expect, it, vi } from "vitest";
import { startScheduler } from "./scheduler";

afterEach(() => {
  vi.useRealTimers();
});

describe("startScheduler", () => {
  it("runs immediately and then on each interval", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);
    const stop = startScheduler([{ name: "job", intervalMs: 1000, run }], () => {});
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not overlap runs of a slow job", async () => {
    vi.useFakeTimers();
    let resolve!: () => void;
    const run = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const logs: string[] = [];
    const stop = startScheduler([{ name: "slow", intervalMs: 100, run }], (m) => logs.push(m));
    await vi.advanceTimersByTimeAsync(350);
    expect(run).toHaveBeenCalledTimes(1);
    expect(logs.filter((l) => l.includes("skipping"))).toHaveLength(3);
    resolve();
    stop();
  });

  it("keeps going after a failure", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const logs: string[] = [];
    const stop = startScheduler([{ name: "flaky", intervalMs: 100, run }], (m) => logs.push(m));
    await vi.advanceTimersByTimeAsync(100);
    expect(logs[0]).toContain("failed: boom");
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });
});
