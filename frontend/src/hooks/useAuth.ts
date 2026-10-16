import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masukmu dulu.';
  if (m.includes('user already registered')) return 'Email ini sudah terdaftar. Coba masuk.';
  if (m.includes('password should be at least')) return 'Kata sandi minimal 6 karakter.';
  if (m.includes('unable to validate email')) return 'Format email tidak dikenali.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Terlalu banyak percobaan. Coba lagi nanti.';
  return message;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    if (!data.session) {
      throw new Error('Akun dibuat. Cek email untuk konfirmasi sebelum masuk.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return { session, user: session?.user ?? null, isLoading, signIn, signUp, signOut };
}
