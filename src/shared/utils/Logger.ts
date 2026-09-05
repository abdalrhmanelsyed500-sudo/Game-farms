/** Log severity levels. */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

/**
 * Lightweight leveled logger. Debug output can be silenced in production
 * builds via `setMinLevel(LogLevel.Info)` without touching call sites.
 */
export class Logger {
  private static minLevel: LogLevel = LogLevel.Debug;
  private static readonly PREFIX = '[GameFarms]';

  public static setMinLevel(level: LogLevel): void {
    Logger.minLevel = level;
  }

  public static debug(tag: string, ...args: readonly unknown[]): void {
    if (Logger.minLevel <= LogLevel.Debug) {
      // eslint-disable-next-line no-console
      console.debug(Logger.PREFIX, `[${tag}]`, ...args);
    }
  }

  public static info(tag: string, ...args: readonly unknown[]): void {
    if (Logger.minLevel <= LogLevel.Info) {
      // eslint-disable-next-line no-console
      console.info(Logger.PREFIX, `[${tag}]`, ...args);
    }
  }

  public static warn(tag: string, ...args: readonly unknown[]): void {
    if (Logger.minLevel <= LogLevel.Warn) {
      console.warn(Logger.PREFIX, `[${tag}]`, ...args);
    }
  }

  public static error(tag: string, ...args: readonly unknown[]): void {
    if (Logger.minLevel <= LogLevel.Error) {
      console.error(Logger.PREFIX, `[${tag}]`, ...args);
    }
  }
}
