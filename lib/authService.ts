
import { supabase } from './supabase';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { Capacitor } from '@capacitor/core';

export const signInWithGoogle = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            // Login Nativo (Android/iOS)
            const googleUser = await GoogleAuth.signIn();

            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: googleUser.authentication.idToken,
            });

            if (error) throw error;
            return { data, error: null };
        } else {
            // Login Web (PWA)
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        select_account: 'true',
                        consent: 'true'
                    }
                },
            });

            if (error) throw error;
            return { data, error: null };
        }
    } catch (error: any) {
        console.error('Erro no login com Google:', error);
        return { data: null, error };
    }
};

export const signInWithApple = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            // Login Nativo (iOS)
            const result = await SignInWithApple.authorize({
                clientId: 'YOUR_APPLE_CLIENT_ID', // Replace with your Apple Service ID
                redirectURI: window.location.origin,
                scopes: 'email,name',
                state: '12345', // Optional, for CSRF protection
                nonce: 'nonce', // Optional, for replay attack protection
            });

            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'apple',
                token: result.response.identityToken!,
            });

            if (error) throw error;
            return { data, error: null };
        } else {
            // Login Web (PWA)
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
            return { data, error: null };
        }
    } catch (error: any) {
        console.error('Erro no login com Apple:', error);
        return { data: null, error };
    }
};
