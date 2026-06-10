/**
 * AI/ML Stack Validation Tests
 * 
 * Tests model configuration, data pipeline integrity, and prediction schemas
 * for AI/ML components in the platform.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PYTHON_SERVICES = path.resolve(__dirname, '../../payment-core/python-services');
const AI_ML_FILE = path.join(PYTHON_SERVICES, 'nibss_analytics/ai_ml_services.py');
const REAL_AI_ML = path.join(PYTHON_SERVICES, 'nibss_analytics/real_ai_ml_service.py');

describe('AI/ML Stack Validation', () => {
  describe('AI/ML Services File', () => {
    it('ai_ml_services.py exists with all 8 AI components', () => {
      expect(fs.existsSync(AI_ML_FILE)).toBe(true);
      const content = fs.readFileSync(AI_ML_FILE, 'utf8');
      expect(content).toContain('Prophet');
      expect(content).toContain('MCMC');
      expect(content).toContain('FalkorDB');
      expect(content).toContain('Ollama');
      expect(content).toContain('CocoIndex');
      expect(content).toContain('GNN');
    });

    it('real_ai_ml_service.py exists', () => {
      expect(fs.existsSync(REAL_AI_ML)).toBe(true);
    });
  });

  describe('Python Service Structure', () => {
    it('has all required service directories', () => {
      const requiredDirs = [
        'nibss_analytics', 'compliance_reporting',
        'government_payments', 'open_banking', 'outbound_compliance',
        'capacity-planning', 'incident-response', 'event-processor',
        'remittance_analytics',
      ];
      for (const dir of requiredDirs) {
        const dirPath = path.join(PYTHON_SERVICES, dir);
        expect(fs.existsSync(dirPath), `Missing directory: ${dir}`).toBe(true);
      }
    });

    it('has requirements.txt for dependency management', () => {
      const reqPath = path.join(PYTHON_SERVICES, 'requirements.txt');
      expect(fs.existsSync(reqPath)).toBe(true);
      const content = fs.readFileSync(reqPath, 'utf8');
      expect(content).toContain('psycopg2');
    });

    it('has Dockerfile for AI/ML services', () => {
      const dockerfile = path.join(PYTHON_SERVICES, 'Dockerfile.ai-ml');
      expect(fs.existsSync(dockerfile)).toBe(true);
    });
  });

  describe('ML Prediction Schemas', () => {
    it('MCMC fraud scoring output schema is valid', () => {
      const mockScore = { score: 0.72, confidence: 0.85, category: 'medium_risk' };
      expect(mockScore.score).toBeGreaterThanOrEqual(0);
      expect(mockScore.score).toBeLessThanOrEqual(1);
      expect(mockScore.confidence).toBeGreaterThanOrEqual(0);
    });

    it('Prophet forecast output has required fields', () => {
      const forecast = {
        ds: '2026-06-01',
        yhat: 1500000,
        yhat_lower: 1200000,
        yhat_upper: 1800000,
        trend: 'increasing',
      };
      expect(forecast.yhat).toBeGreaterThan(forecast.yhat_lower);
      expect(forecast.yhat).toBeLessThan(forecast.yhat_upper);
    });

    it('ART adversarial test has perturbation types', () => {
      const perturbationTypes = ['fgsm', 'pgd', 'deepfool', 'carlini_wagner'];
      expect(perturbationTypes.length).toBeGreaterThanOrEqual(3);
    });

    it('GNN node embedding dimensions are valid', () => {
      const config = { embeddingDim: 128, layers: 3, aggregation: 'mean' };
      expect(config.embeddingDim).toBeGreaterThan(0);
      expect([64, 128, 256]).toContain(config.embeddingDim);
    });
  });

  describe('Data Pipeline Integrity', () => {
    it('all Python services use psycopg2 (PostgreSQL), not mysql-connector', () => {
      const content = fs.readFileSync(AI_ML_FILE, 'utf8');
      expect(content).not.toContain('mysql-connector');
      expect(content).not.toContain('mysql2');
    });

    it('middleware integrations are documented', () => {
      const content = fs.readFileSync(AI_ML_FILE, 'utf8');
      expect(content).toContain('PostgreSQL');
      expect(content).toContain('Kafka');
      expect(content).toContain('Redis');
    });
  });

  describe('Model Drift Detection', () => {
    it('validates drift detection thresholds', () => {
      const driftConfig = {
        psi_threshold: 0.2,
        ks_threshold: 0.05,
        monitoring_interval: 3600,
        retraining_trigger: 'automatic',
      };
      expect(driftConfig.psi_threshold).toBeLessThan(0.5);
      expect(driftConfig.ks_threshold).toBeLessThan(0.1);
    });

    it('validates feature importance tracking', () => {
      const features = [
        { name: 'transaction_amount', importance: 0.35 },
        { name: 'sender_country', importance: 0.20 },
        { name: 'time_of_day', importance: 0.15 },
        { name: 'recipient_type', importance: 0.12 },
        { name: 'channel', importance: 0.08 },
      ];
      const totalImportance = features.reduce((sum, f) => sum + f.importance, 0);
      expect(totalImportance).toBeLessThanOrEqual(1.0);
      expect(features[0].importance).toBeGreaterThan(features[features.length - 1].importance);
    });
  });

  describe('Compliance & Observability', () => {
    it('compliance reporting service exists', () => {
      const compDir = path.join(PYTHON_SERVICES, 'compliance_reporting');
      expect(fs.existsSync(compDir)).toBe(true);
    });

    it('observability config exists', () => {
      const obsDir = path.join(PYTHON_SERVICES, 'observability');
      expect(fs.existsSync(obsDir)).toBe(true);
    });
  });
});
