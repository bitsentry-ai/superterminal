import process from 'process'
import os from 'os'
import path from 'path'
import { access, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { spawn } from 'child_process'

type ParsedArgs = {
  positionals: string[]
  flags: Map<string, string[]>
}

export interface RunbookCliExecuteInput {
  runbookId: string
  parameterValues?: Record<string, string>
  incidentThreadId?: string
  triggerContext?: {
    entrypoint: 'runbooks' | 'incident_detail' | 'incident_workspace' | 'diagnosis'
    needId?: string
    needLabel?: string
    sourceId?: string
    sourceName?: string
    sourceType?: 'sentry' | 'wazuh' | 'posthog'
    incidentThreadId?: string
  }
}

export interface RunbookCliRuntime {
  destroy(): Promise<void>
  listRunbooks(): Promise<unknown[]>
  deleteRunbook(runbookId: string): Promise<{ ok: true }>
  exportRunbooks(runbookIds: string[], includeGlobals?: boolean): Promise<unknown>
  exportRunbooksToFile(
    filePath: string,
    runbookIds: string[],
    includeGlobals?: boolean,
  ): Promise<{ ok: true; filePath: string; count: number }>
  importRunbooksFromFile(filePath: string, options?: unknown): Promise<unknown>
  executeRunbook(
    input: RunbookCliExecuteInput,
  ): Promise<{ executionId: string; resultId: string }>
  getExecution(executionId: string): Promise<Record<string, unknown> | null>
  cancelExecution(executionId: string): Promise<void>
  waitForExecution(
    executionId: string,
    options?: { pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<Record<string, unknown> | null>
}

export interface RunbookCliRuntimeOptions {
  userDataPath?: string
  staleHeartbeatGraceMs?: number
}

export type RunbookCliRuntimeFactory = (
  options?: RunbookCliRuntimeOptions,
) => Promise<RunbookCliRuntime>

type RunbookImportConflictPolicy = 'duplicate' | 'skip' | 'overwrite'
type RunbooksCommandContext = {
  runtime: RunbookCliRuntime
  args: ParsedArgs
  asJson: boolean
}
type RunbooksCommandHandler = (context: RunbooksCommandContext) => Promise<void>

const DETACHED_EXECUTION_START_TIMEOUT_MS = 15_000
const DETACHED_EXECUTION_START_POLL_MS = 50

function parseFlagToken(token: string): { key: string; inlineValue?: string } | null {
  const inlineSeparator = token.indexOf('=', 2)
  let rawKey = token.slice(2)
  let inlineValue: string | undefined
  if (inlineSeparator >= 0) {
    rawKey = token.slice(2, inlineSeparator)
    inlineValue = token.slice(inlineSeparator + 1)
  }

  const key = rawKey.trim()
  if (key === '') {
    return null
  }

  return { key, inlineValue }
}

function addFlagValue(flags: Map<string, string[]>, key: string, value: string): void {
  const existing = flags.get(key) ?? []
  existing.push(value)
  flags.set(key, existing)
}

function readSeparatedFlagValue(argv: string[], index: number): { value: string; nextIndex: number } {
  const next = argv[index + 1]
  if (index + 1 < argv.length && !next.startsWith('--')) {
    return { value: next, nextIndex: index + 1 }
  }

  return { value: 'true', nextIndex: index }
}

function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags = new Map<string, string[]>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const parsedFlag = parseFlagToken(token)
    if (parsedFlag === null) {
      continue
    }

    if (parsedFlag.inlineValue !== undefined) {
      addFlagValue(flags, parsedFlag.key, parsedFlag.inlineValue)
      continue
    }

    const separated = readSeparatedFlagValue(argv, index)
    addFlagValue(flags, parsedFlag.key, separated.value)
    index = separated.nextIndex
  }

  return { positionals, flags }
}

function getFlag(args: ParsedArgs, key: string): string | undefined {
  return args.flags.get(key)?.at(-1)
}

function getFlagValues(args: ParsedArgs, key: string): string[] {
  return args.flags.get(key) ?? []
}

function hasFlag(args: ParsedArgs, key: string): boolean {
  return args.flags.has(key)
}

function requiredFlag(args: ParsedArgs, key: string): string {
  const value = getFlag(args, key)
  if (value === undefined || value === '' || value === 'true') {
    throw new Error(`Missing required flag --${key}`)
  }
  return value
}

function parseBooleanFlag(args: ParsedArgs, key: string): boolean {
  return hasFlag(args, key) && getFlag(args, key) !== 'false'
}

function parseIntegerFlag(args: ParsedArgs, key: string): number | undefined {
  const value = getFlag(args, key)
  if (value === undefined || value === '' || value === 'true') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for --${key}: ${value}`)
  }
  return parsed
}

function parseParameterValues(args: ParsedArgs): Record<string, string> | undefined {
  const entries = getFlagValues(args, 'param')
  if (entries.length === 0) {
    return undefined
  }

  const values: Record<string, string> = {}
  for (const entry of entries) {
    const separator = entry.indexOf('=')
    if (separator <= 0) {
      throw new Error(`Invalid --param value "${entry}". Expected key=value.`)
    }
    const key = entry.slice(0, separator).trim()
    const value = entry.slice(separator + 1)
    if (key === '') {
      throw new Error(`Invalid --param value "${entry}". Expected key=value.`)
    }
    values[key] = value
  }

  return values
}

function printHelp(): void {
  process.stdout.write(`bitsentry CLI

Usage:
  bitsentry runbooks list [--json]
  bitsentry runbooks execute --runbook-id <id> [--param key=value]... [--wait] [--timeout-ms <ms>] [--json]
  bitsentry runbooks get-execution --execution-id <id> [--json]
  bitsentry runbooks cancel --execution-id <id> [--json]
  bitsentry runbooks delete --runbook-id <id> [--json]
  bitsentry runbooks export --runbook-id <id> [--runbook-id <id> ...] [--include-globals] [--output <file>] [--json]
  bitsentry runbooks import --file <path> [--conflict-policy duplicate|skip|overwrite] [--preserve-ids] [--include-globals] [--dry-run] [--json]

Global flags:
  --user-data-dir <path>   Override the desktop user-data directory.
  --json                   Print machine-readable JSON output.
`)
}

function printOutput(value: unknown, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
    return
  }

  if (typeof value === 'string') {
    process.stdout.write(`${value}\n`)
    return
  }

  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function getExecutionStatus(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const { status } = value as { status?: unknown }
  if (typeof status !== 'string') {
    return undefined
  }

  return status
}

function buildForwardedArgs(args: ParsedArgs): string[] {
  const forwarded: string[] = []

  for (const [key, values] of args.flags.entries()) {
    if (key === 'json' || key === 'wait') {
      continue
    }

    for (const value of values) {
      if (value === 'true') {
        forwarded.push(`--${key}`)
      } else {
        forwarded.push(`--${key}`, value)
      }
    }
  }

  return forwarded
}

async function startDetachedExecution(
  args: ParsedArgs,
): Promise<{ executionId: string; resultId: string; detached: boolean; workerPid: number }> {
  const cliScriptPath = path.resolve(process.argv[1] ?? '')

  const handshakeDir = await mkdtemp(path.join(os.tmpdir(), 'bitsentry-cli-exec.'))
  const startupFile = path.join(handshakeDir, 'startup.json')
  const detached = true
  const child = spawn(
    process.execPath,
    [
      cliScriptPath,
      'runbooks',
      'execute-worker',
      ...buildForwardedArgs(args),
      '--startup-file',
      startupFile,
    ],
    {
      detached,
      stdio: 'ignore',
      windowsHide: process.platform === 'win32',
      env: {
        ...process.env,
      },
    },
  )

  child.unref()

  try {
    const started = await waitForDetachedExecutionStart(child, startupFile)
    return {
      ...started,
      detached,
      workerPid: child.pid ?? -1,
    }
  } finally {
    await rm(handshakeDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function waitForDetachedExecutionStart(
  child: ReturnType<typeof spawn>,
  startupFile: string,
): Promise<{ executionId: string; resultId: string }> {
  const deadline = Date.now() + DETACHED_EXECUTION_START_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Detached execution worker exited before startup (code=${String(child.exitCode)})`,
      )
    }

    const started = await readDetachedExecutionStartFile(startupFile)
    if (started !== null) {
      return started
    }

    await new Promise((resolve) => setTimeout(resolve, DETACHED_EXECUTION_START_POLL_MS))
  }

  throw new Error('Detached execution worker did not report startup metadata in time')
}

async function readDetachedExecutionStartFile(
  startupFile: string,
): Promise<{ executionId: string; resultId: string } | null> {
  try {
    await access(startupFile)
  } catch {
    return null
  }

  try {
    const raw = await readFile(startupFile, 'utf-8')
    const parsed = JSON.parse(raw) as {
      executionId?: unknown
      resultId?: unknown
    }

    if (
      typeof parsed.executionId !== 'string' ||
      typeof parsed.resultId !== 'string'
    ) {
      throw new Error('Detached execution worker wrote invalid startup metadata')
    }

    return {
      executionId: parsed.executionId,
      resultId: parsed.resultId,
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

async function createRuntimeFromArgs(
  createRuntime: RunbookCliRuntimeFactory,
  args: ParsedArgs,
): Promise<RunbookCliRuntime> {
  return createRuntime({
    userDataPath: getFlag(args, 'user-data-dir'),
  })
}

async function runExecuteWorkerCommand(
  createRuntime: RunbookCliRuntimeFactory,
  args: ParsedArgs,
): Promise<void> {
  const runtime = await createRuntimeFromArgs(createRuntime, args)
  try {
    const execution = await runtime.executeRunbook({
      runbookId: requiredFlag(args, 'runbook-id'),
      parameterValues: parseParameterValues(args),
    })

    const startupFile = getFlag(args, 'startup-file')
    if (startupFile !== undefined && startupFile !== '') {
      await writeFile(
        startupFile,
        JSON.stringify({
          executionId: execution.executionId,
          resultId: execution.resultId,
        }),
        'utf-8',
      )
    } else if (typeof process.send === 'function') {
      process.send({
        type: 'execution_started',
        executionId: execution.executionId,
        resultId: execution.resultId,
      })
    }

    await runtime.waitForExecution(execution.executionId)
  } finally {
    await runtime.destroy()
  }
}

async function runExecuteCommand(
  createRuntime: RunbookCliRuntimeFactory,
  args: ParsedArgs,
  asJson: boolean,
): Promise<void> {
  const execution = await startDetachedExecution(args)
  if (!parseBooleanFlag(args, 'wait')) {
    printOutput(execution, asJson)
    return
  }

  const runtime = await createRuntimeFromArgs(createRuntime, args)
  try {
    const finalExecution = await runtime.waitForExecution(
      execution.executionId,
      { timeoutMs: parseIntegerFlag(args, 'timeout-ms') },
    )
    printOutput({
      executionId: execution.executionId,
      resultId: execution.resultId,
      timedOut: getExecutionStatus(finalExecution) === 'running',
      execution: finalExecution,
    }, asJson)
  } finally {
    await runtime.destroy()
  }
}

async function handleListCommand({ runtime, asJson }: RunbooksCommandContext): Promise<void> {
  const runbooks = await runtime.listRunbooks()
  printOutput(runbooks, asJson)
}

async function handleGetExecutionCommand({
  runtime,
  args,
  asJson,
}: RunbooksCommandContext): Promise<void> {
  const execution = await runtime.getExecution(
    requiredFlag(args, 'execution-id'),
  )
  printOutput(execution, asJson)
}

async function handleCancelCommand({
  runtime,
  args,
  asJson,
}: RunbooksCommandContext): Promise<void> {
  const executionId = requiredFlag(args, 'execution-id')
  await runtime.cancelExecution(executionId)
  const execution = await runtime.getExecution(executionId)
  printOutput({
    executionId,
    status: getExecutionStatus(execution) ?? 'unknown',
    execution,
  }, asJson)
}

async function handleDeleteCommand({
  runtime,
  args,
  asJson,
}: RunbooksCommandContext): Promise<void> {
  const result = await runtime.deleteRunbook(requiredFlag(args, 'runbook-id'))
  printOutput(result, asJson)
}

async function handleExportCommand({
  runtime,
  args,
  asJson,
}: RunbooksCommandContext): Promise<void> {
  const runbookIds = getFlagValues(args, 'runbook-id')
  if (runbookIds.length === 0) {
    throw new Error('At least one --runbook-id is required for export')
  }

  const includeGlobals = parseBooleanFlag(args, 'include-globals')
  const outputPath = getFlag(args, 'output')
  if (outputPath !== undefined && outputPath !== '') {
    const result = await runtime.exportRunbooksToFile(
      path.resolve(outputPath),
      runbookIds,
      includeGlobals,
    )
    printOutput(result, asJson)
    return
  }

  const artifact = await runtime.exportRunbooks(runbookIds, includeGlobals)
  printOutput(artifact, true)
}

function parseConflictPolicy(args: ParsedArgs): RunbookImportConflictPolicy | undefined {
  const value = getFlag(args, 'conflict-policy')
  if (value === undefined || value === '') {
    return undefined
  }

  switch (value) {
    case 'duplicate':
    case 'skip':
    case 'overwrite':
      return value
    default:
      throw new Error(`Unsupported conflict policy "${value}"`)
  }
}

async function handleImportCommand({
  runtime,
  args,
  asJson,
}: RunbooksCommandContext): Promise<void> {
  const filePath = path.resolve(requiredFlag(args, 'file'))
  const summary = await runtime.importRunbooksFromFile(filePath, {
    conflictPolicy: parseConflictPolicy(args),
    preserveIds: parseBooleanFlag(args, 'preserve-ids'),
    includeGlobals: parseBooleanFlag(args, 'include-globals'),
    dryRun: parseBooleanFlag(args, 'dry-run'),
  })
  printOutput(summary, asJson)
}

const runbooksCommandHandlers = new Map<string, RunbooksCommandHandler>([
  ['list', handleListCommand],
  ['get-execution', handleGetExecutionCommand],
  ['cancel', handleCancelCommand],
  ['delete', handleDeleteCommand],
  ['export', handleExportCommand],
  ['import', handleImportCommand],
])

function resolveRunbooksCommand(args: ParsedArgs): string | null {
  const scope = args.positionals.at(0)
  const command = args.positionals.at(1)

  if (scope === undefined || scope === '' || scope === 'help' || scope === '--help') {
    return null
  }

  if (scope !== 'runbooks') {
    throw new Error(`Unsupported scope "${scope}". Only "runbooks" is available right now.`)
  }

  if (command === undefined || command === '') {
    return null
  }

  return command
}

export async function runRunbooksCli(
  createRuntime: RunbookCliRuntimeFactory,
  argv = process.argv,
): Promise<void> {
  const args = parseArgv(argv.slice(2))
  const command = resolveRunbooksCommand(args)
  if (command === null) {
    printHelp()
    return
  }

  const asJson = parseBooleanFlag(args, 'json')
  if (command === 'execute-worker') {
    await runExecuteWorkerCommand(createRuntime, args)
    return
  }

  if (command === 'execute') {
    await runExecuteCommand(createRuntime, args, asJson)
    return
  }

  const handler = runbooksCommandHandlers.get(command)
  if (handler === undefined) {
    throw new Error(`Unsupported runbooks command "${command}"`)
  }

  const runtime = await createRuntimeFromArgs(createRuntime, args)
  try {
    await handler({ runtime, args, asJson })
  } finally {
    await runtime.destroy()
  }
}
