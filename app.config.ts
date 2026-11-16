import type { ExpoConfig } from 'expo/config';

/**
 * Configuration de l'application.
 *
 * Le nom « Élan » et l'identifiant sont PROVISOIRES : pour les changer,
 * il suffit de modifier les constantes ci-dessous (et le thème dans src/theme).
 */
const APP_NAME = 'Élan';
const SLUG = 'elan-coaching';
const SCHEME = 'elan';
const BUNDLE_ID = 'com.elancoaching.app';

const config: ExpoConfig = {
  name: APP_NAME,
  slug: SLUG,
  scheme: SCHEME,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Mode sombre par défaut, mais l'utilisateur peut basculer en clair dans l'app.
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0A0A0A',
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    usesAppleSignIn: true,
    infoPlist: {
      NSCameraUsageDescription:
        'La caméra sert à prendre des photos de progression et à filmer une série pour ton coach.',
      NSPhotoLibraryUsageDescription:
        'L’accès aux photos permet d’envoyer une image ou une vidéo à ton coach.',
      NSMicrophoneUsageDescription:
        'Le micro sert à enregistrer le son des vidéos envoyées à ton coach.',
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0A0A0A',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['VIBRATE', 'POST_NOTIFICATIONS'],
  },
  web: {
    favicon: './assets/favicon.png',
    // Application monopage : un seul index.html, idéal pour Cloudflare Pages.
    output: 'single',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    'expo-localization',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        color: '#FFFFFF',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'L’accès aux photos permet d’envoyer une image ou une vidéo à ton coach.',
        cameraPermission:
          'La caméra sert à prendre des photos de progression et à filmer une série pour ton coach.',
        microphonePermission: 'Le micro sert à enregistrer le son des vidéos envoyées à ton coach.',
      },
    ],
    'expo-video',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#0A0A0A',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Rempli par EAS lors du premier `eas init`.
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
