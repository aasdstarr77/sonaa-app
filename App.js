import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

const API = 'https://sonaa-backend-v2.vercel.app/api/services';

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API).then(r=>r.json()).then(d=>{
      setCategories(d.categories);
      setSelected(d.categories[0]);
      setLoading(false);
    });
  }, []);

  if(loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#3B82F6"/>
      <Text style={{marginTop:10}}>جاري التحميل من قاعدة البيانات...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>صنعة - {categories.length} فئة حقيقية</Text>
      <Text style={styles.sub}>متصل بـ 【entity-MongoDB¦canonical_name=MongoDB】 - Live API</Text>

      <FlatList
        data={categories}
        numColumns={2}
        keyExtractor={i=>i.label}
        renderItem={({item})=>{
          const active = selected?.label === item.label;
          return (
            <TouchableOpacity onPress={()=>setSelected(item)} style={[styles.card, active && styles.cardActive]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.label, active && {color:'white'}]}>{item.label}</Text>
              <Text style={styles.count}>{item.services.length} خدمة</Text>
            </TouchableOpacity>
          )
        }}
      />

      {selected && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{selected.emoji} {selected.label}</Text>
          <ScrollView>
            {selected.services.map((s,i)=>(
              <View key={i} style={styles.serviceRow}>
                <Text>{s}</Text>
                <Text style={{color:'#3B82F6'}}>+</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1, backgroundColor:'#F8FAFC', paddingTop:60, paddingHorizontal:12},
  center:{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#F8FAFC'},
  title:{fontSize:22, fontWeight:'bold', color:'#0F172A'},
  sub:{color:'#64748B', marginBottom:16, marginTop:4},
  card:{flex:1, backgroundColor:'white', borderRadius:20, padding:14, margin:6, borderWidth:1, borderColor:'#E2E8F0'},
  cardActive:{backgroundColor:'#0F172A', borderColor:'#0F172A'},
  emoji:{fontSize:32},
  label:{fontWeight:'bold', marginTop:6, color:'#0F172A'},
  count:{color:'#64748B', fontSize:12, marginTop:2},
  sheet:{backgroundColor:'white', borderTopLeftRadius:20, borderTopRightRadius:20, padding:14, maxHeight:300, marginTop:10, borderTopWidth:1, borderColor:'#E2E8F0'},
  sheetTitle:{fontWeight:'bold', fontSize:16, marginBottom:8},
  serviceRow:{flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F1F5F9'}
});
