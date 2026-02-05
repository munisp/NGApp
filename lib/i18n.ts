import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

// Translation resources
const resources = {
  en: {
    translation: {
      common: {
        welcome: "Welcome",
        continue: "Continue",
        cancel: "Cancel",
        save: "Save",
        loading: "Loading...",
        error: "Error",
        success: "Success"
      },
      home: {
        title: "African Fintech",
        subtitle: "Financial inclusion for everyone"
      }
    }
  },
  fr: {
    translation: {
      common: {
        welcome: "Bienvenue",
        continue: "Continuer",
        cancel: "Annuler",
        save: "Enregistrer",
        loading: "Chargement...",
        error: "Erreur",
        success: "Succès"
      },
      home: {
        title: "Fintech Africaine",
        subtitle: "Inclusion financière pour tous"
      }
    }
  },
  sw: {
    translation: {
      common: {
        welcome: "Karibu",
        continue: "Endelea",
        cancel: "Ghairi",
        save: "Hifadhi",
        loading: "Inapakia...",
        error: "Hitilafu",
        success: "Mafanikio"
      },
      home: {
        title: "Fedha ya Afrika",
        subtitle: "Ujumuishaji wa kifedha kwa kila mtu"
      }
    }
  },
  ha: {
    translation: {
      common: {
        welcome: "Barka da zuwa",
        continue: "Ci gaba",
        cancel: "Soke",
        save: "Ajiye",
        loading: "Ana lodi...",
        error: "Kuskure",
        success: "Nasara"
      },
      home: {
        title: "Fintech na Afirka",
        subtitle: "Haɗa kuɗi ga kowa"
      }
    }
  },
  yo: {
    translation: {
      common: {
        welcome: "Ẹ káàbọ̀",
        continue: "Tẹ̀síwájú",
        cancel: "Fagilee",
        save: "Fi pamọ",
        loading: "Ń gbé...",
        error: "Àṣìṣe",
        success: "Àṣeyọrí"
      },
      home: {
        title: "Fintech ti Áfríkà",
        subtitle: "Ìfowópamọ́ owó fún gbogbo ènìyàn"
      }
    }
  },
  ig: {
    translation: {
      common: {
        welcome: "Nnọọ",
        continue: "Gaa n'ihu",
        cancel: "Kagbuo",
        save: "Chekwaa",
        loading: "Na-ebu...",
        error: "Njehie",
        success: "Ihe ịga nke ọma"
      },
      home: {
        title: "Fintech nke Africa",
        subtitle: "Ntinye ego maka onye ọ bụla"
      }
    }
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getLocales()[0]?.languageCode || 'en', // Use device language
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
