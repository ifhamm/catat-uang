import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../transaction/types';
import { TextParserService } from '../transaction/TextParserService';
import { todayDateOnly } from '../../utils/date';

export interface ImageParseResult {
  type: 'INCOME' | 'EXPENSE';
  amount_idr: number | null;
  category: string;
  occurred_on: string; // YYYY-MM-DD
  description: string;
  source_name?: string | undefined;
  notes?: string | undefined;
  isMock: boolean;
}

export interface ImageParsingService {
  parseImage(imageBuffer: Buffer, mimeType: string): Promise<ImageParseResult>;
}

const EXPENSE_LIST: readonly string[] = EXPENSE_CATEGORIES;
const INCOME_LIST: readonly string[] = INCOME_CATEGORIES;
const MAX_AMOUNT = 1_000_000_000_000;

function asString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Model output is untrusted, so amounts are re-checked here. Numbers are
 * rounded to whole rupiah; strings (e.g. "Rp15.000,00") go through the same
 * deterministic Indonesian parser used by the "ketik saja" flow.
 */
function toAmount(value: unknown): number | null {
  let amount: number | null = null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    amount = Math.round(value);
  } else if (typeof value === 'string') {
    amount = TextParserService.parseIndonesianAmount(value);
  }

  if (amount === null || amount <= 0 || amount > MAX_AMOUNT) return null;
  return amount;
}

function toType(value: unknown): 'INCOME' | 'EXPENSE' {
  return typeof value === 'string' && value.trim().toUpperCase() === 'INCOME'
    ? 'INCOME'
    : 'EXPENSE';
}

/** Whitelists the category against the closed list for the resolved type. */
function toCategory(value: unknown, type: 'INCOME' | 'EXPENSE'): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const list = type === 'INCOME' ? INCOME_LIST : EXPENSE_LIST;
  const match = list.find((candidate) => candidate.toLowerCase() === raw);
  return match ?? 'Lainnya';
}

/** Keeps a plausible 'YYYY-MM-DD', otherwise falls back to today (Asia/Jakarta). */
function toDate(value: unknown): string {
  if (typeof value !== 'string') return todayDateOnly();
  const raw = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayDateOnly();
  return Number.isNaN(Date.parse(raw)) ? todayDateOnly() : raw;
}

/**
 * Converts whatever the model returned into a safe, schema-shaped result.
 * Every field is validated: unknown categories collapse to 'Lainnya', bad
 * amounts become null (so the review modal asks for one), and bad dates fall
 * back to today in the app timezone.
 */
export function normalizeImageParseResult(raw: unknown, isMock = false): ImageParseResult {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = toType(source.type);

  return {
    type,
    amount_idr: toAmount(source.amount_idr),
    category: toCategory(source.category, type),
    occurred_on: toDate(source.occurred_on),
    description: asString(source.description, 500) ?? '',
    source_name: asString(source.source_name, 100),
    notes: asString(source.notes, 500),
    isMock,
  };
}
