/**
 * Supabase Storage client — thin wrapper over the REST API using native fetch.
 * Uploads/deletes use the service-role key (server-side only).
 * Public reads use the bucket's public URL pattern (no auth needed).
 */

const BUCKET = 'location-photos';

function projectUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL is not set');
  return url.replace(/\/+$/, '');
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return key;
}

/** Public URL for an object — works because the bucket is public. */
export function publicUrl(path: string): string {
  return `${projectUrl()}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}

/** Upload a file. `path` is the object key inside the bucket (e.g. "SKKE001/logo.jpg"). */
export async function uploadObject(
  path: string,
  body: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
): Promise<{ publicUrl: string }> {
  const url = `${projectUrl()}/storage/v1/object/${BUCKET}/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: body as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return { publicUrl: publicUrl(path) };
}

/** Delete an object by path. Idempotent — returns true even if it didn't exist. */
export async function deleteObject(path: string): Promise<boolean> {
  const url = `${projectUrl()}/storage/v1/object/${BUCKET}/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${serviceKey()}` },
  });
  if (res.status === 404) return true;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed (${res.status}): ${text}`);
  }
  return true;
}

/** Given a public URL produced by publicUrl(), extract the object path. */
export function pathFromPublicUrl(url: string): string | null {
  const prefix = `${projectUrl()}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  return decodeURI(url.slice(prefix.length));
}

export const BUCKET_NAME = BUCKET;
