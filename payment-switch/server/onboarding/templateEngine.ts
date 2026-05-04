/**
 * Template engine for webhook payload customization
 * Supports variable substitution with {{variable}} syntax
 */

export interface TemplateVariables {
  event: string;
  timestamp: string;
  credentialId: number;
  environment?: string;
  keyPreview?: string;
  expiresAt?: string;
  reason?: string;
  oldKeyPreview?: string;
  usageCount?: number;
  errorRate?: number;
  [key: string]: any;
}

/**
 * Default payload templates for each event type
 */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  "key.expiring": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      keyPreview: "{{keyPreview}}",
      expiresAt: "{{expiresAt}}",
      message: "API key {{keyPreview}} will expire on {{expiresAt}}",
    },
  }, null, 2),
  
  "key.expired": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      keyPreview: "{{keyPreview}}",
      message: "API key {{keyPreview}} has expired",
    },
  }, null, 2),
  
  "key.revoked": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      keyPreview: "{{keyPreview}}",
      reason: "{{reason}}",
      message: "API key {{keyPreview}} was revoked. Reason: {{reason}}",
    },
  }, null, 2),
  
  "key.rotated": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      oldKeyPreview: "{{oldKeyPreview}}",
      newKeyPreview: "{{keyPreview}}",
      message: "API key rotated from {{oldKeyPreview}} to {{keyPreview}}",
    },
  }, null, 2),
  
  "usage.threshold": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      keyPreview: "{{keyPreview}}",
      usageCount: "{{usageCount}}",
      message: "API key {{keyPreview}} has exceeded usage threshold with {{usageCount}} requests",
    },
  }, null, 2),
  
  "error.spike": JSON.stringify({
    event: "{{event}}",
    timestamp: "{{timestamp}}",
    data: {
      credentialId: "{{credentialId}}",
      environment: "{{environment}}",
      keyPreview: "{{keyPreview}}",
      errorRate: "{{errorRate}}",
      message: "API key {{keyPreview}} has high error rate: {{errorRate}}%",
    },
  }, null, 2),
};

/**
 * Get available variables for a specific event type
 */
export function getAvailableVariables(eventType: string): string[] {
  const commonVars = ["event", "timestamp", "credentialId", "environment", "keyPreview"];
  
  const eventSpecificVars: Record<string, string[]> = {
    "key.expiring": ["expiresAt"],
    "key.expired": [],
    "key.revoked": ["reason"],
    "key.rotated": ["oldKeyPreview"],
    "usage.threshold": ["usageCount"],
    "error.spike": ["errorRate"],
  };
  
  return [...commonVars, ...(eventSpecificVars[eventType] || [])];
}

/**
 * Render a template by replacing variables with actual values
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  let rendered = template;
  
  // Replace all {{variable}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const replacement = value !== undefined && value !== null ? String(value) : '';
    rendered = rendered.replace(regex, replacement);
  }
  
  return rendered;
}

/**
 * Validate template syntax
 */
export function validateTemplate(template: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check if template is valid JSON
  try {
    JSON.parse(renderTemplate(template, {
      event: "test",
      timestamp: new Date().toISOString(),
      credentialId: 1,
      environment: "sandbox",
      keyPreview: "sk_test_***",
    }));
  } catch (error) {
    errors.push("Template must be valid JSON after variable substitution");
  }
  
  // Check for unclosed variables
  const unclosedVars = template.match(/{{[^}]*$/g);
  if (unclosedVars) {
    errors.push("Template contains unclosed variables");
  }
  
  // Check for unopened variables
  const unopenedVars = template.match(/^[^{]*}}/g);
  if (unopenedVars) {
    errors.push("Template contains unopened variables");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get default template for an event type
 */
export function getDefaultTemplate(eventType: string): string {
  return DEFAULT_TEMPLATES[eventType] || DEFAULT_TEMPLATES["key.expiring"];
}

/**
 * Parse template and extract used variables
 */
export function extractVariables(template: string): string[] {
  const regex = /{{(\w+)}}/g;
  const variables = new Set<string>();
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1]);
  }
  
  return Array.from(variables);
}

/**
 * Render payload with template or use default
 */
export function renderPayload(
  eventType: string,
  variables: TemplateVariables,
  customTemplate?: string | null
): Record<string, any> {
  const template = customTemplate || getDefaultTemplate(eventType);
  const rendered = renderTemplate(template, variables);
  
  try {
    return JSON.parse(rendered);
  } catch (error) {
    // Fallback to default if custom template fails
    const defaultTemplate = getDefaultTemplate(eventType);
    const defaultRendered = renderTemplate(defaultTemplate, variables);
    return JSON.parse(defaultRendered);
  }
}
