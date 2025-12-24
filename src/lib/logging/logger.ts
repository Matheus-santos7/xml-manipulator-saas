/**
 * Sistema de logging estruturado e centralizado.
 * Suporta diferentes níveis e contextos para rastreabilidade.
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogContext {
  userId?: string;
  email?: string;
  scenarioId?: string;
  profileId?: string;
  workspaceId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger principal - pode ser expandido para enviar para serviços externos
 * (Datadog, Logtail, CloudWatch, etc.)
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isProduction = process.env.NODE_ENV === "production";

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;

    if (this.isDevelopment) {
      // Formato legível para desenvolvimento
      let log = `[${timestamp}] ${level}: ${message}`;
      if (context && Object.keys(context).length > 0) {
        log += `\n  Context: ${JSON.stringify(context, null, 2)}`;
      }
      if (error) {
        log += `\n  Error: ${error.name} - ${error.message}`;
        if (error.stack) {
          log += `\n  Stack: ${error.stack}`;
        }
      }
      return log;
    }

    // Formato JSON para produção (facilita parsing)
    return JSON.stringify(entry);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formattedLog = this.formatLog(entry);

    // Console output baseado no nível
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.DEBUG:
        // Debug logs desabilitados - descomente para habilitar em dev
        // if (this.isDevelopment) {
        //   console.debug(formattedLog);
        // }
        break;
      default:
        console.log(formattedLog);
    }

    // TODO: Em produção, enviar para serviço de logging externo
    // if (this.isProduction) {
    //   this.sendToExternalService(entry);
    // }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}

// Exportar instância única (singleton)
export const logger = new Logger();
