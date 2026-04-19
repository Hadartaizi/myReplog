import 'dotenv/config';
import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'repLog',
  slug: 'repLog',
  version: '1.0.0',
  owner: 'hadartaizi',
  orientation: 'default',

  plugins: [
    '@react-native-community/datetimepicker',
    [
      'expo-screen-orientation',
      {
        initialOrientation: 'DEFAULT',
      },
    ],
  ],

  ios: {
    ...config.ios,
    supportsTablet: true,
    requireFullScreen: true,
    bundleIdentifier: 'com.hadartaizi.repLog',
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    ...config.android,
    adaptiveIcon: {
      foregroundImage: './assets/images/Replog.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    intentFilters: [
      {
        action: 'VIEW',
        data: [{ scheme: 'replog' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    package: 'com.hadartaizi.repLog',
  },

  web: {
    ...config.web,
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/Replog.png',
  },

  extra: {
    firebaseConfig: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
    eas: {
      projectId: '0ca32970-7986-4e69-89ea-06beafd03661',
    },
  },
});