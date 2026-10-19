import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, SafeAreaView
} from 'react-native';

const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
const COLORS = { navy: '#0F172A', teal: '#14B8A6', bg: '#F8FAFC', text: '#1E293B', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', red: '#B91C1C' };

async function api(path, options = {}) {
  const { token, body, headers, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('تعذر الاتصال بالإنترنت أو بالخادم. تأكد من الاتصال ثم أعد المحاولة.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `خطأ من الخادم (${response.status})`);
  return data;
}

function toList(result, keys) {
  for (const key of keys) if (Array.isArray(result?.[key])) return result[key];
  return Array.isArray(result?.data) ? result.data : [];
}
function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ar-EG');
}
function Button({ title, onPress, secondary = false, disabled = false }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabledButton]}>
    <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
  </TouchableOpacity>;
}
function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default', multiline = false, autoCapitalize = 'none' }) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor="#94A3B8"
      secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
      multiline={multiline} textAlign="right" style={[styles.input, multiline && styles.multiline]} />
  </View>;
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [areas, setAreas] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [session, setSession] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authMode, setAuthMode] = useState('fanni');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '', service: '', area: '', address: '', description: '', budget: '', specialties: [], areas: [] });
  const [clientData, setClientData] = useState({ orders: [], loading: false, error: '', sn: '', clientToken: '' });
  const [techData, setTechData] = useState({ profile: null, orders: [], offers: [], wallet: [], loading: false, error: '', tab: 'available' });
  const [adminData, setAdminData] = useState({ orders: [], fannis: [], clients: [], loading: false, error: '', tab: 'orders' });
  const [topup, setTopup] = useState({ amount: '', fromPhone: '', reference: '' });
  const [offerDraft, setOfferDraft] = useState(null);

  const services = useMemo(() => categories.flatMap(category => (category.services || []).map(service => ({ category: category.label, service }))), [categories]);
  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    let mounted = true;
    async function loadPublicData() {
      setServicesLoading(true); setServicesError('');
      try {
        const [serviceResult, areaResult] = await Promise.all([api('/services'), api('/areas')]);
        if (!Array.isArray(serviceResult.categories)) throw new Error('قائمة الخدمات من الخادم غير صحيحة');
        if (!mounted) return;
        setCategories(serviceResult.categories);
        setSelected(current => current && serviceResult.categories.some(item => item.label === current.label)
          ? serviceResult.categories.find(item => item.label === current.label) : (serviceResult.categories[0] || null));
        setAreas(toList(areaResult, ['areas']));
        if (!form.service && serviceResult.categories[0]?.services?.[0]) updateForm('service', serviceResult.categories[0].services[0]);
      } catch (err) {
        if (mounted) { setServicesError(err.message || 'تعذر تحميل الخدمات'); setCategories([]); }
      } finally { if (mounted) setServicesLoading(false); }
    }
    loadPublicData();
    return () => { mounted = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!session || screen !== 'admin' || session.role !== 'admin') return;
    let mounted = true;
    async function loadAdmin() {
      setAdminData(current => ({ ...current, loading: true, error: '' }));
      const results = await Promise.allSettled([
        api('/admin/orders?limit=100', { token: session.token }),
        api('/admin/fannis?limit=100', { token: session.token }),
        api('/admin/clients?limit=100', { token: session.token }),
      ]);
      if (!mounted) return;
      const failed = results.find(item => item.status === 'rejected');
      setAdminData({
        orders: results[0].status === 'fulfilled' ? toList(results[0].value, ['orders', 'items']) : [],
        fannis: results[1].status === 'fulfilled' ? toList(results[1].value, ['fannis', 'items']) : [],
        clients: results[2].status === 'fulfilled' ? toList(results[2].value, ['clients', 'items']) : [],
        loading: false,
        error: failed ? failed.reason?.message || 'تعذر تحميل بعض بيانات الإدارة' : '',
        tab: adminData.tab || 'orders',
      });
    }
    loadAdmin();
    return () => { mounted = false; };
  }, [session, screen, reloadKey]);

  useEffect(() => {
    if (!session || screen !== 'technician' || session.role !== 'fanni') return;
    let mounted = true;
    async function loadTechnician() {
      setTechData(current => ({ ...current, loading: true, error: '' }));
      const results = await Promise.allSettled([
        api('/fanni/me', { token: session.token }),
        api('/orders/available', { token: session.token }),
        api('/orders/my-offers', { token: session.token }),
        api('/fanni/wallet/history', { token: session.token }),
      ]);
      if (!mounted) return;
      const failed = results.find(item => item.status === 'rejected');
      setTechData(current => ({
        ...current,
        profile: results[0].status === 'fulfilled' ? (results[0].value.user || results[0].value) : session.user,
        orders: results[1].status === 'fulfilled' ? toList(results[1].value, ['orders']) : [],
        offers: results[2].status === 'fulfilled' ? toList(results[2].value, ['offers']) : [],
        wallet: results[3].status === 'fulfilled' ? toList(results[3].value, ['history', 'transactions', 'requests']) : [],
        loading: false,
        error: failed ? failed.reason?.message || 'تعذر تحميل بعض بيانات الفني' : '',
      }));
    }
    loadTechnician();
    return () => { mounted = false; };
  }, [session, screen, reloadKey]);

  useEffect(() => {
    if (!session || screen !== 'client' || session.role !== 'client') return;
    let mounted = true;
    async function loadClientOrders() {
      setClientData(current => ({ ...current, loading: true, error: '' }));
      try {
        const result = await api('/client/orders', { token: session.token });
        if (mounted) setClientData(current => ({ ...current, orders: toList(result, ['orders']), loading: false }));
      } catch (err) {
        if (mounted) setClientData(current => ({ ...current, loading: false, error: err.message || 'تعذر تحميل الطلبات' }));
      }
    }
    loadClientOrders();
    return () => { mounted = false; };
  }, [session, screen, reloadKey]);

  async function handleLogin() {
    const raw = username.trim();
    if (!raw || !password) { Alert.alert('بيانات ناقصة', 'اكتب رقم الهاتف أو الإيميل وكلمة السر.'); return; }
    const isAdmin = raw.startsWith('#');
    const identifier = isAdmin ? raw.slice(1).trim() : raw;
    if (!identifier) { Alert.alert('بيانات ناقصة', 'اكتب الإيميل أو رقم الهاتف بعد علامة #.'); return; }
    setLoginLoading(true);
    try {
      let result, role, user;
      if (isAdmin) {
        const identity = identifier.includes('@') ? { email: identifier } : { phone: identifier };
        result = await api('/admin/login', { method: 'POST', body: { ...identity, password } });
        if (!result.token || !result.user) throw new Error('استجابة تسجيل دخول الإدارة غير مكتملة.');
        role = 'admin'; user = result.user;
      } else if (authMode === 'client') {
        result = await api('/client/login', { method: 'POST', body: { phone: identifier, password } });
        if (!result.token || !result.client) throw new Error('استجابة تسجيل دخول العميل غير مكتملة.');
        role = 'client'; user = result.client;
      } else {
        result = await api('/fanni/login', { method: 'POST', body: { phone: identifier, password } });
        if (!result.token || !result.user) throw new Error('استجابة تسجيل دخول الفني غير مكتملة.');
        role = 'fanni'; user = result.user;
      }
      setSession({ token: result.token, user, role });
      setPassword('');
      setScreen(role === 'admin' ? 'admin' : role === 'client' ? 'client' : 'technician');
    } catch (err) {
      Alert.alert('تعذر تسجيل الدخول', err.message || 'راجع البيانات وحاول مرة أخرى.');
    } finally { setLoginLoading(false); }
  }

  async function registerClient() {
    if (form.password !== form.confirmPassword) { Alert.alert('كلمة السر', 'كلمتا السر غير متطابقتين.'); return; }
    setLoginLoading(true);
    try {
      const result = await api('/client/register', { method: 'POST', body: { name: form.name.trim(), phone: form.phone.trim(), password: form.password, confirmPassword: form.confirmPassword } });
      if (!result.token || !result.client) throw new Error('تم التسجيل لكن استجابة الخادم غير مكتملة.');
      setSession({ token: result.token, user: result.client, role: 'client' });
      setScreen('client');
    } catch (err) { Alert.alert('تعذر إنشاء الحساب', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function registerTechnician() {
    if (form.password !== form.confirmPassword) { Alert.alert('كلمة السر', 'كلمتا السر غير متطابقتين.'); return; }
    if (!form.specialties.length || !form.areas.length) { Alert.alert('بيانات ناقصة', 'اختار خدمة واحدة على الأقل ومنطقة واحدة على الأقل.'); return; }
    setLoginLoading(true);
    try {
      const result = await api('/fanni/register', { method: 'POST', body: { name: form.name.trim(), phone: form.phone.trim(), password: form.password, specialties: form.specialties, areas: form.areas } });
      Alert.alert('تم إرسال التسجيل', result.message || 'حسابك قيد مراجعة الإدارة.');
      setUsername(form.phone); setPassword(''); setScreen('login'); setAuthMode('fanni');
    } catch (err) { Alert.alert('تعذر تسجيل الفني', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function createOrder() {
    if (!form.service || !form.area || form.address.trim().length < 2) { Alert.alert('بيانات ناقصة', 'اختار الخدمة والمنطقة واكتب العنوان بالتفصيل.'); return; }
    setLoginLoading(true);
    try {
      const description = form.description.trim();
      if (description && description.length < 10) {
        Alert.alert('وصف قصير', 'اكتب 10 أحرف على الأقل أو اترك الوصف فارغًا.');
        setLoginLoading(false);
        return;
      }
      const orderBody = { service: form.service, area: form.area, address: form.address.trim(), budget: form.budget.trim() };
      if (description) orderBody.description = description;
      const result = await api('/orders', { method: 'POST', token: session.token, body: orderBody });
      setClientData(current => ({ ...current, sn: result.sn || result.order?.sn || '', clientToken: result.clientToken || '' }));
      setForm(current => ({ ...current, address: '', description: '', budget: '' }));
      setReloadKey(value => value + 1);
      Alert.alert('تم استلام الطلب', `كود المتابعة: ${result.sn || result.order?.sn || '—'}\nسيتم مراجعته من الإدارة.`);
    } catch (err) { Alert.alert('تعذر إنشاء الطلب', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  function sendOffer(order) {
    setOfferDraft({ order, price: '', message: 'أستطيع تنفيذ الخدمة المطلوبة.' });
  }

  async function submitOffer() {
    const amount = Number(offerDraft?.price);
    const message = String(offerDraft?.message || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || message.length < 5) {
      Alert.alert('بيانات العرض غير صحيحة', 'اكتب سعرًا أكبر من صفر ورسالة لا تقل عن 5 أحرف.');
      return;
    }
    try {
      await api(`/orders/${encodeURIComponent(offerDraft.order.sn)}/offer`, {
        method: 'POST', token: session.token, body: { price: amount, message }
      });
      setOfferDraft(null);
      Alert.alert('تم إرسال العرض', 'تم إرسال عرضك بنجاح.');
      setReloadKey(value => value + 1);
    } catch (err) {
      Alert.alert('تعذر إرسال العرض', err.message || 'حاول مرة أخرى.');
    }
  }

  async function submitTopup() {
    const amount = Number(topup.amount);
    if (!Number.isInteger(amount) || amount < 10 || !topup.fromPhone.trim()) { Alert.alert('بيانات غير صحيحة', 'اكتب مبلغًا صحيحًا (10 جنيهات على الأقل) ورقم المحوّل.'); return; }
    try {
      const result = await api('/fanni/wallet/topup', { method: 'POST', token: session.token, body: { amount, fromPhone: topup.fromPhone.trim(), reference: topup.reference.trim(), method: 'vodafone_cash' } });
      Alert.alert('تم إرسال طلب الشحن', result.message || 'طلبك قيد مراجعة الإدارة.');
      setTopup({ amount: '', fromPhone: '', reference: '' });
      setReloadKey(value => value + 1);
    } catch (err) { Alert.alert('تعذر إرسال الشحن', err.message || 'حاول مرة أخرى.'); }
  }

  function logout() {
    setSession(null); setUsername(''); setPassword('');
    setClientData({ orders: [], loading: false, error: '', sn: '', clientToken: '' });
    setTechData({ profile: null, orders: [], offers: [], wallet: [], loading: false, error: '', tab: 'available' });
    setAdminData({ orders: [], fannis: [], clients: [], loading: false, error: '', tab: 'orders' });
    setScreen('home');
  }
  const goLogin = mode => { setAuthMode(mode); setUsername(''); setPassword(''); setScreen('login'); };
  const toggleArray = (key, value) => updateForm(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value]);

  if (screen === 'login') return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Button title="رجوع" secondary onPress={() => setScreen('home')} />
      <Text style={styles.title}>تسجيل الدخول</Text>
      <Text style={styles.subtitle}>الفني والعميل من نفس الشاشة، والإدارة بعلامة #.</Text>
      <View style={styles.tabRow}>
        <Button title="دخول فني" secondary={authMode !== 'fanni'} onPress={() => setAuthMode('fanni')} />
        <Button title="دخول عميل" secondary={authMode !== 'client'} onPress={() => setAuthMode('client')} />
      </View>
      <Field label={authMode === 'client' ? 'رقم هاتف العميل' : 'رقم هاتف الفني أو # ثم حساب الإدارة'} value={username} onChangeText={setUsername} placeholder={authMode === 'client' ? '01xxxxxxxxx' : '#admin@email.com أو رقم الفني'} keyboardType="default" />
      <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholder="كلمة السر" />
      <Button title={loginLoading ? 'جاري الدخول...' : 'دخول'} onPress={handleLogin} disabled={loginLoading} />
      {authMode === 'client' && <Button title="إنشاء حساب عميل جديد" secondary onPress={() => setScreen('clientRegister')} />}
      <Text style={styles.note}>علامة # توجه الطلب لمسار الإدارة فقط، ولا تمنح صلاحيات. الخادم هو المسؤول عن التحقق.</Text>
    </KeyboardAvoidingView>
  </SafeAreaView>;

  if (screen === 'clientRegister' || screen === 'technicianRegister') {
    const isClient = screen === 'clientRegister';
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="رجوع" secondary onPress={() => setScreen('home')} />
      <Text style={styles.title}>{isClient ? 'إنشاء حساب عميل' : 'تسجيل فني جديد'}</Text>
      <Field label="الاسم" value={form.name} onChangeText={v => updateForm('name', v)} autoCapitalize="words" />
      <Field label="رقم الهاتف" value={form.phone} onChangeText={v => updateForm('phone', v)} keyboardType="phone-pad" />
      <Field label="كلمة السر (6 أحرف للفني، 8 للعميل على الأقل)" value={form.password} onChangeText={v => updateForm('password', v)} secureTextEntry />
      <Field label="تأكيد كلمة السر" value={form.confirmPassword} onChangeText={v => updateForm('confirmPassword', v)} secureTextEntry />
      {!isClient && <>
        <Text style={styles.sectionTitle}>اختار الخدمات اللي بتقدمها</Text>
        {categories.map(category => <View key={category.label} style={styles.selectionGroup}>
          <Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label}</Text>
          {(category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleArray('specialties', service)} style={styles.choiceRow}>
            <Text style={styles.choiceText}>{form.specialties.includes(service) ? '☑' : '□'} {service}</Text>
          </TouchableOpacity>)}
        </View>)}
        <Text style={styles.sectionTitle}>مناطق العمل</Text>
        {areas.map(area => <TouchableOpacity key={area} onPress={() => toggleArray('areas', area)} style={styles.choiceRow}><Text style={styles.choiceText}>{form.areas.includes(area) ? '☑' : '□'} {area}</Text></TouchableOpacity>)}
      </>}
      <Button title={loginLoading ? 'جاري التسجيل...' : isClient ? 'إنشاء حساب' : 'إرسال طلب التسجيل'} onPress={isClient ? registerClient : registerTechnician} disabled={loginLoading} />
    </ScrollView></SafeAreaView>;
  }

  if (screen === 'client' && session?.role === 'client') return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>حساب العميل</Text><Text style={styles.subtitle}>أهلًا {session.user?.name || 'بك'}</Text></View><Button title="خروج" secondary onPress={logout} /></View>
      <Text style={styles.sectionTitle}>اطلب خدمة</Text>
      {servicesLoading ? <ActivityIndicator color={COLORS.teal} /> : <>
        <Text style={styles.fieldLabel}>الخدمة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{services.map(item => <TouchableOpacity key={item.service} onPress={() => updateForm('service', item.service)} style={[styles.pill, form.service === item.service && styles.pillActive]}><Text style={[styles.pillText, form.service === item.service && styles.pillTextActive]}>{item.service}</Text></TouchableOpacity>)}</ScrollView>
        <Text style={styles.fieldLabel}>المنطقة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{areas.map(area => <TouchableOpacity key={area} onPress={() => updateForm('area', area)} style={[styles.pill, form.area === area && styles.pillActive]}><Text style={[styles.pillText, form.area === area && styles.pillTextActive]}>{area}</Text></TouchableOpacity>)}</ScrollView>
        <Field label="العنوان بالتفصيل" value={form.address} onChangeText={v => updateForm('address', v)} placeholder="الشارع والعلامة المميزة" />
        <Field label="وصف المشكلة (اختياري)" value={form.description} onChangeText={v => updateForm('description', v)} multiline placeholder="اشرح الخدمة المطلوبة" />
        <Field label="ميزانية متوقعة (اختياري)" value={form.budget} onChangeText={v => updateForm('budget', v)} placeholder="مثال: حسب المعاينة" />
        <Button title={loginLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب الخدمة'} onPress={createOrder} disabled={loginLoading} />
      </>}
      {clientData.sn ? <Text style={styles.successText}>آخر كود طلب: {clientData.sn}</Text> : null}
      <Text style={styles.sectionTitle}>طلباتي السابقة</Text>
      {clientData.loading ? <ActivityIndicator color={COLORS.teal} /> : clientData.error ? <Text style={styles.errorText}>{clientData.error}</Text> : clientData.orders.map((order, i) => <View key={String(order._id || order.sn || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{order.sn || 'طلب خدمة'} — {order.service || ''}</Text><Text style={styles.detail}>{order.status || 'قيد المراجعة'} • {order.area || ''}</Text><Text style={styles.detail}>{dateLabel(order.createdAt)}</Text></View>)}
      <Button title="تحديث البيانات" secondary onPress={() => setReloadKey(v => v + 1)} />
    </ScrollView>
  </SafeAreaView>;

  if (screen === 'technician' && session?.role === 'fanni') {
    const user = techData.profile || session.user || {};
    const tab = techData.tab;
    const tabs = [{ key: 'available', label: 'الفرص' }, { key: 'offers', label: 'عروضي' }, { key: 'wallet', label: 'المحفظة' }, { key: 'profile', label: 'حسابي' }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>صُنّاع — الفني</Text><Text style={styles.subtitle}>أهلًا {user.name || 'بك'} · {user.status || 'قيد المراجعة'}</Text></View><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRow}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => setTechData(v => ({ ...v, tab: item.key }))} style={[styles.pill, tab === item.key && styles.pillActive]}><Text style={[styles.pillText, tab === item.key && styles.pillTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
      {offerDraft ? <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>تقديم عرض على {offerDraft.order.service || 'الخدمة'} — {offerDraft.order.sn}</Text>
        <Field label="السعر بالجنيه" value={offerDraft.price} onChangeText={value => setOfferDraft(current => ({ ...current, price: value }))} keyboardType="numeric" />
        <Field label="رسالة للعميل" value={offerDraft.message} onChangeText={value => setOfferDraft(current => ({ ...current, message: value }))} multiline />
        <Button title="إرسال العرض" onPress={submitOffer} />
        <Button title="إلغاء" secondary onPress={() => setOfferDraft(null)} />
      </View> : null}
      {techData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الفني من الخادم...</Text></View> : <>
        {techData.error ? <Text style={styles.errorText}>{techData.error}</Text> : null}
        {tab === 'available' && <FlatList data={techData.orders} keyExtractor={(item, i) => String(item._id || item.sn || i)} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد فرص متاحة حاليًا أو الحساب لم يُعتمد بعد.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.service || 'طلب خدمة'} — {item.sn || ''}</Text><Text style={styles.detail}>{item.area || ''} • {item.status || ''}</Text><Text style={styles.detail}>{item.description || item.desc || 'تفاصيل الطلب تظهر حسب صلاحيات الخادم.'}</Text><Button title="تقديم عرض" onPress={() => sendOffer(item)} /></View>} />}
        {tab === 'offers' && <FlatList data={techData.offers} keyExtractor={(item, i) => String(item._id || item.orderSn || i)} ListEmptyComponent={<Text style={styles.emptyText}>لسه ماقدمتش عروض.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.service || 'خدمة'} — {item.orderSn || ''}</Text><Text style={styles.detail}>السعر: {item.price || item.priceNum || '—'} جنيه • {item.orderStatus || ''}</Text><Text style={styles.detail}>{item.message || ''}</Text>{item.client ? <Text style={styles.detail}>العميل: {item.client.name || ''} — {item.client.phone || ''} — {item.client.address || ''}</Text> : null}</View>} />}
        {tab === 'wallet' && <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>المحفظة: {Number(user.walletBalance || user.balance || 0)} جنيه</Text><Field label="مبلغ الشحن بالجنيه" value={topup.amount} onChangeText={v => setTopup(t => ({ ...t, amount: v }))} keyboardType="numeric" /><Field label="رقم المحوّل" value={topup.fromPhone} onChangeText={v => setTopup(t => ({ ...t, fromPhone: v }))} keyboardType="phone-pad" /><Field label="رقم مرجع التحويل (اختياري)" value={topup.reference} onChangeText={v => setTopup(t => ({ ...t, reference: v }))} /><Button title="إرسال طلب شحن للمراجعة" onPress={submitTopup} /><Text style={styles.sectionTitle}>سجل المحفظة</Text>{techData.wallet.map((item, i) => <View key={String(item._id || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.type || item.status || 'حركة محفظة'}</Text><Text style={styles.detail}>{item.amount || ''} جنيه • {dateLabel(item.createdAt || item.date)}</Text></View>)}</ScrollView>}
        {tab === 'profile' && <ScrollView contentContainerStyle={styles.page}><View style={styles.dataCard}><Text style={styles.cardTitle}>{user.name || 'الفني'}</Text><Text style={styles.detail}>الهاتف: {user.phone || ''}</Text><Text style={styles.detail}>الحالة: {user.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>الخدمات: {(user.specialties || []).join('، ') || '—'}</Text><Text style={styles.detail}>المناطق: {(user.areas || []).join('، ') || '—'}</Text></View><Button title="تحديث بيانات الحساب" secondary onPress={() => setReloadKey(v => v + 1)} /></ScrollView>}
      </>}
    </SafeAreaView>;
  }

  if (screen === 'admin' && session?.role === 'admin') {
    const tab = adminData.tab;
    const items = adminData[tab] || [];
    const tabs = [{ key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' }, { key: 'clients', label: 'العملاء' }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitle}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRow}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => setAdminData(v => ({ ...v, tab: item.key }))} style={[styles.pill, tab === item.key && styles.pillActive]}><Text style={[styles.pillText, tab === item.key && styles.pillTextActive]}>{item.label} ({adminData[item.key].length})</Text></TouchableOpacity>)}</View>
      {adminData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الإدارة...</Text></View> : <>
        {adminData.error ? <Text style={styles.errorText}>{adminData.error}</Text> : null}
        <FlatList data={items} keyExtractor={(item, i) => String(item._id || item.id || item.sn || item.phone || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات لعرضها حاليًا.</Text>} renderItem={({ item }) => {
          const title = tab === 'orders' ? (item.sn || item.service || 'طلب خدمة') : (item.name || item.phone || (tab === 'fannis' ? 'فني' : 'عميل'));
          const detail = tab === 'orders' ? [item.status, item.service, item.area, item.createdAt ? dateLabel(item.createdAt) : ''].filter(Boolean).join(' • ')
            : tab === 'fannis' ? [item.phone, item.status || item.actualStatus, Array.isArray(item.specialties) ? item.specialties.join('، ') : item.skill].filter(Boolean).join(' • ')
            : [item.phone, item.orderCount ? `عدد الطلبات: ${item.orderCount}` : '', item.lastOrder ? `آخر طلب: ${item.lastOrder}` : ''].filter(Boolean).join(' • ');
          return <View style={styles.dataCard}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.detail}>{detail || 'لا توجد تفاصيل إضافية'}</Text></View>;
        }} />
        <Button title="إعادة تحميل بيانات الإدارة" secondary onPress={() => setReloadKey(v => v + 1)} />
      </>}
      <Text style={styles.note}>هذه نسخة ربط أولية للعرض والقراءة. أوامر الإدارة الحساسة تحتاج واجهات منفصلة واختبارات صلاحيات قبل تفعيلها.</Text>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <View style={styles.homeHeader}><View style={styles.flex}><Text style={styles.title}>صُنّاع</Text><Text style={styles.subtitle}>خدماتك اليومية في مكان واحد</Text></View><Text style={styles.brand}>ص</Text></View>
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.hero}>خدمات الصيانة في مكان واحد</Text>
      <Text style={styles.subtitle}>التطبيق متصل بواجهة صُنّاع على الخادم.</Text>
      <View style={styles.homeButtons}><Button title="طلب خدمة / دخول عميل" onPress={() => goLogin('client')} /><Button title="دخول الفني" secondary onPress={() => goLogin('fanni')} /><Button title="تسجيل فني جديد" secondary onPress={() => setScreen('technicianRegister')} /><Button title="إنشاء حساب عميل" secondary onPress={() => setScreen('clientRegister')} /></View>
      <Text style={styles.sectionTitle}>الأقسام والخدمات</Text>
      {servicesLoading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل الخدمات من الخادم...</Text></View> : servicesError ? <View style={styles.dataCard}><Text style={styles.errorText}>{servicesError}</Text><Button title="إعادة المحاولة" onPress={() => setReloadKey(v => v + 1)} /></View> : <>
        <View style={styles.grid}>{categories.map(item => <TouchableOpacity key={item.label} onPress={() => setSelected(item)} style={[styles.categoryCard, selected?.label === item.label && styles.categoryActive]}><Text style={styles.emoji}>{item.emoji || '🛠️'}</Text><Text style={[styles.categoryTitle, selected?.label === item.label && styles.categoryTitleActive]}>{item.label}</Text><Text style={[styles.detail, selected?.label === item.label && styles.categoryTitleActive]}>{(item.services || []).length} خدمة</Text></TouchableOpacity>)}</View>
        {selected ? <View style={styles.dataCard}><Text style={styles.cardTitle}>{selected.emoji || '🛠️'} {selected.label}</Text>{(selected.services || []).map(service => <Text key={service} style={styles.serviceLine}>• {service}</Text>)}</View> : null}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 16, paddingBottom: 34, gap: 10 },
  flex: { flex: 1 },
  title: { fontSize: 25, fontWeight: 'bold', color: COLORS.navy, textAlign: 'right' },
  subtitle: { color: COLORS.muted, marginTop: 5, textAlign: 'right', lineHeight: 21 },
  hero: { color: COLORS.navy, fontSize: 22, fontWeight: 'bold', textAlign: 'right', marginTop: 12 },
  brand: { backgroundColor: COLORS.navy, color: COLORS.white, fontSize: 30, fontWeight: 'bold', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  homeHeader: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  homeButtons: { gap: 8, marginVertical: 12 },
  button: { backgroundColor: COLORS.teal, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 3 },
  buttonText: { color: COLORS.navy, fontWeight: 'bold', fontSize: 14 },
  buttonSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  buttonSecondaryText: { color: COLORS.navy },
  disabledButton: { opacity: 0.55 },
  fieldWrap: { marginVertical: 5 },
  fieldLabel: { color: COLORS.navy, fontWeight: 'bold', marginTop: 7, marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 16 },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  note: { color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 19, marginVertical: 8 },
  tabRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginVertical: 8 },
  pill: { borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 9, marginRight: 4, marginVertical: 3 },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.teal },
  pillText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: COLORS.white },
  sectionTitle: { color: COLORS.navy, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginTop: 12, marginBottom: 5 },
  selectionGroup: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 10, marginVertical: 5 },
  groupTitle: { color: COLORS.navy, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  choiceRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  choiceText: { color: COLORS.text, textAlign: 'right' },
  headerRow: { padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.navy, padding: 24 },
  statusText: { marginTop: 12, color: '#E2E8F0', textAlign: 'center' },
  dataCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginVertical: 6 },
  cardTitle: { color: COLORS.navy, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  detail: { color: COLORS.muted, marginTop: 6, textAlign: 'right', lineHeight: 20 },
  errorText: { color: COLORS.red, textAlign: 'right', marginVertical: 8, lineHeight: 21 },
  successText: { color: '#047857', fontWeight: 'bold', textAlign: 'right', marginVertical: 10 },
  emptyText: { textAlign: 'center', color: COLORS.muted, padding: 28 },
  list: { paddingHorizontal: 12, paddingBottom: 18 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: { width: '48%', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13, marginBottom: 10 },
  categoryActive: { backgroundColor: COLORS.navy, borderColor: COLORS.teal },
  emoji: { fontSize: 27, textAlign: 'right' },
  categoryTitle: { color: COLORS.navy, fontWeight: 'bold', textAlign: 'right', marginTop: 7 },
  categoryTitleActive: { color: COLORS.white },
  serviceLine: { color: COLORS.text, textAlign: 'right', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
