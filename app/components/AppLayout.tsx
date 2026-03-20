import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const APP_BG = '#F4F7FB';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [fontsLoaded] = useFonts({
    Bilbo: require('../../assets/fonts/Bilbo-Regular.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen} />;
  }

  return (
    <>
      <StatusBar
        backgroundColor="#D9D9D9"
        barStyle="dark-content"
        translucent={false}
      />

      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <View style={styles.logoContainer}>
            <Text style={styles.title}>REPLOG</Text>
            <Image
              style={styles.logo}
              source={require('../../assets/images/myAppImg/logoBarbells.png')}
            />
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.middleArea} edges={[]}>
          {children}
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <TouchableOpacity onPress={() => router.push('/menu')}>
              <Image
                source={require('../../assets/images/myAppImg/menu.png')}
                style={styles.icon}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/steps')}>
              <Image
                source={require('../../assets/images/myAppImg/steps.png')}
                style={styles.icon}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/graph')}>
              <Image
                source={require('../../assets/images/myAppImg/graph.png')}
                style={styles.icon}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/home')}>
              <Image
                source={require('../../assets/images/myAppImg/home.png')}
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

const baseWidth = 375;
const fontScale = screenWidth / baseWidth;

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  topBar: {
    backgroundColor: '#aec6cfb7',
    height: screenHeight * 0.13,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },

  logoContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: screenWidth * 0.55,
    bottom: screenHeight * 0.015,
  },

  title: {
    fontSize: screenWidth * 0.04 * fontScale,
    color: '#333',
    fontFamily: 'Bilbo',
    top: screenHeight * 0.04,
  },

  logo: {
    width: screenWidth * 0.42,
    height: screenWidth * 0.15,
    resizeMode: 'contain',
  },

  middleArea: {
    flex: 1,
    backgroundColor: APP_BG,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  bottomBar: {
    backgroundColor: '#aec6cfb7',
  },

  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: screenHeight * 0.09,
    paddingHorizontal: 10,
  },

  icon: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    resizeMode: 'contain',
  },
});