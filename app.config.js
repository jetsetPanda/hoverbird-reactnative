/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'hoverbird-reactnative',
    slug: 'hoverbird-reactnative',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'hoverbirdreactnative',
    // TEMP: dark mode disabled — was 'automatic'. Restore to 'automatic' to
    // re-enable system theming (also revert hooks/use-color-scheme*.ts).
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.jetsetdev.hoverbirdreactnative',
      // On EAS Build this comes from the GOOGLE_SERVICES_JSON file env var
      // (see eas env:create) since the real file is gitignored. Locally it
      // falls back to the file in the repo root.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '701b666b-fb8d-4842-92b3-41dd28282c01',
      },
    },
    owner: 'jetsetdev',
  },
};
