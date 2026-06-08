type LogContext = Record<string, unknown>;

export type AppLogger = {
  info(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

export const logger: AppLogger = {
  info(message: string, context?: LogContext) {
    console.info(message, context ?? {});
  },
  error(message: string, context?: LogContext) {
    console.error(message, context ?? {});
  }
};
