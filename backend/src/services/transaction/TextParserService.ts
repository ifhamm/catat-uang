import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TransactionType } from './types';

export interface ParsedDraft {
  type: TransactionType;
  amount_idr: number | null;
  category: string;
  occurred_on: string; // YYYY-MM-DD
  description: string;
  raw_text: string;
  notes?: string | undefined;
}

export class TextParserService {
  /**
   * Deterministic Indonesian number & amount parser
   */
  static parseIndonesianAmount(text: string): number | null {
    const cleaned = text.toLowerCase().trim();

    // 1. Direct standard patterns like "15.000", "15,000", "15000", "15rb", "15k", "2.5 juta", "2,5jt"
    // Check "k", "rb", "ribu"
    const kMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:k|rb|ribu)\b/i);
    if (kMatch && kMatch[1]) {
      const num = parseFloat(kMatch[1].replace(',', '.'));
      if (!isNaN(num)) return Math.round(num * 1000);
    }

    // Check "juta", "jt"
    const jtMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)\b/i);
    if (jtMatch && jtMatch[1]) {
      const num = parseFloat(jtMatch[1].replace(',', '.'));
      if (!isNaN(num)) return Math.round(num * 1000000);
    }

    // Check plain numeric with dots like "50.000" or "100000"
    const numMatch = cleaned.match(/\b(?:rp\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d+)\b/i);
    if (numMatch && numMatch[1]) {
      const rawDigits = numMatch[1].replace(/\./g, '');
      const parsedNum = parseInt(rawDigits, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        return parsedNum;
      }
    }

    // 2. Word-based numbers in Indonesian
    const wordsMap: Record<string, number> = {
      satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
      enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
      sebelas: 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14,
      'lima belas': 15, 'enam belas': 16, 'tujuh belas': 17, 'delapan belas': 18,
      'sembilan belas': 19
    };

    // Check for "X belas ribu" or "X puluh ribu" or "X ratus ribu" or "X juta"
    const wordPattern = /(sebelas|dua belas|tiga belas|empat belas|lima belas|enam belas|tujuh belas|delapan belas|sembilan belas|sepuluh|dua puluh|tiga puluh|empat puluh|lima puluh|enam puluh|tujuh puluh|delapan puluh|sembilan puluh|seratus|dua ratus|tiga ratus|empat ratus|lima ratus|enam ratus|tujuh ratus|delapan ratus|sembilan ratus|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)?\s*(ribu|juta)?/gi;

    // Check common composite phrases
    if (cleaned.includes('lima belas ribu')) return 15000;
    if (cleaned.includes('lima puluh ribu')) return 50000;
    if (cleaned.includes('dua puluh lima ribu')) return 25000;
    if (cleaned.includes('tiga puluh ribu')) return 30000;
    if (cleaned.includes('dua puluh ribu')) return 20000;
    if (cleaned.includes('sepuluh ribu')) return 10000;
    if (cleaned.includes('seratus ribu')) return 100000;
    if (cleaned.includes('lima ratus ribu')) return 500000;
    if (cleaned.includes('satu juta')) return 1000000;
    if (cleaned.includes('dua juta')) return 2000000;
    if (cleaned.includes('tiga juta')) return 3000000;
    if (cleaned.includes('lima juta')) return 5000000;
    if (cleaned.includes('sepuluh juta')) return 10000000;

    return null;
  }

  /**
   * Determine date from text ("kemarin" -> yesterday, else today)
   */
  static parseDate(text: string): string {
    const lower = text.toLowerCase();
    const now = new Date();

    if (lower.includes('kemarin')) {
      now.setDate(now.getDate() - 1);
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Guess category and transaction type from keyword hints
   */
  static parseIntentAndCategory(text: string): { type: TransactionType; category: string } {
    const lower = text.toLowerCase();

    // Income keywords
    const incomeKeywords = [
      'penghasilan', 'pendapatan', 'gaji', 'gajian', 'dapat transfer', 'dapat uang', 
      'freelance', 'proyek', 'hadiah', 'bonus', 'pemasukan', 'cair', 'honor', 'upah', 
      'omset', 'omzet', 'jual', 'terjual', 'uang masuk', 'transfer masuk'
    ];
    for (const kw of incomeKeywords) {
      if (lower.includes(kw)) {
        let cat = 'Lainnya';
        if (/(gaji|gajian|upah|honor|penghasilan|pendapatan)/i.test(lower)) cat = 'Gaji';
        else if (/(freelance|proyek|jual|terjual|omset|omzet)/i.test(lower)) cat = 'Freelance';
        else if (/(hadiah|bonus)/i.test(lower)) cat = 'Hadiah';
        return { type: 'INCOME', category: cat };
      }
    }

    // Expense category matching
    if (/(makan|minum|kopi|sarapan|siang|malam|snack|jajan|nasi|bakso|mie|ayam|esteh|tea|coffee)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Makan dan minum' };
    }
    if (/(bensin|pertalite|pertamax|solar|parkir|toll|tol|ojek|grab|gojek|taksi|angkot|busway|kereta|mrt)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Transportasi' };
    }
    if (/(listrik|pln|air|pdam|wifi|internet|pulsa|paket data|bpjs|sewa|kontrakan|kos)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Tagihan' };
    }
    if (/(obat|dokter|apotek|klinik|rumah sakit|vitamin|masker)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Kesehatan' };
    }
    if (/(bioskop|nonton|game|steam|spotify|netflix|liburan|karaoke)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Hiburan' };
    }
    if (/(beli|belanja|baju|celana|sepatu|supermarket|minimarket|indomaret|alfamart|tokopedia|shopee)/i.test(lower)) {
      return { type: 'EXPENSE', category: 'Belanja' };
    }

    return { type: 'EXPENSE', category: 'Lainnya' };
  }

  /**
   * Main parse method
   */
  static parse(text: string): ParsedDraft {
    const amount = this.parseIndonesianAmount(text);
    const { type, category } = this.parseIntentAndCategory(text);
    const occurred_on = this.parseDate(text);

    return {
      type,
      amount_idr: amount,
      category,
      occurred_on,
      description: text.trim(),
      raw_text: text,
      notes: amount ? undefined : 'Nominal belum terdeteksi secara otomatis, silakan masukkan nominal.'
    };
  }
}
