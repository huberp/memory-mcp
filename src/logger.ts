/**
 * Simple logging utility with configurable log levels.
 * Provides consistent logging format across the application.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.error(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.error(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

// Create default logger instance
const logLevelStr = process.env.LOG_LEVEL?.toUpperCase();
const defaultLevel = logLevelStr && logLevelStr in LogLevel 
  ? LogLevel[logLevelStr as keyof typeof LogLevel] 
  : LogLevel.INFO;

export const logger = new Logger(defaultLevel);
