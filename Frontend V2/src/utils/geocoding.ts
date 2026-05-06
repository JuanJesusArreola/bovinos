/**
 * Reverse geocoding via OpenStreetMap Nominatim (public, no API key).
 *
 * Usage policy notes:
 * - Public Nominatim is free but rate-limited to ~1 request/second per client.
 * - We pass `accept-language=es` for Spanish results.
 * - Browsers cannot set a custom User-Agent header, but Nominatim accepts
 *   browser requests; the Accept-Language and Referer headers identify us.
 *
 * Returns a normalized object suitable for auto-filling our ranch form fields.
 * Returns `null` on any failure (network, parse, no result, etc.) — callers
 * should treat null as "no auto-fill" and continue gracefully.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export interface ReverseGeocodeResult {
  /** Composite street address: "<road> <house_number>" (or neighbourhood fallback) */
  address: string;
  /** city / town / village / municipality (whichever is present) */
  city: string;
  /** State / region */
  state: string;
  /** Country (English-style "México" when ?accept-language=es) */
  country: string;
  /** Postal code (postcode) — may be empty */
  postalCode: string;
  /** Country code (lowercase ISO 3166-1 alpha-2, e.g. "mx") */
  countryCode: string;
}

/**
 * Reverse geocode a (lat, lng) point. Returns null on failure.
 * Caller is responsible for debouncing and rate-limiting.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('accept-language', 'es');
    url.searchParams.set('zoom', '18'); // building/street level
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;

    const a = data.address as Record<string, string>;

    // Compose street address: prefer "road number" then alternatives.
    let address = '';
    if (a.road) {
      address = a.house_number ? `${a.road} ${a.house_number}` : a.road;
    } else if (a.neighbourhood) {
      address = a.neighbourhood;
    } else if (a.suburb) {
      address = a.suburb;
    }

    const city =
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.county ||
      '';

    const state = a.state || '';
    const country = a.country || '';
    const postalCode = a.postcode || '';
    const countryCode = (a.country_code || '').toLowerCase();

    return { address, city, state, country, postalCode, countryCode };
  } catch {
    return null;
  }
}

/**
 * Static map: México state name → IANA timezone.
 * Default fallback for unmapped states is `America/Mexico_City`.
 *
 * Reference (2024):
 * - America/Tijuana          → Baja California
 * - America/Hermosillo       → Sonora (no DST)
 * - America/Mazatlan         → Baja California Sur, Chihuahua, Nayarit, Sinaloa
 * - America/Mexico_City      → most of central/southern MX
 * - America/Cancun           → Quintana Roo (no DST)
 * - America/Ojinaga          → some Chihuahua border municipalities (treated as Mazatlan-equivalent here)
 *
 * NOTE: Names are matched case-insensitively and tolerate accent strip differences.
 */
export const MX_STATE_TO_TIMEZONE: Record<string, string> = {
  'aguascalientes':                 'America/Mexico_City',
  'baja california':                'America/Tijuana',
  'baja california sur':            'America/Mazatlan',
  'campeche':                       'America/Mexico_City',
  'chiapas':                        'America/Mexico_City',
  'chihuahua':                      'America/Chihuahua',
  'ciudad de mexico':               'America/Mexico_City',
  'ciudad de méxico':               'America/Mexico_City',
  'coahuila':                       'America/Monterrey',
  'coahuila de zaragoza':           'America/Monterrey',
  'colima':                         'America/Mexico_City',
  'durango':                        'America/Monterrey',
  'estado de mexico':               'America/Mexico_City',
  'estado de méxico':               'America/Mexico_City',
  'mexico':                         'America/Mexico_City',
  'méxico':                         'America/Mexico_City',
  'guanajuato':                     'America/Mexico_City',
  'guerrero':                       'America/Mexico_City',
  'hidalgo':                        'America/Mexico_City',
  'jalisco':                        'America/Mexico_City',
  'michoacan':                      'America/Mexico_City',
  'michoacán':                      'America/Mexico_City',
  'michoacan de ocampo':            'America/Mexico_City',
  'michoacán de ocampo':            'America/Mexico_City',
  'morelos':                        'America/Mexico_City',
  'nayarit':                        'America/Mazatlan',
  'nuevo leon':                     'America/Monterrey',
  'nuevo león':                     'America/Monterrey',
  'oaxaca':                         'America/Mexico_City',
  'puebla':                         'America/Mexico_City',
  'queretaro':                      'America/Mexico_City',
  'querétaro':                      'America/Mexico_City',
  'quintana roo':                   'America/Cancun',
  'san luis potosi':                'America/Mexico_City',
  'san luis potosí':                'America/Mexico_City',
  'sinaloa':                        'America/Mazatlan',
  'sonora':                         'America/Hermosillo',
  'tabasco':                        'America/Mexico_City',
  'tamaulipas':                     'America/Monterrey',
  'tlaxcala':                       'America/Mexico_City',
  'veracruz':                       'America/Mexico_City',
  'veracruz de ignacio de la llave':'America/Mexico_City',
  'yucatan':                        'America/Mexico_City',
  'yucatán':                        'America/Mexico_City',
  'zacatecas':                      'America/Mexico_City',
};

/**
 * Resolve a timezone for a México state name. Falls back to America/Mexico_City.
 * Tolerates case differences and minor punctuation.
 */
export function timezoneForMxState(state: string | null | undefined): string {
  if (!state) return 'America/Mexico_City';
  const key = state.trim().toLowerCase();
  return MX_STATE_TO_TIMEZONE[key] ?? 'America/Mexico_City';
}
