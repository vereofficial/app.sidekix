import { NativeModulesProxy } from 'expo-modules-core';

/**
 * `expo-av` video view can be unavailable when the native binary is stale
 * (e.g. Expo Go / dev client mismatch). Guard Video rendering to avoid crashes.
 */
export const HAS_EXPO_AV_VIDEO = Boolean(
  (NativeModulesProxy as Record<string, unknown> | undefined)?.ExponentAV,
);

