import { getPublicPostMediaUrl } from './storageMediaUrl';

export function postImagePublicUrl(path: string): string {
  return getPublicPostMediaUrl(path) ?? '';
}
