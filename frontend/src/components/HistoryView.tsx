import React, { useState } from 'react';
import { Transaction } from '../types';
import { TrendingDown, TrendingUp, Calendar, Trash2, Edit3, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupiah } from '../utils/format';

interface HistoryViewProps {
  transactions: Transaction[];
  currentMonth: string;
  onChangeMonth: (m: string) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => Promise<void>;
  onRestore?: (tx: Transaction) => Promise<void>;
  isLoading: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  transactions,
  currentMonth,
  onChangeMonth,
  onEdit,
  onDelete,
  isLoading
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = transactions.filter((tx) => {
    if (filterType === 'ALL') return true;
    return tx.type === filterType;
  });

  const groupedByDate: Record<string, Transaction[]> = {};
  filtered.forEach((tx) => {
    if (!groupedByDate[tx.occurred_on]) {
      groupedByDate[tx.occurred_on] = [];
    }
    groupedByDate[tx.occurred_on].push(tx);
  });

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

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

  const formatDateHeader = (dateStr: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Hari ini';
    if (dateStr === yesterday) return 'Kemarin';

    return new Date(
      ...dateStr.split('-').map(Number) as [number, number, number]
    ).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const sourceLabel: Record<string, string> = {
    voice: 'Suara',
    text: 'Tulisan',
    manual: 'Manual'
  };

  const handleDelete = async () => {
    if (!selectedTx) return;
    try {
      setIsDeleting(true);
      await onDelete(selectedTx);
      setSelectedTx(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Month Navigator */}
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

      {/* Filter Tabs */}
      <div className="flex bg-paper-2 p-1 rounded-2xl text-[13px] font-semibold">
        <button
          onClick={() => setFilterType('ALL')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            filterType === 'ALL' ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Semua
        </button>
        <button
          onClick={() => setFilterType('EXPENSE')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            filterType === 'EXPENSE' ? 'bg-card text-clay-deep shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Pengeluaran
        </button>
        <button
          onClick={() => setFilterType('INCOME')}
          className={`flex-1 py-2 rounded-xl transition-all ${
            filterType === 'INCOME' ? 'bg-card text-sage-deep shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          Pemasukan
        </button>
      </div>

      {/* Transactions Grouped By Date */}
      {isLoading ? (
        <div className="paper-card rounded-2xl p-10 text-center text-muted text-[13px]">
          Memuat catatan…
        </div>
      ) : dates.length === 0 ? (
        <div className="paper-card rounded-2xl p-10 text-center space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-muted mb-2" />
          <div className="text-sm font-semibold text-ink">Belum ada riwayat</div>
          <p className="text-[13px] text-muted">Tidak ada catatan untuk periode ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <div key={date} className="space-y-2">
              <div className="text-xs font-semibold text-muted px-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                <span>{formatDateHeader(date)}</span>
              </div>

              <div className="paper-card rounded-2xl divide-y divide-line overflow-hidden">
                {groupedByDate[date].map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
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
                        <div className="text-xs text-muted truncate mt-0.5">{tx.category}</div>
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
            </div>
          ))}
        </div>
      )}

      {/* Transaction Detail Dialog */}
      {selectedTx && (
        <div className="fixed inset-0 bg-ink/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="sheet w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-line p-6 animate-slide-up space-y-5 text-ink">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-[13px] font-bold text-ink">Detail catatan</span>
              <button
                onClick={() => setSelectedTx(null)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-1">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                  selectedTx.type === 'INCOME' ? 'bg-sage-soft text-sage-deep' : 'bg-clay-soft text-clay-deep'
                }`}
              >
                {selectedTx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
              </span>
              <div className="text-3xl font-extrabold text-ink tabular-nums tracking-tight">
                {formatRupiah(selectedTx.amount_idr)}
              </div>
              <div className="text-sm font-semibold text-ink-soft mt-1">
                {selectedTx.description || selectedTx.category}
              </div>
            </div>

            <div className="bg-paper rounded-2xl px-4 py-1 text-[13px] divide-y divide-line">
              <div className="flex justify-between py-2.5">
                <span className="text-muted">Kategori</span>
                <span className="font-semibold text-ink">{selectedTx.category}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted">Tanggal</span>
                <span className="font-semibold text-ink">{formatDateHeader(selectedTx.occurred_on)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted">Ditambahkan dari</span>
                <span className="font-semibold text-ink">{sourceLabel[selectedTx.source] || selectedTx.source}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="py-3 px-4 rounded-2xl bg-clay-soft border border-clay/25 text-clay-deep text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Menghapus…' : 'Hapus'}</span>
              </button>
              <button
                onClick={() => {
                  onEdit(selectedTx);
                  setSelectedTx(null);
                }}
                className="py-3 px-4 rounded-2xl bg-sage text-white text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-[0_10px_22px_-12px_rgba(94,124,88,0.9)] transition-all active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Ubah</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
