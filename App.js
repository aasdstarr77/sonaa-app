import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, Image } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Mask, Rect, Stop, Text as SvgText } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
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
  const shimmerX = useRef(new Animated.Value(0)).current;
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
  useEffect(() => {
    shimmerX.setValue(0);
    const animation = Animated.loop(Animated.timing(shimmerX, {
      toValue: -163,
      duration: 2100,
      easing: Easing.linear,
      useNativeDriver: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [shimmerX]);

  return <View style={styles.appRoot}>
    {showBrandHeader ? <SafeAreaView style={styles.brandHeaderSafe}>
      <View style={styles.brandHeader}>
        {headerInitial ? <View style={styles.brandHeaderAvatar}><Text style={styles.brandHeaderAvatarText}>{headerInitial}</Text></View> : null}
        <Image source={require("./assets/LOGO_UPLOAD_HERE/logo.png")} style={styles.brandHeaderLogo} resizeMode="contain" />
        <View style={styles.brandHeaderTitleWrap}>
          <Text style={styles.brandHeaderTitle}>صُنّاع</Text>
          <Svg pointerEvents="none" width={68} height={30} viewBox="0 0 68 30" style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <Mask id="sonaaBrandTextMask" maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="30">
                <SvgText x="34" y="22" textAnchor="middle" fontSize="18" fontWeight="900" letterSpacing="0.3" fill="#fff">صُنّاع</SvgText>
              </Mask>
              <SvgLinearGradient id="sonaaBrandShine" x1="0" y1="0" x2="231" y2="0" gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor="#173c6c" />
                <Stop offset="38%" stopColor="#173c6c" />
                <Stop offset="46%" stopColor="#16a6a1" stopOpacity="0.72" />
                <Stop offset="50%" stopColor="#ffffff" />
                <Stop offset="54%" stopColor="#a5f3fc" />
                <Stop offset="63%" stopColor="#173c6c" />
                <Stop offset="100%" stopColor="#173c6c" />
              </SvgLinearGradient>
            </Defs>
            <AnimatedRect x={shimmerX} y="0" width="231" height="30" fill="url(#sonaaBrandShine)" mask="url(#sonaaBrandTextMask)" />
          </Svg>
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

