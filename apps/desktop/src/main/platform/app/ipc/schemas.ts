import { createDesktopAppIpcPayloadValidator } from '@bitsentry-ce/components/services'

export const validateIpcPayload = createDesktopAppIpcPayloadValidator({
  edition: 'ce',
  importFromFileOptionsRequired: true,
})
