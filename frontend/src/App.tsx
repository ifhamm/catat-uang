import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAuth } from './hooks/useAuth';
import { api, setUnauthorizedHandler } from './services/api';
import { isSupabaseConfigured } from './lib/supabase';
import { Transaction, MonthSummary, DraftTransaction, TransactionType } from './types';
import { HomeView } from './components/HomeView';
import { HistoryView } from './components/HistoryView';
import { BottomNav } from './components/BottomNav';
import { TransactionDraftModal } from './components/TransactionDraftModal';
import { QuickTextInputModal } from './components/QuickTextInputModal';
import { UndoToast } from './components/UndoToast';
import { LoginView } from './components/LoginView';
import { OfflineBanner } from './components/OfflineBanner';
import { InstallPrompt } from './components/InstallPrompt';

export function App() {
  const { session, user, isLoading: isAuthLoading, signIn, signUp, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'HOME' | 'HISTORY'>('HOME');
  const [currentMonth, setCurrentMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Data State
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Modals & Draft
  const [activeDraft, setActiveDraft] = useState<DraftTransaction | null>(null);
  const [isQuickTextOpen, setIsQuickTextOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Undo Toast state (8-second countdown)
  const [undoItem, setUndoItem] = useState<{
    id: string;
    description: string;
    amountFormatted: string;
  } | null>(null);

  // Voice recording hook (Tahap A)
  const { status, setStatus, errorMessage, startRecording, stopRecording } = useAudioRecorder();

  // Load Home Data (Summary & Recent)
  const loadHomeData = useCallback(async () => {
    try {
      const [sum, rec] = await Promise.all([
        api.getSummary(currentMonth),
        api.getRecentTransactions(),
      ]);
      setSummary(sum);
      setRecentTransactions(rec);
    } catch (err) {
      console.error('Failed to load home data:', err);
    }
  }, [currentMonth]);

  // Load History Data
  const loadHistoryData = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const list = await api.getTransactions({ month: currentMonth });
      setHistoryTransactions(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentMonth]);

  // Let the API layer sign the user out when the session expires.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Initial load & when month changes (only once signed in).
  useEffect(() => {
    if (!session) return;
    loadHomeData();
    if (activeTab === 'HISTORY') {
      loadHistoryData();
    }
  }, [session, currentMonth, activeTab, loadHomeData, loadHistoryData]);

  // Reset all cached data when the user signs out.
  useEffect(() => {
    if (session) return;
    setSummary(null);
    setRecentTransactions([]);
    setHistoryTransactions([]);
    setActiveDraft(null);
    setEditingTransaction(null);
    setUndoItem(null);
  }, [session]);

  // Voice Recording Toggle
  const handleRecordToggle = async () => {
    if (status === 'IDLE' || status === 'ERROR' || status === 'SUCCESS') {
      await startRecording();
    } else if (status === 'RECORDING') {
      try {
        const { blob } = await stopRecording();
        setStatus('PROCESSING');
        const voiceResult = await api.parseVoice(blob);

        setStatus('SUCCESS');

        // Populate Draft Modal from Voice Output
        setActiveDraft({
          type: 'EXPENSE',
          amount_idr: voiceResult.detectedNominal || null,
          category: 'Makan dan minum',
          occurred_on: new Date().toISOString().slice(0, 10),
          description: voiceResult.text || '',
          source: 'voice',
          notes: voiceResult.notes
        });
      } catch (err: any) {
        console.error('Voice processing error:', err);
        setStatus('ERROR');
      }
    }
  };

  // Save Transaction (from Draft Modal)
  const handleSaveDraft = async (data: {
    type: TransactionType;
    amount_idr: number;
    category: string;
    occurred_on: string;
    description: string;
    source: 'voice' | 'text' | 'manual';
    confirm_duplicate?: boolean;
  }) => {
    const opId = crypto.randomUUID();

    if (editingTransaction) {
      // Update existing
      await api.updateTransaction(editingTransaction.id, {
        expected_version: editingTransaction.version,
        type: data.type,
        amount_idr: data.amount_idr,
        category: data.category,
        occurred_on: data.occurred_on,
        description: data.description,
        operation_id: opId,
      });
      setEditingTransaction(null);
    } else {
      // Create new with Idempotency
      const result = await api.createTransaction({
        operation_id: opId,
        type: data.type,
        amount_idr: data.amount_idr,
        category: data.category,
        occurred_on: data.occurred_on,
        description: data.description,
        source: data.source,
        confirm_duplicate: data.confirm_duplicate,
      });

      // Trigger 8-Second Undo Toast (FR05)
      setUndoItem({
        id: result.transaction.id,
        description: result.transaction.description || result.transaction.category,
        amountFormatted: `Rp ${result.transaction.amount_idr.toLocaleString('id-ID')}`,
      });
    }

    // Refresh Data
    await loadHomeData();
    if (activeTab === 'HISTORY') {
      await loadHistoryData();
    }
  };

  // Undo Commit
  const handleUndo = async () => {
    if (!undoItem) return;
    try {
      await api.deleteTransaction(undoItem.id);
      setUndoItem(null);
      await loadHomeData();
      if (activeTab === 'HISTORY') {
        await loadHistoryData();
      }
    } catch (err) {
      console.error('Failed to undo transaction:', err);
    }
  };

  // Edit Existing Transaction
  const handleStartEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setActiveDraft({
      type: tx.type,
      amount_idr: tx.amount_idr,
      category: tx.category,
      occurred_on: tx.occurred_on,
      description: tx.description || '',
      source: tx.source,
    });
  };

  // Delete Transaction
  const handleDeleteTransaction = async (tx: Transaction) => {
    await api.deleteTransaction(tx.id);
    await loadHomeData();
    await loadHistoryData();
  };

  // Direct Quick Manual Actions (Income / Expense)
  const handleQuickIncome = () => {
    setActiveDraft({
      type: 'INCOME',
      amount_idr: null,
      category: 'Gaji',
      occurred_on: new Date().toISOString().slice(0, 10),
      description: '',
      source: 'manual',
    });
  };

  const handleQuickExpense = () => {
    setActiveDraft({
      type: 'EXPENSE',
      amount_idr: null,
      category: 'Makan dan minum',
      occurred_on: new Date().toISOString().slice(0, 10),
      description: '',
      source: 'manual',
    });
  };

  if (!isSupabaseConfigured) {
    return <ConfigMissingView />;
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sage animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginView onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans antialiased selection:bg-sage-soft selection:text-sage-deep">
      <OfflineBanner />
      <div className="max-w-md mx-auto min-h-screen flex flex-col px-4 pt-6">
        {/* App Bar Header */}
        <header className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-2xl bg-sage-soft text-sage-deep flex items-center justify-center font-extrabold text-sm">
            CU
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-extrabold text-ink tracking-tight leading-tight">Catat Uang</h1>
            <p className="text-xs text-muted leading-tight truncate">
              {user?.email ?? 'Catatan keuangan harian'}
            </p>
          </div>
          <button
            onClick={() => void signOut()}
            aria-label="Keluar"
            title="Keluar"
            className="w-9 h-9 rounded-full bg-paper-2 hover:bg-line flex items-center justify-center text-muted hover:text-clay-deep transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* View Switcher */}
        <main className="flex-1">
          {activeTab === 'HOME' ? (
            <HomeView
              summary={summary}
              recentTransactions={recentTransactions}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              recorderStatus={status}
              recorderError={errorMessage}
              onMicClick={handleRecordToggle}
              onQuickTextClick={() => setIsQuickTextOpen(true)}
              onQuickIncome={handleQuickIncome}
              onQuickExpense={handleQuickExpense}
              onSelectTransaction={handleStartEdit}
            />
          ) : (
            <HistoryView
              transactions={historyTransactions}
              currentMonth={currentMonth}
              onChangeMonth={setCurrentMonth}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTransaction}
              isLoading={isLoadingHistory}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Quick Text Input Modal ("Ketik Saja") */}
        <QuickTextInputModal
          isOpen={isQuickTextOpen}
          onClose={() => setIsQuickTextOpen(false)}
          onParsed={(draft) => setActiveDraft(draft)}
        />

        {/* Transaction Preview / Edit Modal */}
        {activeDraft && (
          <TransactionDraftModal
            draft={activeDraft}
            isOpen={true}
            onClose={() => {
              setActiveDraft(null);
              setEditingTransaction(null);
            }}
            onSave={handleSaveDraft}
          />
        )}

        {/* 8-Second Undo Toast */}
        {undoItem && (
          <UndoToast
            description={undoItem.description}
            amountFormatted={undoItem.amountFormatted}
            onUndo={handleUndo}
            onExpire={() => setUndoItem(null)}
            durationSeconds={8}
          />
        )}

        {/* "Install app" hint (only where the browser supports it) */}
        <InstallPrompt />
      </div>
    </div>
  );
}

const ConfigMissingView: React.FC = () => (
  <div className="min-h-screen bg-paper text-ink font-sans flex items-center justify-center px-5 py-10">
    <div className="paper-card rounded-3xl p-6 max-w-sm text-center">
      <div className="w-12 h-12 rounded-2xl bg-honey-soft text-honey flex items-center justify-center font-extrabold mx-auto mb-3">
        CU
      </div>
      <h1 className="text-base font-extrabold tracking-tight">Aplikasi belum siap</h1>
      <p className="text-sm text-muted mt-1.5">
        Kunci akses Supabase belum diatur. Hubungi pemilik aplikasi untuk melengkapi konfigurasi.
      </p>
    </div>
  </div>
);

export default App;
