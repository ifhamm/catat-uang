import React from 'react';
import { Home, History, Download } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'HOME' | 'HISTORY';
  onChangeTab: (tab: 'HOME' | 'HISTORY') => void;
  onOpenExport?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, onOpenExport }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-line z-30">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-6">
        <button
          onClick={() => onChangeTab('HOME')}
          className={`flex flex-col items-center justify-center w-20 h-12 rounded-2xl transition-all relative ${
            activeTab === 'HOME' ? 'text-sage-deep font-bold' : 'text-muted hover:text-ink'
          }`}
        >
          {activeTab === 'HOME' && (
            <span className="absolute -top-0.5 w-5 h-1 bg-sage rounded-full" />
          )}
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[11px]">Beranda</span>
        </button>

        <button
          onClick={() => onChangeTab('HISTORY')}
          className={`flex flex-col items-center justify-center w-20 h-12 rounded-2xl transition-all relative ${
            activeTab === 'HISTORY' ? 'text-sage-deep font-bold' : 'text-muted hover:text-ink'
          }`}
        >
          {activeTab === 'HISTORY' && (
            <span className="absolute -top-0.5 w-5 h-1 bg-sage rounded-full" />
          )}
          <History className="w-5 h-5 mb-1" />
          <span className="text-[11px]">Riwayat</span>
        </button>

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="flex flex-col items-center justify-center w-20 h-12 rounded-2xl text-muted hover:text-ink transition-all active:scale-95"
            title="Ekspor CSV"
          >
            <Download className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Ekspor</span>
          </button>
        )}
      </div>
    </nav>
  );
};
