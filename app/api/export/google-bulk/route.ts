export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { toIso2 } from '@/lib/countries';
import Papa from 'papaparse';

/**
 * Generates a CSV that matches Google's "Locations Bulk Upload" template
 * (en_GB variant). Logo / Cover / Other photo columns are filled from
 * tracker_locations.{logo_photo_url, cover_photo_url, other_photo_urls}.
 *
 * Filters supported via query params:
 *   ?country=Kenya,Nigeria  (CSV)
 *   ?status=Live
 *   ?location_type=Shop
 */

// Exact column order from the Google template (Google-Business-Profile-Template-en_GB.csv).
const GOOGLE_COLUMNS = [
  'Shop code',
  'Business name',
  'Address line 1',
  'Address line 2',
  'Address line 3',
  'Address line 4',
  'Address line 5',
  'Sub-locality',
  'Locality',
  'Administrative area',
  'Country/Region',
  'Postcode',
  'Latitude',
  'Longitude',
  'Primary phone',
  'Additional phones',
  'Website',
  'Primary category',
  'Additional categories',
  'Sunday hours',
  'Monday hours',
  'Tuesday hours',
  'Wednesday hours',
  'Thursday hours',
  'Friday hours',
  'Saturday hours',
  'Special hours',
  'From the business',
  'Opening date',
  'Logo photo',
  'Cover photo',
  'Other photos',
  'Labels',
  'AdWords location extensions phone',
] as const;

type Row = Record<string, unknown>;

function buildRow(r: Row): Record<string, string> {
  const otherPhotos = Array.isArray(r.other_photo_urls)
    ? (r.other_photo_urls as string[]).join('; ')
    : '';

  return {
    'Shop code': String(r.store_code ?? ''),
    'Business name': String(r.business_name ?? ''),
    'Address line 1': String(r.address ?? ''),
    'Address line 2': '',
    'Address line 3': '',
    'Address line 4': '',
    'Address line 5': '',
    'Sub-locality': '',
    Locality: String(r.city ?? ''),
    'Administrative area': '',
    'Country/Region': toIso2(r.country as string | null),
    Postcode: '',
    Latitude: r.latitude != null ? String(r.latitude) : '',
    Longitude: r.longitude != null ? String(r.longitude) : '',
    'Primary phone': String(r.primary_phone ?? ''),
    'Additional phones': '',
    Website: String(r.website ?? 'https://www.sunking.com/'),
    'Primary category': String(r.primary_category ?? 'Solar Energy Company'),
    'Additional categories': '',
    'Sunday hours': String(r.sunday_hours ?? ''),
    'Monday hours': String(r.monday_hours ?? ''),
    'Tuesday hours': String(r.tuesday_hours ?? ''),
    'Wednesday hours': String(r.wednesday_hours ?? ''),
    'Thursday hours': String(r.thursday_hours ?? ''),
    'Friday hours': String(r.friday_hours ?? ''),
    'Saturday hours': String(r.saturday_hours ?? ''),
    'Special hours': '',
    'From the business': '',
    'Opening date': '',
    'Logo photo': String(r.logo_photo_url ?? ''),
    'Cover photo': String(r.cover_photo_url ?? ''),
    'Other photos': otherPhotos,
    Labels: '',
    'AdWords location extensions phone': '',
  };
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);

  try {
    const country = searchParams.get('country') || '';
    const status = searchParams.get('status') || '';
    const locationType = searchParams.get('location_type') || '';

    const whereParts: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (country) {
      const countries = country.split(',').map((s) => s.trim()).filter(Boolean);
      if (countries.length === 1) {
        whereParts.push('country = ?'); params.push(countries[0]);
      } else if (countries.length > 1) {
        whereParts.push(`country IN (${countries.map(() => '?').join(',')})`);
        params.push(...countries);
      }
    }
    if (status) { whereParts.push('tracker_status = ?'); params.push(status); }
    if (locationType) { whereParts.push('location_type = ?'); params.push(locationType); }

    const where = 'WHERE ' + whereParts.join(' AND ');
    const result = await db.execute({
      sql: `SELECT * FROM tracker_locations ${where} ORDER BY country, business_name`,
      args: params,
    });

    const rows = (result.rows as unknown as Row[]).map(buildRow);
    const csv = Papa.unparse({ fields: [...GOOGLE_COLUMNS], data: rows });

    const filename = `google_bulk_upload_${new Date().toISOString().slice(0, 10)}.csv`;
    await db.execute({
      sql: `INSERT INTO export_history (exported_at, filename, filter_country, filter_status, row_count)
            VALUES (NOW(), ?, ?, ?, ?)`,
      args: [filename, country || null, status || null, rows.length],
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[export/google-bulk] error:', error);
    return NextResponse.json({ error: 'Failed to build Google bulk upload CSV' }, { status: 500 });
  }
}
