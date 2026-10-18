export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionSource = 'voice' | 'text' | 'manual' | 'image';

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
  net_balance: number;
  top_expense_categories: Array<{ category: string; total: number; percentage: number }>;
}

export interface DraftTransaction {
  type: TransactionType;
  amount_idr: number | null;
  category: string;
  occurred_on: string;
  description: string;
  source: TransactionSource;
  notes?: string;
}

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
