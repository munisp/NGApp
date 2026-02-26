// ============================================================
// NEXCOM Exchange - Internationalization (i18n)
// ============================================================

import { create } from "zustand";

export type Locale = "en" | "sw" | "fr";

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.trade": "Trade",
    "nav.markets": "Markets",
    "nav.portfolio": "Portfolio",
    "nav.orders": "Orders",
    "nav.alerts": "Alerts",
    "nav.account": "Account",
    "nav.analytics": "Analytics",
    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "NEXCOM Exchange Overview",
    "dashboard.portfolioValue": "Portfolio Value",
    "dashboard.availableBalance": "Available Balance",
    "dashboard.unrealizedPnl": "Unrealized P&L",
    "dashboard.marginUsed": "Margin Used",
    "dashboard.openPositions": "Open Positions",
    "dashboard.recentOrders": "Recent Orders",
    "dashboard.marketOverview": "Market Overview",
    "dashboard.recentTrades": "Recent Trades",
    "dashboard.viewAll": "View all",
    // Trading
    "trade.placeOrder": "Place Order",
    "trade.buy": "Buy",
    "trade.sell": "Sell",
    "trade.orderBook": "Order Book",
    "trade.price": "Price",
    "trade.quantity": "Quantity",
    "trade.total": "Total",
    "trade.submit": "Submit Order",
    "trade.estMargin": "Est. Margin Required",
    "trade.estFee": "Est. Fee",
    // Markets
    "markets.title": "Markets",
    "markets.allMarkets": "All Markets",
    "markets.agricultural": "Agricultural",
    "markets.preciousMetals": "Precious Metals",
    "markets.energy": "Energy",
    "markets.carbonCredits": "Carbon Credits",
    "markets.search": "Search by symbol or name...",
    "markets.watchlist": "Watchlist",
    "markets.noResults": "No commodities found",
    // Portfolio
    "portfolio.title": "Portfolio",
    "portfolio.totalValue": "Total Value",
    "portfolio.unrealizedPnl": "Unrealized P&L",
    "portfolio.realizedPnl": "Realized P&L",
    "portfolio.availableMargin": "Available Margin",
    "portfolio.marginUtilization": "Margin Utilization",
    "portfolio.allocation": "Allocation",
    // Orders
    "orders.title": "Orders & Trades",
    "orders.openOrders": "Open Orders",
    "orders.orderHistory": "Order History",
    "orders.tradeHistory": "Trade History",
    "orders.cancel": "Cancel",
    "orders.noOpen": "No open orders",
    // Alerts
    "alerts.title": "Price Alerts",
    "alerts.newAlert": "+ New Alert",
    "alerts.create": "Create Price Alert",
    "alerts.commodity": "Commodity",
    "alerts.condition": "Condition",
    "alerts.targetPrice": "Target Price",
    "alerts.above": "Price goes above",
    "alerts.below": "Price goes below",
    // Account
    "account.title": "Account",
    "account.profile": "Profile",
    "account.kyc": "KYC Verification",
    "account.security": "Security",
    "account.preferences": "Preferences",
    // Analytics
    "analytics.title": "Analytics & Insights",
    "analytics.priceForecast": "AI Price Forecast",
    "analytics.geospatial": "Geospatial Analytics",
    "analytics.performance": "Performance Report",
    "analytics.anomaly": "Anomaly Detection",
    // Common
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.retry": "Retry",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.connected": "Connected",
    "common.disconnected": "Disconnected",
    "common.marketsOpen": "Markets Open",
    "common.marketsClosed": "Markets Closed",
    // Auth
    "auth.signIn": "Sign In",
    "auth.signOut": "Sign Out",
    "auth.email": "Email Address",
    "auth.password": "Password",
    "auth.demo": "Try Demo Mode",
    "auth.sso": "Sign in with Keycloak SSO",
  },
  sw: {
    "nav.dashboard": "Dashibodi",
    "nav.trade": "Biashara",
    "nav.markets": "Masoko",
    "nav.portfolio": "Kwingingi",
    "nav.orders": "Amri",
    "nav.alerts": "Tahadhari",
    "nav.account": "Akaunti",
    "nav.analytics": "Uchambuzi",
    "dashboard.title": "Dashibodi",
    "dashboard.subtitle": "Muhtasari wa NEXCOM",
    "dashboard.portfolioValue": "Thamani ya Kwingingi",
    "dashboard.availableBalance": "Salio Inayopatikana",
    "dashboard.unrealizedPnl": "Faida Isiyothibitishwa",
    "dashboard.marginUsed": "Dhamana Iliyotumika",
    "dashboard.openPositions": "Nafasi Wazi",
    "dashboard.recentOrders": "Amri za Hivi Karibuni",
    "dashboard.marketOverview": "Muhtasari wa Soko",
    "dashboard.recentTrades": "Biashara za Hivi Karibuni",
    "dashboard.viewAll": "Tazama zote",
    "trade.placeOrder": "Weka Amri",
    "trade.buy": "Nunua",
    "trade.sell": "Uza",
    "trade.orderBook": "Kitabu cha Amri",
    "trade.price": "Bei",
    "trade.quantity": "Kiasi",
    "trade.total": "Jumla",
    "markets.title": "Masoko",
    "markets.allMarkets": "Masoko Yote",
    "markets.agricultural": "Kilimo",
    "markets.preciousMetals": "Metali za Thamani",
    "markets.energy": "Nishati",
    "markets.carbonCredits": "Mikopo ya Kaboni",
    "markets.search": "Tafuta kwa alama au jina...",
    "markets.watchlist": "Orodha ya Ufuatiliaji",
    "portfolio.title": "Kwingingi",
    "orders.title": "Amri na Biashara",
    "alerts.title": "Tahadhari za Bei",
    "account.title": "Akaunti",
    "analytics.title": "Uchambuzi na Maarifa",
    "common.loading": "Inapakia...",
    "common.error": "Hitilafu imetokea",
    "common.connected": "Imeunganishwa",
    "common.marketsOpen": "Masoko Yamefunguliwa",
    "auth.signIn": "Ingia",
    "auth.signOut": "Toka",
    "auth.demo": "Jaribu Hali ya Maonyesho",
  },
  fr: {
    "nav.dashboard": "Tableau de bord",
    "nav.trade": "Trading",
    "nav.markets": "Marches",
    "nav.portfolio": "Portefeuille",
    "nav.orders": "Ordres",
    "nav.alerts": "Alertes",
    "nav.account": "Compte",
    "nav.analytics": "Analytique",
    "dashboard.title": "Tableau de bord",
    "dashboard.subtitle": "Vue d'ensemble NEXCOM",
    "dashboard.portfolioValue": "Valeur du Portefeuille",
    "dashboard.availableBalance": "Solde Disponible",
    "dashboard.unrealizedPnl": "P&L Non Realise",
    "dashboard.marginUsed": "Marge Utilisee",
    "dashboard.openPositions": "Positions Ouvertes",
    "dashboard.recentOrders": "Ordres Recents",
    "dashboard.marketOverview": "Apercu du Marche",
    "dashboard.recentTrades": "Transactions Recentes",
    "dashboard.viewAll": "Voir tout",
    "trade.placeOrder": "Passer un Ordre",
    "trade.buy": "Acheter",
    "trade.sell": "Vendre",
    "trade.orderBook": "Carnet d'Ordres",
    "trade.price": "Prix",
    "trade.quantity": "Quantite",
    "trade.total": "Total",
    "markets.title": "Marches",
    "markets.allMarkets": "Tous les Marches",
    "markets.agricultural": "Agricole",
    "markets.preciousMetals": "Metaux Precieux",
    "markets.energy": "Energie",
    "markets.carbonCredits": "Credits Carbone",
    "markets.search": "Rechercher par symbole ou nom...",
    "markets.watchlist": "Liste de suivi",
    "portfolio.title": "Portefeuille",
    "orders.title": "Ordres et Transactions",
    "alerts.title": "Alertes de Prix",
    "account.title": "Compte",
    "analytics.title": "Analytique et Perspectives",
    "common.loading": "Chargement...",
    "common.error": "Une erreur est survenue",
    "common.connected": "Connecte",
    "common.marketsOpen": "Marches Ouverts",
    "auth.signIn": "Se Connecter",
    "auth.signOut": "Se Deconnecter",
    "auth.demo": "Essayer le Mode Demo",
  },
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  sw: "Kiswahili",
  fr: "Francais",
};

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: "en",
  setLocale: (locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nexcom_locale", locale);
      document.documentElement.lang = locale;
    }
    set({ locale });
  },
  t: (key: string) => {
    const { locale } = get();
    return translations[locale][key] || translations.en[key] || key;
  },
}));

// Initialize locale from localStorage
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("nexcom_locale") as Locale | null;
  if (saved && translations[saved]) {
    useI18nStore.setState({ locale: saved });
  }
}
