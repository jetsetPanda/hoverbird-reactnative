import { supabase } from '@/lib/supabase';

// Private Storage bucket for activity photos (photos of children — never
// public URLs). Objects are keyed `<family_id>/<filename>` so the storage RLS
// policies can derive the family from the first path segment; see
// supabase/migrations/20260703000000_activity_media_storage.sql.
export const ACTIVITY_MEDIA_BUCKET = 'activity-media';

// Signed URLs are deliberately short-lived. Refresh a little before expiry so
// a URL handed to an <Image> never dies mid-session.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;
export const SIGNED_URL_STALE_MS =
  SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REFRESH_MARGIN_MS;

// Module-level cache so the feed doesn't re-sign the same path on every
// render/refetch. Keyed by storage path (what activities.media_urls stores).
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getActivityMediaUrl(path: string): Promise<string> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(ACTIVITY_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_STALE_MS,
  });
  return data.signedUrl;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

// Uploads a picked photo and returns its storage PATH (for media_urls).
export async function uploadActivityPhoto(params: {
  familyId: string;
  localUri: string;
  mimeType?: string | null;
}): Promise<string> {
  const mimeType = params.mimeType ?? 'image/jpeg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensionFor(mimeType)}`;
  const objectPath = `${params.familyId}/${fileName}`;

  // React Native-compatible way to get the picked file's bytes (the pattern
  // Supabase's own Expo guide uses) — no Blob/FormData quirks.
  const arrayBuffer = await fetch(params.localUri).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage
    .from(ACTIVITY_MEDIA_BUCKET)
    .upload(objectPath, arrayBuffer, { contentType: mimeType, upsert: false });
  if (error) throw error;

  return objectPath;
}
