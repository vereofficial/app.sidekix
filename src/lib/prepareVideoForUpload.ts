import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type PrepareResult = { uri: string; cleanup?: () => Promise<void> };

type FfmpegBridge = {
  FFmpegKit: { execute: (command: string) => Promise<{ getReturnCode: () => Promise<unknown> }> };
  ReturnCode: { isSuccess: (rc: unknown) => boolean };
};

function getFfmpegBridge(): FfmpegBridge | null {
  if (Platform.OS !== 'android') return null;
  try {
    const mod = require('ffmpeg-kit-react-native') as Partial<FfmpegBridge>;
    if (mod?.FFmpegKit && mod?.ReturnCode) return mod as FfmpegBridge;
    return null;
  } catch {
    return null;
  }
}

/**
 * Android: balanced H.264/AAC pass when FFmpeg is available (iOS quality comes from picker preset in upload.tsx).
 */
export async function prepareVideoForUpload(originUri: string): Promise<PrepareResult> {
  if (Platform.OS === 'web') return { uri: originUri };

  const cacheDir = LegacyFileSystem.cacheDirectory;
  if (!cacheDir || Platform.OS !== 'android') {
    return { uri: originUri };
  }

  const ffmpeg = getFfmpegBridge();
  if (!ffmpeg) return { uri: originUri };

  try {
    const localIn = `${cacheDir}sk-vid-in-${Date.now()}.mp4`;
    await LegacyFileSystem.copyAsync({ from: originUri, to: localIn });
    const localOut = `${cacheDir}sk-vid-out-${Date.now()}.mp4`;
    /** CRF ~23 ≈ visually lossless at 720p-ish; capped width keeps storage reasonable without crushing detail. */
    const cmd = `-y -i "${localIn}" -c:v libx264 -preset fast -crf 23 -vf "scale='min(960,iw)':-2" -c:a aac -b:a 128k -movflags +faststart "${localOut}"`;
    const session = await ffmpeg.FFmpegKit.execute(cmd);
    const rc = await session.getReturnCode();
    const ok = ffmpeg.ReturnCode.isSuccess(rc);
    await LegacyFileSystem.deleteAsync(localIn, { idempotent: true }).catch(() => {});
    if (!ok) {
      await LegacyFileSystem.deleteAsync(localOut, { idempotent: true }).catch(() => {});
      return { uri: originUri };
    }
    return {
      uri: localOut,
      cleanup: () => LegacyFileSystem.deleteAsync(localOut, { idempotent: true }).catch(() => {}),
    };
  } catch {
    return { uri: originUri };
  }
}
