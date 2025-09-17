import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AppLayout({ children }) {
  return (
    <>
      <StatusBar backgroundColor="#AEC6CF" barStyle="dark-content" />
      <View style={styles.container}>

        {/* סרגל עליון */}
        <View style={styles.topBar}>
          <SafeAreaView edges={['top']} style={styles.topBarSafeArea}>
            <View style={styles.logoContainer}>
              <Text style={styles.title}>REPLOG</Text>
              <Image
                style={styles.logo}
                source={require('../../assets/images/myAppImg/logoBarbells.png')}
              />
            </View>
          </SafeAreaView>
        </View>

        {/* תוכן המרכזי */}
        <SafeAreaView style={styles.middleArea}>
          {children}
        </SafeAreaView>

        {/* סרגל תחתון */}
        <View style={styles.bottomBar}>
          <SafeAreaView edges={['bottom']} style={styles.bottomBarSafeArea}>
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

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#AEC6CF',
  },
  topBar: {
    backgroundColor: '#D9D9D9',
  },
  topBarSafeArea: {
    backgroundColor: '#D9D9D9',
    height: screenHeight * 0.13,
    justifyContent: 'center',
    paddingLeft: 15,
  },
  logoContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: screenWidth * 0.55,
    bottom: screenHeight * 0.015,
  },
  title: {
    fontSize: screenWidth * 0.05,
    fontWeight: 'bold',
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bottomBar: {
    backgroundColor: '#D9D9D9',
  },
  bottomBarSafeArea: {
    backgroundColor: '#D9D9D9',
  },
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: screenHeight * 0.09,
    paddingHorizontal: 10,
  },
  icon: {
    width: screenWidth * 0.10,
    height: screenWidth * 0.10,
    resizeMode: 'contain',
  },
});
