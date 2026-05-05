use std::time::Instant;

use anyhow::Result;
use chrono::Utc;
use reqwest::Client;
use serde_json::json;
use tracing::{info, warn};

use crate::models::{Channel, SendRequest, SendResult, DeliveryStatus};

/// Channel dispatcher routes messages to the appropriate provider API
pub struct ChannelDispatcher {
    http_client: Client,
    sms_api_url: String,
    whatsapp_api_url: String,
    telegram_bot_token: String,
    email_api_url: String,
    voice_api_url: String,
}

impl ChannelDispatcher {
    pub fn new() -> Self {
        Self {
            http_client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .pool_max_idle_per_host(20)
                .build()
                .expect("Failed to create HTTP client"),
            sms_api_url: std::env::var("SMS_API_URL")
                .unwrap_or_else(|_| "http://localhost:8090/api/v1/sms".to_string()),
            whatsapp_api_url: std::env::var("WHATSAPP_API_URL")
                .unwrap_or_else(|_| "http://localhost:8091/api/v1/whatsapp".to_string()),
            telegram_bot_token: std::env::var("TELEGRAM_BOT_TOKEN")
                .unwrap_or_default(),
            email_api_url: std::env::var("EMAIL_API_URL")
                .unwrap_or_else(|_| "http://localhost:8092/api/v1/email".to_string()),
            voice_api_url: std::env::var("VOICE_API_URL")
                .unwrap_or_else(|_| "http://localhost:8093/api/v1/voice".to_string()),
        }
    }

    /// Dispatch a message to the appropriate channel provider
    pub async fn send(&self, request: &SendRequest) -> SendResult {
        let start = Instant::now();

        let result = match request.channel {
            Channel::Sms => self.send_sms(request).await,
            Channel::Whatsapp => self.send_whatsapp(request).await,
            Channel::Telegram => self.send_telegram(request).await,
            Channel::Email => self.send_email(request).await,
            Channel::Voice => self.send_voice(request).await,
            Channel::Ussd => self.send_ussd(request).await,
        };

        let latency_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(provider_msg_id) => SendResult {
                request_id: request.id.clone(),
                campaign_id: request.campaign_id.clone(),
                recipient_id: request.recipient_id.clone(),
                channel: request.channel.clone(),
                status: DeliveryStatus::Sent,
                provider_message_id: Some(provider_msg_id),
                error_message: None,
                latency_ms,
                timestamp: Utc::now(),
            },
            Err(e) => SendResult {
                request_id: request.id.clone(),
                campaign_id: request.campaign_id.clone(),
                recipient_id: request.recipient_id.clone(),
                channel: request.channel.clone(),
                status: DeliveryStatus::Failed,
                provider_message_id: None,
                error_message: Some(e.to_string()),
                latency_ms,
                timestamp: Utc::now(),
            },
        }
    }

    async fn send_sms(&self, request: &SendRequest) -> Result<String> {
        let payload = json!({
            "to": request.recipient,
            "message": request.content,
            "campaign_id": request.campaign_id,
            "recipient_id": request.recipient_id,
        });

        let resp = self.http_client
            .post(&format!("{}/send", self.sms_api_url))
            .json(&payload)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("SMS API error: {}", body);
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body["message_id"].as_str().unwrap_or("unknown").to_string())
    }

    async fn send_whatsapp(&self, request: &SendRequest) -> Result<String> {
        let mut payload = json!({
            "to": request.recipient,
            "type": "text",
            "text": { "body": request.content },
            "campaign_id": request.campaign_id,
        });

        if let Some(ref template_id) = request.template_id {
            payload = json!({
                "to": request.recipient,
                "type": "template",
                "template": {
                    "name": template_id,
                    "language": { "code": "en" },
                    "components": request.template_params,
                },
                "campaign_id": request.campaign_id,
            });
        }

        let resp = self.http_client
            .post(&format!("{}/send", self.whatsapp_api_url))
            .json(&payload)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("WhatsApp API error: {}", body);
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body["message_id"].as_str().unwrap_or("unknown").to_string())
    }

    async fn send_telegram(&self, request: &SendRequest) -> Result<String> {
        if self.telegram_bot_token.is_empty() {
            anyhow::bail!("Telegram bot token not configured");
        }

        let api_url = format!(
            "https://api.telegram.org/bot{}/sendMessage",
            self.telegram_bot_token
        );

        let mut payload = json!({
            "chat_id": request.recipient,
            "text": request.content,
            "parse_mode": "HTML",
        });

        // Add inline keyboard if metadata contains buttons
        if let Some(ref metadata) = request.metadata {
            if let Some(buttons) = metadata.get("inline_keyboard") {
                payload["reply_markup"] = json!({
                    "inline_keyboard": buttons,
                });
            }
        }

        let resp = self.http_client
            .post(&api_url)
            .json(&payload)
            .send()
            .await?;

        let body: serde_json::Value = resp.json().await?;

        let ok = body["ok"].as_bool().unwrap_or(false);
        if !ok {
            let desc = body["description"].as_str().unwrap_or("Unknown error");
            anyhow::bail!("Telegram API error: {}", desc);
        }

        let msg_id = body["result"]["message_id"]
            .as_i64()
            .map(|id| id.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        Ok(msg_id)
    }

    async fn send_email(&self, request: &SendRequest) -> Result<String> {
        let payload = json!({
            "to": request.recipient,
            "subject": request.metadata
                .as_ref()
                .and_then(|m| m.get("subject"))
                .and_then(|s| s.as_str())
                .unwrap_or("Important Update"),
            "html_body": request.content,
            "campaign_id": request.campaign_id,
        });

        let resp = self.http_client
            .post(&format!("{}/send", self.email_api_url))
            .json(&payload)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Email API error: {}", body);
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body["message_id"].as_str().unwrap_or("unknown").to_string())
    }

    async fn send_voice(&self, request: &SendRequest) -> Result<String> {
        let payload = json!({
            "to": request.recipient,
            "script": request.content,
            "language": request.metadata
                .as_ref()
                .and_then(|m| m.get("language"))
                .and_then(|l| l.as_str())
                .unwrap_or("english"),
            "campaign_id": request.campaign_id,
            "trigger_type": "product_promotion",
        });

        let resp = self.http_client
            .post(&format!("{}/initiate", self.voice_api_url))
            .json(&payload)
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Voice API error: {}", body);
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body["call_id"].as_str().unwrap_or("unknown").to_string())
    }

    async fn send_ussd(&self, request: &SendRequest) -> Result<String> {
        // USSD push is provider-specific; log and skip if not configured
        warn!("USSD send not fully implemented, logging request: {}", request.id);
        Ok(format!("ussd-{}", request.id))
    }
}
