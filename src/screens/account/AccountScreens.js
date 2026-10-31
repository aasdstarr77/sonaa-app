import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../theme/styles';
import { Button, Field } from '../../components/FormControls';
export function AccountScreen({ session, clientData, techData, setScreen, beginProfileEdit, setRatingPrompt, getOrderSN }) {
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
      {['client', 'fanni'].includes(session?.role) ? <Button title="✏️ تعديل بياناتي" onPress={beginProfileEdit} /> : null}
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

export function ProfileEditScreen({ session, techData, categories, profileEditForm, setProfileEditForm, profileEditOpenCategory, setProfileEditOpenCategory, toggleProfileEditSpecialty, saveProfileEdits, setScreen }) {
const isClientProfile = session?.role === 'client';
    const currentUser = session?.role === 'fanni' ? (techData.profile || session.user || {}) : (session?.user || {});
    const hasPendingTechEdit = session?.role === 'fanni' && Boolean(currentUser?.pendingProfileChange?.requestedAt);
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
      <Button title="‹ رجوع إلى حسابي" secondary onPress={() => setScreen('account')} />
      <Text style={styles.title}>تعديل بياناتي</Text>
      {isClientProfile ? <>
        <Field label="الاسم بالكامل" value={profileEditForm.name} onChangeText={value => setProfileEditForm(current => ({ ...current, name: value, error: '' }))} autoCapitalize="words" />
        <Field label="رقم الهاتف" value={profileEditForm.phone} onChangeText={value => setProfileEditForm(current => ({ ...current, phone: value, error: '' }))} keyboardType="phone-pad" />
        <Text style={styles.detail}>رقم الهاتف لازم يكون 11 رقمًا ويبدأ بـ 01، وما يكونش مسجل لحساب آخر.</Text>
      </> : <>
        <Field label="رقم الهاتف" value={profileEditForm.phone} onChangeText={value => setProfileEditForm(current => ({ ...current, phone: value, error: '' }))} keyboardType="phone-pad" />
        <Text style={styles.sectionTitle}>التخصصات والخدمات (اختياري)</Text>
        <Text style={styles.detail}>اختار من الخدمات الموجودة لو حابب تعدّل تخصصاتك، بحد أقصى 20 تخصصًا. لو ما غيّرتش الاختيارات هتفضل تخصصاتك الحالية زي ما هي.</Text>
        {categories.map(category => { const chosenCount = (category.services || []).filter(service => profileEditForm.specialties.includes(service)).length; const open = profileEditOpenCategory === category.label; return <View key={category.label} style={styles.selectionGroup}>
          <TouchableOpacity onPress={() => setProfileEditOpenCategory(open ? '' : category.label)} style={styles.categoryToggle}><Text style={styles.groupTitle}>{category.emoji || '🛠️'} {category.label} · {chosenCount} مختار {open ? '▲' : '▼'}</Text></TouchableOpacity>
          {open ? (category.services || []).map(service => <TouchableOpacity key={service} onPress={() => toggleProfileEditSpecialty(service)} style={styles.choiceRow}><Text style={styles.choiceText}>{profileEditForm.specialties.includes(service) ? '☑' : '□'} {service}</Text></TouchableOpacity>) : null}
        </View>; })}
        <Field label="مناطق العمل (افصل بين المناطق بفاصلة)" value={profileEditForm.areas} onChangeText={value => setProfileEditForm(current => ({ ...current, areas: value, error: '' }))} placeholder="مثال: مدينة نصر، مصر الجديدة" multiline />
        <Text style={styles.detail}>تعديل بيانات الفني يُرسل للإدارة للمراجعة، وتظل بياناتك الحالية كما هي حتى الموافقة.</Text>
        {hasPendingTechEdit ? <Text style={styles.warningText}>عندك طلب تعديل بيانات بالفعل قيد مراجعة الإدارة. انتظر القرار قبل إرسال طلب جديد.</Text> : null}
      </>}
      {profileEditForm.error ? <Text style={styles.errorText}>{profileEditForm.error}</Text> : null}
      {profileEditForm.message ? <Text style={styles.successText}>{profileEditForm.message}</Text> : null}
      <Button title={profileEditForm.loading ? 'جاري الحفظ...' : isClientProfile ? 'حفظ التعديلات' : 'إرسال طلب التعديل للإدارة'} onPress={saveProfileEdits} disabled={profileEditForm.loading || hasPendingTechEdit} />
      <Button title="إلغاء" secondary onPress={() => setScreen('account')} disabled={profileEditForm.loading} />
    </ScrollView></SafeAreaView>;
}
