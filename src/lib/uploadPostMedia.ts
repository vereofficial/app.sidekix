import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { getSupabasePublicConfig } from './supabaseConfig';
import { readLocalUriAsArrayBuffer } from './readLocalMediaForUpload';
import { useR2MediaUpload } from './r2MediaConfig';

export type UploadProgressHandler = (fraction: number) => void;

function edgeFunctionUrl(name: string): string {
  const { url } = getSupabasePublicConfig();
  return `${url.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function fetchR2PresignedPut(
  supabase: SupabaseClient,
  objectKey: string,
  contentType: string,
): Promise<{ uploadUrl: string; pathForDb: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const { anonKey } = getSupabasePublicConfig();
  const res = await fetch(edgeFunctionUrl('r2-media-presign'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ objectKey, contentType }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    uploadUrl?: string;
    pathForDb?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `Presign failed (${res.status})`);
  }
  if (!json.uploadUrl || !json.pathForDb) {
    throw new Error('Presign response missing uploadUrl or pathForDb');
  }
  return { uploadUrl: json.uploadUrl, pathForDb: json.pathForDb };
}

function isPresignUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Typical when `r2-media-presign` is not deployed: GET /functions/v1/… → Presign failed (404)
  return /presign failed \(404\)|presign failed \(405\)/i.test(msg);
}

async function uploadViaSupabaseStorage(params: {
  supabase: SupabaseClient;
  objectKey: string;
  fileUri: string;
  contentType: string;
  onProgress?: UploadProgressHandler;
}): Promise<{ pathForDb: string }> {
  const { supabase, objectKey, fileUri, contentType, onProgress } = params;
  onProgress?.(0.05);
  const buf = await readLocalUriAsArrayBuffer(fileUri);
  onProgress?.(0.45);
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength === 0) {
    throw new Error('Media file is empty.');
  }
  const { error } = await supabase.storage.from('post-media').upload(objectKey, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  onProgress?.(1);
  return { pathForDb: objectKey };
}

async function putFileToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: UploadProgressHandler,
): Promise<void> {
  if (Platform.OS === 'web') {
    const buf = await readLocalUriAsArrayBuffer(fileUri);
    onProgress?.(0.5);
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: buf,
    });
    if (!put.ok) {
      const t = await put.text().catch(() => '');
      throw new Error(`R2 upload failed (${put.status}) ${t}`.trim());
    }
    onProgress?.(1);
    return;
  }

  const task = LegacyFileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    },
    (ev) => {
      const total = ev.totalBytesExpectedToSend;
      const sent = ev.totalBytesSent;
      if (total > 0) {
        onProgress?.(0.08 + (sent / total) * 0.9);
      } else {
        onProgress?.(0.5);
      }
    },
  );
  const result = await task.uploadAsync();
  if (!result || (result.status !== 200 && result.status !== 204)) {
    throw new Error(`R2 upload failed (${result?.status ?? '?'}) ${result?.body ?? ''}`.trim());
  }
  onProgress?.(1);
}

/**
 * Uploads media to Supabase Storage, or to Cloudflare R2 when EXPO_PUBLIC_USE_R2_MEDIA is enabled.
 * Stores DB paths as `userId/file.ext` (Supabase) or `r2/userId/file.ext` (R2).
 * If R2 presign fails (e.g. edge function not deployed → 404), falls back to Supabase Storage so production stays usable.
 */
export async function uploadPostMediaFromUri(params: {
  supabase: SupabaseClient;
  userId: string;
  /** Storage object key without `r2/` prefix (e.g. `${userId}/173.jpg`). */
  objectKey: string;
  fileUri: string;
  contentType: string;
  onProgress?: UploadProgressHandler;
}): Promise<{ pathForDb: string }> {
  const { supabase, userId, objectKey, fileUri, contentType, onProgress } = params;
  if (!objectKey.startsWith(`${userId}/`)) {
    throw new Error('Invalid storage path.');
  }

  const useR2 = useR2MediaUpload();

  if (useR2) {
    try {
      onProgress?.(0.02);
      const { uploadUrl, pathForDb } = await fetchR2PresignedPut(supabase, objectKey, contentType);
      onProgress?.(0.06);
      await putFileToPresignedUrl(uploadUrl, fileUri, contentType, onProgress);
      return { pathForDb };
    } catch (e) {
      if (!isPresignUnavailableError(e)) throw e;
    }
  }

  return uploadViaSupabaseStorage({ supabase, objectKey, fileUri, contentType, onProgress });
}
