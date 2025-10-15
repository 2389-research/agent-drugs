/**
 * Structured logging utility for MCP server
 * Provides consistent logging with timestamps, levels, and context
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  method?: string;
  path?: string;
  sessionId?: string;
  agentId?: string;
  userId?: string;
  clientId?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.minLevel = LogLevel[envLevel as keyof typeof LogLevel];
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } : error,
      };
      console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }
  }

  // Specialized logging methods for common scenarios

  request(method: string, path: string, context?: LogContext): void {
    this.info('Incoming request', { method, path, ...context });
  }

  response(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `Request completed: ${method} ${path}`;
    if (level === LogLevel.WARN) {
      this.warn(message, { statusCode, duration, ...context });
    } else {
      this.info(message, { statusCode, duration, ...context });
    }
  }

  oauth(event: string, context?: LogContext): void {
    this.info(`OAuth: ${event}`, context);
  }

  session(event: string, sessionId: string, context?: LogContext): void {
    this.info(`Session: ${event}`, { sessionId, ...context });
  }

  auth(event: string, context?: LogContext): void {
    this.info(`Auth: ${event}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();
