import React, { useEffect, useState } from 'react';
import { Undo2, CheckCircle2 } from 'lucide-react';

interface UndoToastProps {
  description: string;
  amountFormatted: string;
  onUndo: () => void;
  onExpire: () => void;
  durationSeconds?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  description,
  amountFormatted,
  onUndo,
  onExpire,
  durationSeconds = 8
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onExpire]);

  const percentage = (timeLeft / durationSeconds) * 100;

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto paper-card text-ink rounded-2xl p-4 z-50 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sage-soft text-sage-deep flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-ink flex items-center gap-1.5">
              <span>Tersimpan</span>
              <span className="text-sage-deep tabular-nums">{amountFormatted}</span>
            </div>
            <div className="text-xs text-muted truncate">{description || 'Tanpa keterangan'}</div>
          </div>
        </div>

        <button
          onClick={onUndo}
          className="flex items-center gap-1 px-3 py-1.5 bg-paper hover:bg-paper-2 border border-line active:scale-95 text-sage-deep text-xs font-bold rounded-xl transition-all shrink-0"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Urungkan ({timeLeft}s)</span>
        </button>
      </div>

      {/* Countdown */}
      <div className="w-full bg-paper-2 h-1 rounded-full mt-3 overflow-hidden">
        <div
          className="bg-sage h-full transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
