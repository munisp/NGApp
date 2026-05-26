# GitHub Actions Setup Guide

## Quick Start

This guide helps you set up continuous integration for the Next-Generation Payment Switch platform using GitHub Actions.

---

## 📋 Prerequisites

- GitHub repository for the project
- Docker installed locally (for testing)
- Admin access to repository settings

---

## 🚀 Setup Steps

### Step 1: Add Workflow Files

Copy the workflow files to your repository:

```bash
# Create workflows directory
mkdir -p .github/workflows

# Copy workflow files
cp api-tests.yml .github/workflows/
cp scheduled-api-tests.yml .github/workflows/
cp README.md .github/workflows/
```

### Step 2: Verify Required Files

Ensure these files exist in your repository root:

```
✓ docker-compose.yml
✓ .env.example
✓ test_payment_switch_api.py
✓ .github/workflows/api-tests.yml
✓ .github/workflows/scheduled-api-tests.yml
```

### Step 3: Configure GitHub Permissions

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   - Select **"Read and write permissions"**
   - Check **"Allow GitHub Actions to create and approve pull requests"**
3. Click **Save**

### Step 4: Commit and Push

```bash
git add .github/
git commit -m "Add GitHub Actions CI/CD workflows"
git push origin main
```

### Step 5: Verify Workflow

1. Go to **Actions** tab in GitHub
2. You should see "API Tests" workflow running
3. Wait for completion (~5-10 minutes)
4. Check for green checkmark ✅

---

## 📊 Workflow Overview

### API Tests Workflow

**File**: `.github/workflows/api-tests.yml`

**Triggers**:
- ✅ Push to `main` or `develop`
- ✅ Pull requests to `main` or `develop`
- ✅ Manual trigger

**Steps**:
1. Checkout code
2. Setup Python 3.11
3. Start Docker services
4. Wait for services to be healthy
5. Run 7 API tests
6. Generate test report
7. Comment on PR (if applicable)
8. Upload artifacts
9. Fail build if tests fail

**Duration**: 5-10 minutes

---

### Scheduled Tests Workflow

**File**: `.github/workflows/scheduled-api-tests.yml`

**Triggers**:
- ⏰ Daily at 2 AM UTC
- ✅ Manual trigger

**Steps**:
1. Run API tests
2. Upload results (90-day retention)
3. Create GitHub issue if tests fail

**Duration**: 5-10 minutes

---

## 🔍 Viewing Results

### In GitHub UI

1. Go to **Actions** tab
2. Click on workflow run
3. Click on job name ("Run API Tests")
4. View output in console

### Test Summary

Look for this section in the logs:

```
=== Summary ===
Total Tests: 7
Passed: 7
Failed: 0
Success Rate: 100.0%
```

### Download Artifacts

1. Scroll to bottom of workflow run page
2. Click on "api-test-results" or "api-test-report"
3. Download ZIP file
4. Extract and view JSON/Markdown files

---

## 📝 Pull Request Integration

When you create a PR, the workflow will:

1. ✅ Run all API tests automatically
2. 💬 Comment on PR with results
3. ✅ Show status check (pass/fail)
4. 🚫 Block merge if tests fail (if branch protection enabled)

**Example PR Comment**:

```markdown
## 🧪 API Test Results

**Workflow**: API Tests
**Run**: #42
**Commit**: abc123...
**Branch**: feature/new-endpoint

## Test Results

- **Total Tests**: 7
- **Passed**: ✅ 7
- **Failed**: ❌ 0
- **Success Rate**: 100.0%

## Test Details

| Test | Status | Latency (ms) |
|------|--------|--------------|
| Health Check | ✅ PASS | 45.23 |
| Initiate Payment - Positive | ✅ PASS | 123.45 |
| Initiate Payment - Missing Fields | ✅ PASS | 34.12 |
| Initiate Payment - Invalid Types | ✅ PASS | 28.67 |
| Fraud Score Check | ✅ PASS | 67.89 |
| Payment Status Check | ✅ PASS | 34.56 |
| Create Settlement Window | ✅ PASS | 89.12 |
```

---

## 🔧 Configuration

### Change Python Version

Edit workflow file:

```yaml
env:
  PYTHON_VERSION: '3.12'  # Change from 3.11
```

### Change Test Frequency

Edit `scheduled-api-tests.yml`:

```yaml
on:
  schedule:
    # Every 6 hours
    - cron: '0 */6 * * *'
    
    # Every Monday at 9 AM
    - cron: '0 9 * * 1'
```

### Add More Triggers

```yaml
on:
  push:
    branches:
      - main
      - develop
      - staging  # Add staging branch
  pull_request:
    branches:
      - main
```

---

## 🎯 Branch Protection

### Recommended Settings

1. Go to **Settings** → **Branches**
2. Click **Add rule** for `main` branch
3. Enable:
   - ✅ Require status checks to pass
   - ✅ Require "Run API Tests" check
   - ✅ Require branches to be up to date
   - ✅ Require pull request reviews (1 approver)
4. Click **Create**

This ensures:
- All PRs must pass API tests
- Code review required before merge
- Branch must be up-to-date with main

---

## 🐛 Troubleshooting

### Tests Fail Locally But Pass in CI

**Cause**: Environment differences

**Solution**:
```bash
# Test with same environment
docker-compose up -d
python3 test_payment_switch_api.py
docker-compose down -v
```

### Services Don't Start

**Cause**: Docker resource limits

**Solution**: Add to workflow:
```yaml
- name: Free up disk space
  run: |
    docker system prune -af
    df -h
```

### Timeout Waiting for Services

**Cause**: Services take too long to start

**Solution**: Increase timeout in workflow:
```yaml
- name: Wait for services to be healthy
  run: |
    timeout=600  # Increase from 300 to 600 seconds
```

### Permission Denied Errors

**Cause**: Workflow doesn't have write permissions

**Solution**: Check Settings → Actions → General → Workflow permissions

---

## 📈 Monitoring

### View Test History

```bash
# Using GitHub CLI
gh run list --workflow=api-tests.yml --limit 20

# View specific run
gh run view <run-id>

# Download results
gh run download <run-id> --name api-test-results
```

### Analyze Trends

1. Go to Actions tab
2. Select "API Tests" workflow
3. View run history
4. Look for patterns in failures

### Set Up Notifications

Add to workflow:

```yaml
- name: Send notification
  if: failure()
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -H 'Content-Type: application/json' \
      -d '{"text": "API tests failed on ${{ github.ref_name }}"}'
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Workflow files committed to `.github/workflows/`
- [ ] Workflow appears in Actions tab
- [ ] Workflow runs on push to main
- [ ] Tests pass successfully
- [ ] Artifacts uploaded
- [ ] PR comments working (test with PR)
- [ ] Branch protection enabled (optional)
- [ ] Scheduled workflow configured
- [ ] Team notified of setup

---

## 🎓 Best Practices

### Do ✅

- Run tests on every PR
- Keep test suite fast (<10 min)
- Upload test artifacts
- Use branch protection
- Monitor test trends
- Fix flaky tests immediately

### Don't ❌

- Skip tests on main branch
- Ignore test failures
- Commit secrets to workflows
- Use `continue-on-error` for critical tests
- Run tests without health checks

---

## 📚 Additional Resources

### Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose in CI](https://docs.docker.com/compose/ci/)
- [Test Script README](TEST_SCRIPT_README.md)

### Workflow Files
- `.github/workflows/api-tests.yml` - Main CI workflow
- `.github/workflows/scheduled-api-tests.yml` - Scheduled tests
- `.github/workflows/README.md` - Detailed documentation

### Test Files
- `test_payment_switch_api.py` - Test script
- `docker-compose.yml` - Service orchestration
- `.env.example` - Environment template

---

## 🆘 Getting Help

### Workflow Issues

1. Check workflow run logs
2. Review Docker service logs
3. Test locally with Docker
4. Check GitHub Actions status

### Test Failures

1. Download test results artifact
2. Review JSON output
3. Run tests locally with `--verbose`
4. Check service logs

### Questions

- Review `.github/workflows/README.md`
- Check GitHub Actions documentation
- Test locally before pushing

---

## 🎉 Success Criteria

Your CI/CD is working when:

✅ Tests run automatically on every push
✅ PRs show test status
✅ Failed tests block merges
✅ Test results are uploaded
✅ Team receives notifications
✅ Scheduled tests run daily
✅ Test history is tracked

---

## 📊 Example Workflow Run

```
Workflow: API Tests
Trigger: push to main
Duration: 7m 23s
Status: ✅ Success

Jobs:
  Run API Tests (7m 23s) ✅
    ├─ Checkout code (3s) ✅
    ├─ Set up Python (12s) ✅
    ├─ Install dependencies (8s) ✅
    ├─ Start services (2m 15s) ✅
    ├─ Wait for services (1m 30s) ✅
    ├─ Run API tests (45s) ✅
    ├─ Display results (2s) ✅
    ├─ Upload artifacts (15s) ✅
    ├─ Generate report (5s) ✅
    └─ Stop services (10s) ✅

Artifacts:
  📦 api-test-results (2.1 KB)
  📦 api-test-report (1.8 KB)

Test Results:
  Total: 7
  Passed: 7 ✅
  Failed: 0
  Success Rate: 100%
```

---

**Status**: ✅ Ready for production use
**Version**: 1.0
**Last Updated**: 2024-11-03
