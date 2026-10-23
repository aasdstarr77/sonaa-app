import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import {
  View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, BackHandler, Linking, Modal
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
const COLORS = { navy: '#0F4C75', navy2: '#104775', blue: '#1565A0', gold: '#F5B928', teal: '#0E9A9A', bg: '#F8FAFC', text: '#152544', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', red: '#B91C1C' };

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
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('استغرق إرسال التقييم أكثر من 30 ثانية. راجع الاتصال ثم حاول مرة أخرى؛ ولو كان التقييم اتسجل بالفعل فالتطبيق سيتعامل مع ذلك.');
    throw new Error('تعذر الاتصال بالإنترنت أو بالخادم. تأكد من الاتصال ثم أعد المحاولة.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || `خطأ من الخادم (${response.status})`);
    error.status = response.status;
    throw error;
  }
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
function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = 'default', multiline = false, autoCapitalize = 'none', returnKeyType = 'default', onSubmitEditing, blurOnSubmit = false }) {
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor="#94A3B8"
      secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
      multiline={multiline} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} blurOnSubmit={blurOnSubmit} textAlign="right" style={[styles.input, multiline && styles.multiline]} />
  </View>;
}

function AppScreens({ onScreenChange }) {
  const [screen, setScreenState] = useState('home');
  useEffect(() => { onScreenChange?.(screen); }, [screen, onScreenChange]);
  const screenHistoryRef = useRef([]);
  const screenRef = useRef('home');
  const pushTokenRef = useRef(null);
  const setScreen = next => {
    const target = typeof next === 'function' ? next(screenRef.current) : next;
    if (target === screenRef.current) return;
    screenHistoryRef.current.push(screenRef.current);
    if (screenHistoryRef.current.length > 40) screenHistoryRef.current.shift();
    screenRef.current = target;
    setScreenState(target);
  };
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [session, setSession] = useState(null);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authMode, setAuthMode] = useState('fanni');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '', service: '', area: '', address: '', description: '', budget: '', specialties: [] });
  const [clientData, setClientData] = useState({ orders: [], loading: false, error: '', sn: '', clientToken: '' });
  const [techData, setTechData] = useState({ profile: null, orders: [], offers: [], wallet: [], loading: false, error: '', tab: 'offers' });
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [technicianServiceFilter, setTechnicianServiceFilter] = useState('الكل');
  const [guidelinesChecked, setGuidelinesChecked] = useState(false);
  const [adminData, setAdminData] = useState({ orders: [], fannis: [], clients: [], topups: [], complaints: [], loading: false, error: '', tab: 'orders' });
  const [topup, setTopup] = useState({ amount: '', fromPhone: '', reference: '', method: 'vodafone_cash' });
  const [clientTab, setClientTab] = useState('current');
  const [clientServiceSearch, setClientServiceSearch] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [subservicePickerOpen, setSubservicePickerOpen] = useState(false);
  const [requestStep, setRequestStep] = useState(1);
  const [requestJobType, setRequestJobType] = useState('');
  const [requestLocation, setRequestLocation] = useState('');
  const [requestPhotos, setRequestPhotos] = useState([]);
  const [ratingPrompt, setRatingPrompt] = useState(null);
  const [dismissedRatings, setDismissedRatings] = useState({});
  const [ratingDismissalsLoaded, setRatingDismissalsLoaded] = useState(false);
  const [ratingDismissalsLoadedFor, setRatingDismissalsLoadedFor] = useState('');
  const [clientTrackSN, setClientTrackSN] = useState('');
  const [clientTrackedOrder, setClientTrackedOrder] = useState(null);
  const [clientTrackError, setClientTrackError] = useState('');
  const [clientTrackLoading, setClientTrackLoading] = useState(false);
  const [clientComplaint, setClientComplaint] = useState({ sn: '', name: '', text: '', loading: false, error: '' });
  const [clientComplaintTrack, setClientComplaintTrack] = useState({ sn: '', name: '', loading: false, error: '', result: null });
  const [expandedClientOrders, setExpandedClientOrders] = useState({});
  const [expandedTechnicianOrders, setExpandedTechnicianOrders] = useState({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const clientScrollRef = useRef(null);
  const chatScrollRef = useRef(null);
  const clientChatScrollRefs = useRef({});
  const clientChatAtBottomRef = useRef({});
  const ratingSubmittingRef = useRef(new Set());
  const [offerDraft, setOfferDraft] = useState(null);
  const [notifications, setNotifications] = useState({ items: [], unread: 0, loading: false, error: '' });
  const [orderChats, setOrderChats] = useState({});
  const orderChatsRef = useRef(orderChats);
  const acceptedChatAutoOpenedRef = useRef({});
  useEffect(() => { orderChatsRef.current = orderChats; }, [orderChats]);
  const [chatDrafts, setChatDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingSubmitting, setRatingSubmitting] = useState({});
  const dismissedRatingsRef = useRef({});
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminExtras, setAdminExtras] = useState({ services: [], regions: [], pricing: { check: 0, commission: 0, minOffer: 1, maxOffer: 1000000 }, pricingHistory: [], settings: { siteName: 'صُنّاع', maintenance: false, maintenanceMessage: '', maxFanniSignupAttempts: 5 }, content: { announcement: '', faqs: [] }, auditLogs: [], report: null, loading: false, error: '' });
  const [adminServiceDraft, setAdminServiceDraft] = useState({ name: '', category: 'خدمات أخرى', emoji: '🔧' });
  const [adminServiceEdit, setAdminServiceEdit] = useState({ category: '', oldName: '', name: '' });
  const [adminRegionDraft, setAdminRegionDraft] = useState('');
  const [adminAnnouncementDraft, setAdminAnnouncementDraft] = useState('');
  const [adminFaqDraft, setAdminFaqDraft] = useState({ question: '', answer: '' });
  const [adminReportFilters, setAdminReportFilters] = useState({ startDate: '', endDate: '', service: '', area: '' });
  const [adminWallet, setAdminWallet] = useState({ fanniId: '', transactions: [], loading: false, amount: '', reason: '' });
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', audience: 'all' });
  const [supportCases, setSupportCases] = useState([]);
  const [supportCase, setSupportCase] = useState(null);
  const [supportDraft, setSupportDraft] = useState('');
  const [supportSubject, setSupportSubject] = useState('استفسار عام');
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [accountPasswordForm, setAccountPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', loading: false, error: '' });
  const [recoveryForm, setRecoveryForm] = useState({ role: 'client', phone: '', token: '', id: '', messages: [], text: '', code: '', newPassword: '', confirmPassword: '', loading: false, error: '', info: '' });
  const [adminSupportCases, setAdminSupportCases] = useState([]);
  const [adminSupportSelected, setAdminSupportSelected] = useState(null);
  const [adminSupportDraft, setAdminSupportDraft] = useState('');
  const [adminRecoveryCases, setAdminRecoveryCases] = useState([]);
  const [adminRecoverySelected, setAdminRecoverySelected] = useState(null);
  const [adminRecoveryCode, setAdminRecoveryCode] = useState('');
  const [adminRecoveryDraft, setAdminRecoveryDraft] = useState('');

  const services = useMemo(() => categories.flatMap(category => (category.services || []).map(service => ({ category: category.label, service }))), [categories]);
  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const ratingAccountId = String(session?.user?.phone || session?.user?._id || session?.user?.id || 'account').trim().replace(/\s+/g, '');
  const ratingStorageKey = `sonaa.rating.dismissed.v3:${session?.role || 'guest'}`;
  const legacyRatingStorageKey = `sonaa.rating.dismissed.v1:${session?.role || 'guest'}:${session?.user?._id || session?.user?.id || session?.user?.phone || 'account'}`;
  const previousRatingStorageKey = `sonaa.rating.dismissed.v2:${session?.role || 'guest'}:${ratingAccountId}`;

  useEffect(() => {
    let active = true;
    setRatingDismissalsLoaded(false);
    setRatingDismissalsLoadedFor('');
    if (!session || !['client', 'fanni'].includes(session.role)) {
      dismissedRatingsRef.current = {};
      setDismissedRatings({});
      setRatingDismissalsLoadedFor(ratingStorageKey);
      setRatingDismissalsLoaded(true);
      return () => { active = false; };
    }
    (async () => {
      try {
        const [currentRaw, previousRaw, legacyRaw] = await Promise.all([
          SecureStore.getItemAsync(ratingStorageKey),
          previousRatingStorageKey === ratingStorageKey ? Promise.resolve(null) : SecureStore.getItemAsync(previousRatingStorageKey),
          legacyRatingStorageKey === ratingStorageKey || legacyRatingStorageKey === previousRatingStorageKey ? Promise.resolve(null) : SecureStore.getItemAsync(legacyRatingStorageKey),
        ]);
        if (!active) return;
        const parseDismissals = raw => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
          } catch (_) { return {}; }
        };
        const current = parseDismissals(currentRaw);
        const previous = parseDismissals(previousRaw);
        const legacy = parseDismissals(legacyRaw);
        const saved = { ...legacy, ...previous, ...current };
        dismissedRatingsRef.current = saved;
        setDismissedRatings(saved);
        if (Object.keys(saved).length && (!currentRaw || !previousRaw || !legacyRaw)) {
          await SecureStore.setItemAsync(ratingStorageKey, JSON.stringify(saved));
        }
      } catch (error) {
        console.warn('تعذر استعادة حالات تخطي التقييم:', error?.message || error);
      } finally {
        if (active) {
          setRatingDismissalsLoadedFor(ratingStorageKey);
          setRatingDismissalsLoaded(true);
        }
      }
    })();
    return () => { active = false; };
  }, [ratingStorageKey, legacyRatingStorageKey, session?.role, session?.user?._id, session?.user?.id, session?.user?.phone]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      let saved = null;
      try {
        const raw = await SecureStore.getItemAsync('sonaa.auth.session.v1');
        if (!raw) return;
        saved = JSON.parse(raw);
        if (!saved?.token || !['client', 'fanni'].includes(saved.role)) {
          await SecureStore.deleteItemAsync('sonaa.auth.session.v1');
          return;
        }
        let restoreTimer;
        try {
          const endpoint = saved.role === 'client' ? '/client/me' : '/fanni/me';
          const result = await Promise.race([
            api(endpoint, { token: saved.token }),
            new Promise((_, reject) => {
              restoreTimer = setTimeout(() => reject(new Error('انتهت مهلة الاتصال أثناء استعادة الحساب.')), 15000);
            }),
          ]);
          const user = result.client || result.user || saved.user;
          if (!user) throw new Error('استجابة التحقق من الجلسة غير مكتملة.');
          saved = { token: saved.token, user, role: saved.role };
          await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(saved));
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) {
            await SecureStore.deleteItemAsync('sonaa.auth.session.v1');
            return;
          }
          if (!saved.user) throw error;
        } finally {
          if (restoreTimer) clearTimeout(restoreTimer);
        }
        if (!mounted) return;
        setSession(saved);
        const target = saved.role === 'client' ? 'client' : 'technician';
        screenRef.current = target;
        setScreenState(target);
      } catch (error) {
        console.warn('تعذر استعادة جلسة صُنّاع:', error?.message || error);
      } finally {
        if (mounted) setAuthRestoring(false);
      }
    }
    void restoreSession();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const onHardwareBack = () => {
      if (offerDraft) { setOfferDraft(null); return true; }
      if (notificationsOpen) { setNotificationsOpen(false); return true; }
      let previous = screenHistoryRef.current.pop();
      if (screen === 'home') return false;
      while (previous && ['home', 'login', 'clientRegister', 'technicianRegister'].includes(previous) && session) {
        previous = screenHistoryRef.current.pop();
      }
      if (previous) { screenRef.current = previous; setScreenState(previous); return true; }
      if (session) { logout(); return true; }
      if (screen !== 'home') { screenRef.current = 'home'; setScreenState('home'); return true; }
      Alert.alert('صُنّاع', 'أنت بالفعل في الصفحة الرئيسية.');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [screen, offerDraft, notificationsOpen, session]);

  useEffect(() => {
    if (!['client', 'clientRegister', 'technicianRegister'].includes(screen)) return;
    let mounted = true;
    async function loadPublicData() {
      setServicesLoading(true); setServicesError('');
      try {
        const serviceResult = await api('/services');
        if (!Array.isArray(serviceResult.categories)) throw new Error('قائمة الخدمات من الخادم غير صحيحة');
        if (!mounted) return;
        setCategories(serviceResult.categories);
        setSelected(current => current && serviceResult.categories.some(item => item.label === current.label) ? serviceResult.categories.find(item => item.label === current.label) : null);
      } catch (err) {
        if (mounted) { setServicesError(err.message || 'تعذر تحميل الخدمات'); setCategories([]); }
      } finally { if (mounted) setServicesLoading(false); }
    }
    loadPublicData();
    return () => { mounted = false; };
  }, [reloadKey, screen]);

  useEffect(() => {
    if (screen !== 'support' || !session || !['client', 'fanni'].includes(session.role)) return;
    let active = true;
    const refreshSupport = async () => {
      if (!active || screenRef.current !== 'support') return;
      await loadSupportCases();
      if (supportCase?._id) {
        try {
          const result = await api('/support/' + session.role + '/' + encodeURIComponent(supportCase._id), { token: session.token });
          if (active && result.supportCase) setSupportCase(result.supportCase);
        } catch (_) {}
      }
    };
    refreshSupport();
    const timer = setInterval(refreshSupport, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [screen, session?.token, supportCase?._id]);

  useEffect(() => {
    if (screen !== 'admin' || adminData.tab !== 'support' || !session || session.role !== 'admin') return;
    let active = true, busy = false;
    const supportId = adminSupportSelected?._id;
    const recoveryId = adminRecoverySelected?.id || adminRecoverySelected?._id;
    const refreshAllSupportChats = async () => {
      if (!active || busy || screenRef.current !== 'admin') return;
      busy = true;
      try {
        await loadAdminSupportCases();
        if (supportId) {
          try {
            const result = await api('/support/admin/' + encodeURIComponent(supportId), { token: session.token });
            if (active && result.supportCase) setAdminSupportSelected(result.supportCase);
          } catch (_) {}
        }
        if (recoveryId) {
          try {
            const result = await api('/password-recovery/admin/requests/' + encodeURIComponent(recoveryId), { token: session.token });
            if (active && result.recovery) setAdminRecoverySelected(result.recovery);
          } catch (_) {}
        }
      } finally { busy = false; }
    };
    refreshAllSupportChats();
    const timer = setInterval(refreshAllSupportChats, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [screen, adminData.tab, session?.token, adminSupportSelected?._id, adminRecoverySelected?.id, adminRecoverySelected?._id]);

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
        api('/support/admin?needsHuman=true', { token: session.token }),
      ]);
      if (!mounted) return;
      const failed = results.find(item => item.status === 'rejected');
      setAdminSupportCases(results[5]?.status === 'fulfilled' ? toList(results[5].value, ['supportCases', 'items']) : []);
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

  useEffect(() => {
    if (!session || session.role !== 'client' || screen !== 'client' || !ratingDismissalsLoaded || ratingDismissalsLoadedFor !== ratingStorageKey || ratingPrompt) return;
    const completedOrder = clientData.orders.find(order => {
      if (!order || typeof order !== 'object') return false;
      const sn = getOrderSN(order);
      const alreadyRated = Boolean(order.myRating || order.clientRating || order.ratingByClient || order.clientReview || (order.ratings || []).some(item => ['client', 'customer'].includes(String(item.reviewerRole || item.role || '').toLowerCase())));
      const completed = ['تم الانتهاء', 'مكتمل', 'مكتملة', 'completed', 'complete', 'finished'].includes(String(order.status || order.orderStatus || '').trim().toLowerCase());
      return sn && completed && !dismissedRatings[sn] && !ratingDrafts[sn]?.skipped && !alreadyRated;
    });
    if (!completedOrder) return;
    const sn = getOrderSN(completedOrder);
    setRatingDrafts(current => current[sn] ? current : { ...current, [sn]: { stars: '5', comment: '', blockFuture: false } });
    setRatingPrompt({ role: 'client', order: completedOrder });
  }, [session, screen, clientData.orders, ratingDismissalsLoaded, ratingDismissalsLoadedFor, ratingStorageKey, dismissedRatings, ratingDrafts, ratingPrompt]);

  useEffect(() => {
    if (!session || session.role !== 'fanni' || screen !== 'technician' || !ratingDismissalsLoaded || ratingDismissalsLoadedFor !== ratingStorageKey || ratingPrompt) return;
    const completedOffer = techData.offers.find(item => {
      if (!item || typeof item !== 'object') return false;
      const sn = getOrderSN(item);
      const alreadyRated = Boolean(item.myRating || item.fanniRating || item.ratingByFanni || item.technicianReview || (item.ratings || []).some(rating => ['fanni', 'technician'].includes(String(rating.reviewerRole || rating.role || '').toLowerCase())));
      const completed = ['تم الانتهاء', 'مكتمل', 'مكتملة', 'completed', 'complete', 'finished'].includes(String(item.orderStatus || item.status || '').trim().toLowerCase());
      return sn && completed && !dismissedRatings[sn] && !ratingDrafts[sn]?.skipped && !alreadyRated;
    });
    if (!completedOffer) return;
    const sn = getOrderSN(completedOffer);
    setRatingDrafts(current => current[sn] ? current : { ...current, [sn]: { stars: '5', comment: '', blockFuture: false } });
    setRatingPrompt({ role: 'fanni', order: completedOffer });
  }, [session, screen, techData.offers, ratingDismissalsLoaded, ratingDismissalsLoadedFor, ratingStorageKey, dismissedRatings, ratingDrafts, ratingPrompt]);

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
      const nextSession = { token: result.token, user, role };
      if (role === 'client' || role === 'fanni') {
        await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(nextSession));
      }
      setSession(nextSession);
      if (role === 'client') setClientTab('current');
      if (role === 'fanni') setTechData(current => ({ ...current, tab: 'offers' }));
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
      const nextSession = { token: result.token, user: result.client, role: 'client' };
      await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(nextSession));
      setSession(nextSession);
      setClientTab('current');
      setScreen('client');
    } catch (err) { Alert.alert('تعذر إنشاء الحساب', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function registerTechnician() {
    if (form.password !== form.confirmPassword) { Alert.alert('كلمة السر', 'كلمتا السر غير متطابقتين.'); return; }
    if (!form.specialties.length) { Alert.alert('بيانات ناقصة', 'اختار خدمة واحدة على الأقل.'); return; }
    setLoginLoading(true);
    try {
      const result = await api('/fanni/register', { method: 'POST', body: { name: form.name.trim(), phone: form.phone.trim(), password: form.password, specialties: form.specialties } });
      Alert.alert('تم إرسال التسجيل', result.message || 'حسابك قيد مراجعة الإدارة.');
      setUsername(form.phone); setPassword(''); setScreen('login'); setAuthMode('fanni');
    } catch (err) { Alert.alert('تعذر تسجيل الفني', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function createOrder() {
    if (!form.service || requestLocation.trim().length < 2) {
      Alert.alert('بيانات ناقصة', 'اختار الخدمة واكتب مكان المهمة.');
      return;
    }
    setLoginLoading(true);
    try {
      const description = [requestJobType ? 'نوع الشغل: ' + requestJobType : '', form.description.trim()].filter(Boolean).join('\n\n');
      if (description.replace(/نوع الشغل: [^\n]+\n\n?/, '').trim().length < 10) {
        Alert.alert('تفاصيل الخدمة مطلوبة', 'اكتب تفاصيل الشغل المطلوبة في 10 أحرف على الأقل عشان الفني يقدر يقدم لك عرضًا مضبوطًا.');
        setLoginLoading(false);
        return;
      }
      const location = requestLocation.trim();
      const orderBody = { service: form.service, area: location, address: location, description, budget: form.budget.trim() };
      const result = await api('/orders', { method: 'POST', token: session.token, body: orderBody });
      setClientData(current => ({ ...current, sn: result.sn || result.order?.sn || '', clientToken: result.clientToken || '' }));
      setClientTab('current');
      setForm(current => ({ ...current, service: '', area: '', address: '', description: '', budget: '' }));
      setSelected(null);
      setRequestStep(1);
      setRequestJobType('');
      setRequestLocation('');
      setRequestPhotos([]);
      setReloadKey(value => value + 1);
      Alert.alert('تم استلام الطلب', `كود المتابعة: ${result.sn || result.order?.sn || '—'}\nسيتم مراجعته من الإدارة.`);
    } catch (err) { Alert.alert('تعذر إنشاء الطلب', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function trackClientOrder() {
    const sn = String(clientTrackSN || '').trim().toUpperCase();
    if (!/^SN[A-Z0-9]{4,18}$/.test(sn)) { setClientTrackError('اكتب كود طلب صحيح يبدأ بـ SN.'); return; }
    setClientTrackLoading(true); setClientTrackError(''); setClientTrackedOrder(null);
    try { const result = await api(`/orders/${encodeURIComponent(sn)}`, { token: session?.token }); setClientTrackedOrder(result.order || result.data || result); setClientTrackSN(sn); }
    catch (err) { setClientTrackError(err.message || 'تعذر العثور على الطلب أو التحقق من ملكيته.'); } finally { setClientTrackLoading(false); }
  }
  async function submitClientComplaint() {
    const sn = String(clientComplaint.sn || '').trim().toUpperCase(), name = String(clientComplaint.name || '').trim(), text = String(clientComplaint.text || '').trim();
    if (!/^SN[A-Z0-9]{4,18}$/.test(sn) || name.length < 2 || name.length > 50 || text.length < 10 || text.length > 1000) { setClientComplaint(c => ({ ...c, error: 'راجع كود الطلب والاسم، واكتب تفاصيل الشكوى من 10 إلى 1000 حرف.' })); return; }
    setClientComplaint(c => ({ ...c, loading: true, error: '' }));
    try { const result = await api('/complaints', { method: 'POST', body: { sn, clientName: name, text } }); Alert.alert('تم إرسال الشكوى', result.message || 'وصلت شكواك للإدارة.'); setClientComplaint({ sn: '', name: '', text: '', loading: false, error: '' }); }
    catch (err) { setClientComplaint(c => ({ ...c, loading: false, error: err.message || 'تعذر إرسال الشكوى.' })); }
  }
  async function trackClientComplaints() {
    const sn = String(clientComplaintTrack.sn || '').trim().toUpperCase(), name = String(clientComplaintTrack.name || '').trim();
    if (!sn || name.length < 2) { setClientComplaintTrack(c => ({ ...c, error: 'اكتب كود الطلب والاسم المسجل.' })); return; }
    setClientComplaintTrack(c => ({ ...c, loading: true, error: '', result: null }));
    try { const result = await api('/complaints/track?sn=' + encodeURIComponent(sn) + '&clientName=' + encodeURIComponent(name)); setClientComplaintTrack(c => ({ ...c, loading: false, result })); }
    catch (err) { setClientComplaintTrack(c => ({ ...c, loading: false, error: err.message || 'تعذر متابعة الشكوى.' })); }
  }

  function sendOffer(order) { setOfferDraft({ order, price: '', message: 'أستطيع تنفيذ الخدمة المطلوبة.' }); }

  async function submitOffer() {
    const draftOrder = offerDraft?.order;
    if (!draftOrder || !getOrderSN(draftOrder)) { setOfferDraft(null); Alert.alert('تعذر إرسال العرض', 'بيانات الطلب غير مكتملة. افتح الطلب من جديد وحاول مرة أخرى.'); return; }
    const amount = Number(offerDraft?.price);
    const message = String(offerDraft?.message || '').trim();
    const hasActiveAcceptedJob = techData.offers.some(item => item.accepted === true && item.orderStatus === 'تم اختيار فني');
    if (hasActiveAcceptedJob) { Alert.alert('لديك مهمة جارية', 'لا يمكنك تقديم عرض جديد قبل إنهاء المهمة الحالية.'); return; }
    if (!Number.isInteger(amount) || amount < 10 || amount > 1000000 || message.length < 5 || message.length > 500) {
      Alert.alert('بيانات العرض غير صحيحة', 'اكتب سعرًا صحيحًا من 10 إلى مليون جنيه ورسالة من 5 إلى 500 حرف.'); return;
    }
    try {
      await api(`/orders/${encodeURIComponent(getOrderSN(draftOrder))}/offer`, { method: 'POST', token: session.token, body: { price: amount, message } });
      setOfferDraft(null); Alert.alert('تم إرسال العرض', 'تم إرسال عرضك بنجاح.'); setReloadKey(value => value + 1);
    } catch (err) { Alert.alert('تعذر إرسال العرض', err.message || 'حاول مرة أخرى.'); }
  }

  async function cancelClientOrder(order) {
    const sn = getOrderSN(order);
    if (!sn) { Alert.alert('تعذر إلغاء الطلب', 'كود الطلب غير موجود.'); return; }
    Alert.alert('إلغاء الطلب', `هل تريد إلغاء الطلب ${sn}؟ لن يمكن التراجع عن الإلغاء.`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'تأكيد الإلغاء', style: 'destructive', onPress: async () => {
        try {
          const result = await api(`/orders/${encodeURIComponent(sn)}/cancel`, { method: 'POST', token: orderToken('client'), body: {} });
          Alert.alert('تم إلغاء الطلب', result.message || 'تم إلغاء الطلب بنجاح.'); setReloadKey(value => value + 1);
        } catch (err) { Alert.alert('تعذر إلغاء الطلب', err.message || 'قد يكون الفني تم اختياره بالفعل.'); }
      } },
    ]);
  }

  async function acceptClientOffer(order, offer) {
    const sn = order?.sn || order?.orderSn;
    const offerId = offer?._id || offer?.id;
    if (!sn || !offerId) { Alert.alert('تعذر قبول العرض', 'بيانات الطلب أو العرض غير مكتملة.'); return; }
    Alert.alert('تأكيد العرض', `قبول عرض ${offer.fanniName || offer.technicianName || 'الفني'} بسعر ${offer.price ?? '—'} جنيه؟`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'قبول العرض', onPress: async () => {
        try {
          await api(`/orders/${encodeURIComponent(sn)}/accept`, { method: 'POST', token: session.token, body: { offerId } });
          acceptedChatAutoOpenedRef.current[`client:${sn}`] = true;
          await refreshOrderChat({ ...order, status: 'تم اختيار فني', orderStatus: 'تم اختيار فني' }, 'client');
          Alert.alert('تم قبول العرض', 'تم تأكيد اختيار الفني بنجاح.'); setReloadKey(v => v + 1);
        } catch (err) { Alert.alert('تعذر قبول العرض', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  async function completeTechnicianOrder(item) {
    const sn = item?.orderSn || item?.sn || item?.order?.sn;
    if (!sn) { Alert.alert('تعذر إنهاء الخدمة', 'لم يتم العثور على كود الطلب.'); return; }
    Alert.alert('تأكيد إنهاء الخدمة', `هل انتهيت من تنفيذ الطلب ${sn}؟`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'إنهاء الخدمة', onPress: async () => {
        try {
          await api(`/orders/${encodeURIComponent(sn)}/complete`, { method: 'POST', token: session.token, body: {} });
          setRatingDrafts(current => ({ ...current, [sn]: { stars: '5', comment: '', blockFuture: false } }));
          setTechData(current => ({ ...current, tab: 'completed' }));
          setExpandedTechnicianOrders(current => ({ ...current, [sn]: true }));
          setRatingPrompt({ role: 'fanni', order: { ...item, orderSn: sn, orderStatus: 'تم الانتهاء' } });
          setReloadKey(v => v + 1);
        } catch (err) { Alert.alert('تعذر إنهاء الخدمة', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  function getOrderSN(order) { if (!order || typeof order !== 'object') return ''; return String(order.orderSn || order.sn || order.order?.sn || '').trim().toUpperCase(); }

  useEffect(() => {
    if (!session || screen !== 'client' || session.role !== 'client') return;
    let active = true, busy = false;
    const refreshClientOrders = async () => { if (busy) return; busy = true; try { const result = await api('/client/orders', { token: session.token }); if (active) setClientData(current => ({ ...current, orders: toList(result, ['orders']), loading: false, error: '' })); } catch {} finally { busy = false; } };
    const timer = setInterval(refreshClientOrders, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [session, screen]);

  useEffect(() => {
    if (!session || screen !== 'technician' || session.role !== 'fanni') return;
    let active = true, busy = false;
    const refreshTechnicianData = async () => { if (busy) return; busy = true; try { const results = await Promise.allSettled([api('/orders/available', { token: session.token }), api('/orders/my-offers', { token: session.token }), api('/fanni/wallet/history', { token: session.token })]); if (active) setTechData(current => ({ ...current, orders: results[0].status === 'fulfilled' ? toList(results[0].value, ['orders']) : current.orders, offers: results[1].status === 'fulfilled' ? toList(results[1].value, ['offers']) : current.offers, wallet: results[2].status === 'fulfilled' ? toList(results[2].value, ['history', 'transactions', 'requests']) : current.wallet })); } catch {} finally { busy = false; } };
    const timer = setInterval(refreshTechnicianData, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [session, screen]);

  useEffect(() => {
    if (!session || !['client', 'fanni'].includes(session.role)) return;
    if (!['client', 'technician'].includes(screen)) return;
    const role = screen === 'client' ? 'client' : 'fanni';
    const orders = role === 'client' ? clientData.orders : techData.offers;
    for (const order of (Array.isArray(orders) ? orders : [])) {
      if (!order || typeof order !== 'object') continue;
      const sn = getOrderSN(order);
      const status = String(role === 'client' ? (order.status || order.orderStatus || '') : (order.orderStatus || order.status || '')).trim();
      if (!sn || !['تم اختيار فني', 'تم الانتهاء'].includes(status)) continue;
      const key = `${role}:${sn}`;
      if (acceptedChatAutoOpenedRef.current[key]) continue;
      acceptedChatAutoOpenedRef.current[key] = true;
      if (!orderChatsRef.current[sn]?.open) refreshOrderChat(order, role);
    }
  }, [session?.role, screen, clientData.orders, techData.offers]);

  function orderToken(role) { return role === 'client' ? (session?.token || clientData.clientToken || '') : (session?.token || ''); }
  function refreshVisibleData() { setReloadKey(value => value + 1); }

  async function refreshOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) return;
    setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), targetOfferId: order?._id || order?.offerId || order?.id || current[sn]?.targetOfferId || '', open: true, loading: current[sn]?.open && Array.isArray(current[sn]?.messages) ? false : true, error: '' } }));
    try {
      const offerId = orderChats[sn]?.targetOfferId || order?._id || order?.offerId || order?.id;
      const query = offerId && role === 'client' && !['تم اختيار فني','تم الانتهاء'].includes(order?.status || order?.orderStatus) ? '?offerId=' + encodeURIComponent(offerId) : '';
      const result = await api(`/orders/${encodeURIComponent(sn)}/chat${query}`, { token: orderToken(role) });
      setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), targetOfferId: offerId || current[sn]?.targetOfferId || '', open: true, loading: false, error: '', messages: toList(result, ['messages']), priceChangeRequests: toList(result, ['priceChangeRequests']) } }));
    } catch (err) {
      setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), open: true, loading: false, error: err.message || 'تعذر تحميل المحادثة' } }));
      Alert.alert('تعذر فتح المحادثة', err.message || 'حاول مرة أخرى.');
    }
  }

   async function toggleOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) { Alert.alert('تعذر فتح المحادثة', 'كود الطلب غير موجود.'); return; }
    const requestedOfferId = order?._id || order?.offerId || order?.id || '';
    const currentOfferId = orderChats[sn]?.targetOfferId || '';
    if (orderChats[sn]?.open && (!requestedOfferId || String(requestedOfferId) === String(currentOfferId))) {
      setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), open: false } }));
      return;
    }
    await refreshOrderChat(order, role);
  }

  async function sendOrderChat(order, quickReply = '') {
    const sn = getOrderSN(order), message = String(quickReply || chatDrafts[getOrderSN(order)] || '').trim();
    const offerId = orderChats[getOrderSN(order)]?.targetOfferId || order?._id || order?.offerId || order?.id;
    if (!sn || !message) { Alert.alert('رسالة فارغة', 'اكتب الرسالة أولًا.'); return; }
    if (session?.role === 'fanni' && order?.accepted !== true && !['نعم', 'لا', 'حسب الاتفاق'].includes(message)) {
      Alert.alert('الرد قبل قبول العرض', 'قبل اختيارك من العميل، الردود المتاحة هي: نعم، لا، حسب الاتفاق.'); return;
    }
    try {
      await api(`/orders/${encodeURIComponent(sn)}/chat`, { method: 'POST', token: orderToken(session?.role || 'client'), body: { text: message, ...(offerId && ((session?.role === 'fanni' && order?.accepted !== true) || (session?.role === 'client' && !['تم اختيار فني', 'تم الانتهاء'].includes(order?.status))) ? { offerId } : {}) } });
      setChatDrafts(current => ({ ...current, [sn]: '' }));
      await refreshOrderChat(order, session.role);
    } catch (err) { Alert.alert('تعذر إرسال الرسالة', err.message || 'راجع قواعد المحادثة وحاول مرة أخرى.'); }
  }

  async function requestOrderPriceChange(order) {
    const sn = getOrderSN(order), draft = priceDrafts[getOrderSN(order)] || {};
    const newPrice = Number(draft.price), reason = String(draft.reason || '').trim();
    if (!sn || !Number.isFinite(newPrice) || newPrice <= 0 || reason.length < 5) { Alert.alert('بيانات تعديل السعر', 'اكتب السعر الجديد وسببًا واضحًا لا يقل عن 5 أحرف.'); return; }
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/price-change`, { method: 'POST', token: session.token, body: { newPrice, reason } });
      Alert.alert('تم إرسال الطلب', result.message || 'لن يتغير السعر قبل موافقة العميل.');
      setPriceDrafts(current => ({ ...current, [sn]: { price: '', reason: '' } }));
      await refreshOrderChat(order, 'fanni'); setReloadKey(v => v + 1);
    } catch (err) { Alert.alert('تعذر تعديل السعر', err.message || 'حاول مرة أخرى.'); }
  }

  async function decideOrderPrice(order, request, approved) {
    const sn = getOrderSN(order), id = request?._id || request?.id;
    if (!sn || !id) { Alert.alert('تعذر تنفيذ القرار', 'بيانات طلب تعديل السعر غير مكتملة.'); return; }
    Alert.alert(approved ? 'الموافقة على تعديل السعر' : 'رفض تعديل السعر', approved ? `هل توافق على تغيير السعر إلى ${request.newPrice} جنيه؟` : 'هل تريد رفض طلب تعديل السعر؟', [{ text: 'رجوع', style: 'cancel' }, { text: approved ? 'موافقة' : 'رفض', onPress: async () => {
      try {
        const result = await api(`/orders/${encodeURIComponent(sn)}/price-change/${encodeURIComponent(id)}/decision`, { method: 'POST', token: orderToken('client'), body: { approved } });
        Alert.alert('تم تسجيل القرار', result.message || (approved ? 'تمت الموافقة.' : 'تم رفض الطلب.')); await refreshOrderChat(order, 'client'); setReloadKey(v => v + 1);
      } catch (err) { Alert.alert('تعذر تسجيل القرار', err.message || 'حاول مرة أخرى.'); }
    }}]);
  }

  useEffect(() => {
    if (!session || !['client', 'technician'].includes(screen)) return;
    const role = screen === 'client' ? 'client' : 'fanni';
    const sourceOrders = role === 'client' ? clientData.orders : techData.offers;
    let mounted = true, inFlight = false;
    const pollOpenChats = async () => {
      if (inFlight) return; inFlight = true;
      try {
        const openChats = (Array.isArray(sourceOrders) ? sourceOrders : []).filter(order => order && typeof order === 'object').map(order => getOrderSN(order)).filter(sn => sn && orderChatsRef.current[sn]?.open);
        await Promise.all(openChats.map(async sn => {
          try {
            const result = await api(`/orders/${encodeURIComponent(sn)}/chat`, { token: session.token });
            if (!mounted) return;
            setOrderChats(current => current[sn]?.open ? { ...current, [sn]: { ...current[sn], loading: false, error: '', messages: toList(result, ['messages']), priceChangeRequests: toList(result, ['priceChangeRequests']) } } : current);
          } catch {}
        }));
      } finally { inFlight = false; }
    };
    const timer = setInterval(pollOpenChats, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, [screen, session, clientData.orders, techData.offers]);

  function setOrderRatingStars(order, stars) {
    const sn = getOrderSN(order);
    setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], stars: String(stars), blockFuture: stars === 1 ? current[sn]?.blockFuture : false } }));
  }
  function renderRatingStars(order, selectedStars) {
    return <View style={styles.ratingStarsRow}>
      {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} onPress={() => setOrderRatingStars(order, value)} style={styles.ratingStarButton}><Text style={[styles.ratingStar, selectedStars >= value && styles.ratingStarActive]}>★</Text></TouchableOpacity>)}
    </View>;
  }

  async function submitOrderRating(order) {
    const sn = getOrderSN(order), draft = ratingDrafts[getOrderSN(order)] || {};
    if (!sn || ratingSubmittingRef.current.has(sn)) return;
    const stars = Number(draft.stars || 5), comment = String(draft.comment || '').trim(), blockFuture = Boolean(draft.blockFuture);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5 || (blockFuture && stars !== 1)) { Alert.alert('راجع التقييم', 'اختار من نجمة إلى 5 نجوم.'); return; }
    ratingSubmittingRef.current.add(sn);
    setRatingSubmitting(current => ({ ...current, [sn]: true }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/rating`, { method: 'POST', token: orderToken(session?.role || 'client'), body: { stars, comment, blockFuture }, signal: controller.signal });
      setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], stars: String(stars), comment: '', blockFuture: false, submitted: true } }));
      setRatingPrompt(null);
      await saveRatingDismissal(sn); setReloadKey(v => v + 1);
      Alert.alert('تم حفظ التقييم', result.message || 'تم حفظ تقييمك بنجاح.');
    } catch (err) {
      if (err?.status === 409) { setRatingPrompt(null); await saveRatingDismissal(sn); Alert.alert('التقييم محفوظ بالفعل', 'تم تسجيل تقييمك من قبل.'); return; }
      Alert.alert('تعذر حفظ التقييم', err.message || 'حاول مرة أخرى.');
    } finally {
      clearTimeout(timeout); ratingSubmittingRef.current.delete(sn);
      setRatingSubmitting(current => ({ ...current, [sn]: false }));
    }
  }

  async function saveRatingDismissal(sn) {
    if (!sn) return;
    const next = { ...dismissedRatingsRef.current, ...dismissedRatings, [sn]: true };
    dismissedRatingsRef.current = next; setDismissedRatings(next);
    try { await SecureStore.setItemAsync(ratingStorageKey, JSON.stringify(next)); } catch {}
  }
  async function skipRatingPrompt() {
    const prompt = ratingPrompt; if (!prompt) return;
    const sn = getOrderSN(prompt.order);
    setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], skipped: true } }));
    await saveRatingDismissal(sn); setRatingPrompt(null);
  }
  function renderRatingModal(role) {
    if (!ratingPrompt || !ratingPrompt.order || ratingPrompt.role !== role) return null;
    const order = ratingPrompt?.order || {}; const sn = getOrderSN(order);
    const draft = ratingDrafts[sn] || { stars: '5', comment: '', blockFuture: false };
    const stars = Number(draft.stars || 5); const submitting = Boolean(ratingSubmitting[sn]);
    return <Modal visible transparent animationType="fade" onRequestClose={skipRatingPrompt}>
      <View style={styles.modalBackdrop}><View style={styles.ratingModal}><Text style={styles.title}>{role === 'client' ? 'قيّم الفني' : 'قيّم العميل'}</Text><Text style={styles.detail}>المهمة {sn} انتهت.</Text>{renderRatingStars(order, stars)}<Field label="تعليق (اختياري)" value={draft.comment || ''} onChangeText={value => setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], comment: value } }))} multiline/><Button title={submitting ? "جاري الإرسال..." : "إرسال التقييم"} onPress={() => submitOrderRating(order)} disabled={submitting}/><Button title="تخطي" secondary onPress={skipRatingPrompt}/></View></View></Modal>;
  }

  // ... باقي دوال الإدارة والدعم واللوج اوت (لو محتاجها قولي ابعتهالك) ...

  async function performLogout() {
    try { await SecureStore.deleteItemAsync('sonaa.auth.session.v1'); } catch {}
    screenHistoryRef.current = []; screenRef.current = 'home'; setScreenState('home');
    setSession(null); setUsername(''); setPassword('');
  }
  function logout() {
    Alert.alert('تأكيد الخروج', 'هل تريد تسجيل الخروج؟', [{ text: 'لا', style: 'cancel' }, { text: 'نعم', style: 'destructive', onPress: () => { void performLogout(); } }]);
  }

  if (screen === 'login') return <SafeAreaView style={styles.loginSafe}><KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><TouchableOpacity onPress={() => setScreen('home')} style={styles.loginBackButton}><Text style={styles.loginBackText}>رجوع للرئيسية</Text></TouchableOpacity><View style={styles.loginLogoCircle}><Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.loginLogo} resizeMode="contain"/></View><View style={styles.loginHeading}><Text style={styles.loginTitle}>{authMode === 'client' ? 'أهلًا بيك في صُنّاع' : 'أهلًا بيك يا فني'}</Text></View><View style={styles.loginForm}><Field label="رقم الهاتف أو الإيميل" value={username} onChangeText={setUsername} placeholder="اكتب رقم الهاتف"/><Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry/><TouchableOpacity onPress={handleLogin} style={styles.loginGradientButton}><Text style={styles.loginGradientButtonText}>{loginLoading ? 'جاري...' : 'تسجيل الدخول'}</Text></TouchableOpacity></View></KeyboardAvoidingView></SafeAreaView>;

  // باقي الشاشات client و technician و admin زي ما كانت
  if (screen === 'client' && session?.role === 'client') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>حساب العميل {session.user?.name}</Text><Button title="خروج" secondary onPress={logout}/><Text style={styles.detail}>طلباتك: {clientData.orders.length}</Text>{clientData.orders.filter(o=>!['تم الانتهاء','ملغي'].includes(o.status)).map((order,i)=>{const sn=getOrderSN(order);return <View key={sn||i} style={styles.dataCard}><Text style={styles.cardTitle}>{order.service} • {sn}</Text><Button title="إلغاء" secondary onPress={()=>cancelClientOrder(order)}/></View>})}</ScrollView>{renderRatingModal('client')}</SafeAreaView>;

  if (screen === 'technician' && session?.role === 'fanni') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>حساب الفني {session.user?.name}</Text><Button title="خروج" secondary onPress={logout}/>{techData.offers.map((item,i)=>{const sn=getOrderSN(item);return <View key={sn||i} style={styles.dataCard}><Text style={styles.cardTitle}>{sn} • {item.orderStatus}</Text>{item.orderStatus==='تم اختيار فني' ? <Button title="إنهاء الخدمة" onPress={()=>completeTechnicianOrder(item)}/> : null}</View>})}</ScrollView>{renderRatingModal('fanni')}</SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>صُنّاع</Text><Button title="دخول عميل" onPress={()=>{setAuthMode('client');setScreen('login')}}/><Button title="دخول فني" secondary onPress={()=>{setAuthMode('fanni');setScreen('login')}}/></ScrollView></SafeAreaView>;
}
export default function App(){const [s,setS]=useState('home');return <SafeAreaProvider><AppScreens onScreenChange={setS}/></SafeAreaProvider>;}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},loginSafe:{flex:1,backgroundColor:'#0F2D4A'},loginPage:{flex:1,padding:20,justifyContent:'center'},loginBackButton:{alignSelf:'flex-start',marginBottom:10},loginBackText:{color:'#fff',opacity:0.8},loginLogoCircle:{width:110,height:110,borderRadius:55,backgroundColor:'#fff',alignSelf:'center',justifyContent:'center',alignItems:'center',marginBottom:16},loginLogo:{width:90,height:90},fieldWrap:{marginBottom:12},fieldLabel:{color:COLORS.text,fontWeight:'600',marginBottom:6,textAlign:'right'},input:{backgroundColor:'#F8FAFC',borderWidth:1,borderColor:COLORS.border,borderRadius:10,padding:12,color:COLORS.text},multiline:{minHeight:90},button:{backgroundColor:COLORS.blue,borderRadius:12,padding:14,alignItems:'center',marginVertical:6},buttonSecondary:{backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.border},buttonText:{color:'#fff',fontWeight:'700'},buttonSecondaryText:{color:COLORS.text},disabledButton:{opacity:0.6},page:{padding:16,paddingBottom:40},title:{fontSize:22,fontWeight:'800',color:COLORS.text,textAlign:'right'},detail:{color:COLORS.text,textAlign:'right',marginTop:4},cardTitle:{fontWeight:'800',color:COLORS.text,textAlign:'right'},dataCard:{backgroundColor:'#fff',borderRadius:12,padding:12,marginTop:10,borderWidth:1,borderColor:COLORS.border},modalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',padding:20},ratingModal:{backgroundColor:'#fff',borderRadius:16,padding:16},ratingStarsRow:{flexDirection:'row-reverse',justifyContent:'center',marginVertical:12},ratingStar:{fontSize:32,color:'#E2E8F0'},ratingStarActive:{color:COLORS.gold},chatBox:{marginTop:10,backgroundColor:'#F8FAFC',borderRadius:10,padding:8,borderWidth:1,borderColor:COLORS.border},
  loginGradientButton:{backgroundColor:COLORS.navy,borderRadius:12,padding:14,alignItems:'center',marginTop:10},
  loginGradientButtonText:{color:'#fff',fontWeight:'700'},
  loginHeading:{alignItems:'center',marginBottom:20},
  loginTitle:{color:'#fff',fontSize:22,fontWeight:'800'},
  loginForm:{backgroundColor:'#fff',borderRadius:16,padding:16},
});
