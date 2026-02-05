import { Router } from 'express';
import { z } from 'zod';
import { invokeLLM, type Message } from '../_core/llm.js';

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).optional(),
  userContext: z.object({
    totalBalance: z.number().optional(),
    monthlyIncome: z.number().optional(),
    monthlyExpenses: z.number().optional(),
    savingsGoals: z.number().optional(),
  }).optional(),
});

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory, userContext } = chatRequestSchema.parse(req.body);

    // Build system prompt with user context
    let systemPrompt = `You are a professional financial advisor AI assistant. Provide helpful, accurate, and personalized financial advice.

Guidelines:
- Be concise and actionable
- Use simple language, avoid jargon
- Provide specific recommendations when possible
- Always consider the user's financial situation
- Encourage responsible financial behavior
- Remind users to consult licensed professionals for major decisions`;

    if (userContext) {
      systemPrompt += `\n\nUser's Financial Context:`;
      if (userContext.totalBalance !== undefined) {
        systemPrompt += `\n- Total Balance: $${userContext.totalBalance.toLocaleString()}`;
      }
      if (userContext.monthlyIncome !== undefined) {
        systemPrompt += `\n- Monthly Income: $${userContext.monthlyIncome.toLocaleString()}`;
      }
      if (userContext.monthlyExpenses !== undefined) {
        systemPrompt += `\n- Monthly Expenses: $${userContext.monthlyExpenses.toLocaleString()}`;
      }
      if (userContext.savingsGoals !== undefined) {
        systemPrompt += `\n- Savings Goals: $${userContext.savingsGoals.toLocaleString()}`;
      }
    }

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })));
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call LLM
    const response = await invokeLLM({
      messages: messages as Message[],
    });

    // Extract message from response
    const choice = response.choices?.[0];
    let assistantMessage = '';
    
    if (choice?.message?.content) {
      if (typeof choice.message.content === 'string') {
        assistantMessage = choice.message.content;
      } else if (Array.isArray(choice.message.content)) {
        assistantMessage = choice.message.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');
      }
    }

    res.json({
      message: assistantMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI advisor chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

export default router;
