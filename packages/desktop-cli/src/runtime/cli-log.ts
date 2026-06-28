type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly'

type LogMethod = (...args: unknown[]) => void

type TransportConfig = {
  level: LogLevel | false
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5,
}

const transports: Record<'console' | 'file', TransportConfig> = {
  console: { level: 'info' },
  file: { level: 'info' },
}

function shouldEmit(level: LogLevel, configuredLevel: LogLevel | false): boolean {
  if (configuredLevel === false) {
    return false
  }

  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[configuredLevel]
}

function formatMessage(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === 'string') {
        return value
      }

      if (value instanceof Error) {
        return value.stack ?? value.message
      }

      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
    .join(' ')
}

function emit(level: LogLevel, args: unknown[]): void {
  if (!shouldEmit(level, transports.console.level)) {
    return
  }

  process.stderr.write(`[${level}] ${formatMessage(args)}\n`)
}

function createLogMethod(level: LogLevel): LogMethod {
  return (...args: unknown[]) => {
    emit(level, args)
  }
}

const log = {
  transports,
  initialize(): void {},
  error: createLogMethod('error'),
  warn: createLogMethod('warn'),
  info: createLogMethod('info'),
  verbose: createLogMethod('verbose'),
  debug: createLogMethod('debug'),
  silly: createLogMethod('silly'),
  log: createLogMethod('info'),
}

export default log
