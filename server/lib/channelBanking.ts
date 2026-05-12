import type { Express } from "express";

interface ChannelService {
  path: string;
  port: number;
  topic: string;
  name: string;
}

const CHANNEL_SERVICES: ChannelService[] = [
  { path: "voice-banking-gateway", port: 8629, topic: "voice_banking_gateway", name: "voice-banking-gateway-go" },
  { path: "voice-tts-nigerian", port: 8630, topic: "voice_tts_nigerian", name: "voice-tts-nigerian-ru" },
  { path: "voice-asr-nigerian", port: 8631, topic: "voice_asr_nigerian", name: "voice-asr-nigerian-py" },
  { path: "voice-nlu-banking", port: 8632, topic: "voice_nlu_banking", name: "voice-nlu-banking-py" },
  { path: "voice-biometric-auth", port: 8633, topic: "voice_biometric_auth", name: "voice-biometric-auth-ru" },
  { path: "voice-ivr-menu", port: 8634, topic: "voice_ivr_menu", name: "voice-ivr-menu-go" },
  { path: "voice-call-analytics", port: 8635, topic: "voice_call_analytics", name: "voice-call-analytics-py" },
  { path: "voice-agent-escalation", port: 8636, topic: "voice_agent_escalation", name: "voice-agent-escalation-go" },
  { path: "telegram-bot-gateway", port: 8637, topic: "telegram_bot_gateway", name: "telegram-bot-gateway-go" },
  { path: "telegram-banking-commands", port: 8638, topic: "telegram_banking_commands", name: "telegram-banking-commands-ru" },
  { path: "telegram-notification", port: 8639, topic: "telegram_notification", name: "telegram-notification-py" },
  { path: "telegram-mini-app", port: 8640, topic: "telegram_mini_app", name: "telegram-mini-app-go" },
  { path: "telegram-kyc-bot", port: 8641, topic: "telegram_kyc_bot", name: "telegram-kyc-bot-ru" },
  { path: "whatsapp-business-gateway", port: 8642, topic: "whatsapp_business_gateway", name: "whatsapp-business-gateway-go" },
  { path: "whatsapp-banking-flows", port: 8643, topic: "whatsapp_banking_flows", name: "whatsapp-banking-flows-ru" },
  { path: "whatsapp-payment-integration", port: 8644, topic: "whatsapp_payment_integration", name: "whatsapp-payment-integration-go" },
  { path: "whatsapp-notification", port: 8645, topic: "whatsapp_notification", name: "whatsapp-notification-py" },
  { path: "whatsapp-document-service", port: 8646, topic: "whatsapp_document_service", name: "whatsapp-document-service-ru" },
  { path: "ussd-banking-gateway", port: 8647, topic: "ussd_banking_gateway", name: "ussd-banking-gateway-go" },
  { path: "ussd-transaction-engine", port: 8648, topic: "ussd_transaction_engine", name: "ussd-transaction-engine-ru" },
  { path: "ussd-multilingual", port: 8649, topic: "ussd_multilingual", name: "ussd-multilingual-py" },
  { path: "ussd-sim-toolkit", port: 8650, topic: "ussd_sim_toolkit", name: "ussd-sim-toolkit-go" },
  { path: "sms-banking-gateway", port: 8651, topic: "sms_banking_gateway", name: "sms-banking-gateway-go" },
  { path: "sms-otp-service", port: 8652, topic: "sms_otp_service", name: "sms-otp-service-ru" },
  { path: "sms-alert-notification", port: 8653, topic: "sms_alert_notification", name: "sms-alert-notification-py" },
];

const SEED_FALLBACK: Record<string, unknown[]> = {};

export function registerChannelBankingRoutes(app: Express): void {
  for (const svc of CHANNEL_SERVICES) {
    const listUrl = `http://localhost:${svc.port}/v1/${svc.topic}/list`;
    const healthUrl = `http://localhost:${svc.port}/healthz`;

    app.get(`/api/channel-banking/${svc.path}/list`, async (_req, res) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(listUrl, { signal: controller.signal as never });
        clearTimeout(timeout);
        const data = await resp.json();
        res.json(data);
      } catch {
        res.json({ data: SEED_FALLBACK[svc.topic] || [], total: 0, service: svc.name, fallback: true });
      }
    });

    app.get(`/api/channel-banking/${svc.path}/healthz`, async (_req, res) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(healthUrl, { signal: controller.signal as never });
        clearTimeout(timeout);
        const data = await resp.json();
        res.json(data);
      } catch {
        res.json({ status: "unavailable", service: svc.name, fallback: true });
      }
    });
  }
}
