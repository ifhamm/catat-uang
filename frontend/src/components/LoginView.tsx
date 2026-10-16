import React, { useState } from 'react';
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSignIn, onSignUp }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === 'REGISTER';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }
    if (isRegister && password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi belum sama.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      if (isRegister) {
        await onSignUp(trimmedEmail, password);
      } else {
        await onSignIn(trimmedEmail, password);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'LOGIN' : 'REGISTER');
    setErrorMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-3xl bg-sage-soft text-sage-deep flex items-center justify-center font-extrabold text-lg mb-3">
            CU
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Catat Uang</h1>
          <p className="text-sm text-muted mt-1">
            {isRegister
              ? 'Buat akun agar catatanmu tersimpan aman.'
              : 'Masuk untuk lanjut mencatat keuanganmu.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="paper-card rounded-3xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-semibold text-ink-soft">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-3.5 py-3 bg-paper border border-line rounded-2xl text-sm text-ink placeholder-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-ink-soft">
              Kata sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-3.5 py-3 bg-paper border border-line rounded-2xl text-sm text-ink placeholder-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15 transition-all"
              />
            </div>
          </div>

          {isRegister && (
            <div className="space-y-1.5 animate-fade-in">
              <label htmlFor="confirm" className="block text-xs font-semibold text-ink-soft">
                Ulangi kata sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full pl-10 pr-3.5 py-3 bg-paper border border-line rounded-2xl text-sm text-ink placeholder-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/15 transition-all"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs font-medium text-clay-deep bg-clay-soft p-2.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-sage hover:bg-sage-deep active:scale-95 disabled:opacity-60 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_12px_24px_-14px_rgba(94,124,88,1)]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isRegister ? 'Buat akun' : 'Masuk'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={switchMode}
              className="text-xs text-ink-soft font-semibold hover:text-sage-deep transition-colors"
            >
              {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar dulu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
