import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'Makan dan minum',
  'Transportasi',
  'Belanja',
  'Tagihan',
  'Kesehatan',
  'Hiburan',
  'Lainnya'
] as const;

export const INCOME_CATEGORIES = [
  'Gaji',
  'Freelance',
  'Hadiah',
  'Lainnya'
] as const;

export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES
] as const;

export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionSource = 'voice' | 'text' | 'manual';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_idr: number;
  currency: string;
  occurred_on: string; // YYYY-MM-DD
  category: string;
  description: string | null;
  source: TransactionSource;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MonthSummary {
  period: string; // YYYY-MM
  total_expense: number;
  total_income: number;
  net_balance: number; // total_income - total_expense
  top_expense_categories: Array<{ category: string; total: number; percentage: number }>;
}

export const createTransactionSchema = z.object({
  operation_id: z.string().uuid({ message: 'operation_id must be a valid UUID v4' }),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount_idr: z
    .number()
    .int({ message: 'Nominal harus berupa bilangan bulat' })
    .positive({ message: 'Nominal harus lebih dari 0' })
    .max(1_000_000_000_000, { message: 'Nominal melebihi batas maksimal Rp1 triliun' }),
  category: z.string().min(1, { message: 'Kategori wajib diisi' }),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal harus YYYY-MM-DD' })
    .optional(),
  description: z.string().max(500).optional().nullable(),
  source: z.enum(['voice', 'text', 'manual']).default('manual'),
  confirm_duplicate: z.boolean().optional().default(false)
});

export const updateTransactionSchema = z.object({
  operation_id: z.string().uuid().optional(),
  expected_version: z.number().int().positive({ message: 'expected_version is required' }),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  amount_idr: z.number().int().positive().max(1_000_000_000_000).optional(),
  category: z.string().min(1).optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const parseTextSchema = z.object({
  text: z.string().min(1).max(500)
});
