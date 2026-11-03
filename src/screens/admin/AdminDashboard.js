import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../theme/styles';
import { COLORS } from '../../theme/colors';
import { Button, Field } from '../../components/FormControls';
import AreaPicker from '../../components/AreaPicker';
import { normalizeAreaSearch } from '../../utils/area-helpers';

export function AdminDashboard({
  session, adminData, setAdminData, adminExtras, adminRegionDraft, setAdminRegionDraft,
  adminLoadRegions, adminAddRegion, adminEditRegion, adminToggleRegion, adminDeleteRegion,
  adminRestoreRegion, adminBulkRegionAction, categories = [], areas = [],
  adminProfileEdit, setAdminProfileEdit, adminPendingProfileEdits = [], reviewAdminProfileEdit, refreshAdminProfileEdits, adminBeginProfileEdit, toggleAdminProfileSpecialty,
  adminSaveProfileEdit, loadAdminSupportCases, setScreen, logout, publishOrder, moderateTechnician
}) {
  const tab = adminData.tab;
  const [regionSearch, setRegionSearch] = useState('');
  const [selectedRegionIds, setSelectedRegionIds] = useState([]);
  const [editingRegion, setEditingRegion] = useState({ id: '', name: '' });
  const [openSpecialtyCategory, setOpenSpecialtyCategory] = useState('');
  const regions = Array.isArray(adminExtras?.regions) ? adminExtras.regions : [];
  const normalizedSearch = normalizeAreaSearch(regionSearch);
  const filteredRegions = useMemo(() => regions.filter(region =>
    !normalizedSearch || normalizeAreaSearch(region.name).includes(normalizedSearch)
  ), [regions, normalizedSearch]);
  const activeRegions = regions.filter(region => region.isDeleted !== true && region.isActive !== false).length;
  const hiddenRegions = regions.filter(region => region.isDeleted !== true && region.isActive === false).length;
  const deletedRegions = regions.filter(region => region.isDeleted === true).length;
  const items = tab === 'levels' || tab === 'roles' ? adminData.fannis : adminData[tab] || [];
  const tabs = [
    { key: 'orders', label: 'الطلبات' }, { key: 'fannis', label: 'الفنيون' },
    { key: 'clients', label: 'العملاء' }, { key: 'profileEdits', label: 'طلبات تعديل البيانات' }, { key: 'regions', label: 'المناطق' },
    { key: 'topups', label: 'الشحن' }, { key: 'complaints', label: 'الشكاوى' },
    { key: 'support', label: 'الدعم' }
  ];
  const toggleRegionSelection = id => setSelectedRegionIds(current =>
    current.includes(id) ? current.filter(value => value !== id) : [...current, id]
  );

  return <SafeAreaView style={styles.adminSafe}>
    <View style={styles.headerRow}>
      <View style={styles.flex}><Text style={styles.title}>لوحة إدارة صُنّاع</Text><Text style={styles.subtitleSmall}>أهلًا {session.user?.name || 'بالإدارة'}</Text></View>
      <Button title="حسابي" secondary onPress={() => setScreen('account')} />
      <Button title="خروج" secondary onPress={logout} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 54 }} contentContainerStyle={styles.tabRowPremium}>
      {tabs.map(item => <TouchableOpacity key={item.key} onPress={() => {
        setAdminData(v => ({ ...v, tab: item.key }));
        if (item.key === 'support') loadAdminSupportCases();
        if (item.key === 'regions') adminLoadRegions();
        if (item.key === 'profileEdits') refreshAdminProfileEdits?.();
      }} style={[styles.pillPremium, tab === item.key && styles.pillPremiumActive]}>
        <Text style={[styles.pillPremiumText, tab === item.key && styles.pillPremiumTextActive]}>{item.label}</Text>
      </TouchableOpacity>)}
    </ScrollView>

    {tab === 'profileEdits' ? <FlatList
      style={{ flex: 1 }}
      data={adminPendingProfileEdits}
      keyExtractor={(item, i) => String(item._id || item.id || i)}
      contentContainerStyle={styles.listPremium}
      ListHeaderComponent={<View style={styles.dataCard}><Text style={styles.cardTitlePremium}>طلبات تعديل بيانات الفنيين</Text><Text style={styles.detailSmall}>لن تتغير بيانات الفني إلا بعد الموافقة. راجع البيانات الحالية والجديدة قبل اتخاذ القرار.</Text><Button title="تحديث الطلبات" secondary onPress={refreshAdminProfileEdits} /></View>}
      ListEmptyComponent={<Text style={styles.emptyText}>لا توجد طلبات تعديل بيانات معلّقة حاليًا.</Text>}
      renderItem={({ item }) => {
        const pending = item.pendingProfileChange || {};
        const before = pending.before || { phone: item.phone, specialties: item.specialties || [], areas: item.areas || [] };
        const changed = new Set(Array.isArray(pending.changedFields) ? pending.changedFields : []);
        const isChanged = key => changed.size ? changed.has(key) : (key === 'phone' ? String(pending.phone || '') !== String(before.phone || '') : JSON.stringify(pending[key] || []) !== JSON.stringify(before[key] || []));
        const display = value => Array.isArray(value) ? value.join('، ') || '—' : String(value || '—');
        return <View style={styles.dataCard}>
          <Text style={styles.cardTitleSmall}>{item.name || 'فني'}</Text>
          <Text style={styles.detailSmall}>طلب تعديل بيانات • {pending.requestedAt ? new Date(pending.requestedAt).toLocaleString('ar-EG') : '—'}</Text>
          <Text style={styles.sectionTitle}>البيانات الحالية</Text>
          <Text style={styles.detail}>الهاتف: {display(before.phone)}{"\n"}التخصصات: {display(before.specialties)}{"\n"}مناطق العمل: {display(before.areas)}</Text>
          <Text style={styles.sectionTitle}>البيانات المطلوبة</Text>
          {['phone', 'specialties', 'areas'].map(key => <View key={key} style={{ padding: 8, borderRadius: 9, borderWidth: 1, borderColor: isChanged(key) ? '#D97706' : COLORS.border, backgroundColor: isChanged(key) ? '#FEF3C7' : COLORS.white, marginBottom: 5 }}>
            <Text style={styles.detail}>{key === 'phone' ? 'رقم الهاتف' : key === 'specialties' ? 'التخصصات' : 'مناطق العمل'}{isChanged(key) ? ' — مطلوب تغييره' : ' — لم يطلب تغييره'}: {display(pending[key])}</Text>
          </View>)}
          <View style={styles.roleActions}>
            <Button title="موافقة واعتماد" onPress={() => reviewAdminProfileEdit?.(item, 'approve')} />
            <Button title="رفض الطلب" secondary onPress={() => reviewAdminProfileEdit?.(item, 'reject')} />
          </View>
        </View>;
      }}
    /> : tab === 'regions' ? <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listPremium} keyboardShouldPersistTaps="handled">
      <View style={styles.dataCard}>
        <Text style={styles.cardTitlePremium}>إدارة مناطق الخدمة</Text>
        <View style={styles.roleActions}>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.cardTitlePremium}>{activeRegions}</Text><Text style={styles.detailSmall}>ظاهرة</Text></View>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.cardTitlePremium}>{hiddenRegions}</Text><Text style={styles.detailSmall}>مخفية</Text></View>
          <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.cardTitlePremium}>{deletedRegions}</Text><Text style={styles.detailSmall}>محذوفة</Text></View>
        </View>
        <Field label="إضافة منطقة جديدة" value={adminRegionDraft} onChangeText={setAdminRegionDraft} placeholder="اكتب اسم المنطقة" />
        <Button title="إضافة المنطقة" onPress={adminAddRegion} />
        <Field label="البحث في المناطق" value={regionSearch} onChangeText={setRegionSearch} placeholder="اكتب اسم المنطقة أو جزءًا منه" />
        <Text style={styles.detailSmall}>المحدد: {selectedRegionIds.length} منطقة</Text>
        <View style={styles.roleActions}>
          <Button title="تحديد الظاهرين" secondary onPress={() => setSelectedRegionIds(filteredRegions.map(item => String(item._id || item.id)))} />
          <Button title="إلغاء التحديد" secondary onPress={() => setSelectedRegionIds([])} />
        </View>
        <View style={styles.roleActions}>
          <Button title="إظهار المحدد" secondary onPress={() => adminBulkRegionAction(selectedRegionIds, 'show')} disabled={!selectedRegionIds.length} />
          <Button title="إخفاء المحدد" secondary onPress={() => adminBulkRegionAction(selectedRegionIds, 'hide')} disabled={!selectedRegionIds.length} />
        </View>
        <View style={styles.roleActions}>
          <Button title="حذف المحدد" secondary onPress={() => adminBulkRegionAction(selectedRegionIds, 'delete')} disabled={!selectedRegionIds.length} />
          <Button title="استعادة المحدد" secondary onPress={() => adminBulkRegionAction(selectedRegionIds, 'restore')} disabled={!selectedRegionIds.length} />
        </View>
      </View>
      {filteredRegions.map(region => {
        const id = String(region._id || region.id);
        const deleted = region.isDeleted === true;
        const hidden = !deleted && region.isActive === false;
        const editing = editingRegion.id === id;
        return <View key={id} style={styles.dataCard}>
          <View style={styles.roleActions}>
            <TouchableOpacity onPress={() => toggleRegionSelection(id)} style={{ padding: 8 }}>
              <Text style={styles.cardTitleSmall}>{selectedRegionIds.includes(id) ? '☑' : '□'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              {editing ? <TextInput value={editingRegion.name} onChangeText={name => setEditingRegion(current => ({ ...current, name }))} style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, color: COLORS.text, textAlign: 'right' }} /> : <Text style={styles.cardTitleSmall}>{region.name}</Text>}
              <Text style={styles.detailSmall}>{deleted ? 'محذوفة' : hidden ? 'مخفية من الاختيارات الجديدة' : 'ظاهرة في الاختيارات'}</Text>
            </View>
          </View>
          <View style={styles.roleActions}>
            {editing ? <Button title="حفظ الاسم" onPress={() => { adminEditRegion(id, editingRegion.name); setEditingRegion({ id: '', name: '' }); }} /> : <Button title="تعديل" secondary onPress={() => setEditingRegion({ id, name: String(region.name || '') })} />}
            {!deleted ? <Button title={hidden ? 'إظهار' : 'إخفاء'} secondary onPress={() => adminToggleRegion(region)} /> : <Button title="استعادة" secondary onPress={() => adminRestoreRegion(region)} />}
            {!deleted ? <Button title="حذف" secondary onPress={() => adminDeleteRegion(region)} /> : null}
          </View>
        </View>;
      })}
      {!filteredRegions.length ? <Text style={styles.emptyText}>لا توجد مناطق مطابقة.</Text> : null}
    </ScrollView> : <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(item, i) => String(item._id || item.id || item.sn || item.phone || i)}
      contentContainerStyle={styles.listPremium}
      ListEmptyComponent={<Text style={styles.emptyText}>مفيش بيانات حاليًا.</Text>}
      renderItem={({ item }) => <View style={styles.dataCard}>
        <Text style={styles.cardTitleSmall}>{item.name || item.sn || item.phone || 'عنصر'}</Text>
        <Text style={styles.detail}>{item.status || item.phone || ''}</Text>
        {tab === 'orders' && item.status === 'قيد المراجعة' ? <Button title="نشر الطلب" onPress={() => publishOrder(item)} /> : null}
        {tab === 'fannis' ? <View style={styles.roleActions}>
          {!item.isApproved && !item.isDisabled ? <Button title="اعتماد" onPress={() => moderateTechnician(item, 'approve')} /> : null}
          <Button title="تعديل البيانات" secondary onPress={() => adminBeginProfileEdit(item, 'fanni')} />
        </View> : null}
        {tab === 'clients' && item.registered && (item.id || item._id) ? <Button title="تعديل البيانات" secondary onPress={() => adminBeginProfileEdit(item, 'client')} /> : null}
      </View>}
    />}

    <Modal transparent visible={Boolean(adminProfileEdit?.open)} animationType="slide" onRequestClose={() => setAdminProfileEdit(current => ({ ...current, open: false }))}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 }}>
        <View style={{ maxHeight: '90%', backgroundColor: COLORS.white, borderRadius: 18, padding: 16 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.cardTitlePremium}>{adminProfileEdit?.role === 'client' ? 'تعديل بيانات العميل' : 'تعديل بيانات الفني'}</Text>
            {adminProfileEdit?.loading ? <ActivityIndicator color={COLORS.teal} /> : null}
            {adminProfileEdit?.role === 'client' ? <Field label="اسم العميل" value={adminProfileEdit.name} onChangeText={name => setAdminProfileEdit(current => ({ ...current, name, error: '', message: '' }))} /> : null}
            <Field label="رقم الهاتف" value={adminProfileEdit?.phone || ''} onChangeText={phone => setAdminProfileEdit(current => ({ ...current, phone, error: '', message: '' }))} keyboardType="phone-pad" />
            {adminProfileEdit?.role === 'fanni' ? <>
              <Text style={styles.sectionTitle}>التخصصات والخدمات</Text>
              {categories.map(category => {
                const chosenCount = (category.services || []).filter(service => adminProfileEdit.specialties.includes(service)).length;
                const open = openSpecialtyCategory === category.label;
                return <View key={category.label} style={styles.selectionGroup}>
                  <TouchableOpacity onPress={() => setOpenSpecialtyCategory(open ? '' : category.label)} style={styles.categoryToggle}>
                    <Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label} · {chosenCount} مختار {open ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {open ? (category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleAdminProfileSpecialty(service)} style={styles.choiceRow}>
                    <Text style={styles.choiceText}>{adminProfileEdit.specialties.includes(service) ? '☑' : '□'} {service}</Text>
                  </TouchableOpacity>) : null}
                </View>;
              })}
              <AreaPicker label="مناطق العمل *" options={areas} multiple value={adminProfileEdit?.areas || []} onChange={value => setAdminProfileEdit(current => ({ ...current, areas: value, error: '', message: '' }))} maxSelections={30} />
            </> : null}
            {adminProfileEdit?.error ? <Text style={styles.errorText}>{adminProfileEdit.error}</Text> : null}
            {adminProfileEdit?.message ? <Text style={styles.successText}>{adminProfileEdit.message}</Text> : null}
            <Button title={adminProfileEdit?.loading ? 'جاري الحفظ...' : 'حفظ التعديلات'} onPress={adminSaveProfileEdit} disabled={adminProfileEdit?.loading} />
            <Button title="إغلاق" secondary onPress={() => setAdminProfileEdit(current => ({ ...current, open: false }))} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}
