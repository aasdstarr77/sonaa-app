import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AdminUsersManager } from './AdminUsersManager';
import { api } from '../services/api';
import { CON_COLORS as C } from '../theme/con-colors';
import { canRead, getPermissions, isRoot } from './permissions';

const SECTIONS = [
 {key:'dashboard',label:'الرئيسية',path:'/admin/counts',title:'مؤشرات المنصة',fields:['technicians','verifiedTechnicians','clients']},
 {key:'orders',label:'الطلبات',path:'/admin/orders?limit=100',title:'طلبات العملاء',fields:['sn','status','service','clientName','clientPhone','createdAt','offersCount','voiceReviewed']},
 {key:'fannis',label:'الفنيون',path:'/admin/fannis?limit=100',title:'الفنيون',fields:['name','phone','status','adminRole','specialties','areas']},
 {key:'clients',label:'العملاء',path:'/admin/clients?limit=100',title:'العملاء',fields:['name','phone','createdAt']},
 {key:'complaints',label:'الشكاوى',path:'/admin/complaints?limit=100',title:'الشكاوى',fields:['name','phone','status','text','createdAt']},
 {key:'topups',label:'طلبات الشحن',path:'/admin/topup-requests?limit=100',title:'طلبات الشحن',fields:['name','phone','amount','status','createdAt']},
 {key:'regions',label:'المناطق',path:'/admin/regions',title:'المناطق',fields:['name','isActive','isDeleted']},
 {key:'services',label:'الخدمات والمهن',path:'/admin/services',title:'الخدمات والمهن',fields:['name','label','category','isActive']},
 {key:'pricing',label:'التسعير',path:'/admin/pricing',title:'إعدادات التسعير',fields:['check','commission','minOffer','maxOffer']},
 {key:'settings',label:'الإعدادات',path:'/admin/settings',title:'إعدادات المنصة',fields:['siteName','maintenance']},
 {key:'content',label:'المحتوى',path:'/admin/content',title:'إدارة المحتوى',fields:['title','body','active']},
 {key:'support',label:'خدمة العملاء',path:'/support/admin?needsHuman=true',title:'حالات خدمة العملاء',fields:['name','phone','status','lastMessage','updatedAt']},
 {key:'notifications',label:'الإشعارات',path:'/admin/notifications',title:'الإشعارات',fields:['title','body','createdAt']},
 {key:'passwordRecovery',label:'استعادة الحساب',path:'/password-recovery/admin/requests',title:'طلبات استعادة الحساب',fields:['phone','status','createdAt']},
 {key:'clientsData',label:'بيانات العملاء',path:'/admin/client-accounts',title:'حسابات العملاء',fields:['name','phone','createdAt']},
];
const ROOT_SECTIONS = [
 {key:'adminUsers',label:'حسابات الإدارة',path:'/admin/admin-users',title:'المديرون والمشرفون',fields:['name','phone','adminRole','status']},
 {key:'audit',label:'سجل التدقيق',path:'/admin/audit-logs',title:'سجل عمليات الإدارة',fields:['action','category','target','adminName','createdAt']}
];
const arrayFrom=(value)=>Array.isArray(value)?value:Object.values(value||{}).find(Array.isArray)||[];
const pickArray=(data)=>{if(Array.isArray(data))return data;if(!data||typeof data!=='object')return[];for(const k of ['data','items','orders','fannis','clients','regions','services','complaints','requests','users','logs','supportCases','topups'])if(Array.isArray(data[k]))return data[k];return Object.keys(data).length?[data]:[]};
const fmt=(v)=>{if(v===null||v===undefined||v==='')return '—';if(typeof v==='boolean')return v?'نعم':'لا';if(Array.isArray(v))return v.join('، ');if(typeof v==='object')return JSON.stringify(v);return String(v)};
export function ConsoleScreen({session,profile,onLogout}) {
 const perms=useMemo(()=>getPermissions(profile),[profile]);
 const root=isRoot(profile);
 const [active,setActive]=useState('dashboard');
 const [data,setData]=useState([]);
 const [counts,setCounts]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const sections=useMemo(()=>[...SECTIONS.filter(s=>canRead(perms,s.key)),...(root?ROOT_SECTIONS:[])],[perms,root]);
 const section=sections.find(s=>s.key===active)||sections[0];
 const load=useCallback(async()=>{
  if(!section)return;
  setBusy(true);setError('');
  try{
   const result=await api(section.path,{token:session.token});
   if(section.key==='dashboard'){setCounts(result.counts||result);setData([]);}
   else setData(pickArray(result));
  }catch(e){setError(e.message||'تعذر تحميل البيانات.');setData([]);}
  finally{setBusy(false);}
 },[section,session.token]);
 useEffect(()=>{load();},[load]);
 const visibleData=useMemo(()=>data.filter(item=>!search||JSON.stringify(item).toLowerCase().includes(search.toLowerCase())),[data,search]);
 const stats=counts||{};
 return <View style={s.root}>
  <View style={s.header}>
   <View style={s.headerTop}><View style={s.brandWrap}><Text style={s.brand}>صُنّاع CON</Text><Text style={s.caption}>{profile?.adminRoleLabel||profile?.adminRole||'الإدارة'}</Text></View><TouchableOpacity onPress={onLogout} style={s.logout}><Text style={s.logoutText}>خروج</Text></TouchableOpacity></View>
   <Text style={s.welcome}>أهلًا {profile?.name||'بك'}</Text>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.nav} contentContainerStyle={s.navContent}>
   {sections.map(item=><TouchableOpacity key={item.key} onPress={()=>{setActive(item.key);setSearch('');}} style={[s.navItem,active===item.key&&s.navActive]}><Text style={[s.navText,active===item.key&&s.navTextActive]}>{item.label}</Text></TouchableOpacity>)}
  </ScrollView>
  <View style={s.content}>
   <View style={s.sectionHead}><View style={{flex:1}}><Text style={s.sectionTitle}>{section?.title||'لوحة الإدارة'}</Text><Text style={s.sectionSub}>{root?'صلاحيات الأدمن الرئيسي الكاملة':'الأقسام المعروضة حسب صلاحيات حسابك'}</Text></View><TouchableOpacity onPress={load} style={s.refresh}><Text style={s.refreshText}>تحديث</Text></TouchableOpacity></View>
   {section?.key==='dashboard'?<View style={s.metrics}>
    <Metric label="إجمالي الفنيين" value={stats.technicians}/>
    <Metric label="الفنيون المعتمدون" value={stats.verifiedTechnicians}/>
    <Metric label="العملاء" value={stats.clients}/>
   </View>:<TextInput value={search} onChangeText={setSearch} placeholder="ابحث داخل النتائج..." placeholderTextColor={C.muted} textAlign="right" style={s.search}/>}
   {busy?<View style={s.loading}><ActivityIndicator color={C.accent} size="large"/><Text style={s.muted}>جاري تحميل البيانات...</Text></View>:error?<View style={s.errorCard}><Text style={s.errorText}>{error}</Text><Text style={s.muted}>قد تكون هذه العملية غير متاحة لدورك أو أن المسار غير مدعوم من الخادم.</Text></View>:section?.key==='dashboard'?<View style={s.infoCard}><Text style={s.cardTitle}>مركز متابعة صُنّاع</Text><Text style={s.cardText}>استخدم الأقسام بالأعلى لمتابعة العمليات المسموح بها لحسابك. كل طلب يُراجع الخادم صلاحية الوصول إليه قبل إرجاع البيانات أو تنفيذ أي إجراء.</Text><Text style={s.cardFoot}>عدد الأقسام المتاحة: {sections.length}</Text></View>:section?.key==='adminUsers'?<AdminUsersManager session={session} profile={profile} users={visibleData} onRefresh={load}/>:<FlatList data={visibleData} keyExtractor={(item,i)=>String(item._id||item.id||item.sn||i)} contentContainerStyle={{paddingBottom:28}} ListEmptyComponent={<Text style={s.empty}>لا توجد بيانات للعرض أو لا توجد نتائج مطابقة.</Text>} renderItem={({item,index})=><RecordCard item={item} index={index} fields={section?.fields||[]}/>}/>}
  </View>
 </View>;
}
function Metric({label,value}){return <View style={s.metric}><Text style={s.metricValue}>{value===undefined?'—':String(value)}</Text><Text style={s.metricLabel}>{label}</Text></View>}
function RecordCard({item,index,fields}){const keys=fields.filter(k=>item[k]!==undefined);const extras=Object.keys(item).filter(k=>!['_id','id','__v','passwordHash','token','voiceRecordingData'].includes(k)&&!fields.includes(k)).slice(0,2);return <View style={s.record}><Text style={s.recordTitle}>{fmt(item.name||item.title||item.sn||item.action||'عنصر '+(index+1))}</Text>{[...keys,...extras].slice(0,7).map(k=><View key={k} style={s.recordLine}><Text style={s.recordValue}>{fmt(item[k])}</Text><Text style={s.recordKey}>{k}</Text></View>)}</View>}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.background},header:{backgroundColor:C.surface,paddingHorizontal:16,paddingTop:12,paddingBottom:10,borderBottomWidth:1,borderBottomColor:C.border},headerTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},brandWrap:{alignItems:'flex-end'},brand:{fontSize:21,fontWeight:'900',color:C.primary},caption:{fontSize:11,color:C.accent,fontWeight:'800',marginTop:2},welcome:{textAlign:'right',fontSize:13,color:C.text,marginTop:8,fontWeight:'700'},logout:{backgroundColor:'#FCE8E9',borderWidth:1,borderColor:'#F2C5C9',borderRadius:11,paddingHorizontal:15,paddingVertical:8},logoutText:{color:C.danger,fontWeight:'900'},
 nav:{maxHeight:54,backgroundColor:C.surface,borderBottomWidth:1,borderBottomColor:C.border},navContent:{alignItems:'center',paddingHorizontal:10,gap:7},navItem:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:C.background,borderWidth:1,borderColor:C.border},navActive:{backgroundColor:C.primary,borderColor:C.primary},navText:{fontSize:12,fontWeight:'800',color:C.primary},navTextActive:{color:C.white},
 content:{flex:1,padding:14},sectionHead:{flexDirection:'row-reverse',alignItems:'center',gap:10,marginBottom:12},sectionTitle:{fontSize:18,fontWeight:'900',color:C.primary,textAlign:'right'},sectionSub:{fontSize:11,color:C.muted,textAlign:'right',marginTop:3},refresh:{backgroundColor:C.accentSoft,paddingHorizontal:14,paddingVertical:9,borderRadius:11},refreshText:{color:C.primary,fontWeight:'900'},
 metrics:{flexDirection:'row-reverse',gap:8},metric:{flex:1,backgroundColor:C.surface,borderRadius:15,padding:12,borderWidth:1,borderColor:C.border,alignItems:'center',minHeight:85,justifyContent:'center'},metricValue:{fontSize:23,fontWeight:'900',color:C.primary},metricLabel:{fontSize:10,fontWeight:'800',color:C.muted,textAlign:'center',marginTop:4},
 search:{backgroundColor:C.surface,borderWidth:1,borderColor:C.border,borderRadius:12,paddingHorizontal:13,paddingVertical:10,color:C.text,marginBottom:10},loading:{padding:30,alignItems:'center',gap:10},muted:{color:C.muted,fontSize:12,textAlign:'right',marginTop:5},errorCard:{padding:15,borderRadius:14,backgroundColor:'#FFF1F2',borderWidth:1,borderColor:'#F2C5C9',gap:7},errorText:{color:C.danger,fontWeight:'800',textAlign:'right'},infoCard:{backgroundColor:C.surface,borderRadius:18,padding:18,borderWidth:1,borderColor:C.border,marginTop:12},cardTitle:{fontSize:16,fontWeight:'900',color:C.primary,textAlign:'right'},cardText:{fontSize:13,color:C.text,textAlign:'right',lineHeight:22,marginTop:10},cardFoot:{fontSize:12,color:C.accent,fontWeight:'900',textAlign:'right',marginTop:15},empty:{textAlign:'center',color:C.muted,padding:28,fontSize:13},record:{backgroundColor:C.surface,borderRadius:14,padding:13,marginBottom:9,borderWidth:1,borderColor:C.border},recordTitle:{fontSize:14,fontWeight:'900',color:C.primary,textAlign:'right',marginBottom:7},recordLine:{flexDirection:'row-reverse',justifyContent:'space-between',gap:12,paddingVertical:4,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},recordKey:{fontSize:11,color:C.muted,fontWeight:'700',flex:1,textAlign:'right'},recordValue:{fontSize:12,color:C.text,flex:2,textAlign:'left'}
});