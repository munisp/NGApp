import { router, protectedProcedure } from "../_core/trpc.js";
import { z } from "zod";
import { invokeLLM } from "../_core/llm.js";

function detectIntent(transcript: string): string {
  if (
    transcript.includes("balance") ||
    transcript.includes("how much") ||
    transcript.includes("account")
  ) {
    return "check_balance";
  }
  if (
    transcript.includes("send") ||
    transcript.includes("transfer") ||
    transcript.includes("pay")
  ) {
    return "send_money";
  }
  if (
    transcript.includes("transaction") ||
    transcript.includes("history") ||
    transcript.includes("spent")
  ) {
    return "view_transactions";
  }
  if (
    transcript.includes("goal") ||
    transcript.includes("saving") ||
    transcript.includes("target")
  ) {
    return "check_goals";
  }
  if (transcript.includes("bill") || transcript.includes("payment")) {
    return "pay_bill";
  }
  return "general_query";
}

function extractAction(transcript: string, intent: string): any {
  const action: any = { type: intent };

  // Extract amount
  const amountMatch = transcript.match(/\$?(\d+(?:\.\d{2})?)/);
  if (amountMatch) {
    action.amount = parseFloat(amountMatch[1]);
  }

  // Extract recipient name (simple pattern)
  if (intent === "send_money") {
    const toMatch = transcript.match(/to\s+(\w+)/i);
    if (toMatch) {
      action.recipient = toMatch[1];
    }
  }

  return action;
}

export const voiceRouter = router({
  /**
   * Process voice command transcript
   */
  process: protectedProcedure
    .input(
      z.object({
        transcript: z.string(),
        userContext: z
          .object({
            balance: z.number().optional(),
            recentTransactions: z.number().optional(),
            savingsGoals: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { transcript, userContext } = input;

      try {
        // Build context for LLM
        const systemPrompt = `You are a helpful financial assistant for a mobile banking app. 
You can help users with:
- Checking account balances
- Viewing recent transactions
- Sending money to contacts
- Paying bills
- Checking savings goals
- Providing financial advice

User's financial context:
- Balance: $${userContext?.balance || 0}
- Recent transactions: ${userContext?.recentTransactions || 0}
- Savings goals: ${userContext?.savingsGoals || 0}

Provide concise, helpful responses. If the user wants to perform an action (like sending money), 
explain what information you need and guide them through the process.`;

        const userPrompt = `User said: "${transcript}"

Provide a helpful response. Keep it conversational and concise (2-3 sentences max).`;

        // Call LLM
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        let responseText = "";
        if (response.choices && response.choices[0]?.message?.content) {
          const content = response.choices[0].message.content;
          if (typeof content === "string") {
            responseText = content;
          } else if (Array.isArray(content)) {
            // Extract text from content array
            responseText = content
              .filter((c) => c.type === "text")
              .map((c) => (c as any).text)
              .join(" ");
          }
        } else {
          responseText = "I'm sorry, I couldn't process that request.";
        }

        // Detect intent and extract action
        const intent = detectIntent(transcript.toLowerCase());
        const action = extractAction(transcript.toLowerCase(), intent);

        return {
          success: true,
          response: responseText,
          intent,
          action,
        };
      } catch (error: any) {
        console.error("Voice processing error:", error);
        throw new Error(`Failed to process voice command: ${error.message}`);
      }
    }),

  /**
   * Get supported voice commands
   */
  getCommands: protectedProcedure.query(async () => {
    return {
      success: true,
      commands: [
        {
          intent: "check_balance",
          examples: [
            "What's my balance?",
            "How much money do I have?",
            "Check my account",
          ],
        },
        {
          intent: "send_money",
          examples: [
            "Send $50 to John",
            "Transfer $100 to Sarah",
            "Pay Alice $25",
          ],
        },
        {
          intent: "view_transactions",
          examples: [
            "Show my transactions",
            "What did I spend?",
            "Transaction history",
          ],
        },
        {
          intent: "check_goals",
          examples: [
            "How are my savings goals?",
            "Check my goals",
            "Savings progress",
          ],
        },
        {
          intent: "pay_bill",
          examples: [
            "Pay my electricity bill",
            "Make a bill payment",
            "Pay bills",
          ],
        },
      ],
    };
  }),
});

export default voiceRouter;
