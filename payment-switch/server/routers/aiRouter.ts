import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM, Message } from "../_core/llm";
import { logAuditEvent, AuditActions } from "../auditLog";

/**
 * AI Router - Provides AI chat functionality for the platform
 * Wraps the invokeLLM function with proper authentication and audit logging
 */
export const aiRouter = router({
  /**
   * Chat with AI assistant
   * Supports general queries about the payment platform
   */
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(10000),
      context: z.enum([
        'general',
        'transactions',
        'compliance',
        'onboarding',
        'technical',
        'fraud',
        'support'
      ]).optional().default('general'),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })).optional().default([])
    }))
    .mutation(async ({ ctx, input }) => {
      const { message, context, conversationHistory } = input;

      // Build system prompt based on context
      const systemPrompts: Record<string, string> = {
        general: `You are a helpful AI assistant for a payment switch platform. 
          Help users with general questions about the platform, features, and functionality.
          Be concise and professional.`,
        transactions: `You are a transaction analysis assistant for a payment switch platform.
          Help users understand transaction data, patterns, and troubleshoot issues.
          Focus on transaction-related queries.`,
        compliance: `You are a compliance assistant for a payment switch platform.
          Help users with KYC/KYB processes, regulatory requirements, and compliance questions.
          Ensure responses align with financial regulations.`,
        onboarding: `You are an onboarding assistant for a payment switch platform.
          Help users through the participant onboarding process, documentation requirements,
          and integration steps.`,
        technical: `You are a technical support assistant for a payment switch platform.
          Help users with API integration, technical issues, and development questions.
          Provide code examples when helpful.`,
        fraud: `You are a fraud analysis assistant for a payment switch platform.
          Help users understand fraud detection, risk scores, and suspicious activity.
          Be thorough in explaining risk indicators.`,
        support: `You are a customer support assistant for a payment switch platform.
          Help users resolve issues, answer questions, and provide guidance.
          Be empathetic and solution-oriented.`
      };

      // Build messages array
      const messages: Message[] = [
        {
          role: 'system',
          content: systemPrompts[context] || systemPrompts.general
        },
        // Add conversation history
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        // Add current message
        {
          role: 'user' as const,
          content: message
        }
      ];

      try {
        const result = await invokeLLM({
          messages,
          maxTokens: 2048
        });

        const assistantMessage = result.choices[0]?.message?.content;
        const responseText = typeof assistantMessage === 'string' 
          ? assistantMessage 
          : Array.isArray(assistantMessage) 
            ? assistantMessage.map(c => 'text' in c ? c.text : '').join('')
            : '';

        // Log AI interaction for audit
        await logAuditEvent({
          userId: ctx.user.id,
          action: AuditActions.AI_CHAT,
          resource: 'ai_chat',
          resourceId: result.id,
          details: {
            context,
            messageLength: message.length,
            responseLength: responseText.length,
            tokensUsed: result.usage?.total_tokens
          }
        });

        return {
          success: true,
          response: responseText,
          messageId: result.id,
          tokensUsed: result.usage?.total_tokens || 0
        };
      } catch (error) {
        // Log failed AI interaction
        await logAuditEvent({
          userId: ctx.user.id,
          action: AuditActions.AI_CHAT_FAILED,
          resource: 'ai_chat',
          resourceId: 'error',
          details: {
            context,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        throw error;
      }
    }),

  /**
   * Analyze transaction for fraud indicators
   */
  analyzeTransaction: protectedProcedure
    .input(z.object({
      transactionId: z.string(),
      transactionData: z.object({
        amount: z.number(),
        currency: z.string(),
        senderCountry: z.string().optional(),
        recipientCountry: z.string().optional(),
        paymentMethod: z.string().optional(),
        timestamp: z.string().optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const { transactionId, transactionData } = input;

      const messages: Message[] = [
        {
          role: 'system',
          content: `You are a fraud analysis AI for a payment switch platform.
            Analyze the following transaction and provide:
            1. Risk score (0-100)
            2. Risk factors identified
            3. Recommended actions
            Be concise and structured in your response.`
        },
        {
          role: 'user',
          content: `Analyze this transaction:
            Transaction ID: ${transactionId}
            Amount: ${transactionData.amount} ${transactionData.currency}
            Sender Country: ${transactionData.senderCountry || 'Unknown'}
            Recipient Country: ${transactionData.recipientCountry || 'Unknown'}
            Payment Method: ${transactionData.paymentMethod || 'Unknown'}
            Timestamp: ${transactionData.timestamp || 'Unknown'}`
        }
      ];

      const result = await invokeLLM({
        messages,
        maxTokens: 1024
      });

      const analysis = result.choices[0]?.message?.content;
      const analysisText = typeof analysis === 'string' 
        ? analysis 
        : Array.isArray(analysis) 
          ? analysis.map(c => 'text' in c ? c.text : '').join('')
          : '';

      await logAuditEvent({
        userId: ctx.user.id,
        action: AuditActions.AI_FRAUD_ANALYSIS,
        resource: 'transaction',
        resourceId: transactionId,
        details: {
          transactionData,
          analysisLength: analysisText.length
        }
      });

      return {
        success: true,
        transactionId,
        analysis: analysisText,
        messageId: result.id
      };
    }),

  /**
   * Generate compliance report summary
   */
  generateComplianceSummary: protectedProcedure
    .input(z.object({
      reportType: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
      data: z.object({
        totalTransactions: z.number(),
        flaggedTransactions: z.number(),
        completedKYC: z.number(),
        pendingKYC: z.number(),
        completedKYB: z.number(),
        pendingKYB: z.number()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const { reportType, data } = input;

      const messages: Message[] = [
        {
          role: 'system',
          content: `You are a compliance reporting AI for a payment switch platform.
            Generate a professional compliance summary based on the provided data.
            Include key metrics, trends, and any areas of concern.`
        },
        {
          role: 'user',
          content: `Generate a ${reportType} compliance summary:
            Total Transactions: ${data.totalTransactions}
            Flagged Transactions: ${data.flaggedTransactions}
            Completed KYC: ${data.completedKYC}
            Pending KYC: ${data.pendingKYC}
            Completed KYB: ${data.completedKYB}
            Pending KYB: ${data.pendingKYB}`
        }
      ];

      const result = await invokeLLM({
        messages,
        maxTokens: 2048
      });

      const summary = result.choices[0]?.message?.content;
      const summaryText = typeof summary === 'string' 
        ? summary 
        : Array.isArray(summary) 
          ? summary.map(c => 'text' in c ? c.text : '').join('')
          : '';

      await logAuditEvent({
        userId: ctx.user.id,
        action: AuditActions.AI_COMPLIANCE_SUMMARY,
        resource: 'compliance_report',
        resourceId: reportType,
        details: {
          reportType,
          dataSnapshot: data
        }
      });

      return {
        success: true,
        reportType,
        summary: summaryText,
        messageId: result.id
      };
    })
});
