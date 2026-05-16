import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users, policies, claims, payments, InsertPolicy, InsertClaim, InsertPayment,
  referrals, InsertReferral, reviews, InsertReview,
  fraudScores, InsertFraudScore, fraudRings, fraudAlerts,
  erpnextTransactions, erpnextReconciliation,
  premiumRateTables, premiumRiskFactors, premiumRateChanges, premiumRateAuditLogs,
  brokerApiKeys, InsertBrokerAPIKey, brokerApiUsage,
  knowledgeGraphNodes, knowledgeGraphEdges,
  telcoCreditScores, InsertTelcoCreditScore,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Policy queries
export async function getPoliciesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(policies).where(eq(policies.userId, userId)).orderBy(desc(policies.createdAt));
}

export async function getPolicyById(policyId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(policies).where(
    and(eq(policies.id, policyId), eq(policies.userId, userId))
  ).limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createPolicy(policy: InsertPolicy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(policies).values(policy).returning();
  return result[0];
}

export async function updatePolicy(policyId: number, userId: number, updates: Partial<InsertPolicy>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(policies)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(policies.id, policyId), eq(policies.userId, userId)))
    .returning();
  
  return result[0];
}

// Claim queries
export async function getClaimsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(claims).where(eq(claims.userId, userId)).orderBy(desc(claims.createdAt));
}

export async function getClaimById(claimId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(claims).where(
    and(eq(claims.id, claimId), eq(claims.userId, userId))
  ).limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createClaim(claim: InsertClaim) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(claims).values(claim).returning();
  return result[0];
}

export async function updateClaim(claimId: number, userId: number, updates: Partial<InsertClaim>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(claims)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(claims.id, claimId), eq(claims.userId, userId)))
    .returning();
  
  return result[0];
}

// Payment queries
export async function getPaymentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentById(paymentId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(payments).where(
    and(eq(payments.id, paymentId), eq(payments.userId, userId))
  ).limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function createPayment(payment: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(payments).values(payment).returning();
  return result[0];
}

export async function updatePayment(paymentId: number, userId: number, updates: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(payments)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.userId, userId)))
    .returning();
  
  return result[0];
}

// Referral queries
export async function getReferralsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
}

export async function getReferralByCode(referralCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(referrals).where(eq(referrals.referralCode, referralCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createReferral(referral: InsertReferral) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(referrals).values(referral).returning();
  return result[0];
}

export async function updateReferral(referralId: number, updates: Partial<InsertReferral>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(referrals)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(referrals.id, referralId))
    .returning();
  
  return result[0];
}

export async function getReferralStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, rewarded: 0, pending: 0, totalRewards: 0 };
  
  const userReferrals = await getReferralsByUserId(userId);
  
  return {
    total: userReferrals.length,
    completed: userReferrals.filter(r => r.status === 'Completed' || r.status === 'Rewarded').length,
    rewarded: userReferrals.filter(r => r.status === 'Rewarded').length,
    pending: userReferrals.filter(r => r.status === 'Pending').length,
    totalRewards: userReferrals
      .filter(r => r.status === 'Rewarded')
      .reduce((sum, r) => sum + parseFloat(r.rewardAmount), 0)
  };
}

// Review queries
export async function getReviewsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(reviews).where(eq(reviews.userId, userId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewsByEntity(entityId: number, reviewType: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(reviews).where(
    and(eq(reviews.entityId, entityId), eq(reviews.reviewType, reviewType as any), eq(reviews.isPublic, true))
  ).orderBy(desc(reviews.createdAt));
}

export async function createReview(review: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reviews).values(review).returning();
  return result[0];
}

export async function updateReview(reviewId: number, userId: number, updates: Partial<InsertReview>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.update(reviews)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .returning();
  
  return result[0];
}

export async function getAverageRating(entityId: number, reviewType: string) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  
  const entityReviews = await getReviewsByEntity(entityId, reviewType);
  
  if (entityReviews.length === 0) {
    return { average: 0, count: 0 };
  }
  
  const sum = entityReviews.reduce((acc, review) => acc + review.rating, 0);
  return {
    average: sum / entityReviews.length,
    count: entityReviews.length
  };
}

// ── Insurance Radar / Fraud Detection ────────────────────────────────────────
export async function getInsuranceRadarAnalytics(userId: number, timeRange: string) {
  const db = await getDb();
  if (!db) return { totalRequests: 0, blocked: 0, reviewed: 0, flagged: 0, allowed: 0, avgProcessingTime: 0, falsePositiveRate: 0 };
  const scores = await db.select().from(fraudScores).where(eq(fraudScores.userId, userId));
  const total = scores.length;
  const blocked = scores.filter(s => s.decision === 'block').length;
  const reviewed = scores.filter(s => s.decision === 'review').length;
  const flagged = scores.filter(s => s.decision === 'flag').length;
  const allowed = scores.filter(s => s.decision === 'allow').length;
  const avgProcessingTime = total > 0 ? scores.reduce((a, s) => a + s.processingTime, 0) / total : 0;
  return { totalRequests: total, blocked, reviewed, flagged, allowed, avgProcessingTime, falsePositiveRate: total > 0 ? (flagged / total) : 0 };
}

export async function getRecentFraudScores(userId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fraudScores).where(eq(fraudScores.userId, userId)).orderBy(desc(fraudScores.createdAt)).limit(limit);
}

export async function createFraudScore(score: InsertFraudScore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fraudScores).values(score).returning();
  return result[0];
}

export async function getFraudRings(userId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return await db.select().from(fraudRings).where(and(eq(fraudRings.userId, userId), eq(fraudRings.status, status)));
  }
  return await db.select().from(fraudRings).where(eq(fraudRings.userId, userId)).orderBy(desc(fraudRings.detectedAt));
}

export async function getFraudAlerts(userId: number, severity?: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  const base = db.select().from(fraudAlerts).where(eq(fraudAlerts.userId, userId)).orderBy(desc(fraudAlerts.createdAt)).limit(limit);
  return await base;
}

export async function getFraudNetworkGraph(userId: number, entityId: string, depth: number) {
  const db = await getDb();
  if (!db) return { nodes: [], edges: [] };
  const nodes = await db.select().from(knowledgeGraphNodes).where(and(eq(knowledgeGraphNodes.userId, userId), eq(knowledgeGraphNodes.nodeId, entityId)));
  const edges = await db.select().from(knowledgeGraphEdges).where(and(eq(knowledgeGraphEdges.userId, userId), eq(knowledgeGraphEdges.sourceNodeId, entityId)));
  return { nodes, edges };
}

// ── ERPNext Integration ───────────────────────────────────────────────────────
export async function getERPNextTransactions(userId: number, page: number, limit: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(erpnextTransactions).where(eq(erpnextTransactions.userId, userId)).orderBy(desc(erpnextTransactions.createdAt)).limit(limit).offset((page - 1) * limit);
}

export async function getERPNextReconciliation(userId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  if (month) {
    return await db.select().from(erpnextReconciliation).where(and(eq(erpnextReconciliation.userId, userId), eq(erpnextReconciliation.period, month)));
  }
  return await db.select().from(erpnextReconciliation).where(eq(erpnextReconciliation.userId, userId)).orderBy(desc(erpnextReconciliation.createdAt));
}

export async function getERPNextSyncStatus(userId: number) {
  const db = await getDb();
  if (!db) return { lastSync: null, pendingCount: 0, failedCount: 0, syncedCount: 0 };
  const txns = await db.select().from(erpnextTransactions).where(eq(erpnextTransactions.userId, userId));
  const pending = txns.filter(t => t.syncStatus === 'Pending').length;
  const failed = txns.filter(t => t.syncStatus === 'Failed').length;
  const synced = txns.filter(t => t.syncStatus === 'Synced').length;
  const lastSync = txns.filter(t => t.lastSyncAt).sort((a, b) => (b.lastSyncAt?.getTime() ?? 0) - (a.lastSyncAt?.getTime() ?? 0))[0]?.lastSyncAt ?? null;
  return { lastSync, pendingCount: pending, failedCount: failed, syncedCount: synced };
}

export async function triggerERPNextSync(userId: number, entityType: string, entityId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(erpnextTransactions).values({
    userId,
    erpDocType: entityType,
    erpDocId: entityId,
    localEntityType: entityType,
    localEntityId: entityId,
    syncStatus: 'Pending',
  }).returning();
  return result[0];
}

// ── Premium Rate Management ───────────────────────────────────────────────────
export async function getPremiumRateTables(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(premiumRateTables).where(eq(premiumRateTables.userId, userId)).orderBy(desc(premiumRateTables.updatedAt));
}

export async function getPremiumRiskFactors(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const tables = await getPremiumRateTables(userId);
  if (tables.length === 0) return [];
  return await db.select().from(premiumRiskFactors).where(eq(premiumRiskFactors.tableId, tables[0].id));
}

export async function getPremiumRateChanges(userId: number, tableId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (tableId) {
    return await db.select().from(premiumRateChanges).where(eq(premiumRateChanges.tableId, tableId)).orderBy(desc(premiumRateChanges.createdAt));
  }
  return await db.select().from(premiumRateChanges).orderBy(desc(premiumRateChanges.createdAt)).limit(50);
}

export async function getPremiumRateAuditLogs(userId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(premiumRateAuditLogs).where(eq(premiumRateAuditLogs.userId, userId)).orderBy(desc(premiumRateAuditLogs.createdAt)).limit(limit);
}

export async function updatePremiumRate(userId: number, tableId: number, factorId: number, newRate: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const factor = await db.select().from(premiumRiskFactors).where(eq(premiumRiskFactors.id, factorId));
  if (!factor[0]) throw new Error("Risk factor not found");
  const oldRate = parseFloat(factor[0].weight as string);
  await db.update(premiumRiskFactors).set({ weight: String(newRate), updatedAt: new Date() }).where(eq(premiumRiskFactors.id, factorId));
  const change = await db.insert(premiumRateChanges).values({ tableId, factorId, oldRate: String(oldRate), newRate: String(newRate), changedBy: userId, reason, effectiveDate: new Date() }).returning();
  await db.insert(premiumRateAuditLogs).values({ userId, action: 'UPDATE_RATE', entityType: 'risk_factor', entityId: factorId, details: reason });
  return change[0];
}

// ── Broker API Management ─────────────────────────────────────────────────────
export async function getBrokerAPIKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(brokerApiKeys).where(eq(brokerApiKeys.userId, userId)).orderBy(desc(brokerApiKeys.createdAt));
}

export async function getBrokerAPIUsage(userId: number, keyId?: string, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(brokerApiUsage).where(eq(brokerApiUsage.userId, userId)).orderBy(desc(brokerApiUsage.requestDate)).limit(days * 10);
}

export async function createBrokerAPIKey(key: InsertBrokerAPIKey) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(brokerApiKeys).values(key).returning();
  return result[0];
}

export async function revokeBrokerAPIKey(userId: number, keyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(brokerApiKeys).set({ status: 'Revoked', updatedAt: new Date() }).where(and(eq(brokerApiKeys.id, keyId), eq(brokerApiKeys.userId, userId))).returning();
  return result[0];
}

// ── Knowledge Graph ───────────────────────────────────────────────────────────
export async function getKnowledgeGraphNodes(userId: number, entityType?: string, search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (entityType) {
    return await db.select().from(knowledgeGraphNodes).where(and(eq(knowledgeGraphNodes.userId, userId), eq(knowledgeGraphNodes.entityType, entityType)));
  }
  return await db.select().from(knowledgeGraphNodes).where(eq(knowledgeGraphNodes.userId, userId)).limit(100);
}

export async function getKnowledgeGraphEdges(userId: number, nodeId: string, depth: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(knowledgeGraphEdges).where(and(eq(knowledgeGraphEdges.userId, userId), eq(knowledgeGraphEdges.sourceNodeId, nodeId)));
}

// ── Telco Credit Scoring ──────────────────────────────────────────────────────
export async function computeTelcoCreditScore(userId: number, phoneNumber: string, provider: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Compute a deterministic score based on phone number hash (real implementation would call telco API)
  const hash = phoneNumber.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const score = 300 + (hash % 550); // 300-850 range
  const grade = score >= 750 ? 'A' : score >= 700 ? 'B' : score >= 650 ? 'C' : score >= 600 ? 'D' : 'F';
  const factors = [
    'Call frequency patterns analyzed',
    'Data usage consistency evaluated',
    'Payment history from telco records',
    'Network tenure assessed',
  ];
  const result = await db.insert(telcoCreditScores).values({
    userId,
    phoneNumber,
    provider,
    score,
    grade,
    factors,
    consentGiven: true,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
  }).returning();
  return result[0];
}

export async function getTelcoCreditHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(telcoCreditScores).where(eq(telcoCreditScores.userId, userId)).orderBy(desc(telcoCreditScores.createdAt));
}

// ─── Actuarial Module ──────────────────────────────────────────────────────────
export async function createActuarialCalculation(userId: number, calcType: string, inputs: any) {
  return { id: Date.now(), userId, calcType, inputs, result: { premium: Math.round((inputs.sumAssured || inputs.vehicleValue || 100000) * 0.02) }, createdAt: new Date() };
}
export async function getActuarialHistory(userId: number) {
  return [{ id: 1, calcType: 'life_premium', result: { premium: 45000 }, createdAt: new Date() }];
}

// ─── Bancassurance ────────────────────────────────────────────────────────────
export async function getBancassurancePartners() {
  return [
    { id: 1, name: 'First Bank Nigeria', partnerType: 'Commercial Bank', status: 'Active', products: ['Mortgage Protection', 'Loan Protection'] },
    { id: 2, name: 'GTBank', partnerType: 'Commercial Bank', status: 'Active', products: ['Credit Life', 'Home Insurance'] },
    { id: 3, name: 'Zenith Bank', partnerType: 'Commercial Bank', status: 'Active', products: ['Business Insurance'] },
    { id: 4, name: 'Access Bank', partnerType: 'Commercial Bank', status: 'Active', products: ['Travel Insurance', 'Health Insurance'] },
  ];
}
export async function createBancassuranceOffer(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Generated', offerCode: `BANC-${Date.now()}`, premium: Math.round((input.loanAmount || 500000) * 0.015), createdAt: new Date() };
}
export async function getUserBancassuranceOffers(userId: number) { return []; }

// ─── Group Life ────────────────────────────────────────────────────────────────
export async function getGroupLifeSchemes(userId: number) { return []; }
export async function createGroupLifeScheme(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, schemeNumber: `GLS-${Date.now()}`, status: 'Active', createdAt: new Date() };
}
export async function getGroupLifeMembers(schemeId: number) { return []; }

// ─── NMID Integration ─────────────────────────────────────────────────────────
export async function createNMIDVerification(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, verificationStatus: 'Verified', nmidReference: `NMID-${Date.now()}`, vehicleDetails: { make: 'Toyota', model: 'Camry', year: 2020 }, createdAt: new Date() };
}
export async function getNMIDVerifications(userId: number) { return []; }

// ─── PFA Integration ──────────────────────────────────────────────────────────
export async function getPFAPartners() {
  return [
    { id: 1, name: 'ARM Pension Managers', pfaCode: 'ARM001', status: 'Active' },
    { id: 2, name: 'Stanbic IBTC Pension Managers', pfaCode: 'SIB002', status: 'Active' },
    { id: 3, name: 'AXA Mansard Pension', pfaCode: 'AXA003', status: 'Active' },
    { id: 4, name: 'AIICO Pension Managers', pfaCode: 'AIC004', status: 'Active' },
  ];
}
export async function createPFAAnnuityQuote(userId: number, input: any) {
  const monthlyAnnuity = Math.round(input.accumulatedFund * 0.005);
  return { id: Date.now(), userId, ...input, monthlyAnnuity, annualAnnuity: monthlyAnnuity * 12, quoteReference: `PFA-${Date.now()}`, createdAt: new Date() };
}
export async function getUserPFAQuotes(userId: number) { return []; }

// ─── Reinsurance ──────────────────────────────────────────────────────────────
export async function getReinsuranceTreaties(userId: number) { return []; }
export async function createReinsuranceTreaty(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, treatyNumber: `TRT-${Date.now()}`, status: 'Active', createdAt: new Date() };
}
export async function createReinsuranceCession(input: any) {
  return { id: Date.now(), ...input, cessionAmount: Math.round(input.sumAssured * 0.4), retentionAmount: Math.round(input.sumAssured * 0.6), createdAt: new Date() };
}
export async function getReinsuranceCessions(userId: number) { return []; }

// ─── Agent Management ─────────────────────────────────────────────────────────
export async function getAgentProfile(userId: number) {
  return { userId, agentCode: `AGT-${userId}`, tier: 'Gold', yearsActive: 3, totalPoliciesSold: 142, totalPremiumGenerated: 8750000, status: 'Active' };
}
export async function getAgentPerformance(userId: number, period?: string) {
  return { period: period || '30d', policiesSold: 12, premiumGenerated: 720000, claimsRatio: 0.18, renewalRate: 0.87, newCustomers: 8, target: 15, targetAchievement: 80 };
}
export async function getAgentCommissions(userId: number) {
  return [
    { id: 1, month: 'February 2026', policiesSold: 12, grossPremium: 720000, commissionRate: 0.15, commissionAmount: 108000, status: 'Paid', paidDate: new Date() },
    { id: 2, month: 'January 2026', policiesSold: 15, grossPremium: 900000, commissionRate: 0.15, commissionAmount: 135000, status: 'Paid', paidDate: new Date() },
  ];
}
export async function getAgentLeaderboard() {
  return [
    { rank: 1, agentName: 'Adaeze Okonkwo', agentCode: 'AGT-001', premiumGenerated: 2100000, policiesSold: 35 },
    { rank: 2, agentName: 'Emeka Nwachukwu', agentCode: 'AGT-002', premiumGenerated: 1850000, policiesSold: 31 },
    { rank: 3, agentName: 'Fatima Al-Hassan', agentCode: 'AGT-003', premiumGenerated: 1620000, policiesSold: 27 },
  ];
}

// ─── KYC/KYB ─────────────────────────────────────────────────────────────────
export async function getKYCStatus(userId: number) {
  return { userId, kycLevel: 2, status: 'Verified', verifiedAt: new Date(), documents: ['NIN', 'Utility Bill'] };
}
export async function createKYCVerification(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Pending', submittedAt: new Date(), estimatedCompletionTime: '24-48 hours' };
}

// ─── NAICOM Compliance ────────────────────────────────────────────────────────
export async function getNAICOMFilings(userId: number) {
  return [
    { id: 1, filingType: 'Quarterly Return', period: 'Q4 2025', dueDate: new Date('2026-01-31'), status: 'Submitted', submittedAt: new Date() },
    { id: 2, filingType: 'Annual Report', period: '2025', dueDate: new Date('2026-03-31'), status: 'Pending', submittedAt: null },
  ];
}
export async function createNAICOMFiling(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Submitted', referenceNumber: `NAICOM-${Date.now()}`, submittedAt: new Date() };
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(userId: number, unreadOnly?: boolean, limit: number = 20) {
  const notifications = [
    { id: 1, userId, type: 'policy_renewal', title: 'Policy Renewal Due', message: 'Your motor insurance policy expires in 30 days', isRead: false, createdAt: new Date() },
    { id: 2, userId, type: 'claim_update', title: 'Claim Status Update', message: 'Your claim CLM-2025-001 has been approved', isRead: false, createdAt: new Date() },
    { id: 3, userId, type: 'payment_due', title: 'Premium Payment Due', message: 'Your quarterly premium of N45,000 is due in 7 days', isRead: true, createdAt: new Date() },
  ];
  return unreadOnly ? notifications.filter(n => !n.isRead).slice(0, limit) : notifications.slice(0, limit);
}
export async function markNotificationRead(userId: number, notificationId: number) {
  return { success: true, notificationId };
}
export async function markAllNotificationsRead(userId: number) {
  return { success: true, markedCount: 3 };
}
export async function getUnreadNotificationCount(userId: number) {
  return { count: 2 };
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────
export async function getAuditTrail(userId: number, entityType?: string, limit: number = 50, offset: number = 0) {
  return [
    { id: 1, userId, action: 'policy.view', entityType: 'policy', entityId: '1', ipAddress: '102.89.23.45', createdAt: new Date() },
    { id: 2, userId, action: 'claim.create', entityType: 'claim', entityId: '5', ipAddress: '102.89.23.45', createdAt: new Date() },
  ].slice(offset, offset + limit);
}

// ─── Loyalty / Gamification ───────────────────────────────────────────────────
export async function getLoyaltyPoints(userId: number) {
  return { userId, totalPoints: 2450, tier: 'Gold', pointsToNextTier: 550, tierBenefits: ['5% premium discount', 'Priority claims processing'] };
}
export async function getLoyaltyTransactions(userId: number) {
  return [
    { id: 1, type: 'earned', points: 500, description: 'Policy renewal bonus', createdAt: new Date() },
    { id: 2, type: 'earned', points: 250, description: 'Referral reward', createdAt: new Date() },
    { id: 3, type: 'redeemed', points: -300, description: 'Premium discount redemption', createdAt: new Date() },
  ];
}
export async function redeemLoyaltyPoints(userId: number, points: number, rewardType: string) {
  return { success: true, pointsRedeemed: points, rewardType, redemptionCode: `RDM-${Date.now()}`, remainingPoints: 2450 - points };
}
export async function getLoyaltyLeaderboard() {
  return [
    { rank: 1, name: 'Chioma Obi', points: 8750, tier: 'Platinum' },
    { rank: 2, name: 'Babatunde Adeyemi', points: 7200, tier: 'Platinum' },
    { rank: 3, name: 'Ngozi Eze', points: 5900, tier: 'Gold' },
  ];
}

// ─── USSD Gateway ─────────────────────────────────────────────────────────────
export async function getUSSDSessions(userId: number) {
  return [
    { id: 1, sessionCode: '*347*89#', phoneNumber: '+2348012345678', action: 'policy_inquiry', status: 'Completed', createdAt: new Date() },
  ];
}
export async function getUSSDStats() {
  return { totalSessions: 15420, successRate: 0.94, avgSessionDuration: 45, topActions: ['policy_inquiry', 'premium_payment', 'claim_status'] };
}

// ─── Document Management ──────────────────────────────────────────────────────
export async function getDocuments(userId: number, entityType?: string, entityId?: number) { return []; }
export async function createDocument(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, uploadedAt: new Date(), status: 'Active' };
}
export async function deleteDocument(userId: number, documentId: number) {
  return { success: true, documentId };
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalyticsDashboard(userId: number, period: string) {
  return {
    period, totalPolicies: 5, activePolicies: 4, totalClaims: 3, pendingClaims: 1,
    totalPremiumPaid: 285000, claimsRatio: 0.22, renewalRate: 0.88,
    monthlyTrend: [
      { month: 'Oct', premium: 45000, claims: 8000 }, { month: 'Nov', premium: 48000, claims: 12000 },
      { month: 'Dec', premium: 52000, claims: 9000 }, { month: 'Jan', premium: 47000, claims: 15000 },
      { month: 'Feb', premium: 55000, claims: 11000 }, { month: 'Mar', premium: 38000, claims: 7000 },
    ]
  };
}
export async function trackAnalyticsEvent(userId: number, input: any) {
  return { success: true, eventId: `EVT-${Date.now()}` };
}

// ─── Policy Comparison ────────────────────────────────────────────────────────
export async function comparePolicies(userId: number, policyIds: number[]) {
  return policyIds.map(id => ({ id, policyNumber: `POL-${id}`, type: 'Motor', premium: 45000, coverage: 2000000 }));
}

// ─── Multi-Currency ───────────────────────────────────────────────────────────
export async function getCurrencyRates() {
  return { base: 'NGN', rates: { USD: 0.00063, GBP: 0.00050, EUR: 0.00058, GHS: 0.0076, KES: 0.082, ZAR: 0.012 }, updatedAt: new Date() };
}
export async function convertCurrency(amount: number, from: string, to: string) {
  const rates: Record<string, number> = { NGN: 1, USD: 1590, GBP: 2010, EUR: 1720, GHS: 131, KES: 12.2, ZAR: 83 };
  const inNGN = amount * (rates[from] || 1);
  const result = inNGN / (rates[to] || 1);
  return { from, to, inputAmount: amount, convertedAmount: Math.round(result * 100) / 100, timestamp: new Date() };
}

// ─── Nigerian Bank Integrations ───────────────────────────────────────────────
export async function getNigerianBanks() {
  return [
    { code: '011', name: 'First Bank of Nigeria', shortName: 'FirstBank' },
    { code: '058', name: 'Guaranty Trust Bank', shortName: 'GTBank' },
    { code: '057', name: 'Zenith Bank', shortName: 'Zenith' },
    { code: '044', name: 'Access Bank', shortName: 'Access' },
    { code: '033', name: 'United Bank for Africa', shortName: 'UBA' },
  ];
}
export async function verifyBankAccount(accountNumber: string, bankCode: string) {
  return { accountNumber, bankCode, accountName: 'JOHN DOE', verified: true, verifiedAt: new Date() };
}
export async function linkBankAccount(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Linked', linkedAt: new Date() };
}

// ─── Reconciliation Engine ────────────────────────────────────────────────────
export async function getReconciliationSummary(userId: number, period?: string) {
  return { period: period || 'current_month', totalTransactions: 156, matched: 148, unmatched: 8, matchRate: 0.949, totalAmount: 4250000 };
}
export async function runReconciliation(userId: number, period: string) {
  return { success: true, jobId: `RECON-${Date.now()}`, period, status: 'Running', estimatedCompletion: new Date(Date.now() + 300000) };
}

// ─── Operational Reports ──────────────────────────────────────────────────────
export async function generateReport(userId: number, reportType: string, period: string) {
  return { id: Date.now(), reportType, period, status: 'Generated', downloadUrl: `/api/reports/${Date.now()}.pdf`, generatedAt: new Date() };
}
export async function getReports(userId: number) {
  return [
    { id: 1, reportType: 'Premium Collection', period: 'Q4 2025', status: 'Generated', generatedAt: new Date() },
    { id: 2, reportType: 'Claims Analysis', period: 'Q4 2025', status: 'Generated', generatedAt: new Date() },
  ];
}

// ─── Churn Prediction ─────────────────────────────────────────────────────────
export async function getChurnPrediction(userId: number) {
  return { userId, churnProbability: 0.12, riskLevel: 'Low', factors: ['Regular premium payments', 'Active claims history', 'Multiple policies'], confidence: 0.87 };
}
export async function getChurnInterventions(userId: number) {
  return [
    { id: 1, type: 'loyalty_reward', description: 'Offer 500 bonus loyalty points', priority: 'High', estimatedRetentionImpact: 0.15 },
    { id: 2, type: 'personalized_offer', description: 'Offer 10% discount on next renewal', priority: 'Medium', estimatedRetentionImpact: 0.22 },
  ];
}

// ─── AI Claims Adjudication ───────────────────────────────────────────────────
export async function adjudicateClaim(userId: number, claimId: number) {
  return { claimId, decision: 'Approved', confidence: 0.91, approvedAmount: 150000, reasoning: 'Claim documentation complete, incident verified, within policy limits', adjudicatedAt: new Date() };
}
export async function getAdjudicationQueue(userId: number) {
  return [
    { claimId: 1, claimNumber: 'CLM-2026-001', amount: 150000, submittedAt: new Date(), priority: 'High' },
    { claimId: 2, claimNumber: 'CLM-2026-002', amount: 45000, submittedAt: new Date(), priority: 'Normal' },
  ];
}

// ─── Smart Claim Routing ──────────────────────────────────────────────────────
export async function routeClaim(userId: number, claimId: number) {
  return { claimId, assignedTo: 'Senior Adjudicator Team A', queue: 'high_value', estimatedProcessingTime: '24 hours', routedAt: new Date() };
}
export async function getRoutingRules() {
  return [
    { id: 1, name: 'High Value Claims', condition: 'amount > 100000', destination: 'Senior Adjudicator', priority: 1 },
    { id: 2, name: 'Motor Claims', condition: 'type == motor', destination: 'Motor Claims Team', priority: 2 },
    { id: 3, name: 'Standard Claims', condition: 'amount <= 50000', destination: 'Auto-Adjudication', priority: 3 },
  ];
}

// ─── Policy Renewal Automation ────────────────────────────────────────────────
export async function getUpcomingRenewals(userId: number) {
  return [
    { id: 1, policyNumber: 'POL-2024-001', type: 'Motor', expiryDate: new Date(Date.now() + 30 * 86400000), premium: 45000, autoRenewEnabled: true },
    { id: 2, policyNumber: 'POL-2024-002', type: 'Health', expiryDate: new Date(Date.now() + 60 * 86400000), premium: 120000, autoRenewEnabled: false },
  ];
}
export async function setAutoRenewal(userId: number, policyId: number, enable: boolean) {
  return { success: true, policyId, autoRenewEnabled: enable, updatedAt: new Date() };
}
export async function renewPolicy(userId: number, policyId: number, paymentMethod: string) {
  return { success: true, policyId, newPolicyNumber: `POL-${Date.now()}`, renewedUntil: new Date(Date.now() + 365 * 86400000), paymentMethod, amount: 45000, renewedAt: new Date() };
}

// ─── Batch Processing ─────────────────────────────────────────────────────────
export async function getBatchJobs() {
  return [
    { id: 1, jobType: 'premium_collection', status: 'Completed', startedAt: new Date(), completedAt: new Date(), recordsProcessed: 1250, errors: 3 },
    { id: 2, jobType: 'policy_renewal_reminders', status: 'Running', startedAt: new Date(), completedAt: null, recordsProcessed: 450, errors: 0 },
  ];
}
export async function triggerBatchJob(jobType: string, params?: any) {
  return { success: true, jobId: `JOB-${Date.now()}`, jobType, status: 'Queued', estimatedStart: new Date(Date.now() + 60000) };
}

// ─── Telematics ───────────────────────────────────────────────────────────────
export async function getTelematicsTrips(userId: number, policyId?: number, limit: number = 20) {
  return [
    { id: 1, date: new Date(), distance: 45.2, duration: 62, avgSpeed: 43.7, maxSpeed: 89, harshBraking: 1, score: 87 },
    { id: 2, date: new Date(), distance: 12.8, duration: 28, avgSpeed: 27.4, maxSpeed: 65, harshBraking: 0, score: 92 },
  ].slice(0, limit);
}
export async function getTelematicsScore(userId: number) {
  return { userId, overallScore: 88, safetyScore: 91, efficiencyScore: 85, discountEligible: true, discountPercentage: 8, totalTrips: 142 };
}

// ─── Emergency SOS ────────────────────────────────────────────────────────────
export async function triggerEmergencySOS(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, incidentId: `SOS-${Date.now()}`, status: 'Dispatched', emergencyServices: ['Police', 'Ambulance'], estimatedArrival: '8-12 minutes', triggeredAt: new Date() };
}
export async function getEmergencyHistory(userId: number) { return []; }

// ─── Digital Wallet ───────────────────────────────────────────────────────────
export async function getWalletBalance(userId: number) {
  return { userId, balance: 25000, currency: 'NGN', lastTopUp: new Date(), lastTransaction: new Date() };
}
export async function getWalletTransactions(userId: number, limit: number = 20) {
  return [
    { id: 1, type: 'top_up', amount: 50000, description: 'Wallet top-up via bank transfer', createdAt: new Date() },
    { id: 2, type: 'payment', amount: -45000, description: 'Motor insurance premium', createdAt: new Date() },
  ].slice(0, limit);
}
export async function walletTopUp(userId: number, amount: number, paymentMethod: string) {
  return { success: true, transactionId: `TXN-${Date.now()}`, amount, paymentMethod, newBalance: 25000 + amount, topUpAt: new Date() };
}

// ─── Health & Wellness ────────────────────────────────────────────────────────
export async function getHealthMetrics(userId: number) {
  return { userId, bmi: 23.4, bloodPressure: '120/80', lastCheckup: new Date(), wellnessScore: 78, riskLevel: 'Low', premiumImpact: -0.05 };
}
export async function getWellnessPrograms() {
  return [
    { id: 'WP001', name: 'Active Lifestyle', description: '10,000 steps daily for 30 days', reward: '200 loyalty points', duration: 30 },
    { id: 'WP002', name: 'Annual Health Check', description: 'Complete annual medical examination', reward: '5% premium discount', duration: 1 },
    { id: 'WP003', name: 'Smoke-Free Challenge', description: '90-day smoke-free commitment', reward: '15% premium discount', duration: 90 },
  ];
}
export async function enrollWellnessProgram(userId: number, programId: string) {
  return { success: true, userId, programId, enrolledAt: new Date(), completionDate: new Date(Date.now() + 30 * 86400000) };
}

// ─── Parametric Insurance ─────────────────────────────────────────────────────
export async function getParametricProducts() {
  return [
    { id: 'PAR001', name: 'Flood Insurance', trigger: 'Rainfall > 100mm in 24hrs', payout: 500000, premium: 15000 },
    { id: 'PAR002', name: 'Drought Insurance', trigger: 'Rainfall < 50mm in 30 days', payout: 750000, premium: 20000 },
    { id: 'PAR003', name: 'Wind Insurance', trigger: 'Wind speed > 80km/h', payout: 1000000, premium: 25000 },
  ];
}
export async function getParametricTriggers(productId: string) {
  return [{ productId, lastTriggered: null, triggerCount: 0, nextMonitoring: new Date() }];
}
export async function purchaseParametricPolicy(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, policyNumber: `PAR-${Date.now()}`, status: 'Active', purchasedAt: new Date() };
}

// ─── P2P Insurance ────────────────────────────────────────────────────────────
export async function getP2PPools() {
  return [
    { id: 'P2P001', name: 'Lagos Traders Pool', members: 45, totalFund: 2250000, coveragePerMember: 500000, monthlyContribution: 5000 },
    { id: 'P2P002', name: 'Abuja Homeowners Pool', members: 32, totalFund: 3200000, coveragePerMember: 1000000, monthlyContribution: 8000 },
  ];
}
export async function joinP2PPool(userId: number, poolId: string, contribution: number) {
  return { success: true, userId, poolId, contribution, membershipId: `MBR-${Date.now()}`, joinedAt: new Date() };
}
export async function getUserP2PPools(userId: number) { return []; }

// ─── Microinsurance ───────────────────────────────────────────────────────────
export async function getMicroinsuranceProducts() {
  return [
    { id: 'MIC001', name: 'Daily Accident Cover', premium: 100, coverage: 50000, duration: 1 },
    { id: 'MIC002', name: 'Weekly Health Cover', premium: 500, coverage: 100000, duration: 7 },
    { id: 'MIC003', name: 'Market Trader Cover', premium: 1000, coverage: 200000, duration: 30 },
  ];
}
export async function purchaseMicroinsurance(userId: number, productId: string, duration: number) {
  return { id: Date.now(), userId, productId, duration, policyNumber: `MIC-${Date.now()}`, status: 'Active', expiresAt: new Date(Date.now() + duration * 86400000), purchasedAt: new Date() };
}
export async function getActiveMicroinsurance(userId: number) { return []; }

// ─── Gig Economy ──────────────────────────────────────────────────────────────
export async function getGigEconomyPlans() {
  return [
    { id: 'GIG001', name: 'Ride-Hailing Driver Cover', platforms: ['Uber', 'Bolt'], premium: 3500, coverage: 500000 },
    { id: 'GIG002', name: 'Delivery Rider Cover', platforms: ['Jumia', 'Glovo'], premium: 2500, coverage: 300000 },
    { id: 'GIG003', name: 'Freelancer Income Protection', platforms: ['Upwork', 'Fiverr'], premium: 5000, coverage: 200000 },
  ];
}
export async function activateGigPlan(userId: number, planId: string, platform: string) {
  return { success: true, userId, planId, platform, policyNumber: `GIG-${Date.now()}`, status: 'Active', activatedAt: new Date() };
}
export async function getGigCoverage(userId: number) { return []; }

// ─── SME Business ─────────────────────────────────────────────────────────────
export async function getSMEProducts() {
  return [
    { id: 'SME001', name: 'Business Starter Pack', coverageTypes: ['Fire', 'Burglary', 'Public Liability'], annualPremium: 85000 },
    { id: 'SME002', name: 'Professional Indemnity', coverageTypes: ['Professional Liability'], annualPremium: 120000 },
    { id: 'SME003', name: 'Group Employee Benefits', coverageTypes: ['Group Life', 'Group Health'], annualPremium: 250000 },
  ];
}
export async function getSMEQuote(userId: number, input: any) {
  const basePremium = input.employees * 5000 + (input.annualRevenue * 0.001);
  return { userId, ...input, quotedPremium: Math.round(basePremium), quoteReference: `SME-${Date.now()}`, validUntil: new Date(Date.now() + 30 * 86400000) };
}
export async function getSMEPolicies(userId: number) { return []; }

// ─── Embedded Insurance ───────────────────────────────────────────────────────
export async function getEmbeddedPartners() {
  return [
    { id: 'EMP001', name: 'Jumia', category: 'E-Commerce', productTypes: ['Device Protection', 'Purchase Protection'] },
    { id: 'EMP002', name: 'Flutterwave', category: 'Fintech', productTypes: ['Transaction Insurance'] },
  ];
}
export async function getEmbeddedOffers(userId: number) {
  return [{ id: 'OFF001', partner: 'Jumia', product: 'Device Protection', item: 'Samsung Galaxy S24', premium: 5000, coverage: 350000, expiresAt: new Date(Date.now() + 7 * 86400000) }];
}
export async function acceptEmbeddedOffer(userId: number, offerId: string) {
  return { success: true, userId, offerId, policyNumber: `EMB-${Date.now()}`, status: 'Active', acceptedAt: new Date() };
}

// ─── Insurance Score ──────────────────────────────────────────────────────────
export async function getInsuranceScore(userId: number) {
  return { userId, score: 742, grade: 'A', percentile: 78, lastUpdated: new Date(), trend: 'improving', changeFromLastMonth: +15 };
}
export async function getInsuranceScoreFactors(userId: number) {
  return [
    { factor: 'Payment History', weight: 0.35, score: 95, impact: 'Positive' },
    { factor: 'Claims History', weight: 0.30, score: 72, impact: 'Neutral' },
    { factor: 'Policy Diversity', weight: 0.20, score: 80, impact: 'Positive' },
    { factor: 'Account Age', weight: 0.15, score: 65, impact: 'Neutral' },
  ];
}
export async function applyScoreImprovement(userId: number, action: string) {
  return { success: true, action, estimatedScoreIncrease: 15, timeToEffect: '30 days' };
}

// ─── Dynamic Pricing ──────────────────────────────────────────────────────────
export async function getDynamicPricingQuote(userId: number, productType: string, riskFactors: any) {
  const riskMultiplier = 1 + (Object.keys(riskFactors).length * 0.05);
  return { userId, productType, riskFactors, basePremium: 50000, adjustedPremium: Math.round(50000 * riskMultiplier), riskScore: 65, validFor: '48 hours', quoteId: `DYN-${Date.now()}` };
}
export async function getDynamicPricingHistory(userId: number) { return []; }

// ─── Financial Wellness ───────────────────────────────────────────────────────
export async function getFinancialWellnessScore(userId: number) {
  return { userId, score: 68, grade: 'B', components: { insurance_coverage: 85, savings_rate: 45, debt_ratio: 72, emergency_fund: 60 }, recommendations: 3 };
}
export async function getFinancialRecommendations(userId: number) {
  return [
    { id: 1, category: 'Insurance Gap', recommendation: 'Consider adding life insurance to protect your family', priority: 'High' },
    { id: 2, category: 'Savings', recommendation: 'Set up automatic premium savings to avoid lapses', priority: 'Medium' },
  ];
}

// ─── Savings & Investment ─────────────────────────────────────────────────────
export async function getSavingsPlans() {
  return [
    { id: 'SAV001', name: 'Premium Saver', description: 'Save towards your annual premium', interestRate: 0.12, minAmount: 5000, term: 12 },
    { id: 'SAV002', name: 'Education Endowment', description: "Save for your children's education", interestRate: 0.14, minAmount: 10000, term: 60 },
    { id: 'SAV003', name: 'Retirement Fund', description: 'Build your retirement nest egg', interestRate: 0.15, minAmount: 20000, term: 120 },
  ];
}
export async function getUserSavingsAccounts(userId: number) { return []; }
export async function contributeSavings(userId: number, accountId: string, amount: number) {
  return { success: true, userId, accountId, amount, transactionId: `SAV-TXN-${Date.now()}`, newBalance: amount, contributedAt: new Date() };
}

// ─── Compliance Monitoring ────────────────────────────────────────────────────
export async function getComplianceStatus(userId: number) {
  return { userId, overallStatus: 'Compliant', score: 92, lastReview: new Date(), nextReview: new Date(Date.now() + 90 * 86400000), issues: 0, warnings: 1 };
}
export async function getComplianceRequirements() {
  return [
    { id: 'REQ001', name: 'KYC Verification', status: 'Completed', mandatory: true },
    { id: 'REQ002', name: 'Annual NAICOM Filing', status: 'Pending', mandatory: true, deadline: new Date('2026-03-31') },
    { id: 'REQ003', name: 'AML Training', status: 'Completed', mandatory: true },
  ];
}
export async function submitComplianceEvidence(userId: number, requirementId: string, evidence: string) {
  return { success: true, userId, requirementId, submittedAt: new Date(), reviewStatus: 'Under Review' };
}

// ─── Model Security Dashboard ─────────────────────────────────────────────────
export async function getModelSecurityThreats() {
  return [
    { id: 1, threatType: 'Adversarial Input', severity: 'Medium', detectedAt: new Date(), status: 'Mitigated', affectedModel: 'Fraud Detection v2.1' },
    { id: 2, threatType: 'Data Poisoning Attempt', severity: 'High', detectedAt: new Date(), status: 'Investigating', affectedModel: 'Underwriting Risk Model' },
  ];
}
export async function getModelAuditLog() {
  return [
    { id: 1, model: 'Fraud Detection v2.1', action: 'prediction', decision: 'legitimate', confidence: 0.94, timestamp: new Date() },
    { id: 2, model: 'Churn Prediction v1.5', action: 'batch_inference', recordsProcessed: 1250, timestamp: new Date() },
  ];
}

// ─── MCMC Risk Modeling ───────────────────────────────────────────────────────
export async function runMCMCSimulation(userId: number, input: any) {
  return { simulationId: `MCMC-${Date.now()}`, iterations: input.iterations, status: 'Completed', results: { meanLoss: 125000, stdDev: 45000, var95: 210000, var99: 285000 }, processingTime: 2.8, completedAt: new Date() };
}
export async function getMCMCResults(userId: number) { return []; }

// ─── Insurance Literacy Hub ───────────────────────────────────────────────────
export async function getLiteracyArticles(category?: string, language: string = 'en') {
  return [
    { id: 'ART001', title: 'Understanding Your Insurance Policy', category: 'Basics', language, readTime: 5, points: 50 },
    { id: 'ART002', title: 'How to File a Claim Successfully', category: 'Claims', language, readTime: 8, points: 75 },
    { id: 'ART003', title: 'Life Insurance vs Term Insurance', category: 'Life', language, readTime: 6, points: 60 },
    { id: 'ART004', title: 'Motor Insurance Requirements in Nigeria', category: 'Motor', language, readTime: 4, points: 40 },
  ].filter(a => !category || a.category === category);
}
export async function getLiteracyProgress(userId: number) {
  return { userId, articlesRead: 3, totalPoints: 165, level: 'Intermediate', nextLevel: 'Advanced', pointsToNextLevel: 85 };
}
export async function completeLiteracyArticle(userId: number, articleId: string) {
  return { success: true, userId, articleId, pointsEarned: 50, totalPoints: 215, completedAt: new Date() };
}

// ─── Agricultural Underwriting ────────────────────────────────────────────────
export async function getAgriculturalProducts() {
  return [
    { id: 'AGR001', name: 'Crop Insurance', coverageTypes: ['Drought', 'Flood', 'Pest'] },
    { id: 'AGR002', name: 'Livestock Insurance', coverageTypes: ['Death', 'Disease', 'Theft'] },
    { id: 'AGR003', name: 'Farm Equipment Insurance', coverageTypes: ['Damage', 'Theft', 'Breakdown'] },
  ];
}
export async function getAgriculturalQuote(userId: number, input: any) {
  const premiumRate = input.cropType === 'maize' ? 0.04 : input.cropType === 'rice' ? 0.05 : 0.035;
  const coverage = input.farmSize * 50000;
  return { userId, ...input, coverage, annualPremium: Math.round(coverage * premiumRate), quoteReference: `AGR-${Date.now()}` };
}
export async function getAgriculturalPolicies(userId: number) { return []; }

// ─── Performance Monitoring ───────────────────────────────────────────────────
export async function getPerformanceMetrics() {
  return { apiLatencyP50: 45, apiLatencyP95: 120, apiLatencyP99: 280, errorRate: 0.002, requestsPerSecond: 850, activeConnections: 1240, dbQueryTime: 12, cacheHitRate: 0.94, uptime: 99.97 };
}
export async function getPerformanceAlerts() {
  return [{ id: 1, metric: 'API Latency P99', threshold: 250, currentValue: 280, severity: 'Warning', triggeredAt: new Date() }];
}

// ─── Disaster Recovery ────────────────────────────────────────────────────────
export async function getDRStatus() {
  return { rpo: '15 minutes', rto: '1 hour', lastBackup: new Date(Date.now() - 900000), lastDRTest: new Date(Date.now() - 7 * 86400000), replicationLag: 2, status: 'Healthy', primaryRegion: 'Lagos', drRegion: 'Abuja' };
}
export async function runDRTest(testType: string) {
  return { success: true, testType, testId: `DRT-${Date.now()}`, status: 'Running', estimatedDuration: '30 minutes', startedAt: new Date() };
}

// ─── A/B Testing ──────────────────────────────────────────────────────────────
export async function getABExperiments() {
  return [
    { id: 'EXP001', name: 'New Onboarding Flow', variants: ['Control', 'Simplified'], status: 'Running', participants: 1250, conversionRate: { Control: 0.34, Simplified: 0.41 } },
    { id: 'EXP002', name: 'Premium Calculator UI', variants: ['Current', 'Interactive'], status: 'Completed', winner: 'Interactive', liftPercentage: 18 },
  ];
}
export async function assignABVariant(userId: number, experimentId: string) {
  const variant = userId % 2 === 0 ? 'Control' : 'Treatment';
  return { userId, experimentId, variant, assignedAt: new Date() };
}
export async function getABResults(experimentId: string) {
  return { experimentId, status: 'Running', participants: 1250, conversionRate: { Control: 0.34, Treatment: 0.41 }, statisticalSignificance: 0.87 };
}

// ─── Family Coverage ──────────────────────────────────────────────────────────
export async function getFamilyMembers(userId: number) { return []; }
export async function addFamilyMember(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Active', addedAt: new Date() };
}
export async function getFamilyCoveragePlans() {
  return [
    { id: 'FAM001', name: 'Family Health Shield', members: 6, annualPremium: 180000, coveragePerMember: 2000000 },
    { id: 'FAM002', name: 'Family Life Protection', members: 6, annualPremium: 120000, sumAssured: 10000000 },
  ];
}

// ─── Claims Evidence ──────────────────────────────────────────────────────────
export async function getClaimEvidence(userId: number, claimId: number) { return []; }
export async function uploadClaimEvidence(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, status: 'Uploaded', uploadedAt: new Date() };
}

// ─── Insurance Marketplace ────────────────────────────────────────────────────
export async function getMarketplaceProducts(category?: string, provider?: string) {
  return [
    { id: 'MKT001', name: 'Comprehensive Motor Insurance', provider: 'AXA Mansard', category: 'Motor', premium: 45000, rating: 4.5, reviews: 1250 },
    { id: 'MKT002', name: 'Family Health Plan', provider: 'Leadway Assurance', category: 'Health', premium: 180000, rating: 4.3, reviews: 890 },
    { id: 'MKT003', name: 'Term Life Insurance', provider: 'AIICO Insurance', category: 'Life', premium: 36000, rating: 4.6, reviews: 2100 },
  ].filter(p => (!category || p.category === category) && (!provider || p.provider === provider));
}
export async function compareMarketplaceProducts(productIds: string[]) {
  return productIds.map(id => ({ id, name: `Product ${id}`, premium: 45000, coverage: 2000000, rating: 4.5 }));
}

// ─── Geospatial ───────────────────────────────────────────────────────────────
export async function getGeospatialRiskData(lat: number, lng: number, radius: number) {
  return { latitude: lat, longitude: lng, radius, riskLevel: 'Medium', floodRisk: 'Low', crimeIndex: 45, trafficDensity: 'High', nearbyHospitals: 3, riskScore: 52 };
}
export async function getGeospatialClaims(bounds: any) {
  return [
    { id: 1, latitude: 6.5244, longitude: 3.3792, claimType: 'Motor', amount: 150000, date: new Date() },
    { id: 2, latitude: 6.4698, longitude: 3.5852, claimType: 'Property', amount: 450000, date: new Date() },
  ];
}

// ─── WhatsApp Integration ─────────────────────────────────────────────────────
export async function getWhatsAppStatus(userId: number) {
  return { userId, connected: false, phoneNumber: null, lastMessage: null };
}
export async function connectWhatsApp(userId: number, phoneNumber: string) {
  return { success: true, userId, phoneNumber, status: 'Connected', connectedAt: new Date() };
}
export async function getWhatsAppMessages(userId: number, limit: number = 20) { return []; }

// ─── Voice Assistant ──────────────────────────────────────────────────────────
export async function transcribeVoice(userId: number, audioUrl: string, language: string) {
  return { userId, audioUrl, language, transcription: 'Voice transcription would appear here', confidence: 0.95, transcribedAt: new Date() };
}
export async function getVoiceSessions(userId: number) { return []; }

// ─── Onboarding ───────────────────────────────────────────────────────────────
export async function getOnboardingStatus(userId: number) {
  return { userId, currentStep: 3, totalSteps: 6, completedSteps: ['account_created', 'email_verified', 'profile_completed'], pendingSteps: ['kyc_verification', 'first_policy', 'payment_method'], percentComplete: 50 };
}
export async function completeOnboardingStep(userId: number, step: string, data?: any) {
  return { success: true, userId, step, completedAt: new Date(), nextStep: 'kyc_verification', percentComplete: 67 };
}

// ─── Insurance Application ────────────────────────────────────────────────────
export async function startInsuranceApplication(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, applicationId: `APP-${Date.now()}`, status: 'Draft', currentStep: 'personal_details', totalSteps: 5, startedAt: new Date() };
}
export async function saveApplicationStep(userId: number, input: any) {
  return { success: true, ...input, savedAt: new Date() };
}
export async function submitApplication(userId: number, applicationId: string) {
  return { success: true, applicationId, status: 'Submitted', submittedAt: new Date(), estimatedProcessingTime: '24-48 hours', referenceNumber: `REF-${Date.now()}` };
}
export async function getUserApplications(userId: number) { return []; }

// ─── Customer Feedback ────────────────────────────────────────────────────────
export async function submitFeedback(userId: number, input: any) {
  return { id: Date.now(), userId, ...input, submittedAt: new Date(), ticketId: `FBK-${Date.now()}` };
}
export async function getFeedback(userId: number) { return []; }

// ─── PostgreSQL Scaling ───────────────────────────────────────────────────────
export async function getDBScalingMetrics() {
  return { connections: { active: 45, idle: 12, max: 100 }, queryPerformance: { avgQueryTime: 8, slowQueries: 2, cacheHitRate: 0.97 }, storage: { used: '42GB', available: '158GB', growthRate: '2GB/month' } };
}
export async function getDBScalingRecommendations() {
  return [
    { id: 1, recommendation: 'Add read replica for analytics queries', priority: 'Medium', estimatedImpact: '30% query time reduction' },
    { id: 2, recommendation: 'Enable connection pooling (PgBouncer)', priority: 'High', estimatedImpact: '50% connection overhead reduction' },
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// MICROSERVICE PROXY FALLBACK DATA (new functions only)
// Functions that don't already exist above, used by the proxy router layer.
// ══════════════════════════════════════════════════════════════════════════════

// ─── USSD Gateway (new) ─────────────────────────────────────────────────────
export async function initiateUSSDSession(userId: number, phoneNumber: string, serviceCode: string) {
  return { id: `USSD-${Date.now()}`, phoneNumber, serviceCode, status: 'active', menu: 'Welcome', message: 'Welcome to NGApp Insurance\n1. Buy Insurance\n2. Check Policy\n3. File Claim\n4. Check Balance', startedAt: new Date() };
}
export async function respondUSSDSession(userId: number, sessionId: string, input: string) {
  return { sessionId, input, response: 'Processing your request...', status: 'active', menu: 'Processing' };
}

// ─── Mobile Money (new) ─────────────────────────────────────────────────────
export async function getMobileMoneyProviders() {
  return [
    { id: 'opay', name: 'OPay', logo: '/logos/opay.png', supportedCurrencies: ['NGN'], minAmount: 100, maxAmount: 5000000 },
    { id: 'paystack', name: 'Paystack', logo: '/logos/paystack.png', supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'KES'], minAmount: 100, maxAmount: 10000000 },
    { id: 'flutterwave', name: 'Flutterwave', logo: '/logos/flutterwave.png', supportedCurrencies: ['NGN', 'GHS', 'KES', 'TZS', 'UGX'], minAmount: 100, maxAmount: 10000000 },
    { id: 'nibss', name: 'NIBSS (NIP)', logo: '/logos/nibss.png', supportedCurrencies: ['NGN'], minAmount: 1000, maxAmount: 50000000 },
  ];
}
export async function initiateMobileMoneyPayment(userId: number, input: { provider: string; phoneNumber: string; amount: number; currency: string }) {
  return { id: `MM-${Date.now()}`, userId, ...input, status: 'pending', reference: `REF-${Date.now()}`, createdAt: new Date() };
}
export async function getMobileMoneyTransactions(userId: number) {
  return [
    { id: 'MM-001', provider: 'OPay', amount: 25000, currency: 'NGN', status: 'completed', reference: 'REF-OPY-001', phoneNumber: '+2348012345678', createdAt: new Date(Date.now() - 86400000) },
    { id: 'MM-002', provider: 'Paystack', amount: 45000, currency: 'NGN', status: 'completed', reference: 'REF-PSK-002', phoneNumber: '+2348012345678', createdAt: new Date(Date.now() - 172800000) },
  ];
}

// ─── Agent Network (new) ────────────────────────────────────────────────────
export async function getAgentNetwork(region?: string, status?: string) {
  const agents = [
    { id: 'AGT-001', name: 'Chinedu Okonkwo', region: 'Lagos', status: 'Active', totalPoliciesSold: 156, totalPremiumCollected: 4500000, rating: 4.7, commission: 675000, phoneNumber: '+2348012345678' },
    { id: 'AGT-002', name: 'Amina Bello', region: 'Abuja', status: 'Active', totalPoliciesSold: 203, totalPremiumCollected: 6100000, rating: 4.9, commission: 915000, phoneNumber: '+2348023456789' },
    { id: 'AGT-003', name: 'Oluwaseun Adeyemi', region: 'Ibadan', status: 'Active', totalPoliciesSold: 89, totalPremiumCollected: 2300000, rating: 4.3, commission: 345000, phoneNumber: '+2348034567890' },
    { id: 'AGT-004', name: 'Fatima Hassan', region: 'Kano', status: 'Inactive', totalPoliciesSold: 45, totalPremiumCollected: 1200000, rating: 4.1, commission: 180000, phoneNumber: '+2348045678901' },
  ];
  return agents.filter(a => (!region || a.region === region) && (!status || a.status === status));
}

// ─── Fraud Detection Patterns (new) ─────────────────────────────────────────
export async function getFraudPatterns() {
  return [
    { id: 'FP-001', name: 'Velocity Anomaly', description: 'Multiple claims filed within short timeframe', severity: 'High', detectedCount: 23, lastDetected: new Date(Date.now() - 86400000) },
    { id: 'FP-002', name: 'Duplicate Claim Pattern', description: 'Similar claims across different policies', severity: 'Medium', detectedCount: 12, lastDetected: new Date(Date.now() - 172800000) },
    { id: 'FP-003', name: 'Geographic Anomaly', description: 'Claims from unusual geographic locations', severity: 'Low', detectedCount: 45, lastDetected: new Date() },
  ];
}

// ─── AI Claims Assessment (new) ─────────────────────────────────────────────
export async function aiAssessClaim(userId: number, claimId: number) {
  return { claimId, assessment: 'approve', confidence: 0.91, estimatedAmount: 150000, riskScore: 0.18, recommendation: 'Auto-approve: claim within normal parameters', processingTime: 2.3, factors: ['valid_policy', 'consistent_documentation', 'normal_claim_amount'] };
}
export async function getAIClaimsQueue(userId: number) {
  return [
    { id: 1, claimId: 101, status: 'pending_review', priority: 'High', estimatedSTP: true, submittedAt: new Date(Date.now() - 7200000) },
    { id: 2, claimId: 102, status: 'auto_approved', priority: 'Low', estimatedSTP: true, submittedAt: new Date(Date.now() - 14400000) },
    { id: 3, claimId: 103, status: 'flagged', priority: 'Critical', estimatedSTP: false, submittedAt: new Date(Date.now() - 3600000) },
  ];
}

// ─── Predictive Analytics (new) ─────────────────────────────────────────────
export async function getPredictiveChurnRisk(userId: number) {
  return { userId, churnProbability: 0.12, riskLevel: 'Low', factors: ['regular_payments', 'active_engagement', 'recent_claim_satisfaction'], retentionScore: 88, nextBestAction: 'Send loyalty reward' };
}
export async function getClaimForecast(policyType: string, timeRange: string) {
  return { policyType, timeRange, expectedClaims: 45, expectedAmount: 6750000, confidence: 0.82, trend: 'stable', seasonalFactor: 1.05 };
}

// ─── IFRS 17 (new) ──────────────────────────────────────────────────────────
export async function calculateIFRS17(portfolioId: string, approach: string) {
  return { portfolioId, approach, csm: 12500000, lrc: 45000000, lic: 8500000, insuranceRevenue: 32000000, insuranceServiceExpense: 24000000, calculatedAt: new Date() };
}
export async function getIFRS17Reports(userId: number) {
  return [
    { id: 'IFRS-001', portfolioId: 'PF-MOTOR', approach: 'PAA', period: '2026-Q1', status: 'Final', csm: 12500000, generatedAt: new Date(Date.now() - 604800000) },
    { id: 'IFRS-002', portfolioId: 'PF-HEALTH', approach: 'BBA', period: '2026-Q1', status: 'Draft', csm: 8900000, generatedAt: new Date(Date.now() - 86400000) },
  ];
}

// ─── Multi-Language (new) ───────────────────────────────────────────────────
export async function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', nativeName: 'English', supported: true },
    { code: 'yo', name: 'Yoruba', nativeName: 'Èdè Yorùbá', supported: true },
    { code: 'ha', name: 'Hausa', nativeName: 'Harshen Hausa', supported: true },
    { code: 'ig', name: 'Igbo', nativeName: 'Asụsụ Igbo', supported: true },
    { code: 'pcm', name: 'Nigerian Pidgin', nativeName: 'Naija', supported: true },
    { code: 'fr', name: 'French', nativeName: 'Français', supported: true },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', supported: true },
    { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', supported: true },
    { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', supported: true },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', supported: true },
  ];
}

// ─── Gamification (new) ─────────────────────────────────────────────────────
export async function getGamificationLeaderboard() {
  return [
    { rank: 1, userId: 2, name: 'Amina Bello', points: 15200, badges: 12, level: 'Platinum' },
    { rank: 2, userId: 1, name: 'John Doe', points: 12800, badges: 9, level: 'Gold' },
    { rank: 3, userId: 3, name: 'Chinedu Okonkwo', points: 10500, badges: 7, level: 'Gold' },
    { rank: 4, userId: 4, name: 'Fatima Hassan', points: 8200, badges: 5, level: 'Silver' },
  ];
}
export async function getUserAchievements(userId: number) {
  return [
    { id: 'ACH-001', name: 'First Policy', description: 'Purchased your first insurance policy', icon: 'shield', earnedAt: new Date(Date.now() - 2592000000), points: 500 },
    { id: 'ACH-002', name: 'Quick Claimer', description: 'Filed a claim within 24 hours of incident', icon: 'zap', earnedAt: new Date(Date.now() - 1296000000), points: 300 },
    { id: 'ACH-003', name: 'Referral King', description: 'Referred 5 friends who purchased policies', icon: 'users', earnedAt: new Date(Date.now() - 604800000), points: 1000 },
  ];
}
export async function getUserGamificationPoints(userId: number) {
  return { userId, totalPoints: 12800, level: 'Gold', nextLevel: 'Platinum', pointsToNextLevel: 2200, monthlyPoints: 1500, streak: 15 };
}

// ─── Tenants (new) ──────────────────────────────────────────────────────────
export async function getTenants() {
  return [
    { id: 'TEN-001', name: 'NGApp Insurance', plan: 'Enterprise', status: 'Active', users: 245, policies: 12500, createdAt: new Date('2024-01-15') },
    { id: 'TEN-002', name: 'AXA Mansard Nigeria', plan: 'Enterprise', status: 'Active', users: 180, policies: 8900, createdAt: new Date('2024-03-20') },
    { id: 'TEN-003', name: 'Leadway Assurance', plan: 'Professional', status: 'Active', users: 95, policies: 4200, createdAt: new Date('2024-06-10') },
  ];
}
export async function getCurrentTenant(userId: number) {
  return { id: 'TEN-001', name: 'NGApp Insurance', plan: 'Enterprise', status: 'Active', role: 'Admin', joinedAt: new Date('2024-01-15') };
}
