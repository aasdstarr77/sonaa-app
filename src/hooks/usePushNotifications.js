import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../services/api';
import { COLORS } from '../theme/colors';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export function usePushNotifications(session) {
  const pushTokenRef = useRef(null);
  const registrationInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function registerPushToken(requestPermission = false) {
      if (!session?.token || !['client', 'fanni', 'admin'].includes(session.role) || !Device.isDevice) return;
      if (registrationInFlightRef.current) return;
      registrationInFlightRef.current = true;

      try {
        const permission = await Notifications.getPermissionsAsync();
        let status = permission.status;
        if (status !== 'granted' && requestPermission) {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        // A granted permission is retained across app updates. Never require the
        // user to approve notifications again just because a new APK was installed.
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
            lightColor: COLORS.teal500,
          });
        }

        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !result?.data) return;
        pushTokenRef.current = result.data;

        const registered = await api('/notifications/admin/push-token', {
          method: 'POST',
          token: session.token,
          body: { token: result.data, platform: Platform.OS }
        });
        if (!cancelled) {
          console.info('Sonaa CON push token registration:', registered?.message || 'success');
        }
      } catch (error) {
        console.warn('Sonaa CON push registration failed:', error?.message || error);
      } finally {
        registrationInFlightRef.current = false;
      }
    }

    // Ask only during the first authenticated registration when permission is
    // not already granted. App resumes re-register silently using saved consent.
    void registerPushToken(true);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') void registerPushToken(false);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [session?.token, session?.role]);

  return pushTokenRef;
}
