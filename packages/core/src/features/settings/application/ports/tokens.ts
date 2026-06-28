import { createDiToken } from '../../../../kernel';
import type { SettingsUseCases } from './inbound';

export const SETTINGS_USE_CASES = createDiToken<SettingsUseCases>(
  '@bitsentry-ce/core/settings/use-cases',
);
