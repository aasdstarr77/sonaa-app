import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_BASE } from '../services/api';
import { CON_COLORS as C } from '../theme/con-colors';

const LOGOUT_BRIDGE = `
(function () {
  if (window.__sonaaNativeLogoutBridge) return true;
  window.__sonaaNativeLogoutBridge = true;
  document.addEventListener('click', function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest('button[onclick],a[onclick]') : null;
    if (!button) return;
    var handler = button.getAttribute('onclick') || '';
    if (/\\blogout\\s*\\(/.test(handler)) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('sonaa-admin-logout');
    }
  }, true);
  return true;
})();
true;
`;

export function AdminWebPanel({ session, onLogout }) {
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef(null);
  const webViewReady = useRef(false);
  const exitPromptVisible = useRef(false);

  const confirmExit = () => {
    if (exitPromptVisible.current) return;
    exitPromptVisible.current = true;
    Alert.alert(
      'تأكيد إغلاق التطبيق',
      'هل تريد إغلاق التطبيق؟',
      [
        { text: 'إلغاء', style: 'cancel', onPress: () => { exitPromptVisible.current = false; } },
        { text: 'إغلاق التطبيق', style: 'destructive', onPress: () => {
          exitPromptVisible.current = false;
          BackHandler.exitApp();
        } }
      ],
      { cancelable: true, onDismiss: () => { exitPromptVisible.current = false; } }
    );
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitPromptVisible.current) return true;
      if (!webViewRef.current || !webViewReady.current) {
        confirmExit();
        return true;
      }
      webViewRef.current.injectJavaScript(
        "(function(){if(typeof window.goBack==='function'){window.goBack();}" +
        "else if(window.history&&window.history.length>1){window.history.back();}" +
        "else if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage('sonaa-admin-back-at-root');}})();true;"
      );
      return true;
    });
    return () => subscription.remove();
  }, []);

  return <View style={styles.root}>
    {loading && !loadError ? <View style={styles.loading}>
      <ActivityIndicator size="large" color={C.accent}/>
      <Text style={styles.loadingText}>جاري فتح لوحة الإدارة الكاملة...</Text>
    </View> : null}
    {loadError ? <View style={styles.error}>
      <Text style={styles.errorTitle}>تعذر فتح لوحة الإدارة</Text>
      <Text style={styles.errorText}>{loadError}</Text>
      <Text style={styles.hint}>تحقق من اتصال الإنترنت ثم أعد فتح التطبيق.</Text>
    </View> : <WebView
      ref={webViewRef}
      key={session.token}
      source={{ uri: API_BASE + '/admin/mobile-panel', headers: { Authorization: 'Bearer ' + session.token } }}
      style={styles.web}
      originWhitelist={['https://*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      setSupportMultipleWindows={false}
      startInLoadingState
      injectedJavaScript={LOGOUT_BRIDGE}
      onLoadStart={() => { webViewReady.current = false; setLoading(true); setLoadError(''); }}
      onLoadEnd={() => { webViewReady.current = true; setLoading(false); }}
      onError={event => { setLoading(false); setLoadError(event.nativeEvent?.description || 'حدث خطأ أثناء تحميل لوحة الإدارة.'); }}
      onHttpError={event => {
        if (event.nativeEvent?.statusCode >= 400) {
          setLoading(false);
          setLoadError('الخادم رفض فتح لوحة الإدارة (' + event.nativeEvent.statusCode + ').');
        }
      }}
      onMessage={event => {
        if (event.nativeEvent?.data === 'sonaa-admin-logout') onLogout?.();
        else if (event.nativeEvent?.data === 'sonaa-admin-back-at-root') confirmExit();
      }}
      renderLoading={() => <View style={styles.loading}>
        <ActivityIndicator size="large" color={C.accent}/>
        <Text style={styles.loadingText}>جاري تحميل لوحة الإدارة...</Text>
      </View>}
    />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  web: { flex: 1, backgroundColor: C.background },
  loading: { ...StyleSheet.absoluteFillObject, zIndex: 2, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.background },
  loadingText: { color: C.primary, fontSize: 13, fontWeight: '800' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 10 },
  errorTitle: { color: C.danger, fontSize: 17, fontWeight: '900' },
  errorText: { color: C.text, fontSize: 13, textAlign: 'center' },
  hint: { color: C.muted, fontSize: 12, textAlign: 'center' }
});
