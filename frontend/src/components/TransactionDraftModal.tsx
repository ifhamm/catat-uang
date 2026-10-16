import React, { useState } from 'react';
import { DraftTransaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TransactionType } from '../types';
import { X, ArrowDownRight, ArrowUpRight, AlertTriangle, Check, Loader2, Calendar, Tag, FileText } from 'lucide-react';

interface TransactionDraftModalProps {
  draft: DraftTransaction;
  isOpen: boolean;
  onClose: () => void;
  onSave: (finalData: {
    type: TransactionType;
    amount_idr: number;
    category: string;
    occurred_on: string;
    description: string;
    source: 'voice' | 'text' | 'manual';
    confirm_duplicate?: boolean;
  }) => Promise<void>;
}

export const TransactionDraftModal: React.FC<TransactionDraftModalProps> = ({
  draft,
  isOpen,
  onClose,
  onSave
}) => {
  const [type, setType] = useState<TransactionType>(draft.type);
  const [amountStr, setAmountStr] = useState<string>(draft.amount_idr ? String(draft.amount_idr) : '');
  const [category, setCategory] = useState<string>(draft.category);
  const [occurredOn, setOccurredOn] = useState<string>(draft.occurred_on || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>(draft.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCategories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const numAmount = parseInt(amountStr.replace(/\D/g, ''), 10) || 0;
  const isHighAmount = numAmount >= 10_000_000;

  const titleBySource: Record<string, string> = {
    voice: 'Draf dari suara',
    text: 'Draf dari tulisan',
    manual: 'Catatan baru'
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'EXPENSE' && !EXPENSE_CATEGORIES.includes(category as any)) {
      setCategory('Makan dan minum');
    } else if (newType === 'INCOME' && !INCOME_CATEGORIES.includes(category as any)) {
      setCategory('Gaji');
    }
  };

  const handleSubmit = async () => {
    if (numAmount <= 0) {
      setErrorMsg('Nominal transaksi harus lebih dari Rp0');
      return;
    }
    if (numAmount > 1_000_000_000_000) {
      setErrorMsg('Nominal melebihi batas maksimal Rp1 triliun');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSave({
        type,
        amount_idr: numAmount,
        category,
        occurred_on: occurredOn,
        description: description.trim(),
        source: draft.source
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="sheet w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-line max-h-[92vh] flex flex-col overflow-hidden animate-slide-up text-ink">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-ink tracking-tight">
              {titleBySource[draft.source] || 'Periksa catatan'}
            </h2>
            <p className="text-xs text-muted mt-0.5">Pastikan nominal dan detailnya sudah benar</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {draft.notes && (
            <div className="p-3 bg-honey-soft border border-honey/25 rounded-2xl text-xs text-honey flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{draft.notes}</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-paper-2 rounded-2xl">
            <button
              type="button"
              onClick={() => handleTypeChange('EXPENSE')}
              className={`flex items-center justify-center py-2.5 rounded-xl font-bold text-xs transition-all ${
                type === 'EXPENSE'
                  ? 'bg-card text-clay-deep shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 mr-1.5" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('INCOME')}
              className={`flex items-center justify-center py-2.5 rounded-xl font-bold text-xs transition-all ${
                type === 'INCOME'
                  ? 'bg-card text-sage-deep shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 mr-1.5" />
              Pemasukan
            </button>
          </div>

          {/* Nominal */}
          <div className="text-center py-4 px-4 bg-paper rounded-3xl border border-line">
            <span className="text-xs font-medium text-muted block mb-1">Nominal</span>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-lg font-semibold text-muted">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={numAmount > 0 ? numAmount.toLocaleString('id-ID') : ''}
                onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="text-3xl sm:text-4xl font-extrabold text-ink max-w-[280px] text-center bg-transparent focus:outline-none border-b-2 border-transparent focus:border-sage tabular-nums tracking-tight"
                autoFocus={!draft.amount_idr}
              />
            </div>

            {isHighAmount && (
              <div className="mt-3 inline-flex items-center text-xs font-semibold px-3 py-1 bg-honey-soft text-honey rounded-full">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Nominal besar: Rp{numAmount.toLocaleString('id-ID')}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-[13px] font-semibold text-ink-soft flex items-center gap-1.5 mb-2.5">
              <Tag className="w-3.5 h-3.5 text-muted" />
              <span>Kategori</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    category === cat
                      ? 'bg-sage text-white shadow-[0_8px_18px_-10px_rgba(94,124,88,0.9)]'
                      : 'bg-paper border border-line text-ink-soft hover:bg-paper-2'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-[13px] font-semibold text-ink-soft flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted" />
              <span>Tanggal kejadian</span>
            </label>
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15 tabular-nums"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[13px] font-semibold text-ink-soft flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-muted" />
              <span>Keterangan</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: makan siang warteg, gaji bulan ini…"
              className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink placeholder-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-clay-soft border border-clay/25 rounded-2xl text-xs font-medium text-clay-deep">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-line grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl border border-line bg-card text-ink-soft font-bold text-xs hover:bg-paper active:scale-95 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-sage text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_12px_24px_-14px_rgba(94,124,88,1)] hover:bg-sage-deep active:scale-95 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Simpan transaksi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
