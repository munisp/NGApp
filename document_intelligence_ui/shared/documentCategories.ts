/**
 * Document categories supported by the platform
 */
export const DOCUMENT_CATEGORIES = {
  citizenship_identity: {
    id: "citizenship_identity",
    label: "Citizenship & Identity",
    description: "Birth certificates, passports, naturalization documents",
    icon: "👤",
  },
  immigration_status: {
    id: "immigration_status",
    label: "Immigration Status",
    description: "Visas, green cards, work permits, I-94 forms",
    icon: "🛂",
  },
  income_employment: {
    id: "income_employment",
    label: "Income & Employment",
    description: "Pay stubs, W-2 forms, tax returns, employment verification",
    icon: "💼",
  },
  tribal_aian: {
    id: "tribal_aian",
    label: "Tribal/AIAN Documentation",
    description: "Tribal enrollment certificates, AIAN status documents",
    icon: "🪶",
  },
  employer_health_coverage: {
    id: "employer_health_coverage",
    label: "Employer Health Coverage",
    description: "Insurance cards, coverage letters, benefit summaries",
    icon: "🏥",
  },
  household_relationship: {
    id: "household_relationship",
    label: "Household & Relationship",
    description: "Marriage certificates, divorce decrees, custody documents",
    icon: "👨‍👩‍👧‍👦",
  },
  other_supporting: {
    id: "other_supporting",
    label: "Other Supporting Documents",
    description: "Address verification, utility bills, bank statements",
    icon: "📄",
  },
} as const;

export type DocumentCategoryId = keyof typeof DOCUMENT_CATEGORIES;

export const DOCUMENT_CATEGORY_IDS = Object.keys(
  DOCUMENT_CATEGORIES
) as DocumentCategoryId[];

/**
 * Document processing status
 */
export const DOCUMENT_STATUS = {
  pending: {
    id: "pending",
    label: "Pending",
    color: "gray",
    description: "Waiting to be processed",
  },
  processing: {
    id: "processing",
    label: "Processing",
    color: "blue",
    description: "OCR in progress",
  },
  completed: {
    id: "completed",
    label: "Completed",
    color: "green",
    description: "Processing complete",
  },
  failed: {
    id: "failed",
    label: "Failed",
    color: "red",
    description: "Processing failed",
  },
} as const;

export type DocumentStatusId = keyof typeof DOCUMENT_STATUS;
