/**
 * Agent Cash Service
 * 
 * Integrates with agent networks (Paga, OPay, Kudi) for cash pickup
 * Enables recipients to collect cash from nearby agents
 */

export interface AgentLocation {
  agentId: string;
  agentName: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distance: number; // in kilometers
  operatingHours: string;
  services: string[];
}

export interface CollectionCode {
  code: string;
  remittanceId: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  expiresAt: Date;
  qrCodeUrl: string;
  status: 'active' | 'collected' | 'expired' | 'cancelled';
}

/**
 * Find nearby agents based on location
 */
export async function findNearbyAgents(params: {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 5km
  provider?: 'paga' | 'opay' | 'kudi' | 'all';
  limit?: number;
}): Promise<AgentLocation[]> {
  const radius = params.radius || 5;
  const limit = params.limit || 20;

  // Query agent providers via their respective APIs
  const agents: AgentLocation[] = await fetchAgentsFromProviders(
    params.latitude,
    params.longitude,
    radius,
    params.provider || 'all'
  );

  if (params.provider && params.provider !== 'all') {
    return agents
      .filter((a: AgentLocation) => a.agentId.startsWith(params.provider!))
      .sort((a: AgentLocation, b: AgentLocation) => a.distance - b.distance)
      .slice(0, limit);
  }

  return agents
    .sort((a: AgentLocation, b: AgentLocation) => a.distance - b.distance)
    .slice(0, limit);
}

const PAGA_API_URL = process.env.PAGA_API_URL || 'https://api.mypaga.com/paga-webservices/business-rest/secured';
const OPAY_API_URL = process.env.OPAY_API_URL || 'https://cashierapi.opayweb.com/api/v3';
const KUDI_API_URL = process.env.KUDI_API_URL || 'https://api.kudi.com/v1';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchAgentsFromProviders(
  lat: number, lon: number, radius: number, provider: string
): Promise<AgentLocation[]> {
  const results: AgentLocation[] = [];
  const providers = provider === 'all' ? ['paga', 'opay', 'kudi'] : [provider];

  for (const p of providers) {
    try {
      let apiUrl: string;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      switch (p) {
        case 'paga': {
          apiUrl = `${PAGA_API_URL}/getAgentLocations`;
          const apiKey = process.env.PAGA_API_KEY;
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        }
        case 'opay': {
          apiUrl = `${OPAY_API_URL}/agents/nearby`;
          const apiKey = process.env.OPAY_API_KEY;
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        }
        case 'kudi': {
          apiUrl = `${KUDI_API_URL}/agents/search`;
          const apiKey = process.env.KUDI_API_KEY;
          if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        }
        default:
          continue;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ latitude: lat, longitude: lon, radius }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const agentList = Array.isArray(data) ? data : data.agents || data.data || [];
        for (const a of agentList) {
          results.push({
            agentId: `${p}_${a.id || a.agentId || String(results.length)}`,
            agentName: a.name || a.agentName || `${p.toUpperCase()} Agent`,
            address: a.address || '',
            city: a.city || a.lga || '',
            state: a.state || '',
            latitude: a.latitude || a.lat || lat,
            longitude: a.longitude || a.lng || lon,
            distance: haversineDistance(lat, lon, a.latitude || lat, a.longitude || lon),
            operatingHours: a.operatingHours || '8:00 AM - 8:00 PM',
            services: a.services || ['cash_pickup'],
          });
        }
      }
    } catch (err) {
      console.warn(`[agent-cash] Failed to fetch ${p} agents:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}

export async function getAgentNetworkStats(): Promise<{
  totalAgents: number;
  activeAgents: number;
  byProvider: Record<string, number>;
}> {
  return { totalAgents: 0, activeAgents: 0, byProvider: {} };
}

export async function getCollectionStatus(code: string): Promise<{ code: string; status: string }> {
  return { code, status: 'active' };
}

export async function cancelCollection(code: string, userId: number, reason?: string): Promise<{ success: boolean }> {
  return { success: true };
}

/**
 * Generate collection code for cash pickup
 */
export async function generateCollectionCode(params: {
  remittanceId: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  provider: 'paga' | 'opay' | 'kudi';
  expiryHours?: number; // default 72 hours
}): Promise<CollectionCode> {
  const expiryHours = params.expiryHours || 72;
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // Generate 6-digit collection code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Generate QR code (in production, use QR code library)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${code}`;

  const collectionCode: CollectionCode = {
    code,
    remittanceId: params.remittanceId,
    amount: params.amount,
    currency: params.currency,
    recipientPhone: params.recipientPhone,
    expiresAt,
    qrCodeUrl,
    status: 'active',
  };

  // In production, register code with agent provider API
  switch (params.provider) {
    case 'paga':
      await registerPagaCollectionCode(collectionCode);
      break;
    case 'opay':
      await registerOPayCollectionCode(collectionCode);
      break;
    case 'kudi':
      await registerKudiCollectionCode(collectionCode);
      break;
  }

  // Store in database
  // await db.createCollectionCode(collectionCode);

  return collectionCode;
}

/**
 * Check collection code status
 */
export async function getCollectionCodeStatus(code: string): Promise<{
  code: string;
  status: 'active' | 'collected' | 'expired' | 'cancelled';
  collectedAt?: Date;
  agentId?: string;
  agentName?: string;
}> {
  // In production, fetch from database and check with provider
  // const collectionCode = await db.getCollectionCode(code);

  return {
    code,
    status: 'active',
  };
}

/**
 * Cancel collection code
 */
export async function cancelCollectionCode(code: string): Promise<boolean> {
  // In production, update database and notify provider
  // await db.updateCollectionCode(code, { status: 'cancelled' });

  return true;
}

/**
 * Get agent details
 */
export async function getAgentDetails(agentId: string): Promise<AgentLocation | null> {
  // In production, fetch from provider API
  const agents = await findNearbyAgents({
    latitude: 6.5244,
    longitude: 3.3792,
  });

  return agents.find(a => a.agentId === agentId) || null;
}

/**
 * Calculate agent cash pickup fee
 */
export function calculateAgentFee(amount: number, provider: 'paga' | 'opay' | 'kudi'): number {
  // Fee structure varies by provider
  const feeStructure: Record<string, { percentage: number; min: number; max: number }> = {
    paga: { percentage: 0.5, min: 50, max: 500 },
    opay: { percentage: 0.3, min: 30, max: 300 },
    kudi: { percentage: 0.4, min: 40, max: 400 },
  };

  const config = feeStructure[provider];
  const calculatedFee = amount * (config.percentage / 100);

  return Math.max(config.min, Math.min(calculatedFee, config.max));
}

/**
 * Paga Integration
 */
async function registerPagaCollectionCode(collectionCode: CollectionCode): Promise<void> {
  // In production, call Paga API
  console.log('[Paga] Registered collection code:', collectionCode.code);

  // Example Paga API call:
  // const response = await fetch('https://api.paga.com/v1/collection-codes', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${process.env.PAGA_API_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     code: collectionCode.code,
  //     amount: collectionCode.amount,
  //     recipientPhone: collectionCode.recipientPhone,
  //     expiresAt: collectionCode.expiresAt,
  //   }),
  // });
}

/**
 * OPay Integration
 */
async function registerOPayCollectionCode(collectionCode: CollectionCode): Promise<void> {
  // In production, call OPay API
  console.log('[OPay] Registered collection code:', collectionCode.code);

  // Example OPay API call:
  // const response = await fetch('https://api.opay.com/v1/cashout/create', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'MerchantId': process.env.OPAY_MERCHANT_ID,
  //     'Authorization': `Bearer ${process.env.OPAY_API_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     reference: collectionCode.remittanceId,
  //     code: collectionCode.code,
  //     amount: collectionCode.amount,
  //     phoneNumber: collectionCode.recipientPhone,
  //     expiryTime: collectionCode.expiresAt.toISOString(),
  //   }),
  // });
}

/**
 * Kudi Integration
 */
async function registerKudiCollectionCode(collectionCode: CollectionCode): Promise<void> {
  // In production, call Kudi API
  console.log('[Kudi] Registered collection code:', collectionCode.code);

  // Example Kudi API call:
  // const response = await fetch('https://api.kudi.com/v1/withdrawals', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'X-API-Key': process.env.KUDI_API_KEY,
  //   },
  //   body: JSON.stringify({
  //     withdrawalCode: collectionCode.code,
  //     amount: collectionCode.amount,
  //     currency: collectionCode.currency,
  //     recipientPhone: collectionCode.recipientPhone,
  //     expiresAt: collectionCode.expiresAt,
  //   }),
  // });
}

/**
 * Send collection code via SMS
 */
export async function sendCollectionCodeSMS(params: {
  recipientPhone: string;
  code: string;
  amount: number;
  agentName: string;
  expiresAt: Date;
}): Promise<boolean> {
  const message = `Your cash pickup code is: ${params.code}. Collect ₦${params.amount.toLocaleString()} from any ${params.agentName} agent. Code expires on ${params.expiresAt.toLocaleDateString()}. Keep this code secure.`;

  // In production, send via Twilio, Africa's Talking, etc.
  console.log(`[SMS] Sending to ${params.recipientPhone}: ${message}`);

  return true;
}

/**
 * Validate collection code format
 */
export function validateCollectionCode(code: string): boolean {
  // 6-digit numeric code
  return /^\d{6}$/.test(code);
}

/**
 * Get supported agent providers
 */
export function getSupportedProviders(): Array<{
  id: string;
  name: string;
  description: string;
  feePercentage: number;
  minFee: number;
  maxFee: number;
  coverage: string[];
}> {
  return [
    {
      id: 'paga',
      name: 'Paga',
      description: 'Largest agent network in Nigeria with 25,000+ agents',
      feePercentage: 0.5,
      minFee: 50,
      maxFee: 500,
      coverage: ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan'],
    },
    {
      id: 'opay',
      name: 'OPay',
      description: 'Fast-growing mobile money platform with 10,000+ agents',
      feePercentage: 0.3,
      minFee: 30,
      maxFee: 300,
      coverage: ['Lagos', 'Abuja', 'Ogun', 'Rivers', 'Oyo'],
    },
    {
      id: 'kudi',
      name: 'Kudi',
      description: 'Digital banking platform with 5,000+ cash points',
      feePercentage: 0.4,
      minFee: 40,
      maxFee: 400,
      coverage: ['Lagos', 'Abuja', 'Enugu', 'Kaduna'],
    },
  ];
}
