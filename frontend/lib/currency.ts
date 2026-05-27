export type CurrencyCode = "USD" | "INR" | "EUR" | "GBP";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
  plans: {
    free: number;
    pro: number;
    max: number; // -1 represents custom/Contact Sales
  };
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD ($)",
    locale: "en-US",
    plans: {
      free: 0,
      pro: 19,
      max: -1,
    },
  },
  INR: {
    code: "INR",
    symbol: "₹",
    label: "INR (₹)",
    locale: "en-IN",
    plans: {
      free: 0,
      pro: 1299,
      max: -1,
    },
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    label: "EUR (€)",
    locale: "de-DE",
    plans: {
      free: 0,
      pro: 18,
      max: -1,
    },
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    label: "GBP (£)",
    locale: "en-GB",
    plans: {
      free: 0,
      pro: 17,
      max: -1,
    },
  },
};

// Auto-detect based on timezone and browser settings
export function detectUserCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";

  // Check saved preference
  const saved = localStorage.getItem("ff_currency") as CurrencyCode;
  if (saved && CURRENCIES[saved]) {
    return saved;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (tz.includes("Calcutta") || tz.includes("Kolkata") || tz === "Asia/Kolkata") {
        return "INR";
      }
      if (tz.includes("London") || tz.includes("Belfast") || tz.includes("Gibraltar")) {
        return "GBP";
      }
      if (
        tz.includes("Europe/") &&
        !tz.includes("London") &&
        !tz.includes("Kiev") &&
        !tz.includes("Moscow")
      ) {
        return "EUR";
      }
    }

    // Fallback locale check
    const locale = navigator.language;
    if (locale) {
      if (locale.endsWith("IN") || locale.startsWith("hi")) return "INR";
      if (locale.endsWith("GB")) return "GBP";
      if (
        locale.startsWith("fr") ||
        locale.startsWith("de") ||
        locale.startsWith("es") ||
        locale.startsWith("it") ||
        locale.startsWith("nl")
      ) {
        return "EUR";
      }
    }
  } catch {
    // Ignore and fallback
  }

  return "USD";
}

export function formatPrice(amount: number, config: CurrencyConfig): string {
  if (amount === 0) return "Free";
  if (amount === -1) return "Contact Sales";
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    maximumFractionDigits: 0,
  }).format(amount);
}
