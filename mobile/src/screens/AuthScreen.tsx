import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../net/supabase';
import { COLORS } from '../config';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const fn = mode === 'login'
        ? supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
        : supabase.auth.signUp({ email: email.trim(), password: pw });
      // Never hang forever on "..." — surface a timeout if the request stalls.
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Request timed out — check the connection.')), 20000),
      );
      const { error } = (await Promise.race([fn, timeout])) as Awaited<typeof fn>;
      if (error) setErr(error.message);
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.logo}>MARKET<Text style={{ color: COLORS.gold }}>VERSE</Text>X</Text>
      <Text style={styles.tag}>TRADE. INVEST. DOMINATE.</Text>

      <View style={styles.card}>
        <View style={styles.seg}>
          {(['login', 'signup'] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segOn]}>
              <Text style={[styles.segTxt, mode === m && styles.segTxtOn]}>{m === 'login' ? 'Log In' : 'Sign Up'}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={email} onChangeText={setEmail}
          placeholder="Email" placeholderTextColor={COLORS.dim}
          autoCapitalize="none" keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={pw} onChangeText={setPw}
          placeholder="Password" placeholderTextColor={COLORS.dim}
          secureTextEntry
          style={styles.input}
        />

        {err && <Text style={styles.err}>{err}</Text>}

        <Pressable style={[styles.submit, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
          <Text style={styles.submitTxt}>{busy ? '...' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  tag: { color: COLORS.dim, fontSize: 11, textAlign: 'center', letterSpacing: 2, marginTop: 4, marginBottom: 30 },
  card: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 18 },
  seg: { flexDirection: 'row', backgroundColor: COLORS.panelRaise, borderRadius: 10, padding: 4, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  segOn: { backgroundColor: COLORS.gold },
  segTxt: { color: COLORS.dim, fontWeight: '700', fontSize: 13 },
  segTxtOn: { color: '#0a0a14' },
  input: {
    color: '#fff', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.borderDim,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12,
  },
  err: { color: COLORS.red, fontSize: 12, marginBottom: 10 },
  submit: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitTxt: { color: '#0a0a14', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
});
