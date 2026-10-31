import { StyleSheet } from 'react-native';
import { COLORS } from './colors';
export const splashStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, 
  logoFrame: { width: 140, height: 140, borderRadius: 30, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.indigo200, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.blue, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 7 }, elevation: 8, overflow: 'hidden' }, 
  logo: { width: 96, height: 96 },
  title: { marginTop: 12, color: COLORS.navy, fontSize: 26, fontWeight: '900' },
  caption: { marginTop: 6, color: COLORS.teal, fontSize: 13, fontWeight: '700' },
  loadingTrack: { marginTop: 22, width: 120, height: 4, borderRadius: 3, backgroundColor: COLORS.border, overflow: 'hidden' },
  loadingFill: { width: '65%', height: '100%', backgroundColor: COLORS.teal, borderRadius: 3 },
});
