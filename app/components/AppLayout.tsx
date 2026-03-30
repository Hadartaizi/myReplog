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

const APP_BG = '#F4F7FB';

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
          backgroundColor="#AEC6CF"
          barStyle="dark-content"
          translucent={false}
        />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loadingText}>טוען נתונים...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        backgroundColor="#AEC6CF"
        barStyle="dark-content"
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
                  },
                ]}
              >
                REPLOG
              </Text>

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
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/graph')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
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
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/steps')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
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
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/menu')}
              style={styles.navButton}
              activeOpacity={0.8}
            >
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
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },

  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  topBar: {
    backgroundColor: '#AEC6CF',
    justifyContent: 'center',
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
  },

  title: {
    color: '#333',
    fontFamily: 'Bilbo',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 0,
  },

  logo: {
    resizeMode: 'contain',
    marginTop: -2,
  },

  middleArea: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  content: {
    flex: 1,
    width: '100%',
  },

  bottomBar: {
    backgroundColor: '#AEC6CF',
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

  icon: {
    resizeMode: 'contain',
  },
});