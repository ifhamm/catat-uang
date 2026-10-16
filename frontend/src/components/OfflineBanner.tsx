import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-honey-soft text-honey border-b border-line animate-fade-in">
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Sedang offline — catatan baru belum bisa disimpan.</span>
      </div>
    </div>
  );
};
