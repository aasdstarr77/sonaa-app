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
const COLORS = { navy: '#0F172A', navy2: '#1E3A5F', blue: '#2563EB', gold: '#F59E0B', teal: '#0D9488', tealLight: '#CCFBF1', bg: '#F8FAFC', bgSoft: '#F1F5F9', text: '#0F172A', muted: '#64748B', border: '#E2E8F0', white: '#FFFFFF', red: '#DC2626' };

async function api(path, options = {}) {
  const { token, body, headers, signal: externalSignal, timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (timedOut) throw new Error('الخادم لم يستجب خلال 30 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.');
    if (error?.name === 'AbortError') throw new Error('تم إلغاء الطلب قبل اكتماله.');
    throw new Error('تعذر الاتصال بالإنترنت أو بالخادم. تأكد من الاتصال ثم أعد المحاولة.');
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromCaller);
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
  return <TouchableOpacity disabled={disabled} onPress={onPress} activeOpacity={0.85} style={[styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary, disabled && styles.disabledButton]}>
    <Text style={[styles.buttonText, secondary ? styles.buttonSecondaryText : styles.buttonPrimaryText]}>{title}</Text>
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
  const [assignedDetails, setAssignedDetails] = useState({});
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
  const ratingHandledRef = useRef(new Set());
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
  const ratingStorageKey = `sonaa.rating.dismissed.v3:${session?.role || 'guest'}:${ratingAccountId}`;
  const previousRatingStorageKey = `sonaa.rating.dismissed.v3:${session?.role || 'guest'}`;
  const legacyRatingStorageKey = `sonaa.rating.dismissed.v1:${session?.role || 'guest'}:${session?.user?._id || session?.user?.id || session?.user?.phone || 'account'}`;
  const oldestRatingStorageKey = `sonaa.rating.dismissed.v2:${session?.role || 'guest'}:${ratingAccountId}`;

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
        const [currentRaw, previousRaw, oldestRaw, legacyRaw] = await Promise.all([
          SecureStore.getItemAsync(ratingStorageKey),
          previousRatingStorageKey === ratingStorageKey ? Promise.resolve(null) : SecureStore.getItemAsync(previousRatingStorageKey),
          oldestRatingStorageKey === ratingStorageKey || oldestRatingStorageKey === previousRatingStorageKey ? Promise.resolve(null) : SecureStore.getItemAsync(oldestRatingStorageKey),
          legacyRatingStorageKey === ratingStorageKey || legacyRatingStorageKey === previousRatingStorageKey || legacyRatingStorageKey === oldestRatingStorageKey ? Promise.resolve(null) : SecureStore.getItemAsync(legacyRatingStorageKey),
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
        const oldest = parseDismissals(oldestRaw);
        const legacy = parseDismissals(legacyRaw);
        const saved = { ...legacy, ...oldest, ...previous, ...current };
        dismissedRatingsRef.current = saved;
        setDismissedRatings(saved);
        if (Object.keys(saved).length) {
          const serialized = JSON.stringify(saved);
          await Promise.all([
            SecureStore.setItemAsync(ratingStorageKey, serialized),
            SecureStore.setItemAsync(oldestRatingStorageKey, serialized),
            SecureStore.setItemAsync(legacyRatingStorageKey, serialized),
          ]);
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
              restoreTimer = setTimeout(
                () => reject(new Error('انتهت مهلة الاتصال أثناء استعادة الحساب.')),
                15000
              );
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
      if (offerDraft) {
        setOfferDraft(null);
        return true;
      }
      if (notificationsOpen) {
        setNotificationsOpen(false);
        return true;
      }
      let previous = screenHistoryRef.current.pop();
      if (screen === 'home') return false;
      while (previous && ['home', 'login', 'clientRegister', 'technicianRegister'].includes(previous) && session) {
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
        const serviceResult = await api('/services');
        if (!Array.isArray(serviceResult.categories)) throw new Error('قائمة الخدمات من الخادم غير صحيحة');
        if (!mounted) return;
        setCategories(serviceResult.categories);
        setSelected(current => current && serviceResult.categories.some(item => item.label === current.label)
          ? serviceResult.categories.find(item => item.label === current.label) : null);
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
    if (!session || !['client', 'fanni'].includes(session.role)) return;
    if (!['client', 'technician'].includes(screen)) return;
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
        if (mounted) setClientData(current => ({ ...current, orders: uniqueByOrderSN(toList(result, ['orders'])), loading: false }));
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
    if (!form.service || form.area.trim().length < 2 || form.address.trim().length < 2) { Alert.alert('بيانات ناقصة', 'اختار الخدمة واكتب المنطقة والعنوان بالتفصيل.'); return; }
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
      setForm(current => ({ ...current, area: '', address: '', description: '', budget: '' }));
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
    if (!order || typeof order !== 'object' || !getOrderSN(order)) {
      Alert.alert('تعذر تقديم العرض', 'بيانات الطلب غير مكتملة. حدّث الفرص وحاول مرة أخرى.');
      return;
    }
    setOfferDraft({ order, price: '', message: 'أستطيع تنفيذ الخدمة المطلوبة.' });
  }

  async function submitOffer() {
    const orderSN = getOrderSN(offerDraft?.order);
    if (!orderSN || !session?.token) {
      Alert.alert('تعذر إرسال العرض', 'بيانات الطلب أو جلسة الدخول غير متاحة. أغلق النافذة وحدّث الفرص ثم حاول مرة أخرى.');
      setOfferDraft(null);
      return;
    }
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
      await api(`/orders/${encodeURIComponent(orderSN)}/offer`, {
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
          setTechData(current => ({ ...current, tab: 'completed' }));
          setExpandedTechnicianOrders(current => ({ ...current, [sn]: true }));
          setReloadKey(v => v + 1);
        }
        catch (err) { Alert.alert('تعذر إنهاء الخدمة', err.message || 'حاول مرة أخرى.'); }
      } },
    ]);
  }

  function getOrderSN(order) { return String(order?.orderSn || order?.sn || order?.order?.sn || '').trim().toUpperCase(); }
  function uniqueByOrderSN(items) {
    const result = [];
    const indexBySN = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const sn = getOrderSN(item);
      if (!sn) {
        result.push(item);
        continue;
      }
      if (!indexBySN.has(sn)) {
        indexBySN.set(sn, result.length);
        result.push(item);
        continue;
      }
      const index = indexBySN.get(sn);
      const previous = result[index];
      const nonEmptyFields = Object.fromEntries(
        Object.entries(item || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );
      result[index] = { ...previous, ...nonEmptyFields };
    }
    return result;
  }

  useEffect(() => {
    if (!session || screen !== 'technician' || session.role !== 'fanni') return;
    const acceptedJobs = techData.offers.filter(item => {
      const status = String(item.orderStatus || item.status || '').trim();
      return status === 'تم اختيار فني' || item.accepted === true;
    });
    for (const item of acceptedJobs) {
      const sn = getOrderSN(item);
      if (!sn || assignedDetails[sn]?.loading || assignedDetails[sn]?.order || assignedDetails[sn]?.error) continue;
      setAssignedDetails(current => ({ ...current, [sn]: { loading: true, error: '' } }));
      api(`/orders/${encodeURIComponent(sn)}/assigned-details`, { token: session.token })
        .then(result => { setAssignedDetails(current => ({ ...current, [sn]: { loading: false, order: result.order || result.data || null, error: '' } })); })
        .catch(error => { setAssignedDetails(current => ({ ...current, [sn]: { loading: false, order: null, error: error.message || 'تعذر تحميل تفاصيل العميل' } })); });
    }
  }, [session, screen, techData.offers, assignedDetails]);

  useEffect(() => {
    if (!session || screen !== 'client' || session.role !== 'client') return;
    let active = true, busy = false;
    const refreshClientOrders = async () => { if (busy) return; busy = true; try { const result = await api('/client/orders', { token: session.token }); if (active) setClientData(current => ({ ...current, orders: uniqueByOrderSN(toList(result, ['orders'])), loading: false, error: '' })); } catch {} finally { busy = false; } };
    const timer = setInterval(refreshClientOrders, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [session, screen]);

  useEffect(() => {
    if (!session || screen !== 'technician' || session.role !== 'fanni') return;
    let active = true, busy = false;
    const refreshTechnicianData = async () => { if (busy) return; busy = true; try { const results = await Promise.allSettled([api('/orders/available', { token: session.token }), api('/orders/my-offers', { token: session.token }), api('/fanni/wallet/history', { token: session.token })]); if (active) setTechData(current => ({ ...current, orders: results[0].status === 'fulfilled' ? toList(results[0].value, ['orders']) : current.orders, offers: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['offers'])) : current.offers, wallet: results[2].status === 'fulfilled' ? toList(results[2].value, ['history', 'transactions', 'requests']) : current.wallet })); } catch {} finally { busy = false; } };
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

  function refreshVisibleData() {
    setReloadKey(value => value + 1);
  }

  async function refreshOrderChat(order, role) {
    const sn = getOrderSN(order);
    if (!sn) return;
    setOrderChats(current => ({ ...current, [sn]: { ...(current[sn] || {}), targetOfferId: order?._id || order?.offerId || order?.id || current[sn]?.targetOfferId || '', open: true, loading: current[sn]?.open && Array.isArray(current[sn]?.messages) ? false : true, error: '' } }));
    try {
      const acceptedClientOrder = role === 'client' && ['تم اختيار فني','تم الانتهاء'].includes(order?.status || order?.orderStatus);
      const offerId = (acceptedClientOrder ? (order?.acceptedOfferId || order?.acceptedOffer?._id || order?.offerId) : '') || order?._id || order?.offerId || order?.id || orderChats[sn]?.targetOfferId || '';
      const query = offerId && role === 'client' && !acceptedClientOrder ? '?offerId=' + encodeURIComponent(offerId) : '';
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
    const currentPrice = Number(order?.acceptedOfferPrice ?? order?.client?.acceptedOfferPrice ?? order?.priceNum ?? order?.price);
    if (!sn || !Number.isFinite(newPrice) || newPrice <= 0 || reason.length < 5) {
      Alert.alert('بيانات تعديل السعر', 'اكتب السعر الجديد وسببًا واضحًا لا يقل عن 5 أحرف.'); return;
    }
    if (Number.isFinite(currentPrice) && newPrice <= currentPrice) {
      Alert.alert('السعر الجديد غير صحيح', `لازم السعر الجديد يكون أعلى من السعر الحالي (${currentPrice} جنيه).`); return;
    }
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/price-change`, { method: 'POST', token: session.token, body: { newPrice, reason } });
      Alert.alert('تم إرسال الطلب', 'تم إرسال طلب زيادة السعر، وظهر في المحادثة بحالة انتظار رد العميل. لا ترسل طلبًا آخر قبل رد العميل.');
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
          .map(order => {
            const sn = getOrderSN(order);
            const chat = sn ? orderChatsRef.current[sn] : null;
            if (!sn || !chat?.open) return null;
            const accepted = ['تم اختيار فني', 'تم الانتهاء'].includes(order?.status || order?.orderStatus);
            const offerId = (role === 'client' && accepted
              ? (order?.acceptedOfferId || order?.acceptedOffer?._id || order?.offerId)
              : '') || chat.targetOfferId || order?._id || order?.offerId || order?.id || '';
            return { sn, offerId, accepted };
          })
          .filter(Boolean);
        const uniqueChats = [...new Map(openChats.map(chat => [chat.sn, chat])).values()];
        await Promise.all(uniqueChats.map(async ({ sn, offerId, accepted }) => {
          try {
            const query = role === 'client' && !accepted && offerId
              ? '?offerId=' + encodeURIComponent(offerId)
              : '';
            const result = await api(`/orders/${encodeURIComponent(sn)}/chat${query}`, { token: session.token });
            if (!mounted) return;
            setOrderChats(current => current[sn]?.open &&
              (!offerId || String(current[sn]?.targetOfferId || '') === String(offerId))
              ? { ...current, [sn]: { ...current[sn], loading: false, error: '', messages: toList(result, ['messages']), priceChangeRequests: toList(result, ['priceChangeRequests']) } }
              : current);
          } catch {}
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
    const sn = getOrderSN(order);
    if (!order || typeof order !== 'object' || !sn) {
      Alert.alert('تعذر إرسال التقييم', 'بيانات المهمة غير مكتملة. حدّث الطلبات وحاول مرة أخرى.');
      setRatingPrompt(null);
      return;
    }
    const draft = ratingDrafts[sn] || {};
    if (ratingSubmittingRef.current.has(sn)) return;
    const stars = Number(draft.stars || 5), comment = String(draft.comment || '').trim(), blockFuture = Boolean(draft.blockFuture);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5 || (blockFuture && stars !== 1)) {
      Alert.alert('راجع التقييم', 'اختار من نجمة إلى 5 نجوم. منع التعامل متاح مع تقييم نجمة واحدة فقط.'); return;
    }

    ratingSubmittingRef.current.add(sn);
    setRatingSubmitting(current => ({ ...current, [sn]: true }));
    const controller = new AbortController();
    const activePrompt = ratingPrompt && getOrderSN(ratingPrompt.order) === sn ? ratingPrompt : null;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await api(`/orders/${encodeURIComponent(sn)}/rating`, {
        method: 'POST',
        token: orderToken(session?.role || 'client'),
        body: { stars, comment, blockFuture },
        signal: controller.signal,
      });
      ratingHandledRef.current.add(`${ratingStorageKey}:${sn}`);
      dismissedRatingsRef.current = { ...dismissedRatingsRef.current, [sn]: true };
      setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], stars: String(stars), comment: '', blockFuture: false, submitted: true } }));
      setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
      await saveRatingDismissal(sn);
      setReloadKey(v => v + 1);
      Alert.alert('تم حفظ التقييم', result.message || 'تم حفظ تقييمك بنجاح.');
    } catch (err) {
      if (err?.status === 409) {
        ratingHandledRef.current.add(`${ratingStorageKey}:${sn}`);
        dismissedRatingsRef.current = { ...dismissedRatingsRef.current, [sn]: true };
        setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
        await saveRatingDismissal(sn);
        setReloadKey(v => v + 1);
        Alert.alert('التقييم محفوظ بالفعل', 'سبق تسجيل تقييمك لهذه المهمة، ولن يظهر مربع التقييم مرة أخرى.');
        return;
      }
      if (activePrompt) setRatingPrompt(activePrompt);
      Alert.alert('تعذر حفظ التقييم', err.message || 'تعذر حفظ التقييم. حاول مرة أخرى.');
    } finally {
      clearTimeout(timeout);
      ratingSubmittingRef.current.delete(sn);
      setRatingSubmitting(current => ({ ...current, [sn]: false }));
    }
  }

  async function saveRatingDismissal(sn) {
    if (!sn) return;
    const next = { ...dismissedRatingsRef.current, [sn]: true };
    dismissedRatingsRef.current = next;
    setDismissedRatings(current => ({ ...current, ...next, [sn]: true }));
    try {
      const raw = await SecureStore.getItemAsync(ratingStorageKey);
      let persisted = {};
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) persisted = parsed;
      } catch (_) {}
      const merged = { ...persisted, ...dismissedRatingsRef.current, [sn]: true };
      dismissedRatingsRef.current = merged;
      setDismissedRatings(current => ({ ...current, ...merged, [sn]: true }));
      const serialized = JSON.stringify(merged);
      await Promise.all([
        SecureStore.setItemAsync(ratingStorageKey, serialized),
        SecureStore.setItemAsync(oldestRatingStorageKey, serialized),
        SecureStore.setItemAsync(legacyRatingStorageKey, serialized),
      ]);
    } catch (error) {
      console.warn('تعذر حفظ حالة تخطي التقييم:', error?.message || error);
    }
  }

  async function skipRatingPrompt() {
    const prompt = ratingPrompt;
    if (!prompt) return;
    const sn = getOrderSN(prompt.order);
    if (!sn) { setRatingPrompt(null); return; }
    ratingHandledRef.current.add(`${ratingStorageKey}:${sn}`);
    dismissedRatingsRef.current = { ...dismissedRatingsRef.current, [sn]: true };
    setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], skipped: true } }));
    setRatingPrompt(current => current && getOrderSN(current.order) === sn ? null : current);
    await saveRatingDismissal(sn);
  }

  function renderRatingModal(role) {
    if (!ratingPrompt || ratingPrompt.role !== role) return null;
    const order = ratingPrompt.order;
    const sn = getOrderSN(order);
    if (!order || typeof order !== 'object' || !sn) return null;
    const draft = ratingDrafts[sn] || { stars: '5', comment: '', blockFuture: false };
    const stars = Number(draft.stars || 5);
    const submitting = Boolean(ratingSubmitting[sn]);
    return <Modal visible transparent animationType="fade" onRequestClose={skipRatingPrompt}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingModal}>
          <Text style={styles.title}> {role === 'client' ? 'قيّم الفني' : 'قيّم العميل'}</Text>
          <Text style={styles.detail}>المهمة {sn} انتهت. اختار تقييمك، والتعليق اختياري.</Text>
          {renderRatingStars(order, stars)}
          <Field label="تعليق (اختياري)" value={draft.comment || ''} onChangeText={value => setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], comment: value } }))} multiline placeholder="اكتب ملاحظتك هنا..." />
          {stars === 1 ? <TouchableOpacity onPress={() => setRatingDrafts(current => ({ ...current, [sn]: { ...current[sn], blockFuture: !current[sn]?.blockFuture } }))} style={styles.inlineCheck}>
            <Text style={styles.detail}>{draft.blockFuture ? '☑' : '☐'} {role === 'client' ? 'عدم استقبال عروض من الفني ده مرة تانية' : 'عدم إظهار طلبات العميل ده ليّ مرة تانية'}</Text>
          </TouchableOpacity> : null}
          <Button title={submitting ? "جاري إرسال التقييم..." : "إرسال التقييم"} onPress={() => submitOrderRating(order)} disabled={submitting} />
          <Button title="تخطي" secondary onPress={skipRatingPrompt} disabled={submitting} />
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
    const name = adminRegionDraft.trim().replace(/\s+/g, ' ');
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
    Alert.alert('تأكيد تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك والعودة إلى الصفحة الرئيسية؟', [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: () => { void performLogout(); } }
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

  if (screen === 'login') return <SafeAreaView style={styles.loginSafe}>
    <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity accessibilityRole="button" onPress={() => setScreen('home')} style={styles.loginBackButton}>
        <Text style={styles.loginBackText}>‹ رجوع</Text>
      </TouchableOpacity>
      <View style={styles.loginLogoCircle}>
        <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.loginLogo} resizeMode="contain" />
      </View>
      <View style={styles.loginHeading}>
        <Text style={styles.loginTitle}>{authMode === 'client' ? 'أهلًا بيك في صُنّاع' : 'أهلًا بيك يا فني صُنّاع'}</Text>
        <Text style={styles.loginSubtitle}>{authMode === 'client' ? 'سجّل دخولك وخلّي طلباتك أسهل.' : 'سجّل دخولك وتابع فرص الشغل المتاحة ليك.'}</Text>
      </View>
      <View style={styles.loginForm}>
        <Field label="رقم الهاتف أو البريد الإلكتروني" value={username} onChangeText={setUsername} placeholder="اكتب رقم الهاتف أو البريد الإلكتروني" keyboardType="default" />
        <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry placeholder="اكتب كلمة السر" returnKeyType="go" onSubmitEditing={handleLogin} blurOnSubmit />
        <TouchableOpacity accessibilityRole="button" onPress={() => { setRecoveryForm({ role: authMode, phone: username, token: '', id: '', messages: [], text: '', code: '', newPassword: '', confirmPassword: '', loading: false, error: '', info: '' }); setScreen('passwordRecovery'); }} style={styles.recoveryLink}>
          <Text style={styles.recoveryLinkText}>نسيت كلمة السر؟ استعادة</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={handleLogin} disabled={loginLoading} style={[styles.loginGradientButton, loginLoading && styles.disabledButton]}>
          <Text style={styles.loginGradientButtonText}>{loginLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</Text>
        </TouchableOpacity>
        {authMode === 'client' && <Button title="إنشاء حساب عميل جديد" secondary onPress={() => setScreen('clientRegister')} />}
        {authMode === 'fanni' && <Button title="إنشاء حساب فني جديد" secondary onPress={() => setScreen('technicianRegister')} />}
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;

  if (screen === 'account') {
    const isClientAccount = session?.role === 'client';
    const history = isClientAccount ? clientData.orders : session?.role === 'fanni' ? techData.offers : [];
    const completedHistory = (history || []).filter(item => ['تم الانتهاء', 'مكتمل', 'مكتملة', 'completed', 'complete', 'finished'].includes(String(item.status || item.orderStatus || '').trim().toLowerCase()));
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="‹ رجوع" secondary onPress={() => setScreen(session?.role === 'client' ? 'client' : session?.role === 'fanni' ? 'technician' : 'admin')} />
      <Text style={styles.title}>حسابي</Text>
      <View style={styles.dataCard}>
        <Text style={styles.sectionTitle}>بيانات الحساب</Text>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>الاسم</Text><Text style={styles.detailValue}>{session?.user?.name || '—'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>رقم الهاتف</Text><Text style={styles.detailValue}>{session?.user?.phone || '—'}</Text></View>
        <View style={styles.detailRow}><Text style={styles.detailLabel}>نوع الحساب</Text><Text style={styles.detailValue}>{isClientAccount ? 'عميل' : session?.role === 'fanni' ? 'فني' : 'إدارة'}</Text></View>
        {session?.role === 'fanni' && session?.user?.walletBalance != null ? <View style={styles.detailRow}><Text style={styles.detailLabel}>الرصيد</Text><Text style={styles.detailValueGold}>{String(session.user.walletBalance)} جنيه</Text></View> : null}
      </View>
      <Button title="تغيير كلمة المرور" onPress={() => setScreen('changePassword')} />
      {['client', 'fanni'].includes(session?.role) ? <>
        <Text style={styles.sectionTitle}>سجل الخدمات والتقييمات</Text>
        {completedHistory.length ? completedHistory.map((item, index) => {
          const sn = getOrderSN(item);
          const alreadyRated = Boolean(item.myRating || item.clientRating || item.fanniRating || item.ratingByClient || item.ratingByFanni || (item.ratings || []).some(r => r.reviewerRole === session.role));
          const rating = item.myRating || item.clientRating || item.fanniRating || {};
          return <View key={sn || index} style={styles.dataCard}>
            <Text style={styles.cardTitle}>{item.service || 'خدمة'} • {sn}</Text>
            <Text style={styles.detail}>{alreadyRated ? '★'.repeat(Math.max(0, Math.min(5, Number(rating.stars || rating.rating) || 0))) + ' ' + String(rating.stars || rating.rating || 'تم التقييم') : 'لم يتم التقييم'}</Text>
            {!alreadyRated ? <Button title="تقييم العملية يدويًا" secondary onPress={() => { setScreen(session.role === 'client' ? 'client' : 'technician'); setRatingPrompt({ role: session.role, order: item }); }} /> : null}
          </View>;
        }) : <Text style={styles.detail}>لا توجد عمليات مكتملة لعرضها حاليًا.</Text>}
      </> : null}
    </ScrollView></SafeAreaView>;
  }

  if (screen === 'changePassword') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="‹ رجوع إلى حسابي" secondary onPress={() => setScreen('account')} /><Text style={styles.title}>تغيير كلمة المرور</Text><Field label="كلمة المرور الحالية" value={accountPasswordForm.currentPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, currentPassword: v }))} secureTextEntry /><Field label="كلمة المرور الجديدة" value={accountPasswordForm.newPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={accountPasswordForm.confirmPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title={accountPasswordForm.loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'} onPress={changeAccountPassword} disabled={accountPasswordForm.loading} />{accountPasswordForm.error ? <Text style={styles.errorText}>{accountPasswordForm.error}</Text> : null}</ScrollView></SafeAreaView>;

  if (screen === 'passwordRecovery') return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="‹ رجوع لتسجيل الدخول" secondary onPress={() => setScreen('login')} /><Text style={styles.title}>استعادة كلمة المرور</Text>{!recoveryForm.token ? <><Field label="رقم الهاتف المسجل" value={recoveryForm.phone} onChangeText={v => setRecoveryForm(c => ({ ...c, phone: v }))} keyboardType="phone-pad" /><Button title={recoveryForm.loading ? 'جاري إرسال الطلب...' : 'فتح طلب دعم'} onPress={startPasswordRecovery} disabled={recoveryForm.loading} /></> : <><Text style={styles.sectionTitle}>محادثة استعادة الحساب</Text><Text style={styles.detail}>{recoveryForm.info}</Text>{recoveryForm.messages.map((m,i) => <View key={String(m._id||i)} style={styles.chatMessage}><Text style={styles.detail}>{m.senderRole === 'admin' ? 'الدعم' : 'أنت'} • {dateLabel(m.createdAt)}</Text><Text style={styles.chatMessageText}>{m.text}</Text></View>)}<Field label="رسالة للدعم" value={recoveryForm.text} onChangeText={v => setRecoveryForm(c => ({ ...c, text: v }))} returnKeyType="send" onSubmitEditing={sendRecoveryMessage} blurOnSubmit /><Button title="إرسال رسالة للدعم" onPress={sendRecoveryMessage} disabled={recoveryForm.loading} /><Field label="رمز الاستعادة الذي أرسله الدعم" value={recoveryForm.code} onChangeText={v => setRecoveryForm(c => ({ ...c, code: v }))} keyboardType="number-pad" /><Button title="التحقق من الرمز" secondary onPress={verifyRecoveryCode} disabled={recoveryForm.loading} /><Field label="كلمة المرور الجديدة" value={recoveryForm.newPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={recoveryForm.confirmPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title="حفظ كلمة المرور الجديدة" onPress={resetRecoveredPassword} disabled={recoveryForm.loading} /><Button title="تحديث المحادثة" secondary onPress={refreshPasswordRecovery} /></>}{recoveryForm.error ? <Text style={styles.errorText}>{recoveryForm.error}</Text> : null}</ScrollView></SafeAreaView>;

  if (screen === 'clientRegister' || screen === 'technicianRegister') {
    const isClient = screen === 'clientRegister';
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="‹ رجوع" secondary onPress={() => setScreen('home')} />
      <Text style={styles.title}>{isClient ? 'إنشاء حساب عميل' : 'تسجيل فني جديد'}</Text>
      <Field label="الاسم" value={form.name} onChangeText={v => updateForm('name', v)} autoCapitalize="words" />
      <Field label="رقم الهاتف" value={form.phone} onChangeText={v => updateForm('phone', v)} keyboardType="phone-pad" />
      <Field label="كلمة السر" value={form.password} onChangeText={v => updateForm('password', v)} secureTextEntry />
      <Field label="تأكيد كلمة السر" value={form.confirmPassword} onChangeText={v => updateForm('confirmPassword', v)} secureTextEntry />
      {!isClient && <>
        <Text style={styles.sectionTitle}>اختار الخدمات اللي بتقدمها</Text>
        {categories.map(category => <View key={category.label} style={styles.selectionGroup}>
          <TouchableOpacity onPress={() => setSelected(current => current?.label === category.label ? null : category)} style={styles.categoryToggle}><Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label} · {(category.services || []).length} {selected?.label === category.label ? '▲' : '▼'}</Text></TouchableOpacity>
          {selected?.label === category.label ? (category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleArray('specialties', service)} style={styles.choiceRow}><Text style={styles.choiceText}>{form.specialties.includes(service) ? '☑' : '□'} {service}</Text></TouchableOpacity>) : null}
        </View>)}
      </>}
      <Button title={loginLoading ? 'جاري التسجيل...' : isClient ? 'إنشاء حساب' : 'إرسال طلب التسجيل'} onPress={isClient ? registerClient : registerTechnician} disabled={loginLoading} />
    </ScrollView></SafeAreaView>;
  }

  if (screen === 'client' && session?.role === 'client') return <SafeAreaView style={styles.safe}>
      {/* HEADER PREMIUM COMPACT - اسم العميل صغير */}
      <View style={styles.clientHeader}>
        <View style={styles.clientHeaderLeft}>
          <TouchableOpacity onPress={() => { setNotificationsOpen(v => !v); setReloadKey(v => v + 1); }} style={styles.bellButtonSmall}><Text style={styles.bellText}>🔔</Text>{notifications.unread > 0 ? <View style={styles.bellBadgeDot}><Text style={styles.bellBadgeText}>{notifications.unread}</Text></View> : null}</TouchableOpacity>
          <Button title="حسابي" secondary onPress={() => setScreen('account')} />
          <Button title="خروج" secondary onPress={logout} />
        </View>
        <View style={styles.clientHeaderRight}>
          <View style={styles.clientAvatarSmall}><Text style={styles.clientAvatarText}>{(session.user?.name || 'ع')[0]}</Text></View>
          <View style={styles.clientHeaderInfo}>
            <Text style={styles.clientNameSmall} numberOfLines={1}>أهلًا {session.user?.name || 'بك'}</Text>
            <Text style={styles.clientRoleSmall}>عميل صُنّاع</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabRowPremium}>{[{key:'new',label:'طلب جديد',icon:'＋'},{key:'current',label:'الطلبات الجارية',count:clientData.orders.filter(o => !['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status)).length},{key:'previous',label:'سابقة',count:clientData.orders.filter(o => ['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(o.status)).length},{key:'track',label:'تتبع'},{key:'complaint',label:'شكوى'}].map(t => <TouchableOpacity key={t.key} onPress={() => setClientTab(t.key)} style={[styles.pillPremium, clientTab===t.key && styles.pillPremiumActive]}><Text style={[styles.pillPremiumText,clientTab===t.key && styles.pillPremiumTextActive]}>{t.icon ? t.icon + ' ' : ''}{t.label}{t.count ? ` (${t.count})` : ''}</Text></TouchableOpacity>)}</View>

    <ScrollView ref={clientScrollRef} contentContainerStyle={[styles.page, { paddingBottom: 110 }]} showsVerticalScrollIndicator={false}>
      {clientTab === 'new' ? <><View style={styles.welcomeCard}><Text style={styles.welcomeTitle}>اطلب خدمتك الآن 🚀</Text><Text style={styles.welcomeSub}>اختار المهنة والخدمة والفني المناسب هيجيلك</Text></View>
      {servicesLoading ? <ActivityIndicator color={COLORS.teal} /> : <>
        <Text style={styles.fieldLabelPremium}>① اختار المهنة الرئيسية</Text>
        <View style={styles.serviceTilesPremium}>
          {categories.map(category => <TouchableOpacity key={category.label} onPress={() => { setSelected(category); updateForm('service', ''); setServicePickerOpen(false); setSubservicePickerOpen(false); }} style={[styles.serviceTilePremium, selected?.label === category.label && styles.serviceTilePremiumSelected]}>
            <View style={[styles.serviceIconCircle, selected?.label === category.label && styles.serviceIconCircleSelected]}><Text style={styles.serviceTileIcon}>{category.emoji || '🛠️'}</Text></View>
            <Text style={[styles.serviceTileLabelPremium, selected?.label === category.label && styles.serviceTileLabelPremiumSelected]}>{category.label}</Text>
          </TouchableOpacity>)}
        </View>
        {selected ? <>
          <Text style={styles.fieldLabelPremium}>② اختار الخدمة التفصيلية</Text>
          <View style={styles.serviceTilesPremium}>
            {(selected.services || []).map(service => <TouchableOpacity key={service} onPress={() => { updateForm('service', service); setSubservicePickerOpen(false); }} style={[styles.serviceTilePremium, styles.detailTilePremium, form.service === service && styles.serviceTilePremiumSelected]}>
              <View style={[styles.serviceIconCircleSmall, form.service === service && styles.serviceIconCircleSelected]}><Text style={styles.serviceTileIconSmall}>{getServiceEmoji(service)}</Text></View>
              <Text style={[styles.serviceTileLabelPremiumSmall, form.service === service && styles.serviceTileLabelPremiumSelected]}>{service}</Text>
            </TouchableOpacity>)}
          </View>
        </> : null}
        <View style={styles.formCard}><Field label="المنطقة أو الحي *" value={form.area} onChangeText={v => updateForm('area', v)} placeholder="مثال: مدينة نصر أو شبرا" />
        <Field label="العنوان بالتفصيل *" value={form.address} onChangeText={v => updateForm('address', v)} placeholder="الشارع ورقم العقار وأقرب علامة مميزة" />
        <Field label="تفاصيل الشغل المطلوبة *" value={form.description} onChangeText={v => updateForm('description', v)} multiline placeholder="اكتب تفاصيل الخدمة اللي محتاجها" />
        <Field label="ميزانية متوقعة (اختياري)" value={form.budget} onChangeText={v => updateForm('budget', v)} placeholder="مثال: من 300 إلى 500 جنيه" />
        <Button title={loginLoading ? 'جاري إرسال الطلب...' : '🚀 إرسال طلب الخدمة'} onPress={createOrder} disabled={loginLoading} /></View>
      </>}</> : null}
      {clientData.sn ? <View style={styles.codeRowPremium}><Text selectable style={styles.successText}>كود الطلب: {clientData.sn}</Text><Button title="نسخ" secondary onPress={() => copyOrderCode(clientData.sn)} /></View> : null}
      {['current', 'previous'].includes(clientTab) ? clientData.orders.filter(order => clientTab === 'previous' ? ['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(order.status) : !['تم الانتهاء','منتهي','ملغي','مؤرشف','منتهي - اعتذار'].includes(order.status)).map((order, i) => {
        const sn = getOrderSN(order), expanded = Boolean(expandedClientOrders[sn]), rating = ratingDrafts[sn];
        return <View key={String(order._id || sn || i)} style={styles.orderCardPremium}>
          <TouchableOpacity onPress={() => setExpandedClientOrders(current => ({ ...current, [sn]: !current[sn] }))} style={styles.orderCardHeader}>
            <View style={[styles.statusDot, ['تم اختيار فني','تم الانتهاء'].includes(order.status) ? styles.statusDotDone : styles.statusDotPending]} />
            <View style={{flex:1}}><Text style={styles.cardTitlePremium}>{order.service || 'طلب خدمة'} — {sn}</Text><Text style={styles.orderStatusSmall}>{order.status || 'قيد المراجعة'} • {order.area || ''}</Text></View>
            <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {expanded ? <View style={styles.orderCardBody}><Text style={styles.detail}>{dateLabel(order.createdAt)}</Text><Text style={styles.detail}>{order.description || 'لا توجد تفاصيل إضافية.'}</Text>
            {order.status === 'تم اختيار فني' && order.assignedFanniName ? <Text style={styles.detailBold}>الفني: {order.assignedFanniName}</Text> : null}
            {order.status === 'تم اختيار فني' && order.assignedFanniPhone ? <Button title="📞 اتصال بالفني" secondary onPress={() => Linking.openURL(`tel:${order.assignedFanniPhone}`)} /> : null}
            {!['تم اختيار فني','تم الانتهاء','ملغي','مؤرشف','منتهي','منتهي - اعتذار'].includes(order.status) ? <Button title="إلغاء الطلب" secondary onPress={() => cancelClientOrder(order)} /> : null}
            {Array.isArray(order.offers) && order.offers.length ? <><Text style={styles.sectionTitleSmall}>عروض الفنيين ({order.offers.length})</Text>{order.offers.map((offer,j)=><View key={String(offer._id||offer.id||j)} style={styles.offerCardPremium}><Text style={styles.cardTitleSmall}>{offer.fanniName||offer.technicianName||'فني'} — {offer.price??'—'} جنيه</Text><Text style={styles.detail}>★ {Number(offer.fanniRatingAverage||0).toFixed(1)} ({Number(offer.fanniRatingCount||0)} تقييم) • ✓ {Number(offer.fanniCompletedJobs||0)} مهمة مكتملة</Text><Text style={styles.detail}>{offer.message||''}</Text>{order.status!=='تم اختيار فني'&&order.status!=='تم الانتهاء'&&<><Button title="✅ قبول العرض" onPress={()=>acceptClientOffer(order,offer)}/><Button title={orderChats[sn]?.open && String(orderChats[sn]?.targetOfferId||'')===String(offer._id||offer.id||'')?'إخفاء المحادثة':'💬 محادثة العرض'} secondary onPress={()=>toggleOrderChat({...order,_id:offer._id||offer.id,offerId:offer._id||offer.id},'client')}/></>}</View>)}</> : <Text style={styles.detail}>لا توجد عروض حتى الآن.</Text>}
            {['تم اختيار فني','تم الانتهاء'].includes(order.status) ? <View style={styles.roleActions}><Button title={orderChats[sn]?.open?'إخفاء المحادثة':'💬 محادثة'} secondary onPress={()=>toggleOrderChat({...order,_id:order.acceptedOfferId||order._id,offerId:order.acceptedOfferId||order._id},'client')}/></View> : null}
            {orderChats[sn]?.open ? <View style={styles.chatPanelPremium}>{orderChats[sn]?.loading ? <Text style={styles.detail}>جاري تحميل المحادثة...</Text> : null}{orderChats[sn]?.error ? <Text style={styles.errorText}>{orderChats[sn].error}</Text> : null}{(orderChats[sn]?.messages||[]).length===0 && !orderChats[sn]?.loading && !orderChats[sn]?.error ? <Text style={styles.detail}>لا توجد رسائل في هذه المحادثة حتى الآن.</Text> : null}{(orderChats[sn]?.messages||[]).map((message,j)=><View key={String(message._id||j)} style={[styles.chatMessage, message.senderRole === 'client' ? styles.chatMessageClient : styles.chatMessageTechnician]}><Text style={styles.detailSmall}>{message.senderRole==='client'?'أنت':'الفني'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}{!['تم اختيار فني','تم الانتهاء'].includes(order.status) ? <View style={styles.roleActions}>{['هل السعر شامل؟','متى تقدر تيجي؟','هل في تكلفة إضافية؟'].map(question=><Button key={question} title={question} secondary onPress={()=>sendOrderChat({...order,_id:orderChats[sn]?.targetOfferId||order._id,offerId:orderChats[sn]?.targetOfferId||order._id},question)}/>)}</View> : null}{(orderChats[sn]?.priceChangeRequests||[]).map(request=><View key={String(request._id||request.id)} style={styles.offerCardPremium}><Text style={styles.cardTitleSmall}>طلب تعديل السعر</Text><Text style={styles.detail}>السعر السابق: {request.oldPrice} جنيه • السعر المطلوب: {request.newPrice} جنيه</Text><Text style={styles.detail}>السبب: {request.reason||'—'}</Text><Text style={styles.detail}>الحالة: {request.status||'—'}</Text>{request.status==='قيد الموافقة' ? <View style={styles.roleActions}><Button title="موافقة على الزيادة" onPress={()=>decideOrderPrice(order,request,true)}/><Button title="رفض الزيادة" secondary onPress={()=>decideOrderPrice(order,request,false)}/></View> : null}</View>)}{order.status!=='تم الانتهاء' ? <><Field label="رسالة للفني" value={chatDrafts[sn]||''} onChangeText={value=>setChatDrafts(current=>({...current,[sn]:value}))} placeholder="اكتب رسالة" returnKeyType="send" onSubmitEditing={() => sendOrderChat({...order,_id:orderChats[sn]?.targetOfferId||order.acceptedOfferId||order._id,offerId:orderChats[sn]?.targetOfferId||order.acceptedOfferId||order._id})} blurOnSubmit /><Button title="إرسال" onPress={()=>sendOrderChat({...order,_id:orderChats[sn]?.targetOfferId||order.acceptedOfferId||order._id,offerId:orderChats[sn]?.targetOfferId||order.acceptedOfferId||order._id})}/></> : null}</View>:null}
          </View> : null}
        </View>;
      }) : null}
      {clientTab === 'track' ? <View style={styles.formCard}><Text style={styles.cardTitlePremium}>تتبع طلبك 🔍</Text><Field label="كود الطلب" value={clientTrackSN} onChangeText={setClientTrackSN} placeholder="SN123456" autoCapitalize="characters"/><Button title={clientTrackLoading ? 'جاري البحث...' : 'تتبع الطلب'} onPress={trackClientOrder} disabled={clientTrackLoading}/>{clientTrackError ? <Text style={styles.errorText}>{clientTrackError}</Text> : null}{clientTrackedOrder ? <View style={styles.offerCardPremium}><Text style={styles.cardTitleSmall}>{clientTrackedOrder.service || 'طلب خدمة'} — {getOrderSN(clientTrackedOrder)}</Text><Text style={styles.detail}>الحالة: {clientTrackedOrder.status || 'قيد المراجعة'}</Text></View> : null}</View> : null}
      {clientTab === 'complaint' ? <View style={styles.formCard}><Text style={styles.cardTitlePremium}>تقديم شكوى للإدارة</Text><Field label="كود الطلب" value={clientComplaint.sn} onChangeText={v => setClientComplaint(c => ({ ...c, sn: v.toUpperCase(), error: '' }))} placeholder="SN123456" autoCapitalize="characters"/><Field label="الاسم المسجل" value={clientComplaint.name} onChangeText={v => setClientComplaint(c => ({ ...c, name: v, error: '' }))}/><Field label="تفاصيل الشكوى" value={clientComplaint.text} onChangeText={v => setClientComplaint(c => ({ ...c, text: v, error: '' }))} multiline/><Button title={clientComplaint.loading ? 'جاري الإرسال...' : 'إرسال الشكوى'} onPress={submitClientComplaint} disabled={clientComplaint.loading}/></View> : null}
      {notificationsOpen ? <Modal transparent visible={notificationsOpen} animationType="fade" onRequestClose={() => setNotificationsOpen(false)}><View style={styles.notificationModalBackdrop}><TouchableOpacity style={styles.notificationModalDismiss} activeOpacity={1} onPress={() => setNotificationsOpen(false)} /><View style={styles.notificationModalCard}><View style={styles.notificationModalHeader}><Text style={styles.cardTitleSmall}>الإشعارات {notifications.unread ? `(${notifications.unread})` : ''}</Text><View style={styles.notificationHeaderActions}>{notifications.unread > 0 ? <Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} /> : null}<Button title="إغلاق" secondary onPress={() => setNotificationsOpen(false)} /></View></View><ScrollView style={styles.notificationModalList} contentContainerStyle={styles.notificationListContent}>{notifications.loading ? <ActivityIndicator color={COLORS.teal} /> : notifications.items.length ? notifications.items.map((item,i)=><TouchableOpacity key={String(item._id||item.id||i)} onPress={()=>markNotificationRead(item)} style={[styles.notificationRow, (item.read || item.readAt) ? styles.notificationRead : styles.notificationUnread]}><Text style={[styles.cardTitleSmall, (item.read || item.readAt) && styles.notificationReadText]}>{item.title||'إشعار'}</Text><Text style={[(item.read || item.readAt) ? styles.notificationReadText : styles.detail]}>{item.message||''}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</ScrollView></View></View></Modal> : null}</ScrollView>
    <View pointerEvents="box-none" style={styles.floatingControls}><TouchableOpacity onPress={refreshVisibleData} style={styles.floatingButton}><Text style={styles.floatingIcon}>⟳</Text></TouchableOpacity><TouchableOpacity onPress={openWhatsAppSupport} style={[styles.floatingButton,styles.whatsappButton]}><Text style={styles.floatingWhatsApp}>🎧</Text></TouchableOpacity></View>
    {renderRatingModal('client')}
  </SafeAreaView>;

  if (screen === 'technician' && session?.role === 'fanni') {
    const user = techData.profile || session.user || {};
    const tab = techData.tab;
    const isRejectedOffer = item => {
      const status = String(item.orderStatus || item.status || '').trim();
      return ['مرفوض', 'تم الرفض', 'تم رفض العرض', 'مرفوضة', 'rejected', 'declined'].includes(status.toLowerCase()) ||
        (item.accepted === false && ['تم اختيار فني', 'جاري التنفيذ', 'قيد التنفيذ'].includes(status));
    };
    const isAcceptedJob = item => !isRejectedOffer(item) && (item.accepted === true || ['تم اختيار فني', 'جاري التنفيذ', 'قيد التنفيذ'].includes(String(item.orderStatus || item.status || '').trim()));
    const isCompletedJob = item => ['تم الانتهاء', 'مكتمل', 'مكتملة', 'completed', 'finished'].includes(String(item.orderStatus || item.status || '').trim().toLowerCase());
    const displayedOffers = techData.offers.filter(item => tab === 'currentJobs' ? isAcceptedJob(item) && !isCompletedJob(item) : tab === 'completed' ? isCompletedJob(item) : !isAcceptedJob(item) && !isCompletedJob(item));
    const tabs = [{ key: 'available', label: `الفرص (${techData.orders.length})` }, { key: 'offers', label: `عروضي (${techData.offers.filter(o => !isAcceptedJob(o) && !isCompletedJob(o)).length})` }, { key: 'currentJobs', label: `الطلبات الجارية (${techData.offers.filter(o => isAcceptedJob(o) && !isCompletedJob(o)).length})` }, { key: 'completed', label: `المكتملة` }, { key: 'wallet', label: 'المحفظة' }, { key: 'profile', label: 'حسابي' }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.clientHeader}>
        <View style={styles.clientHeaderLeft}>
          <TouchableOpacity onPress={() => { setNotificationsOpen(v => !v); setReloadKey(v => v + 1); }} style={styles.bellButtonSmall}><Text style={styles.bellText}>🔔</Text>{notifications.unread > 0 ? <View style={styles.bellBadgeDot}><Text style={styles.bellBadgeText}>{notifications.unread}</Text></View> : null}</TouchableOpacity>
          <Button title="خروج" secondary onPress={logout} />
        </View>
        <View style={styles.clientHeaderRight}>
          <View style={[styles.clientAvatarSmall, {backgroundColor: '#0F172A'}]}><Text style={styles.clientAvatarText}>{(user.name || 'ف')[0]}</Text></View>
          <View style={styles.clientHeaderInfo}>
            <Text style={styles.clientNameSmall} numberOfLines={1}>{user.name || 'الفني'} • {user.level || 'مبتدئ'}</Text>
            <Text style={styles.clientRoleSmall}>{user.status || 'قيد المراجعة'} • {Number(user.walletBalance || 0)} جنيه</Text>
          </View>
        </View>
      </View>
      <View style={styles.tabRowPremium}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => setTechData(v => ({ ...v, tab: item.key }))} style={[styles.pillPremium, tab === item.key && styles.pillPremiumActive]}><Text style={[styles.pillPremiumText, tab === item.key && styles.pillPremiumTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
      {offerDraft ? <View style={styles.formCard}>
        <Text style={styles.cardTitlePremium}>تقديم عرض على {offerDraft.order.service || 'الخدمة'} — {offerDraft.order.sn}</Text>
        <Field label="السعر بالجنيه" value={offerDraft.price} onChangeText={value => setOfferDraft(current => ({ ...current, price: value }))} keyboardType="numeric" />
        <Field label="رسالة للعميل" value={offerDraft.message} onChangeText={value => setOfferDraft(current => ({ ...current, message: value }))} multiline />
        <Button title="إرسال العرض" onPress={submitOffer} />
        <Button title="إلغاء" secondary onPress={() => setOfferDraft(null)} />
      </View> : null}
      <View style={{ flex: 1 }}>
        {techData.loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.teal} /><Text style={styles.statusText}>جاري تحميل بيانات الفني...</Text></View> : <>
          {tab === 'available' && <FlatList style={{ flex: 1 }} contentContainerStyle={styles.listPremium} data={techData.orders.filter(item => { const query = technicianSearch.trim().toLocaleLowerCase(); const haystack = [item.service, item.specialty, item.area, item.sn, item.orderSn, item.description, item.desc].filter(Boolean).join(' ').toLocaleLowerCase(); return (!query || haystack.includes(query)); })} keyExtractor={(item, i) => String(item._id || item.sn || i)} ListEmptyComponent={<Text style={styles.emptyText}>لا توجد فرص متاحة حاليًا.</Text>} renderItem={({ item }) => {
             const sn = getOrderSN(item);
             return <View style={styles.orderCardPremium}>
               <Text style={styles.cardTitlePremium}>{item.service || 'طلب خدمة'} — {sn}</Text>
               <Text style={styles.detail}>المنطقة: {item.area || 'غير محددة'} • ميزانية العميل: {item.budget !== undefined && item.budget !== null && String(item.budget).trim() !== '' ? `حوالي ${item.budget} جنيه` : 'غير محددة'}</Text>
               <Text style={styles.detail}>يمكنك تقديم عرضك بالسعر المناسب لك.</Text>
               <Text style={styles.detail}>تقييم العميل: ★ {Number(item.clientRatingAverage || 0).toFixed(1)} ({Number(item.clientRatingCount || 0)} تقييم) • ✓ {Number(item.clientCompletedJobs || 0)} مهمة مكتملة</Text>
               <View style={styles.serviceDescriptionBox}><Text style={styles.serviceDescriptionLabel}>تفاصيل الخدمة من العميل</Text><Text style={styles.serviceDescriptionText}>{item.description || 'لم يضف العميل تفاصيل إضافية.'}</Text></View>
               {(() => {
                 const ownOffer = techData.offers.find(offer => getOrderSN(offer) === sn);
                 const ownOfferRejected = ownOffer && isRejectedOffer(ownOffer);
                 const ownOfferAccepted = ownOffer && isAcceptedJob(ownOffer);
                 if (ownOfferRejected) return <TouchableOpacity disabled style={[styles.button, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}><Text style={[styles.buttonText, { color: '#FFFFFF' }]}>تم رفض عرضك</Text></TouchableOpacity>;
                 if (ownOfferAccepted) return null;
                 if (ownOffer) return <Button title="جاري انتظار الرد على عرضك" disabled onPress={() => {}} />;
                 return <Button title="تقديم عرض" onPress={() => sendOffer(item)} />;
               })()}
             </View>;
           }} />}
          {(tab === 'offers' || tab === 'currentJobs' || tab === 'completed') && <FlatList style={{ flex: 1 }} contentContainerStyle={styles.listPremium} data={displayedOffers} keyExtractor={(item, i) => String(item._id || item.orderSn || i)} ListEmptyComponent={<Text style={styles.emptyText}>{tab === 'currentJobs' ? 'مفيش طلبات جارية حاليًا.' : tab === 'completed' ? 'لسه مفيش خدمات مكتملة.' : 'لسه ماقدمتش عروض جديدة.'}</Text>} renderItem={({ item }) => {
             const sn = getOrderSN(item);
             return <View style={styles.orderCardPremium}>
               <Text style={styles.cardTitlePremium}>{item.service || 'خدمة'} — {sn}</Text>
               <Text style={styles.detail}>الحالة: {isRejectedOffer(item) ? 'تم رفض عرضك' : (item.orderStatus || '—')} • السعر: {item.price || '—'} جنيه</Text>
               {isRejectedOffer(item) ? <TouchableOpacity disabled style={[styles.button, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}><Text style={[styles.buttonText, { color: '#FFFFFF' }]}>تم رفض عرضك</Text></TouchableOpacity> : null}
               {item.client ? <Text style={styles.detail}>تقييم العميل: ★ {Number(item.client.ratingAverage || 0).toFixed(1)} ({Number(item.client.ratingCount || 0)} تقييم) • ✓ {Number(item.client.completedJobs || 0)} مهمة مكتملة</Text> : null}
               {isAcceptedJob(item) && !isCompletedJob(item) ? <View style={styles.formCard}><Text style={styles.cardTitleSmall}>تفاصيل العميل</Text>{assignedDetails[sn]?.loading ? <Text style={styles.detail}>جاري تحميل تفاصيل العميل...</Text> : null}{assignedDetails[sn]?.error ? <><Text style={styles.errorText}>{assignedDetails[sn].error}</Text><Button title="إعادة تحميل التفاصيل" secondary onPress={()=>setAssignedDetails(current=>{const next={...current};delete next[sn];return next;})}/></> : null}{assignedDetails[sn]?.order ? <><Text style={styles.detailBold}>العميل: {assignedDetails[sn].order.clientName || 'عميل'}</Text><Text style={styles.detail}>الخدمة التفصيلية: {assignedDetails[sn].order.service || item.service || '—'}</Text><Text style={styles.detail}>المنطقة: {assignedDetails[sn].order.area || item.area || '—'}</Text><Text style={styles.detail}>العنوان بالتفصيل: {assignedDetails[sn].order.address || '—'}</Text><View style={styles.serviceDescriptionBox}><Text style={styles.serviceDescriptionLabel}>تفاصيل الشغل من العميل</Text><Text style={styles.serviceDescriptionText}>{assignedDetails[sn].order.description || item.description || 'لم يضف العميل تفاصيل إضافية.'}</Text></View><Text style={styles.detail}>السعر المقبول: {assignedDetails[sn].order.acceptedOfferPrice ?? item.price ?? '—'} جنيه</Text>{assignedDetails[sn].order.clientPhone ? <Button title="📞 اتصال بالعميل" secondary onPress={()=>Linking.openURL('tel:'+String(assignedDetails[sn].order.clientPhone).replace(/[^0-9+]/g,''))}/> : <Text style={styles.detail}>رقم العميل غير متاح حاليًا.</Text>}</> : null}</View> : null}
               {isAcceptedJob(item) && !isCompletedJob(item) ? <View style={styles.formCard}><Text style={styles.cardTitleSmall}>طلب زيادة السعر</Text><Text style={styles.detail}>السعر الحالي: {item.acceptedOfferPrice ?? item.client?.acceptedOfferPrice ?? item.priceNum ?? item.price ?? '—'} جنيه</Text><Field label="السعر الجديد بالجنيه" value={priceDrafts[sn]?.price || ''} onChangeText={value=>setPriceDrafts(current=>({...current,[sn]:{...(current[sn]||{}),price:value}}))} keyboardType="numeric" placeholder="السعر بعد الزيادة"/><Field label="سبب الزيادة" value={priceDrafts[sn]?.reason || ''} onChangeText={value=>setPriceDrafts(current=>({...current,[sn]:{...(current[sn]||{}),reason:value}}))} multiline placeholder="وضح سبب طلب الزيادة"/><Button title="إرسال طلب الزيادة" onPress={()=>requestOrderPriceChange(item)}/></View> : null}
               <View style={styles.roleActions}>{!isRejectedOffer(item) ? <Button title={orderChats[sn]?.open && String(orderChats[sn]?.targetOfferId||'')===String(item._id||item.offerId||item.id||'') ? 'إخفاء المحادثة' : 'محادثة'} secondary onPress={() => toggleOrderChat(item, 'fanni')} /> : null}{isAcceptedJob(item) && !isCompletedJob(item) ? <Button title="إنهاء الخدمة" onPress={() => completeTechnicianOrder(item)} /> : null}</View>
               {orderChats[sn]?.open && String(orderChats[sn]?.targetOfferId||'')===String(item._id||item.offerId||item.id||'') ? <View style={styles.chatPanelPremium}>{orderChats[sn]?.loading ? <Text style={styles.detail}>جاري تحميل المحادثة...</Text> : null}{orderChats[sn]?.error ? <Text style={styles.errorText}>{orderChats[sn].error}</Text> : null}{(orderChats[sn]?.messages||[]).length===0 && !orderChats[sn]?.loading && !orderChats[sn]?.error ? <Text style={styles.detail}>لا توجد رسائل في هذه المحادثة حتى الآن.</Text> : null}{(orderChats[sn]?.messages||[]).map((message,j)=><View key={String(message._id||j)} style={[styles.chatMessage, message.senderRole==='fanni' ? styles.chatMessageTechnician : styles.chatMessageClient]}><Text style={styles.detailSmall}>{message.senderRole==='fanni'?'أنت':'العميل'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}{(orderChats[sn]?.priceChangeRequests||[]).map(request=><View key={String(request._id||request.id)} style={styles.offerCardPremium}><Text style={styles.cardTitleSmall}>طلب زيادة السعر</Text><Text style={styles.detail}>السعر السابق: {request.oldPrice} جنيه • السعر المطلوب: {request.newPrice} جنيه</Text><Text style={styles.detail}>السبب: {request.reason||'—'}</Text><Text style={styles.detailBold}>{request.status==='قيد الموافقة'?'تم تقديم طلبك، في انتظار رد العميل.':request.status==='مقبول'?'وافق العميل على زيادة السعر.':request.status==='مرفوض'?'رفض العميل الزيادة؛ السعر السابق ما زال ساريًا.':'حالة الطلب: '+(request.status||'غير معروفة')}</Text></View>)}{!isAcceptedJob(item) && !isRejectedOffer(item) ? <View style={styles.roleActions}>{['نعم','لا','حسب الاتفاق'].map(reply=><Button key={reply} title={reply} secondary onPress={()=>sendOrderChat(item,reply)}/>)}</View> : null}{!isCompletedJob(item) ? <><Field label="رسالة للعميل" value={chatDrafts[sn]||''} onChangeText={value=>setChatDrafts(current=>({...current,[sn]:value}))} placeholder={item.accepted===true ? 'اكتب رسالة للعميل' : 'قبل القبول: نعم، لا، حسب الاتفاق'} returnKeyType="send" onSubmitEditing={() => sendOrderChat(item)} blurOnSubmit /><Button title="إرسال" onPress={()=>sendOrderChat(item)}/></> : null}</View> : null}
             </View>; }} />}
          {tab === 'wallet' && <ScrollView contentContainerStyle={styles.page}><View style={styles.walletCard}><Text style={styles.walletTitle}>المحفظة 💰</Text><Text style={styles.walletAmount}>{Number(user.walletBalance || user.balance || 0)} جنيه</Text><Text style={styles.detail}>التحويل على: 01152822263</Text></View><Field label="مبلغ الشحن" value={topup.amount} onChangeText={v => setTopup(t => ({ ...t, amount: v }))} keyboardType="numeric" /><Field label="رقم المحوّل" value={topup.fromPhone} onChangeText={v => setTopup(t => ({ ...t, fromPhone: v }))} keyboardType="phone-pad" /><Button title="إرسال طلب شحن" onPress={submitTopup} /></ScrollView>}
          {tab === 'profile' && <ScrollView contentContainerStyle={styles.page}><View style={styles.dataCard}><Text style={styles.cardTitlePremium}>{user.name || 'الفني'}</Text><Text style={styles.detail}>الهاتف: {user.phone || ''}</Text><Text style={styles.detail}>المستوى: {user.level || 'مبتدئ'}</Text><Text style={styles.detail}>الرصيد: {Number(user.walletBalance || 0)} جنيه</Text></View><Button title="تغيير كلمة المرور" onPress={() => setScreen('changePassword')} /></ScrollView>}
        </>}
      </View>
      {notificationsOpen ? <Modal transparent visible={notificationsOpen} animationType="fade" onRequestClose={() => setNotificationsOpen(false)}><View style={styles.notificationModalBackdrop}><TouchableOpacity style={styles.notificationModalDismiss} activeOpacity={1} onPress={() => setNotificationsOpen(false)} /><View style={styles.notificationModalCard}><View style={styles.notificationModalHeader}><Text style={styles.cardTitleSmall}>الإشعارات {notifications.unread ? `(${notifications.unread})` : ''}</Text><View style={styles.notificationHeaderActions}>{notifications.unread > 0 ? <Button title="قراءة الكل" secondary onPress={markAllNotificationsRead} /> : null}<Button title="إغلاق" secondary onPress={() => setNotificationsOpen(false)} /></View></View><ScrollView style={styles.notificationModalList} contentContainerStyle={styles.notificationListContent}>{notifications.loading ? <ActivityIndicator color={COLORS.teal} /> : notifications.items.length ? notifications.items.map((item,i)=><TouchableOpacity key={String(item._id||item.id||i)} onPress={()=>markNotificationRead(item)} style={[styles.notificationRow, (item.read || item.readAt) ? styles.notificationRead : styles.notificationUnread]}><Text style={[styles.cardTitleSmall, (item.read || item.readAt) && styles.notificationReadText]}>{item.title||'إشعار'}</Text><Text style={[(item.read || item.readAt) ? styles.notificationReadText : styles.detail]}>{item.message||''}</Text></TouchableOpacity>) : <Text style={styles.emptyText}>لا توجد إشعارات حاليًا.</Text>}</ScrollView></View></View></Modal> : null}
      <View pointerEvents="box-none" style={styles.floatingControls}><TouchableOpacity onPress={refreshVisibleData} style={styles.floatingButton}><Text style={styles.floatingIcon}>⟳</Text></TouchableOpacity><TouchableOpacity onPress={openWhatsAppSupport} style={[styles.floatingButton,styles.whatsappButton]}><Text style={styles.floatingWhatsApp}>🎧</Text></TouchableOpacity></View>
      {renderRatingModal('fanni')}
    </SafeAreaView>;
  }

  if (screen === 'support' && session && ['client', 'fanni'].includes(session.role)) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>دعم صُنّاع</Text></View><Button title="رجوع" secondary onPress={() => { screenHistoryRef.current.pop(); const target = session.role === 'client' ? 'client' : 'technician'; screenRef.current = target; setScreenState(target); setSupportCase(null); }} /></View>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.formCard}><Text style={styles.cardTitlePremium}>محادثة جديدة</Text><Field label="عنوان المشكلة" value={supportSubject} onChangeText={setSupportSubject} /><Field label="رسالتك" value={supportDraft} onChangeText={setSupportDraft} returnKeyType="send" onSubmitEditing={startSupportCase} blurOnSubmit /><Button title="إرسال وفتح محادثة الدعم" onPress={startSupportCase} disabled={supportLoading} /></View>
        {supportCases.map(item => <TouchableOpacity key={String(item._id)} onPress={() => openSupportCase(item)} style={styles.dataCard}><Text style={styles.cardTitleSmall}>{item.subject || 'استفسار عام'}</Text><Text style={styles.detail}>{dateLabel(item.lastMessageAt || item.createdAt)}</Text></TouchableOpacity>)}
        {supportCase ? <View style={styles.chatPanelPremium}><Text style={styles.sectionTitleSmall}>{supportCase.subject || 'محادثة الدعم'}</Text>{(supportCase.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}><Text style={styles.detailSmall}>{message.senderRole === 'admin' ? 'دعم صُنّاع' : 'أنت'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}<Field label="اكتب ردك" value={supportDraft} onChangeText={setSupportDraft} returnKeyType="send" onSubmitEditing={() => sendSupportMessage(false)} blurOnSubmit /><Button title="إرسال" onPress={() => sendSupportMessage(false)} /></View> : null}
      </ScrollView>
    </SafeAreaView>;
  }

  if (screen === 'admin' && session?.role === 'admin') {
    const tab = adminData.tab;
    const items = tab === 'levels' || tab === 'roles' ? adminData.fannis : adminData[tab] || [];
    const tabs = [{ key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' }, { key: 'clients', label: 'العملاء' }, { key: 'topups', label: 'الشحن' }, { key: 'complaints', label: 'الشكاوى' }, { key: 'support', label: 'الدعم' }];
    return <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitleSmall}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View><Button title="حسابي" secondary onPress={() => setScreen('account')} /><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRowPremium}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => { setAdminData(v => ({ ...v, tab: item.key })); if (item.key === 'support') loadAdminSupportCases(); }} style={[styles.pillPremium, tab === item.key && styles.pillPremiumActive]}><Text style={[styles.pillPremiumText, tab === item.key && styles.pillPremiumTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
      <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || item.sn || item.phone || i)} contentContainerStyle={styles.listPremium} ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات حاليًا.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitleSmall}>{item.name || item.sn || item.phone || 'عنصر'}</Text><Text style={styles.detail}>{item.status || item.phone || ''}</Text>{tab === 'orders' && item.status === 'قيد المراجعة' ? <Button title="نشر الطلب" onPress={() => publishOrder(item)} /> : null}{tab === 'fannis' && !item.isApproved && !item.isDisabled ? <View style={styles.roleActions}><Button title="اعتماد" onPress={() => moderateTechnician(item, 'approve')} /><Button title="رفض" secondary onPress={() => moderateTechnician(item, 'reject')} /></View> : null}</View>} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.homePage} showsVerticalScrollIndicator={false}>
      <View style={styles.homeBrandArea}>
        <View style={styles.homeLogoCirclePremium}>
          <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.homeLogoImage} resizeMode="contain" />
        </View>
        <Text style={styles.homeBrandTitlePremium}>صُنّاع</Text>
        <Text style={styles.homeTaglinePremium}>بنوصّل الخدمة بالفرصة</Text>
        <Text style={styles.homeIntroPremium}>خدماتك وشغلك في مكان واحد، بخطوات بسيطة وسريعة.</Text>
      </View>
      <View style={styles.roleCardsPremium}>
        <TouchableOpacity activeOpacity={0.88} onPress={() => goLogin('client')} style={[styles.roleCardPremium, styles.clientRoleCardPremium]}>
          <View style={styles.clientIconCirclePremium}><Text style={styles.roleIconPremium}>⌂</Text></View>
          <View style={styles.roleCardCopy}><Text style={styles.roleTitlePremium}>الدخول كعميل</Text><Text style={styles.roleDescriptionPremium}>اطلب الخدمة اللي محتاجها وتابع عروض الفنيين بسهولة.</Text><View style={styles.roleActionBadge}><Text style={styles.roleActionBadgeText}>اطلب الآن ←</Text></View></View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.88} onPress={() => goLogin('fanni')} style={[styles.roleCardPremium, styles.technicianRoleCardPremium]}>
          <View style={styles.technicianIconCirclePremium}><Text style={styles.roleIconPremium}>⚒</Text></View>
          <View style={styles.roleCardCopy}><Text style={styles.roleTitlePremium}>الدخول كفني</Text><Text style={styles.roleDescriptionPremium}>استقبل الطلبات وقدّم عروضك وتابع مكسبك.</Text><View style={[styles.roleActionBadge, {backgroundColor:'#0F172A'}]}><Text style={styles.roleActionBadgeText}>شوف فرص الشغل ←</Text></View></View>
        </TouchableOpacity>
      </View>
      <View style={styles.homeFooterPremium}><View style={styles.homeFooterDot} /><Text style={styles.homeFooterText}>اختار طريقة الدخول وابدأ مع صُنّاع</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function getServiceEmoji(service) {
  const value = String(service || '');
  if (/تسريب|حنفي|صنبور|مياه|صرف|بالوعة|سيفون|سخان|خلاط/.test(value)) return '🚰';
  if (/كهرب|لمبة|نجفة|مفتاح|فيشة|كهرباء|إنارة|كشاف/.test(value)) return '💡';
  if (/تكييف|تبريد|فريون/.test(value)) return '❄️';
  if (/غسالة|ثلاجة|بوتاجاز|فرن|ميكروويف/.test(value)) return '🧰';
  if (/دهان|نقاشة|طلاء|لون/.test(value)) return '🖌️';
  if (/نجارة|باب|دولاب|مطبخ|خشب|مفصلات/.test(value)) return '🪚';
  if (/قفل|مفتاح|كالون/.test(value)) return '🔑';
  if (/شاشة|كاميرا|دش|ريسيفر|تلفزيون/.test(value)) return '📺';
  if (/تنظيف|تطهير|مكافحة/.test(value)) return '🧹';
  if (/تركيب|فك|تثبيت|صيانة|إصلاح|تصليح/.test(value)) return '🔧';
  if (/بناء|محارة|طوب|سيراميك|بلاط|رخام/.test(value)) return '🧱';
  return '🛠️';
}

// ===================== WOW PREMIUM STYLES - هيدر صغير ثابت + تصميم بريميوم =====================
const styles = StyleSheet.create({
  appRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  brandHeaderSafe: { backgroundColor: '#FFFFFF' },
  // FIXED COMPACT HEADER - لا ياخذ نص الشاشة
  brandHeader: { height: 48, minHeight: 48, maxHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  brandHeaderLogo: { width: 30, height: 30 },
  brandHeaderTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginLeft: 8, letterSpacing: 0.3 },
  appScreenArea: { flex: 1 },

  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  page: { padding: 14, paddingBottom: 28, gap: 10, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  
  // CLIENT HEADER PREMIUM - اسم صغير
  clientHeader: { height: 56, minHeight: 56, maxHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  clientHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  clientHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clientAvatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  clientHeaderInfo: { flex: 1 },
  clientNameSmall: { color: '#0F172A', fontSize: 13, fontWeight: '800', textAlign: 'right', lineHeight: 16 },
  clientRoleSmall: { color: '#64748B', fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 1 },

  bellButtonSmall: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  bellBadgeDot: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },

  // HOME PREMIUM
  homePage: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, gap: 18, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  homeBrandArea: { alignItems: 'center', paddingBottom: 2 },
  homeLogoCirclePremium: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4, marginBottom: 12 },
  homeLogoImage: { width: 68, height: 68, alignSelf: 'center' },
  homeBrandTitlePremium: { color: '#0F172A', fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  homeTaglinePremium: { color: '#0D9488', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  homeIntroPremium: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 6, paddingHorizontal: 12 },
  roleCardsPremium: { flexDirection: 'column', gap: 12, marginTop: 8 },
  roleCardPremium: { width: '100%', minHeight: 110, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  clientRoleCardPremium: { borderRightWidth: 4, borderRightColor: '#0D9488', backgroundColor: '#F0FDFA' },
  technicianRoleCardPremium: { borderRightWidth: 4, borderRightColor: '#0F172A', backgroundColor: '#F8FAFC' },
  clientIconCirclePremium: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99F6E4' },
  technicianIconCirclePremium: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  roleIconPremium: { fontSize: 22, color: '#0F172A', fontWeight: '800' },
  roleCardCopy: { flex: 1, gap: 4, justifyContent: 'center' },
  roleTitlePremium: { color: '#0F172A', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  roleDescriptionPremium: { color: '#64748B', fontSize: 12, textAlign: 'right', lineHeight: 18, marginTop: 2 },
  roleActionBadge: { alignSelf: 'flex-end', backgroundColor: '#0D9488', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6 },
  roleActionBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  homeFooterPremium: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  homeFooterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0D9488' },
  homeFooterText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },

  // LOGIN PREMIUM
  loginSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  loginPage: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, justifyContent: 'center', gap: 10 },
  loginBackButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  loginBackText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  loginLogoCircle: { width: 88, height: 88, borderRadius: 22, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 2 },
  loginLogo: { width: 62, height: 62 },
  loginTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  loginSubtitle: { color: '#64748B', marginTop: 4, textAlign: 'center', lineHeight: 20, fontSize: 13 },
  loginForm: { width: '100%', gap: 4, marginTop: 8 },
  recoveryLink: { alignSelf: 'flex-end', paddingVertical: 6 },
  recoveryLinkText: { color: '#0D9488', fontSize: 13, fontWeight: '800' },
  loginGradientButton: { minHeight: 50, borderRadius: 14, marginVertical: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', elevation: 3 },
  loginGradientButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  loginHeading: { alignItems: 'center', gap: 2, marginVertical: 6 },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.navy, textAlign: 'right' },
  subtitleSmall: { color: COLORS.muted, marginTop: 2, textAlign: 'right', fontSize: 12, lineHeight: 16 },

  // BUTTONS PREMIUM
  button: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 3, minHeight: 44, borderWidth: 1, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  buttonPrimary: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  buttonText: { fontWeight: '800', fontSize: 13, textAlign: 'center' },
  buttonPrimaryText: { color: '#FFFFFF' },
  buttonSecondaryText: { color: '#0F172A' },
  disabledButton: { opacity: 0.5 },

  // FIELDS
  fieldWrap: { marginVertical: 5 },
  fieldLabel: { color: '#0F172A', fontWeight: '800', marginTop: 6, marginBottom: 5, textAlign: 'right', fontSize: 13 },
  fieldLabelPremium: { color: '#0F172A', fontWeight: '900', marginTop: 14, marginBottom: 8, textAlign: 'right', fontSize: 14, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-end' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#0F172A', fontSize: 14, minHeight: 46 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },

  // SERVICE TILES WOW
  serviceTilesPremium: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginHorizontal: -4, marginBottom: 10 },
  serviceTilePremium: { width: '31.3%', minHeight: 96, marginHorizontal: '1%', marginBottom: 8, paddingHorizontal: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  detailTilePremium: { minHeight: 84, backgroundColor: '#F8FAFC' },
  serviceTilePremiumSelected: { backgroundColor: '#0F172A', borderColor: '#0F172A', shadowOpacity: 0.15, elevation: 3 },
  serviceIconCircle: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  serviceIconCircleSmall: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  serviceIconCircleSelected: { backgroundColor: 'rgba(255,255,255,0.15)' },
  serviceTileIcon: { fontSize: 20, textAlign: 'center' },
  serviceTileIconSmall: { fontSize: 16, textAlign: 'center' },
  serviceTileLabelPremium: { color: '#0F172A', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  serviceTileLabelPremiumSmall: { color: '#334155', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  serviceTileLabelPremiumSelected: { color: '#FFFFFF' },

  // CARDS PREMIUM
  welcomeCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 14, marginBottom: 6, flexDirection: 'column', gap: 3 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  welcomeSub: { color: '#94A3B8', fontSize: 12, textAlign: 'right', marginTop: 2 },
  formCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 12, marginVertical: 6, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  dataCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, marginVertical: 5, shadowColor: '#0F172A', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  orderCardPremium: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 0, marginVertical: 6, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  orderCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: '#FFFFFF' },
  orderCardBody: { padding: 12, backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotPending: { backgroundColor: '#F59E0B' },
  statusDotDone: { backgroundColor: '#10B981' },
  cardTitlePremium: { color: '#0F172A', fontSize: 14, fontWeight: '900', textAlign: 'right', flex: 1 },
  cardTitleSmall: { color: '#0F172A', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  orderStatusSmall: { color: '#64748B', fontSize: 11, textAlign: 'right', marginTop: 2 },
  expandIcon: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  offerCardPremium: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, marginTop: 8 },
  chatPanelPremium: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, marginTop: 10 },
  detail: { color: '#475569', marginTop: 4, textAlign: 'right', lineHeight: 19, fontSize: 13 },
  detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  detailValue: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  detailValueGold: { color: '#0D9488', fontSize: 13, fontWeight: '900' },
  detailSmall: { color: '#94A3B8', fontSize: 11, textAlign: 'right', marginTop: 2 },
  serviceDescriptionBox: { backgroundColor: '#EFF6FF', borderRightWidth: 4, borderRightColor: '#2563EB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8, marginBottom: 6 },
  serviceDescriptionLabel: { color: '#1D4ED8', fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  serviceDescriptionText: { color: '#0F172A', fontSize: 18, fontWeight: '600', lineHeight: 28, textAlign: 'right' },
  detailBold: { color: '#0F172A', fontSize: 13, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  sectionTitleSmall: { color: '#0F172A', fontSize: 13, fontWeight: '900', textAlign: 'right', marginTop: 10, marginBottom: 4 },
  sectionTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900', textAlign: 'right', marginTop: 12, marginBottom: 6 },
  errorText: { color: '#DC2626', textAlign: 'right', marginVertical: 6, fontSize: 12, lineHeight: 18 },
  successText: { color: '#059669', fontWeight: '900', textAlign: 'right', fontSize: 13 },

  // TABS PREMIUM
  tabRowPremium: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginVertical: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  pillPremium: { borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 7, marginVertical: 2 },
  pillPremiumActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  pillPremiumText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  pillPremiumTextActive: { color: '#FFFFFF' },
  tabRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginVertical: 8, paddingHorizontal: 10 },
  pill: { borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, marginVertical: 2 },
  pillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  pillText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#FFFFFF' },

  // WALLET
  walletCard: { backgroundColor: '#0F172A', borderRadius: 20, padding: 18, marginVertical: 8, alignItems: 'center' },
  walletTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  walletAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 6, textAlign: 'center' },

  // NOTIFICATIONS PREMIUM
  bellButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  bellText: { fontSize: 18 },
  notificationPopupPremium: { position: 'absolute', zIndex: 20, top: 60, right: 10, left: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 12, elevation: 10, maxHeight: 360 },
  notificationModalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 14, paddingTop: 72 },
  notificationModalDismiss: { ...StyleSheet.absoluteFillObject },
  notificationModalCard: { width: '100%', maxWidth: 440, maxHeight: '72%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18, padding: 12, elevation: 16 },
  notificationModalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8 },
  notificationHeaderActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  notificationModalList: { flexGrow: 0, maxHeight: 420 },
  notificationRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, marginVertical: 2 },
  notificationUnread: { backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  notificationRead: { backgroundColor: '#F8FAFC', opacity: 0.62 },
  notificationReadText: { color: '#64748B' },
  notificationPopup: { position: 'absolute', zIndex: 20, top: 60, right: 10, left: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 10, elevation: 10 },
  notificationList: { maxHeight: 280 },
  notificationListContent: { paddingBottom: 4 },
  floatingControls: { position: 'absolute', left: 14, right: 14, bottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floatingButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  floatingIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  whatsappButton: { backgroundColor: '#10B981' },
  floatingWhatsApp: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  codeRowPremium: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 12, padding: 10, marginVertical: 6 },
  codeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  roleActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  chatPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 10, marginTop: 10 },
  chatMessage: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 8, marginVertical: 3 },
  chatMessageClient: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  chatMessageTechnician: { backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' },
  chatMessageText: { color: '#0F172A', textAlign: 'right', lineHeight: 20, marginTop: 3, fontSize: 13 },
  selectionGroup: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 12, padding: 10, marginVertical: 4 },
  groupTitle: { color: '#0F172A', fontWeight: '800', textAlign: 'right', fontSize: 13 },
  choiceRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  choiceText: { color: '#334155', textAlign: 'right', fontSize: 13 },
  headerRow: { padding: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  statusText: { marginTop: 10, color: '#64748B', textAlign: 'center', fontSize: 13 },
  listPremium: { paddingHorizontal: 10, paddingBottom: 16, gap: 2 },
  list: { paddingHorizontal: 10, paddingBottom: 16 },
  emptyText: { textAlign: 'center', color: '#94A3B8', padding: 24, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 20 },
  ratingModal: { alignSelf: 'center', width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', maxHeight: '82%' },
  ratingStarsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginVertical: 10 },
  ratingStarButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  ratingStar: { fontSize: 24, color: '#CBD5E1' },
  ratingStarActive: { color: '#F59E0B' },
  offerCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12, marginTop: 8 },
  categoryToggle: { paddingVertical: 5 },
});

class StartupErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Sonaa startup render error:', error, info?.componentStack); }
  render() {
    if (this.state.error) {
      return <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0F172A', textAlign: 'right', marginBottom: 12 }}>تعذر تشغيل شاشة صُنّاع</Text>
        <Text selectable style={{ color: '#B91C1C', textAlign: 'left', marginBottom: 20 }}>{String(this.state.error?.message || this.state.error)}</Text>
        <TouchableOpacity onPress={() => this.setState({ error: null })} style={{ backgroundColor: '#0F172A', padding: 14, borderRadius: 12, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>إعادة المحاولة</Text></TouchableOpacity>
      </SafeAreaView>;
    }
    return this.props.children;
  }
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [showSplash, setShowSplash] = useState(true);
  const spin = useRef(new Animated.Value(0)).current;
  const showBrandHeader = !['home', 'login'].includes(currentScreen);

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => { animation.stop(); clearTimeout(timer); };
  }, [spin]);

  const spinRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return <View style={styles.appRoot}>
    {showBrandHeader ? <SafeAreaView style={styles.brandHeaderSafe}>
      <View style={styles.brandHeader}>
        <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.brandHeaderLogo} resizeMode="contain" />
        <Text style={styles.brandHeaderTitle}>صُنّاع</Text>
      </View>
    </SafeAreaView> : null}
    <View style={styles.appScreenArea}><AppScreens onScreenChange={setCurrentScreen} /></View>
    {showSplash ? <View style={splashStyles.overlay}>
      <View style={splashStyles.logoFrame}>
        <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={splashStyles.logo} resizeMode="contain" />
        <View pointerEvents="none" style={splashStyles.wordOrbit}>
          <Animated.Text style={[splashStyles.spinningWord, { transform: [{ rotate: spinRotation }] }]}>صُنّاع</Animated.Text>
        </View>
      </View>
      <Text style={splashStyles.title}>صُنّاع</Text>
      <Text style={splashStyles.caption}>كل خدمة تبدأ بخطوة</Text>
      <View style={splashStyles.loadingTrack}><View style={splashStyles.loadingFill} /></View>
    </View> : null}
  </View>;
}

const splashStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logoFrame: { width: 140, height: 140, borderRadius: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 16, elevation: 5, overflow: 'hidden' },
  logo: { width: 96, height: 96 },
  wordOrbit: { position: 'absolute', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  spinningWord: { color: '#0D9488', fontSize: 18, fontWeight: '900', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 5, borderRadius: 8 },
  title: { marginTop: 20, color: '#0F172A', fontSize: 26, fontWeight: '900' },
  caption: { marginTop: 6, color: '#0D9488', fontSize: 13, fontWeight: '700' },
  loadingTrack: { marginTop: 22, width: 120, height: 4, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  loadingFill: { width: '65%', height: '100%', backgroundColor: '#0D9488', borderRadius: 3 },
});

export default function App() {
  return <SafeAreaProvider><StartupErrorBoundary><AppContent /></StartupErrorBoundary></SafeAreaProvider>;
} 