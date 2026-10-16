import React, { useState } from 'react';
import { X, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { Transaction } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, transactions }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    try {
      setIsExporting(true);

      // Header
      const headers = ['ID', 'Tanggal', 'Jenis', 'Nominal (IDR)', 'Kategori', 'Keterangan', 'Sumber'];

      // Rows
      const rows = transactions.map((t) => [
        t.id,
        t.occurred_on,
        t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
        t.amount_idr,
        `"${t.category.replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.source
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `CatatUang_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/25 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="sheet w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-line p-6 animate-slide-up space-y-5 text-ink">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink tracking-tight">Ekspor catatan</h2>
            <p className="text-xs text-muted mt-0.5">Unduh riwayat transaksi ke format CSV</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-paper rounded-2xl px-4 py-1 text-[13px] divide-y divide-line">
          <div className="flex justify-between py-2.5">
            <span className="text-muted">Jumlah catatan</span>
            <span className="font-bold text-ink tabular-nums">{transactions.length} baris</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-muted">Format berkas</span>
            <span className="font-bold text-sage-deep">.CSV (UTF-8)</span>
          </div>
        </div>

        <p className="text-xs text-muted -mt-2">
          Bisa langsung dibuka di Excel, Google Sheets, atau aplikasi pembukuan lain.
        </p>

        <button
          onClick={handleDownloadCSV}
          disabled={isExporting || transactions.length === 0}
          className="w-full py-3.5 rounded-2xl bg-sage hover:bg-sage-deep active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_12px_24px_-14px_rgba(94,124,88,1)] disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <>
              <Check className="w-4 h-4" />
              <span>Berkas terunduh</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              <span>Unduh CSV</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
