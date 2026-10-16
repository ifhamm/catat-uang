import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'catat-uang-install-dismissed';

/**
 * Shows a quiet "add to home screen" hint once the browser signals that the
 * app can be installed. Does nothing on browsers that do not support it.
 */
export const InstallPrompt: React.FC = () => {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const handleInstallable = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleInstallable);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallable);
  }, []);

  if (!deferredEvent) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDeferredEvent(null);
  };

  const install = async () => {
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, '1');
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="max-w-md mx-auto px-4 pb-20 pointer-events-auto">
        <div className="paper-card rounded-3xl p-4 flex items-center gap-3 animate-slide-up">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-sage-soft text-sage-deep flex items-center justify-center">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink leading-tight">Pasang di layar utama</p>
            <p className="text-xs text-muted leading-tight mt-0.5">
              Buka lebih cepat, seperti aplikasi biasa.
            </p>
          </div>
          <button
            onClick={install}
            className="shrink-0 px-3.5 py-2 bg-sage hover:bg-sage-deep text-white text-xs font-bold rounded-xl transition-colors"
          >
            Pasang
          </button>
          <button
            onClick={dismiss}
            aria-label="Tutup saran pemasangan"
            className="w-8 h-8 shrink-0 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-ink transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
