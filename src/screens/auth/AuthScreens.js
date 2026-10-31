import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../theme/styles';
import { Button, Field } from '../../components/FormControls';
export function LoginScreen({ authMode, username, setUsername, password, setPassword, handleLogin, loginLoading, setRecoveryForm, setScreen }) {
  return <SafeAreaView style={styles.loginSafe}>
    <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity accessibilityRole="button" onPress={() => setScreen('home')} style={styles.loginBackButton}>
        <Text style={styles.loginBackText}>‹ رجوع</Text>
      </TouchableOpacity>
      <View style={styles.loginLogoCircle}>
        <Image source={require('../../../assets/LOGO_UPLOAD_HERE/logo.png')} style={styles.loginLogo} resizeMode="contain" />
      </View>
      <View style={styles.loginHeading}>
        <Text style={styles.loginTitle}>{authMode === 'client' ? 'أهلًا بيك في صُنّاع' : 'أهلًا بيك يا فني صُنّاع'}</Text>
        <Text style={styles.loginSubtitle}>{authMode === 'client' ? 'سجّل دخولك وخلّي طلباتك أسهل.' : 'سجّل دخولك وتابع فرص الشغل المتاحة ليك.'}</Text>
      </View>
      <View style={styles.loginForm}>
        <Field label="رقم الهاتف" value={username} onChangeText={setUsername} placeholder="اكتب رقم الهاتف" keyboardType="phone-pad" />
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
}

export function ChangePasswordScreen({ accountPasswordForm, setAccountPasswordForm, changeAccountPassword, setScreen }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="‹ رجوع إلى حسابي" secondary onPress={() => setScreen('account')} /><Text style={styles.title}>تغيير كلمة المرور</Text><Field label="كلمة المرور الحالية" value={accountPasswordForm.currentPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, currentPassword: v }))} secureTextEntry /><Field label="كلمة المرور الجديدة" value={accountPasswordForm.newPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={accountPasswordForm.confirmPassword} onChangeText={v => setAccountPasswordForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title={accountPasswordForm.loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'} onPress={changeAccountPassword} disabled={accountPasswordForm.loading} />{accountPasswordForm.error ? <Text style={styles.errorText}>{accountPasswordForm.error}</Text> : null}</ScrollView></SafeAreaView>;
}

export function PasswordRecoveryScreen({ recoveryForm, setRecoveryForm, setScreen, startPasswordRecovery, dateLabel, sendRecoveryMessage, verifyRecoveryCode, resetRecoveredPassword, refreshPasswordRecovery }) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Button title="‹ رجوع لتسجيل الدخول" secondary onPress={() => setScreen('login')} /><Text style={styles.title}>استعادة كلمة المرور</Text>{!recoveryForm.token ? <><Field label="رقم الهاتف المسجل" value={recoveryForm.phone} onChangeText={v => setRecoveryForm(c => ({ ...c, phone: v }))} keyboardType="phone-pad" /><Button title={recoveryForm.loading ? 'جاري إرسال الطلب...' : 'فتح طلب دعم'} onPress={startPasswordRecovery} disabled={recoveryForm.loading} /></> : <><Text style={styles.sectionTitle}>محادثة استعادة الحساب</Text><Text style={styles.detail}>{recoveryForm.info}</Text>{recoveryForm.messages.map((m,i) => <View key={String(m._id||i)} style={styles.chatMessage}><Text style={styles.detail}>{m.senderRole === 'admin' ? 'الدعم' : 'أنت'} • {dateLabel(m.createdAt)}</Text><Text style={styles.chatMessageText}>{m.text}</Text></View>)}<Field label="رسالة للدعم" value={recoveryForm.text} onChangeText={v => setRecoveryForm(c => ({ ...c, text: v }))} returnKeyType="send" onSubmitEditing={sendRecoveryMessage} blurOnSubmit /><Button title="إرسال رسالة للدعم" onPress={sendRecoveryMessage} disabled={recoveryForm.loading} /><Field label="رمز الاستعادة الذي أرسله الدعم" value={recoveryForm.code} onChangeText={v => setRecoveryForm(c => ({ ...c, code: v }))} keyboardType="number-pad" /><Button title="التحقق من الرمز" secondary onPress={verifyRecoveryCode} disabled={recoveryForm.loading} /><Field label="كلمة المرور الجديدة" value={recoveryForm.newPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, newPassword: v }))} secureTextEntry /><Field label="تأكيد كلمة المرور الجديدة" value={recoveryForm.confirmPassword} onChangeText={v => setRecoveryForm(c => ({ ...c, confirmPassword: v }))} secureTextEntry /><Button title="حفظ كلمة المرور الجديدة" onPress={resetRecoveredPassword} disabled={recoveryForm.loading} /><Button title="تحديث المحادثة" secondary onPress={refreshPasswordRecovery} /></>}{recoveryForm.error ? <Text style={styles.errorText}>{recoveryForm.error}</Text> : null}</ScrollView></SafeAreaView>;
}
