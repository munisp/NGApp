/**
 * Geolocation Service
 * 
 * Provides IP geolocation lookup with caching
 */

interface GeolocationData {
  ip: string;
  country: string;
  city: string;
  region: string;
  latitude: string;
  longitude: string;
}

const geoCache = new Map<string, { data: GeolocationData; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getGeolocation(ipAddress: string): Promise<GeolocationData | null> {
  if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
    return {
      ip: ipAddress,
      country: 'Local',
      city: 'Local',
      region: 'Local',
      latitude: '0',
      longitude: '0',
    };
  }

  const cached = geoCache.get(ipAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    if (!response.ok) return null;
    
    const data = await response.json();
    const geoData: GeolocationData = {
      ip: ipAddress,
      country: data.country_name || 'Unknown',
      city: data.city || 'Unknown',
      region: data.region || 'Unknown',
      latitude: String(data.latitude || '0'),
      longitude: String(data.longitude || '0'),
    };

    geoCache.set(ipAddress, { data: geoData, timestamp: Date.now() });
    return geoData;
  } catch (error) {
    return null;
  }
}

export function isSignificantLocationChange(
  loc1: GeolocationData | null,
  loc2: GeolocationData | null
): boolean {
  if (!loc1 || !loc2) return false;
  return loc1.country !== loc2.country && loc1.country !== 'Unknown';
}
