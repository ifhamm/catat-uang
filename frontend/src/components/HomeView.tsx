import React from 'react';
import { MonthSummary, Transaction } from '../types';
import { Mic, Square, Loader2, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Keyboard, Image, Calendar } from 'lucide-react';
import { formatDayMonth, formatRupiah } from '../utils/format';

interface HomeViewProps {
  summary: MonthSummary | null;
  recentTransactions: Transaction[];
  currentMonth: string; // YYYY-MM
  onChangeMonth: (newMonth: string) => void;
  recorderStatus: 'IDLE' | 'RECORDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  recorderError?: string;
  onMicClick: () => void;
  onQuickTextClick: () => void;
  onImageClick: () => void;
  isParsingImage?: boolean;
  imageError?: string | null;
  onQuickIncome: () => void;
  onQuickExpense: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  summary,
  recentTransactions,
  currentMonth,
  onChangeMonth,
  recorderStatus,
  recorderError,
  onMicClick,
  onQuickTextClick,
  onImageClick,
  isParsingImage,
  imageError,
  onQuickIncome,
  onQuickExpense,
  onSelectTransaction
}) => {
  const formatMonthTitle = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const newStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onChangeMonth(newStr);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    const newStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onChangeMonth(newStr);
  };

  const totalExpense = summary?.total_expense || 0;
  const totalIncome = summary?.total_income || 0;
  const netBalance = summary?.net_balance || 0;

  return (
    <div className="space-y-5 pb-28">
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={handlePrevMonth}
          aria-label="Bulan sebelumnya"
          className="p-2 rounded-full text-muted hover:text-ink hover:bg-paper-2 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-ink capitalize min-w-[10rem] text-center">
          {formatMonthTitle(currentMonth)}
        </span>
        <button
          onClick={handleNextMonth}
          aria-label="Bulan berikutnya"
          className="p-2 rounded-full text-muted hover:text-ink hover:bg-paper-2 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Monthly Summary */}
      <div className="paper-card rounded-3xl p-5">
        <span className="text-[13px] font-medium text-muted">Pengeluaran bulan ini</span>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-lg font-semibold text-muted">Rp</span>
          <span className="text-[2rem] leading-none font-extrabold text-ink tabular-nums">
            {totalExpense.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Income & Balance */}
        <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-line">
          <div className="p-3 rounded-2xl bg-sage-soft">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sage-deep">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Pemasukan</span>
            </div>
            <div className="text-sm font-bold text-ink mt-1 tabular-nums">
              {formatRupiah(totalIncome)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-paper-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Selisih</span>
            </div>
            <div
              className={`text-sm font-bold mt-1 tabular-nums ${
                netBalance >= 0 ? 'text-sage-deep' : 'text-clay-deep'
              }`}
            >
              {netBalance < 0 ? '-' : ''}{formatRupiah(Math.abs(netBalance))}
            </div>
          </div>
        </div>

        {/* Top Categories */}
        {summary && summary.top_expense_categories.length > 0 && (
          <div className="mt-4 pt-3 border-t border-line">
            <span className="text-xs font-medium text-muted block mb-2">Kategori terbesar</span>
            <div className="flex flex-wrap gap-1.5">
              {summary.top_expense_categories.slice(0, 3).map((cat) => (
                <span
                  key={cat.category}
                  className="inline-flex items-center gap-1.5 text-xs bg-paper border border-line px-2.5 py-1 rounded-full text-ink-soft"
                >
                  {cat.category}
                  <span className="text-muted tabular-nums">Rp{cat.total.toLocaleString('id-ID')}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onQuickIncome}
          className="flex items-center justify-center gap-2 py-3.5 px-4 bg-sage-soft border border-sage/25 rounded-2xl text-sage-deep font-bold text-[13px] active:scale-95 transition-all"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Catat pemasukan</span>
        </button>

        <button
          onClick={onQuickExpense}
          className="flex items-center justify-center gap-2 py-3.5 px-4 bg-clay-soft border border-clay/25 rounded-2xl text-clay-deep font-bold text-[13px] active:scale-95 transition-all"
        >
          <TrendingDown className="w-4 h-4" />
          <span>Catat pengeluaran</span>
        </button>
      </div>

      {/* Voice Card */}
      <div className="paper-card rounded-3xl px-6 pt-8 pb-6 relative overflow-hidden flex flex-col items-center text-center">
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sage-soft/70 to-transparent pointer-events-none" />

        {/* Mic Button */}
        <div className="relative">
          {recorderStatus === 'RECORDING' && (
            <span className="absolute -inset-3 rounded-full bg-clay/25 pulse-soft pointer-events-none" />
          )}

          <button
            onClick={onMicClick}
            disabled={recorderStatus === 'PROCESSING'}
            aria-label="Rekam suara"
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 ${
              recorderStatus === 'RECORDING'
                ? 'bg-clay text-white shadow-[0_14px_30px_-12px_rgba(185,90,60,0.9)]'
                : recorderStatus === 'PROCESSING'
                ? 'bg-paper-2 border border-line text-muted cursor-wait'
                : 'bg-sage text-white shadow-[0_14px_30px_-12px_rgba(94,124,88,0.9)] hover:bg-sage-deep'
            }`}
          >
            {recorderStatus === 'RECORDING' ? (
              <Square className="w-7 h-7 fill-current" />
            ) : recorderStatus === 'PROCESSING' ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="mt-5 relative z-10">
          {recorderStatus === 'RECORDING' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5 h-7">
                <span className="w-1.5 bg-clay rounded-full soundwave-bar-1" />
                <span className="w-1.5 bg-clay rounded-full soundwave-bar-2" />
                <span className="w-1.5 bg-clay rounded-full soundwave-bar-3" />
                <span className="w-1.5 bg-clay rounded-full soundwave-bar-4" />
                <span className="w-1.5 bg-clay rounded-full soundwave-bar-5" />
              </div>
              <div className="text-[13px] font-semibold text-clay-deep">
                Mendengarkan… ketuk lagi untuk berhenti
              </div>
            </div>
          ) : recorderStatus === 'PROCESSING' ? (
            <div className="text-[13px] font-semibold text-muted">Membaca catatanmu…</div>
          ) : (
            <div>
              <div className="text-[15px] font-bold text-ink">Ketuk untuk mulai bicara</div>
              <p className="text-xs text-muted mt-1">
                Contoh: “makan nasi padang dua puluh lima ribu”
              </p>
            </div>
          )}
        </div>

        {recorderError && (
          <div className="mt-3 text-xs font-medium text-clay-deep bg-clay-soft px-3 py-1.5 rounded-xl relative z-10">
            {recorderError}
          </div>
        )}

        {/* Quick Text & Screenshot */}
        <div className="mt-6 pt-4 border-t border-line w-full relative z-10">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onQuickTextClick}
              className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-ink-soft bg-paper hover:bg-paper-2 border border-line active:scale-95 transition-all"
            >
              <Keyboard className="w-4 h-4 text-muted" />
              <span>Ketik saja</span>
            </button>
            <button
              onClick={onImageClick}
              disabled={isParsingImage}
              className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-ink-soft bg-paper hover:bg-paper-2 border border-line active:scale-95 transition-all disabled:opacity-60"
            >
              {isParsingImage ? (
                <Loader2 className="w-4 h-4 text-muted animate-spin" />
              ) : (
                <Image className="w-4 h-4 text-muted" />
              )}
              <span>{isParsingImage ? 'Membaca…' : 'Tangkapan layar'}</span>
            </button>
          </div>

          {(isParsingImage || imageError) && (
            <p
              className={`mt-2.5 text-center text-xs font-semibold ${
                imageError ? 'text-clay-deep' : 'text-muted'
              }`}
            >
              {imageError ?? 'Membaca tangkapan layar…'}
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold text-ink px-1">Catatan terbaru</h3>

        {recentTransactions.length === 0 ? (
          <div className="paper-card rounded-2xl p-8 text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-paper-2 text-muted flex items-center justify-center mx-auto">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-ink">Belum ada catatan</div>
            <p className="text-[13px] text-muted">Mulai dari mikrofon di atas, atau tekan tombol catat.</p>
          </div>
        ) : (
          <div className="paper-card rounded-2xl divide-y divide-line overflow-hidden">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className="p-4 flex items-center justify-between hover:bg-paper transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'INCOME' ? 'bg-sage-soft text-sage-deep' : 'bg-clay-soft text-clay-deep'
                    }`}
                  >
                    {tx.type === 'INCOME' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">
                      {tx.description || tx.category}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <span className="truncate">{tx.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{formatDayMonth(tx.occurred_on)}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`text-sm font-bold tabular-nums shrink-0 pl-3 ${
                    tx.type === 'INCOME' ? 'text-sage-deep' : 'text-ink'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}{formatRupiah(tx.amount_idr)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
