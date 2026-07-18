import pLimit from "p-limit";

export class AdaptiveRateController {
  private readonly limiter;
  private pausedUntil = 0;
  private failureStreak = 0;

  constructor(public readonly concurrency: number, private readonly minimumGapMs = 0) {
    this.limiter = pLimit(Math.max(1, concurrency));
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    return this.limiter(async () => {
      const now = Date.now();
      if (this.pausedUntil > now) await new Promise((resolve) => setTimeout(resolve, this.pausedUntil - now));
      if (this.minimumGapMs) await new Promise((resolve) => setTimeout(resolve, this.minimumGapMs));
      try {
        const result = await task();
        this.failureStreak = 0;
        return result;
      } catch (error) {
        this.failureStreak += 1;
        const backoff = Math.min(30_000, 500 * 2 ** Math.min(6, this.failureStreak));
        this.pausedUntil = Date.now() + backoff + Math.floor(Math.random() * 350);
        throw error;
      }
    });
  }
}
