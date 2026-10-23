import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
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

function AppContent() {
  const [screen, setScreenState] = useState('home');
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
  const [areas, setAreas] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [session, setSession] = useState(null);
  const [authRestoring, setAuthRestoring] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authMode, setAuthMode] = useState('fanni');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '', service: '', area: '', address: '', description: '', budget: '', specialties: [], areas: [] });
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
  // Prefer the phone as the stable account identity: database IDs can differ
  // between login/session restoration responses, but the account phone stays stable.
  const ratingAccountId = String(
    session?.user?.phone || session?.user?._id || session?.user?.id || 'account'
  ).trim().replace(/\s+/g, '');
  const ratingStorageKey = `sonaa.rating.dismissed.v3:${session?.role || 'guest'}`;
  // Keep reading/writing the old key too, so previously skipped prompts stay skipped.
  const legacyRatingStorageKey = `sonaa.rating.dismissed.v1:${session?.role || 'guest'}:${session?.user?._id || session?.user?.id || session?.user?.phone || 'account'}`;
  const previousRatingStorageKey = `sonaa.rating.dismissed.v2:${session?.role || 'guest'}:${ratingAccountId}`;

  useEffect(() => {
    let active = true;
    setRatingDismissalsLoaded(false);
    setRatingDismissalsLoadedFor('');
    if (!session || !['client', 'fanni'].includes(session.role)) {
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

  // Keep client/technician sessions across app restarts using encrypted device storage.
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
        try {
          const endpoint = saved.role === 'client' ? '/client/me' : '/fanni/me';
          const result = await api(endpoint, { token: saved.token });
          const user = result.client || result.user || saved.user;
          if (!user) throw new Error('استجابة التحقق من الجلسة غير مكتملة.');
          saved = { token: saved.token, user, role: saved.role };
          await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(saved));
        } catch (error) {
          // Clear only rejected sessions. Network/server errors should not sign users out.
          if (error?.status === 401 || error?.status === 403) {
            await SecureStore.deleteItemAsync('sonaa.auth.session.v1');
            return;
          }
          if (!saved.user) throw error;
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

  // Hardware Back returns one screen at a time and never logs a user out.
  useEffect(() => {
    const onHardwareBack = () => {
      if (offerDraft) {
        setOfferDraft(null);
        return true;
      }
      if (notificationsOpen) {
        setNotificationsOpen(false);
        return true;
      }
      let previous = screenHistoryRef.current.pop();
      while (previous && ['login', 'clientRegister', 'technicianRegister'].includes(previous) && session) {
        previous = screenHistoryRef.current.pop();
      }
      if (previous) {
        screenRef.current = previous;
        setScreenState(previous);
        return true;
      }
      if (session) {
        logout();
        return true;
      }
      if (screen !== 'home') {
        screenRef.current = 'home';
        setScreenState('home');
        return true;
      }
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
        const [serviceResult, areaResult] = await Promise.all([api('/services'), api('/areas')]);
        if (!Array.isArray(serviceResult.categories)) throw new Error('قائمة الخدمات من الخادم غير صحيحة');
        if (!mounted) return;
        setCategories(serviceResult.categories);
        setSelected(current => current && serviceResult.categories.some(item => item.label === current.label)
          ? serviceResult.categories.find(item => item.label === current.label) : null);
        setAreas(toList(areaResult, ['areas']));
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
    if (!form.service || form.area.trim().length < 2 || form.address.trim().length < 2) { Alert.alert('بيانات ناقصة', 'اختار الخدمة واكتب المنطقة أو الحي والعنوان بالتفصيل.'); return; }
    setLoginLoading(true);
    try {
      const description = form.description.trim();
      if (description.length < 10) {
        Alert.alert('تفاصيل الخدمة مطلوبة', 'اكتب تفاصيل الشغل المطلوبة في 10 أحرف على الأقل عشان الفني يقدر يقدم لك عرضًا مضبوطًا.');
        setLoginLoading(false);
        return;
      }
      const orderBody = { clientName: String(session.user?.name || form.name || '').trim(), phone: String(session.user?.phone || form.phone || '').trim(), service: form.service, area: form.area.trim(), address: form.address.trim(), description, budget: form.budget.trim() };
      const result = await api('/orders', { method: 'POST', token: session.token, body: orderBody });
      setClientData(current => ({ ...current, sn: result.sn || result.order?.sn || '', clientToken: result.clientToken || '' }));
      setClientTab('current');
      setForm(current => ({ ...current, address: '', description: '', budget: '' }));
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

  function sendOffer(order) {
    setOfferDraft({ order, price: '', message: 'أستطيع تنفيذ الخدمة المطلوبة.' });
  }

  async function submitOffer() {
    const amount = Number(offerDraft?.price);
    const message = String(offerDraft?.message || '').trim();
    const hasActiveAcceptedJob = techData.offers.some(item => item.accepted === true && item.orderStatus === 'تم اختيار فني');
    if (hasActiveAcceptedJob) {
      Alert.alert('لديك مهمة جارية', 'لا يمكنك تقديم عرض جديد قبل إنهاء المهمة الحالية.');
      return;
    }
    if (!Number.isInteger(amount) || amount < 10 || amount > 1000000 || message.length < 5 || message.length > 500) {
      Alert.alert('بيانات العرض غير صحيحة', 'اكتب سعرًا صحيحًا من 10 إلى مليون جنيه ورسالة من 5 إلى 500 حرف.');
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

  async function cancelClientOrder(order) {
    const sn = getOrderSN(order);
    if (!sn) { Alert.alert('تعذر إلغاء الطلب', 'كود الطلب غير موجود.'); return; }
    Alert.alert('إلغاء الطلب', `هل تريد إلغاء الطلب ${sn}؟ لن يمكن التراجع عن الإلغاء.`, [
      { text: 'رجوع', style: 'cancel' },
      { text: 'تأكيد الإلغاء', style: 'destructive', onPress: async () => {
        try {
          const result = await api(`/orders/${encodeURIComponent(sn)}/cancel`, {
            method: 'POST', token: orderToken('client'), body: {}
          });
          Alert.alert('تم إلغاء الطلب', result.message || 'تم إلغاء الطلب بنجاح.');
          setReloadKey(value => value + 1);
        } catch (err) {
          Alert.alert('تعذر إلغاء الطلب', err.message || 'قد يكون الفني تم اختياره بالفعل.');
        }
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
          const result = await api(`/orders/${encodeURIComponent(sn)}/accept`, { method: 'POST', token: session.token, body: { offerId } });
          acceptedChatAutoOpenedRef.current[`client:${sn}`] = true;
          await refreshOrderChat({ ...order, status: 'تم اختيار فني', orderStatus: 'تم اختيار فني' }, 'client');
          Alert.alert('تم قبول العرض', 'تم تأكيد اختيار الفني بنجاح.');
          setReloadKey(v => v + 1);
        }
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
        try {
          await api(`/orders/${encodeURIComponent(sn)}/complete`, { method: 'POST', token: session.token, body: {} });
          setRatingDrafts(current => ({ ...current, [sn]: { stars: '5', comment: '', blockFuture: false } }));
          setTechData(current => ({ ...current, tab: 'completed' }));
          setExpandedTechnicianOrders(current => ({ ...current, [sn]: true }));
          setRatingPrompt({ role: 'fanni', order: { ...item, orderSn: sn, orderStatus: 'تم الانتهاء' } });
          setReloadKey(v => v + 1);
        }
        catch (err) { Alert.alert('تعذر إنهاء الخدمة', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  function getOrderSN(order) { return String(order?.orderSn || order?.sn || order?.order?.sn || '').trim().toUpperCase(); }

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
    for (const order of orders) {
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

  // Refresh the currently visible screen by rerunning its existing data-loading effects.
  function refreshVisibleData() {
    setReloadKey(value => value + 1);
  }

  async function refreshOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) return;
    setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), targetOfferId: order?._id || order?.offerId || order?.id || current[sn]?.targetOfferId || '', open: true, loading: true, error: '' } }));
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
      Alert.alert('الرد قبل قبول العرض', 'قبل اختيارك من العميل، الردود المتاحة هي: نعم، لا، حسب الاتفاق.');
      return;
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
    const timer = setInterval(pollOpenChats, 3000);
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

  function renderRatingStars(order, selectedStars) {
    return <View style={styles.ratingStarsRow}>
      {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`تقييم ${value} من 5`} onPress={() => setOrderRatingStars(order, value)} style={styles.ratingStarButton}>
        <Text style={[styles.ratingStar, selectedStars >= value && styles.ratingStarActive]}>★</Text>
      </TouchableOpacity>)}
    </View>;
  }

  async function submitOrderRating(order) {
    const sn = getOrderSN(order), draft = ratingDrafts[getOrderSN(order)] || {};
    if (ratingSubmittingRef.current.has(sn)) return;
    const stars = Number(draft.stars || 5), comment = String(draft.comment || '').trim(), blockFuture = Boolean(draft.blockFuture);
    if (!sn || !Number.isInteger(stars) || stars < 1 || stars > 5 || (blockFuture && stars !== 1)) {
      Alert.alert('راجع التقييم', 'اختار من نجمة إلى 5 نجوم. منع التعامل متاح مع تقييم نجمة واحدة فقط.'); return;
    }
    ratingSubmittingRef.current.add(sn);
    const activePrompt = ratingPrompt && getOrderSN(ratingPrompt.order) === sn ? ratingPrompt : null;
    if (activePrompt) setRatingPrompt(null);
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/rating`, { method: 'POST', token: orderToken(session?.role || 'client'), body: { stars, comment, blockFuture } });
      Alert.alert('تم حفظ التقييم', result.message || 'تم حفظ تقييمك بنجاح.');
      setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], stars: String(stars), comment: '', blockFuture: false, submitted: true } }));
      setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
      await saveRatingDismissal(sn);
      setReloadKey(v => v + 1);
    } catch (err) {
      // A 409 means the server already has this rating. Do not reopen the prompt:
      // mark it dismissed locally and reload the order so the saved rating is reflected.
      if (err?.status === 409) {
        setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
        await saveRatingDismissal(sn);
        setReloadKey(v => v + 1);
        Alert.alert('التقييم محفوظ بالفعل', 'سبق تسجيل تقييمك لهذه المهمة، ولن يظهر مربع التقييم مرة أخرى.');
        return;
      }
      if (activePrompt) setRatingPrompt(activePrompt);
      Alert.alert('تعذر حفظ التقييم', err.message || 'تعذر حفظ التقييم. حاول مرة أخرى.');
    } finally {
      ratingSubmittingRef.current.delete(sn);
    }
  }

  async function saveRatingDismissal(sn) {
    if (!sn) return;
    // Update from the latest React state so dismissals for different orders cannot overwrite each other.
    setDismissedRatings(current => ({ ...current, [sn]: true }));
    try {
      const raw = await SecureStore.getItemAsync(ratingStorageKey);
      let persisted = {};
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) persisted = parsed;
      } catch (_) {}
      const next = { ...persisted, ...dismissedRatings, [sn]: true };
      // The role-only key survives logout/login even if the API returns a different user ID shape.
      await SecureStore.setItemAsync(ratingStorageKey, JSON.stringify(next));
      if (previousRatingStorageKey !== ratingStorageKey) {
        await SecureStore.setItemAsync(previousRatingStorageKey, JSON.stringify(next));
      }
      if (legacyRatingStorageKey !== ratingStorageKey && legacyRatingStorageKey !== previousRatingStorageKey) {
        await SecureStore.setItemAsync(legacyRatingStorageKey, JSON.stringify(next));
      }
    } catch (error) {
      console.warn('تعذر حفظ حالة تخطي التقييم:', error?.message || error);
    }
  }

  async function skipRatingPrompt() {
    const prompt = ratingPrompt;
    if (!prompt) return;
    const sn = getOrderSN(prompt.order);
    setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], skipped: true } }));
    await saveRatingDismissal(sn);
    setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
  }

  function renderRatingModal(role) {
    if (!ratingPrompt || ratingPrompt.role !== role) return null;
    const order = ratingPrompt.order;
    const sn = getOrderSN(order);
    const draft = ratingDrafts[sn] || { stars: '5', comment: '', blockFuture: false };
    const stars = Number(draft.stars || 5);
    return <Modal visible transparent animationType="fade" onRequestClose={skipRatingPrompt}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingModal}>
          <Text style={styles.title}>{role === 'client' ? 'قيّم الفني' : 'قيّم العميل'}</Text>
          <Text style={styles.detail}>المهمة {sn} انتهت. اختار تقييمك، والتعليق اختياري.</Text>
          {renderRatingStars(order, stars)}
          <Field label="تعليق (اختياري)" value={draft.comment || ''} onChangeText={value => setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], comment: value } }))} multiline placeholder="اكتب ملاحظتك هنا..." />
          {stars === 1 ? <TouchableOpacity onPress={() => setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], blockFuture: !current[sn]?.blockFuture } }))} style={styles.inlineCheck}>
            <Text style={styles.detail}>{draft.blockFuture ? '☑' : '☐'} {role === 'client' ? 'عدم استقبال عروض من الفني ده مرة تانية' : 'عدم إظهار طلبات العميل ده ليّ مرة تانية'}</Text>
          </TouchableOpacity> : null}
          <Button title="إرسال التقييم" onPress={() => submitOrderRating(order)} />
          <Button title="تخطي" secondary onPress={skipRatingPrompt} />
        </View>
      </View>
    </Modal>;
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
    if (!Number.isInteger(amount) || amount < 10 || !topup.fromPhone.trim() || !topup.method) { Alert.alert('بيانات غير صحيحة', 'اكتب مبلغًا صحيحًا ورقم المحوّل واختار المحفظة التي حولت منها.'); return; }
    try {
      const result = await api('/fanni/wallet/topup', { method: 'POST', token: session.token, body: { amount, fromPhone: topup.fromPhone.trim(), reference: topup.reference.trim(), method: topup.method } });
      Alert.alert('تم إرسال طلب الشحن', result.message || 'طلبك قيد مراجعة الإدارة.');
      setTopup({ amount: '', fromPhone: '', reference: '', method: 'vodafone_cash' });
      setReloadKey(value => value + 1);
    } catch (err) { Alert.alert('تعذر إرسال الشحن', err.message || 'حاول مرة أخرى.'); }
  }

  async function loadSupportCases() {
    if (!session || !['client', 'fanni'].includes(session.role)) return;
    setSupportLoading(true); setSupportError('');
    try {
      const result = await api('/support/' + session.role, { token: session.token });
      setSupportCases(toList(result, ['supportCases', 'items']));
    } catch (err) { setSupportError(err.message || 'تعذر تحميل محادثات الدعم'); }
    finally { setSupportLoading(false); }
  }

  async function startSupportCase() {
    const text = supportDraft.trim();
    if (!text) { Alert.alert('رسالة فارغة', 'اكتب المشكلة أو الاستفسار الأول.'); return; }
    setSupportLoading(true); setSupportError('');
    try {
      const result = await api('/support/' + session.role, { method: 'POST', token: session.token, body: { subject: supportSubject.trim() || 'استفسار عام', text } });
      const item = result.supportCase;
      setSupportDraft('');
      setSupportCase(item);
      setSupportCases(current => [item, ...current.filter(x => String(x._id) !== String(item._id))]);
      Alert.alert('تم فتح محادثة الدعم', 'رسالتك محفوظة داخل صُنّاع. لو احتاجت تدخلًا بشريًا، اضغط «طلب تدخل الدعم».');
    } catch (err) { setSupportError(err.message || 'تعذر إرسال الرسالة'); }
    finally { setSupportLoading(false); }
  }

  async function openSupportCase(item) {
    setSupportCase(item);
    setSupportLoading(true); setSupportError('');
    try {
      const result = await api('/support/' + session.role + '/' + encodeURIComponent(item._id), { token: session.token });
      setSupportCase(result.supportCase || item);
    } catch (err) { setSupportError(err.message || 'تعذر فتح المحادثة'); }
    finally { setSupportLoading(false); }
  }

  async function sendSupportMessage(needsHuman = false) {
    const text = supportDraft.trim() || (needsHuman ? 'أحتاج تدخل موظف الدعم.' : '');
    if (!supportCase?._id) return startSupportCase();
    if (!text) { Alert.alert('رسالة فارغة', 'اكتب رسالتك أولًا.'); return; }
    setSupportLoading(true); setSupportError('');
    try {
      const result = await api('/support/' + session.role + '/' + encodeURIComponent(supportCase._id) + '/messages', {
        method: 'POST', token: session.token, body: { text, needsHuman }
      });
      const item = result.supportCase;
      setSupportCase(item);
      setSupportCases(current => [item, ...current.filter(x => String(x._id) !== String(item._id))]);
      setSupportDraft('');
      if (needsHuman) Alert.alert('تم طلب تدخل الدعم', 'تم وضع المحادثة في قائمة الحالات التي تحتاج تدخل الإدارة.');
    } catch (err) { setSupportError(err.message || 'تعذر إرسال الرسالة'); }
    finally { setSupportLoading(false); }
  }

  useEffect(() => {
    if (!session || screen !== 'admin' || session.role !== 'admin') return;
    let active = true;
    async function loadAdminExtras() {
      setAdminExtras(current => ({ ...current, loading: true, error: '' }));
      const results = await Promise.allSettled([
        api('/admin/services', { token: session.token }),
        api('/admin/regions', { token: session.token }),
        api('/admin/pricing', { token: session.token }),
        api('/admin/settings', { token: session.token }),
        api('/admin/content', { token: session.token }),
        api('/admin/audit-logs', { token: session.token }),
      ]);
      if (!active) return;
      const pick = (i, keys) => results[i].status === 'fulfilled' ? results[i].value : null;
      const serviceData = pick(0, []);
      const regionData = pick(1, []);
      const pricingData = pick(2, []);
      const settingsData = pick(3, []);
      const contentData = pick(4, []);
      const auditData = pick(5, []);
      const failed = results.some(item => item.status === 'rejected');
      const pricing = pricingData?.pricing || {};
      const settings = settingsData?.settings || {};
      const content = contentData?.content || {};
      setAdminExtras(current => ({
        ...current,
        services: toList(serviceData, ['categories', 'items']),
        regions: toList(regionData, ['regions', 'items']),
        pricing: { check: Number(pricing.check ?? current.pricing.check), commission: Number(pricing.commission ?? current.pricing.commission), minOffer: Number(pricing.minOffer ?? current.pricing.minOffer), maxOffer: Number(pricing.maxOffer ?? current.pricing.maxOffer) },
        pricingHistory: toList(pricingData, ['history']),
        settings: { siteName: settings.siteName || current.settings.siteName, maintenance: Boolean(settings.maintenance), maintenanceMessage: settings.maintenanceMessage || '', maxFanniSignupAttempts: Number(settings.maxFanniSignupAttempts || current.settings.maxFanniSignupAttempts) },
        content: { announcement: content.announcement || '', faqs: Array.isArray(content.faqs) ? content.faqs : [] },
        auditLogs: toList(auditData, ['logs', 'items']),
        loading: false,
        error: failed ? 'تعذر تحميل بعض أقسام الإدارة؛ راجع صلاحيات الحساب واتصال الخادم.' : ''
      }));
      if (contentData?.content) setAdminAnnouncementDraft(contentData.content.announcement || '');
    }
    loadAdminExtras();
    return () => { active = false; };
  }, [session, screen, reloadKey]);

  async function loadAdminSupportCases() {
    if (!session || session.role !== 'admin') return;
    try {
      const result = await api('/support/admin', { token: session.token });
      setAdminSupportCases(toList(result, ['supportCases', 'items']));
      await loadAdminRecoveryCases();
    } catch (err) { Alert.alert('تعذر تحميل الدعم', err.message || 'راجع صلاحيات الإدارة.'); }
  }

  async function loadAdminRecoveryCases() {
    if (!session || session.role !== 'admin') return;
    try {
      const result = await api('/password-recovery/admin/requests', { token: session.token });
      setAdminRecoveryCases(toList(result, ['recoveries', 'items']));
    } catch (err) { setAdminRecoveryCases([]); }
  }

  async function openAdminRecovery(item) {
    try {
      const result = await api('/password-recovery/admin/requests/' + encodeURIComponent(item.id || item._id), { token: session.token });
      setAdminRecoverySelected(result.recovery || item);
      setAdminRecoveryCode('');
      setAdminRecoveryDraft('');
    } catch (err) { Alert.alert('طلب الاستعادة', err.message || 'تعذر فتح الطلب.'); }
  }

  async function issueAdminRecoveryCode() {
    if (!adminRecoverySelected) return;
    Alert.alert('تأكيد التحقق', 'لا تصدر الرمز إلا بعد التأكد من ملكية الحساب عبر أسئلة الدعم.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تم التحقق', onPress: async () => {
        try {
          const result = await api('/password-recovery/admin/requests/' + encodeURIComponent(adminRecoverySelected.id || adminRecoverySelected._id) + '/issue-code', { method: 'POST', token: session.token, body: {} });
          setAdminRecoverySelected(result.recovery);
          setAdminRecoveryCode(String(result.code || ''));
          await loadAdminRecoveryCases();
        } catch (err) { Alert.alert('تعذر إصدار الرمز', err.message || 'حاول مرة أخرى.'); }
      } }
    ]);
  }

  async function replyAdminRecovery() {
    const text = adminRecoveryDraft.trim();
    if (!adminRecoverySelected || !text) { Alert.alert('رد الدعم', 'اكتب الرد أولًا.'); return; }
    try {
      const result = await api('/password-recovery/admin/requests/' + encodeURIComponent(adminRecoverySelected.id || adminRecoverySelected._id) + '/reply', { method: 'POST', token: session.token, body: { text } });
      setAdminRecoverySelected(result.recovery);
      setAdminRecoveryDraft('');
      setAdminRecoveryCode('');
      await loadAdminRecoveryCases();
      Alert.alert('تم إرسال الرد', 'تم إرسال الرسالة داخل محادثة استعادة الحساب.');
    } catch (err) { Alert.alert('تعذر إرسال الرد', err.message || 'حاول مرة أخرى.'); }
  }

  async function replyAdminSupport(item) {
    const text = adminSupportDraft.trim();
    if (!item?._id || !text) { Alert.alert('رد الدعم', 'اكتب الرد الأول.'); return; }
    try {
      const result = await api('/support/admin/' + encodeURIComponent(item._id) + '/reply', {
        method: 'POST', token: session.token, body: { text }
      });
      const updated = result.supportCase;
      setAdminSupportSelected(updated);
      setAdminSupportCases(current => [updated, ...current.filter(x => String(x._id) !== String(updated._id))]);
      setAdminSupportDraft('');
      Alert.alert('تم إرسال الرد', 'تم حفظ ردك داخل محادثة الدعم.');
    } catch (err) { Alert.alert('تعذر إرسال الرد', err.message || 'حاول مرة أخرى.'); }
  }

  useEffect(() => {
    if (screen !== 'admin' || adminData.tab !== 'support' || !session || session.role !== 'admin') return;
    const timer = setInterval(async () => {
      if (screenRef.current !== 'admin') return;
      if (adminSupportSelected?._id) {
        try {
          const result = await api('/support/admin/' + encodeURIComponent(adminSupportSelected._id), { token: session.token });
          if (result.supportCase) setAdminSupportSelected(result.supportCase);
        } catch (_) {}
      }
      if (adminRecoverySelected?.id || adminRecoverySelected?._id) {
        try {
          const id = adminRecoverySelected.id || adminRecoverySelected._id;
          const result = await api('/password-recovery/admin/requests/' + encodeURIComponent(id), { token: session.token });
          if (result.recovery) setAdminRecoverySelected(result.recovery);
        } catch (_) {}
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [screen, adminData.tab, session?.token, adminSupportSelected?._id, adminRecoverySelected?.id, adminRecoverySelected?._id]);

  async function changeAccountPassword() {
    if (!session) return;
    const currentPassword = accountPasswordForm.currentPassword;
    const newPassword = accountPasswordForm.newPassword;
    const confirmPassword = accountPasswordForm.confirmPassword;
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      setAccountPasswordForm(v => ({ ...v, error: 'كلمة المرور الجديدة 8 أحرف على الأقل ويجب أن يتطابق التأكيد.' }));
      return;
    }
    setAccountPasswordForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const role = session.role === 'client' ? 'client' : ((session.user?.role === 'admin' || session.user?.adminRole) ? 'admin' : 'fanni');
      const result = await api('/password-recovery/change/' + role, { method: 'POST', token: session.token, body: { currentPassword, newPassword, confirmPassword } });
      setAccountPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', loading: false, error: '' });
      Alert.alert('حسابي', result.message || 'تم تغيير كلمة المرور.');
    } catch (err) {
      setAccountPasswordForm(v => ({ ...v, loading: false, error: err.message || 'تعذر تغيير كلمة المرور.' }));
    }
  }

  async function startPasswordRecovery() {
    const phone = recoveryForm.phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) { setRecoveryForm(v => ({ ...v, error: 'اكتب رقم الهاتف المسجل بالحساب بشكل صحيح.' })); return; }
    setRecoveryForm(v => ({ ...v, loading: true, error: '', info: '' }));
    try {
      const result = await api('/password-recovery/request', { method: 'POST', body: { role: recoveryForm.role, phone } });
      setRecoveryForm(v => ({ ...v, phone, token: result.recoveryToken, id: result.requestId, info: result.message, loading: false }));
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر فتح طلب الدعم.' })); }
  }

  async function refreshPasswordRecovery() {
    if (!recoveryForm.id || !recoveryForm.token) return;
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id), { headers: { 'X-Recovery-Token': recoveryForm.token } });
      setRecoveryForm(v => ({ ...v, messages: result.recovery?.messages || v.messages, info: result.recovery?.status ? 'حالة الطلب: ' + result.recovery.status : v.info }));
    } catch (_) {}
  }

  async function sendRecoveryMessage() {
    const text = recoveryForm.text.trim();
    if (!text) return;
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/messages', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { text } });
      setRecoveryForm(v => ({ ...v, text: '', messages: result.recovery?.messages || v.messages, loading: false }));
      await refreshPasswordRecovery();
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر إرسال الرسالة.' })); }
  }

  async function verifyRecoveryCode() {
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/verify-code', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { code: recoveryForm.code } });
      setRecoveryForm(v => ({ ...v, loading: false, info: result.message || 'تم التحقق من الرمز.' }));
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'رمز التحقق غير صحيح.' })); }
  }

  async function resetRecoveredPassword() {
    if (recoveryForm.newPassword.length < 8 || recoveryForm.newPassword !== recoveryForm.confirmPassword) { setRecoveryForm(v => ({ ...v, error: 'كلمة المرور الجديدة 8 أحرف على الأقل ويجب أن يتطابق التأكيد.' })); return; }
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/reset-password', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { newPassword: recoveryForm.newPassword, confirmPassword: recoveryForm.confirmPassword } });
      Alert.alert('تمت الاستعادة', result.message || 'تم تغيير كلمة المرور.');
      setRecoveryForm({ role: 'client', phone: '', token: '', id: '', messages: [], text: '', code: '', newPassword: '', confirmPassword: '', loading: false, error: '', info: '' });
      setScreen('login');
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر تغيير كلمة المرور.' })); }
  }

  useEffect(() => {
    if (screen !== 'passwordRecovery' || !recoveryForm.id || !recoveryForm.token) return;
    const timer = setInterval(refreshPasswordRecovery, 3000);
    return () => clearInterval(timer);
  }, [screen, recoveryForm.id, recoveryForm.token]);

  async function startPasswordRecovery() {
    const phone = recoveryForm.phone.replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) { setRecoveryForm(v => ({ ...v, error: 'اكتب رقم الهاتف المسجل بالحساب بشكل صحيح.' })); return; }
    setRecoveryForm(v => ({ ...v, loading: true, error: '', info: '' }));
    try {
      const result = await api('/password-recovery/request', { method: 'POST', body: { role: recoveryForm.role, phone } });
      setRecoveryForm(v => ({ ...v, phone, token: result.recoveryToken, id: result.requestId, info: result.message, loading: false }));
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر فتح طلب الدعم.' })); }
  }

  async function refreshPasswordRecovery() {
    if (!recoveryForm.id || !recoveryForm.token) return;
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id), { headers: { 'X-Recovery-Token': recoveryForm.token } });
      setRecoveryForm(v => ({ ...v, messages: result.recovery?.messages || v.messages, info: result.recovery?.status ? 'حالة الطلب: ' + result.recovery.status : v.info }));
    } catch (_) {}
  }

  async function sendRecoveryMessage() {
    const text = recoveryForm.text.trim();
    if (!text) return;
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/messages', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { text } });
      setRecoveryForm(v => ({ ...v, text: '', messages: result.recovery?.messages || v.messages, loading: false }));
      await refreshPasswordRecovery();
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر إرسال الرسالة.' })); }
  }

  async function verifyRecoveryCode() {
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/verify-code', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { code: recoveryForm.code } });
      setRecoveryForm(v => ({ ...v, loading: false, info: result.message || 'تم التحقق من الرمز.' }));
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'رمز التحقق غير صحيح.' })); }
  }

  async function resetRecoveredPassword() {
    if (recoveryForm.newPassword.length < 8 || recoveryForm.newPassword !== recoveryForm.confirmPassword) { setRecoveryForm(v => ({ ...v, error: 'كلمة المرور الجديدة 8 أحرف على الأقل ويجب أن يتطابق التأكيد.' })); return; }
    setRecoveryForm(v => ({ ...v, loading: true, error: '' }));
    try {
      const result = await api('/password-recovery/request/' + encodeURIComponent(recoveryForm.id) + '/reset-password', { method: 'POST', headers: { 'X-Recovery-Token': recoveryForm.token }, body: { newPassword: recoveryForm.newPassword, confirmPassword: recoveryForm.confirmPassword } });
      Alert.alert('تمت الاستعادة', result.message || 'تم تغيير كلمة المرور.');
      setRecoveryForm({ role: 'client', phone: '', token: '', id: '', messages: [], text: '', code: '', newPassword: '', confirmPassword: '', loading: false, error: '', info: '' });
      setScreen('login');
    } catch (err) { setRecoveryForm(v => ({ ...v, loading: false, error: err.message || 'تعذر تغيير كلمة المرور.' })); }
  }

  useEffect(() => {
    if (screen !== 'passwordRecovery' || !recoveryForm.id || !recoveryForm.token) return;
    const timer = setInterval(refreshPasswordRecovery, 3000);
    return () => clearInterval(timer);
  }, [screen, recoveryForm.id, recoveryForm.token]);

  async function adminRefreshExtras() { setReloadKey(v => v + 1); }
  async function adminAddService() {
    const name = adminServiceDraft.name.trim(), category = adminServiceDraft.category.trim();
    if (name.length < 2 || name.length > 100 || category.length < 2 || category.length > 100) { Alert.alert('بيانات الخدمة', 'اكتب اسم الخدمة والقسم بشكل صحيح.'); return; }
    try { const result = await api('/admin/services', { method: 'POST', token: session.token, body: { name, category, emoji: adminServiceDraft.emoji || '🔧' } }); Alert.alert('تمت الإضافة', result.message || 'تمت إضافة الخدمة.'); setAdminServiceDraft(v => ({ ...v, name: '' })); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر إضافة الخدمة', err.message || 'حاول مرة أخرى.'); }
  }
  function adminBeginServiceEdit(category, service) { setAdminServiceEdit({ category, oldName: service, name: service }); }
  async function adminSaveServiceEdit() {
    const { category, oldName, name } = adminServiceEdit, next = String(name || '').trim();
    if (!category || !oldName || next.length < 2 || next.length > 100) { Alert.alert('تعديل الخدمة', 'اكتب اسمًا من حرفين إلى 100 حرف.'); return; }
    try { const result = await api('/admin/services/' + encodeURIComponent(oldName) + '?category=' + encodeURIComponent(category), { method: 'PATCH', token: session.token, body: { name: next, category } }); Alert.alert('تم التعديل', result.message || 'تم تحديث اسم الخدمة.'); setAdminServiceEdit({ category: '', oldName: '', name: '' }); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر التعديل', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminMoveCategory(index, direction) {
    const list = adminExtras.services.slice(), next = index + direction;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    try { await api('/admin/services/categories/order', { method: 'PATCH', token: session.token, body: { categories: list.map(item => String(item.label || item.name)) } }); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر ترتيب الأقسام', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminMoveService(category, serviceName, direction) {
    const categoryItem = adminExtras.services.find(item => String(item.label || item.name) === category);
    const list = (categoryItem?._detailed || (categoryItem?.services || []).map(name => ({ name }))).map(item => ({ name: item.name, sortOrder: 0, emoji: item.emoji || categoryItem?.emoji || '🔧', isActive: item.isActive !== false }));
    const index = list.findIndex(item => item.name === serviceName), next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]]; list.forEach((item, i) => { item.sortOrder = (i + 1) * 10; });
    try { await api('/admin/services/order', { method: 'PATCH', token: session.token, body: { category, items: list } }); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر ترتيب الخدمات', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminToggleService(category, service, active) {
    const action = active ? 'إظهار' : 'إخفاء';
    Alert.alert(action + ' الخدمة', 'هل تريد ' + action + ' «' + service + '»؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'تأكيد', onPress: async () => { try { await api('/admin/services/' + encodeURIComponent(service) + '/' + (active ? 'show' : 'hide') + '?category=' + encodeURIComponent(category), { method: 'POST', token: session.token, body: { category } }); setReloadKey(v => v + 1); } catch (err) { Alert.alert('تعذر ' + action + ' الخدمة', err.message || 'حاول مرة أخرى.'); } } }]);
  }
  async function adminDeleteService(category, service) {
    Alert.alert('حذف الخدمة', 'حذف «' + service + '» من قسم «' + category + '»؟ الطلبات القديمة تظل محفوظة.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { try { await api('/admin/services/' + encodeURIComponent(service) + '?category=' + encodeURIComponent(category), { method: 'DELETE', token: session.token }); setReloadKey(v => v + 1); } catch (err) { Alert.alert('تعذر الحذف', err.message || 'حاول مرة أخرى.'); } } }]);
  }
  async function adminSavePricing() {
    const p = adminExtras.pricing;
    if (![p.check,p.commission,p.minOffer,p.maxOffer].every(v => Number.isFinite(Number(v))) || p.check < 0 || p.commission < 0 || p.commission > 100 || p.minOffer < 1 || p.maxOffer < p.minOffer) { Alert.alert('راجع الأسعار', 'تأكد من الرسوم والعمولة والحدود السعرية.'); return; }
    try { const result = await api('/admin/pricing', { method: 'PUT', token: session.token, body: { check: Number(p.check), commission: Number(p.commission), minOffer: Number(p.minOffer), maxOffer: Number(p.maxOffer) } }); Alert.alert('تم الحفظ', result.message || 'تم حفظ الأسعار والعمولات.'); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر حفظ الأسعار', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminAddRegion() {
    const name = adminRegionDraft.trim().replace(/\\s+/g, ' ');
    if (name.length < 2 || name.length > 100) { Alert.alert('اسم المنطقة', 'اكتب اسمًا من حرفين إلى 100 حرف.'); return; }
    try { const result = await api('/admin/regions', { method: 'POST', token: session.token, body: { name } }); Alert.alert('تمت الإضافة', result.message || 'تمت إضافة المنطقة.'); setAdminRegionDraft(''); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر إضافة المنطقة', err.message || 'قد تكون المنطقة موجودة بالفعل.'); }
  }
  async function adminSaveSettings() {
    const value = adminExtras.settings;
    if (value.siteName.trim().length < 2 || !Number.isInteger(Number(value.maxFanniSignupAttempts)) || value.maxFanniSignupAttempts < 1 || value.maxFanniSignupAttempts > 100) { Alert.alert('راجع الإعدادات', 'اسم المنصة مطلوب وحد المحاولات من 1 إلى 100.'); return; }
    try { const result = await api('/admin/settings', { method: 'PUT', token: session.token, body: { ...value, maxFanniSignupAttempts: Number(value.maxFanniSignupAttempts) } }); Alert.alert('تم الحفظ', result.message || 'تم حفظ الإعدادات.'); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر حفظ الإعدادات', err.message || 'حاول مرة أخرى.'); }
  }
  function adminAddFaqDraft() {
    const question = adminFaqDraft.question.trim(), answer = adminFaqDraft.answer.trim();
    if (question.length < 2 || question.length > 250 || answer.length < 2 || answer.length > 1000) { Alert.alert('الأسئلة الشائعة', 'السؤال من 2 إلى 250 حرفًا والإجابة من 2 إلى 1000 حرف.'); return; }
    setAdminExtras(c => ({ ...c, content: { ...c.content, faqs: [...c.content.faqs, { question, answer, active: true }] } }));
    setAdminFaqDraft({ question: '', answer: '' });
  }
  async function adminSaveContent() {
    const announcement = String(adminAnnouncementDraft || '').trim(), faqs = adminExtras.content.faqs;
    if (announcement.length > 1000 || faqs.length > 100) { Alert.alert('محتوى المنصة', 'الإعلان حتى 1000 حرف والأسئلة حتى 100 سؤال.'); return; }
    try { const result = await api('/admin/content', { method: 'PUT', token: session.token, body: { announcement, faqs } }); Alert.alert('تم الحفظ', result.message || 'تم حفظ محتوى المنصة.'); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر حفظ المحتوى', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminGenerateReport() {
    const filters = adminReportFilters;
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) { Alert.alert('فلاتر التقرير', 'تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.'); return; }
    try { const result = await api('/admin/reports', { method: 'POST', token: session.token, body: filters }); setAdminExtras(c => ({ ...c, report: result })); }
    catch (err) { Alert.alert('تعذر إنشاء التقرير', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminOrderAction(order, action) {
    const sn = String(order?.sn || order?.orderSn || '').trim().toUpperCase();
    if (!/^SN\d{6}$/.test(sn)) { Alert.alert('كود الطلب', 'كود الطلب غير صالح.'); return; }
    const label = action === 'cancel' ? 'إلغاء' : 'أرشفة';
    Alert.alert(label + ' الطلب ' + sn, 'هل تؤكد ' + label + ' الطلب؟ سيتم تسجيل الإجراء في سجل الإدارة.', [{ text: 'رجوع', style: 'cancel' }, { text: 'تأكيد', style: 'destructive', onPress: async () => { try { const result = await api('/admin/orders/' + encodeURIComponent(sn) + '/' + action, { method: 'POST', token: session.token, body: { reason: 'إجراء إداري من تطبيق صُنّاع' } }); Alert.alert('تم الإجراء', result.message || 'تم تحديث الطلب.'); setReloadKey(v => v + 1); } catch (err) { Alert.alert('تعذر ' + label + ' الطلب', err.message || 'راجع حالة الطلب.'); } } }]);
  }
  async function adminClientAction(phone, action) {
    if (!phone) return Alert.alert('بيانات العميل', 'رقم الهاتف غير متاح.');
    const labels = { block: 'تعليق الحساب', unblock: 'إعادة تفعيل الحساب', account: 'حذف الحساب' };
    Alert.alert(labels[action], 'هل تريد ' + labels[action] + ' للعميل ' + phone + '؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'تأكيد', style: 'destructive', onPress: async () => { try { const method = action === 'account' ? 'DELETE' : 'POST'; const result = await api('/admin/clients/' + encodeURIComponent(phone) + (action === 'account' ? '/account' : '/' + action), { method, token: session.token, body: { ...(action === 'block' ? { reason: 'تعليق إداري من تطبيق صُنّاع' } : {}) } }); Alert.alert('تم الإجراء', result.message || 'تم تحديث حساب العميل.'); setReloadKey(v => v + 1); } catch (err) { Alert.alert('تعذر تنفيذ الإجراء', err.message || 'راجع حالة حساب العميل والطلبات النشطة.'); } } }]);
  }
  async function adminSetTechnicianLevel(fanni, level) {
    const id = fanni?._id || fanni?.id; if (!id) return;
    try { const result = await api('/admin/fannis/' + encodeURIComponent(id) + '/level', { method: 'PATCH', token: session.token, body: { level, reason: 'تحديث المستوى من تطبيق الإدارة' } }); Alert.alert('تم تحديث المستوى', result.message || level); setReloadKey(v => v + 1); }
    catch (err) { Alert.alert('تعذر تحديث المستوى', err.message || 'حاول مرة أخرى.'); }
  }

  async function adminLoadWalletTransactions() {
    if (!adminWallet.fanniId) { Alert.alert('كشف المحفظة', 'اختار الفني أولًا.'); return; }
    setAdminWallet(c => ({ ...c, loading: true, transactions: [] }));
    try { const result = await api('/admin/wallet/transactions/' + encodeURIComponent(adminWallet.fanniId), { token: session.token }); setAdminWallet(c => ({ ...c, loading: false, transactions: toList(result, ['transactions','items','data']) })); }
    catch (err) { setAdminWallet(c => ({ ...c, loading: false })); Alert.alert('تعذر تحميل كشف المحفظة', err.message || 'حاول مرة أخرى.'); }
  }
  async function adminWalletAction(action) {
    const id = adminWallet.fanniId, fanni = adminData.fannis.find(item => String(item._id || item.id) === String(id));
    if (!id || !fanni) { Alert.alert('محفظة الفني', 'اختار الفني أولًا.'); return; }
    const reason = adminWallet.reason.trim();
    if (reason.length < 2) { Alert.alert('سبب الإجراء', 'اكتب سببًا واضحًا من حرفين على الأقل.'); return; }
    const amount = Number(adminWallet.amount);
    if (action === 'balance' && (adminWallet.amount.trim() === '' || !Number.isFinite(amount) || amount < 0)) { Alert.alert('الرصيد', 'اكتب رصيدًا صحيحًا غير سالب.'); return; }
    Alert.alert('تأكيد إجراء المحفظة', action === 'balance' ? 'تعيين الرصيد إلى ' + amount + ' جنيه؟' : action === 'freeze' ? 'تجميد محفظة الفني؟' : 'إلغاء تجميد محفظة الفني؟', [{ text: 'إلغاء', style: 'cancel' }, { text: 'تأكيد', style: 'destructive', onPress: async () => { try { let result; if (action === 'balance') result = await api('/admin/fannis/' + encodeURIComponent(id) + '/set-balance', { method: 'POST', token: session.token, body: { amount, reason } }); else result = await api('/admin/wallet/freeze/' + encodeURIComponent(id), { method: 'POST', token: session.token, body: { action, reason } }); Alert.alert('تم الإجراء', result.message || 'تم تحديث المحفظة.'); setAdminWallet(c => ({ ...c, reason: '' })); setReloadKey(v => v + 1); await adminLoadWalletTransactions(); } catch (err) { Alert.alert('تعذر إجراء المحفظة', err.message || 'حاول مرة أخرى.'); } } }]);
  }

  async function adminLoadAuditLogs() {
    try { const result = await api('/admin/audit-logs', { token: session.token }); setAdminExtras(c => ({ ...c, auditLogs: toList(result, ['logs','items']) })); }
    catch (err) { Alert.alert('تعذر تحميل سجل التدقيق', err.message || 'حاول مرة أخرى.'); }
  }

  async function copyOrderCode(code) {
    try { await Clipboard.setStringAsync(String(code || '')); Alert.alert('تم النسخ', 'تم نسخ كود الطلب.'); }
    catch { Alert.alert('تعذر النسخ', 'اضغط مطولًا على الكود لنسخه يدويًا.'); }
  }

  function openWhatsAppSupport() {
    setSupportCase(null);
    setSupportDraft('');
    setSupportError('');
    setScreen('support');
  }

  async function performLogout() {
    const activeSession = session;
    const pushToken = pushTokenRef.current;
    if (activeSession && pushToken && ['client', 'fanni', 'admin'].includes(activeSession.role)) {
      try {
        await api('/notifications/' + activeSession.role + '/push-token', {
          method: 'DELETE', token: activeSession.token, body: { token: pushToken }
        });
      } catch (_) {}
    }
    pushTokenRef.current = null;
    try { await SecureStore.deleteItemAsync('sonaa.auth.session.v1'); }
    catch (error) { console.warn('تعذر مسح الجلسة المحفوظة:', error?.message || error); }
    screenHistoryRef.current = [];
    screenRef.current = 'home';
    setScreenState('home');
    setSession(null); setUsername(''); setPassword('');
    setClientData({ orders: [], loading: false, error: '', sn: '', clientToken: '' });
    setTechData({ profile: null, orders: [], offers: [], wallet: [], loading: false, error: '', tab: 'offers' });
    setAdminData({ orders: [], fannis: [], clients: [], topups: [], complaints: [], loading: false, error: '', tab: 'orders' });
    setNotifications({ items: [], unread: 0, loading: false, error: '' });
    setAdminUsers([]);
  }

  function logout() {
    Alert.alert('تأكيد تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل الخروج', style: 'destructive', onPress: () => { void performLogout(); } }
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    async function registerPushToken() {
      if (!session || !['client', 'fanni', 'admin'].includes(session.role) || !Device.isDevice) return;
      try {
        const permission = await Notifications.getPermissionsAsync();
        let status = permission.status;
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted') return;
        const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.warn('Expo push registration skipped: missing projectId');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'إشعارات صُنّاع',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#14B8A6',
          });
        }
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !result?.data) return;
        pushTokenRef.current = result.data;
        await api('/notifications/' + session.role + '/push-token', {
          method: 'POST',
          token: session.token,
          body: { token: result.data, platform: Platform.OS }
        });
      } catch (error) {
        console.warn('Expo push registration failed:', error?.message || error);
      }
    }
    void registerPushToken();
    return () => { cancelled = true; };
  }, [session]);
  const goLogin = mode => { setAuthMode(mode); setUsername(''); setPassword(''); setScreen('login'); };
  const toggleArray = (key, value) => updateForm(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value]);

  if (authRestoring) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={COLORS.blue} /><Text style={styles.statusText}>جاري استعادة حسابك...</Text></View></SafeAreaView>;

  if (screen === 'login') return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Button title="رجوع للرئيسية" secondary onPress={() => setScreen('home')} />
      <View style={styles.loginHeading}>
        <Text style={styles.title}>{authMode === 'client' ? 'دخول العميل' : 'دخول الفني'}</Text>
        <Text style={styles.subtitle}>{authMode === 'client' ? 'سجّل دخولك لمتابعة طلباتك وخدماتك.' : 'سجّل دخولك لمتابعة فرص العمل وحسابك.'}</Text>
      </View>
      <Field label="رقم الهاتف أو البريد الإلكتروني" value={username} onChangeText={setUsername} placeholder="رقم الهاتف أو البريد الإلكتروني" keyboardType="default" />
      <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholder="اكتب كلمة السر" />
      <TouchableOpacity onPress={() => { setRecoveryForm({ role: authMode, phone: username, token: '', id: '', messages: [], text: '', code: '', newPassword: '', confirmPassword: '', loading: false, error: '', info: '' }); setScreen('passwordRecovery'); }}><Text style={styles.detail}>نسيت كلمة المرور؟ تواصل مع الدعم</Text></TouchableOpacity>
      <Button title={loginLoading ? 'جاري الدخول...' : authMode === 'client' ? 'دخول العميل' : 'دخول الفني'} onPress={handleLogin} disabled={loginLoading} />
      {authMode === 'client' && <Button title="إنشاء حساب عميل جديد" secondary onPress={() => setScreen('clientRegister')} />}
      {authMode === 'fanni' && <Button title="تسجيل فني جديد" secondary onPress={() => setScreen('technicianRegister')} />}
    </KeyboardAvoidingView>
  </SafeAreaView>;

  if (screen === 'account') {
    const isClientAccount = session?.role === 'client';
    const history = isClientAccount ? clientData.orders : session?.role === 'fanni' ? techData.offers : [];
    const completedHistory = (history || []).filter(item => ['تم الانتهاء', 'مكتمل', 'مكتملة', 'completed', 'complete', 'finished'].includes(String(item.status || item.orderStatus || '').trim().toLowerCase()));
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="رجوع" secondary onPress={() => setScreen(session?.role === 'client' ? 'client' : session?.role === 'fanni' ? 'technician' : 'admin')} />
      <Text style={styles.title}>حسابي</Text>
      <View style={styles.dataCard}>
        <Text style={styles.sectionTitle}>بيانات الحساب</Text>
        <Text style={styles.detail}>الاسم: {session?.user?.name || '—'}</Text>
        <Text style={styles.detail}>رقم الهاتف: {session?.user?.phone || '—'}</Text>
        <Text style={styles.detail}>نوع الحساب: {isClientAccount ? 'عميل' : session?.role === 'fanni' ? 'فني' : 'إدارة'}</Text>
        {session?.user?.status ? <Text style={styles.detail}>حالة الحساب: {session.user.status}</Text> : null}
        {session?.role === 'fanni' && Array.isArray(session?.user?.specialties) ? <Text style={styles.detail}>الخدمات والمهن: {session.user.specialties.join('، ') || '—'}</Text> : null}
        {session?.role === 'fanni' && Array.isArray(session?.user?.areas) ? <Text style={styles.detail}>مناطق العمل: {session.user.areas.join('، ') || '—'}</Text> : null}
        {session?.role === 'fanni' && session?.user?.level ? <Text style={styles.detail}>المستوى المهني: {session.user.level}</Text> : null}
        {session?.role === 'fanni' && session?.user?.walletBalance != null ? <Text style={styles.detail}>الرصيد: {String(session.user.walletBalance)}</Text> : null}
        {session?.user?.adminRole ? <Text style={styles.detail}>المنصب الإداري: {session.user.adminRole}</Text> : null}
      </View>
      <Button title="تغيير كلمة المرور" onPress={() => setScreen('changePassword')} />
      {['client', 'fanni'].includes(session?.role) ? <>
        <Text style={styles.sectionTitle}>سجل الخدمات والتقييمات</Text>
        <Text style={styles.detail}>التقييم التلقائي يظهر مرة واحدة فقط. لو تخطّيته، تقدر ترجع هنا وتقيّم العملية يدويًا.</Text>
        {completedHistory.length ? completedHistory.map((item, index) => {
          const sn = getOrderSN(item);
          const alreadyRated = Boolean(item.myRating || item.clientRating || item.fanniRating || item.ratingByClient || item.ratingByFanni || (item.ratings || []).some(r => r.reviewerRole === session.role));
          const rating = item.myRating || item.clientRating || item.fanniRating || {};
          return <View key={sn || index} style={styles.dataCard}>
            <Text style={styles.detail}>رقم العملية: {sn || '—'}</Text>
            <Text style={styles.detail}>الخدمة: {item.service || item.serviceName || item.title || 'خدمة'}</Text>
            <Text style={styles.detail}>{alreadyRated ? 'التقييم: ' + ('★'.repeat(Math.max(0, Math.min(5, Number(rating.stars || rating.rating) || 0))) + ' ' + String(rating.stars || rating.rating || 'تم التقييم')) : 'لم يتم التقييم'}</Text>
            {!alreadyRated ? <Button title="تقييم العملية يدويًا" secondary onPress={() => { setScreen(session.role === 'client' ? 'client' : 'technician'); setRatingPrompt({ role: session.role, order: item }); }} /> : null}
          </View>;
        }) : <Text style={styles.detail}>لا توجد عمليات مكتملة لعرضها حاليًا.</Text>}
      </> : null}
    </ScrollView></SafeAreaView>;
  }

  if (screen === 'changePassword') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="رجوع إلى حسابي" secondary onPress={() => setScreen('account')} /><Text style={styles.title}>تغيير كلمة المرور</Text><Text style={styles.detail}>اكتب كلمة المرور الحالية ثم كلمة المرور الجديدة.</Text><Field label="كلمة المرور الحالية" value={accountPasswordForm.currentPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, currentPassword: v }))} secureTextEntry /><Field label="كلمة المرور الجديدة" value={accountPasswordForm.newPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={accountPasswordForm.confirmPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title={accountPasswordForm.loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'} onPress={changeAccountPassword} disabled={accountPasswordForm.loading} />{accountPasswordForm.error ? <Text style={styles.errorText}>{accountPasswordForm.error}</Text> : null}</ScrollView></SafeAreaView>;

  if (screen === 'passwordRecovery') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="رجوع لتسجيل الدخول" secondary onPress={() => setScreen('login')} /><Text style={styles.title}>استعادة كلمة المرور</Text><Text style={styles.detail}>سيقوم الدعم بالتحقق من ملكية الحساب ثم إرسال رمز مؤقت داخل هذه المحادثة.</Text>{!recoveryForm.token ? <><Field label="رقم الهاتف المسجل" value={recoveryForm.phone} onChangeText={v => setRecoveryForm(c => ({ ...c, phone: v }))} keyboardType="phone-pad" /><Button title={recoveryForm.loading ? 'جاري إرسال الطلب...' : 'فتح طلب دعم'} onPress={startPasswordRecovery} disabled={recoveryForm.loading} /></> : <><Text style={styles.sectionTitle}>محادثة استعادة الحساب</Text><Text style={styles.detail}>{recoveryForm.info}</Text>{recoveryForm.messages.map((m,i) => <View key={String(m._id||i)} style={styles.chatMessage}><Text style={styles.detail}>{m.senderRole === 'admin' ? 'الدعم' : 'أنت'} • {dateLabel(m.createdAt)}</Text><Text style={styles.chatMessageText}>{m.text}</Text></View>)}<Field label="رسالة للدعم" value={recoveryForm.text} onChangeText={v => setRecoveryForm(c => ({ ...c, text: v }))} multiline /><Button title="إرسال رسالة للدعم" onPress={sendRecoveryMessage} disabled={recoveryForm.loading} /><Field label="رمز الاستعادة الذي أرسله الدعم" value={recoveryForm.code} onChangeText={v => setRecoveryForm(c => ({ ...c, code: v }))} keyboardType="number-pad" /><Button title="التحقق من الرمز" secondary onPress={verifyRecoveryCode} disabled={recoveryForm.loading} /><Field label="كلمة المرور الجديدة" value={recoveryForm.newPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={recoveryForm.confirmPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title="حفظ كلمة المرور الجديدة" onPress={resetRecoveredPassword} disabled={recoveryForm.loading} /><Button title="تحديث المحادثة" secondary onPress={refreshPasswordRecovery} /></>}{recoveryForm.error ? <Text style={styles.errorText}>{recoveryForm.error}</Text> : null}</ScrollView></SafeAreaView>;

  if (screen === 'passwordRecovery') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="رجوع لتسجيل الدخول" secondary onPress={() => setScreen('login')} /><Text style={styles.title}>استعادة كلمة المرور</Text><Text style={styles.detail}>سيتحقق الدعم من ملكية الحساب ثم يرسل رمزًا مؤقتًا داخل هذه المحادثة.</Text>{!recoveryForm.token ? <><Field label="رقم الهاتف المسجل" value={recoveryForm.phone} onChangeText={v => setRecoveryForm(c => ({ ...c, phone: v }))} keyboardType="phone-pad" /><Button title={recoveryForm.loading ? 'جاري إرسال الطلب...' : 'فتح طلب دعم'} onPress={startPasswordRecovery} disabled={recoveryForm.loading} /></> : <><Text style={styles.sectionTitle}>محادثة استعادة الحساب</Text><Text style={styles.detail}>{recoveryForm.info}</Text>{recoveryForm.messages.map((m,i) => <View key={String(m._id||i)} style={styles.chatMessage}><Text style={styles.detail}>{m.senderRole === 'admin' ? 'الدعم' : 'أنت'} • {dateLabel(m.createdAt)}</Text><Text style={styles.chatMessageText}>{m.text}</Text></View>)}<Field label="رسالة للدعم" value={recoveryForm.text} onChangeText={v => setRecoveryForm(c => ({ ...c, text: v }))} multiline /><Button title="إرسال رسالة للدعم" onPress={sendRecoveryMessage} disabled={recoveryForm.loading} /><Field label="رمز الاستعادة الذي أرسله الدعم" value={recoveryForm.code} onChangeText={v => setRecoveryForm(c => ({ ...c, code: v }))} keyboardType="number-pad" /><Button title="التحقق من الرمز" secondary onPress={verifyRecoveryCode} disabled={recoveryForm.loading} /><Field label="كلمة المرور الجديدة" value={recoveryForm.newPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={recoveryForm.confirmPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title="حفظ كلمة المرور الجديدة" onPress={resetRecoveredPassword} disabled={recoveryForm.loading} /><Button title="تحديث المحادثة" secondary onPress={refreshPasswordRecovery} /></>}{recoveryForm.error ? <Text style={styles.errorText}>{recoveryForm.error}</Text> : null}</ScrollView></SafeAreaView>;

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
    <ScrollView ref={clientScrollRef} contentContainerStyle={[styles.page, { paddingBottom: 110 }]}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>حساب العميل</Text><Text style={styles.subtitle}>أهلًا {session.user?.name || 'بك'}</Text></View><TouchableOpacity onPress={() => { setNotificationsOpen(v => !v); setReloadKey(v => v + 1); }} style={styles.bellButton}><Text style={styles.bellText}>🔔</Text>{notifications.unread > 0 ? <Text style={styles.bellBadge}>{notifications.unread}</Text> : null}</TouchableOpacity><Button title="حسابي" secondary onPress={() => setScreen('account')} /><Button title="خروج" secondary onPress={logout} /></View>
      {clientTab === 'new' ? <><Text style={styles.sectionTitle}>اطلب خدمة</Text><View style={styles.dataCard}><Text style={styles.detail}>اسم العميل: {session.user?.name || '—'}</Text><Text style={styles.detail}>رقم الهاتف المسجل: {session.user?.phone || '—'}</Text><Text style={styles.detail}>بيانات الحساب مرتبطة بالطلب تلقائيًا.</Text></View>
      {servicesLoading ? <ActivityIndicator color={COLORS.teal} /> : <>
        <Text style={styles.fieldLabel}>المهنة الرئيسية</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => setServicePickerOpen(value => !value)} style={styles.dropdownButton}>
          <Text style={styles.dropdownButtonText}>{selected?.label || 'اختر الخدمة المطلوبة'}</Text><Text style={styles.dropdownArrow}>{servicePickerOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {servicePickerOpen ? <View style={styles.dropdownOptions}>{categories.map(category => <TouchableOpacity key={category.label} onPress={() => { setSelected(category); updateForm('service', ''); setServicePickerOpen(false); setSubservicePickerOpen(false); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{category.emoji || '🛠️'} {category.label}</Text></TouchableOpacity>)}</View> : null}
        <Text style={styles.fieldLabel}>الخدمة التفصيلية</Text>
        <TouchableOpacity accessibilityRole="button" disabled={!selected} onPress={() => setSubservicePickerOpen(value => !value)} style={[styles.dropdownButton, !selected && styles.disabledButton]}>
          <Text style={styles.dropdownButtonText}>{form.service || 'حدد نوع الخدمة بالضبط'}</Text><Text style={styles.dropdownArrow}>{subservicePickerOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {subservicePickerOpen && selected ? <View style={styles.dropdownOptions}>{(selected.services || []).map(service => <TouchableOpacity key={service} onPress={() => { updateForm('service', service); setSubservicePickerOpen(false); }} style={styles.dropdownOption}><Text style={styles.dropdownOptionText}>{service}</Text></TouchableOpacity>)}</View> : null}
        <Field label="الحي أو المنطقة *" value={form.area} onChangeText={v => updateForm('area', v)} placeholder="اكتب الحي أو المنطقة بنفسك، مثال: المعادي" />
        <Field label="العنوان بالتفصيل *" value={form.address} onChangeText={v => updateForm('address', v)} placeholder="الشارع ورقم العقار وأقرب علامة مميزة" />
        <Field label="تفاصيل الشغل المطلوبة *" value={form.description} onChangeText={v => updateForm('description', v)} multiline placeholder="اكتب تفاصيل الخدمة اللي محتاجها عشان الفني يقدر يقدم لك عرضًا مضبوطًا" />
        <Text style={styles.note}>اكتب تفاصيل الشغل المطلوبة بوضوح؛ التفاصيل إلزامية وتساعد الفني على تقديم عرض مناسب.</Text>
        <Field label="ميزانية متوقعة (اختياري)" value={form.budget} onChangeText={v => updateForm('budget', v)} placeholder="مثال: حسب المعاينة" />
        <Button title={loginLoading ? 'جاري إرسال الطلب...' : 'إرسال طلب الخدمة'} onPress={createOrder} disabled={loginLoading} />
      </>}</> : null}
      {clientData.sn ? <View style={styles.codeRow}><Text selectable style={styles.successText}>كود الطلب: {clientData.sn}</Text><Button title="نسخ الكود" secondary onPress={() => copyOrderCode(clientData.sn)} /></View> : null}
      <Text style={styles.sectionTitle}>طلبات العميل</Text>
      <View style={styles.tabRow}>{[{key:'new',label:'طلب جديد',count:0},{key:'current',label:'طلبات جارية',count:clientData.orders.filter(o => !['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status)).length},{key:'previous',label:'طلبات سابقة',count:clientData.orders.filter(o => ['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status)).length},{key:'track',label:'تتبع طلب',count:0},{key:'complaint',label:'شكوى',count:0}].map(t => <TouchableOpacity key={t.key} onPress={() => setClientTab(t.key)} style={[styles.pill, clientTab===t.key && styles.pillActive]}><Text style={[styles.pillText,clientTab===t.key && styles.pillTextActive]}>{t.label}{t.key!=='new' ? ` (${t.count})` : ''}</Text></TouchableOpacity>)}</View>
      {['current','previous'].includes(clientTab) ? (clientData.loading ? <ActivityIndicator color={COLORS.teal} /> : clientData.error ? <Text style={styles.errorText}>{clientData.error}</Text> : clientData.orders.filter(o => clientTab==='previous' ? ['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status) : !['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status)).map((order, i) => {
        const sn = getOrderSN(order), expanded = Boolean(expandedClientOrders[sn]), rating = ratingDrafts[sn];
        return <View key={String(order._id || sn || i)} style={styles.dataCard}>
          <TouchableOpacity onPress={() => setExpandedClientOrders(current => ({ ...current, [sn]: !current[sn] }))}><Text style={styles.cardTitle}>{order.service || 'طلب خدمة'} — {sn}</Text><Text style={styles.detail}>{order.status || 'قيد المراجعة'} • {order.area || ''}</Text><Text style={styles.detail}>{expanded ? 'اضغط لإخفاء التفاصيل' : 'اضغط لعرض تفاصيل الطلب'}</Text></TouchableOpacity>
          {expanded ? <><Text style={styles.detail}>{dateLabel(order.createdAt)}</Text><Text style={styles.detail}>{order.description || 'لا توجد تفاصيل إضافية.'}</Text><Text style={styles.detail}>{order.acceptedOfferPrice ? `السعر المتفق عليه: ${order.acceptedOfferPrice} جنيه` : ''}</Text>
            {order.status === 'تم اختيار فني' && order.assignedFanniName ? <Text style={styles.detail}>الفني المختار: {order.assignedFanniName}</Text> : null}
            {order.status === 'تم اختيار فني' && order.assignedFanniPhone ? <><Text style={styles.detail}>رقم الفني: {order.assignedFanniPhone}</Text><Button title="اتصال بالفني" secondary onPress={() => Linking.openURL(`tel:${order.assignedFanniPhone}`)} /></> : null}
            {!['تم اختيار فني','تم الانتهاء','ملغي','مؤرشف','منتهي','منتهي - اعتذار'].includes(order.status) ? <Button title="إلغاء الطلب" secondary onPress={() => cancelClientOrder(order)} /> : null}
            {Array.isArray(order.offers) && order.offers.length ? <><Text style={styles.sectionTitle}>عروض الفنيين ({order.offers.length})</Text>{order.offers.map((offer,j)=><View key={String(offer._id||offer.id||j)} style={styles.offerCard}><Text style={styles.cardTitle}>{offer.fanniName||offer.technicianName||'فني'} — {offer.price??'—'} جنيه</Text><Text style={styles.detail}>{offer.message||''}</Text>{order.status!=='تم اختيار فني'&&order.status!=='تم الانتهاء'&&<><Text style={styles.detail}>استفسار سريع قبل قبول العرض:</Text><View style={styles.roleActions}>{['هل السعر شامل؟','متى تقدر تيجي؟','هل في تكلفة إضافية؟'].map(question=><Button key={question} title={question} secondary onPress={()=>sendOrderChat({...order,_id:offer._id||offer.id},question)}/>)}</View><Button title={orderChats[sn]?.open && String(orderChats[sn]?.targetOfferId)===String(offer._id||offer.id)?'إخفاء المحادثة':'محادثة قبل القبول'} secondary onPress={()=>toggleOrderChat({...order,_id:offer._id||offer.id,offerId:offer._id||offer.id},'client')}/><Button title="قبول العرض" onPress={()=>acceptClientOffer(order,offer)}/></>}</View>)}</> : <Text style={styles.detail}>لا توجد عروض حتى الآن.</Text>}
            <View style={styles.roleActions}>{(Array.isArray(order.offers) && order.offers.length > 0 || ['تم اختيار فني','تم الانتهاء'].includes(order.status || order.orderStatus)) ? <Button title={orderChats[sn]?.open?'إخفاء المحادثة':'محادثة الطلب'} secondary onPress={()=>toggleOrderChat(order,'client')}/> : null}{order.status==='تم الانتهاء'&&!rating?.submitted&&!rating?.skipped&&!dismissedRatings[sn]?<Button title="تقييم الفني" onPress={()=>setRatingDrafts(current=>({...current,[sn]:{stars:'5',comment:'',blockFuture:false}}))}/>:null}</View>
            {order.status==='تم الانتهاء'&&rating&&!rating.submitted&&!rating.skipped?<View style={styles.offerCard}><Text style={styles.cardTitle}>تقييم الفني</Text>{renderRatingStars(order, Number(rating.stars || 5))}<Field label="تعليق (اختياري)" value={rating.comment||''} onChangeText={value=>setRatingDrafts(current=>({...current,[sn]:{...current[sn],comment:value}}))} multiline/>{Number(rating.stars)===1?<TouchableOpacity style={styles.inlineCheck} onPress={()=>setRatingDrafts(current=>({...current,[sn]:{...current[sn],blockFuture:!current[sn]?.blockFuture}}))}><Text style={styles.detail}>{rating.blockFuture?'☑':'☐'} عدم استقبال عروض من الفني ده مرة تانية</Text></TouchableOpacity>:null}<Button title="حفظ التقييم" onPress={()=>submitOrderRating(order)}/></View>:null}
            {(Array.isArray(order.offers) && order.offers.length > 0 || ['تم اختيار فني','تم الانتهاء'].includes(order.status || order.orderStatus)) && orderChats[sn]?.open ? <View style={styles.chatPanel}>{orderChats[sn]?.loading?<ActivityIndicator color={COLORS.teal}/>:<>{orderChats[sn]?.error?<Text style={styles.errorText}>{orderChats[sn].error}</Text>:null}<ScrollView ref={chatScrollRef} style={{ maxHeight: 280 }} onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })} nestedScrollEnabled>{(orderChats[sn]?.messages||[]).map((message,j)=><View key={String(message._id||j)} style={[styles.chatMessage, message.senderRole === 'client' ? styles.chatMessageClient : styles.chatMessageTechnician]}><Text style={styles.detail}>{message.senderRole==='client'?'العميل':'الفني'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}</ScrollView>{(orderChats[sn]?.priceChangeRequests||[]).filter(request=>request.status==='قيد الموافقة').map(request=><View key={String(request._id||request.id)} style={styles.priceRequest}><Text style={styles.cardTitle}>طلب تعديل السعر</Text><Text style={styles.detail}>من {request.oldPrice} إلى {request.newPrice} جنيه</Text><Text style={styles.detail}>السبب: {request.reason}</Text><View style={styles.roleActions}><Button title="موافقة" onPress={()=>decideOrderPrice(order,request,true)}/><Button title="رفض" secondary onPress={()=>decideOrderPrice(order,request,false)}/></View></View>)}<Field label="رسالة للفني" value={chatDrafts[sn]||''} onChangeText={value=>setChatDrafts(current=>({...current,[sn]:value}))} multiline returnKeyType="send" blurOnSubmit onSubmitEditing={()=>sendOrderChat(order)} placeholder="اكتب رسالتك داخل المنصة"/><View style={styles.roleActions}><Button title="إرسال الرسالة" onPress={()=>sendOrderChat(order)}/><Button title="تحديث المحادثة" secondary onPress={()=>refreshOrderChat(order,'client')}/></View></>}</View>:null}
          </> : null}
        </View>;
      })) : null}
      {clientTab === 'track' ? <View style={styles.dataCard}><Text style={styles.cardTitle}>تتبع طلبك</Text><Field label="كود الطلب" value={clientTrackSN} onChangeText={setClientTrackSN} placeholder="SN123456" autoCapitalize="characters"/><Button title={clientTrackLoading ? 'جاري البحث...' : 'تتبع الطلب'} onPress={trackClientOrder} disabled={clientTrackLoading}/>{clientTrackError ? <Text style={styles.errorText}>{clientTrackError}</Text> : null}{clientTrackedOrder ? <View style={styles.offerCard}><Text style={styles.cardTitle}>{clientTrackedOrder.service || 'طلب خدمة'} — {getOrderSN(clientTrackedOrder)}</Text><Text style={styles.detail}>الحالة: {clientTrackedOrder.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>المنطقة: {clientTrackedOrder.area || '—'}</Text><Text style={styles.detail}>{clientTrackedOrder.description || clientTrackedOrder.details || ''}</Text><Text style={styles.detail}>السعر المتفق عليه: {clientTrackedOrder.acceptedOfferPrice ?? 'غير محدد'} جنيه</Text>{(clientTrackedOrder.offers || []).map((offer, i) => <View key={String(offer._id || offer.id || i)} style={styles.priceRequest}><Text style={styles.cardTitle}>{offer.fanniName || offer.technicianName || 'فني'} — {offer.price ?? '—'} جنيه</Text><Text style={styles.detail}>{offer.message || ''}</Text>{!clientTrackedOrder.acceptedOfferId && !['تم اختيار فني','تم الانتهاء','ملغي','مؤرشف'].includes(clientTrackedOrder.status) ? <Button title="قبول العرض" onPress={() => acceptClientOffer(clientTrackedOrder, offer)} /> : null}</View>)}</View> : null}</View> : null}
      {clientTab === 'complaint' ? <View style={styles.dataCard}><Text style={styles.cardTitle}>تقديم شكوى للإدارة</Text><Text style={styles.detail}>استخدم كود الطلب والاسم المسجل، ولا تكتب أرقام تليفونات داخل تفاصيل الشكوى.</Text><Field label="كود الطلب" value={clientComplaint.sn} onChangeText={v => setClientComplaint(c => ({ ...c, sn: v.toUpperCase(), error: '' }))} placeholder="SN123456" autoCapitalize="characters"/><Field label="الاسم المسجل مع الطلب" value={clientComplaint.name} onChangeText={v => setClientComplaint(c => ({ ...c, name: v, error: '' }))} autoCapitalize="words"/><Field label="تفاصيل الشكوى (10 أحرف على الأقل)" value={clientComplaint.text} onChangeText={v => setClientComplaint(c => ({ ...c, text: v, error: '' }))} multiline/><Text style={styles.detail}>{clientComplaint.text.length}/1000</Text>{clientComplaint.error ? <Text style={styles.errorText}>{clientComplaint.error}</Text> : null}<Button title={clientComplaint.loading ? 'جاري الإرسال...' : 'إرسال الشكوى'} onPress={submitClientComplaint} disabled={clientComplaint.loading}/><View style={styles.offerCard}><Text style={styles.cardTitle}>متابعة شكوى سابقة</Text><Field label="كود الطلب" value={clientComplaintTrack.sn} onChangeText={v => setClientComplaintTrack(c => ({ ...c, sn: v.toUpperCase(), error: '', result: null }))} placeholder="SN123456" autoCapitalize="characters"/><Field label="الاسم المسجل" value={clientComplaintTrack.name} onChangeText={v => setClientComplaintTrack(c => ({ ...c, name: v, error: '', result: null }))} autoCapitalize="words"/><Button title={clientComplaintTrack.loading ? 'جاري البحث...' : 'متابعة الشكوى'} onPress={trackClientComplaints} disabled={clientComplaintTrack.loading}/>{clientComplaintTrack.error ? <Text style={styles.errorText}>{clientComplaintTrack.error}</Text> : null}{clientComplaintTrack.result ? <Text style={styles.detail}>{JSON.stringify(clientComplaintTrack.result)}</Text> : null}</View></View> : null}
      {notificationsOpen ? <View style={styles.notificationPopup}><View style={styles.headerRow}><Text style={styles.cardTitle}>الإشعارات {notifications.unread ? `(${notifications.unread} جديدة)` : ''}</Text><Button title="إغلاق" secondary onPress={()=>setNotificationsOpen(false)}/></View><Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} disabled={!notifications.unread}/>{notifications.loading?<ActivityIndicator color={COLORS.teal}/>:notifications.error?<Text style={styles.errorText}>{notifications.error}</Text>:notifications.items.length?notifications.items.map((item,i)=><TouchableOpacity key={String(item._id||item.id||i)} onPress={()=>markNotificationRead(item)} style={[styles.notificationRow, !(item.read||item.readAt) && styles.notificationUnread]}><Text style={styles.cardTitle}>{item.title||'إشعار من صُنّاع'}{!(item.read||item.readAt)?' • جديد':''}</Text><Text style={styles.detail}>{item.message||''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt)}</Text></TouchableOpacity>):<Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</View>:null}</ScrollView>
    <View pointerEvents="box-none" style={styles.floatingControls}><TouchableOpacity onPress={refreshVisibleData} style={styles.floatingButton}><Text style={styles.floatingIcon}>⟳</Text></TouchableOpacity><TouchableOpacity onPress={openWhatsAppSupport} style={[styles.floatingButton,styles.whatsappButton]}><Text style={styles.floatingWhatsApp}>🎧</Text></TouchableOpacity></View>
    {renderRatingModal('client')}
  </SafeAreaView>;

  if (screen === 'technician' && session?.role === 'fanni') {
    const user = techData.profile || session.user || {};
    const tab = techData.tab;
    const displayedOffers = techData.offers.filter(item => tab === 'completed' ? item.orderStatus === 'تم الانتهاء' : item.orderStatus !== 'تم الانتهاء');
    const tabs = [{ key: 'available', label: `الفرص (${techData.orders.length})` }, { key: 'offers', label: `عروضي (${techData.offers.filter(o => o.orderStatus !== 'تم الانتهاء').length})` }, { key: 'completed', label: `المكتملة (${techData.offers.filter(o => o.orderStatus === 'تم الانتهاء').length})` }, { key: 'wallet', label: 'المحفظة' }, { key: 'profile', label: 'حسابي' }, { key: 'notifications', label: `الإشعارات${notifications.unread ? ` (${notifications.unread})` : ''}` }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>صُنّاع — الفني</Text><Text style={styles.subtitle}>أهلًا {user.name || 'بك'} · {user.status || 'قيد المراجعة'}</Text></View><TouchableOpacity onPress={() => { setNotificationsOpen(v => !v); setReloadKey(v => v + 1); }} style={styles.bellButton}><Text style={styles.bellText}>🔔</Text>{notifications.unread > 0 ? <Text style={styles.bellBadge}>{notifications.unread}</Text> : null}</TouchableOpacity><Button title="خروج" secondary onPress={logout} /></View>
      {user.status === 'معتمد' && (!user.technicianGuidelinesAcceptedAt || user.technicianGuidelinesVersion !== '2026-10-20-v1') ? <View style={styles.dataCard}><Text style={styles.cardTitle}>ميثاق التعامل المهني مع العملاء</Text><Text style={styles.detail}>اقرأ التعليمات التالية ووافق عليها قبل استخدام لوحة الفني:</Text><Text style={styles.detail}>١. التزم بسعر العرض الذي وافق عليه العميل. أي زيادة تحتاج موافقة صريحة مسجلة داخل المنصة قبل التنفيذ.</Text><Text style={styles.detail}>٢. تعامل باحترام وصدق، دون ضغط أو تهديد أو تضليل.</Text><Text style={styles.detail}>٣. قبل قبول العرض، استخدم الردود المسموحة فقط: «نعم»، «لا»، «حسب الاتفاق». ممنوع تبادل بيانات الاتصال أو التحايل على المنصة قبل القبول.</Text><Text style={styles.detail}>٤. لا تضغط إنهاء المهمة إلا بعد إنجازها فعلًا.</Text><Text style={styles.detail}>٥. احمِ بيانات العميل ولا تستخدمها خارج الطلب.</Text><Text style={styles.detail}>٦. يحق للطرفين التقييم بعد الإكمال؛ ممنوع الإكراه على تقييم إيجابي أو التلاعب بالتقييمات.</Text><Text style={styles.detail}>٧. المخالفات قد تؤدي إلى مراجعة الطلب أو تعليق الحساب أو إيقافه.</Text><TouchableOpacity onPress={() => setGuidelinesChecked(value => !value)} style={styles.roleActions}><Text style={styles.detail}>{guidelinesChecked ? '☑' : '□'} قرأت التعليمات وأوافق على الالتزام بها.</Text></TouchableOpacity><Button title="موافق ثم تأكيد" onPress={() => guidelinesChecked ? acceptTechnicianGuidelines() : Alert.alert('الموافقة مطلوبة', 'لازم تقرأ الميثاق وتحدد الموافقة أولًا.')} /></View> : null}
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
          {tab === 'available' && <><View style={styles.dataCard}><Text style={styles.cardTitle}>البحث وتصفية فرص العمل</Text><Field label="ابحث بالخدمة أو المنطقة أو كود الطلب" value={technicianSearch} onChangeText={setTechnicianSearch} placeholder="مثال: سباكة أو مدينة نصر أو SN123456" /><Text style={styles.fieldLabel}>تصفية حسب الخدمة</Text><View style={styles.roleActions}><Button title="كل الخدمات" secondary={technicianServiceFilter !== 'الكل'} onPress={() => setTechnicianServiceFilter('الكل')} />{(user.specialties || []).map(service => <Button key={String(service)} title={String(service)} secondary={technicianServiceFilter !== service} onPress={() => setTechnicianServiceFilter(service)} />)}</View><Text style={styles.detail}>النتائج: {techData.orders.filter(item => { const query = technicianSearch.trim().toLocaleLowerCase(); const haystack = [item.service, item.specialty, item.area, item.sn, item.orderSn, item.description, item.desc].filter(Boolean).join(' ').toLocaleLowerCase(); return (!query || haystack.includes(query)) && (technicianServiceFilter === 'الكل' || String(item.service || item.specialty || '') === technicianServiceFilter || categories.some(category => category.label === technicianServiceFilter && Array.isArray(category.services) && category.services.includes(String(item.service || item.specialty || '')))); }).length} من {techData.orders.length}</Text></View><FlatList style={{ flex: 1 }} contentContainerStyle={styles.list} data={techData.orders.filter(item => { const query = technicianSearch.trim().toLocaleLowerCase(); const haystack = [item.service, item.specialty, item.area, item.sn, item.orderSn, item.description, item.desc].filter(Boolean).join(' ').toLocaleLowerCase(); return (!query || haystack.includes(query)) && (technicianServiceFilter === 'الكل' || String(item.service || item.specialty || '') === technicianServiceFilter || categories.some(category => category.label === technicianServiceFilter && Array.isArray(category.services) && category.services.includes(String(item.service || item.specialty || '')))); })} keyExtractor={(item, i) => String(item._id || item.sn || i)} ListEmptyComponent={<Text style={styles.emptyText}>{techData.orders.length ? 'مفيش فرص مطابقة للبحث أو التصفية.' : 'لا توجد فرص متاحة حاليًا أو الحساب لم يُعتمد بعد.'}</Text>} renderItem={({ item }) => {
             const sn = getOrderSN(item);
             const expanded = Boolean(expandedTechnicianOrders[sn]);
             return <View style={styles.dataCard}>
               <TouchableOpacity onPress={() => setExpandedTechnicianOrders(current => ({ ...current, [sn]: !current[sn] }))}>
                 <Text style={styles.cardTitle}>{item.service || 'طلب خدمة'} — {sn || '—'}</Text>
                 <Text style={styles.detail}>{item.status || 'متاح'} · {expanded ? 'اضغط لإخفاء التفاصيل' : 'اضغط لعرض التفاصيل'}</Text>
               </TouchableOpacity>
               {expanded ? <>
                 <Text style={styles.detail}>{item.area || ''}</Text>
                 <Text style={styles.detail}>{item.description || item.desc || 'لا توجد تفاصيل إضافية.'}</Text>
                 <Text style={styles.detail}>ميزانية العميل: {item.budget || 'غير محددة'}</Text>
                 <Button title="تقديم عرض" onPress={() => sendOffer(item)} />
               </> : null}
             </View>;
           }} /></>}
          {(tab === 'offers' || tab === 'completed') && <FlatList style={{ flex: 1 }} contentContainerStyle={styles.list} data={displayedOffers} keyExtractor={(item, i) => String(item._id || item.orderSn || i)} ListEmptyComponent={<Text style={styles.emptyText}>{tab === 'completed' ? 'لا توجد طلبات مكتملة في السجل حتى الآن.' : 'لسه ماقدمتش عروض نشطة.'}</Text>} renderItem={({ item }) => {
             const sn = getOrderSN(item);
             const expanded = Boolean(expandedTechnicianOrders[sn]);
             return <View style={styles.dataCard}>
               <TouchableOpacity onPress={() => setExpandedTechnicianOrders(current => ({ ...current, [sn]: !current[sn] }))}>
                 <Text style={styles.cardTitle}>{item.service || 'خدمة'} — {sn || '—'}</Text>
                 <Text style={styles.detail}>{item.orderStatus || 'حالة غير محددة'} · {expanded ? 'اضغط لإخفاء التفاصيل' : 'اضغط لعرض التفاصيل'}</Text>
               </TouchableOpacity>
               {expanded ? <>
                 <Text style={styles.detail}>السعر: {item.price || item.priceNum || '—'} جنيه</Text>
                 <Text style={styles.detail}>{item.message || ''}</Text>{item.client && ['تم اختيار فني','تم الانتهاء'].includes(item.orderStatus) ? <View style={styles.offerCard}><Text style={styles.cardTitle}>تفاصيل العميل والطلب</Text><Text style={styles.detail}>اسم العميل: {item.client.name || '—'}</Text><Text style={styles.detail}>المنطقة: {item.client.area || '—'}</Text><Text style={styles.detail}>العنوان بالتفصيل: {item.client.address || '—'}</Text><Text style={styles.detail}>تفاصيل المطلوب: {item.client.description || '—'}</Text><Text style={styles.detail}>ميزانية العميل: {item.client.budget || 'غير محددة'}</Text><Text style={styles.detail}>السعر المتفق عليه: {item.client.acceptedOfferPrice ?? item.price ?? '—'} جنيه</Text><Text style={styles.detail}>عمولة المنصة: {item.client.commissionAmount ?? '—'} جنيه</Text><Text style={styles.detail}>حالة العمولة: {item.client.commissionCharged ? 'تم الخصم' : 'لم يتم الخصم'}</Text>{item.client.phone && item.orderStatus === 'تم اختيار فني' ? <Button title={`اتصال بالعميل: ${item.client.phone}`} secondary onPress={() => Linking.openURL(`tel:${item.client.phone}`)} /> : null}</View> : null}<View style={styles.roleActions}><Button title={orderChats[getOrderSN(item)]?.open ? 'إخفاء المحادثة' : 'محادثة الطلب'} secondary onPress={() => toggleOrderChat(item, 'fanni')} />{item.orderStatus === 'تم اختيار فني' ? <Button title="إنهاء الخدمة" onPress={() => completeTechnicianOrder(item)} /> : null}</View>
          {orderChats[getOrderSN(item)]?.open ? <View style={styles.chatPanel}>{orderChats[getOrderSN(item)]?.loading ? <ActivityIndicator color={COLORS.teal}/> : <><ScrollView ref={chatScrollRef} style={{ maxHeight: 280 }} onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })} nestedScrollEnabled>{(orderChats[getOrderSN(item)]?.messages || []).map((message,j)=><View key={String(message._id||j)} style={[styles.chatMessage, message.senderRole === 'fanni' ? styles.chatMessageTechnician : styles.chatMessageClient]}><Text style={styles.detail}>{message.senderRole === 'fanni' ? 'أنت' : 'العميل'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}</ScrollView><Field label="رسالة للعميل" value={chatDrafts[getOrderSN(item)] || ''} onChangeText={value=>setChatDrafts(current=>({...current,[getOrderSN(item)]:value}))} multiline returnKeyType="send" blurOnSubmit onSubmitEditing={()=>sendOrderChat(item)} placeholder="اكتب رسالتك"/><Button title="إرسال الرسالة" onPress={()=>sendOrderChat(item)}/><Button title="تحديث المحادثة" secondary onPress={()=>refreshOrderChat(item,'fanni')}/></>}</View> : null}
          {item.orderStatus !== 'تم اختيار فني' && item.orderStatus !== 'تم الانتهاء' ? <View style={styles.roleActions}><Text style={styles.detail}>رد سريع على استفسار العميل:</Text>{['نعم','لا','حسب الاتفاق'].map(reply=><Button key={reply} title={reply} secondary onPress={()=>sendOrderChat(item,reply)}/>)}</View> : null}
          {item.orderStatus === 'تم اختيار فني' ? <View style={styles.offerCard}><Text style={styles.cardTitle}>طلب تعديل السعر</Text><Field label="السعر الجديد بالجنيه" value={priceDrafts[getOrderSN(item)]?.price || ''} onChangeText={value => setPriceDrafts(current => ({ ...current, [getOrderSN(item)]: { ...current[getOrderSN(item)], price: value } }))} keyboardType="numeric" /><Field label="سبب التعديل" value={priceDrafts[getOrderSN(item)]?.reason || ''} onChangeText={value => setPriceDrafts(current => ({ ...current, [getOrderSN(item)]: { ...current[getOrderSN(item)], reason: value } }))} multiline /><Button title="إرسال طلب تعديل السعر" onPress={() => requestOrderPriceChange(item)} /></View> : null}
          {item.orderStatus === 'تم الانتهاء' && !ratingDrafts[getOrderSN(item)]?.submitted && !ratingDrafts[getOrderSN(item)]?.skipped && !dismissedRatings[getOrderSN(item)] ? (
            <View style={styles.offerCard}>
              <Text style={styles.cardTitle}>تقييم العميل</Text>
              {renderRatingStars(item, Number(ratingDrafts[getOrderSN(item)]?.stars || 5))}
              <Field
                label="تعليق (اختياري)"
                value={ratingDrafts[getOrderSN(item)]?.comment || ''}
                onChangeText={value => setRatingDrafts(current => ({
                  ...current,
                  [getOrderSN(item)]: { ...current[getOrderSN(item)], comment: value },
                }))}
                multiline
              />
              {Number(ratingDrafts[getOrderSN(item)]?.stars || 5) === 1 ? <TouchableOpacity onPress={() => setRatingDrafts(current => ({ ...current, [getOrderSN(item)]: { ...current[getOrderSN(item)], blockFuture: !current[getOrderSN(item)]?.blockFuture } }))} style={styles.roleActions}><Text style={styles.detail}>{ratingDrafts[getOrderSN(item)]?.blockFuture ? '☑' : '□'} عدم إظهار طلبات العميل ده ليّ مرة تانية (اختياري)</Text></TouchableOpacity> : null}
              <Button title="حفظ تقييم العميل" onPress={() => submitOrderRating(item)} />
            </View>
          ) : null}
          {['تم اختيار فني','تم الانتهاء'].includes(item.orderStatus || item.status) && orderChats[getOrderSN(item)]?.open ? (
            <View style={styles.chatPanel}>
              {orderChats[getOrderSN(item)]?.loading ? <ActivityIndicator color={COLORS.teal} /> : (
                <View>
                  {orderChats[getOrderSN(item)]?.error ? <Text style={styles.errorText}>{orderChats[getOrderSN(item)].error}</Text> : null}
                  {(orderChats[getOrderSN(item)]?.messages || []).map((message, index) => (
                    <View key={String(message._id || index)} style={[styles.chatMessage, message.senderRole === 'client' ? styles.chatMessageClient : styles.chatMessageTechnician]}>
                      <Text style={styles.detail}>{message.senderRole === 'client' ? 'العميل' : 'الفني'} • {dateLabel(message.createdAt)}</Text>
                      <Text style={styles.chatMessageText}>{message.text}</Text>
                    </View>
                  ))}
                  {(orderChats[getOrderSN(item)]?.priceChangeRequests || []).filter(request => request.status === 'قيد الموافقة').map(request => (
                    <View key={String(request._id)} style={styles.priceRequest}>
                      <Text style={styles.cardTitle}>طلب تعديل السعر</Text>
                      <Text style={styles.detail}>من {request.oldPrice} إلى {request.newPrice} جنيه • {request.status}</Text>
                      <Text style={styles.detail}>{request.reason}</Text>
                    </View>
                  ))}
                  <Field label="ردك داخل المنصة" value={chatDrafts[getOrderSN(item)] || ''} onChangeText={value => setChatDrafts(current => ({ ...current, [getOrderSN(item)]: value }))} multiline returnKeyType="send" blurOnSubmit onSubmitEditing={() => sendOrderChat(item)} />
                  <View style={styles.roleActions}>
                    <Button title="إرسال الرسالة" onPress={() => sendOrderChat(item)} />
                    <Button title="تحديث المحادثة" secondary onPress={() => refreshOrderChat(item, 'fanni')} />
                  </View>
                </View>
              )}
            </View>
          ) : null}
          </> : null}</View>; }} />}
          {tab === 'wallet' && <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>المحفظة: {Number(user.walletBalance || user.balance || 0)} جنيه</Text><Text style={styles.detail}>التحويل على المحفظة فقط إلى الرقم التالي، ولا نقبل التحويل عبر إنستا باي.</Text><View style={styles.codeRow}><Text selectable style={styles.cardTitle}>01152822263</Text><Button title="نسخ الرقم" secondary onPress={()=>copyOrderCode('01152822263')}/></View><Field label="مبلغ الشحن بالجنيه" value={topup.amount} onChangeText={v => setTopup(t => ({ ...t, amount: v }))} keyboardType="numeric" /><Field label="رقم المحوّل" value={topup.fromPhone} onChangeText={v => setTopup(t => ({ ...t, fromPhone: v }))} keyboardType="phone-pad" /><Text style={styles.fieldLabel}>المحفظة التي حوّلت منها</Text><View style={styles.roleActions}>{[{value:'vodafone_cash',label:'فودافون كاش'},{value:'orange_cash',label:'أورنج كاش'},{value:'etisalat_cash',label:'اتصالات كاش'},{value:'we_pay',label:'وي باي'}].map(method=><Button key={method.value} title={method.label} secondary={topup.method!==method.value} onPress={()=>setTopup(t=>({...t,method:method.value}))}/>)}</View><Field label="رقم مرجع التحويل (اختياري)" value={topup.reference} onChangeText={v => setTopup(t => ({ ...t, reference: v }))} /><Button title="إرسال طلب شحن للمراجعة" onPress={submitTopup} /><Text style={styles.sectionTitle}>سجل المحفظة</Text>{techData.wallet.map((item, i) => <View key={String(item._id || i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.type || item.status || 'حركة محفظة'}</Text><Text style={styles.detail}>{item.amount || ''} جنيه • {dateLabel(item.createdAt || item.date)}</Text></View>)}</ScrollView>}
          {tab === 'profile' && <ScrollView contentContainerStyle={styles.page}><View style={styles.dataCard}><Text style={styles.cardTitle}>{user.name || 'الفني'}</Text><Text style={styles.detail}>الهاتف: {user.phone || ''}</Text><Text style={styles.detail}>الحالة: {user.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>المستوى المهني: {user.level || 'مبتدئ'}</Text><Text style={styles.detail}>الصفة الإدارية: {user.adminRole || 'فني'}</Text><Text style={styles.detail}>الشارات: {(user.badges || []).map(b => typeof b === 'string' ? b : b.label || b.name || '').filter(Boolean).join('، ') || 'لا توجد شارات حتى الآن'}</Text><Text style={styles.detail}>الخدمات: {(user.specialties || []).join('، ') || '—'}</Text><Text style={styles.detail}>المناطق: {(user.areas || []).join('، ') || '—'}</Text><Text style={styles.detail}>الرصيد: {Number(user.walletBalance || user.balance || 0)} جنيه</Text></View><View style={styles.roleActions}><Button title="تحديث بيانات الحساب" secondary onPress={() => setReloadKey(v => v + 1)} /><Button title="تغيير كلمة المرور" onPress={() => setScreen('account')} /></View></ScrollView>}
          {tab === 'notifications' && <ScrollView contentContainerStyle={styles.page}><View style={styles.headerRow}><Text style={styles.sectionTitle}>إشعارات الفني</Text><Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} disabled={!notifications.unread} /></View>{notifications.loading ? <ActivityIndicator color={COLORS.teal} /> : notifications.error ? <Text style={styles.errorText}>{notifications.error}</Text> : notifications.items.length ? notifications.items.map((item, i) => <TouchableOpacity key={String(item._id || item.id || i)} onPress={() => markNotificationRead(item)} style={[styles.dataCard, !(item.read || item.readAt) && styles.notificationUnread]}><Text style={styles.cardTitle}>{item.title || 'إشعار'}{!(item.read || item.readAt) ? ' • جديد' : ''}</Text><Text style={styles.detail}>{item.message || ''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt)}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</ScrollView>}
        </>}
      </View>
      {notificationsOpen ? <View style={styles.notificationPopup}><View style={styles.headerRow}><Text style={styles.cardTitle}>إشعارات الفني {notifications.unread ? `(${notifications.unread} جديدة)` : ''}</Text><Button title="إغلاق" secondary onPress={()=>setNotificationsOpen(false)}/></View><Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} disabled={!notifications.unread}/>{notifications.loading?<ActivityIndicator color={COLORS.teal}/>:notifications.error?<Text style={styles.errorText}>{notifications.error}</Text>:notifications.items.length?notifications.items.map((item,i)=><TouchableOpacity key={String(item._id||item.id||i)} onPress={()=>markNotificationRead(item)} style={[styles.notificationRow, !(item.read||item.readAt) && styles.notificationUnread]}><Text style={styles.cardTitle}>{item.title||'إشعار'}{!(item.read||item.readAt)?' • جديد':''}</Text><Text style={styles.detail}>{item.message||''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt)}</Text></TouchableOpacity>):<Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</View>:null}
      <View pointerEvents="box-none" style={styles.floatingControls}><TouchableOpacity onPress={refreshVisibleData} style={styles.floatingButton}><Text style={styles.floatingIcon}>⟳</Text></TouchableOpacity><TouchableOpacity onPress={openWhatsAppSupport} style={[styles.floatingButton,styles.whatsappButton]}><Text style={styles.floatingWhatsApp}>🎧</Text></TouchableOpacity></View>
      {renderRatingModal('fanni')}
    </SafeAreaView>;
  }

  if (screen === 'support' && session && ['client', 'fanni'].includes(session.role)) {
    const rolePath = session.role;
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <View style={styles.flex}><Text style={styles.title}>دعم صُنّاع</Text><Text style={styles.subtitle}>محادثة خاصة داخل التطبيق</Text></View>
        <Button title="رجوع" secondary onPress={() => { screenHistoryRef.current.pop(); const target = rolePath === 'client' ? 'client' : 'technician'; screenRef.current = target; setScreenState(target); setSupportCase(null); }} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>محادثة جديدة</Text>
          <Text style={styles.detail}>اكتب مشكلتك هنا. رقمك الشخصي لا يظهر في هذه المحادثة.</Text>
          <Field label="عنوان المشكلة (اختياري)" value={supportSubject} onChangeText={setSupportSubject} placeholder="مثال: مشكلة في الطلب" />
          {!supportCase ? <>
            <Field label="رسالتك" value={supportDraft} onChangeText={setSupportDraft} multiline placeholder="اشرح المشكلة أو الاستفسار..." />
            <Button title="إرسال وفتح محادثة الدعم" onPress={startSupportCase} disabled={supportLoading} />
          </> : null}
        </View>
        <Text style={styles.sectionTitle}>محادثاتي السابقة</Text>
        {supportLoading ? <ActivityIndicator color={COLORS.teal} /> : null}
        {supportError ? <Text style={styles.errorText}>{supportError}</Text> : null}
        {supportCases.map(item => <TouchableOpacity key={String(item._id)} onPress={() => openSupportCase(item)} style={[styles.dataCard, supportCase?._id === item._id && { borderColor: COLORS.teal }]}>
          <Text style={styles.cardTitle}>{item.subject || 'استفسار عام'}</Text>
          <Text style={styles.detail}>الحالة: {item.status || 'جديدة'}{item.needsHuman ? ' • تحتاج تدخل الدعم' : ''}</Text>
          <Text style={styles.detail}>{dateLabel(item.lastMessageAt || item.createdAt)}</Text>
        </TouchableOpacity>)}
        {supportCase ? <View style={styles.chatPanel}>
          <Text style={styles.sectionTitle}>{supportCase.subject || 'محادثة الدعم'}</Text>
          {(supportCase.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}>
            <Text style={styles.detail}>{message.senderRole === 'admin' ? 'دعم صُنّاع' : message.senderRole === 'assistant' ? 'المساعد' : 'أنت'} • {dateLabel(message.createdAt)}</Text>
            <Text style={styles.chatMessageText}>{message.text}</Text>
          </View>)}
          {['تم الحل', 'مغلقة'].includes(supportCase.status) ? <Text style={styles.detail}>تم إغلاق هذه الحالة. افتح محادثة جديدة إذا احتجت مساعدة أخرى.</Text> : <>
            <Field label="اكتب ردك" value={supportDraft} onChangeText={setSupportDraft} multiline placeholder="اكتب رسالتك للدعم..." />
            <View style={styles.roleActions}>
              <Button title="إرسال" onPress={() => sendSupportMessage(false)} disabled={supportLoading} />
              <Button title="طلب تدخل الدعم" secondary onPress={() => sendSupportMessage(true)} disabled={supportLoading} />
            </View>
          </>}
        </View> : null}
        <Button title="تحديث المحادثات" secondary onPress={loadSupportCases} disabled={supportLoading} />
      </ScrollView>
    </SafeAreaView>;
  }

  if (screen === 'admin' && session?.role === 'admin') {
    const tab = adminData.tab;
    const items = tab === 'levels' || tab === 'roles' ? adminData.fannis : adminData[tab] || [];
    const tabs = [{ key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' }, { key: 'clients', label: 'العملاء' }, { key: 'topups', label: 'طلبات الشحن' }, { key: 'complaints', label: 'الشكاوى' }, { key: 'support', label: 'الدعم' }, { key: 'levels', label: 'المستوى المهني' }, ...(session.user?.role === 'admin' ? [{ key: 'services', label: 'الخدمات' }, { key: 'pricing', label: 'الأسعار' }, { key: 'wallets', label: 'محافظ الفنيين' }, { key: 'regions', label: 'المناطق' }, { key: 'content', label: 'محتوى المنصة' }, { key: 'settings', label: 'الإعدادات' }, { key: 'reports', label: 'التقارير' }, { key: 'audit', label: 'سجل التدقيق' }, { key: 'roles', label: 'المناصب الإدارية' }, { key: 'notifications', label: 'إرسال إشعار' }] : [])];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitle}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View><Button title="حسابي" secondary onPress={() => setScreen('account')} /><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRow}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => { setAdminData(v => ({ ...v, tab: item.key })); if (item.key === 'support') loadAdminSupportCases(); }} style={[styles.pill, tab === item.key && styles.pillActive]}><Text style={[styles.pillText, tab === item.key && styles.pillTextActive]}>{item.label}{['orders','fannis','clients','topups','complaints'].includes(item.key) ? ` (${(adminData[item.key] || []).length})` : item.key === 'support' ? ` (${adminSupportCases.length})` : ''}</Text></TouchableOpacity>)}</View>
      {adminData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الإدارة...</Text></View> : <View style={{ flex: 1 }}>
        {adminData.error ? <Text style={styles.errorText}>{adminData.error}</Text> : null}
        {tab === 'wallets' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>إدارة محافظ الفنيين</Text><Text style={styles.detail}>اختر فنيًا لعرض الحركات المالية، أو تجميد المحفظة، أو تسجيل تسوية موثقة.</Text>
          {adminData.fannis.map((fanni,i)=><TouchableOpacity key={String(fanni._id||fanni.id||i)} onPress={()=>setAdminWallet(c=>({...c,fanniId:String(fanni._id||fanni.id),amount:String(fanni.walletBalance??fanni.balance??''),transactions:[]}))} style={[styles.dataCard,String(fanni._id||fanni.id)===adminWallet.fanniId&&{borderColor:COLORS.teal}]}><Text style={styles.cardTitle}>{fanni.name||'فني'} — {fanni.phone||''}</Text><Text style={styles.detail}>الرصيد: {Number(fanni.walletBalance??fanni.balance??0)} جنيه • المحفظة {fanni.isFrozen?'مجمّدة':'نشطة'}</Text></TouchableOpacity>)}
          {adminWallet.fanniId ? <View style={styles.dataCard}><Text style={styles.sectionTitle}>إجراءات المحفظة</Text><Field label="الرصيد الجديد بعد التسوية (جنيه)" value={adminWallet.amount} onChangeText={v=>setAdminWallet(c=>({...c,amount:v}))} keyboardType="numeric" /><Field label="سبب الإجراء (مطلوب)" value={adminWallet.reason} onChangeText={v=>setAdminWallet(c=>({...c,reason:v}))} multiline />
            <View style={styles.roleActions}><Button title="تسوية الرصيد" onPress={()=>adminWalletAction('balance')} /><Button title="تجميد المحفظة" secondary onPress={()=>adminWalletAction('freeze')} /><Button title="إلغاء التجميد" secondary onPress={()=>adminWalletAction('unfreeze')} /></View>
            <Button title={adminWallet.loading?'جاري التحميل...':'عرض كشف الحركات المالية'} secondary onPress={adminLoadWalletTransactions} disabled={adminWallet.loading}/>
            {adminWallet.loading?<ActivityIndicator color={COLORS.teal}/>:adminWallet.transactions.length?adminWallet.transactions.map((item,i)=><View key={String(item._id||item.id||i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.type||item.action||item.status||'حركة مالية'} • {Number(item.amount||0)} جنيه</Text><Text style={styles.detail}>{item.reason||item.description||''}</Text><Text style={styles.detail}>{dateLabel(item.createdAt||item.date)}</Text></View>):<Text style={styles.emptyText}>حمّل كشف الحساب لعرض الحركات.</Text>}
          </View> : null}
        </ScrollView> : tab === 'services' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>إدارة الخدمات والأقسام</Text><Text style={styles.detail}>هذه القائمة متصلة مباشرة بقائمة الخدمات الموجودة على الخادم.</Text>
          <Field label="اسم الخدمة الجديدة" value={adminServiceDraft.name} onChangeText={v => setAdminServiceDraft(c => ({ ...c, name: v }))} />
          <Field label="اسم القسم" value={adminServiceDraft.category} onChangeText={v => setAdminServiceDraft(c => ({ ...c, category: v }))} />
          <Field label="رمز الخدمة" value={adminServiceDraft.emoji} onChangeText={v => setAdminServiceDraft(c => ({ ...c, emoji: v }))} />
          <Button title="إضافة الخدمة" onPress={adminAddService} />
          {adminExtras.services.map((category, index) => <View key={String(category.label || category.name || index)} style={styles.dataCard}><View style={styles.headerRow}><Text style={styles.cardTitle}>{category.emoji || '🔧'} {category.label || category.name}</Text><View style={styles.roleActions}><Button title="↑ قسم" secondary onPress={() => adminMoveCategory(index, -1)} disabled={index===0}/><Button title="↓ قسم" secondary onPress={() => adminMoveCategory(index, 1)} disabled={index===adminExtras.services.length-1}/></View></View><Text style={styles.detail}>الخدمات: {(category.services || []).length} • النشطة: {category.activeCount ?? '—'}</Text>{adminServiceEdit.category === (category.label || category.name) && (category._detailed || []).some(item => item.name === adminServiceEdit.oldName) ? <View style={styles.dataCard}><Text style={styles.cardTitle}>تعديل: {adminServiceEdit.oldName}</Text><Field label="الاسم الجديد" value={adminServiceEdit.name} onChangeText={v => setAdminServiceEdit(c => ({ ...c, name: v }))} /><View style={styles.roleActions}><Button title="حفظ الاسم" onPress={adminSaveServiceEdit} /><Button title="إلغاء" secondary onPress={() => setAdminServiceEdit({ category: '', oldName: '', name: '' })} /></View></View> : null}{(category._detailed || (category.services || []).map(name => ({name}))).map((item, i, arr) => <View key={String(item._id || item.name || i)} style={styles.dataCard}><Text style={styles.detail}>{item.name} {item.isActive === false ? '• مخفية' : ''}</Text><View style={styles.roleActions}><Button title="↑" secondary onPress={() => adminMoveService(category.label || category.name, item.name, -1)} disabled={i===0}/><Button title="↓" secondary onPress={() => adminMoveService(category.label || category.name, item.name, 1)} disabled={i===arr.length-1}/><Button title="تعديل" secondary onPress={() => adminBeginServiceEdit(category.label || category.name, item.name)} /><Button title={item.isActive === false ? 'إظهار' : 'إخفاء'} secondary onPress={() => adminToggleService(category.label || category.name, item.name, item.isActive === false)} /><Button title="حذف" secondary onPress={() => adminDeleteService(category.label || category.name, item.name)} /></View></View>)}</View>)}
          <Button title="تحديث قائمة الخدمات" secondary onPress={() => setReloadKey(v => v + 1)} />
        </ScrollView> : tab === 'pricing' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>الأسعار والعمولات</Text>
          <Field label="رسوم الفرصة / الكشف (جنيه)" value={String(adminExtras.pricing.check)} onChangeText={v => setAdminExtras(c => ({ ...c, pricing: { ...c.pricing, check: v === '' ? '' : Number(v) } }))} keyboardType="numeric" />
          <Field label="العمولة (%)" value={String(adminExtras.pricing.commission)} onChangeText={v => setAdminExtras(c => ({ ...c, pricing: { ...c.pricing, commission: v === '' ? '' : Number(v) } }))} keyboardType="numeric" />
          <Field label="أقل عرض (جنيه)" value={String(adminExtras.pricing.minOffer)} onChangeText={v => setAdminExtras(c => ({ ...c, pricing: { ...c.pricing, minOffer: v === '' ? '' : Number(v) } }))} keyboardType="numeric" />
          <Field label="أعلى عرض (جنيه)" value={String(adminExtras.pricing.maxOffer)} onChangeText={v => setAdminExtras(c => ({ ...c, pricing: { ...c.pricing, maxOffer: v === '' ? '' : Number(v) } }))} keyboardType="numeric" />
          <Button title="حفظ الأسعار والعمولات" onPress={adminSavePricing} />
          <Text style={styles.sectionTitle}>آخر تغييرات الأسعار</Text>{adminExtras.pricingHistory.slice(0,20).map((item,i)=><View key={String(item._id||i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.reason || item.key || 'تغيير أسعار'}</Text><Text style={styles.detail}>{item.by || 'الإدارة'} • {dateLabel(item.createdAt)}</Text></View>)}
        </ScrollView> : tab === 'regions' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>إدارة المناطق</Text><Field label="اسم المنطقة الجديدة" value={adminRegionDraft} onChangeText={setAdminRegionDraft} /><Button title="إضافة المنطقة" onPress={adminAddRegion} />
          {adminExtras.regions.map((region,i)=><View key={String(region._id||region.name||i)} style={styles.dataCard}><Text style={styles.cardTitle}>{region.name}</Text><Text style={styles.detail}>{region.isActive === false ? 'غير نشطة' : 'نشطة'} • {dateLabel(region.createdAt)}</Text></View>)}
        </ScrollView> : tab === 'content' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>محتوى المنصة والإعلان</Text><Field label="الإعلان الظاهر للعملاء والفنيين" value={adminAnnouncementDraft} onChangeText={setAdminAnnouncementDraft} multiline /><Text style={styles.detail}>{adminAnnouncementDraft.length}/1000</Text>
          <Text style={styles.sectionTitle}>إضافة سؤال شائع</Text><Field label="السؤال" value={adminFaqDraft.question} onChangeText={v => setAdminFaqDraft(c => ({ ...c, question: v }))} /><Field label="الإجابة" value={adminFaqDraft.answer} onChangeText={v => setAdminFaqDraft(c => ({ ...c, answer: v }))} multiline /><Button title="إضافة السؤال للقائمة" onPress={adminAddFaqDraft} />
          {adminExtras.content.faqs.map((faq,i)=><View key={String(i)} style={styles.dataCard}><Text style={styles.cardTitle}>{faq.question}</Text><Text style={styles.detail}>{faq.answer}</Text><Button title="حذف السؤال من القائمة" secondary onPress={()=>setAdminExtras(c=>({...c,content:{...c.content,faqs:c.content.faqs.filter((_,j)=>j!==i)}}))}/></View>)}
          <Button title="حفظ محتوى المنصة" onPress={adminSaveContent} />
        </ScrollView> : tab === 'settings' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>إعدادات النظام</Text><Field label="اسم المنصة" value={adminExtras.settings.siteName} onChangeText={v=>setAdminExtras(c=>({...c,settings:{...c.settings,siteName:v}}))} />
          <View style={styles.dataCard}><Text style={styles.cardTitle}>وضع الصيانة</Text><Text style={styles.detail}>{adminExtras.settings.maintenance ? 'مفعل' : 'غير مفعل'}</Text><View style={styles.roleActions}><Button title="تفعيل" secondary={!adminExtras.settings.maintenance} onPress={()=>setAdminExtras(c=>({...c,settings:{...c.settings,maintenance:true}}))}/><Button title="إيقاف" secondary={adminExtras.settings.maintenance} onPress={()=>setAdminExtras(c=>({...c,settings:{...c.settings,maintenance:false}}))}/></View></View>
          <Field label="رسالة الصيانة" value={adminExtras.settings.maintenanceMessage} onChangeText={v=>setAdminExtras(c=>({...c,settings:{...c.settings,maintenanceMessage:v}}))} multiline />
          <Field label="حد محاولات تسجيل الفني لكل IP" value={String(adminExtras.settings.maxFanniSignupAttempts)} onChangeText={v=>setAdminExtras(c=>({...c,settings:{...c.settings,maxFanniSignupAttempts:Number(v)}}))} keyboardType="numeric" />
          <Button title="حفظ الإعدادات" onPress={adminSaveSettings} />
        </ScrollView> : tab === 'reports' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>تقارير الإدارة</Text><Text style={styles.detail}>التواريخ بصيغة YYYY-MM-DD. اترك الحقول فارغة لإحصاء كل الفترات.</Text>
          <Field label="من تاريخ (YYYY-MM-DD)" value={adminReportFilters.startDate} onChangeText={v=>setAdminReportFilters(c=>({...c,startDate:v}))} />
          <Field label="إلى تاريخ (YYYY-MM-DD)" value={adminReportFilters.endDate} onChangeText={v=>setAdminReportFilters(c=>({...c,endDate:v}))} />
          <Field label="تصفية حسب الخدمة (اختياري)" value={adminReportFilters.service} onChangeText={v=>setAdminReportFilters(c=>({...c,service:v}))} />
          <Field label="تصفية حسب المنطقة (اختياري)" value={adminReportFilters.area} onChangeText={v=>setAdminReportFilters(c=>({...c,area:v}))} />
          <Button title="إنشاء التقرير" onPress={adminGenerateReport} />
          {adminExtras.report?.summary ? <View style={styles.dataCard}><Text style={styles.cardTitle}>ملخص التقرير</Text>{[['إجمالي الطلبات',adminExtras.report.summary.totalOrders],['طلبات مكتملة',adminExtras.report.summary.completedOrders],['طلبات ملغاة',adminExtras.report.summary.cancelledOrders],['قيد المراجعة',adminExtras.report.summary.pendingOrders],['تستقبل عروضًا',adminExtras.report.summary.publishedOrders],['الفنيون المعتمدون',adminExtras.report.summary.approvedTechnicians],['العملاء النشطون',adminExtras.report.summary.activeClients]].map(([label,value])=><Text key={label} style={styles.detail}>{label}: {Number(value||0)}</Text>)}<Text style={styles.sectionTitle}>أكثر الخدمات طلبًا</Text>{(adminExtras.report.topServices||[]).map((item,i)=><Text key={String(i)} style={styles.detail}>{item.service}: {item.count}</Text>)}</View> : <Text style={styles.emptyText}>أنشئ تقريرًا لعرض الإحصائيات.</Text>}
        </ScrollView> : tab === 'audit' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>سجل التدقيق الإداري</Text><Button title="تحديث السجل" secondary onPress={adminLoadAuditLogs} />{adminExtras.auditLogs.map((item,i)=><View key={String(item._id||i)} style={styles.dataCard}><Text style={styles.cardTitle}>{item.action || item.event || 'إجراء إداري'}</Text><Text style={styles.detail}>{item.adminName || item.by || item.actorName || 'الإدارة'} • {dateLabel(item.createdAt)}</Text><Text style={styles.detail}>{item.targetType || item.entityType || ''} {item.targetId || item.entityId || ''}</Text><Text style={styles.detail}>{item.reason || item.details || item.summary || ''}</Text></View>)}
        </ScrollView> : tab === 'topups' ? <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد طلبات شحن.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>{item.amount || 0} جنيه — {item.actualStatus || item.status || 'قيد المراجعة'}</Text><Text style={styles.detail}>هاتف المحوّل: {item.fromPhone || '—'}</Text><Text style={styles.detail}>رقم المرجع: {item.referenceNumber || item.reference || '—'}</Text><Text style={styles.detail}>تاريخ الطلب: {dateLabel(item.createdAt)}</Text>{(item.status === 'pending' || item.actualStatus === 'قيد المراجعة') ? <View style={styles.roleActions}><Button title="اعتماد وإضافة الرصيد" onPress={() => reviewTopup(item, 'approve')} /><Button title="رفض" secondary onPress={() => reviewTopup(item, 'reject')} /></View> : <Text style={styles.detail}>تمت مراجعة الطلب.</Text>}</View>} /> : tab === 'complaints' ? <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || i)} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد شكاوى.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitle}>شكوى الطلب {item.sn || '—'}</Text><Text style={styles.detail}>الحالة: {item.status || 'جديدة'} • {item.type || item.category || 'شكوى'}</Text><Text style={styles.detail}>{item.message || item.text || item.description || 'لا يوجد نص للشكوى'}</Text><View style={styles.roleActions}><Button title="قيد المراجعة" secondary onPress={() => setComplaintStatus(item, 'قيد المراجعة')} /><Button title="تم الحل" onPress={() => setComplaintStatus(item, 'تم الحل')} /><Button title="مرفوضة" secondary onPress={() => setComplaintStatus(item, 'مرفوضة')} /></View></View>} /> : tab === 'support' ? <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>حالات دعم صُنّاع</Text>
          <Text style={styles.detail}>الحالات التي تحتاج تدخلًا بشريًا تظهر أولًا. افتح الحالة لقراءة الرسائل والرد من داخل التطبيق.</Text>
          <Text style={styles.sectionTitle}>طلبات استعادة كلمة المرور</Text>
          {adminRecoveryCases.map(item => <TouchableOpacity key={String(item.id || item._id)} onPress={() => openAdminRecovery(item)} style={[styles.dataCard, adminRecoverySelected && String(adminRecoverySelected.id || adminRecoverySelected._id) === String(item.id || item._id) && { borderColor: COLORS.teal }]}><Text style={styles.cardTitle}>{item.accountName || 'حساب'} — {item.phone || ''}</Text><Text style={styles.detail}>{item.ownerRole === 'client' ? 'عميل' : item.ownerRole === 'admin' ? 'إدارة' : 'فني'} • {item.status || 'بانتظار الدعم'}</Text><Text style={styles.detail}>{dateLabel(item.lastMessageAt || item.createdAt)}</Text></TouchableOpacity>)}
          {adminRecoverySelected ? <View style={styles.chatPanel}><Text style={styles.cardTitle}>محادثة استعادة كلمة المرور</Text>{(adminRecoverySelected.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}><Text style={styles.detail}>{message.senderRole === 'admin' ? 'الدعم' : 'المستخدم'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}<Text style={styles.detail}>تحقق من ملكية الحساب قبل إصدار الرمز.</Text><Button title="تأكيد التحقق وإصدار رمز" onPress={issueAdminRecoveryCode} />{adminRecoveryCode ? <View style={styles.dataCard}><Text style={styles.cardTitle}>رمز مؤقت — صالح 10 دقائق</Text><Text selectable style={styles.title}>{adminRecoveryCode}</Text><Button title="تجهيز إرسال الرمز في المحادثة" onPress={() => setAdminRecoveryDraft('رمز استعادة كلمة المرور: ' + adminRecoveryCode + ' — صالح لمدة 10 دقائق.')} /></View> : null}<Field label="رسالة الدعم" value={adminRecoveryDraft} onChangeText={setAdminRecoveryDraft} multiline placeholder="اكتب الرد أو جهز إرسال الرمز أعلاه..." /><View style={styles.roleActions}><Button title="إرسال الرد" onPress={replyAdminRecovery} /><Button title="تحديث الطلبات" secondary onPress={loadAdminRecoveryCases} /></View></View> : null}
          {adminSupportCases.map(item => <TouchableOpacity key={String(item._id)} onPress={() => setAdminSupportSelected(item)} style={[styles.dataCard, adminSupportSelected?._id === item._id && { borderColor: COLORS.teal }]}>
            <Text style={styles.cardTitle}>{item.subject || 'استفسار عام'} — {item.ownerName || (item.ownerRole === 'fanni' ? 'فني' : 'عميل')}</Text>
            <Text style={styles.detail}>الحالة: {item.status || 'جديدة'} • {item.ownerRole === 'fanni' ? 'فني' : 'عميل'}{item.needsHuman ? ' • يحتاج تدخلًا' : ''}</Text>
            <Text style={styles.detail}>{dateLabel(item.lastMessageAt || item.createdAt)}</Text>
          </TouchableOpacity>)}
          {adminSupportSelected ? <View style={styles.chatPanel}>
            <Text style={styles.cardTitle}>{adminSupportSelected.subject || 'محادثة الدعم'}</Text>
            {(adminSupportSelected.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}>
              <Text style={styles.detail}>{message.senderRole === 'admin' ? 'الإدارة' : message.senderRole === 'assistant' ? 'المساعد' : message.senderRole === 'fanni' ? 'الفني' : 'العميل'} • {dateLabel(message.createdAt)}</Text>
              <Text style={styles.chatMessageText}>{message.text}</Text>
            </View>)}
            {!['تم الحل','مغلقة'].includes(adminSupportSelected.status) ? <>
              <Field label="رد الإدارة" value={adminSupportDraft} onChangeText={setAdminSupportDraft} multiline placeholder="اكتب ردك هنا..." />
              <View style={styles.roleActions}><Button title="إرسال الرد" onPress={() => replyAdminSupport(adminSupportSelected)} /><Button title="تحديث القائمة" secondary onPress={loadAdminSupportCases} /></View>
            </> : <Text style={styles.detail}>الحالة مغلقة.</Text>}
          </View> : null}
          <Button title="تحديث حالات الدعم" secondary onPress={loadAdminSupportCases} />
        </ScrollView> : tab === 'notifications' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>إرسال إشعار داخل التطبيق</Text><Text style={styles.detail}>الإشعار يظهر للحسابات المستهدفة داخل تطبيق صُنّاع.</Text><Field label="عنوان الإشعار" value={broadcast.title} onChangeText={value => setBroadcast(current => ({ ...current, title: value }))} placeholder="مثال: تحديث مهم" /><Field label="نص الإشعار" value={broadcast.message} onChangeText={value => setBroadcast(current => ({ ...current, message: value }))} multiline placeholder="اكتب الرسالة هنا" /><Text style={styles.fieldLabel}>المستلمون</Text><View style={styles.roleActions}>{[{key:'all',label:'الجميع'},{key:'clients',label:'العملاء'},{key:'fannis',label:'الفنيون'},{key:'cairo_fannis',label:'فنيّو القاهرة'}].map(option => <Button key={option.key} title={option.label} secondary={broadcast.audience !== option.key} onPress={() => setBroadcast(current => ({ ...current, audience: option.key }))} />)}</View><Button title="إرسال الإشعار" onPress={sendAdminBroadcast} /></ScrollView> : tab === 'roles' && session.user?.role === 'admin' ? <ScrollView contentContainerStyle={styles.page}>
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
          return <View style={styles.dataCard}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.detail}>{detail || 'لا توجد تفاصيل إضافية'}</Text>{tab === 'orders' && session.user?.role === 'admin' && item.status === 'قيد المراجعة' ? <Button title="نشر الطلب للفنيين" onPress={() => publishOrder(item)} /> : null}{tab === 'orders' && session.user?.role === 'admin' && !['تم الانتهاء','منتهي','تم اختيار فني','مؤرشف','ملغي'].includes(item.status) ? <Button title="إلغاء الطلب" secondary onPress={() => adminOrderAction(item, 'cancel')} /> : null}{tab === 'orders' && session.user?.role === 'admin' && !['قيد المراجعة','تم النشر','وصلتك عروض','تم اختيار فني','مؤرشف'].includes(item.status) ? <Button title="أرشفة الطلب" secondary onPress={() => adminOrderAction(item, 'archive')} /> : null}{tab === 'fannis' && !item.isApproved && !item.isDisabled ? <View style={styles.roleActions}><Button title="اعتماد الفني" onPress={() => moderateTechnician(item, 'approve')} /><Button title="رفض" secondary onPress={() => moderateTechnician(item, 'reject')} /></View> : tab === 'fannis' && item.isApproved ? <Button title="تعليق الفني" secondary onPress={() => moderateTechnician(item, 'disable')} /> : tab === 'fannis' && item.isDisabled ? <Button title="إعادة تفعيل الفني" onPress={() => moderateTechnician(item, 'enable')} /> : null}{tab === 'fannis' && session.user?.role === 'admin' ? <View style={styles.dataCard}><Text style={styles.detail}>تعيين المستوى المهني</Text><View style={styles.roleActions}>{['مبتدئ','ممارس','محترف','خبير'].map(level => <Button key={level} title={level} secondary onPress={() => adminSetTechnicianLevel(item, level)} />)}</View></View> : null}{tab === 'clients' && session.user?.role === 'admin' ? <View style={styles.roleActions}><Button title="تعليق العميل" secondary onPress={() => adminClientAction(item.phone, 'block')} /><Button title="إعادة التفعيل" onPress={() => adminClientAction(item.phone, 'unblock')} /><Button title="حذف الحساب" secondary onPress={() => adminClientAction(item.phone, 'account')} /></View> : null}</View>;
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
        <Text style={styles.homeTagline}>صُنّاع.. بنوصّل الخدمة بالفرصة</Text>
        <Text style={styles.homeIntro}>مكان يجمع احتياجات العملاء بمهارات الفنيين.</Text>
      </View>
      <View style={styles.roleCards}>
        <TouchableOpacity accessibilityRole="button" onPress={() => goLogin('client')} style={styles.roleCard}>
          <View style={styles.clientIconCircle}><Text style={styles.roleIcon}>👤</Text></View>
          <View style={styles.roleCardCopy}>
            <Text style={styles.roleTitle}>الدخول كعميل</Text>
            <Text style={styles.roleDescription}>اطلب الخدمة اللي محتاجها وتابع طلبك بسهولة.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => goLogin('fanni')} style={styles.roleCard}>
          <View style={styles.technicianIconCircle}><Text style={styles.roleIcon}>🛠️</Text></View>
          <View style={styles.roleCardCopy}>
            <Text style={styles.roleTitle}>الدخول كفني</Text>
            <Text style={styles.roleDescription}>تابع فرص الشغل وطلبات الخدمات من حسابك.</Text>
          </View>
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
  roleCardCopy: { flex: 1, gap: 3, justifyContent: 'center' },
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
  notificationUnread: { backgroundColor: '#FFF7D6', borderColor: '#F5B928', borderWidth: 1 },
  homeSummary: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDFA', borderRadius: 12, padding: 12 },
  bellButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF4C2', borderWidth: 1, borderColor: '#F5B928', alignItems: 'center', justifyContent: 'center' },
  bellText: { fontSize: 21 },
  bellBadge: { position: 'absolute', top: -5, right: -5, minWidth: 17, textAlign: 'center', borderRadius: 9, overflow: 'hidden', color: '#FFFFFF', backgroundColor: '#B91C1C', fontSize: 10, fontWeight: '900', paddingHorizontal: 3 },
  notificationPopup: { position: 'absolute', zIndex: 20, top: 70, left: 12, right: 12, maxHeight: '65%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F5B928', borderRadius: 18, padding: 12, elevation: 14 },
  floatingControls: { position: 'absolute', left: 14, right: 14, bottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floatingButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: COLORS.navy, shadowOpacity: 0.25, shadowRadius: 8 },
  floatingIcon: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  whatsappButton: { backgroundColor: '#16A34A' },
  floatingWhatsApp: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  codeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  roleActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start', gap: 7, marginTop: 8 },
  chatPanel: { backgroundColor: '#F3F7FD', borderWidth: 1, borderColor: '#D8E4F3', borderRadius: 18, padding: 12, marginTop: 11, shadowColor: COLORS.navy, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  chatMessage: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 8, marginVertical: 4 },
  chatMessageClient: { backgroundColor: '#E8F1FF', borderColor: '#93C5FD', alignSelf: 'flex-start', maxWidth: '92%' },
  chatMessageTechnician: { backgroundColor: '#E6FFFB', borderColor: '#5EEAD4', alignSelf: 'flex-end', maxWidth: '92%' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 15, 35, 0.62)', justifyContent: 'center', padding: 20 },
  ratingModal: { alignSelf: 'center', width: '100%', maxWidth: 360, backgroundColor: COLORS.white, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.gold, maxHeight: '82%' },
  ratingStarsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginVertical: 8 },
  ratingStarButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  ratingStar: { fontSize: 27, color: '#CBD5E1' },
  ratingStarActive: { color: COLORS.gold },
  dropdownButton: { minHeight: 50, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginVertical: 5 },
  dropdownButtonText: { color: COLORS.text, textAlign: 'right', fontSize: 15, fontWeight: '700', flex: 1 },
  dropdownArrow: { color: COLORS.navy, fontSize: 14, marginLeft: 10 },
  dropdownOptions: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  dropdownOption: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownOptionText: { color: COLORS.text, textAlign: 'right', fontSize: 14 },
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
