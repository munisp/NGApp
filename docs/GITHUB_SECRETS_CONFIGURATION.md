# GitHub Secrets Configuration

This document describes all GitHub secrets required for CI/CD pipeline automation.

## Required Secrets

### Docker Hub Credentials

**`DOCKER_USERNAME`**
- **Description**: Docker Hub username for pushing container images
- **How to obtain**: Your Docker Hub account username
- **Example**: `mycompany`

**`DOCKER_PASSWORD`**
- **Description**: Docker Hub password or access token
- **How to obtain**: Docker Hub account settings → Security → New Access Token
- **Recommended**: Use access token instead of password for better security

### Kubernetes Configuration

**`KUBE_CONFIG_STAGING`**
- **Description**: Base64-encoded kubeconfig file for staging Kubernetes cluster
- **How to obtain**:
  ```bash
  cat ~/.kube/config | base64 -w 0
  ```
- **Format**: Base64-encoded YAML kubeconfig file

**`KUBE_CONFIG_PRODUCTION`**
- **Description**: Base64-encoded kubeconfig file for production Kubernetes cluster
- **How to obtain**:
  ```bash
  cat ~/.kube/config-prod | base64 -w 0
  ```
- **Format**: Base64-encoded YAML kubeconfig file

### Notification Configuration

**`SLACK_WEBHOOK`**
- **Description**: Slack webhook URL for deployment notifications
- **How to obtain**:
  1. Go to Slack App Directory
  2. Search for "Incoming Webhooks"
  3. Add to your workspace
  4. Create new webhook for your channel
- **Format**: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

### Database Credentials (Optional)

**`DATABASE_URL_STAGING`**
- **Description**: PostgreSQL connection string for staging database
- **Format**: `postgresql://user:password@host:5432/database`

**`DATABASE_URL_PRODUCTION`**
- **Description**: PostgreSQL connection string for production database
- **Format**: `postgresql://user:password@host:5432/database`

### API Keys (Optional)

**`TIGERBEETLE_CLUSTER_ID`**
- **Description**: TigerBeetle cluster identifier
- **Format**: Integer (e.g., `1`)

**`TEMPORAL_HOST`**
- **Description**: Temporal server host for workflow execution
- **Format**: `temporal.example.com:7233`

**`KAFKA_BROKERS`**
- **Description**: Comma-separated list of Kafka broker addresses
- **Format**: `kafka-1:9092,kafka-2:9092,kafka-3:9092`

**`PERMIFY_API_URL`**
- **Description**: Permify authorization service URL
- **Format**: `http://permify:3476`

**`WAZUH_API_URL`**
- **Description**: Wazuh SIEM API URL
- **Format**: `https://wazuh:55000`

**`WAZUH_API_USER`**
- **Description**: Wazuh API username
- **Format**: `admin`

**`WAZUH_API_PASSWORD`**
- **Description**: Wazuh API password
- **Format**: Strong password

## How to Configure Secrets

### Via GitHub Web Interface

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # macOS
# or
sudo apt install gh  # Ubuntu

# Authenticate
gh auth login

# Add secrets
gh secret set DOCKER_USERNAME --body "mycompany"
gh secret set DOCKER_PASSWORD --body "dckr_pat_xxxxxxxxxxxx"
gh secret set KUBE_CONFIG_STAGING --body "$(cat ~/.kube/config | base64 -w 0)"
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/..."
```

### Bulk Import via Script

```bash
#!/bin/bash
# save as import-secrets.sh

gh secret set DOCKER_USERNAME < secrets/docker-username.txt
gh secret set DOCKER_PASSWORD < secrets/docker-password.txt
gh secret set KUBE_CONFIG_STAGING < secrets/kube-staging-base64.txt
gh secret set KUBE_CONFIG_PRODUCTION < secrets/kube-prod-base64.txt
gh secret set SLACK_WEBHOOK < secrets/slack-webhook.txt
```

## Security Best Practices

1. **Never commit secrets to Git**: Always use GitHub Secrets or environment variables
2. **Use access tokens**: Prefer API tokens over passwords when available
3. **Rotate secrets regularly**: Change secrets every 90 days
4. **Limit secret access**: Use environment-specific secrets (staging vs production)
5. **Audit secret usage**: Review GitHub Actions logs for unauthorized access
6. **Use least privilege**: Grant minimum required permissions for each secret

## Verification

After configuring secrets, verify they are set correctly:

```bash
# List all secrets (values are hidden)
gh secret list

# Test CI/CD pipeline
git commit --allow-empty -m "Test CI/CD"
git push origin develop
```

Check GitHub Actions tab to see if the workflow runs successfully.

## Troubleshooting

### Secret not found error

**Error**: `Error: Secret DOCKER_USERNAME not found`

**Solution**: Verify secret name matches exactly (case-sensitive)

### Base64 decoding error

**Error**: `Error: illegal base64 data at input byte`

**Solution**: Re-encode kubeconfig without line wraps:
```bash
cat ~/.kube/config | base64 -w 0 > kube-config-base64.txt
```

### Docker push permission denied

**Error**: `Error: denied: requested access to the resource is denied`

**Solution**: 
1. Verify Docker Hub username and password/token are correct
2. Ensure the repository exists on Docker Hub
3. Check Docker Hub account has push permissions

### Kubernetes authentication failed

**Error**: `Error: error: You must be logged in to the server (Unauthorized)`

**Solution**:
1. Verify kubeconfig is valid: `kubectl --kubeconfig=./config get nodes`
2. Re-encode kubeconfig: `cat config | base64 -w 0`
3. Update GitHub secret with new value

## Support

For issues with GitHub Secrets configuration:
- GitHub Docs: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- GitHub CLI: https://cli.github.com/manual/gh_secret
- Contact DevOps team: devops@example.com
