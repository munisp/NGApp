// Language-specific onboarding configuration
// Customizes features, payment methods, and content based on user's language/region

export interface OnboardingConfig {
  language: string;
  region: string;
  currency: string;
  paymentMethods: PaymentMethod[];
  featuredServices: FeaturedService[];
  localPartners: string[];
  regulatoryInfo: RegulatoryInfo;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  popular: boolean;
}

export interface FeaturedService {
  id: string;
  title: string;
  description: string;
  icon: string;
  priority: number;
}

export interface RegulatoryInfo {
  kycRequired: boolean;
  minAge: number;
  dataProtectionLaw: string;
  regulatoryBody: string;
}

// English (Nigeria, Kenya, Ghana, South Africa)
export const englishOnboarding: OnboardingConfig = {
  language: "en",
  region: "West/East/Southern Africa",
  currency: "NGN/KES/GHS/ZAR",
  paymentMethods: [
    { id: "card", name: "Debit/Credit Card", icon: "💳", enabled: true, popular: true },
    { id: "bank_transfer", name: "Bank Transfer", icon: "🏦", enabled: true, popular: true },
    { id: "ussd", name: "USSD (*737#)", icon: "📱", enabled: true, popular: true },
    { id: "mobile_money", name: "Mobile Money", icon: "📲", enabled: true, popular: false },
    { id: "wallet", name: "Wallet", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "school_fees",
      title: "School Fees Installment",
      description: "Pay school fees in affordable monthly installments",
      icon: "🎓",
      priority: 1,
    },
    {
      id: "p2p_lending",
      title: "P2P Lending",
      description: "Borrow and lend within your community",
      icon: "🤝",
      priority: 2,
    },
    {
      id: "savings_circles",
      title: "Savings Circles",
      description: "Save together with friends and family",
      icon: "💰",
      priority: 3,
    },
    {
      id: "airtime_collateral",
      title: "Airtime as Collateral",
      description: "Get instant loans using your airtime balance",
      icon: "📞",
      priority: 4,
    },
    {
      id: "bill_splitting",
      title: "Bill Splitting",
      description: "Split bills easily with friends",
      icon: "🧾",
      priority: 5,
    },
  ],
  localPartners: [
    "GTBank", "Access Bank", "Zenith Bank", "First Bank",
    "MTN", "Airtel", "Glo", "9mobile",
    "Paystack", "Flutterwave"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "NDPR (Nigeria Data Protection Regulation)",
    regulatoryBody: "CBN (Central Bank of Nigeria)",
  },
};

// French (Senegal, Côte d'Ivoire, DRC, Cameroon)
export const frenchOnboarding: OnboardingConfig = {
  language: "fr",
  region: "West/Central Africa",
  currency: "XOF/XAF/CDF",
  paymentMethods: [
    { id: "mobile_money", name: "Mobile Money", icon: "📲", enabled: true, popular: true },
    { id: "orange_money", name: "Orange Money", icon: "🟠", enabled: true, popular: true },
    { id: "mtn_momo", name: "MTN Mobile Money", icon: "🟡", enabled: true, popular: true },
    { id: "bank_transfer", name: "Virement Bancaire", icon: "🏦", enabled: true, popular: false },
    { id: "card", name: "Carte Bancaire", icon: "💳", enabled: true, popular: false },
    { id: "wallet", name: "Portefeuille", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "remittance_credit",
      title: "Crédit Lié aux Envois de Fonds",
      description: "Construisez votre historique de crédit avec les envois de fonds",
      icon: "💸",
      priority: 1,
    },
    {
      id: "savings_circles",
      title: "Cercles d'Épargne",
      description: "Épargnez ensemble avec vos amis et votre famille",
      icon: "💰",
      priority: 2,
    },
    {
      id: "school_fees",
      title: "Frais Scolaires par Acomptes",
      description: "Payez les frais scolaires en mensualités abordables",
      icon: "🎓",
      priority: 3,
    },
    {
      id: "agricultural_insurance",
      title: "Assurance Agricole",
      description: "Protégez vos cultures avec une assurance intelligente",
      icon: "🌾",
      priority: 4,
    },
    {
      id: "mobile_clinic",
      title: "Plans de Paiement Clinique Mobile",
      description: "Accédez aux soins de santé avec des paiements flexibles",
      icon: "🏥",
      priority: 5,
    },
  ],
  localPartners: [
    "Orange Money", "MTN Mobile Money", "Moov Money",
    "Ecobank", "UBA", "Bank of Africa",
    "Wave", "CinetPay"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "RGPD (Règlement Général sur la Protection des Données)",
    regulatoryBody: "BCEAO (Banque Centrale des États de l'Afrique de l'Ouest)",
  },
};

// Swahili (Kenya, Tanzania, Uganda)
export const swahiliOnboarding: OnboardingConfig = {
  language: "sw",
  region: "East Africa",
  currency: "KES/TZS/UGX",
  paymentMethods: [
    { id: "mpesa", name: "M-Pesa", icon: "📱", enabled: true, popular: true },
    { id: "airtel_money", name: "Airtel Money", icon: "🔴", enabled: true, popular: true },
    { id: "tigopesa", name: "Tigo Pesa", icon: "🔵", enabled: true, popular: true },
    { id: "bank_transfer", name: "Uhamisho wa Benki", icon: "🏦", enabled: true, popular: false },
    { id: "card", name: "Kadi ya Benki", icon: "💳", enabled: true, popular: false },
    { id: "wallet", name: "Mkoba", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "agricultural_insurance",
      title: "Bima ya Kilimo",
      description: "Linda mazao yako na bima ya akili",
      icon: "🌾",
      priority: 1,
    },
    {
      id: "solar_financing",
      title: "Ufadhili wa Nishati ya Jua",
      description: "Lipa polepole kwa mfumo wa nishati ya jua",
      icon: "☀️",
      priority: 2,
    },
    {
      id: "water_as_service",
      title: "Malipo ya Maji kama Huduma",
      description: "Lipa maji unaotumia tu",
      icon: "💧",
      priority: 3,
    },
    {
      id: "savings_circles",
      title: "Vikundi vya Akiba",
      description: "Hifadhi pamoja na marafiki na familia",
      icon: "💰",
      priority: 4,
    },
    {
      id: "school_fees",
      title: "Malipo ya Ada za Shule",
      description: "Lipa ada za shule kwa awamu rahisi",
      icon: "🎓",
      priority: 5,
    },
  ],
  localPartners: [
    "M-Pesa (Safaricom)", "Airtel Money", "Tigo Pesa",
    "Equity Bank", "KCB", "CRDB Bank",
    "Flutterwave", "Pesapal"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "Data Protection Act 2019",
    regulatoryBody: "CBK (Central Bank of Kenya)",
  },
};

// Hausa (Northern Nigeria, Niger)
export const hausaOnboarding: OnboardingConfig = {
  language: "ha",
  region: "Northern Nigeria/Niger",
  currency: "NGN/XOF",
  paymentMethods: [
    { id: "ussd", name: "USSD (*737#)", icon: "📱", enabled: true, popular: true },
    { id: "bank_transfer", name: "Canja Kuɗi ta Banki", icon: "🏦", enabled: true, popular: true },
    { id: "card", name: "Katin Banki", icon: "💳", enabled: true, popular: false },
    { id: "mobile_money", name: "Kuɗin Wayar Hannu", icon: "📲", enabled: true, popular: true },
    { id: "wallet", name: "Jakar Kuɗi", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "agricultural_insurance",
      title: "Inshorar Noma",
      description: "Kare amfanin gonakinku da inshorar hankali",
      icon: "🌾",
      priority: 1,
    },
    {
      id: "livestock_registration",
      title: "Rajistar Dabbobi na Dijital",
      description: "Rajista dabbobin ku a tsare",
      icon: "🐄",
      priority: 2,
    },
    {
      id: "school_fees",
      title: "Kuɗin Makaranta a Kashi-Kashi",
      description: "Biya kuɗin makaranta a cikin kashi-kashi masu sauƙi",
      icon: "🎓",
      priority: 3,
    },
    {
      id: "savings_circles",
      title: "Ƙungiyoyin Ajiya",
      description: "Ajiye kuɗi tare da abokai da iyali",
      icon: "💰",
      priority: 4,
    },
    {
      id: "emergency_cash",
      title: "Kuɗin Gaggawa",
      description: "Samun kuɗin gaggawa lokacin buƙata",
      icon: "🚨",
      priority: 5,
    },
  ],
  localPartners: [
    "GTBank", "Access Bank", "Zenith Bank",
    "MTN", "Airtel", "Glo",
    "Paystack", "Flutterwave"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "NDPR (Dokar Kariyar Bayanai ta Najeriya)",
    regulatoryBody: "CBN (Babban Bankin Najeriya)",
  },
};

// Yoruba (Southwestern Nigeria)
export const yorubaOnboarding: OnboardingConfig = {
  language: "yo",
  region: "Southwestern Nigeria",
  currency: "NGN",
  paymentMethods: [
    { id: "ussd", name: "USSD (*737#)", icon: "📱", enabled: true, popular: true },
    { id: "bank_transfer", name: "Gbigbe Owo Banki", icon: "🏦", enabled: true, popular: true },
    { id: "card", name: "Kaadi Banki", icon: "💳", enabled: true, popular: true },
    { id: "mobile_money", name: "Owo Foonu Alagbeka", icon: "📲", enabled: true, popular: false },
    { id: "wallet", name: "Apo Owo", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "school_fees",
      title: "Owo Ile-iwe ni Ipin-Ipin",
      description: "San owo ile-iwe ni awon ipin to rọrun",
      icon: "🎓",
      priority: 1,
    },
    {
      id: "cooperative_purchasing",
      title: "Rira Ajọṣepọ Agbegbe",
      description: "Ra nkan papọ pẹlu awọn ọmọ ẹgbẹ",
      icon: "🛒",
      priority: 2,
    },
    {
      id: "savings_circles",
      title: "Awọn Ẹgbẹ Ifowopamọ",
      description: "Fi pamọ papọ pẹlu ọrẹ ati ẹbi",
      icon: "💰",
      priority: 3,
    },
    {
      id: "p2p_lending",
      title: "Iyawo Ati Yawo Agbegbe",
      description: "Ya ati ya laarin agbegbe rẹ",
      icon: "🤝",
      priority: 4,
    },
    {
      id: "bill_splitting",
      title: "Pipin Inawo",
      description: "Pin inawo ni irọrun pẹlu awọn ọrẹ",
      icon: "🧾",
      priority: 5,
    },
  ],
  localPartners: [
    "GTBank", "Access Bank", "Zenith Bank", "First Bank",
    "MTN", "Airtel", "Glo", "9mobile",
    "Paystack", "Flutterwave"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "NDPR (Ofin Aabo Data ti Naijiria)",
    regulatoryBody: "CBN (Ile-iṣẹ Banki Aarin Naijiria)",
  },
};

// Igbo (Southeastern Nigeria)
export const igboOnboarding: OnboardingConfig = {
  language: "ig",
  region: "Southeastern Nigeria",
  currency: "NGN",
  paymentMethods: [
    { id: "ussd", name: "USSD (*737#)", icon: "📱", enabled: true, popular: true },
    { id: "bank_transfer", name: "Mbufe Ego Bank", icon: "🏦", enabled: true, popular: true },
    { id: "card", name: "Kaadi Bank", icon: "💳", enabled: true, popular: true },
    { id: "mobile_money", name: "Ego Ekwenti", icon: "📲", enabled: true, popular: false },
    { id: "wallet", name: "Akpa Ego", icon: "👛", enabled: true, popular: true },
  ],
  featuredServices: [
    {
      id: "cooperative_purchasing",
      title: "Ịzụta Mkpokọta Obodo",
      description: "Zụta ihe ọnụ na ndị otu",
      icon: "🛒",
      priority: 1,
    },
    {
      id: "savings_circles",
      title: "Otu Nchekwa",
      description: "Chekwaa ego ọnụ na ndị enyi na ezinụlọ",
      icon: "💰",
      priority: 2,
    },
    {
      id: "school_fees",
      title: "Ụgwọ Ụlọ Akwụkwọ n'Ụdị Nkewa",
      description: "Kwụọ ụgwọ ụlọ akwụkwọ n'ụdị nkewa dị mfe",
      icon: "🎓",
      priority: 3,
    },
    {
      id: "p2p_lending",
      title: "Mbinye Ego Obodo",
      description: "Gbazinye na gbazinye n'ime obodo gị",
      icon: "🤝",
      priority: 4,
    },
    {
      id: "bill_splitting",
      title: "Nkewa Ụgwọ",
      description: "Kewaa ụgwọ ngwa ngwa na ndị enyi",
      icon: "🧾",
      priority: 5,
    },
  ],
  localPartners: [
    "GTBank", "Access Bank", "Zenith Bank", "First Bank",
    "MTN", "Airtel", "Glo", "9mobile",
    "Paystack", "Flutterwave"
  ],
  regulatoryInfo: {
    kycRequired: true,
    minAge: 18,
    dataProtectionLaw: "NDPR (Iwu Nchedo Data nke Naịjirịa)",
    regulatoryBody: "CBN (Ụlọ Akụ Etiti Naịjirịa)",
  },
};

// Get onboarding config based on language
export function getOnboardingConfig(language: string): OnboardingConfig {
  switch (language) {
    case "en":
      return englishOnboarding;
    case "fr":
      return frenchOnboarding;
    case "sw":
      return swahiliOnboarding;
    case "ha":
      return hausaOnboarding;
    case "yo":
      return yorubaOnboarding;
    case "ig":
      return igboOnboarding;
    default:
      return englishOnboarding; // Default to English
  }
}

// Get currency symbol based on language/region
export function getCurrencySymbol(language: string): string {
  const currencyMap: Record<string, string> = {
    en: "₦", // Naira (Nigeria), can be KES/GHS/ZAR based on region
    fr: "FCFA", // West/Central African CFA Franc
    sw: "KSh", // Kenyan Shilling
    ha: "₦", // Naira
    yo: "₦", // Naira
    ig: "₦", // Naira
  };
  return currencyMap[language] || "₦";
}

// Get payment method icon
export function getPaymentMethodIcon(methodId: string): string {
  const iconMap: Record<string, string> = {
    card: "💳",
    bank_transfer: "🏦",
    ussd: "📱",
    mobile_money: "📲",
    wallet: "👛",
    mpesa: "📱",
    orange_money: "🟠",
    mtn_momo: "🟡",
    airtel_money: "🔴",
    tigopesa: "🔵",
  };
  return iconMap[methodId] || "💰";
}
