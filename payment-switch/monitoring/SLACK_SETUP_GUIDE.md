# Slack Webhook Setup Guide

This guide walks you through setting up Slack notifications for Grafana alerts.

## Prerequisites

- Slack workspace with admin access
- Grafana instance running

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Choose **From scratch**
4. Name: `Payment Switch Alerts`
5. Select your workspace
6. Click **Create App**

## Step 2: Enable Incoming Webhooks

1. In your app settings, click **Incoming Webhooks** in the sidebar
2. Toggle **Activate Incoming Webhooks** to **On**
3. Click **Add New Webhook to Workspace**
4. Select the channel where alerts should be posted (e.g., `#payment-switch-alerts`)
5. Click **Allow**

## Step 3: Copy Webhook URL

You'll see a webhook URL like:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**Important:** Keep this URL secret! It allows anyone to post to your channel.

## Step 4: Configure Grafana

### Option A: Environment Variable (Recommended)

Add to your `.env` or docker-compose.yml:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### Option B: Grafana UI

1. Go to **Alerting** > **Notification channels**
2. Click **Add channel**
3. Name: `Slack Alerts`
4. Type: **Slack**
5. Webhook URL: Paste your webhook URL
6. Settings:
   - Recipient: `#payment-switch-alerts`
   - Username: `Grafana Alert Bot`
   - Icon Emoji: `:warning:`
   - Mention: `@channel` or `@here` for urgent alerts
7. Click **Test** to verify
8. Click **Save**

## Step 5: Test Notification

### From Grafana UI:

1. Go to the notification channel you created
2. Click **Test**
3. Check your Slack channel for the test message

### From Command Line:

```bash
curl -X POST \
  https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test alert from Payment Switch",
    "username": "Grafana Alert Bot",
    "icon_emoji": ":warning:",
    "attachments": [{
      "color": "danger",
      "title": "High Error Rate Detected",
      "text": "Payment processing error rate exceeded 5%",
      "fields": [
        {
          "title": "Service",
          "value": "Payment Gateway",
          "short": true
        },
        {
          "title": "Error Rate",
          "value": "7.2%",
          "short": true
        }
      ],
      "footer": "Payment Switch Monitoring",
      "ts": 1234567890
    }]
  }'
```

## Step 6: Customize Alert Messages

Edit `monitoring/grafana/provisioning/alerting/notification-channels.yaml`:

```yaml
- name: Slack Alerts
  type: slack
  settings:
    recipient: "#payment-switch-alerts"
    username: "Grafana Alert Bot"
    icon_emoji: ":warning:"
    # Mention @channel for critical alerts
    mentionChannel: "here"
    # Upload alert graph images
    uploadImage: true
```

## Alert Message Format

Grafana sends alerts to Slack with this structure:

```
🚨 [ALERTING] High Error Rate
State: alerting
Message: Payment processing error rate exceeded 5%

Current value: 7.2%
Threshold: 5%

View in Grafana: [link]
```

## Best Practices

### 1. Create Multiple Channels

- `#payment-switch-alerts` - All alerts
- `#payment-switch-critical` - Critical only (use PagerDuty integration)
- `#payment-switch-warnings` - Non-critical warnings

### 2. Use Alert Severity Levels

Configure different channels for different severities:

```yaml
# Critical alerts - mention @channel
- name: Slack Critical
  type: slack
  settings:
    recipient: "#payment-switch-critical"
    mentionChannel: "channel"

# Warnings - no mentions
- name: Slack Warnings
  type: slack
  settings:
    recipient: "#payment-switch-warnings"
    mentionChannel: ""
```

### 3. Set Notification Frequency

Avoid alert fatigue by setting reminder frequency:

```yaml
send_reminder: true
frequency: 30m  # Send reminder every 30 minutes if alert still firing
```

### 4. Use Silence Rules

For planned maintenance, create silence rules in Grafana:
1. Go to **Alerting** > **Silences**
2. Click **New silence**
3. Set duration and matcher (e.g., `alertname=HighErrorRate`)
4. Add comment: "Planned maintenance"

## Troubleshooting

### Webhook URL Not Working

- Verify the URL is complete and correct
- Check if the Slack app is still installed in your workspace
- Regenerate webhook if compromised

### Messages Not Appearing

- Check channel permissions
- Verify the bot is added to the channel
- Test with curl command first

### Alert Fatigue

- Increase alert thresholds
- Add evaluation delays: `for: 5m`
- Use notification frequency limits
- Create silence rules during maintenance

## Security

### Protect Webhook URL

- Store in environment variables, never commit to git
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate webhook if exposed

### Limit Access

- Only grant webhook creation to admins
- Use private channels for sensitive alerts
- Consider using Slack Enterprise Grid for advanced security

## Advanced: Custom Alert Bot

For more control, create a custom Slack bot:

1. Go to https://api.slack.com/apps
2. Create new app
3. Add **Bot Token Scopes**: `chat:write`, `chat:write.public`
4. Install app to workspace
5. Use Bot User OAuth Token instead of webhook URL

This allows:
- Posting to any channel without pre-configuration
- Updating/deleting messages
- Adding reactions to alerts
- Threading related alerts

## Example Alert Configurations

### High Error Rate

```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
    service: payment-gateway
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

### Service Down

```yaml
- alert: ServiceDown
  expr: up{job="payment-gateway"} == 0
  for: 1m
  labels:
    severity: critical
    service: payment-gateway
  annotations:
    summary: "Service {{ $labels.instance }} is down"
    description: "Payment gateway has been down for more than 1 minute"
```

## Resources

- [Slack API Documentation](https://api.slack.com/messaging/webhooks)
- [Grafana Slack Integration](https://grafana.com/docs/grafana/latest/alerting/notifications/)
- [Slack Message Formatting](https://api.slack.com/reference/surfaces/formatting)
