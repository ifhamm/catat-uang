import React, { useState } from 'react';
import { X, Edit3, ArrowRight, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import { DraftTransaction } from '../types';

interface QuickTextInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParsed: (draft: DraftTransaction) => void;
}

export const QuickTextInputModal: React.FC<QuickTextInputModalProps> = ({
  isOpen,
  onClose,
  onParsed
}) => {
  const [activeType, setActiveType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!text.trim()) {
      setErrorMsg('Tulis dulu catatannya.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      const draft = await api.parseText(text.trim());
      // Override type if user explicitly selected the tab
      draft.type = activeType;
      if (activeType === 'INCOME' && draft.category === 'Makan dan minum') {
        draft.category = 'Gaji';
      }
      onParsed(draft);
      setText('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Teks belum bisa dibaca.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualForm = () => {
    onParsed({
      type: activeType,
      amount_idr: null,
      category: activeType === 'INCOME' ? 'Gaji' : 'Makan dan minum',
      occurred_on: new Date().toISOString().slice(0, 10),
      description: '',
      source: 'manual'
    });
    onClose();
  };

  const expenseExamples = [
    'Makan siang 25rb',
    'Bensin 30.000',
    'Kopi 18k',
    'Tagihan listrik 150rb'
  ];

  const incomeExamples = [
    'Gajian 5 juta',
    'Penghasilan freelance 2.5jt',
    'Bonus 1.500.000',
    'Dapat transfer 500rb'
  ];

  const currentExamples = activeType === 'INCOME' ? incomeExamples : expenseExamples;

  return (
    <div className="fixed inset-0 bg-ink/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="sheet w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-line p-6 flex flex-col overflow-hidden animate-slide-up text-ink">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[15px] font-bold text-ink tracking-tight">Ketik singkat</h2>
            <p className="text-xs text-muted mt-0.5">Tulis santai saja, seperti bicara</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-paper-2 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => setActiveType('EXPENSE')}
            className={`flex items-center justify-center py-2 rounded-xl font-semibold text-xs transition-all ${
              activeType === 'EXPENSE' ? 'bg-card text-clay-deep shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setActiveType('INCOME')}
            className={`flex items-center justify-center py-2 rounded-xl font-semibold text-xs transition-all ${
              activeType === 'INCOME' ? 'bg-card text-sage-deep shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Pemasukan
          </button>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleParse();
              }
            }}
            placeholder={
              activeType === 'INCOME'
                ? 'misalnya: gajian lima juta, bonus 1 juta…'
                : 'misalnya: makan dua puluh ribu, kopi 15rb…'
            }
            rows={3}
            className="w-full p-3.5 bg-paper border border-line rounded-2xl text-sm text-ink placeholder-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15 transition-all resize-none"
            autoFocus
          />

          {errorMsg && (
            <div className="text-xs font-medium text-clay-deep bg-clay-soft p-2.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Quick Examples */}
          <div>
            <div className="text-xs font-medium text-muted mb-1.5">
              Contoh cepat
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentExamples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex)}
                  className="px-2.5 py-1 bg-paper border border-line hover:bg-paper-2 text-ink-soft text-xs rounded-full transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={isLoading || !text.trim()}
            className="w-full py-3 bg-sage hover:bg-sage-deep active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_12px_24px_-14px_rgba(94,124,88,1)] mt-1"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Periksa catatan</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-1">
            <button
              onClick={handleManualForm}
              className="text-xs text-ink-soft font-semibold hover:text-sage-deep inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Isi manual tanpa bantuan parser</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
