import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { styles } from '../theme/styles';
function VoiceRecorder({ value, onChange, disabled }) {
  const [recording, setRecording] = useState(null);
  const recordingRef = useRef(null);
  const [recordingNow, setRecordingNow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);
  async function stopPreview() {
    if (sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch (_) {} setSound(null); }
    setPlaying(false);
  }
  async function startRecording() {
    if (disabled || recordingNow || busy) return;
    try {
      setBusy(true);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert('السماح بالميكروفون', 'اسمح للتطبيق باستخدام الميكروفون لتسجيل وصف الطلب.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = created.recording; setRecording(created.recording); setRecordingNow(true); setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(current => {
          if (current >= 29) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; finishRecording(); return 30; }
          return current + 1;
        });
      }, 1000);
    } catch (error) { Alert.alert('تعذر بدء التسجيل', error?.message || 'راجع إذن الميكروفون وحاول مرة أخرى.'); }
    finally { setBusy(false); }
  }
  async function finishRecording() {
    const active = recordingRef.current;
    if (!active || busy) return;
    setBusy(true);
    try {
      if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
      recordingRef.current = null; setRecording(null); setRecordingNow(false);
      await active.stopAndUnloadAsync();
      const uri = active.getURI();
      if (!uri) throw new Error('لم يتم حفظ التسجيل؛ حاول مرة أخرى.');
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || !info.size || info.size > 360000) throw new Error('التسجيل كبير أو فارغ؛ سجّل وصفًا أقصر.');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64) throw new Error('التسجيل فارغ؛ حاول مرة أخرى.');
      onChange('data:audio/mp4;base64,' + base64);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    } catch (error) { onChange(''); Alert.alert('تعذر حفظ التسجيل', error?.message || 'حاول تسجيل الوصف مرة أخرى.'); }
    finally { setRecordingNow(false); setBusy(false); }
  }
  async function previewRecording() {
    if (!value || busy || recordingNow) return;
    if (playing) { await stopPreview(); return; }
    try {
      setBusy(true); await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const created = await Audio.Sound.createAsync({ uri: value }, { shouldPlay: true });
      setSound(created.sound); setPlaying(true);
      created.sound.setOnPlaybackStatusUpdate(status => { if (status.didJustFinish) { created.sound.unloadAsync().catch(() => {}); setSound(null); setPlaying(false); } });
    } catch (error) { Alert.alert('تعذر تشغيل التسجيل', error?.message || 'حاول مرة أخرى.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.voiceRecorderBox}>
    <Text style={styles.voiceRecorderTitle}>🎙️ وصف الطلب بالتسجيل الصوتي (اختياري)</Text>
    <Text style={styles.voiceRecorderHint}>تقدر تسجّل وصفك بدل الكتابة أو تضيفه مع الوصف المكتوب. الحد الأقصى 30 ثانية.</Text>
    {recordingNow ? <Text style={styles.voiceRecorderTimer}>جاري التسجيل: {seconds} ثانية</Text> : null}
    <View style={styles.voiceRecorderActions}>
      {recordingNow
        ? <TouchableOpacity style={[styles.voiceActionButton, styles.voiceStopButton]} onPress={finishRecording} disabled={busy}><Text style={styles.voiceActionText}>{busy ? 'جارٍ الحفظ...' : '⏹ إيقاف وحفظ'}</Text></TouchableOpacity>
        : <TouchableOpacity style={[styles.voiceActionButton, styles.voiceRecordButton]} onPress={startRecording} disabled={disabled || busy}><Text style={styles.voiceActionText}>{busy ? 'لحظة...' : value ? '🔁 تسجيل من جديد' : '🔴 بدء التسجيل'}</Text></TouchableOpacity>}
      {value && !recordingNow ? <TouchableOpacity style={[styles.voiceActionButton, styles.voiceListenButton]} onPress={previewRecording} disabled={busy}><Text style={styles.voiceActionText}>{playing ? '⏸ إيقاف الاستماع' : '▶️ سماع التسجيل'}</Text></TouchableOpacity> : null}
      {value && !recordingNow ? <TouchableOpacity style={[styles.voiceActionButton, styles.voiceDeleteButton]} onPress={() => { stopPreview(); onChange(''); setSeconds(0); }} disabled={busy}><Text style={styles.voiceActionText}>🗑 حذف</Text></TouchableOpacity> : null}
    </View>
    {value && !recordingNow ? <Text style={styles.voiceRecorderSaved}>✓ التسجيل جاهز للإرسال</Text> : null}
  </View>;
}
export default VoiceRecorder;
