export type SecureValueNamespace = "params" | "globals" | "custom";

export interface SecureValueDescriptor {
  key: string;
  value?: string;
  namespace?: SecureValueNamespace;
  redaction?: string;
  derivedValues?: string[];
}

interface SecureReplacement {
  value: string;
  redaction: string;
}

export const getSecureRedactionMarker = (
  descriptor: Pick<SecureValueDescriptor, "key" | "namespace" | "redaction">,
): string => {
  if (descriptor.redaction !== undefined && descriptor.redaction.length > 0) {
    return descriptor.redaction;
  }

  if (descriptor.namespace === "globals") {
    return `[secure-global:${descriptor.key}]`;
  }

  return `[secure:${descriptor.key}]`;
};

export class SecureRedactor {
  private readonly replacements: SecureReplacement[];

  constructor(descriptors: SecureValueDescriptor[]) {
    this.replacements = descriptors
      .flatMap((descriptor) => {
        const redaction = getSecureRedactionMarker(descriptor);
        const values = [descriptor.value, ...(descriptor.derivedValues ?? [])];

        return values
          .filter((value): value is string => typeof value === "string")
          .filter((value) => value.length > 0)
          .map((value) => ({ value, redaction }));
      })
      .sort((left, right) => right.value.length - left.value.length);
  }

  redactString(value: string): string {
    return this.replacements.reduce(
      (current, replacement) =>
        current.split(replacement.value).join(replacement.redaction),
      value,
    );
  }

  redact<T>(value: T): T {
    return this.redactValue(value, new WeakMap()) as T;
  }

  private redactValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
    if (typeof value === "string") {
      return this.redactString(value);
    }

    if (Array.isArray(value)) {
      if (seen.has(value)) {
        return seen.get(value);
      }

      const redacted: unknown[] = [];
      seen.set(value, redacted);
      for (const item of value) {
        redacted.push(this.redactValue(item, seen));
      }
      return redacted;
    }

    if (!isPlainRecord(value)) {
      return value;
    }

    if (seen.has(value)) {
      return seen.get(value);
    }

    const redacted: Record<string, unknown> = {};
    seen.set(value, redacted);

    for (const [key, item] of Object.entries(value)) {
      redacted[key] = this.redactValue(item, seen);
    }

    return redacted;
  }
}

export const createSecureRedactor = (
  descriptors: SecureValueDescriptor[],
): SecureRedactor => new SecureRedactor(descriptors);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
