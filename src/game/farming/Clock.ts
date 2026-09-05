/**
 * Clock abstraction for farming time.
 *
 * Growth derives from timestamps, never from setTimeout chains — but the
 * TIME SOURCE is injectable so tests (and future server sync) control it:
 * - SystemClock: production (Date.now).
 * - ManualClock: tests fast-forward deterministically.
 */
export interface Clock {
  nowMs(): number;
}

export class SystemClock implements Clock {
  public nowMs(): number {
    return Date.now();
  }
}

export class ManualClock implements Clock {
  private timeMs: number;

  public constructor(startMs = 0) {
    this.timeMs = startMs;
  }

  public nowMs(): number {
    return this.timeMs;
  }

  public set(timeMs: number): void {
    this.timeMs = timeMs;
  }

  public advance(ms: number): void {
    this.timeMs += ms;
  }
}
