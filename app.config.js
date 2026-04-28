/**
 * Public Supabase values must be supplied when you start Metro or EAS build
 * (never committed): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
const path = require('path');

// Load .env before reading process.env so app config gets the same keys as Metro (reliable on Windows/local).
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // dotenv is a transitive dep of Expo; ignore if unavailable.
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    'expo-notifications',
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission: 'Sidekix needs photo library access to post your take.',
        cameraPermission: 'Sidekix needs camera access to post your take.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
