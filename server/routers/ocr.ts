import { router, protectedProcedure } from "../_core/trpc.js";
import { z } from 'zod';
import axios from 'axios';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5001';

export const ocrRouter = router({
  /**
   * Scan receipt image and extract transaction details using Python OCR service
   */
  scanReceipt: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64 } = input;

      try {
        // Call Python OCR service
        const response = await axios.post(
          `${OCR_SERVICE_URL}/scan-receipt`,
          { imageBase64 },
          { timeout: 30000 } // 30 second timeout
        );

        return {
          success: true,
          data: response.data,
        };
      } catch (error) {
        console.error('OCR scan error:', error);
        throw new Error('Failed to scan receipt');
      }
    }),

  /**
   * Scan ID document and extract personal information
   */
  scanIdDocument: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        documentType: z.enum(['passport', 'drivers_license', 'national_id']),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64, documentType } = input;

      try {
        // Call Python OCR service
        const response = await axios.post(
          `${OCR_SERVICE_URL}/scan-id`,
          { imageBase64, documentType },
          { timeout: 30000 }
        );

        return {
          success: true,
          data: response.data,
        };
      } catch (error) {
        console.error('OCR ID scan error:', error);
        throw new Error('Failed to scan ID document');
      }
    }),

  /**
   * Extract text from any image
   */
  extractText: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { imageBase64 } = input;

      try {
        // Call Python OCR service
        const response = await axios.post(
          `${OCR_SERVICE_URL}/extract-text`,
          { imageBase64 },
          { timeout: 30000 }
        );

        return {
          success: true,
          text: response.data.text || '',
        };
      } catch (error) {
        console.error('OCR text extraction error:', error);
        throw new Error('Failed to extract text from image');
      }
    }),
});

export default ocrRouter;
