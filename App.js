import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import AppScreens from './src/screens/AppScreens';
import StartupErrorBoundary from './src/components/StartupErrorBoundary';
import { styles } from './src/theme/styles';
import { splashStyles } from './src/theme/splashStyles';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [headerInitial, setHeaderInitial] = useState('');
  const handleScreenChange = useCallback((screen, initial) => {
    setCurrentScreen(screen);
    if (initial !== undefined) setHeaderInitial(initial);
  }, []);
  const [showSplash, setShowSplash] = useState(true);
  const spin = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const showBrandHeader = !['home', 'login'].includes(currentScreen);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(spin, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    animation.start();
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => { animation.stop(); clearTimeout(timer); };
  }, [spin]);

  const logoRotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '18deg'] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-76, 76] });

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(650),
      Animated.timing(shimmer, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(1050),
    ]));
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  return <View style={styles.appRoot}>
    {showBrandHeader ? <SafeAreaView style={styles.brandHeaderSafe}>
      <View style={styles.brandHeader}>
        {headerInitial ? <View style={styles.brandHeaderAvatar}><Text style={styles.brandHeaderAvatarText}>{headerInitial}</Text></View> : null}
        <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.brandHeaderLogo} resizeMode="contain" />
        <View style={styles.brandHeaderTitleWrap}>
          <Text style={styles.brandHeaderTitle}>صُنّاع</Text>
          <Animated.View pointerEvents="none" style={[styles.brandHeaderShimmer, { transform: [{ translateX: shimmerTranslate }] }]}>
            <LinearGradient colors={['transparent', 'rgba(255,255,255,0.95)', 'rgba(100,220,238,0.72)', 'transparent']} locations={[0, 0.42, 0.58, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.brandHeaderShimmerGradient} />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView> : null}
    <View style={styles.appScreenArea}><AppScreens onScreenChange={handleScreenChange} /></View>
    {showSplash ? <View style={splashStyles.overlay}>
      <View style={splashStyles.logoFrame}>
        <Animated.Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={[splashStyles.logo, { transform: [{ rotate: logoRotation }] }]} resizeMode="contain" />
      </View>
      <Text style={splashStyles.title}>صُنّاع</Text>
      <Text style={splashStyles.caption}>كل خدمة تبدأ بخطوة</Text>
      <View style={splashStyles.loadingTrack}><View style={splashStyles.loadingFill} /></View>
    </View> : null}
  </View>;
}
export default function App() {
  return <SafeAreaProvider><StartupErrorBoundary><AppContent /></StartupErrorBoundary></SafeAreaProvider>;
}

