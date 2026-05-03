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
 * Android: balanced H.264/AAC pass when FFmpeg is available.
 * iOS: copy to app cache when the URI is not already a stable `file://` in Caches (older Photos / HEVC passthrough URIs).
 * iOS H.264 export is set in the image picker (`videoExportPreset`); this is a second safety net for read/upload.
 */
export async function prepareVideoForUpload(originUri: string): Promise<PrepareResult> {
  if (Platform.OS === 'web') return { uri: originUri };

  const cacheDir = LegacyFileSystem.cacheDirectory;
  if (!cacheDir) {
    return { uri: originUri };
  }

  if (Platform.OS === 'ios') {
    try {
      const src = await LegacyFileSystem.getInfoAsync(originUri);
      if (src.exists && 'size' in src && src.size > 0 && originUri.includes('/Caches/')) {
        return { uri: originUri };
      }
    } catch {
      /* try copy */
    }
    const out = `${cacheDir}sk-vid-${Date.now()}.mp4`;
    try {
      await LegacyFileSystem.copyAsync({ from: originUri, to: out });
      const info = await LegacyFileSystem.getInfoAsync(out);
      if (info.exists && 'size' in info && info.size > 0) {
        return {
          uri: out,
          cleanup: () => LegacyFileSystem.deleteAsync(out, { idempotent: true }).catch(() => {}),
        };
      }
      await LegacyFileSystem.deleteAsync(out, { idempotent: true }).catch(() => {});
    } catch {
      /* fall through */
    }
    return { uri: originUri };
  }

  if (Platform.OS !== 'android') {
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
