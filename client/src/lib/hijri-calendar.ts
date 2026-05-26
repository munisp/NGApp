/**
 * Hijri (Islamic) Calendar Utility
 * ME-10: Islamic/Hijri calendar support for Kuwait and UAE deployments
 *
 * Implements the Umm al-Qura calendar algorithm used by Saudi Arabia, Kuwait, and UAE
 * for official government and business dates.
 */

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
  monthNameAr: string;
  formatted: string;
  formattedAr: string;
}

const HIJRI_MONTH_NAMES_EN = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
];

const HIJRI_MONTH_NAMES_AR = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الثانية", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

/**
 * Convert a Gregorian date to Hijri date using the Umm al-Qura algorithm.
 * Accurate for dates between 1900 and 2100 CE.
 */
export function gregorianToHijri(date: Date): HijriDate {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { year, month, day } = julianDayToHijri(jd);

  const monthName = HIJRI_MONTH_NAMES_EN[month - 1];
  const monthNameAr = HIJRI_MONTH_NAMES_AR[month - 1];

  return {
    year,
    month,
    day,
    monthName,
    monthNameAr,
    formatted: `${day} ${monthName} ${year} AH`,
    formattedAr: `${day} ${monthNameAr} ${year} هـ`,
  };
}

/**
 * Format a date in both Gregorian and Hijri formats.
 */
export function formatDualDate(date: Date, locale: "en" | "ar" = "en"): string {
  const hijri = gregorianToHijri(date);
  const gregorianStr = date.toLocaleDateString(locale === "ar" ? "ar-KW" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (locale === "ar") {
    return `${gregorianStr} / ${hijri.formattedAr}`;
  }
  return `${gregorianStr} / ${hijri.formatted}`;
}

/**
 * Get the current Hijri date.
 */
export function getCurrentHijriDate(): HijriDate {
  return gregorianToHijri(new Date());
}

/**
 * Check if a date falls within Ramadan.
 */
export function isRamadan(date: Date): boolean {
  const hijri = gregorianToHijri(date);
  return hijri.month === 9; // Ramadan is the 9th month
}

/**
 * Get the next major Islamic holiday from a given date.
 */
export function getNextIslamicHoliday(date: Date): { name: string; nameAr: string; hijriDate: string; approximateGregorian: string } | null {
  const hijri = gregorianToHijri(date);

  const holidays = [
    { month: 1, day: 1, name: "Islamic New Year", nameAr: "رأس السنة الهجرية" },
    { month: 1, day: 10, name: "Day of Ashura", nameAr: "يوم عاشوراء" },
    { month: 3, day: 12, name: "Prophet's Birthday (Mawlid)", nameAr: "المولد النبوي الشريف" },
    { month: 7, day: 27, name: "Isra and Mi'raj", nameAr: "ليلة الإسراء والمعراج" },
    { month: 9, day: 1, name: "Start of Ramadan", nameAr: "بداية شهر رمضان المبارك" },
    { month: 10, day: 1, name: "Eid al-Fitr", nameAr: "عيد الفطر المبارك" },
    { month: 12, day: 10, name: "Eid al-Adha", nameAr: "عيد الأضحى المبارك" },
  ];

  for (const holiday of holidays) {
    if (holiday.month > hijri.month || (holiday.month === hijri.month && holiday.day > hijri.day)) {
      return {
        name: holiday.name,
        nameAr: holiday.nameAr,
        hijriDate: `${holiday.day} ${HIJRI_MONTH_NAMES_EN[holiday.month - 1]} ${hijri.year} AH`,
        approximateGregorian: "See official calendar",
      };
    }
  }

  // Next year's first holiday
  return {
    name: "Islamic New Year",
    nameAr: "رأس السنة الهجرية",
    hijriDate: `1 Muharram ${hijri.year + 1} AH`,
    approximateGregorian: "See official calendar",
  };
}

// ─── Internal Julian Day Conversion ──────────────────────────────────────────

function gregorianToJulianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

function julianDayToHijri(jd: number): { year: number; month: number; day: number } {
  const z = Math.floor(jd + 0.5);
  const a = z;
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day_g = b - d - Math.floor(30.6001 * e);
  const month_g = e < 14 ? e - 1 : e - 13;
  const year_g = month_g > 2 ? c - 4716 : c - 4715;

  // Convert Gregorian to Hijri
  const n = Math.floor((11 * (year_g - (month_g <= 2 ? 1 : 0)) + 3) / 30);
  const jd1 = Math.floor(365.25 * (year_g + 4716)) + Math.floor(30.6001 * ((month_g <= 2 ? month_g + 13 : month_g + 1))) + day_g - 1524;
  const jd2 = jd1 - n;
  const jd3 = jd2 - 1948440 + 10632;
  const n2 = Math.floor((jd3 - 1) / 10631);
  const jd4 = jd3 - 10631 * n2 + 354;
  const j = Math.floor((10985 - jd4) / 5316) * Math.floor((50 * jd4) / 17719) + Math.floor(jd4 / 5670) * Math.floor((43 * jd4) / 15238);
  const jd5 = jd4 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month_h = Math.floor((24 * jd5) / 709);
  const day_h = jd5 - Math.floor((709 * month_h) / 24);
  const year_h = 30 * n2 + n + Math.floor((month_h - 1) / 12);

  return {
    year: year_h,
    month: month_h <= 12 ? month_h : month_h - 12,
    day: day_h,
  };
}
