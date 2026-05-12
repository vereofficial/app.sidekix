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

const truthyEnv = (v) => v === '1' || String(v ?? '').toLowerCase() === 'true';

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
    /** R2 reads: must match Cloudflare public bucket / custom domain (see supabase/functions/README.md). */
    useR2Media: truthyEnv(process.env.EXPO_PUBLIC_USE_R2_MEDIA),
    r2PublicMediaUrl: (
      process.env.EXPO_PUBLIC_R2_PUBLIC_MEDIA_URL ||
      process.env.R2_PUBLIC_MEDIA_URL ||
      ''
    ).trim(),
  },
});
