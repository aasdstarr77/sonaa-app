import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../theme/styles';
import { Button, Field } from '../../components/FormControls';
export function SupportScreen({ session, screenHistoryRef, screenRef, setScreenState, setSupportCase, supportSubject, setSupportSubject, supportDraft, setSupportDraft, startSupportCase, supportCases, openSupportCase, supportCase, dateLabel, sendSupportMessage, supportLoading }) {
return <SafeAreaView style={styles.supportSafe}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.title}>دعم صُنّاع</Text></View><Button title="رجوع" secondary onPress={() => { screenHistoryRef.current.pop(); const target = session.role === 'client' ? 'client' : 'technician'; screenRef.current = target; setScreenState(target); setSupportCase(null); }} /></View>
      <ScrollView contentContainerStyle={styles.supportPage}>
        <View style={styles.formCard}><Text style={styles.cardTitlePremium}>محادثة جديدة</Text><Field label="عنوان المشكلة" value={supportSubject} onChangeText={setSupportSubject} /><Field label="رسالتك" value={supportDraft} onChangeText={setSupportDraft} returnKeyType="send" onSubmitEditing={startSupportCase} blurOnSubmit /><Button title="إرسال وفتح محادثة الدعم" onPress={startSupportCase} disabled={supportLoading} /></View>
        {supportCases.map(item => <TouchableOpacity key={String(item._id)} onPress={() => openSupportCase(item)} style={styles.dataCard}><Text style={styles.cardTitleSmall}>{item.subject || 'استفسار عام'}</Text><Text style={styles.detail}>{dateLabel(item.lastMessageAt || item.createdAt)}</Text></TouchableOpacity>)}
        {supportCase ? <View style={styles.chatPanelPremium}><Text style={styles.sectionTitleSmall}>{supportCase.subject || 'محادثة الدعم'}</Text>{(supportCase.messages || []).map((message, index) => <View key={String(message._id || index)} style={styles.chatMessage}><Text style={styles.detailSmall}>{message.senderRole === 'admin' ? 'دعم صُنّاع' : 'أنت'} • {dateLabel(message.createdAt)}</Text><Text style={styles.chatMessageText}>{message.text}</Text></View>)}<Field label="اكتب ردك" value={supportDraft} onChangeText={setSupportDraft} returnKeyType="send" onSubmitEditing={() => sendSupportMessage(false)} blurOnSubmit /><Button title="إرسال" onPress={() => sendSupportMessage(false)} /></View> : null}
      </ScrollView>
    </SafeAreaView>;
}
