# Enhanced KYC/KYB Module

Comprehensive Know Your Customer / Know Your Business system for the Unified Insurance Platform.

## Architecture

```
enhanced-kyc-kyb/
├── aml-screening/          # Anti-Money Laundering screening against OFAC, UN, EU sanctions lists
├── ballerine-integration/  # Ballerine open-source KYC orchestration platform
├── deployments/            # Kubernetes deployment manifests
├── document-verification/  # NIN, BVN, passport, driver's license OCR & verification
├── liveness-detection/     # Biometric liveness detection (anti-spoofing)
├── ocr-service/            # Document OCR using Tesseract + Google Vision API
└── risk-scoring/           # KYC risk scoring engine (Low/Medium/High/Very High)
```

## Integration Points

- **tRPC Router**: `kyc` router in `customer-portal-full/server/routers.ts`
- **DB Methods**: `getKYCStatus()`, `createKYCVerification()` in `server/db.ts`
- **K8s Service**: `k8s/base/services/kyc-orchestrator.yaml` (port 8097)
- **External APIs**: NIMC NIN API, NIBSS BVN API, CAC Business Registry

## Compliance

Meets NAICOM KYC requirements, CBN AML/CFT guidelines, and NDPR data protection standards.
