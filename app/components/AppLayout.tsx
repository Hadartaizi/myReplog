import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import useAccessGuard from './admin/useAccessGuard';

const COLORS = {
  background: '#0B0B0D',
  topBar: '#101014',
  bottomBar: '#101014',
  card: '#17171C',
  cardSecondary: '#222229',
  primary: '#FF7A00',
  primaryDark: '#E56700',
  primaryLight: '#FF9A3D',
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  border: '#2B2B31',
  shadow: '#FF7A00',
};

const APP_BG = COLORS.background;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === 'web';
  const guardState = isWeb ? { checkingAccess: false } : useAccessGuard();
  const { checkingAccess } = guardState;

  const [fontsLoaded] = useFonts({
    Bilbo: require('../../assets/fonts/Bilbo-Regular.ttf'),
  });

  const dynamic = useMemo(() => {
    const isSmallPhone = width < 360;
    const isTablet = width >= 768;

    const horizontalPadding = isTablet ? 24 : isSmallPhone ? 10 : 14;

    const topBarMinHeight = isTablet ? 104 : isSmallPhone ? 76 : 86;
    const bottomBarMinHeight = isTablet ? 88 : isSmallPhone ? 70 : 78;

    const titleFontSize = isTablet ? 34 : isSmallPhone ? 24 : 28;
    const logoWidth = isTablet ? 150 : isSmallPhone ? 108 : 126;
    const logoHeight = isTablet ? 54 : isSmallPhone ? 38 : 44;

    const iconSize = isTablet ? 46 : isSmallPhone ? 34 : 40;
    const iconScale = isTablet ? 1.2 : 1.18;

    return {
      horizontalPadding,
      topBarMinHeight,
      bottomBarMinHeight,
      titleFontSize,
      logoWidth,
      logoHeight,
      iconSize,
      iconScale,
    };
  }, [width]);

  if (!fontsLoaded || checkingAccess) {
    return (
      <>
        <StatusBar
          backgroundColor={COLORS.topBar}
          barStyle="light-content"
          translucent={false}
        />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>טוען נתונים...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        backgroundColor={COLORS.topBar}
        barStyle="light-content"
        translucent={false}
      />

      <View style={styles.container}>
        <SafeAreaView
          edges={['top']}
          style={[styles.topBar, { minHeight: dynamic.topBarMinHeight }]}
        >
          <View
            style={[
              styles.topBarInner,
              { paddingHorizontal: dynamic.horizontalPadding },
            ]}
          >
            <View style={styles.logoContainer}>
              <Text
                style={[
                  styles.title,
                  {
                    fontSize: dynamic.titleFontSize,
                    lineHeight: dynamic.titleFontSize * 1.05,
                  },
                ]}
              >
                <Text style={styles.titleOrange}>REP</Text>
                <Text style={styles.titleWhite}>LOG</Text>
              </Text>

              {/* <View style={styles.logoGlowBox}>
                <Image
                  style={[
                    styles.logo,
                    {
                      width: dynamic.logoWidth,
                      height: dynamic.logoHeight,
                    },
                  ]}
                  source={require('../../assets/images/myAppImg/logoBarbells.png')}
                />
              </View> */}
            </View>
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.middleArea} edges={[]}>
          <View style={styles.content}>{children}</View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View
            style={[
              styles.bottomBarContent,
              {
                minHeight: dynamic.bottomBarMinHeight,
                paddingHorizontal: dynamic.horizontalPadding,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.push('/home')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
              <View style={styles.navIconCircle}>
                <Image
                  source={require('../../assets/images/myAppImg/home.png')}
                  style={[
                    styles.icon,
                    {
                      width: dynamic.iconSize,
                      height: dynamic.iconSize,
                      transform: [{ scale: dynamic.iconScale }],
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/graph')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
              <View style={styles.navIconCircle}>
                <Image
                  source={require('../../assets/images/myAppImg/graph.png')}
                  style={[
                    styles.icon,
                    {
                      width: dynamic.iconSize,
                      height: dynamic.iconSize,
                      transform: [{ scale: dynamic.iconScale }],
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/steps')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
              <View style={styles.navIconCircle}>
                <Image
                  source={require('../../assets/images/myAppImg/steps.png')}
                  style={[
                    styles.icon,
                    {
                      width: dynamic.iconSize,
                      height: dynamic.iconSize,
                      transform: [{ scale: dynamic.iconScale }],
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/menu')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
              <View style={styles.navIconCircle}>
                <Image
                  source={require('../../assets/images/myAppImg/menu.png')}
                  style={[
                    styles.icon,
                    {
                      width: dynamic.iconSize,
                      height: dynamic.iconSize,
                      transform: [{ scale: dynamic.iconScale }],
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: APP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },

  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  topBar: {
    backgroundColor: COLORS.topBar,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },

  topBarInner: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 4,
  },

  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ skewX: '-10deg' }],
  },

  title: {
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 0,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(255, 122, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          fontFamily: 'Impact, Arial Black, sans-serif',
        } as any)
      : {
          fontFamily: Platform.OS === 'android' ? 'sans-serif-condensed' : undefined,
        }),
  },

  titleOrange: {
    color: COLORS.primary,
  },

  titleWhite: {
    color: COLORS.text,
  },

  logoGlowBox: {
    marginTop: -2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 122, 0, 0.06)',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },

  logo: {
    resizeMode: 'contain',
  },

  middleArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  content: {
    flex: 1,
    width: '100%',
    backgroundColor: APP_BG,
  },

  bottomBar: {
    backgroundColor: COLORS.bottomBar,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    elevation: 8,
  },

  bottomBarContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  navButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? 8 : 7,
  },

  navIconCircle: {
    minWidth: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 0,
  },

  icon: {
    resizeMode: 'contain',
    tintColor: COLORS.primary,
  },
});