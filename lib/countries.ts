/** Country name → ISO 3166-1 alpha-2 code for the Google Bulk Upload "Country/Region" column. */
export const COUNTRY_TO_ISO2: Record<string, string> = {
  Benin: 'BJ',
  Cameroon: 'CM',
  Kenya: 'KE',
  Malawi: 'MW',
  Mozambique: 'MZ',
  Nigeria: 'NG',
  'South Africa': 'ZA',
  Tanzania: 'TZ',
  Togo: 'TG',
  Uganda: 'UG',
  Zambia: 'ZM',
};

/** Best-effort: returns ISO code if known, else the raw value (e.g. already an ISO code). */
export function toIso2(country: string | null | undefined): string {
  if (!country) return '';
  return COUNTRY_TO_ISO2[country.trim()] ?? country.trim();
}
