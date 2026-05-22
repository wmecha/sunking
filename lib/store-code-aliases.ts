const LEGACY_CODES_BY_CURRENT: Record<string, string[]> = {
  SKKE599: ['SK-KE-110'],
  '09001125832235440036': ['SKKELPG146'],
  '03393989263223456991': ['10075812300585705525'],
  '11567202338163853189': ['SKKE065'],
  '14170429196509444245': ['SKKE159'],
  '07391914500854160840': ['SKKE160'],
  '09117228194695932345': ['SKKE161'],
  '10446200711127298340': ['SKNGHO124'],
  '10688375190153225989': ['SKNG054'],
  '15046458748356369911': ['SKNG103'],
  '13930556144563645701': ['SKNG110'],
  SKTZ599: ['05381297372336212803'],
  '07792265113715852457': ['7792265113715852457'],
};

export function normalizeStoreCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase();
}

export function legacyStoreCodesFor(currentCode: unknown): string[] {
  return LEGACY_CODES_BY_CURRENT[normalizeStoreCode(currentCode)] ?? [];
}
