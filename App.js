import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';

const API = 'https://sonaa-backend-v2.vercel.app/api/services';

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadServices() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(API);
        if (!response.ok) {
          throw new Error(`الخادم رجّع خطأ (${response.status})`);
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.categories)) {
          throw new Error('استجابة الخدمات من الخادم غير صحيحة.');
        }

        if (!mounted) return;
        setCategories(data.categories);
        setSelected((current) => {
          if (current && data.categories.some((item) => item.label === current.label)) {
            return data.categories.find((item) => item.label === current.label);
          }
          return data.categories[0] || null;
        });
      } catch (err) {
        if (!mounted) return;
        setCategories([]);
        setSelected(null);
        setError(
          err && err.message
            ? `تعذر تحميل الخدمات: ${err.message}`
            : 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadServices();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.statusText}>جاري تحميل الخدمات...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>مش قادرين نوصل للخدمات</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setReloadKey((key) => key + 1)}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>صُنّاع</Text>
      <Text style={styles.sub}>خدماتك اليومية في مكان واحد</Text>

      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={(item) => String(item.label)}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => {
          const active = selected?.label === item.label;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setSelected(item)}
              style={[styles.card, active && styles.cardActive]}
            >
              <Text style={styles.emoji}>{item.emoji || '🛠️'}</Text>
              <Text style={[styles.label, active && styles.activeLabel]}>
                {item.label}
              </Text>
              <Text style={[styles.count, active && styles.activeCount]}>
                {(Array.isArray(item.services) ? item.services.length : 0)} خدمة
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {selected && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            {selected.emoji || '🛠️'} {selected.label}
          </Text>
          <ScrollView>
            {(Array.isArray(selected.services) ? selected.services : []).map(
              (service, index) => (
                <View key={`${selected.label}-${index}`} style={styles.serviceRow}>
                  <Text style={styles.serviceText}>{service}</Text>
                  <Text style={styles.serviceMark}>›</Text>
                </View>
              )
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 60,
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 28,
  },
  statusText: { marginTop: 12, color: '#E2E8F0', fontSize: 15 },
  errorTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: 'bold', textAlign: 'center' },
  errorText: { color: '#CBD5E1', marginTop: 12, textAlign: 'center', lineHeight: 23 },
  retryButton: { marginTop: 22, backgroundColor: '#14B8A6', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  retryText: { color: '#0F172A', fontWeight: 'bold', fontSize: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0F172A' },
  sub: { color: '#64748B', marginBottom: 16, marginTop: 4 },
  categoryList: { paddingBottom: 8 },
  card: { flex: 1, backgroundColor: 'white', borderRadius: 18, padding: 14, margin: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  cardActive: { backgroundColor: '#0F172A', borderColor: '#14B8A6' },
  emoji: { fontSize: 30 },
  label: { fontWeight: 'bold', marginTop: 6, color: '#0F172A' },
  activeLabel: { color: 'white' },
  count: { color: '#64748B', fontSize: 12, marginTop: 4 },
  activeCount: { color: '#99F6E4' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, maxHeight: 300, marginTop: 10, borderTopWidth: 1, borderColor: '#E2E8F0' },
  sheetTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#0F172A' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  serviceText: { color: '#1E293B', flex: 1 },
  serviceMark: { color: '#0D9488', fontSize: 24, marginLeft: 8 },
});
