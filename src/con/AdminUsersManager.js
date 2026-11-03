import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { CON_COLORS as C } from '../theme/con-colors';
import { PERMISSION_KEYS, getPermissions } from './permissions';

const ROLES=['مدير','مشرف أول','مشرف','قراءة فقط'];
const LABELS={dashboard:'لوحة المؤشرات',fannis:'الفنيون',orders:'الطلبات',publishOrders:'نشر الطلبات',voiceReview:'مراجعة الصوت',passwordRecovery:'استعادة الحساب',complaints:'الشكاوى',services:'الخدمات والمهن',clients:'العملاء',topups:'طلبات الشحن',wallet:'المحافظ',pricing:'التسعير',settings:'الإعدادات',content:'المحتوى',support:'خدمة العملاء',regions:'المناطق',offers:'العروض',notifications:'الإشعارات',clientsData:'بيانات العملاء'};
const listOf=(v)=>Array.isArray(v)?v:Object.values(v||{}).find(Array.isArray)||[];
export function AdminUsersManager({session,profile,users,onRefresh}){
 const [saving,setSaving]=useState('');
 const [editing,setEditing]=useState(null);
 const [matrix,setMatrix]=useState({});
 const [candidates,setCandidates]=useState([]);
 const [showCandidates,setShowCandidates]=useState(false);
 const [candidateRole,setCandidateRole]=useState('مشرف');
 const [candidateBusy,setCandidateBusy]=useState(false);
 const beginPermissions=(user)=>{
  const p=getPermissions({role:'admin',adminRole:user.adminRole||'مشرف',adminPermissions:user.adminPermissions||{}});
  setMatrix(Object.fromEntries(PERMISSION_KEYS.map(k=>[k,{read:p[k]?.read===true,write:p[k]?.write===true}])));
  setEditing(user);
 };
 const toggle=(key,field,value)=>setMatrix(current=>({...current,[key]:{...current[key],[field]:field==='read'?value:(value?true:false),...(field==='write'&&value?{read:true}:{})}}));
 const savePermissions=async()=>{
  if(!editing)return;setSaving(editing.id||editing._id);
  try{await api('/admin/admin-users/'+(editing.id||editing._id)+'/permissions',{method:'PATCH',token:session.token,body:{permissions:matrix}});setEditing(null);Alert.alert('تم الحفظ','تم تحديث صلاحيات المشرف.');onRefresh();}
  catch(e){Alert.alert('تعذر الحفظ',e.message);}finally{setSaving('');}
 };
 const changeRole=async(user,role)=>{
  const id=user.id||user._id;setSaving(id);
  try{await api('/admin/admin-users/'+id+'/role',{method:'PATCH',token:session.token,body:{role}});Alert.alert('تم التحديث','تم تغيير المنصب إلى '+role);onRefresh();}
  catch(e){Alert.alert('تعذر التحديث',e.message);}finally{setSaving('');}
 };
 const revoke=(user)=>Alert.alert('سحب الصلاحية الإدارية','سيظل حساب الفني محفوظًا، لكن سيتم سحب دخوله الإداري.',[{text:'إلغاء',style:'cancel'},{text:'سحب الصلاحية',style:'destructive',onPress:async()=>{const id=user.id||user._id;setSaving(id);try{await api('/admin/admin-users/'+id,{method:'DELETE',token:session.token});onRefresh();}catch(e){Alert.alert('تعذر السحب',e.message);}finally{setSaving('');}}}]);
 const loadCandidates=async()=>{
  setCandidateBusy(true);setShowCandidates(true);
  try{const result=await api('/admin/fannis?limit=100',{token:session.token});setCandidates(listOf(result).filter(x=>x.status==='معتمد'&&!x.adminRole&&x.role!=='admin'));}
  catch(e){Alert.alert('تعذر تحميل الفنيين',e.message);setCandidates([]);}
  finally{setCandidateBusy(false);}
 };
 const promote=async(user)=>{
  setSaving(user._id);try{await api('/admin/admin-users',{method:'POST',token:session.token,body:{fanniId:user._id,role:candidateRole}});Alert.alert('تم التعيين','تم تعيين '+(user.name||'الفني')+' بمنصب '+candidateRole);setCandidates(v=>v.filter(x=>x._id!==user._id));onRefresh();}
  catch(e){Alert.alert('تعذر التعيين',e.message);}finally{setSaving('');}
 };
 return <View style={{gap:10,paddingBottom:28}}>
  <View style={a.intro}><Text style={a.title}>إدارة حسابات الإدارة</Text><Text style={a.sub}>هذه الأدوات متاحة للأدمن الرئيسي فقط، والخادم يتحقق من الصلاحية قبل أي تعديل.</Text><TouchableOpacity onPress={loadCandidates} style={a.primary}><Text style={a.primaryText}>إضافة مشرف أو مدير من الفنيين المعتمدين</Text></TouchableOpacity></View>
  {users.map((user,i)=><View key={user.id||user._id||i} style={a.card}>
   <Text style={a.name}>{user.name||'حساب إداري'}</Text><Text style={a.meta}>{user.phone||'—'} • {user.adminRole||'مشرف'}</Text>
   <View style={a.roles}>{ROLES.map(role=><TouchableOpacity key={role} disabled={!!saving} onPress={()=>changeRole(user,role)} style={[a.role, user.adminRole===role&&a.roleActive]}><Text style={[a.roleText,user.adminRole===role&&a.roleTextActive]}>{role}</Text></TouchableOpacity>)}</View>
   <View style={a.actions}><TouchableOpacity onPress={()=>beginPermissions(user)} style={a.secondary}><Text style={a.secondaryText}>تخصيص الصلاحيات</Text></TouchableOpacity><TouchableOpacity onPress={()=>revoke(user)} style={a.danger}><Text style={a.dangerText}>سحب الصلاحية</Text></TouchableOpacity></View>
   {saving===(user.id||user._id)?<Text style={a.pending}>جارٍ تنفيذ التغيير...</Text>:null}
  </View>)}
  <Modal visible={!!editing} animationType="slide" onRequestClose={()=>setEditing(null)}>
   <View style={a.modal}><View style={a.modalHead}><Text style={a.title}>صلاحيات {editing?.name||'المشرف'}</Text><TouchableOpacity onPress={()=>setEditing(null)}><Text style={a.close}>إغلاق</Text></TouchableOpacity></View>
    <Text style={a.sub}>حدد القراءة والتنفيذ لكل قسم. صلاحية التنفيذ تتضمن القراءة تلقائيًا.</Text>
    <ScrollView style={{flex:1}}>{PERMISSION_KEYS.map(key=><View key={key} style={a.permissionRow}><Text style={a.permissionName}>{LABELS[key]||key}</Text><View style={a.switchCol}><Text style={a.switchLabel}>قراءة</Text><Switch value={!!matrix[key]?.read} onValueChange={v=>toggle(key,'read',v)} trackColor={{true:C.accent}}/></View><View style={a.switchCol}><Text style={a.switchLabel}>تنفيذ</Text><Switch value={!!matrix[key]?.write} onValueChange={v=>toggle(key,'write',v)} trackColor={{true:C.primary}}/></View></View>)}</ScrollView>
    <TouchableOpacity disabled={!!saving} onPress={savePermissions} style={a.primary}><Text style={a.primaryText}>{saving?'جارٍ الحفظ...':'حفظ الصلاحيات'}</Text></TouchableOpacity>
   </View>
  </Modal>
  <Modal visible={showCandidates} animationType="slide" onRequestClose={()=>setShowCandidates(false)}>
   <View style={a.modal}><View style={a.modalHead}><Text style={a.title}>اختيار فني لتعيينه إداريًا</Text><TouchableOpacity onPress={()=>setShowCandidates(false)}><Text style={a.close}>إغلاق</Text></TouchableOpacity></View>
    <View style={a.roles}>{ROLES.map(role=><TouchableOpacity key={role} onPress={()=>setCandidateRole(role)} style={[a.role,candidateRole===role&&a.roleActive]}><Text style={[a.roleText,candidateRole===role&&a.roleTextActive]}>{role}</Text></TouchableOpacity>)}</View>
    {candidateBusy?<Text style={a.sub}>جاري تحميل الفنيين...</Text>:<ScrollView style={{flex:1}}>{candidates.map(item=><View key={item._id} style={a.candidate}><View style={{flex:1}}><Text style={a.name}>{item.name}</Text><Text style={a.meta}>{item.phone} • {item.status}</Text></View><TouchableOpacity disabled={!!saving} onPress={()=>promote(item)} style={a.primarySmall}><Text style={a.primaryText}>تعيين</Text></TouchableOpacity></View>)}{!candidates.length?<Text style={a.sub}>لا يوجد فنيون معتمدون متاحون للتعيين.</Text>:null}</ScrollView>}
   </View>
  </Modal>
 </View>;
}
const a=StyleSheet.create({
 intro:{backgroundColor:C.surface,borderRadius:15,padding:14,borderWidth:1,borderColor:C.border,gap:8},title:{fontSize:17,fontWeight:'900',color:C.primary,textAlign:'right'},sub:{fontSize:12,color:C.muted,textAlign:'right',lineHeight:19},card:{backgroundColor:C.surface,borderRadius:14,padding:13,borderWidth:1,borderColor:C.border,gap:8},name:{fontSize:14,fontWeight:'900',color:C.primary,textAlign:'right'},meta:{fontSize:11,color:C.muted,textAlign:'right'},roles:{flexDirection:'row-reverse',flexWrap:'wrap',gap:6},role:{borderWidth:1,borderColor:C.border,borderRadius:18,paddingHorizontal:9,paddingVertical:7,backgroundColor:C.background},roleActive:{backgroundColor:C.primary,borderColor:C.primary},roleText:{fontSize:10,fontWeight:'800',color:C.primary},roleTextActive:{color:C.white},actions:{flexDirection:'row-reverse',gap:8,marginTop:2},secondary:{flex:1,backgroundColor:C.accentSoft,borderRadius:10,padding:10,alignItems:'center'},secondaryText:{fontSize:11,color:C.primary,fontWeight:'900'},danger:{backgroundColor:'#FCE8E9',borderRadius:10,padding:10,alignItems:'center'},dangerText:{fontSize:11,color:C.danger,fontWeight:'900'},pending:{fontSize:11,color:C.accent,textAlign:'right'},primary:{backgroundColor:C.primary,borderRadius:12,padding:13,alignItems:'center',marginTop:4},primaryText:{color:C.white,fontWeight:'900',fontSize:12},primarySmall:{backgroundColor:C.primary,borderRadius:10,paddingHorizontal:14,paddingVertical:9,alignItems:'center'},modal:{flex:1,backgroundColor:C.background,padding:16,paddingTop:30,gap:10},modalHead:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center'},close:{fontSize:13,color:C.accent,fontWeight:'900'},permissionRow:{backgroundColor:C.surface,borderRadius:12,borderWidth:1,borderColor:C.border,padding:9,marginBottom:7,flexDirection:'row-reverse',alignItems:'center',gap:8},permissionName:{flex:1,fontSize:12,color:C.text,fontWeight:'800',textAlign:'right'},switchCol:{alignItems:'center',minWidth:56},switchLabel:{fontSize:10,color:C.muted,fontWeight:'800'},candidate:{flexDirection:'row-reverse',alignItems:'center',gap:8,backgroundColor:C.surface,padding:11,borderRadius:12,borderWidth:1,borderColor:C.border,marginBottom:8}
});