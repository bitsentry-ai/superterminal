import { z } from "zod";
import type { SettingRecord } from "./contracts";
import type { SettingsRepositoryPort } from "./application/ports/outbound";

export interface DesktopSettingsRepositoryDatabase {
  setting: {
    findUnique(args: { where: { key: string } }): Promise<unknown>;
    findMany(args: {
      where: { key: { in?: string[]; startsWith?: string } };
    }): Promise<unknown[]>;
    upsert(args: {
      where: { key: string };
      create: {
        key: string;
        value: string;
        type: string;
        userId: number;
        description: string | null;
      };
      update: {
        value: string;
        type: string;
        userId: number;
        description?: string;
      };
    }): Promise<unknown>;
    delete(args: { where: { key: string } }): Promise<unknown>;
    deleteMany(args: {
      where: { key: { startsWith: string } };
    }): Promise<unknown>;
  };
}

const settingRecordRowSchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  key: z.string(),
  value: z.string(),
  description: z.string().nullable().optional(),
  type: z.string().optional(),
  userId: z.number().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
});

export class DesktopSqliteSettingsRepositoryAdapter
  implements SettingsRepositoryPort
{
  constructor(private readonly db: DesktopSettingsRepositoryDatabase) {}

  async findByKey(key: string): Promise<SettingRecord | null> {
    const record = await this.db.setting.findUnique({ where: { key } });
    if (record === null) {
      return null;
    }

    return this.toDomain(record);
  }

  async findManyByKeys(keys: string[]): Promise<SettingRecord[]> {
    const records = await this.db.setting.findMany({
      where: { key: { in: keys } },
    });
    return records.map((record: unknown) => this.toDomain(record));
  }

  async findByKeyPrefix(prefix: string): Promise<SettingRecord[]> {
    const records = await this.db.setting.findMany({
      where: { key: { startsWith: prefix } },
    });
    return records.map((record: unknown) => this.toDomain(record));
  }

  async upsert(
    key: string,
    value: unknown,
    type: string,
    userId: number,
    description?: string,
  ): Promise<SettingRecord> {
    const serialized = this.serializeValue(value);
    const record = await this.db.setting.upsert({
      where: { key },
      create: {
        key,
        value: serialized,
        type,
        userId,
        description: description ?? null,
      },
      update: {
        value: serialized,
        type,
        userId,
        description,
      },
    });
    return this.toDomain(record);
  }

  async upsertMany(
    settings: Array<{
      key: string;
      value: unknown;
      type: string;
      userId: number;
      description?: string;
    }>,
  ): Promise<SettingRecord[]> {
    const results: SettingRecord[] = [];
    for (const setting of settings) {
      const result = await this.upsert(
        setting.key,
        setting.value,
        setting.type,
        setting.userId,
        setting.description,
      );
      results.push(result);
    }
    return results;
  }

  async remove(key: string): Promise<void> {
    try {
      await this.db.setting.delete({ where: { key } });
    } catch {
      // Key doesn't exist — safe to ignore
    }
  }

  async removeByKeyPrefix(prefix: string): Promise<void> {
    await this.db.setting.deleteMany({
      where: { key: { startsWith: prefix } },
    });
  }

  private toDomain(record: unknown): SettingRecord {
    const row = settingRecordRowSchema.parse(record);
    return {
      id: String(row.id),
      key: row.key,
      value: this.deserializeValue(row.value, row.type),
      description: row.description ?? undefined,
      type: row.type ?? "string",
      userId: row.userId ?? 0,
      createdAt: this.toDate(row.createdAt),
      updatedAt: this.toDate(row.updatedAt),
    };
  }

  private serializeValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "boolean") return String(value);
    if (typeof value === "number") return String(value);
    return JSON.stringify(value);
  }

  private deserializeValue(raw: string, type?: string): unknown {
    switch (type) {
      case "boolean":
        return raw === "true";
      case "number":
        return Number(raw);
      case "json":
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      default:
        return raw;
    }
  }

  private toDate(value: Date | string | undefined): Date {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (Number.isFinite(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }
}
