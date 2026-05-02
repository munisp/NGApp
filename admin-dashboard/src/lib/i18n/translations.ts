// Multi-language support for the Payment Switch Admin Dashboard
// Focus on African languages and major Nigerian languages including Pidgin

export type Language = 'en' | 'ha' | 'yo' | 'ig' | 'pcm' | 'fr' | 'sw' | 'am' | 'zu';

export interface Translations {
  common: {
    save: string;
    cancel: string;
    submit: string;
    delete: string;
    edit: string;
    view: string;
    search: string;
    filter: string;
    refresh: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    confirm: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    download: string;
    upload: string;
    export: string;
    import: string;
  };
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    forgotPassword: string;
    rememberMe: string;
    signIn: string;
    signUp: string;
    welcomeBack: string;
    invalidCredentials: string;
  };
  navigation: {
    dashboard: string;
    onboarding: string;
    kyc: string;
    kyb: string;
    users: string;
    settings: string;
    reports: string;
    compliance: string;
    integrations: string;
  };
  onboarding: {
    title: string;
    newApplication: string;
    pendingApplications: string;
    approvedApplications: string;
    rejectedApplications: string;
    organizationName: string;
    stakeholderType: string;
    registrationNumber: string;
    country: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    documents: string;
    keyPersonnel: string;
    directors: string;
    shareholders: string;
    ubos: string;
    submitApplication: string;
    saveDraft: string;
    applicationStatus: string;
    bulkOnboarding: string;
    templateCloning: string;
    slaTracking: string;
    integrationTesting: string;
  };
  kyc: {
    title: string;
    verifyIdentity: string;
    documentUpload: string;
    selfieVerification: string;
    addressVerification: string;
    ninVerification: string;
    bvnVerification: string;
    passportVerification: string;
    verificationStatus: string;
    pending: string;
    verified: string;
    failed: string;
    expired: string;
  };
  kyb: {
    title: string;
    companyVerification: string;
    cacVerification: string;
    directorVerification: string;
    shareholderVerification: string;
    uboVerification: string;
    documentReview: string;
    riskAssessment: string;
  };
  sla: {
    title: string;
    onTrack: string;
    atRisk: string;
    overdue: string;
    daysRemaining: string;
    daysOverdue: string;
    targetDays: string;
    elapsedDays: string;
    complianceRate: string;
    breaches: string;
  };
  testing: {
    title: string;
    runTest: string;
    testScenarios: string;
    certificationProgress: string;
    sandboxCredentials: string;
    passed: string;
    failed: string;
    running: string;
    pending: string;
  };
}

export const translations: Record<Language, Translations> = {
  // English (Default)
  en: {
    common: { save: 'Save', cancel: 'Cancel', submit: 'Submit', delete: 'Delete', edit: 'Edit', view: 'View', search: 'Search', filter: 'Filter', refresh: 'Refresh', loading: 'Loading...', error: 'Error', success: 'Success', warning: 'Warning', confirm: 'Confirm', back: 'Back', next: 'Next', previous: 'Previous', close: 'Close', download: 'Download', upload: 'Upload', export: 'Export', import: 'Import' },
    auth: { login: 'Login', logout: 'Logout', email: 'Email', password: 'Password', forgotPassword: 'Forgot Password?', rememberMe: 'Remember Me', signIn: 'Sign In', signUp: 'Sign Up', welcomeBack: 'Welcome Back', invalidCredentials: 'Invalid email or password' },
    navigation: { dashboard: 'Dashboard', onboarding: 'Onboarding', kyc: 'KYC', kyb: 'KYB', users: 'Users', settings: 'Settings', reports: 'Reports', compliance: 'Compliance', integrations: 'Integrations' },
    onboarding: { title: 'Onboarding', newApplication: 'New Application', pendingApplications: 'Pending Applications', approvedApplications: 'Approved Applications', rejectedApplications: 'Rejected Applications', organizationName: 'Organization Name', stakeholderType: 'Stakeholder Type', registrationNumber: 'Registration Number', country: 'Country', contactName: 'Contact Name', contactEmail: 'Contact Email', contactPhone: 'Contact Phone', documents: 'Documents', keyPersonnel: 'Key Personnel', directors: 'Directors', shareholders: 'Shareholders', ubos: 'Ultimate Beneficial Owners', submitApplication: 'Submit Application', saveDraft: 'Save Draft', applicationStatus: 'Application Status', bulkOnboarding: 'Bulk Onboarding', templateCloning: 'Template Cloning', slaTracking: 'SLA Tracking', integrationTesting: 'Integration Testing' },
    kyc: { title: 'KYC Verification', verifyIdentity: 'Verify Identity', documentUpload: 'Document Upload', selfieVerification: 'Selfie Verification', addressVerification: 'Address Verification', ninVerification: 'NIN Verification', bvnVerification: 'BVN Verification', passportVerification: 'Passport Verification', verificationStatus: 'Verification Status', pending: 'Pending', verified: 'Verified', failed: 'Failed', expired: 'Expired' },
    kyb: { title: 'KYB Verification', companyVerification: 'Company Verification', cacVerification: 'CAC Verification', directorVerification: 'Director Verification', shareholderVerification: 'Shareholder Verification', uboVerification: 'UBO Verification', documentReview: 'Document Review', riskAssessment: 'Risk Assessment' },
    sla: { title: 'SLA Tracking', onTrack: 'On Track', atRisk: 'At Risk', overdue: 'Overdue', daysRemaining: 'Days Remaining', daysOverdue: 'Days Overdue', targetDays: 'Target Days', elapsedDays: 'Elapsed Days', complianceRate: 'Compliance Rate', breaches: 'Breaches' },
    testing: { title: 'Integration Testing', runTest: 'Run Test', testScenarios: 'Test Scenarios', certificationProgress: 'Certification Progress', sandboxCredentials: 'Sandbox Credentials', passed: 'Passed', failed: 'Failed', running: 'Running', pending: 'Pending' },
  },

  // Hausa (Nigeria - Northern Nigeria)
  ha: {
    common: { save: 'Ajiye', cancel: 'Soke', submit: 'Aika', delete: 'Share', edit: 'Gyara', view: 'Duba', search: 'Bincika', filter: 'Tace', refresh: 'Sabunta', loading: 'Ana lodi...', error: 'Kuskure', success: 'Nasara', warning: 'Gargadi', confirm: 'Tabbatar', back: 'Baya', next: 'Gaba', previous: 'Na baya', close: 'Rufe', download: 'Sauke', upload: 'Dora', export: 'Fitar', import: 'Shigo' },
    auth: { login: 'Shiga', logout: 'Fita', email: 'Imel', password: 'Kalmar sirri', forgotPassword: 'Ka manta kalmar sirri?', rememberMe: 'Tuna ni', signIn: 'Shiga', signUp: 'Yi rajista', welcomeBack: 'Barka da dawowa', invalidCredentials: 'Imel ko kalmar sirri ba daidai ba' },
    navigation: { dashboard: 'Allon sarrafa', onboarding: 'Shigar da sabon', kyc: 'Sanin Abokin ciniki', kyb: 'Sanin Kasuwanci', users: 'Masu amfani', settings: 'Saituna', reports: 'Rahotanni', compliance: 'Bin doka', integrations: 'Hadewa' },
    onboarding: { title: 'Shigar da sabon', newApplication: 'Sabuwar takarda', pendingApplications: 'Takardu masu jira', approvedApplications: 'Takardu da aka amince', rejectedApplications: 'Takardu da aka ki', organizationName: 'Sunan kungiya', stakeholderType: 'Nau\'in mai ruwa da tsaki', registrationNumber: 'Lambar rajista', country: 'Kasa', contactName: 'Sunan tuntubar', contactEmail: 'Imel na tuntubar', contactPhone: 'Waya na tuntubar', documents: 'Takardun', keyPersonnel: 'Muhimman ma\'aikata', directors: 'Daraktoci', shareholders: 'Masu hannun jari', ubos: 'Masu amfana na karshe', submitApplication: 'Aika takarda', saveDraft: 'Ajiye daftari', applicationStatus: 'Matsayin takarda', bulkOnboarding: 'Shigar da yawa', templateCloning: 'Kwafin samfuri', slaTracking: 'Bin diddigin SLA', integrationTesting: 'Gwajin hadewa' },
    kyc: { title: 'Tabbatar da KYC', verifyIdentity: 'Tabbatar da kai', documentUpload: 'Dora takarda', selfieVerification: 'Tabbatar da hoto', addressVerification: 'Tabbatar da adireshi', ninVerification: 'Tabbatar da NIN', bvnVerification: 'Tabbatar da BVN', passportVerification: 'Tabbatar da fasfo', verificationStatus: 'Matsayin tabbatarwa', pending: 'Yana jira', verified: 'An tabbatar', failed: 'Ya gaza', expired: 'Ya kare' },
    kyb: { title: 'Tabbatar da KYB', companyVerification: 'Tabbatar da kamfani', cacVerification: 'Tabbatar da CAC', directorVerification: 'Tabbatar da darakta', shareholderVerification: 'Tabbatar da mai hannun jari', uboVerification: 'Tabbatar da UBO', documentReview: 'Duba takardun', riskAssessment: 'Kimanta hadari' },
    sla: { title: 'Bin diddigin SLA', onTrack: 'A kan hanya', atRisk: 'Cikin hadari', overdue: 'Ya wuce lokaci', daysRemaining: 'Kwanaki da suka rage', daysOverdue: 'Kwanaki da suka wuce', targetDays: 'Kwanakin manufa', elapsedDays: 'Kwanaki da suka wuce', complianceRate: 'Adadin bin doka', breaches: 'Karya doka' },
    testing: { title: 'Gwajin hadewa', runTest: 'Gudanar da gwaji', testScenarios: 'Yanayin gwaji', certificationProgress: 'Ci gaban takarda', sandboxCredentials: 'Bayanan gwaji', passed: 'Ya wuce', failed: 'Ya gaza', running: 'Yana gudana', pending: 'Yana jira' },
  },

  // Yoruba (Nigeria - Western Nigeria)
  yo: {
    common: { save: 'Fi pamọ', cancel: 'Fagilee', submit: 'Fi silẹ', delete: 'Pa rẹ', edit: 'Ṣatunkọ', view: 'Wo', search: 'Wa', filter: 'Ṣe àyẹ̀wò', refresh: 'Tunṣe', loading: 'N gbero...', error: 'Aṣiṣe', success: 'Aṣeyọri', warning: 'Ikilo', confirm: 'Jẹri', back: 'Pada', next: 'Tẹle', previous: 'Ti tẹlẹ', close: 'Pa', download: 'Gba silẹ', upload: 'Gbe soke', export: 'Kojade', import: 'Kowole' },
    auth: { login: 'Wọle', logout: 'Jade', email: 'Imeeli', password: 'Ọrọ aṣina', forgotPassword: 'Ṣe o gbagbe ọrọ aṣina?', rememberMe: 'Ranti mi', signIn: 'Wọle', signUp: 'Forukọsilẹ', welcomeBack: 'Kaabo pada', invalidCredentials: 'Imeeli tabi ọrọ aṣina ko tọ' },
    navigation: { dashboard: 'Pẹpẹ iṣakoso', onboarding: 'Igbasilẹ', kyc: 'Mọ Onibara Rẹ', kyb: 'Mọ Iṣowo Rẹ', users: 'Awọn olumulo', settings: 'Eto', reports: 'Ijabọ', compliance: 'Ibamu', integrations: 'Isopọ' },
    onboarding: { title: 'Igbasilẹ', newApplication: 'Ohun elo tuntun', pendingApplications: 'Awọn ohun elo ti n duro', approvedApplications: 'Awọn ohun elo ti a fọwọsi', rejectedApplications: 'Awọn ohun elo ti a kọ', organizationName: 'Orukọ ajọ', stakeholderType: 'Iru olukopa', registrationNumber: 'Nọmba iforukọsilẹ', country: 'Orilẹ-ede', contactName: 'Orukọ olubasọrọ', contactEmail: 'Imeeli olubasọrọ', contactPhone: 'Foonu olubasọrọ', documents: 'Awọn iwe', keyPersonnel: 'Awọn oṣiṣẹ pataki', directors: 'Awọn oludari', shareholders: 'Awọn onipín', ubos: 'Awọn onipín gidi', submitApplication: 'Fi ohun elo silẹ', saveDraft: 'Fi akọsilẹ pamọ', applicationStatus: 'Ipo ohun elo', bulkOnboarding: 'Igbasilẹ pupọ', templateCloning: 'Ṣe ẹda awoṣe', slaTracking: 'Itọpa SLA', integrationTesting: 'Idanwo isopọ' },
    kyc: { title: 'Ijẹrisi KYC', verifyIdentity: 'Jẹri idanimọ', documentUpload: 'Gbe iwe soke', selfieVerification: 'Ijẹrisi aworan', addressVerification: 'Ijẹrisi adirẹsi', ninVerification: 'Ijẹrisi NIN', bvnVerification: 'Ijẹrisi BVN', passportVerification: 'Ijẹrisi iwe irinna', verificationStatus: 'Ipo ijẹrisi', pending: 'N duro', verified: 'Ti jẹri', failed: 'Kuna', expired: 'Ti pari' },
    kyb: { title: 'Ijẹrisi KYB', companyVerification: 'Ijẹrisi ile-iṣẹ', cacVerification: 'Ijẹrisi CAC', directorVerification: 'Ijẹrisi oludari', shareholderVerification: 'Ijẹrisi onipín', uboVerification: 'Ijẹrisi UBO', documentReview: 'Atunyẹwo iwe', riskAssessment: 'Iṣiro ewu' },
    sla: { title: 'Itọpa SLA', onTrack: 'Lori ọna', atRisk: 'Ninu ewu', overdue: 'Ti pẹ', daysRemaining: 'Awọn ọjọ ti o ku', daysOverdue: 'Awọn ọjọ ti o pẹ', targetDays: 'Awọn ọjọ ibi-afẹde', elapsedDays: 'Awọn ọjọ ti o ti kọja', complianceRate: 'Oṣuwọn ibamu', breaches: 'Irufin' },
    testing: { title: 'Idanwo isopọ', runTest: 'Ṣe idanwo', testScenarios: 'Awọn oju iṣẹlẹ idanwo', certificationProgress: 'Ilọsiwaju ijẹrisi', sandboxCredentials: 'Awọn ẹri idanwo', passed: 'Kọja', failed: 'Kuna', running: 'N ṣiṣẹ', pending: 'N duro' },
  },

  // Igbo (Nigeria - Eastern Nigeria)
  ig: {
    common: { save: 'Chekwaa', cancel: 'Kagbuo', submit: 'Nyefee', delete: 'Hichapụ', edit: 'Dezie', view: 'Lee', search: 'Chọọ', filter: 'Nyocha', refresh: 'Mee ọhụrụ', loading: 'Na-ebu...', error: 'Njehie', success: 'Ihe ịga nke ọma', warning: 'Ịdọ aka na ntị', confirm: 'Kwado', back: 'Laghachi', next: 'Ọzọ', previous: 'Nke gara aga', close: 'Mechie', download: 'Budata', upload: 'Bulite', export: 'Bupụ', import: 'Bubata' },
    auth: { login: 'Banye', logout: 'Pụọ', email: 'Email', password: 'Okwuntughe', forgotPassword: 'Ị chefuru okwuntughe?', rememberMe: 'Cheta m', signIn: 'Banye', signUp: 'Debanye aha', welcomeBack: 'Nnọọ ọzọ', invalidCredentials: 'Email ma ọ bụ okwuntughe ezighi ezi' },
    navigation: { dashboard: 'Ogwe njikwa', onboarding: 'Ndebanye aha', kyc: 'Mara Onye Ahịa Gị', kyb: 'Mara Azụmahịa Gị', users: 'Ndị ọrụ', settings: 'Ntọala', reports: 'Akụkọ', compliance: 'Ndabere', integrations: 'Njikọ' },
    onboarding: { title: 'Ndebanye aha', newApplication: 'Arịrịọ ọhụrụ', pendingApplications: 'Arịrịọ na-echere', approvedApplications: 'Arịrịọ a nabatara', rejectedApplications: 'Arịrịọ a jụrụ', organizationName: 'Aha otu', stakeholderType: 'Ụdị onye nwe oke', registrationNumber: 'Nọmba ndebanye aha', country: 'Mba', contactName: 'Aha kọntaktị', contactEmail: 'Email kọntaktị', contactPhone: 'Ekwentị kọntaktị', documents: 'Akwụkwọ', keyPersonnel: 'Ndị ọrụ isi', directors: 'Ndị nduzi', shareholders: 'Ndị nwe oke', ubos: 'Ndị nwe uru ikpeazụ', submitApplication: 'Nyefee arịrịọ', saveDraft: 'Chekwaa draft', applicationStatus: 'Ọnọdụ arịrịọ', bulkOnboarding: 'Ndebanye aha ukwu', templateCloning: 'Ịmepụta template', slaTracking: 'Ịsọ SLA', integrationTesting: 'Nnwale njikọ' },
    kyc: { title: 'Nkwenye KYC', verifyIdentity: 'Kwenye njirimara', documentUpload: 'Bulite akwụkwọ', selfieVerification: 'Nkwenye foto', addressVerification: 'Nkwenye adreesị', ninVerification: 'Nkwenye NIN', bvnVerification: 'Nkwenye BVN', passportVerification: 'Nkwenye passport', verificationStatus: 'Ọnọdụ nkwenye', pending: 'Na-echere', verified: 'Akwenyere', failed: 'Dara ada', expired: 'Agwụla' },
    kyb: { title: 'Nkwenye KYB', companyVerification: 'Nkwenye ụlọ ọrụ', cacVerification: 'Nkwenye CAC', directorVerification: 'Nkwenye onye nduzi', shareholderVerification: 'Nkwenye onye nwe oke', uboVerification: 'Nkwenye UBO', documentReview: 'Nyocha akwụkwọ', riskAssessment: 'Nyocha ihe ize ndụ' },
    sla: { title: 'Ịsọ SLA', onTrack: 'N\'ụzọ', atRisk: 'N\'ihe ize ndụ', overdue: 'Agafeela', daysRemaining: 'Ụbọchị fọdụrụ', daysOverdue: 'Ụbọchị gafere', targetDays: 'Ụbọchị ebumnuche', elapsedDays: 'Ụbọchị gafere', complianceRate: 'Ọnụ ọgụgụ ndabere', breaches: 'Mmebi' },
    testing: { title: 'Nnwale njikọ', runTest: 'Mee nnwale', testScenarios: 'Ihe omume nnwale', certificationProgress: 'Ọganihu asambodo', sandboxCredentials: 'Nzere nnwale', passed: 'Gafere', failed: 'Dara ada', running: 'Na-agba', pending: 'Na-echere' },
  },

  // Nigerian Pidgin (Nigeria - Lingua Franca)
  pcm: {
    common: { save: 'Save am', cancel: 'Cancel am', submit: 'Submit am', delete: 'Delete am', edit: 'Change am', view: 'See am', search: 'Find am', filter: 'Filter am', refresh: 'Refresh am', loading: 'E dey load...', error: 'Wahala', success: 'E don work', warning: 'Take note', confirm: 'Confirm am', back: 'Go back', next: 'Next one', previous: 'Before one', close: 'Close am', download: 'Download am', upload: 'Upload am', export: 'Carry go', import: 'Bring come' },
    auth: { login: 'Enter', logout: 'Comot', email: 'Email', password: 'Password', forgotPassword: 'You forget password?', rememberMe: 'Remember me', signIn: 'Enter', signUp: 'Register', welcomeBack: 'Welcome back o', invalidCredentials: 'Email or password no correct' },
    navigation: { dashboard: 'Dashboard', onboarding: 'Registration', kyc: 'Know Your Customer', kyb: 'Know Your Business', users: 'Users dem', settings: 'Settings', reports: 'Reports', compliance: 'Follow rules', integrations: 'Connections' },
    onboarding: { title: 'Registration', newApplication: 'New application', pendingApplications: 'Applications wey dey wait', approvedApplications: 'Applications wey don pass', rejectedApplications: 'Applications wey dem reject', organizationName: 'Company name', stakeholderType: 'Type of person', registrationNumber: 'Registration number', country: 'Country', contactName: 'Contact person name', contactEmail: 'Contact email', contactPhone: 'Contact phone', documents: 'Documents', keyPersonnel: 'Important people', directors: 'Directors', shareholders: 'Shareholders', ubos: 'Real owners', submitApplication: 'Submit application', saveDraft: 'Save for later', applicationStatus: 'Application status', bulkOnboarding: 'Register plenty', templateCloning: 'Copy template', slaTracking: 'Track SLA', integrationTesting: 'Test connection' },
    kyc: { title: 'KYC Verification', verifyIdentity: 'Verify who you be', documentUpload: 'Upload document', selfieVerification: 'Take selfie', addressVerification: 'Verify address', ninVerification: 'Verify NIN', bvnVerification: 'Verify BVN', passportVerification: 'Verify passport', verificationStatus: 'Verification status', pending: 'E dey wait', verified: 'E don verify', failed: 'E fail', expired: 'E don expire' },
    kyb: { title: 'KYB Verification', companyVerification: 'Verify company', cacVerification: 'Verify CAC', directorVerification: 'Verify director', shareholderVerification: 'Verify shareholder', uboVerification: 'Verify UBO', documentReview: 'Check documents', riskAssessment: 'Check risk' },
    sla: { title: 'SLA Tracking', onTrack: 'E dey on track', atRisk: 'E get risk', overdue: 'E don pass time', daysRemaining: 'Days wey remain', daysOverdue: 'Days wey pass', targetDays: 'Target days', elapsedDays: 'Days wey don pass', complianceRate: 'Compliance rate', breaches: 'Breaches' },
    testing: { title: 'Integration Testing', runTest: 'Run test', testScenarios: 'Test scenarios', certificationProgress: 'Certification progress', sandboxCredentials: 'Sandbox credentials', passed: 'E pass', failed: 'E fail', running: 'E dey run', pending: 'E dey wait' },
  },

  // French (Widely used in West/Central Africa)
  fr: {
    common: { save: 'Enregistrer', cancel: 'Annuler', submit: 'Soumettre', delete: 'Supprimer', edit: 'Modifier', view: 'Voir', search: 'Rechercher', filter: 'Filtrer', refresh: 'Actualiser', loading: 'Chargement...', error: 'Erreur', success: 'Succès', warning: 'Avertissement', confirm: 'Confirmer', back: 'Retour', next: 'Suivant', previous: 'Précédent', close: 'Fermer', download: 'Télécharger', upload: 'Téléverser', export: 'Exporter', import: 'Importer' },
    auth: { login: 'Connexion', logout: 'Déconnexion', email: 'Email', password: 'Mot de passe', forgotPassword: 'Mot de passe oublié?', rememberMe: 'Se souvenir de moi', signIn: 'Se connecter', signUp: "S'inscrire", welcomeBack: 'Bienvenue', invalidCredentials: 'Email ou mot de passe invalide' },
    navigation: { dashboard: 'Tableau de bord', onboarding: 'Intégration', kyc: 'KYC', kyb: 'KYB', users: 'Utilisateurs', settings: 'Paramètres', reports: 'Rapports', compliance: 'Conformité', integrations: 'Intégrations' },
    onboarding: { title: 'Intégration', newApplication: 'Nouvelle demande', pendingApplications: 'Demandes en attente', approvedApplications: 'Demandes approuvées', rejectedApplications: 'Demandes rejetées', organizationName: "Nom de l'organisation", stakeholderType: 'Type de partie prenante', registrationNumber: "Numéro d'enregistrement", country: 'Pays', contactName: 'Nom du contact', contactEmail: 'Email du contact', contactPhone: 'Téléphone du contact', documents: 'Documents', keyPersonnel: 'Personnel clé', directors: 'Directeurs', shareholders: 'Actionnaires', ubos: 'Bénéficiaires effectifs', submitApplication: 'Soumettre la demande', saveDraft: 'Enregistrer le brouillon', applicationStatus: 'Statut de la demande', bulkOnboarding: 'Intégration en masse', templateCloning: 'Clonage de modèle', slaTracking: 'Suivi SLA', integrationTesting: "Tests d'intégration" },
    kyc: { title: 'Vérification KYC', verifyIdentity: "Vérifier l'identité", documentUpload: 'Téléchargement de documents', selfieVerification: 'Vérification par selfie', addressVerification: "Vérification d'adresse", ninVerification: 'Vérification NIN', bvnVerification: 'Vérification BVN', passportVerification: 'Vérification passeport', verificationStatus: 'Statut de vérification', pending: 'En attente', verified: 'Vérifié', failed: 'Échoué', expired: 'Expiré' },
    kyb: { title: 'Vérification KYB', companyVerification: "Vérification d'entreprise", cacVerification: 'Vérification CAC', directorVerification: 'Vérification des directeurs', shareholderVerification: 'Vérification des actionnaires', uboVerification: 'Vérification UBO', documentReview: 'Examen des documents', riskAssessment: 'Évaluation des risques' },
    sla: { title: 'Suivi SLA', onTrack: 'Dans les délais', atRisk: 'À risque', overdue: 'En retard', daysRemaining: 'Jours restants', daysOverdue: 'Jours de retard', targetDays: 'Jours cibles', elapsedDays: 'Jours écoulés', complianceRate: 'Taux de conformité', breaches: 'Violations' },
    testing: { title: "Tests d'intégration", runTest: 'Exécuter le test', testScenarios: 'Scénarios de test', certificationProgress: 'Progression de certification', sandboxCredentials: 'Identifiants sandbox', passed: 'Réussi', failed: 'Échoué', running: 'En cours', pending: 'En attente' },
  },

  // Swahili (East Africa - Kenya, Tanzania, Uganda)
  sw: {
    common: { save: 'Hifadhi', cancel: 'Ghairi', submit: 'Wasilisha', delete: 'Futa', edit: 'Hariri', view: 'Tazama', search: 'Tafuta', filter: 'Chuja', refresh: 'Onyesha upya', loading: 'Inapakia...', error: 'Hitilafu', success: 'Mafanikio', warning: 'Onyo', confirm: 'Thibitisha', back: 'Rudi', next: 'Ifuatayo', previous: 'Iliyotangulia', close: 'Funga', download: 'Pakua', upload: 'Pakia', export: 'Hamisha', import: 'Ingiza' },
    auth: { login: 'Ingia', logout: 'Ondoka', email: 'Barua pepe', password: 'Nenosiri', forgotPassword: 'Umesahau nenosiri?', rememberMe: 'Nikumbuke', signIn: 'Ingia', signUp: 'Jisajili', welcomeBack: 'Karibu tena', invalidCredentials: 'Barua pepe au nenosiri si sahihi' },
    navigation: { dashboard: 'Dashibodi', onboarding: 'Usajili', kyc: 'KYC', kyb: 'KYB', users: 'Watumiaji', settings: 'Mipangilio', reports: 'Ripoti', compliance: 'Uzingatiaji', integrations: 'Muunganisho' },
    onboarding: { title: 'Usajili', newApplication: 'Maombi Mapya', pendingApplications: 'Maombi Yanayosubiri', approvedApplications: 'Maombi Yaliyoidhinishwa', rejectedApplications: 'Maombi Yaliyokataliwa', organizationName: 'Jina la Shirika', stakeholderType: 'Aina ya Mdau', registrationNumber: 'Nambari ya Usajili', country: 'Nchi', contactName: 'Jina la Mawasiliano', contactEmail: 'Barua pepe ya Mawasiliano', contactPhone: 'Simu ya Mawasiliano', documents: 'Nyaraka', keyPersonnel: 'Wafanyakazi Wakuu', directors: 'Wakurugenzi', shareholders: 'Wanahisa', ubos: 'Wamiliki wa Mwisho', submitApplication: 'Wasilisha Maombi', saveDraft: 'Hifadhi Rasimu', applicationStatus: 'Hali ya Maombi', bulkOnboarding: 'Usajili wa Wingi', templateCloning: 'Kunakili Kiolezo', slaTracking: 'Ufuatiliaji wa SLA', integrationTesting: 'Majaribio ya Muunganisho' },
    kyc: { title: 'Uthibitishaji wa KYC', verifyIdentity: 'Thibitisha Utambulisho', documentUpload: 'Pakia Nyaraka', selfieVerification: 'Uthibitishaji wa Picha', addressVerification: 'Uthibitishaji wa Anwani', ninVerification: 'Uthibitishaji wa NIN', bvnVerification: 'Uthibitishaji wa BVN', passportVerification: 'Uthibitishaji wa Pasipoti', verificationStatus: 'Hali ya Uthibitishaji', pending: 'Inasubiri', verified: 'Imethibitishwa', failed: 'Imeshindwa', expired: 'Imeisha muda' },
    kyb: { title: 'Uthibitishaji wa KYB', companyVerification: 'Uthibitishaji wa Kampuni', cacVerification: 'Uthibitishaji wa CAC', directorVerification: 'Uthibitishaji wa Wakurugenzi', shareholderVerification: 'Uthibitishaji wa Wanahisa', uboVerification: 'Uthibitishaji wa UBO', documentReview: 'Mapitio ya Nyaraka', riskAssessment: 'Tathmini ya Hatari' },
    sla: { title: 'Ufuatiliaji wa SLA', onTrack: 'Katika Wakati', atRisk: 'Katika Hatari', overdue: 'Imechelewa', daysRemaining: 'Siku Zilizobaki', daysOverdue: 'Siku za Kuchelewa', targetDays: 'Siku Lengwa', elapsedDays: 'Siku Zilizopita', complianceRate: 'Kiwango cha Uzingatiaji', breaches: 'Ukiukaji' },
    testing: { title: 'Majaribio ya Muunganisho', runTest: 'Endesha Jaribio', testScenarios: 'Hali za Majaribio', certificationProgress: 'Maendeleo ya Cheti', sandboxCredentials: 'Vitambulisho vya Sandbox', passed: 'Imepita', failed: 'Imeshindwa', running: 'Inaendelea', pending: 'Inasubiri' },
  },

  // Amharic (Ethiopia)
  am: {
    common: { save: 'አስቀምጥ', cancel: 'ሰርዝ', submit: 'አስገባ', delete: 'ሰርዝ', edit: 'አርትዕ', view: 'ተመልከት', search: 'ፈልግ', filter: 'አጣራ', refresh: 'አድስ', loading: 'በመጫን ላይ...', error: 'ስህተት', success: 'ተሳክቷል', warning: 'ማስጠንቀቂያ', confirm: 'አረጋግጥ', back: 'ተመለስ', next: 'ቀጣይ', previous: 'ቀዳሚ', close: 'ዝጋ', download: 'አውርድ', upload: 'ስቀል', export: 'ላክ', import: 'አስገባ' },
    auth: { login: 'ግባ', logout: 'ውጣ', email: 'ኢሜይል', password: 'የይለፍ ቃል', forgotPassword: 'የይለፍ ቃል ረሳህ?', rememberMe: 'አስታውሰኝ', signIn: 'ግባ', signUp: 'ተመዝገብ', welcomeBack: 'እንኳን ደህና መጣህ', invalidCredentials: 'ኢሜይል ወይም የይለፍ ቃል ትክክል አይደለም' },
    navigation: { dashboard: 'ዳሽቦርድ', onboarding: 'ምዝገባ', kyc: 'ደንበኛን ይወቁ', kyb: 'ንግድን ይወቁ', users: 'ተጠቃሚዎች', settings: 'ቅንብሮች', reports: 'ሪፖርቶች', compliance: 'ተገዢነት', integrations: 'ውህደቶች' },
    onboarding: { title: 'ምዝገባ', newApplication: 'አዲስ ማመልከቻ', pendingApplications: 'በመጠባበቅ ላይ ያሉ ማመልከቻዎች', approvedApplications: 'የተፈቀዱ ማመልከቻዎች', rejectedApplications: 'የተከለከሉ ማመልከቻዎች', organizationName: 'የድርጅት ስም', stakeholderType: 'የባለድርሻ አካል ዓይነት', registrationNumber: 'የምዝገባ ቁጥር', country: 'ሀገር', contactName: 'የእውቂያ ስም', contactEmail: 'የእውቂያ ኢሜይል', contactPhone: 'የእውቂያ ስልክ', documents: 'ሰነዶች', keyPersonnel: 'ዋና ሰራተኞች', directors: 'ዳይሬክተሮች', shareholders: 'ባለአክሲዮኖች', ubos: 'የመጨረሻ ተጠቃሚ ባለቤቶች', submitApplication: 'ማመልከቻ አስገባ', saveDraft: 'ረቂቅ አስቀምጥ', applicationStatus: 'የማመልከቻ ሁኔታ', bulkOnboarding: 'የጅምላ ምዝገባ', templateCloning: 'ቅጂ ቅንብር', slaTracking: 'SLA ክትትል', integrationTesting: 'የውህደት ሙከራ' },
    kyc: { title: 'KYC ማረጋገጫ', verifyIdentity: 'ማንነት አረጋግጥ', documentUpload: 'ሰነድ ስቀል', selfieVerification: 'የፎቶ ማረጋገጫ', addressVerification: 'የአድራሻ ማረጋገጫ', ninVerification: 'NIN ማረጋገጫ', bvnVerification: 'BVN ማረጋገጫ', passportVerification: 'ፓስፖርት ማረጋገጫ', verificationStatus: 'የማረጋገጫ ሁኔታ', pending: 'በመጠባበቅ ላይ', verified: 'ተረጋግጧል', failed: 'አልተሳካም', expired: 'ጊዜው አልፏል' },
    kyb: { title: 'KYB ማረጋገጫ', companyVerification: 'የኩባንያ ማረጋገጫ', cacVerification: 'CAC ማረጋገጫ', directorVerification: 'የዳይሬክተር ማረጋገጫ', shareholderVerification: 'የባለአክሲዮን ማረጋገጫ', uboVerification: 'UBO ማረጋገጫ', documentReview: 'የሰነድ ግምገማ', riskAssessment: 'የአደጋ ግምገማ' },
    sla: { title: 'SLA ክትትል', onTrack: 'በትክክል', atRisk: 'በአደጋ ላይ', overdue: 'ጊዜው አልፏል', daysRemaining: 'የቀሩ ቀናት', daysOverdue: 'ያለፉ ቀናት', targetDays: 'ዒላማ ቀናት', elapsedDays: 'ያለፉ ቀናት', complianceRate: 'የተገዢነት መጠን', breaches: 'ጥሰቶች' },
    testing: { title: 'የውህደት ሙከራ', runTest: 'ሙከራ አሂድ', testScenarios: 'የሙከራ ሁኔታዎች', certificationProgress: 'የምስክር ወረቀት ሂደት', sandboxCredentials: 'የሙከራ ማረጋገጫዎች', passed: 'አልፏል', failed: 'አልተሳካም', running: 'በመሄድ ላይ', pending: 'በመጠባበቅ ላይ' },
  },

  // Zulu (South Africa)
  zu: {
    common: { save: 'Gcina', cancel: 'Khansela', submit: 'Thumela', delete: 'Susa', edit: 'Hlela', view: 'Buka', search: 'Sesha', filter: 'Hlunga', refresh: 'Vuselela', loading: 'Iyalayisha...', error: 'Iphutha', success: 'Impumelelo', warning: 'Isexwayiso', confirm: 'Qinisekisa', back: 'Emuva', next: 'Okulandelayo', previous: 'Okwedlule', close: 'Vala', download: 'Landa', upload: 'Layisha', export: 'Thumela', import: 'Ngenisa' },
    auth: { login: 'Ngena', logout: 'Phuma', email: 'I-imeyili', password: 'Iphasiwedi', forgotPassword: 'Ukhohlwe iphasiwedi?', rememberMe: 'Ngikhumbule', signIn: 'Ngena', signUp: 'Bhalisa', welcomeBack: 'Siyakwamukela futhi', invalidCredentials: 'I-imeyili noma iphasiwedi ayilungile' },
    navigation: { dashboard: 'Idashbhodi', onboarding: 'Ukubhalisa', kyc: 'Yazi Ikhasimende Lakho', kyb: 'Yazi Ibhizinisi Lakho', users: 'Abasebenzisi', settings: 'Izilungiselelo', reports: 'Imibiko', compliance: 'Ukuthobela', integrations: 'Ukuhlanganiswa' },
    onboarding: { title: 'Ukubhalisa', newApplication: 'Isicelo esisha', pendingApplications: 'Izicelo ezilindile', approvedApplications: 'Izicelo ezigunyaziwe', rejectedApplications: 'Izicelo ezenqatshiwe', organizationName: 'Igama lenhlangano', stakeholderType: 'Uhlobo lomuntu onentshisekelo', registrationNumber: 'Inombolo yokubhalisa', country: 'Izwe', contactName: 'Igama lokuxhumana', contactEmail: 'I-imeyili yokuxhumana', contactPhone: 'Ucingo lokuxhumana', documents: 'Amadokhumenti', keyPersonnel: 'Abasebenzi abahloniphekile', directors: 'Abaqondisi', shareholders: 'Abanikazi bamasheya', ubos: 'Abanikazi bokugcina', submitApplication: 'Thumela isicelo', saveDraft: 'Gcina idrafti', applicationStatus: 'Isimo sesicelo', bulkOnboarding: 'Ukubhalisa okuningi', templateCloning: 'Ukukopisha isifanekiso', slaTracking: 'Ukulandelela i-SLA', integrationTesting: 'Ukuhlola ukuhlanganiswa' },
    kyc: { title: 'Ukuqinisekiswa kwe-KYC', verifyIdentity: 'Qinisekisa ubunikazi', documentUpload: 'Layisha idokhumenti', selfieVerification: 'Ukuqinisekiswa kwesithombe', addressVerification: 'Ukuqinisekiswa kwekheli', ninVerification: 'Ukuqinisekiswa kwe-NIN', bvnVerification: 'Ukuqinisekiswa kwe-BVN', passportVerification: 'Ukuqinisekiswa kwephasipoti', verificationStatus: 'Isimo sokuqinisekiswa', pending: 'Kulindile', verified: 'Kuqinisekisiwe', failed: 'Kuhlulekile', expired: 'Kuphelelwe' },
    kyb: { title: 'Ukuqinisekiswa kwe-KYB', companyVerification: 'Ukuqinisekiswa kwenkampani', cacVerification: 'Ukuqinisekiswa kwe-CAC', directorVerification: 'Ukuqinisekiswa komqondisi', shareholderVerification: 'Ukuqinisekiswa komnikazi wesheya', uboVerification: 'Ukuqinisekiswa kwe-UBO', documentReview: 'Ukubuyekeza amadokhumenti', riskAssessment: 'Ukuhlola ingozi' },
    sla: { title: 'Ukulandelela i-SLA', onTrack: 'Kusendleleni', atRisk: 'Kusengozini', overdue: 'Kudlulelwe', daysRemaining: 'Izinsuku ezisele', daysOverdue: 'Izinsuku ezidlulelwe', targetDays: 'Izinsuku ezihlosiwe', elapsedDays: 'Izinsuku ezidlulile', complianceRate: 'Izinga lokuthobela', breaches: 'Ukwephulwa' },
    testing: { title: 'Ukuhlola ukuhlanganiswa', runTest: 'Qalisa ukuhlola', testScenarios: 'Izimo zokuhlola', certificationProgress: 'Inqubekela phambili yesitifiketi', sandboxCredentials: 'Imininingwane yesandbox', passed: 'Kudlulile', failed: 'Kuhlulekile', running: 'Kuyasebenza', pending: 'Kulindile' },
  },
};

export function getTranslation(lang: Language): Translations {
  return translations[lang] || translations.en;
}

export function t(lang: Language, key: string): string {
  const parts = key.split('.');
  let result: unknown = translations[lang];
  
  for (const part of parts) {
    if (result && typeof result === 'object' && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  
  return typeof result === 'string' ? result : key;
}
