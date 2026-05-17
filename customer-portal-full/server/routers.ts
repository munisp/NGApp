import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

type CopilotLanguage = "en" | "yo" | "ha" | "ig" | "pcm";

const MULTILINGUAL_GREETINGS: Record<CopilotLanguage, string> = {
  en: "I'm here to help you complete your insurance application!",
  yo: "Mo wa nibi lati ran ọ lọwọ lati pari ohun elo iṣeduro rẹ!",
  ha: "Ina nan don taimaka maka kammala aikace-aikacen inshorar ka!",
  ig: "Anọ m ebe a inyere gị aka imezu ngwa inshọransị gị!",
  pcm: "I dey here to help you finish your insurance application!",
};

function getFallbackResponse(message: string, productType: string, currentStep: number, language: CopilotLanguage): string {
  const lowerMessage = message.toLowerCase();
  
  const docResponses: Record<CopilotLanguage, string> = {
    en: `**Required Documents for ${productType} Insurance:**\n\n- Valid government ID (NIN slip, driver's license, or passport)\n- Proof of address (utility bill or bank statement)\n- Passport photograph\n\n**Tips:**\n- All documents should be clear and legible\n- File size limit: 5MB per document`,
    yo: `**Awọn Iwe Ti O Nilo fun Iṣeduro ${productType}:**\n\n- ID ijọba ti o wulo\n- Ẹri adirẹsi\n- Fọto iwe irinna\n\n**Awọn Imọran:**\n- Gbogbo awọn iwe gbọdọ jẹ kedere`,
    ha: `**Takardun da ake buƙata don Inshorar ${productType}:**\n\n- ID na gwamnati mai inganci\n- Tabbacin adireshin\n- Hoton fasfo\n\n**Shawarwari:**\n- Duk takardun ya kamata su kasance a sarari`,
    ig: `**Akwụkwọ achọrọ maka Inshọransị ${productType}:**\n\n- ID gọọmentị dị irè\n- Ihe akaebe adreesị\n- Foto paspọtụ\n\n**Ndụmọdụ:**\n- Akwụkwọ niile kwesịrị ịdị nkọ`,
    pcm: `**Documents wey you need for ${productType} Insurance:**\n\n- Valid government ID (NIN slip, driver's license, or passport)\n- Proof of address (utility bill or bank statement)\n- Passport photograph\n\n**Tips:**\n- Make sure all documents clear well`,
  };

  const premiumResponses: Record<CopilotLanguage, string> = {
    en: `**How Your Premium is Calculated:**\n\n1. Coverage Amount - Higher coverage = higher premium\n2. Plan Type - Premium plans cost more but offer better protection\n3. Risk Factors - Age, location, and history affect rates\n4. Payment Frequency - Annual payment saves 10%`,
    yo: `**Bii A Ṣe Ṣe Iṣiro Owo-ori Rẹ:**\n\n1. Iye Ideri - Ideri ti o ga julọ = owo-ori ti o ga julọ\n2. Iru Eto - Awọn eto owo-ori na diẹ sii\n3. Awọn Okunfa Ewu - Ọjọ ori ati ipo ni ipa\n4. Igbohunsafẹfẹ Isanwo - Isanwo lododun fi 10% pamọ`,
    ha: `**Yadda Ake Ƙididdige Kuɗin Inshorar Ku:**\n\n1. Adadin Rufe - Rufe mafi girma = kuɗin inshora mafi girma\n2. Nau'in Shiri - Shirye-shiryen kuɗin inshora sun fi tsada\n3. Abubuwan Haɗari - Shekaru da wuri suna shafar farashin\n4. Yawan Biyan Kuɗi - Biyan shekara-shekara yana adana 10%`,
    ig: `**Otu E Si Gbakọọ Premium Gị:**\n\n1. Ego Mkpuchi - Mkpuchi dị elu = premium dị elu\n2. Ụdị Atụmatụ - Atụmatụ premium na-eri ego karịa\n3. Ihe Ndị Ihe Egwu - Afọ na ebe na-emetụta ọnụego\n4. Ugboro Ịkwụ Ụgwọ - Ịkwụ ụgwọ kwa afọ na-echekwa 10%`,
    pcm: `**How Dem Calculate Your Premium:**\n\n1. Coverage Amount - Higher coverage = higher premium\n2. Plan Type - Premium plans cost more but e go give better protection\n3. Risk Factors - Age and location go affect the rates\n4. Payment Frequency - If you pay yearly, you go save 10%`,
  };

  if (lowerMessage.includes("document") || lowerMessage.includes("upload") || lowerMessage.includes("wetin") && lowerMessage.includes("need")) {
    return docResponses[language];
  }
  
  if (lowerMessage.includes("premium") || lowerMessage.includes("cost") || lowerMessage.includes("price") || lowerMessage.includes("how much")) {
    return premiumResponses[language];
  }

  const stepInfo: Record<CopilotLanguage, string> = {
    en: `You're currently on Step ${currentStep} of the application.`,
    yo: `O wa lọwọlọwọ lori Igbesẹ ${currentStep} ti ohun elo naa.`,
    ha: `Kuna a halin yanzu akan Mataki ${currentStep} na aikace-aikacen.`,
    ig: `Ị nọ ugbu a na Nzọụkwụ ${currentStep} nke ngwa ahụ.`,
    pcm: `You dey currently on Step ${currentStep} of the application.`,
  };

  return `${MULTILINGUAL_GREETINGS[language]}\n\n${stepInfo[language]}`;
}

async function callOllama(systemPrompt: string, userMessage: string, history: { role: string; content: string }[]) {
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:latest",
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.message?.content || null;
    }
    return null;
  } catch (error) {
    console.log("Ollama not available:", error);
    return null;
  }
}

export const appRouter = router({
  system: systemRouter,
  
  ai: router({
    copilot: publicProcedure
      .input(z.object({
        message: z.string(),
        systemPrompt: z.string(),
        productType: z.string(),
        currentStep: z.number(),
        language: z.enum(["en", "yo", "ha", "ig", "pcm"]),
        history: z.array(z.object({
          role: z.string(),
          content: z.string()
        })).optional()
      }))
      .mutation(async ({ input }) => {
        const ollamaResponse = await callOllama(
          input.systemPrompt,
          input.message,
          input.history || []
        );

        if (ollamaResponse) {
          return {
            response: ollamaResponse,
            source: "ollama"
          };
        }

        return {
          response: getFallbackResponse(input.message, input.productType, input.currentStep, input.language),
          source: "fallback"
        };
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  policies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPoliciesByUserId(ctx.user.id);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getPolicyById(input.id, ctx.user.id);
      }),
    
    renew: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const policy = await db.getPolicyById(input.id, ctx.user.id);
        if (!policy) throw new Error("Policy not found");
        
        const newExpiryDate = new Date(policy.expiryDate);
        newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
        
        return await db.updatePolicy(input.id, ctx.user.id, {
          expiryDate: newExpiryDate,
          status: "Active"
        });
      }),
  }),

  claims: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getClaimsByUserId(ctx.user.id);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getClaimById(input.id, ctx.user.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        policyId: z.number(),
        amount: z.string(),
        incidentDate: z.date(),
        description: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        return await db.createClaim({
          userId: ctx.user.id,
          policyId: input.policyId,
          claimNumber,
          amount: input.amount,
          incidentDate: input.incidentDate,
          description: input.description,
          status: "Submitted",
        });
      }),
  }),

  payments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPaymentsByUserId(ctx.user.id);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getPaymentById(input.id, ctx.user.id);
      }),
    
    process: protectedProcedure
      .input(z.object({
        id: z.number(),
        paymentMethod: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.updatePayment(input.id, ctx.user.id, {
          status: "Completed",
          paidDate: new Date(),
          paymentMethod: input.paymentMethod,
        });
      }),
  }),

  profile: router({
    get: protectedProcedure.query(({ ctx }) => {
      return ctx.user;
    }),
    
    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUser({
          openId: ctx.user.openId,
          name: input.name,
          email: input.email,
        });
        return { success: true };
      }),
  }),

  referrals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReferralsByUserId(ctx.user.id);
    }),
    
    stats: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReferralStats(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        referredEmail: z.string().email().optional(),
        referredPhone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Generate unique referral code
        const referralCode = `REF-${ctx.user.id}-${Date.now().toString(36).toUpperCase()}`;
        
        return await db.createReferral({
          referrerId: ctx.user.id,
          referredEmail: input.referredEmail,
          referredPhone: input.referredPhone,
          referralCode,
          status: "Pending",
          rewardAmount: "500.00",
        });
      }),
    
    getByCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return await db.getReferralByCode(input.code);
      }),
  }),

  reviews: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReviewsByUserId(ctx.user.id);
    }),
    
    getByEntity: publicProcedure
      .input(z.object({
        entityId: z.number(),
        reviewType: z.enum(["Agent", "Service", "Claim", "Policy"]),
      }))
      .query(async ({ input }) => {
        return await db.getReviewsByEntity(input.entityId, input.reviewType);
      }),
    
    getAverageRating: publicProcedure
      .input(z.object({
        entityId: z.number(),
        reviewType: z.enum(["Agent", "Service", "Claim", "Policy"]),
      }))
      .query(async ({ input }) => {
        return await db.getAverageRating(input.entityId, input.reviewType);
      }),
    
    create: protectedProcedure
      .input(z.object({
        reviewType: z.enum(["Agent", "Service", "Claim", "Policy"]),
        entityId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        agentName: z.string().optional(),
        isPublic: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createReview({
          userId: ctx.user.id,
          reviewType: input.reviewType,
          entityId: input.entityId,
          rating: input.rating,
          comment: input.comment,
          agentName: input.agentName,
          isPublic: input.isPublic,
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        return await db.updateReview(id, ctx.user.id, updates);
      }),
  }),

  // Insurance Radar - Fraud Detection Analytics
  insuranceRadar: router({
    analytics: protectedProcedure
      .input(z.object({ timeRange: z.string().default("7d") }))
      .query(async ({ ctx, input }) => {
        return await db.getInsuranceRadarAnalytics(ctx.user.id, input.timeRange);
      }),

    recentScores: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getRecentFraudScores(ctx.user.id, input.limit);
      }),

    scoreRequest: protectedProcedure
      .input(z.object({
        entityType: z.string(),
        entityId: z.string(),
        data: z.record(z.unknown()),
      }))
      .mutation(async ({ ctx, input }) => {
        const scoreId = `FR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        return await db.createFraudScore({
          userId: ctx.user.id,
          scoreId,
          entityType: input.entityType,
          entityId: input.entityId,
          score: Math.random() * 0.3, // Default low risk; real scoring via ML service
          riskLevel: "low",
          decision: "allow",
          confidence: 0.85,
          processingTime: 45,
          topFactors: [],
          matchedRules: [],
        });
      }),
  }),

  // ERPNext Integration
  erpnext: router({
    transactions: protectedProcedure
      .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getERPNextTransactions(ctx.user.id, input.page, input.limit);
      }),

    reconciliation: protectedProcedure
      .input(z.object({ month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getERPNextReconciliation(ctx.user.id, input.month);
      }),

    syncStatus: protectedProcedure.query(async ({ ctx }) => {
      return await db.getERPNextSyncStatus(ctx.user.id);
    }),

    triggerSync: protectedProcedure
      .input(z.object({ entityType: z.string(), entityId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.triggerERPNextSync(ctx.user.id, input.entityType, input.entityId);
      }),
  }),

  // Premium Rate Management
  premiumRates: router({
    tables: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPremiumRateTables(ctx.user.id);
    }),

    riskFactors: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPremiumRiskFactors(ctx.user.id);
    }),

    rateChanges: protectedProcedure
      .input(z.object({ tableId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getPremiumRateChanges(ctx.user.id, input.tableId);
      }),

    auditLogs: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getPremiumRateAuditLogs(ctx.user.id, input.limit);
      }),

    updateRate: protectedProcedure
      .input(z.object({
        tableId: z.number(),
        factorId: z.number(),
        newRate: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.updatePremiumRate(ctx.user.id, input.tableId, input.factorId, input.newRate, input.reason);
      }),
  }),

  // Broker API Management
  brokerApi: router({
    keys: protectedProcedure.query(async ({ ctx }) => {
      return await db.getBrokerAPIKeys(ctx.user.id);
    }),

    usage: protectedProcedure
      .input(z.object({ keyId: z.string().optional(), days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        return await db.getBrokerAPIUsage(ctx.user.id, input.keyId, input.days);
      }),

    createKey: protectedProcedure
      .input(z.object({
        name: z.string(),
        permissions: z.array(z.string()),
        rateLimit: z.number().default(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = `bk_${Math.random().toString(36).substr(2, 32)}`;
        return await db.createBrokerAPIKey({
          userId: ctx.user.id,
          name: input.name,
          apiKey,
          permissions: input.permissions,
          rateLimit: input.rateLimit,
          status: "Active",
        });
      }),

    revokeKey: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.revokeBrokerAPIKey(ctx.user.id, input.keyId);
      }),
  }),

  // Fraud Network Visualization
  fraudNetwork: router({
    rings: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getFraudRings(ctx.user.id, input.status);
      }),

    alerts: protectedProcedure
      .input(z.object({ severity: z.string().optional(), limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getFraudAlerts(ctx.user.id, input.severity, input.limit);
      }),

    networkGraph: protectedProcedure
      .input(z.object({ entityId: z.string(), depth: z.number().default(2) }))
      .query(async ({ ctx, input }) => {
        return await db.getFraudNetworkGraph(ctx.user.id, input.entityId, input.depth);
      }),
  }),

  // Knowledge Graph Explorer
  knowledgeGraph: router({
    nodes: protectedProcedure
      .input(z.object({ entityType: z.string().optional(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getKnowledgeGraphNodes(ctx.user.id, input.entityType, input.search);
      }),

    edges: protectedProcedure
      .input(z.object({ nodeId: z.string(), depth: z.number().default(1) }))
      .query(async ({ ctx, input }) => {
        return await db.getKnowledgeGraphEdges(ctx.user.id, input.nodeId, input.depth);
      }),
  }),

  // Telco Credit Scoring
  telcoCredit: router({
    score: protectedProcedure
      .input(z.object({
        phoneNumber: z.string(),
        provider: z.string(),
        consentGiven: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!input.consentGiven) throw new Error("User consent required for credit scoring");
        return await db.computeTelcoCreditScore(ctx.user.id, input.phoneNumber, input.provider);
      }),

    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTelcoCreditHistory(ctx.user.id);
    }),
  }),

  // ── Actuarial Module ─────────────────────────────────────────────────────────
  actuarial: router({
    calculateLifePremium: protectedProcedure
      .input(z.object({ age: z.number(), gender: z.string(), sumAssured: z.number(), term: z.number(), smoker: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createActuarialCalculation(ctx.user.id, 'life_premium', input);
      }),
    calculateMotorPremium: protectedProcedure
      .input(z.object({ vehicleValue: z.number(), vehicleAge: z.number(), driverAge: z.number(), coverType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createActuarialCalculation(ctx.user.id, 'motor_premium', input);
      }),
    calculateReserves: protectedProcedure
      .input(z.object({ policyId: z.number(), valuationDate: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createActuarialCalculation(ctx.user.id, 'reserves', input);
      }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActuarialHistory(ctx.user.id);
    }),
  }),

  // ── Bancassurance ─────────────────────────────────────────────────────────────
  bancassurance: router({
    partners: protectedProcedure.query(async () => {
      return await db.getBancassurancePartners();
    }),
    generateOffer: protectedProcedure
      .input(z.object({ partnerId: z.number(), offerType: z.string(), loanAmount: z.number().optional(), tenure: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createBancassuranceOffer(ctx.user.id, input);
      }),
    myOffers: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBancassuranceOffers(ctx.user.id);
    }),
  }),

  // ── Group Life Administration ─────────────────────────────────────────────────
  groupLife: router({
    schemes: protectedProcedure.query(async ({ ctx }) => {
      return await db.getGroupLifeSchemes(ctx.user.id);
    }),
    createScheme: protectedProcedure
      .input(z.object({ schemeName: z.string(), employerName: z.string(), schemeType: z.string(), totalMembers: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createGroupLifeScheme(ctx.user.id, input);
      }),
    calculatePremium: protectedProcedure
      .input(z.object({ totalMembers: z.number(), averageSalary: z.number(), coverMultiple: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const premium = input.totalMembers * input.averageSalary * input.coverMultiple * 0.005;
        return { annualPremium: premium, perMemberPremium: premium / input.totalMembers, coverAmount: input.totalMembers * input.averageSalary * input.coverMultiple };
      }),
    members: protectedProcedure
      .input(z.object({ schemeId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getGroupLifeMembers(input.schemeId);
      }),
  }),

  // ── NMID Integration ──────────────────────────────────────────────────────────
  nmid: router({
    verify: protectedProcedure
      .input(z.object({ vehicleRegistration: z.string(), chassisNumber: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createNMIDVerification(ctx.user.id, input);
      }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getNMIDVerifications(ctx.user.id);
    }),
  }),

  // ── PFA Integration ───────────────────────────────────────────────────────────
  pfa: router({
    partners: protectedProcedure.query(async () => {
      return await db.getPFAPartners();
    }),
    annuityQuote: protectedProcedure
      .input(z.object({ pfaId: z.number(), rsaPin: z.string(), retirementAge: z.number(), accumulatedFund: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createPFAAnnuityQuote(ctx.user.id, input);
      }),
    validateRSA: protectedProcedure
      .input(z.object({ rsaPin: z.string(), pfaCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return { valid: /^PEN\d{15}$/.test(input.rsaPin), rsaPin: input.rsaPin, pfaCode: input.pfaCode, status: 'verified' };
      }),
    myQuotes: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserPFAQuotes(ctx.user.id);
    }),
  }),

  // ── Reinsurance Management ────────────────────────────────────────────────────
  reinsurance: router({
    treaties: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReinsuranceTreaties(ctx.user.id);
    }),
    createTreaty: protectedProcedure
      .input(z.object({ treatyName: z.string(), treatyType: z.string(), reinsurer: z.string(), reinsurerShare: z.number(), retentionLimit: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createReinsuranceTreaty(ctx.user.id, input);
      }),
    calculateCession: protectedProcedure
      .input(z.object({ treatyId: z.number(), policyId: z.number(), sumAssured: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createReinsuranceCession(input);
      }),
    cessions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReinsuranceCessions(ctx.user.id);
    }),
  }),

  // ── Agent Management ──────────────────────────────────────────────────────────
  agents: router({
    myProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAgentProfile(ctx.user.id);
    }),
    performance: protectedProcedure
      .input(z.object({ period: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getAgentPerformance(ctx.user.id, input.period);
      }),
    commissions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAgentCommissions(ctx.user.id);
    }),
    leaderboard: protectedProcedure.query(async () => {
      return await db.getAgentLeaderboard();
    }),
  }),

  // ── KYC/KYB ──────────────────────────────────────────────────────────────────
  kyc: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return await db.getKYCStatus(ctx.user.id);
    }),
    submit: protectedProcedure
      .input(z.object({ verificationType: z.string(), documentType: z.string(), documentNumber: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createKYCVerification(ctx.user.id, input);
      }),
  }),

  // ── NAICOM Compliance ─────────────────────────────────────────────────────────
  naicom: router({
    filings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getNAICOMFilings(ctx.user.id);
    }),
    submitFiling: protectedProcedure
      .input(z.object({ filingType: z.string(), period: z.string(), dueDate: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createNAICOMFiling(ctx.user.id, input);
      }),
    complianceScore: protectedProcedure.query(async ({ ctx }) => {
      const filings = await db.getNAICOMFilings(ctx.user.id);
      const total = filings.length || 1;
      const submitted = filings.filter((f: any) => f.status === 'Submitted').length;
      return { score: Math.round((submitted / total) * 100), total, submitted, pending: total - submitted };
    }),
  }),

  // ── Notifications ─────────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional(), limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getNotifications(ctx.user.id, input.unreadOnly, input.limit);
      }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.markNotificationRead(ctx.user.id, input.notificationId);
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      return await db.markAllNotificationsRead(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotificationCount(ctx.user.id);
    }),
  }),

  // ── Audit Trail ───────────────────────────────────────────────────────────────
  auditTrail: router({
    list: protectedProcedure
      .input(z.object({ entityType: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        return await db.getAuditTrail(ctx.user.id, input.entityType, input.limit, input.offset);
      }),
  }),

  // ── Loyalty / Gamification ────────────────────────────────────────────────────
  loyalty: router({
    points: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLoyaltyPoints(ctx.user.id);
    }),
    transactions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLoyaltyTransactions(ctx.user.id);
    }),
    redeem: protectedProcedure
      .input(z.object({ points: z.number(), rewardType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.redeemLoyaltyPoints(ctx.user.id, input.points, input.rewardType);
      }),
    leaderboard: protectedProcedure.query(async () => {
      return await db.getLoyaltyLeaderboard();
    }),
  }),

  // ── USSD Gateway ──────────────────────────────────────────────────────────────
  ussd: router({
    sessions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUSSDSessions(ctx.user.id);
    }),
    stats: protectedProcedure.query(async () => {
      return await db.getUSSDStats();
    }),
  }),

  // ── Document Management ───────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure
      .input(z.object({ entityType: z.string().optional(), entityId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getDocuments(ctx.user.id, input.entityType, input.entityId);
      }),
    upload: protectedProcedure
      .input(z.object({ entityType: z.string(), entityId: z.number().optional(), documentType: z.string(), fileName: z.string(), fileUrl: z.string(), fileSize: z.number().optional(), mimeType: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createDocument(ctx.user.id, input);
      }),
    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteDocument(ctx.user.id, input.documentId);
      }),
  }),

  // ── Analytics ─────────────────────────────────────────────────────────────────
  analytics: router({
    dashboard: protectedProcedure
      .input(z.object({ period: z.string().default('30d') }))
      .query(async ({ ctx, input }) => {
        return await db.getAnalyticsDashboard(ctx.user.id, input.period);
      }),
    track: protectedProcedure
      .input(z.object({ eventType: z.string(), entityType: z.string().optional(), entityId: z.string().optional(), properties: z.record(z.unknown()).optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.trackAnalyticsEvent(ctx.user.id, input);
      }),
  }),

  // ── Customer 360 ──────────────────────────────────────────────────────────────
  customer360: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const [policies, claims, payments, referrals] = await Promise.all([
        db.getPoliciesByUserId(ctx.user.id),
        db.getClaimsByUserId(ctx.user.id),
        db.getPaymentsByUserId(ctx.user.id),
        db.getReferralsByUserId(ctx.user.id),
      ]);
      return { policies, claims, payments, referrals };
    }),
  }),

  // ── Multi-Currency ────────────────────────────────────────────────────────────
  currency: router({
    rates: protectedProcedure.query(async () => {
      return await db.getCurrencyRates();
    }),
    convert: protectedProcedure
      .input(z.object({ amount: z.number(), from: z.string(), to: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.convertCurrency(input.amount, input.from, input.to);
      }),
  }),

  // ── Nigerian Bank Integrations ────────────────────────────────────────────────
  bankIntegrations: router({
    banks: protectedProcedure.query(async () => {
      return await db.getNigerianBanks();
    }),
    verifyAccount: protectedProcedure
      .input(z.object({ accountNumber: z.string(), bankCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.verifyBankAccount(input.accountNumber, input.bankCode);
      }),
  }),

  // ── Reconciliation Engine ─────────────────────────────────────────────────────
  reconciliation: router({
    summary: protectedProcedure
      .input(z.object({ period: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getReconciliationSummary(ctx.user.id, input.period);
      }),
    run: protectedProcedure
      .input(z.object({ period: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.runReconciliation(ctx.user.id, input.period);
      }),
  }),

  // ── Operational Reports ───────────────────────────────────────────────────────
  reports: router({
    generate: protectedProcedure
      .input(z.object({ reportType: z.string(), period: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.generateReport(ctx.user.id, input.reportType, input.period);
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getReports(ctx.user.id);
    }),
  }),

  // ── Churn Prediction ──────────────────────────────────────────────────────────
  churn: router({
    predict: protectedProcedure.query(async ({ ctx }) => {
      return await db.getChurnPrediction(ctx.user.id);
    }),
    interventions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getChurnInterventions(ctx.user.id);
    }),
  }),

  // ── AI Claims Adjudication ────────────────────────────────────────────────────
  aiClaims: router({
    adjudicate: protectedProcedure
      .input(z.object({ claimId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.adjudicateClaim(ctx.user.id, input.claimId);
      }),
    queue: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAdjudicationQueue(ctx.user.id);
    }),
  }),

  // ── Smart Claim Routing ───────────────────────────────────────────────────────
  claimRouting: router({
    route: protectedProcedure
      .input(z.object({ claimId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.routeClaim(ctx.user.id, input.claimId);
      }),
    rules: protectedProcedure.query(async () => {
      return await db.getRoutingRules();
    }),
  }),

  // ── Policy Renewal Automation ─────────────────────────────────────────────────
  policyRenewal: router({
    upcoming: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUpcomingRenewals(ctx.user.id);
    }),
    autoRenew: protectedProcedure
      .input(z.object({ policyId: z.number(), enable: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return await db.setAutoRenewal(ctx.user.id, input.policyId, input.enable);
      }),
    renew: protectedProcedure
      .input(z.object({ policyId: z.number(), paymentMethod: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.renewPolicy(ctx.user.id, input.policyId, input.paymentMethod);
      }),
  }),

  // ── Batch Processing ──────────────────────────────────────────────────────────
  batch: router({
    jobs: protectedProcedure.query(async () => {
      return await db.getBatchJobs();
    }),
    trigger: protectedProcedure
      .input(z.object({ jobType: z.string(), params: z.record(z.unknown()).optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.triggerBatchJob(input.jobType, input.params);
      }),
  }),

  // ── Telematics ────────────────────────────────────────────────────────────────
  telematics: router({
    trips: protectedProcedure
      .input(z.object({ policyId: z.number().optional(), limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getTelematicsTrips(ctx.user.id, input.policyId, input.limit);
      }),
    score: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTelematicsScore(ctx.user.id);
    }),
    submit: protectedProcedure
      .input(z.object({ vehicleId: z.string(), driverId: z.string(), speed: z.number(), fuelLevel: z.number(), engineStatus: z.string(), latitude: z.number(), longitude: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.submitTelematicsData(ctx.user.id, input);
      }),
  }),

  // ── Emergency SOS ─────────────────────────────────────────────────────────────
  emergency: router({
    trigger: protectedProcedure
      .input(z.object({ latitude: z.number(), longitude: z.number(), emergencyType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.triggerEmergencySOS(ctx.user.id, input);
      }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEmergencyHistory(ctx.user.id);
    }),
  }),

  // ── Digital Wallet ────────────────────────────────────────────────────────────
  wallet: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWalletBalance(ctx.user.id);
    }),
    transactions: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getWalletTransactions(ctx.user.id, input.limit);
      }),
    topUp: protectedProcedure
      .input(z.object({ amount: z.number(), paymentMethod: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.walletTopUp(ctx.user.id, input.amount, input.paymentMethod);
      }),
  }),

  // ── Health & Wellness ─────────────────────────────────────────────────────────
  health: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return await db.getHealthMetrics(ctx.user.id);
    }),
    programs: protectedProcedure.query(async () => {
      return await db.getWellnessPrograms();
    }),
    enroll: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.enrollWellnessProgram(ctx.user.id, input.programId);
      }),
  }),

  // ── Parametric Insurance ──────────────────────────────────────────────────────
  parametric: router({
    products: protectedProcedure.query(async () => {
      return await db.getParametricProducts();
    }),
    purchase: protectedProcedure
      .input(z.object({ productId: z.string(), coverAmount: z.number(), location: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.purchaseParametricPolicy(ctx.user.id, input);
      }),
  }),

  // ── P2P Insurance ─────────────────────────────────────────────────────────────
  p2p: router({
    pools: protectedProcedure.query(async () => {
      return await db.getP2PPools();
    }),
    join: protectedProcedure
      .input(z.object({ poolId: z.string(), contribution: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.joinP2PPool(ctx.user.id, input.poolId, input.contribution);
      }),
    myPools: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserP2PPools(ctx.user.id);
    }),
  }),

  // ── Microinsurance ────────────────────────────────────────────────────────────
  microinsurance: router({
    products: protectedProcedure.query(async () => {
      return await db.getMicroinsuranceProducts();
    }),
    purchase: protectedProcedure
      .input(z.object({ productId: z.string(), duration: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.purchaseMicroinsurance(ctx.user.id, input.productId, input.duration);
      }),
    active: protectedProcedure.query(async ({ ctx }) => {
      return await db.getActiveMicroinsurance(ctx.user.id);
    }),
  }),

  // ── Gig Economy ───────────────────────────────────────────────────────────────
  gigEconomy: router({
    plans: protectedProcedure.query(async () => {
      return await db.getGigEconomyPlans();
    }),
    activate: protectedProcedure
      .input(z.object({ planId: z.string(), platform: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.activateGigPlan(ctx.user.id, input.planId, input.platform);
      }),
    coverage: protectedProcedure.query(async ({ ctx }) => {
      return await db.getGigCoverage(ctx.user.id);
    }),
  }),

  // ── SME Business ──────────────────────────────────────────────────────────────
  sme: router({
    products: protectedProcedure.query(async () => {
      return await db.getSMEProducts();
    }),
    quote: protectedProcedure
      .input(z.object({ businessType: z.string(), employees: z.number(), annualRevenue: z.number(), coverageTypes: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        return await db.getSMEQuote(ctx.user.id, input);
      }),
    policies: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSMEPolicies(ctx.user.id);
    }),
  }),

  // ── Embedded Insurance ────────────────────────────────────────────────────────
  embedded: router({
    partners: protectedProcedure.query(async () => {
      return await db.getEmbeddedPartners();
    }),
    offers: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEmbeddedOffers(ctx.user.id);
    }),
    accept: protectedProcedure
      .input(z.object({ offerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.acceptEmbeddedOffer(ctx.user.id, input.offerId);
      }),
    activate: protectedProcedure
      .input(z.object({ partnerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.activateEmbeddedPartner(ctx.user.id, input.partnerId);
      }),
    create: protectedProcedure
      .input(z.object({ name: z.string(), industry: z.string(), contactEmail: z.string(), productsOffered: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createEmbeddedInsurancePartner(ctx.user.id, input);
      }),
  }),

  // ── Insurance Score ───────────────────────────────────────────────────────────
  insuranceScore: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getInsuranceScore(ctx.user.id);
    }),
    factors: protectedProcedure.query(async ({ ctx }) => {
      return await db.getInsuranceScoreFactors(ctx.user.id);
    }),
  }),

  // ── Dynamic Pricing ───────────────────────────────────────────────────────────
  dynamicPricing: router({
    quote: protectedProcedure
      .input(z.object({ productType: z.string(), riskFactors: z.record(z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        return await db.getDynamicPricingQuote(ctx.user.id, input.productType, input.riskFactors);
      }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDynamicPricingHistory(ctx.user.id);
    }),
  }),

  // ── Financial Wellness ────────────────────────────────────────────────────────
  financialWellness: router({
    score: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFinancialWellnessScore(ctx.user.id);
    }),
    recommendations: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFinancialRecommendations(ctx.user.id);
    }),
  }),

  // ── Savings & Investment ──────────────────────────────────────────────────────
  savings: router({
    plans: protectedProcedure.query(async () => {
      return await db.getSavingsPlans();
    }),
    myAccounts: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSavingsAccounts(ctx.user.id);
    }),
    contribute: protectedProcedure
      .input(z.object({ accountId: z.string(), amount: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.contributeSavings(ctx.user.id, input.accountId, input.amount);
      }),
  }),

  // ── Compliance Monitoring ─────────────────────────────────────────────────────
  compliance: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return await db.getComplianceStatus(ctx.user.id);
    }),
    requirements: protectedProcedure.query(async () => {
      return await db.getComplianceRequirements();
    }),
    submit: protectedProcedure
      .input(z.object({ requirementId: z.string(), evidence: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.submitComplianceEvidence(ctx.user.id, input.requirementId, input.evidence);
      }),
  }),

  // ── Model Security Dashboard ──────────────────────────────────────────────────
  modelSecurity: router({
    threats: protectedProcedure.query(async () => {
      return await db.getModelSecurityThreats();
    }),
    auditLog: protectedProcedure.query(async () => {
      return await db.getModelAuditLog();
    }),
  }),

  // ── MCMC Risk Modeling ────────────────────────────────────────────────────────
  mcmc: router({
    simulate: protectedProcedure
      .input(z.object({ iterations: z.number().default(10000), riskFactors: z.record(z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        return await db.runMCMCSimulation(ctx.user.id, input);
      }),
    results: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMCMCResults(ctx.user.id);
    }),
  }),

  // ── Insurance Literacy Hub ────────────────────────────────────────────────────
  literacy: router({
    articles: protectedProcedure
      .input(z.object({ category: z.string().optional(), language: z.string().default('en') }))
      .query(async ({ ctx, input }) => {
        return await db.getLiteracyArticles(input.category, input.language);
      }),
    progress: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLiteracyProgress(ctx.user.id);
    }),
    complete: protectedProcedure
      .input(z.object({ articleId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.completeLiteracyArticle(ctx.user.id, input.articleId);
      }),
  }),

  // ── Agricultural Underwriting ─────────────────────────────────────────────────
  agricultural: router({
    products: protectedProcedure.query(async () => {
      return await db.getAgriculturalProducts();
    }),
    quote: protectedProcedure
      .input(z.object({ cropType: z.string(), farmSize: z.number(), location: z.string(), season: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.getAgriculturalQuote(ctx.user.id, input);
      }),
    policies: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAgriculturalPolicies(ctx.user.id);
    }),
  }),

  // ── Performance Monitoring ────────────────────────────────────────────────────
  performance: router({
    metrics: protectedProcedure.query(async () => {
      return await db.getPerformanceMetrics();
    }),
    alerts: protectedProcedure.query(async () => {
      return await db.getPerformanceAlerts();
    }),
  }),

  // ── Disaster Recovery ─────────────────────────────────────────────────────────
  disasterRecovery: router({
    status: protectedProcedure.query(async () => {
      return await db.getDRStatus();
    }),
    runTest: protectedProcedure
      .input(z.object({ testType: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.runDRTest(input.testType);
      }),
  }),

  // ── A/B Testing ───────────────────────────────────────────────────────────────
  abTesting: router({
    experiments: protectedProcedure.query(async () => {
      return await db.getABExperiments();
    }),
    assign: protectedProcedure
      .input(z.object({ experimentId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.assignABVariant(ctx.user.id, input.experimentId);
      }),
    results: protectedProcedure
      .input(z.object({ experimentId: z.string() }))
      .query(async ({ ctx, input }) => {
        return await db.getABResults(input.experimentId);
      }),
  }),

  // ── Family Coverage ───────────────────────────────────────────────────────────
  familyCoverage: router({
    members: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFamilyMembers(ctx.user.id);
    }),
    addMember: protectedProcedure
      .input(z.object({ name: z.string(), relationship: z.string(), dateOfBirth: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.addFamilyMember(ctx.user.id, input);
      }),
    plans: protectedProcedure.query(async () => {
      return await db.getFamilyCoveragePlans();
    }),
  }),

  // ── Claims Evidence ───────────────────────────────────────────────────────────
  claimsEvidence: router({
    list: protectedProcedure
      .input(z.object({ claimId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getClaimEvidence(ctx.user.id, input.claimId);
      }),
    upload: protectedProcedure
      .input(z.object({ claimId: z.number(), evidenceType: z.string(), fileUrl: z.string(), fileName: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.uploadClaimEvidence(ctx.user.id, input);
      }),
  }),

  // ── Insurance Marketplace ─────────────────────────────────────────────────────
  marketplace: router({
    products: protectedProcedure
      .input(z.object({ category: z.string().optional(), provider: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getMarketplaceProducts(input.category, input.provider);
      }),
    compare: protectedProcedure
      .input(z.object({ productIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        return await db.compareMarketplaceProducts(input.productIds);
      }),
  }),

  // ── Geospatial ────────────────────────────────────────────────────────────────
  geospatial: router({
    riskMap: protectedProcedure
      .input(z.object({ latitude: z.number(), longitude: z.number(), radius: z.number().default(10) }))
      .query(async ({ ctx, input }) => {
        return await db.getGeospatialRiskData(input.latitude, input.longitude, input.radius);
      }),
    claims: protectedProcedure
      .input(z.object({ bounds: z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() }) }))
      .query(async ({ ctx, input }) => {
        return await db.getGeospatialClaims(input.bounds);
      }),
  }),

  // ── WhatsApp Integration ──────────────────────────────────────────────────────
  whatsapp: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWhatsAppStatus(ctx.user.id);
    }),
    connect: protectedProcedure
      .input(z.object({ phoneNumber: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.connectWhatsApp(ctx.user.id, input.phoneNumber);
      }),
    messages: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getWhatsAppMessages(ctx.user.id, input.limit);
      }),
  }),

  // ── Voice Assistant ───────────────────────────────────────────────────────────
  voice: router({
    transcribe: protectedProcedure
      .input(z.object({ audio: z.string(), language: z.string().default('en') }))
      .mutation(async ({ ctx, input }) => {
        return await db.transcribeVoice(ctx.user.id, input.audio, input.language);
      }),
    synthesize: protectedProcedure
      .input(z.object({ text: z.string(), language: z.string().default('en') }))
      .mutation(async ({ ctx, input }) => {
        return await db.synthesizeVoice(ctx.user.id, input.text, input.language);
      }),
    sessions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getVoiceSessions(ctx.user.id);
    }),
  }),

  // ── Onboarding ────────────────────────────────────────────────────────────────
  onboarding: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return await db.getOnboardingStatus(ctx.user.id);
    }),
    complete: protectedProcedure
      .input(z.object({ step: z.string(), data: z.record(z.unknown()).optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.completeOnboardingStep(ctx.user.id, input.step, input.data);
      }),
  }),

  // ── Policy Comparison ─────────────────────────────────────────────────────────
  policyComparison: router({
    compare: protectedProcedure
      .input(z.object({ policyIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        return await db.comparePolicies(ctx.user.id, input.policyIds);
      }),
  }),

  // ── Insurance Application ─────────────────────────────────────────────────────
  application: router({
    start: protectedProcedure
      .input(z.object({ productType: z.string(), coverageAmount: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.startInsuranceApplication(ctx.user.id, input);
      }),
    save: protectedProcedure
      .input(z.object({ applicationId: z.string(), step: z.string(), data: z.record(z.unknown()) }))
      .mutation(async ({ ctx, input }) => {
        return await db.saveApplicationStep(ctx.user.id, input);
      }),
    submit: protectedProcedure
      .input(z.object({ applicationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.submitApplication(ctx.user.id, input.applicationId);
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserApplications(ctx.user.id);
    }),
  }),

  // ── Customer Feedback ─────────────────────────────────────────────────────────
  feedback: router({
    submit: protectedProcedure
      .input(z.object({ category: z.string(), rating: z.number(), comment: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await db.submitFeedback(ctx.user.id, input);
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFeedback(ctx.user.id);
    }),
  }),

  // ── PostgreSQL Scaling ────────────────────────────────────────────────────────
  dbScaling: router({
    metrics: protectedProcedure.query(async () => {
      return await db.getDBScalingMetrics();
    }),
    recommendations: protectedProcedure.query(async () => {
      return await db.getDBScalingRecommendations();
    }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // AGRICULTURAL INSURANCE SUITE — 13 parametric products
  // ══════════════════════════════════════════════════════════════════════════════
  agriculturalInsurance: router({
    products: protectedProcedure.query(async () => {
      return await db.getAgriculturalInsuranceProducts();
    }),
    triggerEvents: protectedProcedure.query(async () => {
      return await db.getAgriculturalTriggerEvents();
    }),
    ndviReadings: protectedProcedure.query(async () => {
      return await db.getAgriculturalNDVIReadings();
    }),
    purchase: protectedProcedure
      .input(z.object({ productId: z.string(), farmSize: z.number(), location: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.purchaseAgriculturalPolicy(ctx.user.id, input);
      }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // EMBEDDED DISTRIBUTION PLATFORM — 6 distribution channels
  // ══════════════════════════════════════════════════════════════════════════════
  embeddedDistribution: router({
    partners: protectedProcedure.query(async () => {
      return await db.getEmbeddedDistributionPartners();
    }),
    revenue: protectedProcedure.query(async () => {
      return await db.getEmbeddedDistributionRevenue();
    }),
    createPartner: protectedProcedure
      .input(z.object({ name: z.string(), channel: z.string(), industry: z.string(), commission: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.createEmbeddedPartner(ctx.user.id, input);
      }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // DIGITAL CONSUMER PRODUCTS — 8 on-demand flexible products
  // ══════════════════════════════════════════════════════════════════════════════
  digitalConsumer: router({
    products: protectedProcedure.query(async () => {
      return await db.getDigitalConsumerProducts();
    }),
    cyberAssessment: protectedProcedure
      .input(z.object({ businessName: z.string(), industry: z.string(), employees: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.getDigitalCyberAssessment(ctx.user.id, input);
      }),
    activate: protectedProcedure
      .input(z.object({ productId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.activateDigitalProduct(ctx.user.id, input.productId);
      }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // TAKAFUL ISLAMIC INSURANCE — 6 Sharia-compliant mutual pools
  // ══════════════════════════════════════════════════════════════════════════════
  takaful: router({
    pools: protectedProcedure.query(async () => {
      return await db.getTakafulPools();
    }),
    shariaPrinciples: protectedProcedure.query(async () => {
      return await db.getTakafulShariaPrinciples();
    }),
    join: protectedProcedure
      .input(z.object({ poolId: z.string(), contribution: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.joinTakafulPool(ctx.user.id, input.poolId, input.contribution);
      }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // NIIRA 2025 COMPULSORY INSURANCE — 11 compulsory classes
  // ══════════════════════════════════════════════════════════════════════════════
  niiraInsurance: router({
    classes: protectedProcedure.query(async () => {
      return await db.getNIIRAClasses();
    }),
    complianceCheck: protectedProcedure
      .input(z.object({ businessType: z.string(), employees: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.getNIIRAComplianceCheck(ctx.user.id, input);
      }),
    purchase: protectedProcedure
      .input(z.object({ classId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return await db.purchaseNIIRAPolicy(ctx.user.id, input.classId);
      }),
  }),

  // ══════════════════════════════════════════════════════════════════════════════
  // INSURANCE TECH INNOVATIONS — AI pricing, P2P, gamification, product builder
  // ══════════════════════════════════════════════════════════════════════════════
  techInnovations: router({
    features: protectedProcedure.query(async () => {
      return await db.getTechInnovationFeatures();
    }),
    pricingComparison: protectedProcedure.query(async () => {
      return await db.getTechPricingComparison();
    }),
    p2pPools: protectedProcedure.query(async () => {
      return await db.getTechP2PPools();
    }),
    gamificationLevels: protectedProcedure.query(async () => {
      return await db.getTechGamificationLevels();
    }),
    calculatePrice: protectedProcedure
      .input(z.object({ basePremium: z.number(), drivingScore: z.number(), claimsHistory: z.number(), mileage: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.calculateDynamicPrice(ctx.user.id, input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
