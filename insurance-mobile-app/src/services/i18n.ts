import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'yo' | 'ha' | 'ig' | 'pcm';

export interface Translations {
  [key: string]: string;
}

const LANGUAGE_KEY = '@insureportal_language';

const translations: Record<Language, Translations> = {
  en: {
    // Common
    'common.welcome': 'Welcome',
    'common.login': 'Sign In',
    'common.logout': 'Sign Out',
    'common.register': 'Register',
    'common.email': 'Email',
    'common.password': 'Password',
    'common.name': 'Full Name',
    'common.phone': 'Phone Number',
    'common.submit': 'Submit',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.retry': 'Retry',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.done': 'Done',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
    
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.policies': 'Policies',
    'nav.claims': 'Claims',
    'nav.payments': 'Payments',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    
    // Dashboard
    'dashboard.welcome_back': 'Welcome back,',
    'dashboard.active_policies': 'Active Policies',
    'dashboard.pending_claims': 'Pending Claims',
    'dashboard.due_payments': 'Due Payments',
    'dashboard.quick_actions': 'Quick Actions',
    'dashboard.file_claim': 'File a Claim',
    'dashboard.make_payment': 'Make Payment',
    'dashboard.refer_friend': 'Refer a Friend',
    'dashboard.write_review': 'Write Review',
    'dashboard.recent_activity': 'Recent Activity',
    
    // Policies
    'policies.title': 'My Policies',
    'policies.search': 'Search policies...',
    'policies.all': 'All',
    'policies.active': 'Active',
    'policies.expired': 'Expired',
    'policies.no_policies': 'No policies found',
    'policies.premium': 'Premium',
    'policies.sum_assured': 'Sum Assured',
    'policies.valid_until': 'Valid Until',
    'policies.download': 'Download',
    'policies.renew': 'Renew',
    
    // Claims
    'claims.title': 'My Claims',
    'claims.new_claim': 'File a Claim',
    'claims.claim_amount': 'Claim Amount',
    'claims.incident_date': 'Incident Date',
    'claims.description': 'Description',
    'claims.documents': 'Supporting Documents',
    'claims.submit_claim': 'Submit Claim',
    'claims.status_pending': 'Pending',
    'claims.status_approved': 'Approved',
    'claims.status_rejected': 'Rejected',
    'claims.status_paid': 'Paid',
    
    // Payments
    'payments.title': 'Payments',
    'payments.pending': 'Pending',
    'payments.completed': 'Completed',
    'payments.failed': 'Failed',
    'payments.pay_now': 'Pay Now',
    'payments.total_pending': 'Total Pending',
    
    // Profile
    'profile.title': 'Profile',
    'profile.personal_info': 'Personal Information',
    'profile.kyc_verification': 'KYC Verification',
    'profile.kyc_verified': 'KYC Verified',
    'profile.kyc_incomplete': 'KYC Incomplete',
    'profile.nin': 'National ID (NIN)',
    'profile.bvn': 'Bank Verification (BVN)',
    'profile.address': 'Address Verification',
    'profile.document': 'ID Document',
    
    // Settings
    'settings.title': 'Settings',
    'settings.notifications': 'Notification Preferences',
    'settings.change_password': 'Change Password',
    'settings.biometric': 'Biometric Login',
    'settings.language': 'Language',
    'settings.help': 'Help Center',
    'settings.contact': 'Contact Support',
    'settings.terms': 'Terms of Service',
    'settings.privacy': 'Privacy Policy',
    
    // Auth
    'auth.welcome': 'Welcome to InsurePortal',
    'auth.sign_in': 'Sign in to continue',
    'auth.no_account': "Don't have an account? Register",
    'auth.have_account': 'Already have an account? Sign In',
    'auth.forgot_password': 'Forgot Password?',
    
    // Errors
    'error.network': 'Network error. Please check your connection.',
    'error.server': 'Server error. Please try again later.',
    'error.invalid_credentials': 'Invalid email or password.',
    'error.required_field': 'This field is required.',
    'error.invalid_email': 'Please enter a valid email address.',
    'error.password_short': 'Password must be at least 8 characters.',
  },
  
  yo: {
    // Yoruba translations
    'common.welcome': 'Kaabo',
    'common.login': 'Wole',
    'common.logout': 'Jade',
    'common.register': 'Forukosile',
    'common.email': 'Imeeli',
    'common.password': 'Oro aabo',
    'common.name': 'Oruko ni kikun',
    'common.phone': 'Nomba foonu',
    'common.submit': 'Fi sile',
    'common.cancel': 'Fagile',
    'common.save': 'Fi pamo',
    'common.edit': 'Satunse',
    'common.delete': 'Pa re',
    'common.search': 'Wa',
    'common.loading': 'N gba...',
    'common.error': 'Asise',
    'common.success': 'Aseyori',
    'common.retry': 'Tun gbiyanju',
    'common.back': 'Pada',
    'common.next': 'Tele',
    'common.done': 'Ti pari',
    'common.yes': 'Beeni',
    'common.no': 'Rara',
    'common.ok': 'O dara',
    
    'nav.dashboard': 'Ibi akoso',
    'nav.policies': 'Awon eto',
    'nav.claims': 'Awon ebe',
    'nav.payments': 'Awon isanwo',
    'nav.profile': 'Profaili',
    'nav.settings': 'Eto',
    'nav.notifications': 'Awon ifitonileti',
    
    'dashboard.welcome_back': 'Kaabo pada,',
    'dashboard.active_policies': 'Awon eto ti n sise',
    'dashboard.pending_claims': 'Awon ebe ti n duro',
    'dashboard.due_payments': 'Awon isanwo ti o ye',
    'dashboard.quick_actions': 'Awon igbese yara',
    'dashboard.file_claim': 'Fi ebe sile',
    'dashboard.make_payment': 'San owo',
    'dashboard.refer_friend': 'Toka ore kan',
    'dashboard.write_review': 'Ko atunyewo',
    'dashboard.recent_activity': 'Isele aipese',
    
    'auth.welcome': 'Kaabo si InsurePortal',
    'auth.sign_in': 'Wole lati tesiwaju',
    'auth.no_account': 'Ko ni akanti? Forukosile',
    'auth.have_account': 'Ni akanti tele? Wole',
  },
  
  ha: {
    // Hausa translations
    'common.welcome': 'Barka da zuwa',
    'common.login': 'Shiga',
    'common.logout': 'Fita',
    'common.register': 'Yi rajista',
    'common.email': 'Imel',
    'common.password': 'Kalmar sirri',
    'common.name': 'Sunan cikakke',
    'common.phone': 'Lambar waya',
    'common.submit': 'Aika',
    'common.cancel': 'Soke',
    'common.save': 'Ajiye',
    'common.edit': 'Gyara',
    'common.delete': 'Share',
    'common.search': 'Nema',
    'common.loading': 'Ana lodi...',
    'common.error': 'Kuskure',
    'common.success': 'Nasara',
    'common.retry': 'Sake gwadawa',
    'common.back': 'Koma',
    'common.next': 'Gaba',
    'common.done': 'An gama',
    'common.yes': 'Eh',
    'common.no': "A'a",
    'common.ok': 'To',
    
    'nav.dashboard': 'Shafin gida',
    'nav.policies': 'Manufofi',
    'nav.claims': 'Da\'awar',
    'nav.payments': 'Biya',
    'nav.profile': 'Bayanan kai',
    'nav.settings': 'Saituna',
    'nav.notifications': 'Sanarwa',
    
    'dashboard.welcome_back': 'Barka da dawowa,',
    'dashboard.active_policies': 'Manufofi masu aiki',
    'dashboard.pending_claims': 'Da\'awar da ke jira',
    'dashboard.due_payments': 'Biya da ya kamata',
    'dashboard.quick_actions': 'Ayyuka masu sauri',
    'dashboard.file_claim': 'Yi da\'awar',
    'dashboard.make_payment': 'Yi biya',
    'dashboard.refer_friend': 'Nuna aboki',
    'dashboard.write_review': 'Rubuta sharhi',
    'dashboard.recent_activity': 'Ayyukan kwanan nan',
    
    'auth.welcome': 'Barka da zuwa InsurePortal',
    'auth.sign_in': 'Shiga don ci gaba',
    'auth.no_account': 'Ba ku da asusu? Yi rajista',
    'auth.have_account': 'Kuna da asusu? Shiga',
  },
  
  ig: {
    // Igbo translations
    'common.welcome': 'Nnoo',
    'common.login': 'Banye',
    'common.logout': 'Puo',
    'common.register': 'Debanye aha',
    'common.email': 'Ozi-e',
    'common.password': 'Okwuntughe',
    'common.name': 'Aha zuru oke',
    'common.phone': 'Nomba ekwenti',
    'common.submit': 'Nyefee',
    'common.cancel': 'Kagbuo',
    'common.save': 'Chekwaa',
    'common.edit': 'Dezie',
    'common.delete': 'Hichapuo',
    'common.search': 'Choo',
    'common.loading': 'Na-ebu...',
    'common.error': 'Njehie',
    'common.success': 'Ihe gara nke oma',
    'common.retry': 'Nwaa ozo',
    'common.back': 'Laghachi',
    'common.next': 'Ozo',
    'common.done': 'Emechara',
    'common.yes': 'Ee',
    'common.no': 'Mba',
    'common.ok': 'O di mma',
    
    'nav.dashboard': 'Ebe nlele',
    'nav.policies': 'Iwu',
    'nav.claims': 'Ariri',
    'nav.payments': 'Ugwo',
    'nav.profile': 'Profailu',
    'nav.settings': 'Ntọala',
    'nav.notifications': 'Ozi',
    
    'dashboard.welcome_back': 'Nnoo azụ,',
    'dashboard.active_policies': 'Iwu na-arụ ọrụ',
    'dashboard.pending_claims': 'Arịrị na-echere',
    'dashboard.due_payments': 'Ugwo kwesịrị',
    'dashboard.quick_actions': 'Omume ngwa ngwa',
    'dashboard.file_claim': 'Tinye arịrị',
    'dashboard.make_payment': 'Kwuo ugwo',
    'dashboard.refer_friend': 'Kpọọ enyi',
    'dashboard.write_review': 'Dee nyocha',
    'dashboard.recent_activity': 'Omume ohuru',
    
    'auth.welcome': 'Nnoo na InsurePortal',
    'auth.sign_in': 'Banye iji gaa n\'ihu',
    'auth.no_account': 'Enweghị akaụntụ? Debanye aha',
    'auth.have_account': 'Nwere akaụntụ? Banye',
  },
  
  pcm: {
    // Nigerian Pidgin translations
    'common.welcome': 'You don come',
    'common.login': 'Enter',
    'common.logout': 'Comot',
    'common.register': 'Sign up',
    'common.email': 'Email',
    'common.password': 'Password',
    'common.name': 'Your full name',
    'common.phone': 'Phone number',
    'common.submit': 'Send am',
    'common.cancel': 'Cancel am',
    'common.save': 'Save am',
    'common.edit': 'Change am',
    'common.delete': 'Delete am',
    'common.search': 'Find',
    'common.loading': 'E dey load...',
    'common.error': 'Wahala',
    'common.success': 'E don work',
    'common.retry': 'Try again',
    'common.back': 'Go back',
    'common.next': 'Next one',
    'common.done': 'E don finish',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'Okay',
    
    'nav.dashboard': 'Main page',
    'nav.policies': 'Your policies',
    'nav.claims': 'Your claims',
    'nav.payments': 'Your payments',
    'nav.profile': 'Your profile',
    'nav.settings': 'Settings',
    'nav.notifications': 'Notifications',
    
    'dashboard.welcome_back': 'Welcome back,',
    'dashboard.active_policies': 'Policies wey dey work',
    'dashboard.pending_claims': 'Claims wey dey wait',
    'dashboard.due_payments': 'Payments wey you suppose pay',
    'dashboard.quick_actions': 'Quick things wey you fit do',
    'dashboard.file_claim': 'Make claim',
    'dashboard.make_payment': 'Pay money',
    'dashboard.refer_friend': 'Tell your friend',
    'dashboard.write_review': 'Write review',
    'dashboard.recent_activity': 'Wetin happen recently',
    
    'auth.welcome': 'Welcome to InsurePortal',
    'auth.sign_in': 'Enter to continue',
    'auth.no_account': 'You no get account? Sign up',
    'auth.have_account': 'You get account already? Enter',
    
    'policies.title': 'Your Policies',
    'policies.search': 'Find policy...',
    'policies.all': 'All',
    'policies.active': 'Active',
    'policies.expired': 'Don expire',
    'policies.no_policies': 'No policy dey',
    'policies.premium': 'Premium',
    'policies.sum_assured': 'Money wey dem go pay',
    'policies.valid_until': 'E go expire for',
    'policies.download': 'Download',
    'policies.renew': 'Renew am',
    
    'claims.title': 'Your Claims',
    'claims.new_claim': 'Make new claim',
    'claims.claim_amount': 'How much you wan claim',
    'claims.incident_date': 'When e happen',
    'claims.description': 'Wetin happen',
    'claims.documents': 'Papers wey go support am',
    'claims.submit_claim': 'Send claim',
    
    'payments.title': 'Payments',
    'payments.pending': 'Dey wait',
    'payments.completed': 'Don pay',
    'payments.failed': 'No work',
    'payments.pay_now': 'Pay now',
    'payments.total_pending': 'Total wey you suppose pay',
    
    'profile.title': 'Your Profile',
    'profile.personal_info': 'Your Information',
    'profile.kyc_verification': 'KYC Verification',
    'profile.kyc_verified': 'KYC don verify',
    'profile.kyc_incomplete': 'KYC never complete',
    
    'settings.title': 'Settings',
    'settings.notifications': 'Notification settings',
    'settings.change_password': 'Change password',
    'settings.biometric': 'Face ID / Fingerprint',
    'settings.language': 'Language',
    'settings.help': 'Help',
    'settings.contact': 'Contact us',
    'settings.terms': 'Terms and Conditions',
    'settings.privacy': 'Privacy Policy',
    
    'error.network': 'Network wahala. Check your connection.',
    'error.server': 'Server wahala. Try again later.',
    'error.invalid_credentials': 'Email or password no correct.',
    'error.required_field': 'You must fill this one.',
  },
};

class I18nService {
  private currentLanguage: Language = 'en';
  private listeners: ((language: Language) => void)[] = [];

  async initialize(): Promise<void> {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage && this.isValidLanguage(savedLanguage)) {
        this.currentLanguage = savedLanguage as Language;
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  }

  private isValidLanguage(lang: string): lang is Language {
    return ['en', 'yo', 'ha', 'ig', 'pcm'].includes(lang);
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  async setLanguage(language: Language): Promise<void> {
    this.currentLanguage = language;
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    this.notifyListeners();
  }

  t(key: string, params?: Record<string, string | number>): string {
    let translation = translations[this.currentLanguage][key] || translations.en[key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return translation;
  }

  addListener(callback: (language: Language) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  getAvailableLanguages(): { code: Language; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
      { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
      { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
      { code: 'pcm', name: 'Nigerian Pidgin', nativeName: 'Naija' },
    ];
  }
}

export const i18n = new I18nService();
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
export default i18n;
