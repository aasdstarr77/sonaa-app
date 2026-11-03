import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CON_COLORS as C } from '../theme/con-colors';
export function LoginScreen({ phone, setPhone, password, setPassword, onLogin, busy, error }) {
 return <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <View style={s.brandCard}>
    <View style={s.logoFrame}><Image source={require('../../assets/LOGO_UPLOAD_HERE/logo.png')} style={s.logo} resizeMode="contain"/></View>
    <Text style={s.brand}>صُنّاع CON</Text>
    <Text style={s.subtitle}>إدارة المنصة والإشراف من مكان واحد</Text>
    <View style={s.pill}><Text style={s.pillText}>بوابة الإدارة المعتمدة</Text></View>
   </View>
   <View style={s.form}>
    <Text style={s.title}>تسجيل الدخول</Text>
    <Text style={s.label}>رقم هاتف حساب الإدارة</Text>
    <TextInput value={phone} onChangeText={setPhone} placeholder="اكتب رقم الهاتف" placeholderTextColor={C.muted} keyboardType="phone-pad" textAlign="right" style={s.input}/>
    <Text style={s.label}>كلمة المرور</Text>
    <TextInput value={password} onChangeText={setPassword} placeholder="اكتب كلمة المرور" placeholderTextColor={C.muted} secureTextEntry textAlign="right" style={s.input} returnKeyType="go" onSubmitEditing={onLogin}/>
    {error ? <Text style={s.error}>{error}</Text> : null}
    <TouchableOpacity disabled={busy} onPress={onLogin} style={[s.button,busy&&{opacity:.6}]}><Text style={s.buttonText}>{busy ? 'جارٍ التحقق...' : 'دخول لوحة الإدارة'}</Text></TouchableOpacity>
    <Text style={s.note}>الدخول متاح لحسابات الأدمن والمشرفين المفعّلة فقط.</Text>
   </View>
   <Text style={s.footer}>صُنّاع • كل خدمة تبدأ بخطوة</Text>
  </ScrollView>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
 wrap:{flex:1,backgroundColor:C.background},content:{flexGrow:1,justifyContent:'center',padding:20,gap:18},
 brandCard:{alignItems:'center',paddingVertical:20},logoFrame:{width:106,height:106,borderRadius:30,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',elevation:5,marginBottom:12},logo:{width:78,height:78},brand:{fontSize:29,fontWeight:'900',color:C.primary},subtitle:{fontSize:14,color:C.muted,marginTop:5},pill:{marginTop:12,paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:C.accentSoft},pillText:{fontSize:12,fontWeight:'800',color:C.primary},
 form:{backgroundColor:C.surface,borderRadius:22,padding:18,borderWidth:1,borderColor:C.border,gap:10,elevation:3},title:{fontSize:20,fontWeight:'900',color:C.primary,textAlign:'right',marginBottom:4},label:{fontSize:13,fontWeight:'800',color:C.text,textAlign:'right'},input:{minHeight:50,borderRadius:13,borderWidth:1,borderColor:C.border,backgroundColor:'#F8FAFD',paddingHorizontal:14,color:C.text,fontSize:15},button:{backgroundColor:C.primary,borderRadius:14,minHeight:52,alignItems:'center',justifyContent:'center',marginTop:6,elevation:4},buttonText:{color:C.white,fontWeight:'900',fontSize:15},error:{color:C.danger,textAlign:'right',fontWeight:'700'},note:{fontSize:11,color:C.muted,textAlign:'center',lineHeight:18,marginTop:4},footer:{textAlign:'center',color:C.muted,fontSize:11,fontWeight:'700'}
});