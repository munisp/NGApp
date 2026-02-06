interface KeycloakConfig {
  realm: string;
  serverUrl: string;
  clientId: string;
  clientSecret: string;
}

interface KeycloakToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface KeycloakUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  realm_access?: { roles: string[] };
}

function getConfig(): KeycloakConfig {
  return {
    realm: process.env.KEYCLOAK_REALM || 'fintech',
    serverUrl: process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8080',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'fintech-app',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  };
}

function getTokenUrl(config: KeycloakConfig): string {
  return `${config.serverUrl}/realms/${config.realm}/protocol/openid-connect/token`;
}

function getUserInfoUrl(config: KeycloakConfig): string {
  return `${config.serverUrl}/realms/${config.realm}/protocol/openid-connect/userinfo`;
}

function getLogoutUrl(config: KeycloakConfig): string {
  return `${config.serverUrl}/realms/${config.realm}/protocol/openid-connect/logout`;
}

function getCertsUrl(config: KeycloakConfig): string {
  return `${config.serverUrl}/realms/${config.realm}/protocol/openid-connect/certs`;
}

export async function authenticateWithKeycloak(
  username: string,
  password: string
): Promise<KeycloakToken> {
  const config = getConfig();
  const tokenUrl = getTokenUrl(config);

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    username,
    password,
    scope: 'openid profile email',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error_description: 'Authentication failed' }));
    throw new Error(error.error_description || 'Authentication failed');
  }

  return response.json();
}

export async function refreshKeycloakToken(refreshToken: string): Promise<KeycloakToken> {
  const config = getConfig();
  const tokenUrl = getTokenUrl(config);

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

export async function getUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
  const config = getConfig();
  const userInfoUrl = getUserInfoUrl(config);

  const response = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}

export async function logoutFromKeycloak(refreshToken: string): Promise<void> {
  const config = getConfig();
  const logoutUrl = getLogoutUrl(config);

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  await fetch(logoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const userInfo = await getUserInfo(accessToken);
    return !!userInfo.sub;
  } catch {
    return false;
  }
}

export async function getJWKS(): Promise<Record<string, unknown>> {
  const config = getConfig();
  const certsUrl = getCertsUrl(config);

  const response = await fetch(certsUrl);
  if (!response.ok) {
    throw new Error('Failed to get JWKS');
  }

  return response.json();
}

export const keycloakAuth = {
  authenticate: authenticateWithKeycloak,
  refresh: refreshKeycloakToken,
  getUserInfo,
  logout: logoutFromKeycloak,
  validate: validateToken,
  getJWKS,
};
