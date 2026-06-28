import { describe, expect, it } from 'vitest'
import {
  resolveRunbookLocalAiAccessLevel,
} from '@bitsentry-ce/core/features/runbooks/desktop-runbook-execution.service'

describe('resolveRunbookLocalAiAccessLevel', () => {
  it('promotes prompt-only local providers used by runbook LLM actions', () => {
    expect(resolveRunbookLocalAiAccessLevel('codex', undefined)).toBe('auto-accept-edits')
    expect(resolveRunbookLocalAiAccessLevel('codex', 'supervised')).toBe('auto-accept-edits')
    expect(resolveRunbookLocalAiAccessLevel('opencode', 'supervised')).toBe('auto-accept-edits')
    expect(resolveRunbookLocalAiAccessLevel('cursor', 'supervised')).toBe('auto-accept-edits')
  })

  it('preserves explicit higher access and Claude Code supervised mode', () => {
    expect(resolveRunbookLocalAiAccessLevel('codex', 'full-access')).toBe('full-access')
    expect(resolveRunbookLocalAiAccessLevel('opencode', 'auto-accept-edits')).toBe('auto-accept-edits')
    expect(resolveRunbookLocalAiAccessLevel('claude_code', 'supervised')).toBe('supervised')
  })
})
