import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";

export const healthRouter = router({
  /**
   * Check overall system health
   */
  check: publicProcedure.query(async () => {
    const checks = {
      database: false,
      ocr_service: false,
      python_api: false,
      storage: false,
    };

    const errors: string[] = [];

    // Check database
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (db) {
        checks.database = true;
      }
    } catch (error) {
      errors.push(`Database: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // Check OCR service
    if (ENV.ocrServiceUrl) {
      try {
        const response = await fetch(`${ENV.ocrServiceUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        checks.ocr_service = response.ok;
        if (!response.ok) {
          errors.push(`OCR Service: HTTP ${response.status}`);
        }
      } catch (error) {
        errors.push(`OCR Service: ${error instanceof Error ? error.message : "Unreachable"}`);
      }
    } else {
      errors.push("OCR Service: URL not configured");
    }

    // Check Python API Gateway
    if (ENV.pythonApiUrl) {
      try {
        const response = await fetch(`${ENV.pythonApiUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        checks.python_api = response.ok;
        if (!response.ok) {
          errors.push(`Python API: HTTP ${response.status}`);
        }
      } catch (error) {
        errors.push(`Python API: ${error instanceof Error ? error.message : "Unreachable"}`);
      }
    } else {
      errors.push("Python API: URL not configured");
    }

    // Check S3 storage
    try {
      const { storagePut } = await import("./storage");
      // Try to write a tiny test file
      const testKey = `health-check/${Date.now()}.txt`;
      await storagePut(testKey, "health check", "text/plain");
      checks.storage = true;
    } catch (error) {
      errors.push(`Storage: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    const healthy = Object.values(checks).every((check) => check);

    return {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }),

  /**
   * Check OCR service specifically
   */
  ocrService: publicProcedure.query(async () => {
    if (!ENV.ocrServiceUrl) {
      return {
        available: false,
        error: "OCR_SERVICE_URL not configured",
      };
    }

    try {
      const response = await fetch(`${ENV.ocrServiceUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          available: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        available: true,
        ...data,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Service unreachable",
      };
    }
  }),

  /**
   * Check Python API Gateway
   */
  pythonApi: publicProcedure.query(async () => {
    if (!ENV.pythonApiUrl) {
      return {
        available: false,
        error: "PYTHON_API_URL not configured",
      };
    }

    try {
      const response = await fetch(`${ENV.pythonApiUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          available: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        available: true,
        ...data,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : "Service unreachable",
      };
    }
  }),
});
