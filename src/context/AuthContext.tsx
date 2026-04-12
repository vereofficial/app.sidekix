import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearChallengeDropDismissed } from '../lib/challengeDropStorage';
import { insertProfileWithGeneratedUsername } from '../lib/ensureProfileInsert';
import { tryGetSupabase } from '../lib/supabase';
import { getSupabasePublicConfig, isSupabaseConfigured } from '../lib/supabaseConfig';
import { formatAuthError } from '../lib/formatAuthError';
import type { ProfileRow } from '../types/database';

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  authLoading: boolean;
  profileLoading: boolean;
  signInWithPhone: (e164Phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (e164Phone: string, token: string) => Promise<{ error: string | null; profile: ProfileRow | null }>;
  saveProfile: (username: string, emoji?: string, avatarPath?: string | null) => Promise<{ error: string | null }>;
  /** Email + password via Supabase Auth (enable Email provider in dashboard). */
  signInWithEmailPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Calls Supabase Edge Function `delete-account` (deploy required). */
  deleteAccount: () => Promise<{ error: string | null }>;
  /** Requires `profiles.friends_only` column + RLS migration `010_friends_only_mode`. */
  setFriendsOnly: (friendsOnly: boolean) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<ProfileRow | null>;
};

const C = createContext<AuthCtx | null>(null);
const DEV_BYPASS_OTP = '123456';

function makeDevSession(e164Phone: string): Session {
  const nowSec = Math.floor(Date.now() / 1000);
  const devUser = {
    id: `dev-${e164Phone.replace(/\D/g, '') || 'user'}`,
    aud: 'authenticated',
    role: 'authenticated',
    phone: e164Phone,
    app_metadata: { provider: 'phone' },
    user_metadata: { devBypass: true },
    identities: [],
    created_at: new Date().toISOString(),
  };
  return {
    access_token: 'dev-access-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: nowSec + 60 * 60 * 24 * 365,
    refresh_token: 'dev-refresh-token',
    user: devUser as User,
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = useCallback(async (): Promise<ProfileRow | null> => {
    const sb = tryGetSupabase();
    const uid = session?.user?.id;
    if (!sb || !uid) {
      setProfile(null);
      return null;
    }
    setProfileLoading(true);
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    let row = !error && data ? (data as ProfileRow) : null;

    if (!row && !error && !uid.startsWith('dev-')) {
      const rpc = await sb.rpc('ensure_my_profile');
      if (!rpc.error && rpc.data) {
        const d = rpc.data as ProfileRow | ProfileRow[];
        row = Array.isArray(d) ? d[0] : d;
      }
    }
    if (!row && !uid.startsWith('dev-')) {
      const inserted = await insertProfileWithGeneratedUsername(sb, uid);
      if (inserted) row = inserted;
    }
    if (!row && !uid.startsWith('dev-')) {
      const { data: again } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (again) row = again as ProfileRow;
    }

    setProfile(row);
    setProfileLoading(false);
    return row;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      setAuthLoading(false);
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    sb.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s);
        setAuthLoading(false);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void clearChallengeDropDismissed();
      }
      setSession(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [session?.user?.id, refreshProfile]);

  const signInWithPhone = useCallback(async (e164Phone: string) => {
    if (__DEV__) return { error: null };
    const sb = tryGetSupabase();
    if (!sb) return { error: 'Not configured' };
    const { error } = await sb.auth.signInWithOtp({ phone: e164Phone.trim() });
    return { error: formatAuthError(error?.message) };
  }, []);

  const verifyPhoneOtp = useCallback(async (e164Phone: string, token: string) => {
    if (__DEV__) {
      if (token.trim() !== DEV_BYPASS_OTP) {
        return { error: 'Use 123456 as the dev OTP code.', profile: null };
      }
      await clearChallengeDropDismissed();
      const devSession = makeDevSession(e164Phone.trim());
      setSession(devSession);
      setProfile(null);
      return { error: null, profile: null };
    }
    const sb = tryGetSupabase();
    if (!sb) return { error: 'Not configured', profile: null };
    const { data, error } = await sb.auth.verifyOtp({
      phone: e164Phone.trim(),
      token: token.trim(),
      type: 'sms',
    });
    if (error) return { error: formatAuthError(error.message) ?? error.message, profile: null };
    if (data.session) {
      setSession(data.session);
      const uid = data.session.user.id;
      const { data: prof } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
      let row = prof ? (prof as ProfileRow) : null;
      if (!row) {
        const rpc = await sb.rpc('ensure_my_profile');
        if (!rpc.error && rpc.data) {
          const d = rpc.data as ProfileRow | ProfileRow[];
          row = Array.isArray(d) ? d[0] : d;
        }
      }
      setProfile(row);
      setProfileLoading(false);
      return { error: null, profile: row };
    }
    return { error: null, profile: null };
  }, []);

  const saveProfile = useCallback(
    async (username: string, emoji = '🌵', avatarPath?: string | null) => {
      const sb = tryGetSupabase();
      const uid = session?.user?.id;
      if (!uid) return { error: 'Not signed in' };
      if (__DEV__ && uid.startsWith('dev-')) {
        setProfile((prev) => ({
          id: uid,
          username: username.trim().toLowerCase().replace(/^@/, ''),
          display_emoji: emoji,
          avatar_path: avatarPath ?? null,
          friends_only: prev?.friends_only ?? false,
          created_at: prev?.created_at ?? new Date().toISOString(),
        }));
        return { error: null };
      }
      if (!sb) return { error: 'Not configured' };
      const { error } = await sb.from('profiles').upsert(
        {
          id: uid,
          username: username.trim().toLowerCase().replace(/^@/, ''),
          display_emoji: emoji,
          avatar_path: avatarPath ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (error) return { error: error.message };
      await refreshProfile();
      return { error: null };
    },
    [session?.user?.id, refreshProfile],
  );

  const signInWithEmailPassword = useCallback(async (email: string, password: string) => {
    const sb = tryGetSupabase();
    if (!sb) return { error: 'Not configured' };
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? formatAuthError(error.message) ?? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = tryGetSupabase();
    if (sb) await sb.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const setFriendsOnly = useCallback(
    async (friendsOnly: boolean) => {
      const uid = session?.user?.id;
      if (!uid) return { error: 'Not signed in' };
      if (__DEV__ && uid.startsWith('dev-')) {
        setProfile((prev) =>
          prev
            ? { ...prev, friends_only: friendsOnly }
            : {
                id: uid,
                username: 'dev_user',
                display_emoji: '🌵',
                avatar_path: null,
                friends_only: friendsOnly,
                created_at: new Date().toISOString(),
              },
        );
        return { error: null };
      }
      const sb = tryGetSupabase();
      if (!sb) return { error: 'Not configured' };
      const { error } = await sb
        .from('profiles')
        .update({ friends_only: friendsOnly, updated_at: new Date().toISOString() })
        .eq('id', uid);
      if (error) return { error: error.message };
      await refreshProfile();
      return { error: null };
    },
    [session?.user?.id, refreshProfile],
  );

  const deleteAccount = useCallback(async () => {
    if (!isSupabaseConfigured()) return { error: 'Not configured' };
    const sb = tryGetSupabase();
    if (!sb) return { error: 'Not configured' };
    const { data: sessWrap } = await sb.auth.getSession();
    const token = sessWrap.session?.access_token;
    if (!token) return { error: 'Not signed in' };
    let url: string;
    let anonKey: string;
    try {
      ({ url, anonKey } = getSupabasePublicConfig());
    } catch {
      return { error: 'Not configured' };
    }
    const fnUrl = `${url.replace(/\/$/, '')}/functions/v1/delete-account`;
    let res: Response;
    try {
      res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Network error' };
    }
    let body: { error?: string } = {};
    try {
      body = (await res.json()) as { error?: string };
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      return {
        error:
          typeof body.error === 'string'
            ? body.error
            : res.status === 404
              ? 'Account deletion is not set up yet (deploy the delete-account Edge Function in Supabase).'
              : 'Could not delete account',
      };
    }
    await sb.auth.signOut();
    setSession(null);
    setProfile(null);
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      authLoading,
      profileLoading,
      signInWithPhone,
      verifyPhoneOtp,
      saveProfile,
      signInWithEmailPassword,
      signOut,
      deleteAccount,
      setFriendsOnly,
      refreshProfile,
    }),
    [
      session,
      profile,
      authLoading,
      profileLoading,
      signInWithPhone,
      verifyPhoneOtp,
      saveProfile,
      signInWithEmailPassword,
      signOut,
      deleteAccount,
      setFriendsOnly,
      refreshProfile,
    ],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAuth() {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
