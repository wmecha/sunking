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

const ISO2_TO_COUNTRY = Object.fromEntries(
  Object.entries(COUNTRY_TO_ISO2).map(([country, iso2]) => [iso2, country]),
) as Record<string, string>;

export function fromIso2(country: string | null | undefined): string {
  if (!country) return '';
  const trimmed = country.trim();
  return ISO2_TO_COUNTRY[trimmed.toUpperCase()] ?? trimmed;
}
