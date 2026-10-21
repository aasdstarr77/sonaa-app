import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, BackHandler
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
const COLORS = { navy: '#0B1B3A', navy2: '#173C6C', blue: '#2563EB', gold: '#F5B928', teal: '#14B8A6', bg: '#F4F7FB', text: '#152544', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', red: '#B91C1C' };

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
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString('ar-EG');
  } catch {
    try {
      return date.toLocaleDateString();
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
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

function AppContent() {
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
  const [adminData, setAdminData] = useState({ orders: [], fannis: [], clients: [], topups: [], complaints: [], loading: false, error: '', tab: 'orders' });
  const [topup, setTopup] = useState({ amount: '', fromPhone: '', reference: '' });
  const [offerDraft, setOfferDraft] = useState(null);
  const [notifications, setNotifications] = useState({ items: [], unread: 0, loading: false, error: '' });
  const [orderChats, setOrderChats] = useState({});
  const orderChatsRef = useRef(orderChats);
  useEffect(() => { orderChatsRef.current = orderChats; }, [orderChats]);
  const [chatDrafts, setChatDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', audience: 'all' });

  const services = useMemo(() => categories.flatMap(category => (category.services || []).map(service => ({ category: category.label, service }))), [categories]);
  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));

  // Keep Android's system Back button inside the app and return to the previous major screen.
  useEffect(() => {
    const onHardwareBack = () => {
      if (offerDraft) {
        setOfferDraft(null);
        return true;
      }
      if (screen === 'login' || screen === 'clientRegister' || screen === 'technicianRegister') {
        setScreen('home');
        return true;
      }
      if (screen === 'client' || screen === 'technician' || screen === 'admin') {
        setScreen('home');
        return true;
      }
      if (screen === 'home') {
        Alert.alert('صُنّاع', 'أنت بالفعل في الصفحة الرئيسية.');
        return true;
      }
      setScreen('home');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [screen, offerDraft]);

  useEffect(() => {
    if (!['client', 'clientRegister', 'technicianRegister'].includes(screen)) return;
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
  }, [reloadKey, screen]);

  useEffect(() => {
    if (!session || screen !== 'admin' || session.role !== 'admin' || session.user?.role !== 'admin') return;
    let mounted = true;
    async function loadAdminUsers() {
      setAdminUsersLoading(true);
      try {
        const result = await api('/admin/admin-users', { token: session.token });
        if (mounted) setAdminUsers(toList(result, ['users', 'items']));
      } catch (err) {
        if (mounted) setAdminUsers([]);
      } finally { if (mounted) setAdminUsersLoading(false); }
    }
    loadAdminUsers();
    return () => { mounted = false; };
  }, [session, screen, reloadKey]);

  useEffect(() => {
    if (!session || screen !== 'admin' || session.role !== 'admin') return;
    let mounted = true;
    async function loadAdmin() {
      setAdminData(current => ({ ...current, loading: true, error: '' }));
      const results = await Promise.allSettled([
        api('/admin/orders?limit=100', { token: session.token }),
        api('/admin/fannis?limit=100', { token: session.token }),
        api('/admin/clients?limit=100', { token: session.token }),
        api('/admin/topup-requests?limit=100', { token: session.token }),
        api('/admin/complaints?limit=100', { token: session.token }),
      ]);
      if (!mounted) return;
      const failed = results.find(item => item.status === 'rejected');
      setAdminData({
        orders: results[0].status === 'fulfilled' ? toList(results[0].value, ['orders', 'items']) : [],
        fannis: results[1].status === 'fulfilled' ? toList(results[1].value, ['fannis', 'items']) : [],
        clients: results[2].status === 'fulfilled' ? toList(results[2].value, ['clients', 'items']) : [],
        topups: results[3].status === 'fulfilled' ? toList(results[3].value, ['requests', 'items', 'data']) : [],
        complaints: results[4].status === 'fulfilled' ? toList(results[4].value, ['complaints', 'items', 'data']) : [],
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
    if (!session || !['client', 'technician'].includes(screen)) return;
    let mounted = true;
    let inFlight = false;
    const role = screen === 'client' ? 'client' : 'fanni';
    async function loadRoleNotifications(showLoading = false) {
      if (inFlight) return;
      inFlight = true;
      if (showLoading) setNotifications(current => ({ ...current, loading: true, error: '' }));
      try {
        const result = await api(`/notifications/${role}`, { token: session.token });
        if (mounted) setNotifications({ items: toList(result, ['notifications']), unread: Number(result.unreadCount || 0), loading: false, error: '' });
      } catch (err) {
        if (mounted && showLoading) setNotifications(current => ({ ...current, loading: false, error: err.message || 'تعذر تحميل الإشعارات' }));
      } finally {
        inFlight = false;
      }
    }
    loadRoleNotifications(true);
    const timer = setInterval(() => loadRoleNotifications(false), 5000);
    return () => { mounted = false; clearInterval(timer); };
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

  async function markNotificationRead(item) {
    const id = item?._id || item?.id;
    if (!id || item.read || item.readAt) return;
    const role = session?.role === 'client' ? 'client' : 'fanni';
    try {
      await api(`/notifications/${role}/${encodeURIComponent(id)}/read`, { method: 'PATCH', token: session.token });
      setNotifications(current => ({ ...current, items: current.items.map(n => (n._id || n.id) === id ? { ...n, read: true, readAt: new Date().toISOString() } : n), unread: Math.max(0, current.unread - 1) }));
    } catch (err) { Alert.alert('الإشعارات', err.message || 'تعذر تحديث الإشعار.'); }
  }

  async function markAllNotificationsRead() {
    const role = session?.role === 'client' ? 'client' : 'fanni';
    try {
      await api(`/notifications/${role}/read-all`, { method: 'PATCH', token: session.token });
      setNotifications(current => ({ ...current, items: current.items.map(n => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() })), unread: 0 }));
    } catch (err) { Alert.alert('الإشعارات', err.message || 'تعذر تحديث الإشعارات.'); }
  }

  async function updateProfessionalLevel(fanni) {
    const levels = ['مبتدئ', 'ممارس', 'محترف', 'خبير مبتدئ', 'خبير', 'خبير أول', 'استشاري فني', 'نخبة', 'أسطوري'];
    const current = fanni.level || 'مبتدئ';
    const index = levels.indexOf(current);
    const next = levels[Math.min((index < 0 ? 0 : index) + 1, levels.length - 1)];
    if (next === current) { Alert.alert('المستوى المهني', 'الفني وصل إلى أعلى مستوى.'); return; }
    Alert.alert('تأكيد الترقية', `ترقية ${fanni.name || 'الفني'} من ${current} إلى ${next}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'ترقية', onPress: async () => {
        try {
          await api(`/admin/fannis/${encodeURIComponent(fanni._id || fanni.id)}/level`, { method: 'PATCH', token: session.token, body: { level: next, reason: 'ترقية من تطبيق صُنّاع' } });
          setReloadKey(v => v + 1);
          Alert.alert('تمت الترقية', `المستوى الجديد: ${next}`);
        } catch (err) { Alert.alert('تعذر الترقية', err.message || 'راجع صلاحيات الحساب.'); }
      } },
    ]);
  }

  async function changeAdminRoleForFanni(fanni, role) {
    try {
      await api('/admin/admin-users', { method: 'POST', token: session.token, body: { fanniId: fanni._id || fanni.id, role } });
      setReloadKey(v => v + 1);
      Alert.alert('تم تحديث المنصب', `المنصب الإداري: ${role}`);
    } catch (err) { Alert.alert('تعذر تحديث المنصب', err.message || 'قد لا يمتلك حسابك صلاحية المدير العام.'); }
  }

  async function revokeAdminRoleForUser(user) {
    Alert.alert('سحب المنصب الإداري', `هل تريد سحب صلاحية ${user.name || 'هذا المستخدم'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'سحب الصلاحية', style: 'destructive', onPress: async () => {
        try {
          await api(`/admin/admin-users/${encodeURIComponent(user.id || user._id)}`, { method: 'DELETE', token: session.token });
          setReloadKey(v => v + 1);
          Alert.alert('تم', 'تم سحب الصلاحية الإدارية مع الاحتفاظ بحساب الفني.');
        } catch (err) { Alert.alert('تعذر سحب الصلاحية', err.message || 'راجع صلاحيات الحساب.'); }
      } },
    ]);
  }

  async function moderateTechnician(fanni, action) {
    const id = fanni?._id || fanni?.id;
    if (!id) return;
    const labels = { approve: 'اعتماد الفني', reject: 'رفض الفني', disable: 'تعليق الفني', enable: 'إعادة تفعيل الفني' };
    Alert.alert('تأكيد الإجراء', `هل تريد ${labels[action] || 'تنفيذ الإجراء'}: ${fanni.name || 'الفني'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', style: action === 'reject' || action === 'disable' ? 'destructive' : 'default', onPress: async () => {
        try { const result = await api(`/admin/fannis/${encodeURIComponent(id)}/${action}`, { method: 'POST', token: session.token, body: action === 'reject' || action === 'disable' ? { reason: 'إجراء من تطبيق صُنّاع' } : {} }); Alert.alert('تم', result.message || 'تم تحديث حالة الفني.'); setReloadKey(v => v + 1); }
        catch (err) { Alert.alert('تعذر تنفيذ الإجراء', err.message || 'راجع صلاحيات الحساب.'); }
      } },
    ]);
  }

  async function publishOrder(order) {
    if (session?.user?.role !== 'admin') { Alert.alert('غير مسموح', 'نشر الطلبات متاح للمدير العام فقط.'); return; }
    const sn = order?.sn;
    if (!sn) return;
    Alert.alert('نشر الطلب', `نشر الطلب ${sn} وإتاحته للفنيين المطابقين؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نشر', onPress: async () => {
        try { const result = await api(`/orders/admin/${encodeURIComponent(sn)}/publish`, { method: 'POST', token: session.token, body: {} }); Alert.alert('تم النشر', result.message || 'أصبح الطلب متاحًا للفنيين.'); setReloadKey(v => v + 1); }
        catch (err) { Alert.alert('تعذر نشر الطلب', err.message || 'راجع حالة الطلب وصلاحيات الحساب.'); }
      } },
    ]);
  }

  async function reviewTopup(request, action) {
    const id = request?._id || request?.id;
    if (!id) return;
    const approve = action === 'approve';
    Alert.alert(approve ? 'اعتماد الشحن' : 'رفض الشحن', `${approve ? 'إضافة' : 'رفض'} مبلغ ${request.amount || 0} جنيه ${approve ? 'إلى محفظة الفني' : 'في طلب الشحن'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: approve ? 'اعتماد وإضافة الرصيد' : 'رفض الطلب', style: approve ? 'default' : 'destructive', onPress: async () => {
        try { const result = await api(`/admin/topup-requests/${encodeURIComponent(id)}/${action}`, { method: 'POST', token: session.token, body: approve ? {} : { reason: 'رفض من تطبيق صُنّاع' } }); Alert.alert('تم', result.message || 'تمت معالجة طلب الشحن.'); setReloadKey(v => v + 1); }
        catch (err) { Alert.alert('تعذر معالجة الشحن', err.message || 'ربما تمت معالجة الطلب من قبل.'); }
      } },
    ]);
  }

  async function setComplaintStatus(complaint, status) {
    const id = complaint?._id || complaint?.id;
    if (!id) return;
    try { const result = await api(`/admin/complaints/${encodeURIComponent(id)}`, { method: 'PATCH', token: session.token, body: { status } }); Alert.alert('تم تحديث الشكوى', result.message || status); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر تحديث الشكوى', err.message || 'راجع صلاحيات الحساب.'); }
  }

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

  async function acceptClientOffer(order, offer) {
    const sn = order?.sn || order?.orderSn;
    const offerId = offer?._id || offer?.id;
    if (!sn || !offerId) { Alert.alert('تعذر قبول العرض', 'بيانات الطلب أو العرض غير مكتملة.'); return; }
    Alert.alert('تأكيد العرض', `قبول عرض ${offer.fanniName || offer.technicianName || 'الفني'} بسعر ${offer.price ?? '—'} جنيه؟`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'قبول العرض', onPress: async () => {
        try { await api(`/orders/${encodeURIComponent(sn)}/accept`, { method: 'POST', token: session.token, body: { offerId } }); Alert.alert('تم قبول العرض', 'تم إرسال تأكيدك إلى النظام.'); setReloadKey(v => v + 1); }
        catch (err) { Alert.alert('تعذر قبول العرض', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  async function completeTechnicianOrder(item) {
    const sn = item?.orderSn || item?.sn || item?.order?.sn;
    if (!sn) { Alert.alert('تعذر إنهاء الخدمة', 'لم يتم العثور على كود الطلب.'); return; }
    Alert.alert('تأكيد إنهاء الخدمة', `هل انتهيت من تنفيذ الطلب ${sn}؟`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'إنهاء الخدمة', onPress: async () => {
        try { await api(`/orders/${encodeURIComponent(sn)}/complete`, { method: 'POST', token: session.token, body: {} }); Alert.alert('تم', 'تم تسجيل إنهاء الخدمة.'); setReloadKey(v => v + 1); }
        catch (err) { Alert.alert('تعذر إنهاء الخدمة', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  function getOrderSN(order) { return String(order?.orderSn || order?.sn || order?.order?.sn || '').trim().toUpperCase(); }

  function orderToken(role) { return role === 'client' ? (session?.token || clientData.clientToken || '') : (session?.token || ''); }

  async function refreshOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) return;
    setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), open: true, loading: true, error: '' } }));
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/chat`, { token: orderToken(role) });
      setOrderChats(current => ({ ...current, [sn]: { open: true, loading: false, error: '', messages: toList(result, ['messages']), priceChangeRequests: toList(result, ['priceChangeRequests']) } }));
    } catch (err) {
      setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), open: true, loading: false, error: err.message || 'تعذر تحميل المحادثة' } }));
      Alert.alert('تعذر فتح المحادثة', err.message || 'حاول مرة أخرى.');
    }
  }

  async function toggleOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) { Alert.alert('تعذر فتح المحادثة', 'كود الطلب غير موجود.'); return; }
    if (orderChats[sn]?.open) {
      setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), open: false } }));
      return;
    }
    await refreshOrderChat(order, role);
  }

  async function sendOrderChat(order) {
    const sn = getOrderSN(order), message = String(chatDrafts[getOrderSN(order)] || '').trim();
    if (!sn || !message) { Alert.alert('رسالة فارغة', 'اكتب الرسالة أولًا.'); return; }
    try {
      await api(`/orders/${encodeURIComponent(sn)}/chat`, { method: 'POST', token: orderToken(session?.role || 'client'), body: { text: message } });
      setChatDrafts(current => ({ ...current, [sn]: '' }));
      await refreshOrderChat(order, session.role);
    } catch (err) { Alert.alert('تعذر إرسال الرسالة', err.message || 'راجع قواعد المحادثة وحاول مرة أخرى.'); }
  }

  async function requestOrderPriceChange(order) {
    const sn = getOrderSN(order), draft = priceDrafts[getOrderSN(order)] || {};
    const newPrice = Number(draft.price), reason = String(draft.reason || '').trim();
    if (!sn || !Number.isFinite(newPrice) || newPrice <= 0 || reason.length < 5) {
      Alert.alert('بيانات تعديل السعر', 'اكتب السعر الجديد وسببًا واضحًا لا يقل عن 5 أحرف.'); return;
    }
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/price-change`, { method: 'POST', token: session.token, body: { newPrice, reason } });
      Alert.alert('تم إرسال الطلب', result.message || 'لن يتغير السعر قبل موافقة العميل.');
      setPriceDrafts(current => ({ ...current, [sn]: { price: '', reason: '' } }));
      await refreshOrderChat(order, 'fanni');
      setReloadKey(v => v + 1);
    } catch (err) { Alert.alert('تعذر تعديل السعر', err.message || 'حاول مرة أخرى.'); }
  }

  async function decideOrderPrice(order, request, approved) {
    const sn = getOrderSN(order), id = request?._id || request?.id;
    if (!sn || !id) { Alert.alert('تعذر تنفيذ القرار', 'بيانات طلب تعديل السعر غير مكتملة.'); return; }
    Alert.alert(approved ? 'الموافقة على تعديل السعر' : 'رفض تعديل السعر',
      approved ? `هل توافق على تغيير السعر إلى ${request.newPrice} جنيه؟` : 'هل تريد رفض طلب تعديل السعر؟',
      [{ text: 'رجوع', style: 'cancel' }, { text: approved ? 'موافقة' : 'رفض', onPress: async () => {
        try {
          const result = await api(`/orders/${encodeURIComponent(sn)}/price-change/${encodeURIComponent(id)}/decision`, { method: 'POST', token: orderToken('client'), body: { approved } });
          Alert.alert('تم تسجيل القرار', result.message || (approved ? 'تمت الموافقة.' : 'تم رفض الطلب.'));
          await refreshOrderChat(order, 'client');
          setReloadKey(v => v + 1);
        } catch (err) { Alert.alert('تعذر تسجيل القرار', err.message || 'حاول مرة أخرى.'); }
      }}]);
  }

  // Poll only conversations the user has explicitly opened; never interrupt typing or flash a loader.
  useEffect(() => {
    if (!session || !['client', 'technician'].includes(screen)) return;
    const role = screen === 'client' ? 'client' : 'fanni';
    const sourceOrders = role === 'client' ? clientData.orders : techData.offers;
    let mounted = true;
    let inFlight = false;
    const pollOpenChats = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const openChats = sourceOrders
          .map(order => getOrderSN(order))
          .filter(sn => sn && orderChatsRef.current[sn]?.open);
        await Promise.all(openChats.map(async sn => {
          try {
            const result = await api(`/orders/${encodeURIComponent(sn)}/chat`, { token: session.token });
            if (!mounted) return;
            setOrderChats(current => current[sn]?.open
              ? { ...current, [sn]: { ...current[sn], loading: false, error: '', messages: toList(result, ['messages']), priceChangeRequests: toList(result, ['priceChangeRequests']) } }
              : current);
          } catch {
            // A transient polling failure should not close the chat or show repeated alerts.
          }
        }));
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(pollOpenChats, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [screen, session, clientData.orders, techData.offers]);

  function setOrderRatingStars(order, stars) {
    const sn = getOrderSN(order);
    setRatingDrafts(current => ({
      ...current,
      [sn]: {
        ...current[sn],
        stars: String(stars),
        blockFuture: stars === 1 ? current[sn]?.blockFuture : false,
      },
    }));
  }

  async function submitOrderRating(order) {
    const sn = getOrderSN(order), draft = ratingDrafts[getOrderSN(order)] || {};
    const stars = Number(draft.stars || 5), comment = String(draft.comment || '').trim(), blockFuture = Boolean(draft.blockFuture);
    if (!sn || !Number.isInteger(stars) || stars < 1 || stars > 5 || (blockFuture && stars !== 1)) {
      Alert.alert('راجع التقييم', 'اختار من نجمة إلى 5 نجوم. منع التعامل متاح مع تقييم نجمة واحدة فقط.'); return;
    }
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/rating`, { method: 'POST', token: orderToken(session?.role || 'client'), body: { stars, comment, blockFuture } });
      Alert.alert('تم حفظ التقييم', result.message || 'تم حفظ تقييمك بنجاح.');
      setRatingDrafts(current => ({ ...current, [sn]: { stars: '5', comment: '', blockFuture: false, submitted: true } }));
      setReloadKey(v => v + 1);
    } catch (err) { Alert.alert('تعذر حفظ التقييم', err.message || 'قد يكون الطلب لم يكتمل أو سبق تقييمه.'); }
  }

  async function sendAdminBroadcast() {
    const title = broadcast.title.trim(), message = broadcast.message.trim();
    if (title.length < 2 || title.length > 100 || message.length < 2 || message.length > 300) { Alert.alert('راجع الإشعار', 'العنوان من حرفين إلى 100 حرف، والرسالة من حرفين إلى 300 حرف.'); return; }
    Alert.alert('تأكيد إرسال الإشعار', `إرسال الإشعار إلى: ${broadcast.audience === 'all' ? 'الجميع' : broadcast.audience === 'clients' ? 'العملاء' : broadcast.audience === 'fannis' ? 'الفنيين' : 'فنيي القاهرة'}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إرسال', onPress: async () => {
        try { const result = await api('/admin/notifications/broadcast', { method: 'POST', token: session.token, body: { title, message, audience: broadcast.audience } }); Alert.alert('تم إرسال الإشعار', `${result.message || 'تم الإرسال'} — العدد: ${Number(result.sent || 0)}`); setBroadcast(current => ({ ...current, title: '', message: '' })); }
        catch (err) { Alert.alert('تعذر إرسال الإشعار', err.message || 'راجع صلاحيات حساب الإدارة.'); }
      } },
    ]);
  }

  async function acceptTechnicianGuidelines() {
    try {
      const result = await api('/fanni/guidelines/accept', {
        method: 'POST',
        token: session?.token,
        body: { accepted: true, version: '2026-10-20-v1' }
      });
      Alert.alert('تم تسجيل الموافقة', result.message || 'تم تسجيل موافقتك على ميثاق صُنّاع.');
      setReloadKey(value => value + 1);
    } catch (err) {
      Alert.alert('تعذر تسجيل الموافقة', err.message || 'حاول مرة أخرى.');
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
    setAdminData({ orders: [], fannis: [], clients: [], topups: [], complaints: [], loading: false, error: '', tab: 'orders' });
    setNotifications({ items: [], unread: 0, loading: false, error: '' });
    setAdminUsers([]);
    setScreen('home');
  }
  const goLogin = mode => { setAuthMode(mode); setUsername(''); setPassword(''); setScreen('login'); };
  const toggleArray = (key, value) => updateForm(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value]);

  if (screen === 'login') return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Button title="رجوع للرئيسية" secondary onPress={() => setScreen('home')} />
      <View style={styles.loginHeading}>
        <Text style={styles.title}>{authMode === 'client' ? 'دخول العميل' : 'دخول الفني'}</Text>
        <Text style={styles.subtitle}>{authMode === 'client' ? 'سجّل دخولك لمتابعة طلباتك وخدماتك.' : 'سجّل دخولك لمتابعة فرص العمل وحسابك.'}</Text>
      </View>
      <Field label="رقم الهاتف أو البريد الإلكتروني" value={username} onChangeText={setUsername} placeholder="رقم الهاتف أو البريد الإلكتروني" keyboardType="default" />
      <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholder="اكتب كلمة السر" />
      <Button title={loginLoading ? 'جاري الدخول...' : authMode === 'client' ? 'دخول العميل' : 'دخول الفني'} onPress={handleLogin} disabled={loginLoading} />
      {authMode === 'client' && <Button title="إنشاء حساب عميل جديد" secondary onPress={() => setScreen('clientRegister')} />}
      {authMode === 'fanni' && <Button title="تسجيل فني جديد" secondary onPress={() => setScreen('technicianRegister')} />}
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
          <TouchableOpacity onPress={() => setSelected(current => current?.label === category.label ? null : category)} style={styles.categoryToggle}><Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label} · {(category.services || []).length} خدمة {selected?.label === category.label ? '▲' : '▼'}</Text></TouchableOpacity>
          {selected?.label === category.label ? (category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleArray('specialties', service)} style={styles.choiceRow}><Text style={styles.choiceText}>{form.specialties.includes(service) ? '☑' : '□'} {service}</Text></TouchableOpacity>) : null}
        </View>)}
        <Text style={styles.sectionTitle}>مناطق العمل</Text>
        <View style={styles.selectionGroup}><ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>{areas.map(area => <TouchableOpacity key={area} onPress={() => toggleArray('areas', area)} style={styles.choiceRow}><Text style={styles.choiceText}>{form.areas.includes(area) ? '☑' : '□'} {area}</Text></TouchableOpacity>)}</ScrollView></View>
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
        <Text style={styles.fieldLabel}>الفئة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{categories.map(category => <TouchableOpacity key={category.label} onPress={() => setSelected(category)} style={[styles.pill, selected?.label === category.label && styles.pillActive]}><Text style={[styles.pillText, selected?.label === category.label && styles.pillTextActive]}>{category.emoji || '🛠️'} {category.label}</Text></TouchableOpacity>)}</ScrollView>
        <Text style={styles.fieldLabel}>الخدمة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{(selected?.services || []).map(service => <TouchableOpacity key={service} onPress={() => updateForm('service', service)} style={[styles.pill, form.service === service && styles.pillActive]}><Text style={[styles.pillText, form.service === service && styles.pillTextActive]}>{service}</Text></TouchableOpacity>)}</ScrollView>
        <Text style={styles.fieldLabel}>المنطقة</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{areas.map(area => <TouchableOpacity key={area} onPress={() => updateForm('area', area)} style={[styles.pill, form.area === area && styles.pillActive]}><Text style={[styles.pillText, form.area === area && styles.pillTextActive]}>{area}</Text></TouchableOpacity>)}</ScrollView>
        <Field label="العنوان بالتفصيل" value={form.address} onChangeText={v => updateForm('address', v)} placeholder="الشارع والعلامة المميزة" />
        <Field label="وصف المشكلة (اختياري)" value={form.description} onChangeText={v => updateForm('description', v)} multiline placeholder="اشرح الخدمة المطلوبة" />
        <Field label="ميزانية متوقعة (اختياري)" value={form.budget} onChangeText={v => updateForm('budget', v)} placeholder="مثال: حسب المعاينة" />
        <Button title={loginLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب الخدمة'} onPress={createOrder} disabled={loginLoading} />
      </>}
      {clientData.sn ? <Text style={styles.successText}>آخر كود طلب: {clientData.sn}</Text> : null}
      <Text style={styles.sectionTitle}>طلباتي السابقة</Text>
      {clientData.loading ? <ActivityIndicator color={COLORS.teal} /> : clientData.error ? <Text style={styles.errorText}>{clientData.error}</Text> : clientData.orders.map((order, i) => <View key={String(order._id || order.sn || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{order.sn || 'طلب خدمة'} — {order.service || ''}</Text><Text style={styles.detail}>{order.status || 'قيد المراجعة'} • {order.area || ''}</Text><Text style={styles.detail}>{dateLabel(order.createdAt)}</Text><Text style={styles.detail}>{order.acceptedOfferPrice ? `السعر المتفق عليه: ${order.acceptedOfferPrice} جنيه` : ''}</Text>{Array.isArray(order.offers) && order.offers.length ? <><Text style={styles.sectionTitle}>عروض الفنيين ({order.offers.length})</Text>{order.offers.map((offer, j) => <View key={String(offer._id || offer.id || j)} style={styles.offerCard}><Text style={styles.cardTitle}>{offer.fanniName || offer.technicianName || 'فني'} — {offer.price ?? '—'} جنيه</Text><Text style={styles.detail}>{offer.message || ''}</Text>{order.status !== 'تم اختيار فني' && order.status !== 'تم الانتهاء' && <Button title="قبول العرض" onPress={() => acceptClientOffer(order, offer)} />}</View>)}</> : <Text style={styles.detail}>لا توجد عروض حتى الآن.</Text>}
        <View style={styles.roleActions}><Button title={orderChats[order.sn]?.open ? 'إخفاء المحادثة' : 'فتح المحادثة'} secondary onPress={() => toggleOrderChat(order, 'client')} />{order.status === 'تم الانتهاء' && !ratingDrafts[order.sn]?.submitted ? <Button title="تقييم الفني" onPress={() => setRatingDrafts(current => ({ ...current, [order.sn]: { stars: '5', comment: '', blockFuture: false } }))} /> : null}</View>
        {order.status === 'تم الانتهاء' && ratingDrafts[order.sn] && !ratingDrafts[order.sn].submitted ? <View style={styles.offerCard}><Text style={styles.cardTitle}>تقييم الفني</Text><View style={styles.roleActions}>{[1,2,3,4,5].map(stars => <Button key={stars} title={'★'.repeat(stars)} secondary={Number(ratingDrafts[order.sn].stars || 5) !== stars} onPress={() => setRatingDrafts(current => ({ ...current, [order.sn]: { ...current[order.sn], stars: String(stars), blockFuture: stars === 1 ? current[order.sn]?.blockFuture : false } }))} />)}</View><Field label="تعليق (اختياري)" value={ratingDrafts[order.sn].comment || ''} onChangeText={value => setRatingDrafts(current => ({ ...current, [order.sn]: { ...current[order.sn], comment: value } }))} multiline />{Number(ratingDrafts[order.sn].stars) === 1 ? <TouchableOpacity style={styles.inlineCheck} onPress={() => setRatingDrafts(current => ({ ...current, [order.sn]: { ...current[order.sn], blockFuture: !current[order.sn]?.blockFuture } }))}><Text style={styles.detail}>{ratingDrafts[order.sn].blockFuture ? '☑' : '☐'} عدم التعامل مع الفني مستقبلًا</Text></TouchableOpacity> : null}<Button title="حفظ التقييم" onPress={() => submitOrderRating(order)} /></View> : null}
        {orderChats[order.sn]?.open ? <View style={styles.chatPanel}>{orderChats[order.sn]?.loading ? <ActivityIndicator color={COLORS.teal} /> : <>{orderChats[order.sn]?.error ? <Text style={styles.errorText}>{orderChats[order.sn].error}</Text> : null}{(orderChats[order.sn]?.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}><Text style={styles.detail}>{message.senderRole === 'client' ? 'العميل' : 'الفني'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}{(orderChats[order.sn]?.priceChangeRequests || []).filter(request => request.status === 'قيد الموافقة').map(request => <View key={String(request._id)} style={styles.priceRequest}><Text style={styles.cardTitle}>طلب تعديل السعر</Text><Text style={styles.detail}>من {request.oldPrice} إلى {request.newPrice} جنيه</Text><Text style={styles.detail}>السبب: {request.reason}</Text><View style={styles.roleActions}><Button title="موافقة" onPress={() => decideOrderPrice(order, request, true)} /><Button title="رفض" secondary onPress={() => decideOrderPrice(order, request, false)} /></View></View>)}<Field label="رسالة للفني" value={chatDrafts[order.sn] || ''} onChangeText={value => setChatDrafts(current => ({ ...current, [order.sn]: value }))} multiline placeholder="اكتب رسالتك داخل المنصة" /><View style={styles.roleActions}><Button title="إرسال الرسالة" onPress={() => sendOrderChat(order)} /><Button title="تحديث المحادثة" secondary onPress={() => refreshOrderChat(order, 'client')} /></View></>}</View> : null}</View>)}
      <View style={styles.dataCard}>
        <View style={styles.headerRow}><Text style={styles.sectionTitle}>الإشعارات {notifications.unread ? `(${notifications.unread} جديدة)` : ''}</Text><Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} disabled={!notifications.unread} /></View>
        {notifications.loading ? <ActivityIndicator color={COLORS.teal} /> : notifications.error ? <Text style={styles.errorText}>{notifications.error}</Text> : notifications.items.length ? notifications.items.map((item, i) => <TouchableOpacity key={String(item._id || item.id || i)} onPress={() => markNotificationRead(item)} style={styles.notificationRow}><Text style={styles.cardTitle}>{item.title || 'إشعار من صُنّاع'}{!(item.read || item.readAt) ? ' • جديد' : ''}</Text><Text style={styles.detail}>{item.message || ''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt)}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}
      </View>
      <Button title="تحديث البيانات" secondary onPress={() => setReloadKey(v => v + 1)} />
    </ScrollView>
  </SafeAreaView>;

  if (screen === 'technician' && session?.role === 'fanni') {
    const user = techData.profile || session.user || {};
    const tab = techData.tab;
    const displayedOffers = techData.offers.filter(item => tab === 'completed' ? item.orderStatus === 'تم الانتهاء' : item.orderStatus !== 'تم الانتهاء');
    const tabs = [{ key: 'available', label: 'الفرص' }, { key: 'offers', label: 'عروضي' }, { key: 'completed', label: 'المكتملة' }, { key: 'wallet', label: 'المحفظة' }, { key: 'profile', label: 'حسابي' }, { key: 'notifications', label: `الإشعارات${notifications.unread ? ` (${notifications.unread})` : ''}` }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>صُنّاع — الفني</Text><Text style={styles.subtitle}>أهلًا {user.name || 'بك'} · {user.status || 'قيد المراجعة'}</Text></View><Button title="خروج" secondary onPress={logout} /></View>
      {user.status === 'معتمد' && (!user.technicianGuidelinesAcceptedAt || !user.technicianGuidelinesVersion) ? <View style={styles.dataCard}><Text style={styles.cardTitle}>ميثاق التعامل المهني</Text><Text style={styles.detail}>يلزم قراءة الميثاق والموافقة عليه قبل استخدام فرص العمل والمحادثات. بالموافقة تلتزم بعدم مشاركة أرقام التواصل أو الروابط داخل المنصة، واحترام العميل والسعر المتفق عليه، وعدم تنفيذ أي زيادة قبل موافقة العميل.</Text><Button title="أوافق على ميثاق صُنّاع" onPress={acceptTechnicianGuidelines} /></View> : null}
      <View style={styles.tabRow}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => setTechData(v => ({ ...v, tab: item.key }))} style={[styles.pill, tab === item.key && styles.pillActive]}><Text style={[styles.pillText, tab === item.key && styles.pillTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
      {offerDraft ? <View style={styles.dataCard}>
        <Text style={styles.cardTitle}>تقديم عرض على {offerDraft.order.service || 'الخدمة'} — {offerDraft.order.sn}</Text>
        <Field label="السعر بالجنيه" value={offerDraft.price} onChangeText={value => setOfferDraft(current => ({ ...current, price: value }))} keyboardType="numeric" />
        <Field label="رسالة للعميل" value={offerDraft.message} onChangeText={value => setOfferDraft(current => ({ ...current, message: value }))} multiline />
        <Button title="إرسال العرض" onPress={submitOffer} />
        <Button title="إلغاء" secondary onPress={() => setOfferDraft(null)} />
      </View> : null}
      <View style={{ flex: 1 }}>
        {techData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الفني من الخادم...</Text></View> : <>
          {techData.error ? <Text style={styles.errorText}>{techData.error}</Text> : null}
          {tab === 'available' && <FlatList style={{ flex: 1 }} contentContainerStyle={styles.list} data={techData.orders} keyExtractor={(item, i) => String(item._id || item.sn || i)} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد فرص متاحة حاليًا أو الحساب لم يُعتمد بعد.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.service || 'طلب خدمة'} — {item.sn || ''}</Text><Text style={styles.detail}>{item.area || ''} • {item.status || ''}</Text><Text style={styles.detail}>{item.description || item.desc || 'تفاصيل الطلب تظهر حسب صلاحيات الخادم.'}</Text><Button title="تقديم عرض" onPress={() => sendOffer(item)} /></View>} />}
          {(tab === 'offers' || tab === 'completed') && <FlatList style={{ flex: 1 }} contentContainerStyle={styles.list} data={displayedOffers} keyExtractor={(item, i) => String(item._id || item.orderSn || i)} ListEmptyComponent={<Text style={styles.emptyText}>{tab === 'completed' ? 'لا توجد طلبات مكتملة في السجل حتى الآن.' : 'لسه ماقدمتش عروض نشطة.'}</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.service || 'خدمة'} — {item.orderSn || item.sn || ''}</Text><Text style={styles.detail}>السعر: {item.price || item.priceNum || '—'} جنيه • {item.orderStatus || ''}</Text><Text style={styles.detail}>{item.message || ''}</Text>{item.client ? <Text style={styles.detail}>العميل: {item.client.name || ''} — {item.client.phone || ''} — {item.client.address || ''}</Text> : null}<View style={styles.roleActions}><Button title={orderChats[getOrderSN(item)]?.open ? 'إخفاء المحادثة' : 'محادثة الطلب'} secondary onPress={() => toggleOrderChat(item, 'fanni')} />{item.orderStatus === 'تم اختيار فني' ? <Button title="إنهاء الخدمة" onPress={() => completeTechnicianOrder(item)} /> : null}</View>
          {item.orderStatus === 'تم اختيار فني' ? <View style={styles.offerCard}><Text style={styles.cardTitle}>طلب تعديل السعر</Text><Field label="السعر الجديد بالجنيه" value={priceDrafts[getOrderSN(item)]?.price || ''} onChangeText={value => setPriceDrafts(current => ({ ...current, [getOrderSN(item)]: { ...current[getOrderSN(item)], price: value } }))} keyboardType="numeric" /><Field label="سبب التعديل" value={priceDrafts[getOrderSN(item)]?.reason || ''} onChangeText={value => setPriceDrafts(current => ({ ...current, [getOrderSN(item)]: { ...current[getOrderSN(item)], reason: value } }))} multiline /><Button title="إرسال طلب تعديل السعر" onPress={() => requestOrderPriceChange(item)} /></View> : null}
          {item.orderStatus === 'تم الانتهاء' && !ratingDrafts[getOrderSN(item)]?.submitted ? (
            <View style={styles.offerCard}>
              <Text style={styles.cardTitle}>تقييم العميل</Text>
              <View style={styles.roleActions}>
                {[1, 2, 3, 4, 5].map(stars => (
                  <Button
                    key={stars}
                    title={'★'.repeat(stars)}
                    secondary={Number(ratingDrafts[getOrderSN(item)]?.stars || 5) !== stars}
                    onPress={() => setOrderRatingStars(item, stars)}
                  />
                ))}
              </View>
              <Field
                label="تعليق (اختياري)"
                value={ratingDrafts[getOrderSN(item)]?.comment || ''}
                onChangeText={value => setRatingDrafts(current => ({
                  ...current,
                  [getOrderSN(item)]: { ...current[getOrderSN(item)], comment: value },
                }))}
                multiline
              />
              <Button title="حفظ تقييم العميل" onPress={() => submitOrderRating(item)} />
            </View>
          ) : null}
          {orderChats[getOrderSN(item)]?.open ? <View style={styles.chatPanel}>{orderChats[getOrderSN(item)]?.loading ? <ActivityIndicator color={COLORS.teal} /> : <>{orderChats[getOrderSN(item)]?.error ? <Text style={styles.errorText}>{orderChats[getOrderSN(item)].error}</Text> : null}{(orderChats[getOrderSN(item)]?.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}><Text style={styles.detail}>{message.senderRole === 'client' ? 'العميل' : 'الفني'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}{(orderChats[getOrderSN(item)]?.priceChangeRequests || []).filter(request => request.status === 'قيد الموافقة').map(request => <View key={String(request._id)} style={styles.priceRequest}><Text style={styles.cardTitle}>طلب تعديل السعر</Text><Text style={styles.detail}>من {request.oldPrice} إلى {request.newPrice} جنيه • {request.status}</Text><Text style={styles.detail}>{request.reason}</Text></View>)}<Field label="ردك داخل المنصة" value={chatDrafts[getOrderSN(item)] || ''} onChangeText={value => setChatDrafts(current => ({ ...current, [getOrderSN(item)]: value }))} multiline /><View style={styles.roleActions}><Button title="إرسال الرسالة" onPress={() => sendOrderChat(item)} /><Button title="تحديث المحادثة" secondary onPress={() => refreshOrderChat(item, 'fanni')} /></View></>}</View> : null}</View>} />}
          {tab === 'wallet' && <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>المحفظة: {Number(user.walletBalance || user.balance || 0)} جنيه</Text><Field label="مبلغ الشحن بالجنيه" value={topup.amount} onChangeText={v => setTopup(t => ({ ...t, amount: v }))} keyboardType="numeric" /><Field label="رقم المحوّل" value={topup.fromPhone} onChangeText={v => setTopup(t => ({ ...t, fromPhone: v }))} keyboardType="phone-pad" /><Field label="رقم مرجع التحويل (اختياري)" value={topup.reference} onChangeText={v => setTopup(t => ({ ...t, reference: v }))} /><Button title="إرسال طلب شحن للمراجعة" onPress={submitTopup} /><Text style={styles.sectionTitle}>سجل المحفظة</Text>{techData.wallet.map((item, i) => <View key={String(item._id || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.type || item.status || 'حركة محفظة'}</Text><Text style={styles.detail}>{item.amount || ''} جنيه • {dateLabel(item.createdAt || item.date)}</Text></View>)}</ScrollView>}
          {tab === 'profile' && <ScrollView contentContainerStyle={styles.page}><View style={styles.dataCard}><Text style={styles.cardTitle}>{user.name || 'الفني'}</Text><Text style={styles.detail}>الهاتف: {user.phone || ''}</Text><Text style={styles.detail}>الحالة: {user.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>المستوى المهني: {user.level || 'مبتدئ'}</Text><Text style={styles.detail}>الصفة الإدارية: {user.adminRole || 'فني'}</Text><Text style={styles.detail}>الشارات: {(user.badges || []).map(b => typeof b === 'string' ? b : b.label || b.name || '').filter(Boolean).join('، ') || 'لا توجد شارات حتى الآن'}</Text><Text style={styles.detail}>الخدمات: {(user.specialties || []).join('، ') || '—'}</Text><Text style={styles.detail}>المناطق: {(user.areas || []).join('، ') || '—'}</Text><Text style={styles.detail}>الرصيد: {Number(user.walletBalance || user.balance || 0)} جنيه</Text></View><Button title="تحديث بيانات الحساب" secondary onPress={() => setReloadKey(v => v + 1)} /></ScrollView>}
          {tab === 'notifications' && <ScrollView contentContainerStyle={styles.page}><View style={styles.headerRow}><Text style={styles.sectionTitle}>إشعارات الفني</Text><Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} disabled={!notifications.unread} /></View>{notifications.loading ? <ActivityIndicator color={COLORS.teal} /> : notifications.error ? <Text style={styles.errorText}>{notifications.error}</Text> : notifications.items.length ? notifications.items.map((item, i) => <TouchableOpacity key={String(item._id || item.id || i)} onPress={() => markNotificationRead(item)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.title || 'إشعار'}{!(item.read || item.readAt) ? ' • جديد' : ''}</Text><Text style={styles.detail}>{item.message || ''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt)}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</ScrollView>}
        </>}
      </View>
    </SafeAreaView>;
  }

  if (screen === 'admin' && session?.role === 'admin') {
    const tab = adminData.tab;
    const items = tab === 'levels' || tab === 'roles' ? adminData.fannis : adminData[tab] || [];
    const tabs = [{ key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' }, { key: 'clients', label: 'العملاء' }, { key: 'topups', label: 'طلبات الشحن' }, { key: 'complaints', label: 'الشكاوى' }, { key: 'levels', label: 'المستوى المهني' }, ...(session.user?.role === 'admin' ? [{ key: 'roles', label: 'المناصب الإدارية' }, { key: 'notifications', label: 'إرسال إشعار' }] : [])];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitle}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRow}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => setAdminData(v => ({ ...v, tab: item.key }))} style={[styles.pill, tab === item.key && styles.pillActive]}><Text style={[styles.pillText, tab === item.key && styles.pillTextActive]}>{item.label}{['orders','fannis','clients','topups','complaints'].includes(item.key) ? ` (${(adminData[item.key] || []).length})` : ''}</Text></TouchableOpacity>)}</View>
      {adminData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الإدارة...</Text></View> : <View style={{ flex: 1 }}>
        {adminData.error ? <Text style={styles.errorText}>{adminData.error}</Text> : null}
        {tab === 'topups' ? <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد طلبات شحن.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.amount || 0} جنيه — {item.actualStatus || item.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>هاتف المحوّل: {item.fromPhone || '—'}</Text><Text style={styles.detail}>رقم المرجع: {item.referenceNumber || item.reference || '—'}</Text><Text style={styles.detail}>تاريخ الطلب: {dateLabel(item.createdAt)}</Text>{(item.status === 'pending' || item.actualStatus === 'قيد المراجعة') ? <View style={styles.roleActions}><Button title="اعتماد وإضافة الرصيد" onPress={() => reviewTopup(item, 'approve')} /><Button title="رفض" secondary onPress={() => reviewTopup(item, 'reject')} /></View> : <Text style={styles.detail}>تمت مراجعة الطلب.</Text>}</View>} /> : tab === 'complaints' ? <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد شكاوى.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>شكوى الطلب {item.sn || '—'}</Text><Text style={styles.detail}>الحالة: {item.status || 'جديدة'} • {item.type || item.category || 'شكوى'}</Text><Text style={styles.detail}>{item.message || item.text || item.description || 'لا يوجد نص للشكوى'}</Text><View style={styles.roleActions}><Button title="قيد المراجعة" secondary onPress={() => setComplaintStatus(item, 'قيد المراجعة')} /><Button title="تم الحل" onPress={() => setComplaintStatus(item, 'تم الحل')} /><Button title="مرفوضة" secondary onPress={() => setComplaintStatus(item, 'مرفوضة')} /></View></View>} /> : tab === 'notifications' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>إرسال إشعار داخل التطبيق</Text><Text style={styles.detail}>الإشعار يظهر للحسابات المستهدفة داخل تطبيق صُنّاع.</Text><Field label="عنوان الإشعار" value={broadcast.title} onChangeText={value => setBroadcast(current => ({ ...current, title: value }))} placeholder="مثال: تحديث مهم" /><Field label="نص الإشعار" value={broadcast.message} onChangeText={value => setBroadcast(current => ({ ...current, message: value }))} multiline placeholder="اكتب الرسالة هنا" /><Text style={styles.fieldLabel}>المستلمون</Text><View style={styles.roleActions}>{[{key:'all',label:'الجميع'},{key:'clients',label:'العملاء'},{key:'fannis',label:'الفنيون'},{key:'cairo_fannis',label:'فنيّو القاهرة'}].map(option => <Button key={option.key} title={option.label} secondary={broadcast.audience !== option.key} onPress={() => setBroadcast(current => ({ ...current, audience: option.key }))} />)}</View><Button title="إرسال الإشعار" onPress={sendAdminBroadcast} /></ScrollView> : tab === 'roles' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>التسلسل الإداري والصلاحيات</Text>
          <Text style={styles.detail}>المدير العام فقط يستطيع تعيين المناصب أو سحبها. الخادم هو الذي يفرض الصلاحيات فعليًا.</Text>
          {adminUsersLoading ? <ActivityIndicator color={COLORS.teal} /> : adminUsers.map((u, i) => <View key={String(u.id || u._id || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{u.name || 'حساب إداري'}</Text><Text style={styles.detail}>{u.phone || ''} • {u.adminRole || (u.role === 'admin' ? 'مدير عام' : 'فني')}</Text>{u.role !== 'admin' ? <Button title="سحب المنصب الإداري" secondary onPress={() => revokeAdminRoleForUser(u)} /> : <Text style={styles.detail}>حساب المدير العام الأساسي.</Text>}</View>)}
          <Text style={styles.sectionTitle}>ترقية فني معتمد إلى منصب إداري</Text>
          {adminData.fannis.filter(f => (f.status === 'معتمد' || f.status === 'approved') && !f.adminRole).map((f, i) => <View key={String(f._id || f.id || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{f.name || 'فني'} — {f.phone || ''}</Text><View style={styles.roleActions}>{['قراءة فقط', 'مشرف', 'مشرف أول', 'مدير'].map(role => <Button key={role} title={role} secondary onPress={() => changeAdminRoleForFanni(f, role)} />)}</View></View>)}
        </ScrollView> : tab === 'levels' ? <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>لا يوجد فنّيون لعرض مستوياتهم.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.name || 'فني'} — {item.level || 'مبتدئ'}</Text><Text style={styles.detail}>{item.phone || ''} • {item.status || item.actualStatus || ''}</Text><Text style={styles.detail}>الشارات: {(item.badges || []).map(b => typeof b === 'string' ? b : b.label || b.name || '').filter(Boolean).join('، ') || 'لا توجد شارات'}</Text><Button title="ترقية للمستوى التالي" onPress={() => updateProfessionalLevel(item)} /></View>} /> : <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || item.sn || item.phone || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات لعرضها حاليًا.</Text>} renderItem={({ item }) => {
          const title = tab === 'orders' ? (item.sn || item.service || 'طلب خدمة') : (item.name || item.phone || (tab === 'fannis' ? 'فني' : 'عميل'));
          const detail = tab === 'orders' ? [item.status, item.service, item.area, item.createdAt ? dateLabel(item.createdAt) : ''].filter(Boolean).join(' • ')
            : tab === 'fannis' ? [item.phone, item.status || item.actualStatus, Array.isArray(item.specialties) ? item.specialties.join('، ') : item.skill].filter(Boolean).join(' • ')
            : [item.phone, item.orderCount ? `عدد الطلبات: ${item.orderCount}` : '', item.lastOrder ? `آخر طلب: ${item.lastOrder}` : ''].filter(Boolean).join(' • ');
          return <View style={styles.dataCard}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.detail}>{detail || 'لا توجد تفاصيل إضافية'}</Text>{tab === 'orders' && session.user?.role === 'admin' && item.status === 'قيد المراجعة' ? <Button title="نشر الطلب للفنيين" onPress={() => publishOrder(item)} /> : null}{tab === 'fannis' && !item.isApproved && !item.isDisabled ? <View style={styles.roleActions}><Button title="اعتماد الفني" onPress={() => moderateTechnician(item, 'approve')} /><Button title="رفض" secondary onPress={() => moderateTechnician(item, 'reject')} /></View> : tab === 'fannis' && item.isApproved ? <Button title="تعليق الفني" secondary onPress={() => moderateTechnician(item, 'disable')} /> : tab === 'fannis' && item.isDisabled ? <Button title="إعادة تفعيل الفني" onPress={() => moderateTechnician(item, 'enable')} /> : null}</View>;
        }} />}
        <Button title="إعادة تحميل بيانات الإدارة" secondary onPress={() => setReloadKey(v => v + 1)} />
      </View>}
      <Text style={styles.note}>هذه نسخة ربط أولية للعرض والقراءة. أوامر الإدارة الحساسة تحتاج واجهات منفصلة واختبارات صلاحيات قبل تفعيلها.</Text>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.homePage}>
      <View style={styles.welcomeHero}>
        <View style={styles.logoGlow}>
          <View style={styles.logoRing}><Text style={styles.logoLetter}>ص</Text></View>
        </View>
        <Text style={styles.homeBrandTitle}>صُنّاع</Text>
        <Text style={styles.homeTagline}>خدماتك في إيدك.. وفنيك أقرب مما تتخيل</Text>
        <Text style={styles.homeIntro}>سواء كنت عميلًا بتدور على فني موثوق، أو فني عايز توصل لعملاء جدد، صُنّاع بيسهّل عليك البداية.</Text>
      </View>
      <View style={styles.roleCards}>
        <TouchableOpacity accessibilityRole="button" onPress={() => goLogin('client')} style={styles.roleCard}>
          <View style={styles.clientIconCircle}><Text style={styles.roleIcon}>👤</Text></View>
          <Text style={styles.roleTitle}>الدخول كعميل</Text>
          <Text style={styles.roleDescription}>اطلب الخدمة اللي محتاجها وتابع طلبك بسهولة.</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => goLogin('fanni')} style={styles.roleCard}>
          <View style={styles.technicianIconCircle}><Text style={styles.roleIcon}>🛠️</Text></View>
          <Text style={styles.roleTitle}>الدخول كفني</Text>
          <Text style={styles.roleDescription}>تابع فرص الشغل وطلبات الخدمات من حسابك.</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dataCard}><Text style={styles.sectionTitle}>خدمات متنوعة في مكان واحد</Text><Text style={styles.detail}>اختار إنك عميل لطلب خدمة، أو فني لمتابعة فرص العمل. هتلاقي قائمة المهن والخدمات كاملة داخل الحساب عند الحاجة.</Text><View style={styles.homeSummary}><Text style={styles.emoji}>🛠️</Text><Text style={styles.cardTitle}>مهن وخدمات متعددة</Text></View></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 16, paddingBottom: 34, gap: 10 },
  homePage: { padding: 16, paddingBottom: 34, gap: 14 },
  flex: { flex: 1 },
  welcomeHero: { alignItems: 'center', backgroundColor: COLORS.navy, borderWidth: 1, borderColor: '#29466E', borderRadius: 28, padding: 24, shadowColor: COLORS.navy, shadowOpacity: 0.34, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12, overflow: 'hidden' },
  logoGlow: { width: 112, height: 112, borderRadius: 56, borderWidth: 2, borderColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', shadowColor: COLORS.teal, shadowOpacity: 0.85, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 16, marginBottom: 14 },
  logoRing: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.navy, shadowOpacity: 0.16, shadowRadius: 7, elevation: 5 },
  logoLetter: { color: COLORS.navy, fontSize: 48, fontWeight: '900' },
  homeBrandTitle: { color: COLORS.white, fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: 0.4 },
  homeTagline: { color: COLORS.gold, fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 7, lineHeight: 25 },
  homeIntro: { color: '#D9E5F6', fontSize: 14, textAlign: 'center', lineHeight: 24, marginTop: 10 },
  roleCards: { flexDirection: 'column', gap: 13 },
  roleCard: { width: '100%', minHeight: 118, flexDirection: 'row-reverse', alignItems: 'center', gap: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#DCE5F1', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 18, shadowColor: COLORS.navy, shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  clientIconCircle: { width: 62, height: 62, borderRadius: 22, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center', marginBottom: 0, borderWidth: 1, borderColor: '#C7DAF8', shadowColor: '#2563EB', shadowOpacity: 0.14, shadowRadius: 8, elevation: 3 },
  technicianIconCircle: { width: 62, height: 62, borderRadius: 22, backgroundColor: '#FFF2CC', alignItems: 'center', justifyContent: 'center', marginBottom: 0, borderWidth: 1, borderColor: '#F2D88C', shadowColor: '#F5B928', shadowOpacity: 0.16, shadowRadius: 8, elevation: 3 },
  roleIcon: { fontSize: 30 },
  roleTitle: { color: COLORS.navy, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  roleDescription: { color: COLORS.muted, fontSize: 12, textAlign: 'right', lineHeight: 19, marginTop: 5, flexShrink: 1 },
  loginHeading: { alignItems: 'flex-end', gap: 3, marginVertical: 8 },
  title: { fontSize: 25, fontWeight: 'bold', color: COLORS.navy, textAlign: 'right' },
  subtitle: { color: COLORS.muted, marginTop: 5, textAlign: 'right', lineHeight: 21 },
  hero: { color: COLORS.navy, fontSize: 22, fontWeight: 'bold', textAlign: 'right', marginTop: 12 },
  brand: { backgroundColor: COLORS.navy, color: COLORS.white, fontSize: 30, fontWeight: 'bold', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  homeHeader: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  homeButtons: { gap: 8, marginVertical: 12 },
  button: { backgroundColor: COLORS.navy, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginVertical: 3, minHeight: 46, maxWidth: '100%', flexShrink: 1, borderWidth: 1, borderColor: '#29466E', shadowColor: COLORS.navy, shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  buttonText: { color: COLORS.white, fontWeight: '800', fontSize: 13, textAlign: 'center', flexShrink: 1 },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DFEC', shadowOpacity: 0.04, elevation: 1 },
  buttonSecondaryText: { color: COLORS.navy },
  disabledButton: { opacity: 0.55 },
  fieldWrap: { marginVertical: 5 },
  fieldLabel: { color: COLORS.navy, fontWeight: 'bold', marginTop: 7, marginBottom: 6, textAlign: 'right' },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#D5DFEC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 16, minHeight: 48 },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  note: { color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 19, marginVertical: 8 },
  notificationRow: { paddingVertical: 13, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4, backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 5 },
  homeSummary: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDFA', borderRadius: 12, padding: 12 },
  roleActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start', gap: 7, marginTop: 8 },
  chatPanel: { backgroundColor: '#F3F7FD', borderWidth: 1, borderColor: '#D8E4F3', borderRadius: 18, padding: 12, marginTop: 11, shadowColor: COLORS.navy, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  chatMessage: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 8, marginVertical: 4 },
  chatMessageText: { color: COLORS.text, textAlign: 'right', lineHeight: 21, marginTop: 4 },
  priceRequest: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 10, marginVertical: 6 },
  inlineCheck: { paddingVertical: 8 },
  tabRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginVertical: 8, paddingHorizontal: 12 },
  tabPill: { flexShrink: 1, maxWidth: '100%' },
  pill: { borderRadius: 18, borderWidth: 1, borderColor: '#D9E3F0', backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 9, marginRight: 4, marginVertical: 3, maxWidth: '100%' },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.gold, shadowColor: COLORS.navy, shadowOpacity: 0.14, shadowRadius: 5, elevation: 2 },
  pillText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: COLORS.white },
  sectionTitle: { color: COLORS.navy, fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginTop: 12, marginBottom: 5 },
  selectionGroup: { backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 10, marginVertical: 5 },
  categoryToggle: { paddingVertical: 5 },
  offerCard: { backgroundColor: '#F4F8FE', borderWidth: 1, borderColor: '#DCE6F3', borderRadius: 16, padding: 12, marginTop: 9, shadowColor: COLORS.navy, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  groupTitle: { color: COLORS.navy, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  choiceRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  choiceText: { color: COLORS.text, textAlign: 'right' },
  headerRow: { padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  statusText: { marginTop: 12, color: '#64748B', textAlign: 'center' },
  dataCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E0E8F2', borderRadius: 19, padding: 15, marginVertical: 7, shadowColor: COLORS.navy, shadowOpacity: 0.065, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { color: COLORS.navy, fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  detail: { color: COLORS.muted, marginTop: 6, textAlign: 'right', lineHeight: 20 },
  errorText: { color: COLORS.red, textAlign: 'right', marginVertical: 8, lineHeight: 21, paddingHorizontal: 12 },
  successText: { color: '#047857', fontWeight: '800', textAlign: 'right', marginVertical: 10, flexWrap: 'wrap' },
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

class StartupErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Sonaa startup render error:', error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 12 }}>تعذر تشغيل شاشة صُنّاع</Text>
        <Text selectable style={{ color: '#B91C1C', textAlign: 'left', marginBottom: 20 }}>{String(this.state.error?.message || this.state.error)}</Text>
        <TouchableOpacity onPress={() => this.setState({ error: null })} style={{ backgroundColor: '#14B8A6', padding: 14, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>إعادة المحاولة</Text></TouchableOpacity>
      </SafeAreaView>;
    }
    return this.props.children;
  }
}

export default function App() {
  return <SafeAreaProvider><StartupErrorBoundary><AppContent /></StartupErrorBoundary></SafeAreaProvider>;
}
