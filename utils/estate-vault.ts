import AsyncStorage from "@react-native-async-storage/async-storage";

export interface EstateDocument {
  id: string;
  type: "will" | "trust" | "power_of_attorney" | "healthcare_directive" | "beneficiary" | "other";
  name: string;
  description: string;
  fileUri: string;
  uploadDate: number;
  lastModified: number;
  sharedWith: string[]; // email addresses
  beneficiaries: Beneficiary[];
  notificationSent: boolean;
}

export interface Beneficiary {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  percentage: number; // percentage of estate
  documentIds: string[]; // documents they're named in
  notified: boolean;
}

export interface SharedAccess {
  documentId: string;
  sharedWith: string;
  sharedDate: number;
  accessLevel: "view" | "edit";
  expiresAt?: number;
}

const DOCUMENTS_STORAGE_KEY = "estate_documents";
const BENEFICIARIES_STORAGE_KEY = "estate_beneficiaries";
const SHARED_ACCESS_STORAGE_KEY = "estate_shared_access";

export async function loadEstateDocuments(): Promise<EstateDocument[]> {
  try {
    const data = await AsyncStorage.getItem(DOCUMENTS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load estate documents:", error);
    return [];
  }
}

export async function saveEstateDocument(document: EstateDocument): Promise<void> {
  try {
    const documents = await loadEstateDocuments();
    const index = documents.findIndex((d) => d.id === document.id);
    if (index >= 0) {
      documents[index] = document;
    } else {
      documents.push(document);
    }
    await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
  } catch (error) {
    console.error("Failed to save estate document:", error);
    throw error;
  }
}

export async function deleteEstateDocument(documentId: string): Promise<void> {
  try {
    const documents = await loadEstateDocuments();
    const filtered = documents.filter((d) => d.id !== documentId);
    await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(filtered));

    // Also remove shared access for this document
    const sharedAccess = await loadSharedAccess();
    const filteredAccess = sharedAccess.filter((s) => s.documentId !== documentId);
    await AsyncStorage.setItem(SHARED_ACCESS_STORAGE_KEY, JSON.stringify(filteredAccess));
  } catch (error) {
    console.error("Failed to delete estate document:", error);
    throw error;
  }
}

export async function loadBeneficiaries(): Promise<Beneficiary[]> {
  try {
    const data = await AsyncStorage.getItem(BENEFICIARIES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load beneficiaries:", error);
    return [];
  }
}

export async function saveBeneficiary(beneficiary: Beneficiary): Promise<void> {
  try {
    const beneficiaries = await loadBeneficiaries();
    const index = beneficiaries.findIndex((b) => b.id === beneficiary.id);
    if (index >= 0) {
      beneficiaries[index] = beneficiary;
    } else {
      beneficiaries.push(beneficiary);
    }
    await AsyncStorage.setItem(BENEFICIARIES_STORAGE_KEY, JSON.stringify(beneficiaries));
  } catch (error) {
    console.error("Failed to save beneficiary:", error);
    throw error;
  }
}

export async function deleteBeneficiary(beneficiaryId: string): Promise<void> {
  try {
    const beneficiaries = await loadBeneficiaries();
    const filtered = beneficiaries.filter((b) => b.id !== beneficiaryId);
    await AsyncStorage.setItem(BENEFICIARIES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete beneficiary:", error);
    throw error;
  }
}

export async function loadSharedAccess(): Promise<SharedAccess[]> {
  try {
    const data = await AsyncStorage.getItem(SHARED_ACCESS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load shared access:", error);
    return [];
  }
}

export async function shareDocument(
  documentId: string,
  email: string,
  accessLevel: "view" | "edit",
  expiresInDays?: number
): Promise<void> {
  try {
    const sharedAccess = await loadSharedAccess();
    const newAccess: SharedAccess = {
      documentId,
      sharedWith: email,
      sharedDate: Date.now(),
      accessLevel,
      expiresAt: expiresInDays ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : undefined,
    };
    sharedAccess.push(newAccess);
    await AsyncStorage.setItem(SHARED_ACCESS_STORAGE_KEY, JSON.stringify(sharedAccess));

    // Update document's sharedWith list
    const documents = await loadEstateDocuments();
    const document = documents.find((d) => d.id === documentId);
    if (document && !document.sharedWith.includes(email)) {
      document.sharedWith.push(email);
      await saveEstateDocument(document);
    }
  } catch (error) {
    console.error("Failed to share document:", error);
    throw error;
  }
}

export async function revokeAccess(documentId: string, email: string): Promise<void> {
  try {
    const sharedAccess = await loadSharedAccess();
    const filtered = sharedAccess.filter(
      (s) => !(s.documentId === documentId && s.sharedWith === email)
    );
    await AsyncStorage.setItem(SHARED_ACCESS_STORAGE_KEY, JSON.stringify(filtered));

    // Update document's sharedWith list
    const documents = await loadEstateDocuments();
    const document = documents.find((d) => d.id === documentId);
    if (document) {
      document.sharedWith = document.sharedWith.filter((e) => e !== email);
      await saveEstateDocument(document);
    }
  } catch (error) {
    console.error("Failed to revoke access:", error);
    throw error;
  }
}

export async function notifyBeneficiaries(documentId: string): Promise<void> {
  try {
    const documents = await loadEstateDocuments();
    const document = documents.find((d) => d.id === documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Mark all beneficiaries as notified
    const beneficiaries = await loadBeneficiaries();
    for (const beneficiary of document.beneficiaries) {
      const ben = beneficiaries.find((b) => b.id === beneficiary.id);
      if (ben) {
        ben.notified = true;
        await saveBeneficiary(ben);
      }
    }

    // Mark document as notification sent
    document.notificationSent = true;
    await saveEstateDocument(document);
  } catch (error) {
    console.error("Failed to notify beneficiaries:", error);
    throw error;
  }
}

export function getDocumentTypeLabel(type: EstateDocument["type"]): string {
  switch (type) {
    case "will":
      return "Last Will & Testament";
    case "trust":
      return "Trust Document";
    case "power_of_attorney":
      return "Power of Attorney";
    case "healthcare_directive":
      return "Healthcare Directive";
    case "beneficiary":
      return "Beneficiary Designation";
    case "other":
      return "Other Document";
  }
}

export function getDocumentTypeIcon(type: EstateDocument["type"]): string {
  switch (type) {
    case "will":
      return "📜";
    case "trust":
      return "🏛️";
    case "power_of_attorney":
      return "⚖️";
    case "healthcare_directive":
      return "🏥";
    case "beneficiary":
      return "👥";
    case "other":
      return "📄";
  }
}

export function validateBeneficiaryPercentages(beneficiaries: Beneficiary[]): boolean {
  const total = beneficiaries.reduce((sum, b) => sum + b.percentage, 0);
  return Math.abs(total - 100) < 0.01; // Allow for floating point errors
}

export function calculateEstateValue(documents: EstateDocument[]): number {
  // This is a placeholder - in a real app, you'd integrate with actual asset values
  return 0;
}

export async function generateEstateReport(): Promise<string> {
  try {
    const documents = await loadEstateDocuments();
    const beneficiaries = await loadBeneficiaries();

    let report = "Estate Planning Report\n";
    report += "======================\n\n";
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    report += `Total Documents: ${documents.length}\n`;
    report += `Total Beneficiaries: ${beneficiaries.length}\n\n`;

    report += "Documents:\n";
    for (const doc of documents) {
      report += `- ${doc.name} (${getDocumentTypeLabel(doc.type)})\n`;
      report += `  Uploaded: ${new Date(doc.uploadDate).toLocaleDateString()}\n`;
      report += `  Shared with: ${doc.sharedWith.length} people\n`;
      report += `  Beneficiaries: ${doc.beneficiaries.length}\n\n`;
    }

    report += "Beneficiaries:\n";
    for (const ben of beneficiaries) {
      report += `- ${ben.name} (${ben.relationship})\n`;
      report += `  Email: ${ben.email}\n`;
      report += `  Phone: ${ben.phone}\n`;
      report += `  Estate Share: ${ben.percentage}%\n`;
      report += `  Documents: ${ben.documentIds.length}\n`;
      report += `  Notified: ${ben.notified ? "Yes" : "No"}\n\n`;
    }

    return report;
  } catch (error) {
    console.error("Failed to generate estate report:", error);
    throw error;
  }
}

export function isAccessExpired(access: SharedAccess): boolean {
  if (!access.expiresAt) {
    return false;
  }
  return Date.now() > access.expiresAt;
}

export async function cleanupExpiredAccess(): Promise<void> {
  try {
    const sharedAccess = await loadSharedAccess();
    const active = sharedAccess.filter((s) => !isAccessExpired(s));
    await AsyncStorage.setItem(SHARED_ACCESS_STORAGE_KEY, JSON.stringify(active));
  } catch (error) {
    console.error("Failed to cleanup expired access:", error);
  }
}
