import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// Service URLs from environment
const NIMC_SERVICE_URL = process.env.NIMC_URL || "http://localhost:9005";
const CAC_SERVICE_URL = process.env.CAC_URL || "http://localhost:9006";

// Request/Response types
const NINVerificationInput = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

const BiometricVerificationInput = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  fingerprintData: z.string().optional(),
  faceImage: z.string().optional(),
});

const CompanyVerificationInput = z.object({
  rcNumber: z.string().min(1, "RC number is required"),
  companyName: z.string().optional(),
  companyType: z.string().optional(),
});

const CompanySearchInput = z.object({
  query: z.string().min(2, "Search query must be at least 2 characters"),
  companyType: z.string().optional(),
  state: z.string().optional(),
  limit: z.number().min(1).max(100).default(10),
});

export const identityVerificationRouter = router({
  /**
   * Verify a National Identification Number (NIN) against NIMC database
   */
  verifyNIN: protectedProcedure
    .input(NINVerificationInput)
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(`${NIMC_SERVICE_URL}/verify/nin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nin: input.nin,
            first_name: input.firstName,
            last_name: input.lastName,
            date_of_birth: input.dateOfBirth,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "NIMC service error" }));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.detail || `NIMC verification failed: ${response.status}`,
          });
        }

        return response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to NIMC service: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Verify biometric data (fingerprint/face) against NIMC database
   */
  verifyBiometric: protectedProcedure
    .input(BiometricVerificationInput)
    .mutation(async ({ input }) => {
      if (!input.fingerprintData && !input.faceImage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either fingerprint data or face image must be provided",
        });
      }

      try {
        const response = await fetch(`${NIMC_SERVICE_URL}/verify/biometric`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nin: input.nin,
            fingerprint_data: input.fingerprintData,
            face_image: input.faceImage,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "NIMC service error" }));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.detail || `Biometric verification failed: ${response.status}`,
          });
        }

        return response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to NIMC service: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get NIMC service health status
   */
  getNIMCStatus: protectedProcedure.query(async () => {
    try {
      const response = await fetch(`${NIMC_SERVICE_URL}/status`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Service returned ${response.status}`,
        };
      }

      const status = await response.json();
      return {
        available: true,
        ...status,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Service unavailable",
      };
    }
  }),

  /**
   * Verify a company registration against CAC database
   */
  verifyCompany: protectedProcedure
    .input(CompanyVerificationInput)
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(`${CAC_SERVICE_URL}/verify/company`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rc_number: input.rcNumber,
            company_name: input.companyName,
            company_type: input.companyType,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "CAC service error" }));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.detail || `CAC verification failed: ${response.status}`,
          });
        }

        return response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to CAC service: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Search for companies in CAC database
   */
  searchCompanies: protectedProcedure
    .input(CompanySearchInput)
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(`${CAC_SERVICE_URL}/search/companies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: input.query,
            company_type: input.companyType,
            state: input.state,
            limit: input.limit,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "CAC service error" }));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.detail || `Company search failed: ${response.status}`,
          });
        }

        return response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to CAC service: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get detailed company information by RC number
   */
  getCompanyDetails: protectedProcedure
    .input(z.object({ rcNumber: z.string() }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(`${CAC_SERVICE_URL}/companies/${encodeURIComponent(input.rcNumber)}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Company not found",
            });
          }
          const error = await response.json().catch(() => ({ detail: "CAC service error" }));
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.detail || `Failed to get company details: ${response.status}`,
          });
        }

        return response.json();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to connect to CAC service: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get CAC service health status
   */
  getCACStatus: protectedProcedure.query(async () => {
    try {
      const response = await fetch(`${CAC_SERVICE_URL}/status`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Service returned ${response.status}`,
        };
      }

      const status = await response.json();
      return {
        available: true,
        ...status,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Service unavailable",
      };
    }
  }),

  /**
   * Get combined status of all identity verification services
   */
  getServicesStatus: protectedProcedure.query(async () => {
    const [nimcStatus, cacStatus] = await Promise.all([
      fetch(`${NIMC_SERVICE_URL}/health`).then(r => r.ok ? r.json() : { status: "unhealthy" }).catch(() => ({ status: "unavailable" })),
      fetch(`${CAC_SERVICE_URL}/health`).then(r => r.ok ? r.json() : { status: "unhealthy" }).catch(() => ({ status: "unavailable" })),
    ]);

    return {
      nimc: {
        url: NIMC_SERVICE_URL,
        ...nimcStatus,
      },
      cac: {
        url: CAC_SERVICE_URL,
        ...cacStatus,
      },
      overall: nimcStatus.status === "healthy" && cacStatus.status === "healthy" ? "healthy" : "degraded",
    };
  }),
});
