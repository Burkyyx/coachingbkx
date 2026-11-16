import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** Adresse de retour après un e-mail (confirmation, mot de passe oublié) ou une connexion Google. */
export function authRedirectUrl(path = '/'): string {
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location.origin : env.webUrl;
    return `${origin}${path}`;
  }
  return Linking.createURL(path);
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Crée un compte. Renvoie `needsEmailConfirmation` si l'e-mail doit être confirmé. */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: authRedirectUrl('/') },
  });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: authRedirectUrl('/reset-password'),
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Connexion Google (web : redirection ; mobile : navigateur intégré). */
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl('/') },
    });
    if (error) throw error;
    return;
  }
  await nativeOAuth('google');
}

/** Connexion Apple (iPhone : fenêtre native Apple ; ailleurs : redirection). */
export async function signInWithApple() {
  if (Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Connexion Apple interrompue');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
    return;
  }
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: authRedirectUrl('/') },
    });
    if (error) throw error;
    return;
  }
  await nativeOAuth('apple');
}

async function nativeOAuth(provider: 'google' | 'apple') {
  const redirectTo = authRedirectUrl('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Connexion interrompue');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function checkInvitation(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_invitation', { p_code: code });
  if (error) throw error;
  return data === true;
}

export async function redeemInvitation(code: string) {
  const { data, error } = await supabase.rpc('redeem_invitation', { p_code: code });
  if (error) throw error;
  return data;
}
