module.exports = () => ({
  name: 'Sock',
  slug: 'sock',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/sock-app-icon.png',
  scheme: 'sock',
  userInterfaceStyle: 'light',
  backgroundColor: '#FFF7E8',
  ios: {
    icon: './assets/images/sock-app-icon.png',
    bundleIdentifier: 'app.sock.mobile',
    supportsTablet: true,
  },
  android: {
    package: 'app.sock.mobile',
    adaptiveIcon: {
      backgroundColor: '#151313',
      foregroundImage: './assets/images/sock-app-icon.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', {
      backgroundColor: '#151313',
      image: './assets/images/sock-app-icon.png',
      imageWidth: 180,
    }],
    ['expo-notifications', {
      icon: './assets/images/android-notification-icon.png',
      color: '#F0643B',
      defaultChannel: 'sock-status',
    }],
    ['expo-secure-store', {
      configureAndroidBackup: false,
      faceIDPermission: 'Allow Sock to securely restore a signed-in session.',
    }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'd0ca219b-e0ba-4c3c-bcfb-d9280bb59de0',
    },
    sock: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      localBackend: process.env.EXPO_PUBLIC_LOCAL_BACKEND === 'true',
      externalServicesEnabled: process.env.EXPO_PUBLIC_EXTERNAL_SERVICES_ENABLED !== 'false',
    },
  },
});
