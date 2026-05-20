import type { Request } from "express";
import { jwtVerify } from "jose";
import { getAgentById } from "../db";
import type { Agent } from "../../drizzle/schema";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://auth-service:8080";

export interface AgentSession {
  id: number;
  agentCode: string;
  name: string;
  tier: string;
  role: string;
}

export async function getAgentFromCookie(
  req: Request
): Promise<AgentSession | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(/agent_session=([^;]+)/);
  if (!match) return null;

  const token = match[1];

  // Try auth-service validation first (production path)
  try {
    const resp = await fetch(`${AUTH_SERVICE_URL}/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        valid: boolean;
        user?: {
          sub: string;
          email: string;
          name: string;
          tier: string;
          roles: string[];
          agent_code: string;
        };
      };
      if (data.valid && data.user) {
        return {
          id: Number(data.user.sub) || 0,
          agentCode: data.user.agent_code || "",
          name: data.user.name || data.user.email,
          tier: data.user.tier || "basic",
          role: data.user.roles?.[0] || "agent",
        };
      }
    }
  } catch {
    // Auth service unreachable — fall through to local JWT validation
  }

  // Fallback: local JWT verification (dev/offline mode)
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "pos54link-secret"
    );
    const { payload } = await jwtVerify(token, secret);
    return {
      id: Number(payload.sub),
      agentCode: payload.agentCode as string,
      name: payload.name as string,
      tier: payload.tier as string,
      role: (payload.role as string) ?? "agent",
    };
  } catch {
    return null;
  }
}

export async function requireAgent(req: Request): Promise<Agent> {
  const session = await getAgentFromCookie(req);
  if (!session) {
    const err = new Error("Agent session required") as any;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  const agent = await getAgentById(session.id);
  if (!agent) {
    const err = new Error("Agent not found") as any;
    err.code = "NOT_FOUND";
    throw err;
  }
  return agent;
}
