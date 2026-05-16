export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { uploadObject, deleteObject, pathFromPublicUrl } from '@/lib/storage';
import { logAction } from '@/lib/audit';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_OTHER_PHOTOS = 10;

type Slot = 'logo' | 'cover' | 'other';

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

async function getLocation(storeCode: string) {
  const db = getDb();
  const r = await db.execute({
    sql: 'SELECT id, logo_photo_url, cover_photo_url, other_photo_urls FROM tracker_locations WHERE store_code = ?',
    args: [storeCode],
  });
  return r.rows[0] as
    | { id: number; logo_photo_url: string | null; cover_photo_url: string | null; other_photo_urls: string[] | null }
    | undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { store_code: string } },
) {
  try {
    const storeCode = decodeURIComponent(params.store_code);
    const location = await getLocation(storeCode);
    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    const form = await request.formData();
    const slot = String(form.get('slot') ?? '') as Slot;
    const file = form.get('file');

    if (!['logo', 'cover', 'other'].includes(slot)) {
      return NextResponse.json({ error: 'slot must be logo, cover, or other' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported type ${file.type} (allow: jpeg/png/webp)` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File exceeds 5MB (got ${file.size})` }, { status: 400 });
    }

    const ext = extFor(file.type);
    const objectPath =
      slot === 'other'
        ? `${storeCode}/other-${Date.now()}.${ext}`
        : `${storeCode}/${slot}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { publicUrl } = await uploadObject(objectPath, buf, file.type);

    const db = getDb();

    if (slot === 'logo') {
      if (location.logo_photo_url && location.logo_photo_url !== publicUrl) {
        const prior = pathFromPublicUrl(location.logo_photo_url);
        if (prior) await deleteObject(prior).catch(() => {});
      }
      await db.execute({
        sql: 'UPDATE tracker_locations SET logo_photo_url = ? WHERE store_code = ?',
        args: [publicUrl, storeCode],
      });
    } else if (slot === 'cover') {
      if (location.cover_photo_url && location.cover_photo_url !== publicUrl) {
        const prior = pathFromPublicUrl(location.cover_photo_url);
        if (prior) await deleteObject(prior).catch(() => {});
      }
      await db.execute({
        sql: 'UPDATE tracker_locations SET cover_photo_url = ? WHERE store_code = ?',
        args: [publicUrl, storeCode],
      });
    } else {
      const current = Array.isArray(location.other_photo_urls) ? location.other_photo_urls : [];
      if (current.length >= MAX_OTHER_PHOTOS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_OTHER_PHOTOS} other photos. Delete one first.` },
          { status: 400 },
        );
      }
      const next = [...current, publicUrl];
      await db.execute({
        sql: 'UPDATE tracker_locations SET other_photo_urls = ?::jsonb WHERE store_code = ?',
        args: [JSON.stringify(next), storeCode],
      });
    }

    await logAction('upload_location_photo', { slot, url: publicUrl }, 'tracker_location', storeCode);
    return NextResponse.json({ slot, url: publicUrl });
  } catch (error) {
    console.error('[locations/photos] POST error:', error);
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { store_code: string } },
) {
  try {
    const storeCode = decodeURIComponent(params.store_code);
    const location = await getLocation(storeCode);
    if (!location) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const slot = (searchParams.get('slot') || '') as Slot;
    const url = searchParams.get('url') || ''; // required for slot=other

    if (!['logo', 'cover', 'other'].includes(slot)) {
      return NextResponse.json({ error: 'slot must be logo, cover, or other' }, { status: 400 });
    }

    const db = getDb();

    if (slot === 'logo') {
      if (location.logo_photo_url) {
        const path = pathFromPublicUrl(location.logo_photo_url);
        if (path) await deleteObject(path).catch(() => {});
      }
      await db.execute({
        sql: 'UPDATE tracker_locations SET logo_photo_url = NULL WHERE store_code = ?',
        args: [storeCode],
      });
    } else if (slot === 'cover') {
      if (location.cover_photo_url) {
        const path = pathFromPublicUrl(location.cover_photo_url);
        if (path) await deleteObject(path).catch(() => {});
      }
      await db.execute({
        sql: 'UPDATE tracker_locations SET cover_photo_url = NULL WHERE store_code = ?',
        args: [storeCode],
      });
    } else {
      if (!url) return NextResponse.json({ error: 'url is required for slot=other' }, { status: 400 });
      const current = Array.isArray(location.other_photo_urls) ? location.other_photo_urls : [];
      const next = current.filter((u) => u !== url);
      const path = pathFromPublicUrl(url);
      if (path) await deleteObject(path).catch(() => {});
      await db.execute({
        sql: 'UPDATE tracker_locations SET other_photo_urls = ?::jsonb WHERE store_code = ?',
        args: [JSON.stringify(next), storeCode],
      });
    }

    await logAction('delete_location_photo', { slot, url }, 'tracker_location', storeCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[locations/photos] DELETE error:', error);
    const msg = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
