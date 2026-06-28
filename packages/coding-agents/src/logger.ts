import defaultLog from 'electron-log'

const TEST_LOGGER_KEY = '__BITSENTRY_CODING_AGENTS_LOGGER__'

export interface CodingAgentsLogger {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

let activeLogger: CodingAgentsLogger = defaultLog

function getLogger(): CodingAgentsLogger {
  const globalLogger = (globalThis as Record<string, unknown>)[TEST_LOGGER_KEY]
  if (globalLogger !== null && typeof globalLogger === 'object') {
    return globalLogger as CodingAgentsLogger
  }
  return activeLogger
}

export const codingAgentsLogger: CodingAgentsLogger = {
  info: (...args) => { getLogger().info(...args); },
  warn: (...args) => { getLogger().warn(...args); },
  error: (...args) => { getLogger().error(...args); },
}

export function setCodingAgentsLoggerForTesting(logger: CodingAgentsLogger): void {
  activeLogger = logger
  ;(globalThis as Record<string, unknown>)[TEST_LOGGER_KEY] = logger
}
