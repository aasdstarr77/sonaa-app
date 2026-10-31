import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import {
  View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
  TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, BackHandler, Linking, Modal
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { API_BASE, api } from '../services/api';
import { COLORS } from '../theme/colors';
import { styles } from '../theme/styles';
import { getOrderChatTimeline, toList, dateLabel, getServiceEmoji } from '../utils/app-helpers';
import { Button, Field } from '../components/FormControls';
import VoiceRecorder from '../components/VoiceRecorder';
import VoicePlayback from '../components/VoicePlayback';
import { LoginScreen, ChangePasswordScreen, PasswordRecoveryScreen } from './auth/AuthScreens';
import { AccountScreen, ProfileEditScreen } from './account/AccountScreens';
import { SupportScreen } from './support/SupportScreen';
import { AdminDashboard } from './admin/AdminDashboard';
import { ClientDashboard } from './client/ClientDashboard';
import { TechnicianDashboard } from './technician/TechnicianDashboard';
import { useAppState } from '../hooks/useAppState';
import { useScreenNavigation } from '../hooks/useScreenNavigation';
import { usePushNotifications } from '../hooks/usePushNotifications';

function AppScreens({ onScreenChange }) {
  const { screen, setScreenState, screenHistoryRef, screenRef, setScreen } = useScreenNavigation(onScreenChange);
  const appState = useAppState();
  const { categories, setCategories, selected, setSelected, servicesLoading, setServicesLoading, servicesError, setServicesError, reloadKey, setReloadKey, session, setSession, authRestoring, setAuthRestoring, username, setUsername, password, setPassword, loginLoading, setLoginLoading, authMode, setAuthMode, form, setForm, clientData, setClientData, techData, setTechData, walletTransferNumbers, setWalletTransferNumbers, assignedDetails, setAssignedDetails, technicianSearch, setTechnicianSearch, technicianServiceFilter, setTechnicianServiceFilter, guidelinesChecked, setGuidelinesChecked, guidelinesReachedEnd, setGuidelinesReachedEnd, guidelinesViewportHeight, setGuidelinesViewportHeight, adminData, setAdminData, topup, setTopup, clientTab, setClientTab, clientServiceSearch, setClientServiceSearch, servicePickerOpen, setServicePickerOpen, subservicePickerOpen, setSubservicePickerOpen, ratingPrompt, setRatingPrompt, dismissedRatings, setDismissedRatings, ratingDismissalsLoaded, setRatingDismissalsLoaded, ratingDismissalsLoadedFor, setRatingDismissalsLoadedFor, clientTrackSN, setClientTrackSN, clientTrackedOrder, setClientTrackedOrder, clientTrackError, setClientTrackError, clientTrackLoading, setClientTrackLoading, clientComplaint, setClientComplaint, clientComplaintTrack, setClientComplaintTrack, expandedClientOrders, setExpandedClientOrders, expandedTechnicianOrders, setExpandedTechnicianOrders, notificationsOpen, setNotificationsOpen, offerDraft, setOfferDraft, notifications, setNotifications, orderChats, setOrderChats, chatDrafts, setChatDrafts, priceDrafts, setPriceDrafts, ratingDrafts, setRatingDrafts, ratingSubmitting, setRatingSubmitting, adminUsers, setAdminUsers, adminExtras, setAdminExtras, adminServiceDraft, setAdminServiceDraft, adminServiceEdit, setAdminServiceEdit, adminRegionDraft, setAdminRegionDraft, adminAnnouncementDraft, setAdminAnnouncementDraft, adminFaqDraft, setAdminFaqDraft, adminReportFilters, setAdminReportFilters, adminWallet, setAdminWallet, adminUsersLoading, setAdminUsersLoading, broadcast, setBroadcast, supportCases, setSupportCases, supportCase, setSupportCase, supportDraft, setSupportDraft, supportSubject, setSupportSubject, supportLoading, setSupportLoading, supportError, setSupportError, accountPasswordForm, setAccountPasswordForm, profileEditForm, setProfileEditForm, profileEditOpenCategory, setProfileEditOpenCategory, recoveryForm, setRecoveryForm, adminSupportCases, setAdminSupportCases, adminSupportSelected, setAdminSupportSelected, adminSupportDraft, setAdminSupportDraft, adminRecoveryCases, setAdminRecoveryCases, adminRecoverySelected, setAdminRecoverySelected, adminRecoveryCode, setAdminRecoveryCode, adminRecoveryDraft, setAdminRecoveryDraft, registrationNameRef, registrationPhoneRef, registrationPasswordRef, registrationConfirmPasswordRef, clientAreaInputRef, clientAddressInputRef, clientDescriptionInputRef, clientBudgetInputRef, clientServiceDetailYRef, clientFormYRef, clientScrollRef, chatScrollRef, clientChatScrollRefs, clientChatAtBottomRef, ratingSubmittingRef, orderChatsRef, acceptedChatAutoOpenedRef, dismissedRatingsRef, ratingHandledRef, ratingStatusSnapshotRef, services, updateForm } = appState;
  const pushTokenRef = usePushNotifications(session);


  useEffect(() => {
    if (screen !== 'technician' || techData.tab !== 'wallet' || session?.role !== 'fanni') return;
    let active = true;
    (async () => {
      try {
        const result = await api('/wallet-settings', { timeoutMs: 15000 });
        if (active) setWalletTransferNumbers({
          walletPhone1: String(result?.walletPhone1 || '').trim(),
          walletPhone2: String(result?.walletPhone2 || '').trim(),
        });
      } catch (error) {
        if (active) setWalletTransferNumbers({ walletPhone1: '', walletPhone2: '' });
      }
    })();
    return () => { active = false; };
  }, [screen, techData.tab, session?.role, reloadKey]);
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
    if (!['client', 'clientRegister', 'technicianRegister', 'profileEdit'].includes(screen)) return;
    let mounted = true;
    async function loadPublicData() {
      setServicesLoading(true); setServicesError('');
      try {
        const serviceResult = await api('/services');
        if (!Array.isArray(serviceResult.categories) || serviceResult.categories.length === 0) throw new Error('قائمة الخدمات من الخادم غير متاحة حاليًا');
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
        orders: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['orders'])) : [],
        offers: results[2].status === 'fulfilled' ? uniqueByOrderSN(toList(results[2].value, ['offers'])) : [],
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
      if (role === 'client') setClientTab('new');
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
      setClientTab('new');
      setScreen('client');
    } catch (err) { Alert.alert('تعذر إنشاء الحساب', err.message || 'راجع البيانات وحاول مرة أخرى.'); }
    finally { setLoginLoading(false); }
  }

  async function registerTechnician() {
    if (form.password !== form.confirmPassword) { Alert.alert('كلمة السر', 'كلمتا السر غير متطابقتين.'); return; }
    if (!form.specialties.length) { Alert.alert('بيانات ناقصة', 'اختار خدمة واحدة على الأقل.'); return; }
    const areas = [...new Set(String(form.areas || '').split(/[,،\n]/).map(area => area.trim()).filter(Boolean))];
    if (!areas.length || areas.some(area => area.length < 2 || area.length > 60) || areas.length > 30) {
      Alert.alert('مناطق العمل', 'اكتب منطقة عمل واحدة على الأقل. افصل بين المناطق بفاصلة، وكل منطقة من حرفين إلى 60 حرفًا، وبحد أقصى 30 منطقة.');
      return;
    }
    if (!guidelinesReachedEnd) {
      Alert.alert('ميثاق صُنّاع', 'لازم تقرأ الميثاق حتى آخره قبل الموافقة.');
      return;
    }
    if (!guidelinesChecked) {
      Alert.alert('الموافقة مطلوبة', 'علّم على مربع قرأت وأوافق على ميثاق صُنّاع لإكمال التسجيل.');
      return;
    }
    setLoginLoading(true);
    try {
      const result = await api('/fanni/register', { method: 'POST', body: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        specialties: form.specialties,
        areas,
        guidelinesAccepted: true
      } });
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
      if (description.length < 10 && !form.voiceRecordingData) {
        Alert.alert('تفاصيل الخدمة مطلوبة', 'اكتب وصفًا من 10 أحرف على الأقل أو سجّل وصف الطلب صوتيًا.');
        setLoginLoading(false);
        return;
      }
      const orderBody = { clientName: String(session.user?.name || form.name || '').trim(), phone: String(session.user?.phone || form.phone || '').trim(), service: form.service, area: form.area.trim(), address: form.address.trim(), description, ...(form.voiceRecordingData ? { voiceRecordingData: form.voiceRecordingData } : {}), budget: form.budget.trim() };
      const result = await api('/orders', { method: 'POST', token: session.token, body: orderBody });
      setClientData(current => ({ ...current, sn: result.sn || result.order?.sn || '', clientToken: result.clientToken || '' }));
      setClientTab('current');
      setForm(current => ({ ...current, area: '', address: '', description: '', voiceRecordingData: '', budget: '' }));
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

  function getOrderSN(order) { return String(order?.orderSn || order?.sn || order?.order?.orderSn || order?.order?.sn || order?.serialNumber || '').trim().toUpperCase(); }
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
    const refreshTechnicianData = async () => { if (busy) return; busy = true; try { const results = await Promise.allSettled([api('/orders/available', { token: session.token }), api('/orders/my-offers', { token: session.token }), api('/fanni/wallet/history', { token: session.token })]); if (active) setTechData(current => ({ ...current, orders: results[0].status === 'fulfilled' ? uniqueByOrderSN(toList(results[0].value, ['orders'])) : current.orders, offers: results[1].status === 'fulfilled' ? uniqueByOrderSN(toList(results[1].value, ['offers'])) : current.offers, wallet: results[2].status === 'fulfilled' ? toList(results[2].value, ['history', 'transactions', 'requests']) : current.wallet })); } catch {} finally { busy = false; } };
    const timer = setInterval(refreshTechnicianData, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [session, screen]);

  useEffect(() => {
    const isCompletedStatus = value => ['تم الانتهاء', 'منتهي', 'مكتمل', 'مكتملة', 'completed', 'complete', 'finished'].includes(String(value || '').trim().toLowerCase());
    const snapshots = ratingStatusSnapshotRef.current;
    const nextSnapshots = { client: {}, fanni: {} };
    let candidate = null;
    for (const role of ['client', 'fanni']) {
      const items = role === 'client' ? clientData.orders : techData.offers;
      for (const order of items) {
        const sn = getOrderSN(order);
        if (!sn) continue;
        const status = String(role === 'client' ? (order.status || order.orderStatus || '') : (order.orderStatus || order.status || '')).trim();
        const previousStatus = snapshots[role]?.[sn];
        const alreadyRated = role === 'client'
          ? Boolean(order.myRating || order.clientRating || order.ratingByClient || (order.ratings || []).some(r => r.reviewerRole === 'client'))
          : Boolean(order.myRating || order.fanniRating || order.ratingByFanni || (order.ratings || []).some(r => r.reviewerRole === 'fanni'));
        const activeRole = (role === 'client' && screen === 'client' && session?.role === 'client') || (role === 'fanni' && screen === 'technician' && session?.role === 'fanni');
        if (!candidate && activeRole && previousStatus && !isCompletedStatus(previousStatus) && isCompletedStatus(status) && !alreadyRated && !ratingHandledRef.current.has(`${ratingStorageKey}:${sn}`)) {
          candidate = { role, order };
        }
        nextSnapshots[role][sn] = status;
      }
    }
    ratingStatusSnapshotRef.current = nextSnapshots;
    if (candidate) setRatingPrompt(current => current || candidate);
  }, [session?.role, screen, clientData.orders, techData.offers, ratingStorageKey]);

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

  function renderRatingStars(order, selectedStars, compact = false) {
    return <View style={[styles.ratingStarsRow, compact && styles.ratingStarsRowCompact]}>
      {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`تقييم ${value} من 5`} onPress={() => setOrderRatingStars(order, value)} style={[styles.ratingStarButton, compact && styles.ratingStarButtonCompact]}>
        <Text style={[styles.ratingStar, compact && styles.ratingStarCompact, selectedStars >= value && styles.ratingStarActive]}>★</Text>
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
    const stars = Number(draft.stars || 5), comment = '', blockFuture = false;
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

  function renderRatingModal(role) {
    if (!ratingPrompt || ratingPrompt.role !== role) return null;
    const order = ratingPrompt.order;
    const sn = getOrderSN(order);
    if (!order || typeof order !== 'object' || !sn) return null;
    const draft = ratingDrafts[sn] || { stars: '5', comment: '', blockFuture: false };
    const stars = Number(draft.stars || 5);
    const submitting = Boolean(ratingSubmitting[sn]);
    return <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingModal}>
          <Text style={styles.title}>{role === 'client' ? 'قيّم الفني' : 'قيّم العميل'}</Text>
          <Text style={styles.detail}>انتهت الخدمة {sn}. اختار عدد النجوم واضغط «تقييم».</Text>
          <View style={styles.ratingSubmitRow}>
            <TouchableOpacity accessibilityRole="button" onPress={() => submitOrderRating(order)} disabled={submitting} style={[styles.ratingSubmitButton, submitting && styles.disabledButton]}>
              <Text style={styles.ratingSubmitButtonText}>{submitting ? '...' : 'تقييم'}</Text>
            </TouchableOpacity>
            {renderRatingStars(order, stars, true)}
          </View>
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

  function beginProfileEdit() {
    const user = session?.role === 'fanni' ? (techData.profile || session.user || {}) : (session?.user || {});
    setProfileEditForm({ name: String(user.name || ''), phone: String(user.phone || ''), areas: Array.isArray(user.areas) ? user.areas.join('، ') : '', specialties: Array.isArray(user.specialties) ? [...user.specialties] : [], loading: false, error: '', message: user.pendingProfileChange?.requestedAt ? 'لديك طلب تعديل بيانات قيد مراجعة الإدارة.' : '' });
    setProfileEditOpenCategory(''); setScreen('profileEdit');
  }
  function toggleProfileEditSpecialty(specialty) {
    setProfileEditForm(current => {
      if (current.specialties.includes(specialty)) return { ...current, specialties: current.specialties.filter(item => item !== specialty), error: '' };
      if (current.specialties.length >= 20) return { ...current, error: 'يمكنك اختيار 20 تخصصًا كحد أقصى.' };
      return { ...current, specialties: [...current.specialties, specialty], error: '' };
    });
  }
  async function saveProfileEdits() {
    if (!session || profileEditForm.loading) return;
    const phone = String(profileEditForm.phone || '').replace(/[^0-9]/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) { setProfileEditForm(current => ({ ...current, error: 'رقم الهاتف لازم يكون 11 رقمًا ويبدأ بـ 01.' })); return; }
    if (session.role === 'client') {
      const name = String(profileEditForm.name || '').trim();
      if (name.length < 2 || name.length > 50) { setProfileEditForm(current => ({ ...current, error: 'اكتب الاسم بشكل صحيح (من حرفين إلى 50 حرفًا).' })); return; }
      setProfileEditForm(current => ({ ...current, loading: true, error: '', message: '' }));
      try { const result = await api('/client/me', { method: 'PATCH', token: session.token, body: { name, phone } }); const nextSession = { ...session, user: { ...session.user, ...(result.client || { name, phone }) } }; await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(nextSession)); setSession(nextSession); setProfileEditForm(current => ({ ...current, loading: false, error: '', message: result.message || 'تم تحديث بيانات حسابك بنجاح.' })); }
      catch (error) { setProfileEditForm(current => ({ ...current, loading: false, error: error.message || 'تعذر حفظ البيانات.' })); }
      return;
    }
    if (session.role !== 'fanni') return;
    if (session.user?.pendingProfileChange?.requestedAt || techData.profile?.pendingProfileChange?.requestedAt) { setProfileEditForm(current => ({ ...current, error: 'لديك طلب تعديل بيانات قيد مراجعة الإدارة. انتظر القرار قبل إرسال طلب جديد.' })); return; }
    const specialties = [...new Set(profileEditForm.specialties.map(value => String(value).trim()).filter(Boolean))];
    const areas = [...new Set(String(profileEditForm.areas || '').split(/[،,؛;\n]/).map(value => value.trim()).filter(value => value.length >= 2))];
    if (!areas.length || areas.length > 30 || areas.some(area => area.length > 60)) { setProfileEditForm(current => ({ ...current, error: 'اكتب منطقة عمل واحدة على الأقل، وكل منطقة لا تزيد عن 60 حرفًا.' })); return; }
    setProfileEditForm(current => ({ ...current, loading: true, error: '', message: '' }));
    try { const result = await api('/fanni/me', { method: 'PATCH', token: session.token, body: { phone, specialties, areas } }); const updatedUser = result.user || { ...session.user, pendingProfileChange: result.pendingProfileChange }; const nextSession = { ...session, user: { ...session.user, ...updatedUser, pendingProfileChange: result.pendingProfileChange || updatedUser.pendingProfileChange } }; await SecureStore.setItemAsync('sonaa.auth.session.v1', JSON.stringify(nextSession)); setSession(nextSession); setTechData(current => ({ ...current, profile: { ...(current.profile || session.user), ...updatedUser, pendingProfileChange: result.pendingProfileChange || updatedUser.pendingProfileChange } })); setProfileEditForm(current => ({ ...current, loading: false, error: '', message: result.message || 'تم إرسال طلب تعديل بياناتك للإدارة للمراجعة.' })); }
    catch (error) { setProfileEditForm(current => ({ ...current, loading: false, error: error.message || 'تعذر إرسال طلب تعديل البيانات.' })); }
  }
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

  const goLogin = mode => { setAuthMode(mode); setUsername(''); setPassword(''); setScreen('login'); };
  const toggleArray = (key, value) => updateForm(key, form[key].includes(value) ? form[key].filter(item => item !== value) : [...form[key], value]);

  const screenContext = { screen, setScreenState, screenHistoryRef, screenRef, pushTokenRef, setScreen, categories, setCategories, selected, setSelected, servicesLoading, setServicesLoading, servicesError, setServicesError, reloadKey, setReloadKey, session, setSession, authRestoring, setAuthRestoring, username, setUsername, password, setPassword, loginLoading, setLoginLoading, authMode, setAuthMode, form, setForm, registrationNameRef, registrationPhoneRef, registrationPasswordRef, registrationConfirmPasswordRef, clientAreaInputRef, clientAddressInputRef, clientDescriptionInputRef, clientBudgetInputRef, clientServiceDetailYRef, clientFormYRef, clientData, setClientData, techData, setTechData, walletTransferNumbers, setWalletTransferNumbers, assignedDetails, setAssignedDetails, technicianSearch, setTechnicianSearch, technicianServiceFilter, setTechnicianServiceFilter, guidelinesChecked, setGuidelinesChecked, guidelinesReachedEnd, setGuidelinesReachedEnd, guidelinesViewportHeight, setGuidelinesViewportHeight, adminData, setAdminData, topup, setTopup, clientTab, setClientTab, clientServiceSearch, setClientServiceSearch, servicePickerOpen, setServicePickerOpen, subservicePickerOpen, setSubservicePickerOpen, ratingPrompt, setRatingPrompt, dismissedRatings, setDismissedRatings, ratingDismissalsLoaded, setRatingDismissalsLoaded, ratingDismissalsLoadedFor, setRatingDismissalsLoadedFor, clientTrackSN, setClientTrackSN, clientTrackedOrder, setClientTrackedOrder, clientTrackError, setClientTrackError, clientTrackLoading, setClientTrackLoading, clientComplaint, setClientComplaint, clientComplaintTrack, setClientComplaintTrack, expandedClientOrders, setExpandedClientOrders, expandedTechnicianOrders, setExpandedTechnicianOrders, notificationsOpen, setNotificationsOpen, clientScrollRef, chatScrollRef, clientChatScrollRefs, clientChatAtBottomRef, ratingSubmittingRef, offerDraft, setOfferDraft, notifications, setNotifications, orderChats, setOrderChats, orderChatsRef, acceptedChatAutoOpenedRef, chatDrafts, setChatDrafts, priceDrafts, setPriceDrafts, ratingDrafts, setRatingDrafts, ratingSubmitting, setRatingSubmitting, dismissedRatingsRef, ratingHandledRef, ratingStatusSnapshotRef, adminUsers, setAdminUsers, adminExtras, setAdminExtras, adminServiceDraft, setAdminServiceDraft, adminServiceEdit, setAdminServiceEdit, adminRegionDraft, setAdminRegionDraft, adminAnnouncementDraft, setAdminAnnouncementDraft, adminFaqDraft, setAdminFaqDraft, adminReportFilters, setAdminReportFilters, adminWallet, setAdminWallet, adminUsersLoading, setAdminUsersLoading, broadcast, setBroadcast, supportCases, setSupportCases, supportCase, setSupportCase, supportDraft, setSupportDraft, supportSubject, setSupportSubject, supportLoading, setSupportLoading, supportError, setSupportError, accountPasswordForm, setAccountPasswordForm, profileEditForm, setProfileEditForm, profileEditOpenCategory, setProfileEditOpenCategory, recoveryForm, setRecoveryForm, adminSupportCases, setAdminSupportCases, adminSupportSelected, setAdminSupportSelected, adminSupportDraft, setAdminSupportDraft, adminRecoveryCases, setAdminRecoveryCases, adminRecoverySelected, setAdminRecoverySelected, adminRecoveryCode, setAdminRecoveryCode, adminRecoveryDraft, setAdminRecoveryDraft, services, updateForm, ratingAccountId, ratingStorageKey, previousRatingStorageKey, legacyRatingStorageKey, oldestRatingStorageKey, markNotificationRead, markAllNotificationsRead, updateProfessionalLevel, changeAdminRoleForFanni, revokeAdminRoleForUser, moderateTechnician, publishOrder, reviewTopup, setComplaintStatus, handleLogin, registerClient, registerTechnician, createOrder, trackClientOrder, submitClientComplaint, trackClientComplaints, sendOffer, submitOffer, cancelClientOrder, acceptClientOffer, completeTechnicianOrder, getOrderSN, uniqueByOrderSN, orderToken, refreshVisibleData, refreshOrderChat, toggleOrderChat, sendOrderChat, requestOrderPriceChange, decideOrderPrice, setOrderRatingStars, renderRatingStars, submitOrderRating, saveRatingDismissal, renderRatingModal, sendAdminBroadcast, acceptTechnicianGuidelines, submitTopup, loadSupportCases, startSupportCase, openSupportCase, sendSupportMessage, loadAdminSupportCases, loadAdminRecoveryCases, openAdminRecovery, issueAdminRecoveryCode, replyAdminRecovery, replyAdminSupport, beginProfileEdit, toggleProfileEditSpecialty, saveProfileEdits, changeAccountPassword, startPasswordRecovery, refreshPasswordRecovery, sendRecoveryMessage, verifyRecoveryCode, resetRecoveredPassword, adminRefreshExtras, adminAddService, adminBeginServiceEdit, adminSaveServiceEdit, adminMoveCategory, adminMoveService, adminToggleService, adminDeleteService, adminSavePricing, adminAddRegion, adminSaveSettings, adminAddFaqDraft, adminSaveContent, adminGenerateReport, adminOrderAction, adminClientAction, adminSetTechnicianLevel, adminLoadWalletTransactions, adminWalletAction, adminLoadAuditLogs, copyOrderCode, openWhatsAppSupport, performLogout, logout, goLogin, toggleArray };

  if (authRestoring) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color={COLORS.blue} /><Text style={styles.statusText}>جاري استعادة حسابك...</Text></View></SafeAreaView>;

  if (screen === 'login') return <LoginScreen authMode={authMode} username={username} setUsername={setUsername} password={password} setPassword={setPassword} handleLogin={handleLogin} loginLoading={loginLoading} setRecoveryForm={setRecoveryForm} setScreen={setScreen} />;

  if (screen === 'account') return <AccountScreen session={session} clientData={clientData} techData={techData} setScreen={setScreen} beginProfileEdit={beginProfileEdit} setRatingPrompt={setRatingPrompt} getOrderSN={getOrderSN} />;

  if (screen === 'profileEdit') return <ProfileEditScreen session={session} techData={techData} categories={categories} profileEditForm={profileEditForm} setProfileEditForm={setProfileEditForm} profileEditOpenCategory={profileEditOpenCategory} setProfileEditOpenCategory={setProfileEditOpenCategory} toggleProfileEditSpecialty={toggleProfileEditSpecialty} saveProfileEdits={saveProfileEdits} setScreen={setScreen} />;

  if (screen === 'changePassword') return <ChangePasswordScreen accountPasswordForm={accountPasswordForm} setAccountPasswordForm={setAccountPasswordForm} changeAccountPassword={changeAccountPassword} setScreen={setScreen} />;

  if (screen === 'passwordRecovery') return <PasswordRecoveryScreen recoveryForm={recoveryForm} setRecoveryForm={setRecoveryForm} setScreen={setScreen} startPasswordRecovery={startPasswordRecovery} dateLabel={dateLabel} sendRecoveryMessage={sendRecoveryMessage} verifyRecoveryCode={verifyRecoveryCode} resetRecoveredPassword={resetRecoveredPassword} refreshPasswordRecovery={refreshPasswordRecovery} />;

  if (screen === 'clientRegister' || screen === 'technicianRegister') {
    const isClient = screen === 'clientRegister';
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="‹ رجوع" secondary onPress={() => {
        if (!isClient) { setGuidelinesChecked(false); setGuidelinesReachedEnd(false); setGuidelinesViewportHeight(0); }
        setScreen('home');
      }} />
      <Text style={styles.title}>{isClient ? 'إنشاء حساب عميل' : 'تسجيل فني جديد'}</Text>
      <Field label="الاسم" value={form.name} onChangeText={v => updateForm('name', v)} autoCapitalize="words"
        inputRef={registrationNameRef} returnKeyType="next" returnKeyLabel="التالي"
        onSubmitEditing={() => registrationPhoneRef.current?.focus()} blurOnSubmit={false} />
      <Field label="رقم الهاتف" value={form.phone} onChangeText={v => updateForm('phone', v)} keyboardType="phone-pad"
        inputRef={registrationPhoneRef} returnKeyType="next" returnKeyLabel="التالي"
        onSubmitEditing={() => registrationPasswordRef.current?.focus()} blurOnSubmit={false} />
      <Field label="كلمة السر" value={form.password} onChangeText={v => updateForm('password', v)} secureTextEntry
        inputRef={registrationPasswordRef} returnKeyType="next" returnKeyLabel="التالي"
        onSubmitEditing={() => registrationConfirmPasswordRef.current?.focus()} blurOnSubmit={false} />
      <Field label="تأكيد كلمة السر" value={form.confirmPassword} onChangeText={v => updateForm('confirmPassword', v)} secureTextEntry
        inputRef={registrationConfirmPasswordRef} returnKeyType="go" returnKeyLabel="تسجيل"
        onSubmitEditing={isClient ? registerClient : registerTechnician} blurOnSubmit />
      {!isClient && <>
        <Text style={styles.sectionTitle}>اختار الخدمات اللي بتقدمها</Text>
        {servicesLoading && categories.length === 0 ? <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.teal} />
          <Text style={[styles.detail, { textAlign: 'center' }]}>جاري تحميل الخدمات...</Text>
        </View> : null}
        {!servicesLoading && servicesError && categories.length === 0 ? <View style={{ backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <Text style={[styles.errorText, { textAlign: 'center' }]}>تعذر تحميل الخدمات. تحقق من اتصال الإنترنت ثم أعد المحاولة.</Text>
          <TouchableOpacity onPress={() => setReloadKey(value => value + 1)} disabled={servicesLoading}
            style={{ alignSelf: 'center', backgroundColor: COLORS.teal, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 6 }}>
            <Text style={{ color: COLORS.white, fontWeight: '900', fontSize: 13 }}>إعادة تحميل الخدمات</Text>
          </TouchableOpacity>
        </View> : null}
        {categories.map(category => <View key={category.label} style={styles.selectionGroup}>
          <TouchableOpacity onPress={() => setSelected(current => current?.label === category.label ? null : category)} style={styles.categoryToggle}><Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label} · {(category.services || []).length} {selected?.label === category.label ? '▲' : '▼'}</Text></TouchableOpacity>
          {selected?.label === category.label ? (category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleArray('specialties', service)} style={styles.choiceRow}><Text style={styles.choiceText}>{form.specialties.includes(service) ? '☑' : '□'} {service}</Text></TouchableOpacity>) : null}
        </View>)}

        <Field label="مناطق العمل (اكتب المناطق وافصل بينها بفاصلة) *" value={form.areas} onChangeText={value => updateForm('areas', value)} placeholder="مثال: مدينة نصر، مصر الجديدة، المعادي" multiline />
        <Text style={styles.detail}>اكتب كل المناطق التي تستطيع العمل فيها. افصل بين كل منطقة والأخرى بفاصلة.</Text>

        <Text style={styles.sectionTitle}>ميثاق صُنّاع – التعامل المهني مع العملاء</Text>
        <Text style={styles.detail}>اقرأ الميثاق كاملًا. لن تتمكن من الموافقة أو إرسال طلب التسجيل قبل الوصول إلى نهاية النص.</Text>
        <View style={{ height: 240, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.white }}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            onLayout={event => setGuidelinesViewportHeight(event.nativeEvent.layout.height)}
            onContentSizeChange={(width, height) => {
              if (guidelinesViewportHeight && height <= guidelinesViewportHeight + 8) setGuidelinesReachedEnd(true);
            }}
            onScroll={event => {
              const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 18) setGuidelinesReachedEnd(true);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ padding: 14, gap: 12 }}
          >
            <Text style={styles.detail}>١. التزم بسعر العرض الذي وافق عليه العميل. أي زيادة تحتاج موافقة صريحة مسجلة داخل المنصة قبل التنفيذ.</Text>
            <Text style={styles.detail}>٢. تعامل باحترام وصدق، دون ضغط أو تهديد أو تضليل.</Text>
            <Text style={styles.detail}>٣. قبل قبول العرض، الردود المسموحة «نعم»، «لا»، «حسب الاتفاق». ممنوع تبادل بيانات الاتصال أو التحايل على المنصة قبل القبول.</Text>
            <Text style={styles.detail}>٤. لا تضغط إنهاء المهمة إلا بعد إنجازها فعلًا.</Text>
            <Text style={styles.detail}>٥. احمِ بيانات العميل ولا تستخدمها خارج الطلب.</Text>
            <Text style={styles.detail}>٦. يحق للطرفين التقييم بعد الإكمال؛ ممنوع الإكراه على تقييم إيجابي أو التلاعب بالتقييمات.</Text>
            <Text style={styles.detail}>٧. المخالفات قد تؤدي إلى مراجعة الطلب أو تعليق الحساب أو إيقافه.</Text>
            <Text style={styles.detail}>بالضغط على الموافقة، تؤكد أنك قرأت التعليمات وفهمتها وتتعهد بالالتزام بها أثناء استخدام منصة صُنّاع.</Text>
          </ScrollView>
        </View>
        <TouchableOpacity disabled={!guidelinesReachedEnd} onPress={() => setGuidelinesChecked(value => !value)} activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, opacity: guidelinesReachedEnd ? 1 : 0.45 }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: guidelinesChecked ? COLORS.teal : COLORS.muted, backgroundColor: guidelinesChecked ? COLORS.teal : COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: COLORS.white, fontWeight: '900' }}>{guidelinesChecked ? '✓' : ''}</Text>
          </View>
          <Text style={[styles.detail, { flex: 1, fontWeight: '800', color: COLORS.text }]}>
            {guidelinesReachedEnd ? 'قرأت ميثاق صُنّاع كاملًا وأوافق على الالتزام به.' : 'مرّر الميثاق حتى نهايته لتفعيل الموافقة.'}
          </Text>
        </TouchableOpacity>
      </>}
      <Button title={loginLoading ? 'جاري التسجيل...' : isClient ? 'إنشاء حساب' : 'إرسال طلب التسجيل'}
        onPress={isClient ? registerClient : registerTechnician}
        disabled={loginLoading || (!isClient && (!guidelinesReachedEnd || !guidelinesChecked))}
      />
    </ScrollView></SafeAreaView>;
  }

  if (screen === 'client' && session?.role === 'client') return <ClientDashboard context={screenContext} />;

  if (screen === 'technician' && session?.role === 'fanni') return <TechnicianDashboard context={screenContext} />;

  if (screen === 'support' && session && ['client', 'fanni'].includes(session.role)) return <SupportScreen session={session} screenHistoryRef={screenHistoryRef} screenRef={screenRef} setScreenState={setScreenState} setSupportCase={setSupportCase} supportSubject={supportSubject} setSupportSubject={setSupportSubject} supportDraft={supportDraft} setSupportDraft={setSupportDraft} startSupportCase={startSupportCase} supportCases={supportCases} openSupportCase={openSupportCase} supportCase={supportCase} dateLabel={dateLabel} sendSupportMessage={sendSupportMessage} supportLoading={supportLoading} />;

  if (screen === 'admin' && session?.role === 'admin') return <AdminDashboard session={session} adminData={adminData} setAdminData={setAdminData} loadAdminSupportCases={loadAdminSupportCases} setScreen={setScreen} logout={logout} publishOrder={publishOrder} moderateTechnician={moderateTechnician} />;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.homePage} showsVerticalScrollIndicator={false}>
      <View style={styles.homeBrandArea}>
        <View style={styles.homeLogoCirclePremium}>
          <Image source={require('../../assets/LOGO_UPLOAD_HERE/logo.png')} style={styles.homeLogoImage} resizeMode="contain" />
        </View>
        <Text style={styles.homeBrandTitlePremium}>صُنّاع</Text>
        <Text style={styles.homeTaglinePremium}>كُلُّ خِدْمَةٍ تَبْدَأُ بِخُطْوَةٍ</Text>
        <Text style={styles.homeIntroPremium}>أكثر من عشرين مهنة في مكان واحد، وطلب خدمتك بخطوات بسيطة وسريعة.</Text>
      </View>
      <View style={styles.roleCardsPremium}>
        <TouchableOpacity activeOpacity={0.88} onPress={() => goLogin('client')} style={[styles.roleCardPremium, styles.clientRoleCardPremium]}>
          <View style={styles.clientIconCirclePremium}><Text style={styles.roleIconPremium}>⌂</Text></View>
          <View style={styles.roleCardCopy}><Text style={styles.roleTitlePremium}>الدخول كعميل</Text><Text style={styles.roleDescriptionPremium}>اطلب الخدمة اللي محتاجها وتابع عروض الفنيين بسهولة.</Text><View style={styles.roleActionBadge}><Text style={styles.roleActionBadgeText}>اطلب الآن ←</Text></View></View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.88} onPress={() => goLogin('fanni')} style={[styles.roleCardPremium, styles.technicianRoleCardPremium]}>
          <View style={styles.technicianIconCirclePremium}><Text style={styles.roleIconPremium}>⚒</Text></View>
          <View style={styles.roleCardCopy}><Text style={styles.roleTitlePremium}>الدخول كفني</Text><Text style={styles.roleDescriptionPremium}>استقبل الطلبات وقدّم عروضك وتابع مكسبك.</Text><View style={[styles.roleActionBadge, {backgroundColor:COLORS.navy}]}><Text style={styles.roleActionBadgeText}>شوف فرص الشغل ←</Text></View></View>
        </TouchableOpacity>
      </View>
      <View style={styles.homeFooterPremium}><View style={styles.homeFooterDot} /><Text style={styles.homeFooterText}>اختار طريقة الدخول وابدأ مع صُنّاع</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
export default AppScreens;
