import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearChallengeDropDismissed } from '../lib/challengeDropStorage';
import { insertProfileWithGeneratedUsername } from '../lib/ensureProfileInsert';
import { tryGetSupabase } from '../lib/supabase';
import { getSupabasePublicConfig, isSupabaseConfigured } from '../lib/supabaseConfig';
import { formatAuthError } from '../lib/formatAuthError';
import { getOAuthRedirectUrl } from '../lib/oauthRedirect';
import { isAdminEmail } from '../lib/admin';
import type { ProfileRow } from '../types/database';

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  authLoading: boolean;
  profileLoading: boolean;
  isAdmin: boolean;
  signInWithPhone: (e164Phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (e164Phone: string, token: string) => Promise<{ error: string | null; profile: ProfileRow | null }>;
  saveProfile: (username: string, emoji?: string, avatarPath?: string | null) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Calls Supabase Edge Function `delete-account` (deploy required). */
  deleteAccount: () => Promise<{ error: string | null }>;
  /** Requires `profiles.friends_only` column + RLS migration `010_friends_only_mode`. */
  setFriendsOnly: (friendsOnly: boolean) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<ProfileRow | null>;
};

const C = createContext<AuthCtx | null>(null);
const DEV_BYPASS_OTP = '123456';
WebBrowser.maybeCompleteAuthSession();

/** Stale AsyncStorage session (revoked server-side, rotated project, etc.) — clear local tokens without spamming errors. */
function shouldClearStoredSession(err: { message?: string; code?: string }): boolean {
  const m = err.message ?? '';
  const c = err.code ?? '';
  return (
    c === 'refresh_token_not_found' ||
    m.includes('Invalid Refresh Token') ||
    m.includes('Refresh Token Not Found')
  );
}

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

    void (async () => {
      try {
        const { data: sessWrap, error: sessErr } = await sb.auth.getSession();
        if (cancelled) return;
        if (sessErr && shouldClearStoredSession(sessErr)) {
          await sb.auth.signOut({ scope: 'local' });
          setSession(null);
          setAuthLoading(false);
          return;
        }
        setSession(sessWrap.session);
        setAuthLoading(false);
      } catch {
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        if (!cancelled) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    })();

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

  const signInWithOAuthProvider = useCallback(async (provider: 'google' | 'apple') => {
    const sb = tryGetSupabase();
    if (!sb) return { error: 'Not configured' };
    const waitForSession = async (): Promise<Session | null> => {
      for (let i = 0; i < 24; i += 1) {
        const { data } = await sb.auth.getSession();
        if (data.session) return data.session;
        await new Promise((r) => setTimeout(r, 150));
      }
      return null;
    };

    const redirectTo = getOAuthRedirectUrl();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      return { error: formatAuthError(error?.message) ?? error?.message ?? `Could not start ${provider} sign in.` };
    }

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success' || !res.url) {
      const sess = await waitForSession();
      if (sess) {
        setSession(sess);
        return { error: null };
      }
      return { error: res.type === 'cancel' ? null : `${provider} sign in was not completed.` };
    }
    if (res.url.includes('joinsidekix.com')) {
      const sess = await waitForSession();
      if (sess) {
        setSession(sess);
        return { error: null };
      }
      return {
        error:
          'OAuth redirected to joinsidekix.com instead of the app. Add app callback URLs in Supabase Auth URL config and Google/Apple provider redirect allowlists.',
      };
    }

    try {
      const url = new URL(res.url);
      const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const hashParams = new URLSearchParams(hash);
      const oauthErr = url.searchParams.get('error') ?? hashParams.get('error');
      const oauthErrDesc = url.searchParams.get('error_description') ?? hashParams.get('error_description');
      if (oauthErr || oauthErrDesc) {
        const msg = oauthErrDesc ?? oauthErr ?? 'OAuth error';
        return { error: formatAuthError(msg) ?? msg };
      }
      const code = url.searchParams.get('code') ?? hashParams.get('code');
      const accessToken = url.searchParams.get('access_token') ?? hashParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token') ?? hashParams.get('refresh_token');

      /** Implicit flow: prefer tokens in fragment (no PKCE verifier needed on device). */
      if (accessToken && refreshToken) {
        const { error: setErr } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (setErr) return { error: formatAuthError(setErr.message) ?? setErr.message };
        const sess = await waitForSession();
        if (sess) {
          setSession(sess);
        } else {
          const { data: snap } = await sb.auth.getSession();
          if (snap.session) setSession(snap.session);
        }
        return { error: null };
      }
      if (code) {
        const { error: exErr } = await sb.auth.exchangeCodeForSession(code);
        if (exErr) return { error: formatAuthError(exErr.message) ?? exErr.message };
        const sess = await waitForSession();
        if (sess) {
          setSession(sess);
        } else {
          const { data: snap } = await sb.auth.getSession();
          if (snap.session) setSession(snap.session);
        }
        return { error: null };
      }
      const sess = await waitForSession();
      if (sess) {
        setSession(sess);
        return { error: null };
      }
      return { error: `${provider} sign in did not return a session.` };
    } catch {
      return { error: `Could not finish ${provider} sign in.` };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => signInWithOAuthProvider('google'), [signInWithOAuthProvider]);
  const signInWithApple = useCallback(async () => signInWithOAuthProvider('apple'), [signInWithOAuthProvider]);

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
    await sb.auth.refreshSession().catch(() => {});
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

    /** Raw fetch: `functions.invoke` + RN sometimes merge headers in ways the gateway logs as empty `apikey`. */
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

    if (!res.ok) {
      let body: { error?: string; detail?: string } = {};
      try {
        body = (await res.json()) as { error?: string; detail?: string };
      } catch {
        /* ignore */
      }
      if (res.status === 404) {
        return {
          error:
            'Account deletion is not set up yet (deploy the delete-account Edge Function in Supabase).',
        };
      }
      const baseMsg =
        typeof body.error === 'string'
          ? body.error
          : 'Could not delete account';
      const detail = typeof body.detail === 'string' ? body.detail : '';
      return {
        error: detail ? `${baseMsg} (${detail.slice(0, 200)})` : baseMsg,
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
      isAdmin: isAdminEmail(session?.user?.email),
      signInWithPhone,
      verifyPhoneOtp,
      saveProfile,
      signInWithGoogle,
      signInWithApple,
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
      session?.user?.email,
      signInWithPhone,
      verifyPhoneOtp,
      saveProfile,
      signInWithGoogle,
      signInWithApple,
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
