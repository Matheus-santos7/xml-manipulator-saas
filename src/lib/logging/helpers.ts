import { logger, LogLevel, type LogContext } from "./logger";

/**
 * Helper para logar operações de autenticação
 */
export function logAuthEvent(
  event:
    | "login_success"
    | "login_failure"
    | "logout"
    | "session_created"
    | "session_expired",
  context: LogContext
): void {
  const messages = {
    login_success: "Login realizado com sucesso",
    login_failure: "Tentativa de login falhou",
    logout: "Logout realizado",
    session_created: "Nova sessão criada",
    session_expired: "Sessão expirou",
  };

  logger.info(messages[event], { ...context, event });
}

/**
 * Helper para logar operações de banco de dados
 */
export function logDatabaseError(
  operation: string,
  context: LogContext,
  error: Error
): void {
  logger.error(`Erro na operação de banco: ${operation}`, context, error);
}

/**
 * Helper para logar processamento de XML
 */
export function logXmlProcessing(
  status: "started" | "completed" | "failed",
  filesCount: number,
  context: LogContext,
  error?: Error
): void {
  const messages = {
    started: `Processamento de XML iniciado (${filesCount} arquivos)`,
    completed: `Processamento de XML concluído (${filesCount} arquivos)`,
    failed: `Processamento de XML falhou (${filesCount} arquivos)`,
  };

  const level = status === "failed" ? LogLevel.ERROR : LogLevel.INFO;

  if (error) {
    logger.error(messages[status], { ...context, filesCount }, error);
  } else if (level === LogLevel.ERROR) {
    logger.error(messages[status], { ...context, filesCount });
  } else {
    logger.info(messages[status], { ...context, filesCount });
  }
}
