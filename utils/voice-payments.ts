import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export interface VoicePaymentCommand {
  type: "payment" | "bill" | "transfer" | "unknown";
  amount?: number;
  recipient?: string;
  billType?: string;
  confidence: number;
  rawCommand: string;
}

const PAYMENT_KEYWORDS = ["send", "pay", "transfer", "give"];
const BILL_KEYWORDS = ["bill", "electricity", "water", "internet", "phone", "cable", "gas"];
const AMOUNT_PATTERNS = [
  /(\d+(?:\.\d{2})?)\s*(?:dollars?|usd|ngn|naira|kes|shillings?|zar|rand|ghs|cedis?)/i,
  /\$(\d+(?:\.\d{2})?)/,
  /₦(\d+(?:\.\d{2})?)/,
];

export function parseVoicePaymentCommand(command: string): VoicePaymentCommand {
  const lowerCommand = command.toLowerCase().trim();
  
  // Extract amount
  let amount: number | undefined;
  for (const pattern of AMOUNT_PATTERNS) {
    const match = lowerCommand.match(pattern);
    if (match) {
      amount = parseFloat(match[1]);
      break;
    }
  }

  // Check if it's a bill payment
  const isBill = BILL_KEYWORDS.some((keyword) => lowerCommand.includes(keyword));
  if (isBill) {
    const billType = BILL_KEYWORDS.find((keyword) => lowerCommand.includes(keyword));
    return {
      type: "bill",
      amount,
      billType,
      confidence: amount ? 0.9 : 0.6,
      rawCommand: command,
    };
  }

  // Check if it's a payment
  const isPayment = PAYMENT_KEYWORDS.some((keyword) => lowerCommand.includes(keyword));
  if (isPayment) {
    // Extract recipient name
    let recipient: string | undefined;
    
    // Try to find "to [name]" pattern
    const toMatch = lowerCommand.match(/to\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (toMatch) {
      recipient = toMatch[1].trim();
    }

    // Try to find name after payment keyword
    if (!recipient) {
      for (const keyword of PAYMENT_KEYWORDS) {
        const regex = new RegExp(`${keyword}\\s+([a-z]+(?:\\s+[a-z]+)?)`, "i");
        const match = lowerCommand.match(regex);
        if (match) {
          recipient = match[1].trim();
          break;
        }
      }
    }

    return {
      type: "payment",
      amount,
      recipient,
      confidence: amount && recipient ? 0.95 : amount || recipient ? 0.7 : 0.5,
      rawCommand: command,
    };
  }

  // Unknown command
  return {
    type: "unknown",
    confidence: 0,
    rawCommand: command,
  };
}

export function formatVoicePaymentConfirmation(command: VoicePaymentCommand): string {
  if (command.type === "payment") {
    if (command.amount && command.recipient) {
      return `I'll help you send $${command.amount.toFixed(2)} to ${command.recipient}. Please confirm this payment.`;
    } else if (command.amount) {
      return `I heard you want to send $${command.amount.toFixed(2)}, but I couldn't identify the recipient. Who would you like to send this to?`;
    } else if (command.recipient) {
      return `I heard you want to send money to ${command.recipient}, but I couldn't identify the amount. How much would you like to send?`;
    }
  } else if (command.type === "bill") {
    if (command.amount && command.billType) {
      return `I'll help you pay your ${command.billType} bill of $${command.amount.toFixed(2)}. Please confirm this payment.`;
    } else if (command.billType) {
      return `I heard you want to pay your ${command.billType} bill, but I couldn't identify the amount. How much is the bill?`;
    }
  }

  return "I'm sorry, I couldn't understand that payment command. Please try again or use the manual payment screen.";
}

export async function executeVoicePayment(command: VoicePaymentCommand): Promise<{
  success: boolean;
  message: string;
  navigationPath?: string;
}> {
  // Validate command
  if (command.confidence < 0.6) {
    return {
      success: false,
      message: "I'm not confident I understood your command correctly. Please try again or use the manual payment screen.",
    };
  }

  if (command.type === "payment") {
    if (!command.amount || !command.recipient) {
      return {
        success: false,
        message: formatVoicePaymentConfirmation(command),
      };
    }

    // Store pending payment for confirmation
    await AsyncStorage.setItem(
      "pending_voice_payment",
      JSON.stringify({
        amount: command.amount,
        recipient: command.recipient,
        timestamp: Date.now(),
      })
    );

    return {
      success: true,
      message: `Navigating to payment confirmation for $${command.amount.toFixed(2)} to ${command.recipient}.`,
      navigationPath: "/(payment)/send",
    };
  } else if (command.type === "bill") {
    if (!command.amount || !command.billType) {
      return {
        success: false,
        message: formatVoicePaymentConfirmation(command),
      };
    }

    // Store pending bill payment for confirmation
    await AsyncStorage.setItem(
      "pending_voice_bill",
      JSON.stringify({
        amount: command.amount,
        billType: command.billType,
        timestamp: Date.now(),
      })
    );

    return {
      success: true,
      message: `Navigating to bill payment for your ${command.billType} bill of $${command.amount.toFixed(2)}.`,
      navigationPath: "/(bills)/pay",
    };
  }

  return {
    success: false,
    message: "I couldn't process that payment command. Please try again.",
  };
}

export async function getPendingVoicePayment(): Promise<{
  amount: number;
  recipient: string;
  timestamp: number;
} | null> {
  try {
    const data = await AsyncStorage.getItem("pending_voice_payment");
    if (!data) return null;

    const payment = JSON.parse(data);
    
    // Check if payment is still valid (within 5 minutes)
    if (Date.now() - payment.timestamp > 5 * 60 * 1000) {
      await AsyncStorage.removeItem("pending_voice_payment");
      return null;
    }

    return payment;
  } catch (error) {
    console.error("Failed to get pending voice payment:", error);
    return null;
  }
}

export async function clearPendingVoicePayment(): Promise<void> {
  await AsyncStorage.removeItem("pending_voice_payment");
}

export async function getPendingVoiceBill(): Promise<{
  amount: number;
  billType: string;
  timestamp: number;
} | null> {
  try {
    const data = await AsyncStorage.getItem("pending_voice_bill");
    if (!data) return null;

    const bill = JSON.parse(data);
    
    // Check if bill is still valid (within 5 minutes)
    if (Date.now() - bill.timestamp > 5 * 60 * 1000) {
      await AsyncStorage.removeItem("pending_voice_bill");
      return null;
    }

    return bill;
  } catch (error) {
    console.error("Failed to get pending voice bill:", error);
    return null;
  }
}

export async function clearPendingVoiceBill(): Promise<void> {
  await AsyncStorage.removeItem("pending_voice_bill");
}

// Example voice commands for testing
export const EXAMPLE_COMMANDS = [
  "Send $50 to John",
  "Pay $100 to Sarah",
  "Transfer 500 naira to Michael",
  "Give $25 to mom",
  "Pay electricity bill $75",
  "Pay my water bill 50 dollars",
  "Send internet bill payment $60",
  "Pay phone bill",
];

export function getVoicePaymentHelp(): string {
  return `You can use voice commands to make payments. Here are some examples:

• "Send $50 to John" - Send money to a contact
• "Pay electricity bill $75" - Pay a utility bill
• "Transfer 500 naira to Sarah" - Transfer money with currency
• "Give $25 to mom" - Send money to family

I'll confirm the details before processing any payment.`;
}
