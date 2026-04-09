import * as FileSystem from 'expo-file-system/legacy';

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
 */
export async function readLocalUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
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
