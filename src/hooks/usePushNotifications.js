import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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
            lightColor: COLORS.teal500,
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
  return pushTokenRef;
}
