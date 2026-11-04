import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from './src/services/api';
import { CON_COLORS as C } from './src/theme/con-colors';
import { LoginScreen } from './src/con/LoginScreen';
import { AdminWebPanel } from './src/con/AdminWebPanel';
import { usePushNotifications } from './src/hooks/usePushNotifications';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState(null);

  // CON is an admin-only client; register its own device token against the admin role.
  usePushNotifications(session ? { ...session, role: 'admin' } : null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('sonaa_con_token');
        if (!token) return;
        const me = await api('/admin/me', { token });
        if (active) { setSession({ token, user: me, role: 'admin' }); setProfile(me); }
      } catch (_) {
        await SecureStore.deleteItemAsync('sonaa_con_token').catch(() => {});
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const login = async () => {
    if (!phone.trim() || !password) { setLoginError('اكتب رقم الهاتف وكلمة المرور.'); return; }
    setLoginBusy(true); setLoginError('');
    try {
      const result = await api('/admin/con-login', { method: 'POST', body: { phone: phone.trim(), password } });
      if (!result?.token || !result?.user) throw new Error('بيانات تسجيل الدخول غير مكتملة.');
      const me = await api('/admin/me', { token: result.token });
      await SecureStore.setItemAsync('sonaa_con_token', result.token);
      setProfile(me); setSession({ token: result.token, user: me, role: 'admin' }); setPassword('');
    } catch (e) { setLoginError(e.message || 'تعذر تسجيل الدخول.'); }
    finally { setLoginBusy(false); }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('sonaa_con_token').catch(() => {});
    setSession(null); setProfile(null); setPhone(''); setPassword('');
  };

  if (loading) return <SafeAreaView style={styles.loading}><StatusBar barStyle="dark-content" backgroundColor={C.background}/><ActivityIndicator size="large" color={C.accent}/><Text style={styles.loadingText}>جاري تجهيز صُنّاع CON...</Text></SafeAreaView>;
  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="dark-content" backgroundColor={C.background}/>
    {session ? <AdminWebPanel session={session} onLogout={logout}/> :
      <LoginScreen phone={phone} setPhone={setPhone} password={password} setPassword={setPassword} onLogin={login} busy={loginBusy} error={loginError}/>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: C.primary, fontSize: 14, fontWeight: '800' }
});