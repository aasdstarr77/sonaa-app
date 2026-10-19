import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  Alert, SafeAreaView
} from 'react-native';

const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
const COLORS = { navy: '#0F172A', teal: '#14B8A6', bg: '#F8FAFC', text: '#1E293B', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', red: '#B91C1C' };

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `خطأ من الخادم (${response.status})`);
  return data;
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [adminTab, setAdminTab] = useState('orders');
  const [adminData, setAdminData] = useState({ orders: [], fannis: [], clients: [] });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadServices() {
      setServicesLoading(true);
      setServicesError('');
      try {
        const data = await api('/services');
        if (!Array.isArray(data.categories)) throw new Error('استجابة الخدمات من الخادم غير صحيحة');
        if (!mounted) return;
        setCategories(data.categories);
        setSelected(current => current && data.categories.some(item => item.label === current.label)
          ? data.categories.find(item => item.label === current.label)
          : (data.categories[0] || null));
      } catch (err) {
        if (mounted) { setCategories([]); setSelected(null); setServicesError(err.message || 'تعذر الاتصال بالخادم'); }
      } finally { if (mounted) setServicesLoading(false); }
    }
    loadServices();
    return () => { mounted = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!session || session.role !== 'admin' || screen !== 'admin') return;
    let mounted = true;
    async function loadAdminData() {
      setAdminLoading(true);
      setAdminError('');
      try {
        const [ordersResult, fannisResult, clientsResult] = await Promise.all([
          api('/admin/orders?limit=100', { token: session.token }),
          api('/admin/fannis?limit=100', { token: session.token }),
          api('/admin/clients?limit=100', { token: session.token }),
        ]);
        if (!mounted) return;
        setAdminData({
          orders: Array.isArray(ordersResult.orders) ? ordersResult.orders : (Array.isArray(ordersResult.data) ? ordersResult.data : []),
          fannis: Array.isArray(fannisResult.fannis) ? fannisResult.fannis : (Array.isArray(fannisResult.data) ? fannisResult.data : []),
          clients: Array.isArray(clientsResult.clients) ? clientsResult.clients : (Array.isArray(clientsResult.data) ? clientsResult.data : []),
        });
      } catch (err) {
        if (mounted) setAdminError(err.message || 'تعذر تحميل بيانات الإدارة');
      } finally { if (mounted) setAdminLoading(false); }
    }
    loadAdminData();
    return () => { mounted = false; };
  }, [session, screen, adminTab]);

  async function handleLogin() {
    const raw = username.trim();
    if (!raw || !password) { Alert.alert('بيانات ناقصة', 'اكتب اسم المستخدم أو الإيميل أو رقم الهاتف، ثم كلمة السر.'); return; }
    const isAdmin = raw.startsWith('#');
    const identifier = isAdmin ? raw.slice(1).trim() : raw;
    if (!identifier) { Alert.alert('بيانات ناقصة', 'اكتب الإيميل أو رقم الهاتف بعد علامة #.'); return; }
    setLoginLoading(true);
    try {
      let result;
      if (isAdmin) {
        const identity = identifier.includes('@') ? { email: identifier } : { phone: identifier };
        result = await api('/admin/login', { method: 'POST', body: { ...identity, password } });
        if (!result.token || !result.user || !['admin', 'مشرف', 'مشرف أول', 'مدير', 'قراءة فقط'].includes(result.user.role) && !result.user.adminRole) {
          throw new Error('استجابة تسجيل دخول الإدارة غير مكتملة أو الحساب ليس حساب إدارة.');
        }
        setSession({ token: result.token, user: result.user, role: 'admin' });
        setAdminTab('orders');
        setScreen('admin');
      } else {
        result = await api('/fanni/login', { method: 'POST', body: { phone: identifier, password } });
        if (!result.token || !result.user) throw new Error('استجابة تسجيل دخول الفني غير مكتملة.');
        setSession({ token: result.token, user: result.user, role: 'fanni' });
        setScreen('technician');
      }
      setPassword('');
    } catch (err) {
      Alert.alert('تعذر تسجيل الدخول', err.message || 'راجع البيانات وحاول مرة أخرى.');
    } finally { setLoginLoading(false); }
  }

  function logout() {
    setSession(null);
    setUsername('');
    setPassword('');
    setAdminData({ orders: [], fannis: [], clients: [] });
    setScreen('home');
  }

  const goLogin = () => { setUsername(''); setPassword(''); setScreen('login'); };

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.loginWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backLink}><Text style={styles.backText}>‹ رجوع للخدمات</Text></TouchableOpacity>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>ص</Text></View>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>دخول الفني أو الإدارة من نفس الشاشة</Text>
          <Text style={styles.fieldLabel}>الإيميل أو رقم التليفون</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="رقم الفني، أو # ثم إيميل/رقم الأدمن"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="default"
            textAlign="right"
            style={styles.input}
            accessibilityLabel="الإيميل أو رقم التليفون"
          />
          <Text style={styles.hint}>لدخول الإدارة: اكتب # في الأول، ثم إيميل الأدمن أو رقم تليفونه.</Text>
          <Text style={styles.fieldLabel}>كلمة السر</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="اكتب كلمة السر"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            textAlign="right"
            style={styles.input}
            accessibilityLabel="كلمة السر"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity disabled={loginLoading} onPress={handleLogin} style={[styles.primaryButton, loginLoading && styles.disabledButton]}>
            {loginLoading ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.primaryButtonText}>دخول</Text>}
          </TouchableOpacity>
          <Text style={styles.securityNote}>علامة # تحدد مسار الدخول فقط. السيرفر هو اللي يتحقق من الحساب والصلاحيات.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === 'admin' && session?.role === 'admin') {
    const tabItems = [
      { key: 'orders', label: 'الطلبات', count: adminData.orders.length },
      { key: 'fannis', label: 'الفنيون', count: adminData.fannis.length },
      { key: 'clients', label: 'العملاء', count: adminData.clients.length },
    ];
    const items = adminData[adminTab] || [];
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.adminHeader}>
          <View><Text style={styles.adminTitle}>لوحة إدارة صُنّاع</Text><Text style={styles.adminSub}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}><Text style={styles.logoutText}>خروج</Text></TouchableOpacity>
        </View>
        <View style={styles.tabRow}>
          {tabItems.map(item => <TouchableOpacity key={item.key} onPress={() => setAdminTab(item.key)} style={[styles.tab, adminTab === item.key && styles.tabActive]}><Text style={[styles.tabText, adminTab === item.key && styles.tabTextActive]}>{item.label} ({item.count})</Text></TouchableOpacity>)}
        </View>
        {adminLoading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الإدارة...</Text></View> : adminError ? (
          <View style={styles.center}><Text style={styles.errorTitle}>تعذر تحميل البيانات</Text><Text style={styles.errorText}>{adminError}</Text><TouchableOpacity onPress={() => setAdminTab(current => current)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>إعادة المحاولة</Text></TouchableOpacity></View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, index) => String(item._id || item.id || item.sn || item.phone || index)}
            contentContainerStyle={styles.adminList}
            ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات لعرضها حاليًا.</Text>}
            renderItem={({ item }) => {
              const title = adminTab === 'orders' ? (item.sn || item.orderCode || item.service || item.title || 'طلب خدمة')
                : adminTab === 'fannis' ? (item.name || 'فني')
                : (item.name || item.phone || 'عميل');
              const detail = adminTab === 'orders'
                ? [item.status, item.service, item.customerPhone || item.phone, item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : ''].filter(Boolean).join(' • ')
                : adminTab === 'fannis'
                  ? [item.phone, item.status || item.actualStatus, Array.isArray(item.specialties) ? item.specialties.join('، ') : item.skill].filter(Boolean).join(' • ')
                  : [item.phone, item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : ''].filter(Boolean).join(' • ');
              return <View style={styles.dataCard}><Text style={styles.dataTitle}>{title}</Text><Text style={styles.dataDetail}>{detail || 'لا توجد تفاصيل إضافية'}</Text></View>;
            }}
          />
        )}
        <Text style={styles.footerNote}>المعروض حاليًا: قوائم الطلبات والفنيين والعملاء. باقي أدوات الإدارة تُضاف وتُختبر على مراحل.</Text>
      </SafeAreaView>
    );
  }

  if (screen === 'technician' && session?.role === 'fanni') {
    const user = session.user || {};
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.techWrap}>
          <Text style={styles.title}>أهلًا يا {user.name || 'فني صُنّاع'}</Text>
          <Text style={styles.subtitle}>حالة الحساب: {user.status || 'قيد المراجعة'}</Text>
          <View style={styles.dataCard}><Text style={styles.dataTitle}>حساب الفني متصل بالباك إند</Text><Text style={styles.dataDetail}>رقم الهاتف: {user.phone || '—'}</Text><Text style={styles.dataDetail}>الخدمات: {Array.isArray(user.specialties) ? user.specialties.join('، ') : '—'}</Text></View>
          <Text style={styles.securityNote}>دي شاشة دخول أولية. هنكمل الطلبات والمحفظة بعد التأكد من ربط كل مسار API.</Text>
          <TouchableOpacity onPress={logout} style={styles.primaryButton}><Text style={styles.primaryButtonText}>تسجيل الخروج</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.homeHeader}>
        <View><Text style={styles.title}>صُنّاع</Text><Text style={styles.subtitle}>خدماتك اليومية في مكان واحد</Text></View>
        <TouchableOpacity onPress={goLogin} style={styles.loginButton}><Text style={styles.loginButtonText}>دخول الفني</Text></TouchableOpacity>
      </View>
      {servicesLoading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل الخدمات...</Text></View> : servicesError ? (
        <View style={styles.center}><Text style={styles.errorTitle}>مش قادرين نوصل للخدمات</Text><Text style={styles.errorText}>{servicesError}</Text><TouchableOpacity onPress={() => setReloadKey(key => key + 1)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>إعادة المحاولة</Text></TouchableOpacity></View>
      ) : (
        <>
          <FlatList
            data={categories}
            numColumns={2}
            keyExtractor={item => String(item.label)}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const active = selected?.label === item.label;
              return <TouchableOpacity onPress={() => setSelected(item)} style={[styles.card, active && styles.cardActive]}><Text style={styles.emoji}>{item.emoji || '🛠️'}</Text><Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text><Text style={[styles.count, active && styles.activeCount]}>{Array.isArray(item.services) ? item.services.length : 0} خدمة</Text></TouchableOpacity>;
            }}
          />
          {selected && <View style={styles.sheet}><Text style={styles.sheetTitle}>{selected.emoji || '🛠️'} {selected.label}</Text><ScrollView>{(Array.isArray(selected.services) ? selected.services : []).map((service, index) => <View key={`${selected.label}-${index}`} style={styles.serviceRow}><Text style={styles.serviceText}>{service}</Text><Text style={styles.serviceMark}>›</Text></View>)}</ScrollView></View>}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.navy, paddingHorizontal: 28 },
  statusText: { marginTop: 12, color: '#E2E8F0', fontSize: 15, textAlign: 'center' },
  errorTitle: { color: COLORS.white, fontSize: 21, fontWeight: 'bold', textAlign: 'center' },
  errorText: { color: '#CBD5E1', marginTop: 12, textAlign: 'center', lineHeight: 23 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.navy, textAlign: 'right' },
  subtitle: { color: COLORS.muted, marginTop: 5, textAlign: 'right' },
  homeHeader: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  loginButton: { backgroundColor: COLORS.navy, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12 },
  loginButtonText: { color: COLORS.white, fontWeight: 'bold' },
  categoryList: { paddingHorizontal: 8, paddingBottom: 8 },
  card: { flex: 1, backgroundColor: COLORS.white, borderRadius: 18, padding: 14, margin: 6, borderWidth: 1, borderColor: COLORS.border },
  cardActive: { backgroundColor: COLORS.navy, borderColor: COLORS.teal },
  emoji: { fontSize: 30, textAlign: 'right' },
  label: { fontWeight: 'bold', marginTop: 6, color: COLORS.navy, textAlign: 'right' },
  activeLabel: { color: COLORS.white },
  count: { color: COLORS.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  activeCount: { color: '#99F6E4' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, maxHeight: 300, marginTop: 10, borderTopWidth: 1, borderColor: COLORS.border },
  sheetTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: COLORS.navy, textAlign: 'right' },
  serviceRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  serviceText: { color: COLORS.text, flex: 1, textAlign: 'right' },
  serviceMark: { color: '#0D9488', fontSize: 24, marginRight: 8 },
  loginWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: COLORS.bg },
  backLink: { position: 'absolute', top: 16, right: 20, padding: 8 },
  backText: { color: '#0D9488', fontWeight: 'bold' },
  brandMark: { width: 62, height: 62, borderRadius: 18, backgroundColor: COLORS.navy, borderWidth: 2, borderColor: COLORS.teal, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brandMarkText: { fontSize: 36, fontWeight: 'bold', color: COLORS.white },
  fieldLabel: { color: COLORS.navy, fontWeight: 'bold', marginTop: 18, marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 16 },
  hint: { marginTop: 8, color: COLORS.muted, fontSize: 12, textAlign: 'right', lineHeight: 18 },
  primaryButton: { marginTop: 22, backgroundColor: COLORS.teal, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: COLORS.navy, fontWeight: 'bold', fontSize: 16 },
  disabledButton: { opacity: 0.65 },
  securityNote: { marginTop: 18, color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 19 },
  adminHeader: { backgroundColor: COLORS.navy, padding: 18, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  adminTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold', textAlign: 'right' },
  adminSub: { color: '#CBD5E1', marginTop: 5, textAlign: 'right' },
  logoutButton: { backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  logoutText: { color: COLORS.white, fontWeight: 'bold' },
  tabRow: { flexDirection: 'row-reverse', paddingHorizontal: 10, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 11, alignItems: 'center', backgroundColor: COLORS.white },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.teal },
  tabText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: COLORS.white },
  adminList: { paddingHorizontal: 12, paddingBottom: 18 },
  dataCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  dataTitle: { color: COLORS.navy, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  dataDetail: { color: COLORS.muted, marginTop: 6, textAlign: 'right', lineHeight: 20 },
  emptyText: { textAlign: 'center', color: COLORS.muted, marginTop: 35 },
  footerNote: { color: COLORS.muted, fontSize: 11, padding: 10, textAlign: 'center' },
  techWrap: { flex: 1, padding: 20, justifyContent: 'center' },
});
