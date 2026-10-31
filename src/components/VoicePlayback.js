import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { API_BASE } from '../services/api';
import { styles } from '../theme/styles';
function VoicePlayback({ orderSN, token, hasVoiceRecording }) {
  const [sound, setSound] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { if (sound) sound.unloadAsync().catch(() => {}); }, [sound]);
  async function togglePlayback() {
    if (!hasVoiceRecording || loading) return;
    if (playing && sound) { try { await sound.stopAsync(); await sound.unloadAsync(); } catch (_) {} setSound(null); setPlaying(false); return; }
    try {
      setLoading(true); await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const uri = API_BASE + '/orders/' + encodeURIComponent(String(orderSN)) + '/voice';
      const created = await Audio.Sound.createAsync({ uri, headers: { Authorization: 'Bearer ' + token } }, { shouldPlay: true });
      setSound(created.sound); setPlaying(true);
      created.sound.setOnPlaybackStatusUpdate(status => { if (status.didJustFinish) { created.sound.unloadAsync().catch(() => {}); setSound(null); setPlaying(false); } });
    } catch (error) { Alert.alert('تعذر تشغيل وصف العميل', error?.message || 'تأكد من اتصال الإنترنت وحاول مرة أخرى.'); }
    finally { setLoading(false); }
  }
  if (!hasVoiceRecording) return null;
  return <TouchableOpacity style={[styles.voicePlaybackButton, (loading || !orderSN || !token) && { opacity: 0.6 }]} onPress={togglePlayback} disabled={loading || !orderSN || !token}>
    <Text style={styles.voicePlaybackText}>{loading ? '⏳ جارٍ تحميل التسجيل...' : playing ? '⏹ إيقاف تسجيل العميل' : '🔊 استمع إلى وصف العميل الصوتي'}</Text>
  </TouchableOpacity>;
}
export default VoicePlayback;
