import type { SettingRecord } from '../../contracts';

export interface SettingsRepositoryPort {
  findByKey(key: string): Promise<SettingRecord | null>;
  findManyByKeys(keys: string[]): Promise<SettingRecord[]>;
  findByKeyPrefix(prefix: string): Promise<SettingRecord[]>;
  upsert(
    key: string,
    value: unknown,
    type: string,
    userId: number,
    description?: string,
  ): Promise<SettingRecord>;
  upsertMany(
    settings: Array<{
      key: string;
      value: unknown;
      type: string;
      userId: number;
      description?: string;
    }>,
  ): Promise<SettingRecord[]>;
  remove(key: string): Promise<void>;
  removeByKeyPrefix(prefix: string): Promise<void>;
}
