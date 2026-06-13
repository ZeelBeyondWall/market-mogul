import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Same Supabase project as the web client. AsyncStorage persists the session
// on device; no URL session detection (that's web-only).
// `lock: processLock` is REQUIRED on React Native — the default navigatorLock
// uses the Web Locks API (navigator.locks), which doesn't exist on a phone, so
// auth calls (signIn/signUp) hang forever waiting on a lock that never resolves.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
