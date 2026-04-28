import { File } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * `fetch(fileUri).blob()` often yields **0-byte** blobs on React Native for `file://` / `content://` URIs,
 * which uploads empty objects to Supabase Storage. Read bytes explicitly instead.
 *
 * Prefer the SDK 54+ `File` API (not the deprecated `expo-file-system` root stubs). Fall back to
 * `expo-file-system/legacy` for URIs the new reader rejects (some `content://` / picker edge cases).
 */
export async function readLocalUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error('Media file is empty.');
    }
    return buf;
  }

  try {
    const file = new File(uri);
    const buf = await file.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new Error('Media file is empty.');
    }
    return buf;
  } catch {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    if (!base64?.length) {
      throw new Error('Could not read media file.');
    }
    const buf = base64ToArrayBuffer(base64);
    if (buf.byteLength === 0) {
      throw new Error('Media file is empty.');
    }
    return buf;
  }
}
