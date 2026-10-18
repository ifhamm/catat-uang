import { todayDateOnly } from '../../utils/date';
import { ImageParseResult, ImageParsingService } from './types';

interface Scenario {
  type: 'INCOME' | 'EXPENSE';
  amount_idr: number | null;
  category: string;
  description: string;
  source_name: string;
  notes: string;
}

/**
 * Used when GEMINI_API_KEY is missing, so the screenshot flow stays testable
 * locally without burning quota. Always sets isMock: true.
 */
export class MockImageParsingService implements ImageParsingService {
  async parseImage(imageBuffer: Buffer, _mimeType: string): Promise<ImageParseResult> {
    // Simulate API delay (0.8 - 1.8 seconds)
    const delay = Math.floor(Math.random() * 1000) + 800;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const scenarios: Scenario[] = [
      { type: 'EXPENSE', amount_idr: 15000, category: 'Makan dan minum', description: 'makan siang warteg', source_name: 'BCA', notes: 'Mock: uji pengeluaran' },
      { type: 'EXPENSE', amount_idr: null, category: 'Lainnya', description: 'transaksi tanpa nominal', source_name: 'GoPay', notes: 'Mock: nominal tidak terdeteksi' },
      { type: 'INCOME', amount_idr: 5000000, category: 'Gaji', description: 'gaji bulanan', source_name: 'Mandiri', notes: 'Mock: uji pemasukan' },
      { type: 'EXPENSE', amount_idr: 30000, category: 'Transportasi', description: 'bensin', source_name: 'DANA', notes: 'Mock: uji nominal standar' }
    ];

    // Pick a scenario by buffer length so repeated tests behave predictably.
    const index = imageBuffer.length % scenarios.length;
    const scenario = scenarios[index] ?? scenarios[0]!;

    return {
      type: scenario.type,
      amount_idr: scenario.amount_idr,
      category: scenario.category,
      occurred_on: todayDateOnly(),
      description: scenario.description,
      source_name: scenario.source_name,
      notes: scenario.notes,
      isMock: true
    };
  }
}
