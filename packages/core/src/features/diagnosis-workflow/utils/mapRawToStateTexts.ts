import type { StateTexts } from "../domain/entities/DiagnosisRecord";
import { isRecord } from "../../../shared/values";

const getText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
};

const STATE_TEXT_ENTRIES: ReadonlyArray<readonly [keyof StateTexts, string[]]> = [
  ["actualRemediation", ["actualRemediation", "recommend"]],
  ["assessment", ["assessment", "diagnose"]],
  ["diagnose", ["diagnose", "assessment"]],
  ["diagnosisConfirmation", ["diagnosisConfirmation", "verify"]],
  ["recommend", ["recommend", "actualRemediation", "actual_remediation"]],
  ["verificationText", ["verificationText", "verify"]],
  [
    "verify",
    [
      "verify",
      "verificationText",
      "verification_text",
      "diagnosisConfirmation",
      "diagnosis_confirmation",
    ],
  ],
];

/**
 * Maps raw database row state_texts to StateTexts interface.
 * Handles backward compatibility with legacy field names.
 *
 * @param rawStateTexts - The raw state_texts value from database (string or object)
 * @param currentState  - Optional current state, used as a heuristic when raw is a plain string
 * @returns StateTexts object with all fields populated
 */
export function mapRawToStateTexts(
  rawStateTexts: unknown,
  currentState?: string,
): StateTexts {
  if (typeof rawStateTexts === "string") {
    return stateTextsFromString(rawStateTexts, currentState);
  }

  if (!isRecord(rawStateTexts)) return {};

  return stateTextsFromRecord(rawStateTexts);
}

function stateTextsFromRecord(source: Record<string, unknown>): StateTexts {
  const stateTexts: StateTexts = {};
  for (const [targetKey, sourceKeys] of STATE_TEXT_ENTRIES) {
    const text = firstText(source, sourceKeys);
    if (text !== undefined) {
      stateTexts[targetKey] = text;
    }
  }
  return stateTexts;
}

function stateTextsFromString(
  rawStateTexts: string,
  currentState?: string,
): StateTexts {
  try {
    const parsed: unknown = JSON.parse(rawStateTexts);
    if (isRecord(parsed)) return stateTextsFromRecord(parsed);
  } catch {
    return stateTextsFromPlainText(rawStateTexts, currentState);
  }

  return {};
}

function stateTextsFromPlainText(textValue: string, currentState?: string): StateTexts {
  const text = textValue.trim();
  if (text.length === 0) return {};

  if (currentState === "completed") return { recommend: text };
  if (currentState === "verified" || currentState === "verification_pending") {
    return { verify: text };
  }
  return { diagnose: text };
}

function firstText(
  source: Record<string, unknown>,
  sourceKeys: string[],
): string | undefined {
  for (const sourceKey of sourceKeys) {
    const text = getText(source[sourceKey]);
    if (text !== undefined) return text;
  }
  return undefined;
}
