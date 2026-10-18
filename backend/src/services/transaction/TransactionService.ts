import { pool } from '../../db';
import { currentMonth, toDateOnly, todayDateOnly } from '../../utils/date';
import { Transaction, MonthSummary } from './types';

export class TransactionService {
  /**
   * Create a new transaction with Idempotency & 60s duplicate check
   */
  static async create(
    userId: string,
    data: {
      operation_id: string;
      type: 'INCOME' | 'EXPENSE';
      amount_idr: number;
      category: string;
      occurred_on?: string | undefined;
      description?: string | null | undefined;
      source?: 'voice' | 'text' | 'manual' | 'image' | undefined;
      confirm_duplicate?: boolean | undefined;
    }
  ): Promise<{ transaction: Transaction; isIdempotentReplay: boolean }> {
    const client = await pool.connect();

    try {
      // 1. Idempotency Check: FR05, FR11, Bagian 8 & 10
      const existingOp = await client.query(
        `SELECT result_id FROM operations WHERE user_id = $1 AND operation_id = $2`,
        [userId, data.operation_id]
      );

      if (existingOp.rows.length > 0 && existingOp.rows[0].result_id) {
        const existingTx = await client.query(
          `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
          [existingOp.rows[0].result_id, userId]
        );
        if (existingTx.rows.length > 0) {
          return {
            transaction: this.formatRow(existingTx.rows[0]),
            isIdempotentReplay: true
          };
        }
      }

      // 2. 60-Second Duplicate Warning: PRD Bagian 8
      if (!data.confirm_duplicate) {
        const recentDup = await client.query(
          `SELECT id FROM transactions 
           WHERE user_id = $1 
             AND type = $2 
             AND amount_idr = $3 
             AND COALESCE(description, '') = COALESCE($4, '') 
             AND created_at > NOW() - INTERVAL '60 seconds' 
             AND deleted_at IS NULL
           LIMIT 1`,
          [userId, data.type, data.amount_idr, data.description || '']
        );

        if (recentDup.rows.length > 0) {
          const err: any = new Error(
            'Transaksi serupa baru saja dicatat kurang dari 60 detik lalu. Konfirmasi jika benar-benar ingin mencatat ulang.'
          );
          err.code = 'POSSIBLE_DUPLICATE';
          err.statusCode = 409;
          throw err;
        }
      }

      await client.query('BEGIN');

      const occurredOn = data.occurred_on || todayDateOnly();
      const source = data.source || 'manual';

      const insertTxRes = await client.query(
        `INSERT INTO transactions (
          user_id, type, amount_idr, currency, occurred_on, category, description, source, version
        ) VALUES ($1, $2, $3, 'IDR', $4, $5, $6, $7, 1)
        RETURNING *`,
        [userId, data.type, data.amount_idr, occurredOn, data.category, data.description || null, source]
      );

      const createdTx = insertTxRes.rows[0];

      // Save operation record
      await client.query(
        `INSERT INTO operations (user_id, operation_id, action, result_id, status)
         VALUES ($1, $2, 'create_transaction', $3, 'completed')`,
        [userId, data.operation_id, createdTx.id]
      );

      await client.query('COMMIT');

      return {
        transaction: this.formatRow(createdTx),
        isIdempotentReplay: false
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List transactions with month & type filters
   */
  static async list(
    userId: string,
    filters?: {
      month?: string | undefined;
      type?: 'INCOME' | 'EXPENSE' | undefined;
      limit?: number | undefined;
      offset?: number | undefined;
    }
  ): Promise<Transaction[]> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let query = `
      SELECT * FROM transactions 
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [userId];

    if (filters?.month) {
      // YYYY-MM
      params.push(`${filters.month}-01`);
      query += ` AND occurred_on >= $${params.length}`;
      query += ` AND occurred_on < ($${params.length}::date + INTERVAL '1 month')`;
    }

    if (filters?.type) {
      params.push(filters.type);
      query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY occurred_on DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await pool.query(query, params);
    return res.rows.map(this.formatRow);
  }

  /**
   * Get 3 most recent transactions for Home screen
   */
  static async getRecent(userId: string): Promise<Transaction[]> {
    const res = await pool.query(
      `SELECT * FROM transactions 
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC 
       LIMIT 3`,
      [userId]
    );
    return res.rows.map(this.formatRow);
  }

  /**
   * Monthly Summary: PRD Bagian 6 & 10
   */
  static async getSummary(userId: string, monthStr?: string): Promise<MonthSummary> {
    const targetMonth = monthStr || currentMonth(); // YYYY-MM
    const startDate = `${targetMonth}-01`;

    const summaryQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount_idr ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount_idr ELSE 0 END), 0) as total_income
      FROM transactions
      WHERE user_id = $1 
        AND deleted_at IS NULL
        AND occurred_on >= $2::date
        AND occurred_on < ($2::date + INTERVAL '1 month')
    `;

    const summaryRes = await pool.query(summaryQuery, [userId, startDate]);
    const totalExpense = Number(summaryRes.rows[0]?.total_expense || 0);
    const totalIncome = Number(summaryRes.rows[0]?.total_income || 0);

    // Top expense categories breakdown
    const catQuery = `
      SELECT category, SUM(amount_idr) as total
      FROM transactions
      WHERE user_id = $1
        AND type = 'EXPENSE'
        AND deleted_at IS NULL
        AND occurred_on >= $2::date
        AND occurred_on < ($2::date + INTERVAL '1 month')
      GROUP BY category
      ORDER BY total DESC
    `;

    const catRes = await pool.query(catQuery, [userId, startDate]);
    const topCategories: Array<{ category: string; total: number; percentage: number }> = [];

    let topSum = 0;
    const rows = catRes.rows;

    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const tot = Number(rows[i].total);
      topSum += tot;
      topCategories.push({
        category: rows[i].category,
        total: tot,
        percentage: totalExpense > 0 ? Math.round((tot / totalExpense) * 100) : 0
      });
    }

    if (rows.length > 5 && totalExpense > topSum) {
      const otherTotal = totalExpense - topSum;
      topCategories.push({
        category: 'Lainnya',
        total: otherTotal,
        percentage: totalExpense > 0 ? Math.round((otherTotal / totalExpense) * 100) : 0
      });
    }

    return {
      period: targetMonth,
      total_expense: totalExpense,
      total_income: totalIncome,
      net_balance: totalIncome - totalExpense,
      top_expense_categories: topCategories
    };
  }

  /**
   * Update transaction with Optimistic Concurrency versioning
   */
  static async update(
    userId: string,
    id: string,
    data: {
      expected_version: number;
      type?: 'INCOME' | 'EXPENSE' | undefined;
      amount_idr?: number | undefined;
      category?: string | undefined;
      occurred_on?: string | undefined;
      description?: string | null | undefined;
      operation_id?: string | undefined;
    }
  ): Promise<Transaction> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [id, userId]
      );

      if (existing.rows.length === 0) {
        const err: any = new Error('Transaksi tidak ditemukan atau telah dihapus.');
        err.statusCode = 404;
        throw err;
      }

      const current = existing.rows[0];

      // Optimistic concurrency check
      if (current.version !== data.expected_version) {
        const err: any = new Error('Konflik versi: Transaksi telah diperbarui dari sesi lain.');
        err.code = 'VERSION_CONFLICT';
        err.statusCode = 409;
        throw err;
      }

      const newType = data.type || current.type;
      const newAmount = data.amount_idr || current.amount_idr;
      const newCategory = data.category || current.category;
      const newOccurredOn = data.occurred_on || current.occurred_on;
      const newDesc = data.description !== undefined ? data.description : current.description;

      const updateRes = await client.query(
        `UPDATE transactions 
         SET type = $1, amount_idr = $2, category = $3, occurred_on = $4, description = $5,
             version = version + 1, updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [newType, newAmount, newCategory, newOccurredOn, newDesc, id, userId]
      );

      if (data.operation_id) {
        await client.query(
          `INSERT INTO operations (user_id, operation_id, action, result_id, status)
           VALUES ($1, $2, 'update_transaction', $3, 'completed')
           ON CONFLICT (user_id, operation_id) DO NOTHING`,
          [userId, data.operation_id, id]
        );
      }

      await client.query('COMMIT');
      return this.formatRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Soft Delete Transaction
   */
  static async delete(userId: string, id: string): Promise<Transaction> {
    const res = await pool.query(
      `UPDATE transactions 
       SET deleted_at = NOW(), version = version + 1, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [id, userId]
    );

    if (res.rows.length === 0) {
      const err: any = new Error('Transaksi tidak ditemukan atau sudah dihapus.');
      err.statusCode = 404;
      throw err;
    }

    return this.formatRow(res.rows[0]);
  }

  /**
   * Restore Transaction (within 7 days)
   */
  static async restore(userId: string, id: string): Promise<Transaction> {
    const res = await pool.query(
      `UPDATE transactions 
       SET deleted_at = NULL, version = version + 1, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 
         AND deleted_at IS NOT NULL
         AND deleted_at >= NOW() - INTERVAL '7 days'
       RETURNING *`,
      [id, userId]
    );

    if (res.rows.length === 0) {
      const err: any = new Error('Transaksi tidak ditemukan atau batas waktu pemulihan 7 hari telah lewat.');
      err.statusCode = 404;
      throw err;
    }

    return this.formatRow(res.rows[0]);
  }

  private static formatRow(row: any): Transaction {
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      amount_idr: Number(row.amount_idr),
      currency: row.currency,
      occurred_on: toDateOnly(row.occurred_on),
      category: row.category,
      description: row.description,
      source: row.source,
      version: row.version,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null
    };
  }
}
