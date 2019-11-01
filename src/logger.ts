/**
 * logger class
 */
export class Logger implements LoggerMethods<(str: string) => void> {
  /**
   * Logger class
   * @param logger - logger to use
   * @param logWhen - when to log
   */
  constructor(
    private logger: LoggerMethods<(str: string) => void> = console,
    private logWhen: LoggerMethods<boolean> = { info: true, warn: true, error: true }
  ) {}

  /**
   * Log using logger
   * @param str - string to log
   */
  public info(str: string) {
    if (this.logWhen.info !== false) this.logger.info(str);
  }

  /**
   * Log using logger
   * @param str - string to log
   */
  public warn(str: string) {
    if (this.logWhen.warn !== false) this.logger.warn(str);
  }

  /**
   * Log using logger
   * @param str - string to log
   */
  public error(str: string) {
    if (this.logWhen.error !== false) this.logger.error(str);
  }
}

export interface LoggerMethods<T> {
  info: T;
  warn: T;
  error: T;
}
