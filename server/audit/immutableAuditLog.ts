import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface AuditEntry {
  id: string;
  sequence: number;
  timestamp: Date;
  eventType: AuditEventType;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  previousHash: string;
  hash: string;
  signature?: string;
}

export type AuditEventType = 
  | 'authentication'
  | 'authorization'
  | 'transaction'
  | 'payout'
  | 'reversal'
  | 'refund'
  | 'configuration'
  | 'admin_action'
  | 'data_access'
  | 'key_operation'
  | 'compliance'
  | 'security_event';

export interface AuditActor {
  type: 'user' | 'service' | 'system' | 'admin';
  id: string;
  name?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
  attributes?: Record<string, any>;
}

export interface ForensicExportOptions {
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  actorId?: string;
  resourceId?: string;
  redactPII?: boolean;
}

export interface ForensicExport {
  id: string;
  exportedAt: Date;
  filters: ForensicExportOptions;
  entries: AuditEntry[];
  integrityVerified: boolean;
  exportedBy: string;
}

const auditLog: AuditEntry[] = [];
let sequenceNumber = 0;
const GENESIS_HASH = '0'.repeat(64);

export class ImmutableAuditLog extends EventEmitter {
  private signingKey: Buffer;

  constructor() {
    super();
    this.signingKey = crypto.randomBytes(32);
  }

  async log(params: {
    eventType: AuditEventType;
    actor: AuditActor;
    resource: AuditResource;
    action: string;
    outcome: 'success' | 'failure' | 'partial';
    details: Record<string, any>;
    correlationId?: string;
  }): Promise<AuditEntry> {
    const sequence = ++sequenceNumber;
    const previousHash = auditLog.length > 0 
      ? auditLog[auditLog.length - 1].hash 
      : GENESIS_HASH;

    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      sequence,
      timestamp: new Date(),
      eventType: params.eventType,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      outcome: params.outcome,
      details: {
        ...params.details,
        correlationId: params.correlationId
      },
      previousHash,
      hash: ''
    };

    entry.hash = this.calculateHash(entry);
    entry.signature = this.sign(entry.hash);

    auditLog.push(entry);
    this.emit('entryLogged', entry);

    if (params.eventType === 'security_event' || params.outcome === 'failure') {
      this.emit('alertableEvent', entry);
    }

    return entry;
  }

  private calculateHash(entry: Omit<AuditEntry, 'hash' | 'signature'>): string {
    const data = JSON.stringify({
      id: entry.id,
      sequence: entry.sequence,
      timestamp: entry.timestamp.toISOString(),
      eventType: entry.eventType,
      actor: entry.actor,
      resource: entry.resource,
      action: entry.action,
      outcome: entry.outcome,
      details: entry.details,
      previousHash: entry.previousHash
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private sign(hash: string): string {
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(hash);
    return hmac.digest('hex');
  }

  verifyIntegrity(): { valid: boolean; brokenAt?: number; error?: string } {
    if (auditLog.length === 0) {
      return { valid: true };
    }

    let previousHash = GENESIS_HASH;

    for (let i = 0; i < auditLog.length; i++) {
      const entry = auditLog[i];

      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          brokenAt: i,
          error: `Chain broken at sequence ${entry.sequence}: previousHash mismatch`
        };
      }

      const calculatedHash = this.calculateHash({
        id: entry.id,
        sequence: entry.sequence,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        actor: entry.actor,
        resource: entry.resource,
        action: entry.action,
        outcome: entry.outcome,
        details: entry.details,
        previousHash: entry.previousHash
      });

      if (entry.hash !== calculatedHash) {
        return {
          valid: false,
          brokenAt: i,
          error: `Hash mismatch at sequence ${entry.sequence}: entry may have been tampered`
        };
      }

      previousHash = entry.hash;
    }

    return { valid: true };
  }

  query(options: {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: AuditEventType[];
    actorId?: string;
    actorType?: AuditActor['type'];
    resourceType?: string;
    resourceId?: string;
    outcome?: AuditEntry['outcome'];
    correlationId?: string;
    limit?: number;
    offset?: number;
  }): AuditEntry[] {
    let results = [...auditLog];

    if (options.startDate) {
      results = results.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter(e => e.timestamp <= options.endDate!);
    }
    if (options.eventTypes?.length) {
      results = results.filter(e => options.eventTypes!.includes(e.eventType));
    }
    if (options.actorId) {
      results = results.filter(e => e.actor.id === options.actorId);
    }
    if (options.actorType) {
      results = results.filter(e => e.actor.type === options.actorType);
    }
    if (options.resourceType) {
      results = results.filter(e => e.resource.type === options.resourceType);
    }
    if (options.resourceId) {
      results = results.filter(e => e.resource.id === options.resourceId);
    }
    if (options.outcome) {
      results = results.filter(e => e.outcome === options.outcome);
    }
    if (options.correlationId) {
      results = results.filter(e => e.details.correlationId === options.correlationId);
    }

    const offset = options.offset || 0;
    const limit = options.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async forensicExport(options: ForensicExportOptions, exportedBy: string): Promise<ForensicExport> {
    let entries = this.query({
      startDate: options.startDate,
      endDate: options.endDate,
      eventTypes: options.eventTypes,
      actorId: options.actorId,
      resourceId: options.resourceId,
      correlationId: options.correlationId
    });

    if (options.redactPII) {
      entries = entries.map(e => this.redactPII(e));
    }

    const integrity = this.verifyIntegrity();

    const exportRecord: ForensicExport = {
      id: crypto.randomUUID(),
      exportedAt: new Date(),
      filters: options,
      entries,
      integrityVerified: integrity.valid,
      exportedBy
    };

    await this.log({
      eventType: 'data_access',
      actor: { type: 'admin', id: exportedBy },
      resource: { type: 'audit_log', id: 'forensic_export' },
      action: 'forensic_export',
      outcome: 'success',
      details: {
        exportId: exportRecord.id,
        entryCount: entries.length,
        filters: options
      }
    });

    return exportRecord;
  }

  private redactPII(entry: AuditEntry): AuditEntry {
    const piiFields = ['email', 'phone', 'bvn', 'nin', 'accountNumber', 'pan', 'name', 'address'];
    
    const redactObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (piiFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = redactObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    return {
      ...entry,
      actor: {
        ...entry.actor,
        name: entry.actor.name ? '[REDACTED]' : undefined,
        ip: entry.actor.ip ? '[REDACTED]' : undefined
      },
      details: redactObject(entry.details)
    };
  }

  getStats(): {
    totalEntries: number;
    byEventType: Record<string, number>;
    byOutcome: Record<string, number>;
    byActorType: Record<string, number>;
    integrityStatus: boolean;
  } {
    const byEventType: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byActorType: Record<string, number> = {};

    for (const entry of auditLog) {
      byEventType[entry.eventType] = (byEventType[entry.eventType] || 0) + 1;
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
      byActorType[entry.actor.type] = (byActorType[entry.actor.type] || 0) + 1;
    }

    return {
      totalEntries: auditLog.length,
      byEventType,
      byOutcome,
      byActorType,
      integrityStatus: this.verifyIntegrity().valid
    };
  }

  generateReport(startDate: Date, endDate: Date): string {
    const entries = this.query({ startDate, endDate });
    const stats = this.getStats();
    const integrity = this.verifyIntegrity();

    const lines: string[] = [
      '='.repeat(70),
      'IMMUTABLE AUDIT LOG REPORT',
      '='.repeat(70),
      '',
      `Generated: ${new Date().toISOString()}`,
      `Period: ${startDate.toISOString()} - ${endDate.toISOString()}`,
      `Integrity Status: ${integrity.valid ? 'VERIFIED' : 'COMPROMISED'}`,
      '',
      '-'.repeat(70),
      'SUMMARY',
      '-'.repeat(70),
      `Total Entries: ${entries.length}`,
      '',
      'By Event Type:',
      ...Object.entries(stats.byEventType).map(([k, v]) => `  ${k}: ${v}`),
      '',
      'By Outcome:',
      ...Object.entries(stats.byOutcome).map(([k, v]) => `  ${k}: ${v}`),
      '',
      '='.repeat(70),
      'END OF REPORT',
      '='.repeat(70)
    ];

    return lines.join('\n');
  }
}

let auditLogInstance: ImmutableAuditLog | null = null;

export function getImmutableAuditLog(): ImmutableAuditLog {
  if (!auditLogInstance) {
    auditLogInstance = new ImmutableAuditLog();
  }
  return auditLogInstance;
}

export default ImmutableAuditLog;
