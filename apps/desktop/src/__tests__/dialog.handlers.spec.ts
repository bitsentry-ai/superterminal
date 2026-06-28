import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMocks = vi.hoisted(() => ({
  getPathMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: electronMocks.getPathMock,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialogMock,
    showSaveDialog: electronMocks.showSaveDialogMock,
  },
}))

import { createDialogHandlers } from '../main/platform/app/dialog/dialog.handlers'
import {
  consumeApprovedRunbookExportPath,
  consumeApprovedRunbookImportPath,
} from '@bitsentry-ce/core/features/runbooks/desktop-trusted-runbook-paths'

describe('dialog handlers', () => {
  beforeEach(() => {
    electronMocks.getPathMock.mockReset()
    electronMocks.showOpenDialogMock.mockReset()
    electronMocks.showSaveDialogMock.mockReset()
    electronMocks.getPathMock.mockImplementation((location: string) => {
      if (location === 'downloads') {
        return '/Users/test/Downloads'
      }
      return `/Users/test/${location}`
    })
  })

  it('approves a selected export path for follow-up runbook export', async () => {
    const selectedPath = '/Users/test/Downloads/exported-runbook.json'
    electronMocks.showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: selectedPath,
    })

    const handlers = createDialogHandlers(() => null)
    const result = await handlers['dialog:showSaveDialog']({
      defaultFileName: 'exported-runbook.json',
      trustScope: 'runbooks-export',
    })

    expect(result).toEqual({
      canceled: false,
      filePath: selectedPath,
    })
    expect(consumeApprovedRunbookExportPath(selectedPath)).toBe(selectedPath)
  })

  it('approves selected import paths when the dialog succeeds', async () => {
    const selectedPath = '/Users/test/Downloads/imported-runbook.json'
    electronMocks.showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: [selectedPath],
    })

    const handlers = createDialogHandlers(() => null)
    const result = await handlers['dialog:showOpenDialog']({
      trustScope: 'runbooks-import',
    })

    expect(result).toEqual({
      canceled: false,
      filePaths: [selectedPath],
    })
    expect(consumeApprovedRunbookImportPath(selectedPath)).toBe(selectedPath)
  })

  it('does not approve trust-scoped paths when the user cancels', async () => {
    const selectedPath = '/Users/test/Downloads/cancelled-runbook.json'
    electronMocks.showOpenDialogMock.mockResolvedValue({
      canceled: true,
      filePaths: [selectedPath],
    })

    const handlers = createDialogHandlers(() => null)
    const result = await handlers['dialog:showOpenDialog']({
      trustScope: 'runbooks-import',
    })

    expect(result).toEqual({
      canceled: true,
      filePaths: [selectedPath],
    })
    expect(() => consumeApprovedRunbookImportPath(selectedPath)).toThrow(
      'Runbook import file must be selected via the import dialog',
    )
  })
})
