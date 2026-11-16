import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { todayLocal } from '@/core';
import { isNetworkError, toUserMessage } from '@/lib/errors';
import { kvStorage } from '@/lib/kvStorage';
import { queryClient } from '@/lib/queryClient';
import { supabase, type Tables } from '@/lib/supabase';

import { redeemInvitation } from './api';
import { ageOn, MINIMUM_AGE, missingRequiredConsents, type ConsentRow } from './consents';
import { usePendingInvitation } from './pendingInvitation';

export type Profile = Tables<'profiles'>;

/**
 * Étape où se trouve l'utilisateur :
 *  - signedOut : pas connecté
 *  - recovery : arrivé depuis le lien « mot de passe oublié »
 *  - needsInvitation : compte créé mais pas encore rattaché à une invitation
 *  - deactivated : accès désactivé par le coach
 *  - needsConsent / needsOnboarding / needsActivity : inscription à terminer
 *  - underage : moins de 15 ans
 *  - ready : accès à l'app
 */
export type AuthStatus =
  | 'loading'
  | 'error'
  | 'signedOut'
  | 'recovery'
  | 'needsInvitation'
  | 'deactivated'
  | 'needsConsent'
  | 'needsOnboarding'
  | 'needsActivity'
  | 'underage'
  | 'ready';

type Me = { profile: Profile | null; consents: ConsentRow[] };

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  consents: ConsentRow[];
  isCoach: boolean;
  /** Message d'erreur si le code d'invitation enregistré n'a pas pu être utilisé. */
  invitationError: string | null;
  refresh: () => Promise<void>;
  endRecovery: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const meKey = (userId: string | null) => ['me', userId] as const;

/** Charge le profil et les consentements ; garde une copie pour démarrer hors-ligne. */
async function fetchMe(userId: string): Promise<Me> {
  const cacheKey = `me:${userId}`;
  try {
    const [p, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('consents').select('type, version, revoked_at').eq('user_id', userId),
    ]);
    if (p.error) throw p.error;
    if (c.error) throw c.error;
    const me: Me = { profile: p.data, consents: c.data };
    await kvStorage.setItem(cacheKey, JSON.stringify(me));
    return me;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await kvStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as Me;
    }
    throw error;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') {
        setRecovery(false);
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const me = useQuery({
    queryKey: meKey(userId),
    queryFn: () => fetchMe(userId as string),
    enabled: userId !== null,
    staleTime: 60_000,
  });

  // Utilisation automatique du code d'invitation saisi avant la création du compte.
  const pendingCode = usePendingInvitation((s) => s.code);
  const setPendingCode = usePendingInvitation((s) => s.setCode);
  const triedCode = useRef<string | null>(null);
  const redeem = useMutation({
    mutationFn: (code: string) => redeemInvitation(code),
    onSuccess: async () => {
      setPendingCode(null);
      setInvitationError(null);
      await queryClient.invalidateQueries({ queryKey: meKey(userId) });
    },
    onError: (error) => {
      if (!isNetworkError(error)) setPendingCode(null);
      setInvitationError(toUserMessage(error));
    },
  });
  const needsRedeem = me.data !== undefined && me.data.profile === null && pendingCode !== null;
  useEffect(() => {
    if (needsRedeem && pendingCode && triedCode.current !== pendingCode && !redeem.isPending) {
      triedCode.current = pendingCode;
      redeem.mutate(pendingCode);
    }
  }, [needsRedeem, pendingCode, redeem]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: meKey(userId) });
  }, [userId]);

  const value = useMemo<AuthValue>(() => {
    const profile = me.data?.profile ?? null;
    const consents = me.data?.consents ?? [];
    let status: AuthStatus;
    if (!sessionLoaded) status = 'loading';
    else if (!session) status = 'signedOut';
    else if (recovery) status = 'recovery';
    else if (me.isPending || redeem.isPending || needsRedeem) status = 'loading';
    else if (me.isError) status = 'error';
    else if (!profile) status = 'needsInvitation';
    else if (!profile.is_active) status = 'deactivated';
    else if (profile.role === 'coach') status = 'ready';
    else if (missingRequiredConsents(consents).length > 0) status = 'needsConsent';
    else if (!profile.onboarded_at) status = 'needsOnboarding';
    else if (profile.birth_date && ageOn(profile.birth_date, todayLocal()) < MINIMUM_AGE)
      status = 'underage';
    else if (!profile.activity_level) status = 'needsActivity';
    else status = 'ready';

    return {
      status,
      session,
      userId,
      profile,
      consents,
      isCoach: profile?.role === 'coach',
      invitationError,
      refresh,
      endRecovery: () => setRecovery(false),
    };
  }, [
    me.data,
    me.isPending,
    me.isError,
    sessionLoaded,
    session,
    recovery,
    redeem.isPending,
    needsRedeem,
    userId,
    invitationError,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

/** Raccourci : identifiant de l'utilisateur connecté (erreur si non connecté). */
export function useUserId(): string {
  const { userId } = useAuth();
  if (!userId) throw new Error('Utilisateur non connecté');
  return userId;
}
