import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../theme/styles';
import { Button, Field } from '../../components/FormControls';
export function AdminDashboard({ session, adminData, setAdminData, loadAdminSupportCases, setScreen, logout, publishOrder, moderateTechnician }) {
const tab = adminData.tab;
    const items = tab === 'levels' || tab === 'roles' ? adminData.fannis : adminData[tab] || [];
    const tabs = [{ key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' }, { key: 'clients', label: 'العملاء' }, { key: 'topups', label: 'الشحن' }, { key: 'complaints', label: 'الشكاوى' }, { key: 'support', label: 'الدعم' }];
    return <SafeAreaView style={styles.adminSafe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitleSmall}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View><Button title="حسابي" secondary onPress={() => setScreen('account')} /><Button title="خروج" secondary onPress={logout} /></View>
      <View style={styles.tabRowPremium}>{tabs.map(item => <TouchableOpacity key={item.key} onPress={() => { setAdminData(v => ({ ...v, tab: item.key })); if (item.key === 'support') loadAdminSupportCases(); }} style={[styles.pillPremium, tab === item.key && styles.pillPremiumActive]}><Text style={[styles.pillPremiumText, tab === item.key && styles.pillPremiumTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
      <FlatList style={{ flex: 1 }} data={items} keyExtractor={(item, i) => String(item._id || item.id || item.sn || item.phone || i)} contentContainerStyle={styles.listPremium} ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات حاليًا.</Text>} renderItem={({ item }) => <View style={styles.dataCard}><Text style={styles.cardTitleSmall}>{item.name || item.sn || item.phone || 'عنصر'}</Text><Text style={styles.detail}>{item.status || item.phone || ''}</Text>{tab === 'orders' && item.status === 'قيد المراجعة' ? <Button title="نشر الطلب" onPress={() => publishOrder(item)} /> : null}{tab === 'fannis' && !item.isApproved && !item.isDisabled ? <View style={styles.roleActions}><Button title="اعتماد" onPress={() => moderateTechnician(item, 'approve')} /><Button title="رفض" secondary onPress={() => moderateTechnician(item, 'reject')} /></View> : null}</View>} />
    </SafeAreaView>;
}
