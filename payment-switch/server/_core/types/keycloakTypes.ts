// Keycloak OIDC TypeScript types
// Standard OIDC/Keycloak types for authentication

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
}

export interface AuthorizeRequest {
  redirectUri: string;
  clientId: string;
  state: string;
  responseType: string;
  scope: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface AuthorizeResponse {
  redirectUrl: string;
}

export interface TokenRequest {
  grantType: string;
  code?: string;
  refreshToken?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  codeVerifier?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope: string;
  id_token?: string;
  session_state?: string;
}

export interface UserInfoResponse {
  sub: string;  // Keycloak subject ID (replaces openId)
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
}

export interface IntrospectRequest {
  token: string;
  token_type_hint?: string;
}

export interface IntrospectResponse {
  active: boolean;
  sub?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  realm_access?: {
    roles: string[];
  };
}

export interface LogoutRequest {
  refreshToken?: string;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
}

// Mapped types for backward compatibility
export interface ExchangeTokenRequest extends TokenRequest {}
export interface ExchangeTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
  idToken: string;
}

export interface GetUserInfoResponse {
  sub: string;      // Keycloak subject ID
  openId: string;   // Alias for sub (backward compatibility)
  projectId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
  roles?: string[];
}

export interface GetUserInfoWithJwtRequest {
  jwtToken: string;
  projectId: string;
}

export interface GetUserInfoWithJwtResponse extends GetUserInfoResponse {}

// Helper function to convert Keycloak token response to legacy format
export function toExchangeTokenResponse(keycloakResponse: TokenResponse): ExchangeTokenResponse {
  return {
    accessToken: keycloakResponse.access_token,
    tokenType: keycloakResponse.token_type,
    expiresIn: keycloakResponse.expires_in,
    refreshToken: keycloakResponse.refresh_token,
    scope: keycloakResponse.scope,
    idToken: keycloakResponse.id_token || '',
  };
}

// Helper function to convert Keycloak user info to legacy format
export function toGetUserInfoResponse(
  keycloakUserInfo: UserInfoResponse,
  projectId: string
): GetUserInfoResponse {
  return {
    sub: keycloakUserInfo.sub,
    openId: keycloakUserInfo.sub,  // Map sub to openId for backward compatibility
    projectId,
    name: keycloakUserInfo.name || keycloakUserInfo.preferred_username || '',
    email: keycloakUserInfo.email || null,
    platform: 'keycloak',
    loginMethod: 'oidc',
    roles: keycloakUserInfo.realm_access?.roles || [],
  };
}
