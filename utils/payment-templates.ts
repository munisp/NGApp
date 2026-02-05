import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PaymentTemplate {
  id: string;
  name: string;
  recipient_name: string;
  recipient_account: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  created_at: number;
  last_used?: number;
  use_count: number;
  is_favorite: boolean;
  schedule?: {
    enabled: boolean;
    frequency: "once" | "daily" | "weekly" | "monthly";
    next_execution: number;
    last_execution?: number;
  };
}

const TEMPLATES_STORAGE_KEY = "payment_templates";

/**
 * Get all payment templates
 */
export async function getPaymentTemplates(): Promise<PaymentTemplate[]> {
  try {
    const templatesJson = await AsyncStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!templatesJson) return [];
    return JSON.parse(templatesJson);
  } catch (error) {
    console.error("Failed to get payment templates:", error);
    return [];
  }
}

/**
 * Save payment templates
 */
async function savePaymentTemplates(templates: PaymentTemplate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save payment templates:", error);
    throw error;
  }
}

/**
 * Create a new payment template
 */
export async function createPaymentTemplate(template: Omit<PaymentTemplate, "id" | "created_at" | "use_count" | "is_favorite">): Promise<PaymentTemplate> {
  const templates = await getPaymentTemplates();
  
  const newTemplate: PaymentTemplate = {
    ...template,
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: Date.now(),
    use_count: 0,
    is_favorite: false,
  };
  
  templates.push(newTemplate);
  await savePaymentTemplates(templates);
  
  return newTemplate;
}

/**
 * Update an existing payment template
 */
export async function updatePaymentTemplate(templateId: string, updates: Partial<PaymentTemplate>): Promise<PaymentTemplate | null> {
  const templates = await getPaymentTemplates();
  const index = templates.findIndex((t) => t.id === templateId);
  
  if (index === -1) return null;
  
  templates[index] = { ...templates[index], ...updates };
  await savePaymentTemplates(templates);
  
  return templates[index];
}

/**
 * Delete a payment template
 */
export async function deletePaymentTemplate(templateId: string): Promise<boolean> {
  const templates = await getPaymentTemplates();
  const filtered = templates.filter((t) => t.id !== templateId);
  
  if (filtered.length === templates.length) return false;
  
  await savePaymentTemplates(filtered);
  return true;
}

/**
 * Toggle template favorite status
 */
export async function toggleTemplateFavorite(templateId: string): Promise<boolean> {
  const templates = await getPaymentTemplates();
  const template = templates.find((t) => t.id === templateId);
  
  if (!template) return false;
  
  template.is_favorite = !template.is_favorite;
  await savePaymentTemplates(templates);
  
  return template.is_favorite;
}

/**
 * Record template usage
 */
export async function recordTemplateUsage(templateId: string): Promise<void> {
  const templates = await getPaymentTemplates();
  const template = templates.find((t) => t.id === templateId);
  
  if (!template) return;
  
  template.use_count++;
  template.last_used = Date.now();
  
  await savePaymentTemplates(templates);
}

/**
 * Get favorite templates
 */
export async function getFavoriteTemplates(): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  return templates.filter((t) => t.is_favorite);
}

/**
 * Get recently used templates
 */
export async function getRecentTemplates(limit: number = 5): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  return templates
    .filter((t) => t.last_used)
    .sort((a, b) => (b.last_used || 0) - (a.last_used || 0))
    .slice(0, limit);
}

/**
 * Get most used templates
 */
export async function getMostUsedTemplates(limit: number = 5): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  return templates
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, limit);
}

/**
 * Search templates by name or recipient
 */
export async function searchTemplates(query: string): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  const lowerQuery = query.toLowerCase();
  
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.recipient_name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(category: string): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  return templates.filter((t) => t.category === category);
}

/**
 * Create template from transaction
 */
export async function createTemplateFromTransaction(transaction: {
  recipient: string;
  amount: number;
  description: string;
  category?: string;
}): Promise<PaymentTemplate> {
  return await createPaymentTemplate({
    name: `Payment to ${transaction.recipient}`,
    recipient_name: transaction.recipient,
    recipient_account: "", // Would be filled from transaction details
    amount: transaction.amount,
    currency: "$",
    description: transaction.description,
    category: transaction.category || "other",
  });
}

/**
 * Update template schedule
 */
export async function updateTemplateSchedule(
  templateId: string,
  schedule: PaymentTemplate["schedule"]
): Promise<boolean> {
  const templates = await getPaymentTemplates();
  const template = templates.find((t) => t.id === templateId);
  
  if (!template) return false;
  
  template.schedule = schedule;
  await savePaymentTemplates(templates);
  
  return true;
}

/**
 * Get scheduled templates
 */
export async function getScheduledTemplates(): Promise<PaymentTemplate[]> {
  const templates = await getPaymentTemplates();
  return templates.filter((t) => t.schedule?.enabled);
}

/**
 * Get templates due for execution
 */
export async function getTemplatesDueForExecution(): Promise<PaymentTemplate[]> {
  const scheduled = await getScheduledTemplates();
  const now = Date.now();
  
  return scheduled.filter((t) => t.schedule && t.schedule.next_execution <= now);
}

/**
 * Calculate next execution time
 */
export function calculateNextExecution(frequency: "once" | "daily" | "weekly" | "monthly", currentTime: number = Date.now()): number {
  const date = new Date(currentTime);
  
  switch (frequency) {
    case "once":
      return currentTime;
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
  }
  
  return date.getTime();
}

/**
 * Execute scheduled template
 */
export async function executeScheduledTemplate(templateId: string): Promise<boolean> {
  const templates = await getPaymentTemplates();
  const template = templates.find((t) => t.id === templateId);
  
  if (!template || !template.schedule?.enabled) return false;
  
  // Update last execution
  template.schedule.last_execution = Date.now();
  
  // Calculate next execution
  if (template.schedule.frequency !== "once") {
    template.schedule.next_execution = calculateNextExecution(template.schedule.frequency);
  } else {
    // Disable one-time schedules after execution
    template.schedule.enabled = false;
  }
  
  // Update use count
  template.use_count++;
  template.last_used = Date.now();
  
  await savePaymentTemplates(templates);
  
  return true;
}

/**
 * Get template statistics
 */
export async function getTemplateStatistics(): Promise<{
  total: number;
  favorites: number;
  scheduled: number;
  most_used: PaymentTemplate | null;
  total_usage: number;
  average_amount: number;
}> {
  const templates = await getPaymentTemplates();
  
  const stats = {
    total: templates.length,
    favorites: templates.filter((t) => t.is_favorite).length,
    scheduled: templates.filter((t) => t.schedule?.enabled).length,
    most_used: templates.length > 0 ? templates.reduce((a, b) => (a.use_count > b.use_count ? a : b)) : null,
    total_usage: templates.reduce((sum, t) => sum + t.use_count, 0),
    average_amount: templates.length > 0 ? templates.reduce((sum, t) => sum + t.amount, 0) / templates.length : 0,
  };
  
  return stats;
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(templateId: string): Promise<PaymentTemplate | null> {
  const templates = await getPaymentTemplates();
  const template = templates.find((t) => t.id === templateId);
  
  if (!template) return null;
  
  const duplicate = await createPaymentTemplate({
    name: `${template.name} (Copy)`,
    recipient_name: template.recipient_name,
    recipient_account: template.recipient_account,
    amount: template.amount,
    currency: template.currency,
    description: template.description,
    category: template.category,
    schedule: template.schedule,
  });
  
  return duplicate;
}

/**
 * Export templates to JSON
 */
export async function exportTemplates(): Promise<string> {
  const templates = await getPaymentTemplates();
  return JSON.stringify(templates, null, 2);
}

/**
 * Import templates from JSON
 */
export async function importTemplates(jsonData: string): Promise<number> {
  try {
    const importedTemplates: PaymentTemplate[] = JSON.parse(jsonData);
    const existingTemplates = await getPaymentTemplates();
    
    // Merge templates, avoiding duplicates by ID
    const existingIds = new Set(existingTemplates.map((t) => t.id));
    const newTemplates = importedTemplates.filter((t) => !existingIds.has(t.id));
    
    const merged = [...existingTemplates, ...newTemplates];
    await savePaymentTemplates(merged);
    
    return newTemplates.length;
  } catch (error) {
    console.error("Failed to import templates:", error);
    throw new Error("Invalid template data");
  }
}
