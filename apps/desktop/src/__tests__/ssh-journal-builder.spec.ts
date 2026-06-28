import { describe, expect, it } from 'vitest'

import {
  buildSshJournalctlCommand,
  classifySshError,
  shellEscape,
} from '@bitsentry-ce/core/features/agent-runtime/shared/ssh-journal-query-builder'

describe('ssh journal command builder', () => {
  it('shell-escapes apostrophes safely', () => {
    expect(shellEscape("app's unit")).toBe(`'app'"'"'s unit'`)
  })

  it('builds an allowlisted ssh journalctl command with escaped arguments', () => {
    const command = buildSshJournalctlCommand({
      host: 'prod.example.com',
      username: 'ubuntu',
      port: 2222,
      since: '1 hour ago',
      until: 'now',
      cursor: 's=cursor-1',
      units: ['nginx.service', "worker's.service"],
      priorities: ['err', 'warning'],
      limit: 250,
      follow: true,
    })

    expect(command.args).toEqual([
      '-o',
      'ConnectTimeout=10',
      '-o',
      'BatchMode=yes',
      '-p',
      '2222',
      'ubuntu@prod.example.com',
      `journalctl --no-pager --output json --since '1 hour ago' --until 'now' --after-cursor 's=cursor-1' --unit 'nginx.service' --unit 'worker'"'"'s.service' -p err,warning -n 250 -f`,
    ])
    expect(command.display).toContain('ssh ubuntu@prod.example.com')
    expect(command.display).toContain('--output json')
  })

  it('classifies common ssh failures into actionable messages', () => {
    expect(classifySshError('Permission denied (publickey).')).toEqual({
      message: 'Permission denied. Check SSH key access or user permissions.',
      level: 'error',
    })

    expect(
      classifySshError(
        'You are currently not seeing messages from other users and the system.',
      ),
    ).toEqual({
      message: 'Limited journal access: some system logs are hidden. User needs adm or systemd-journal group for full access.',
      level: 'warning',
    })
  })
})
