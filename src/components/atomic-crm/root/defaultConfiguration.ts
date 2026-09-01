import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";

export const defaultCurrency = "USD";

export const defaultTitle = "سی آر ام اتمیک";

export const defaultCompanySectors = [
  { value: "communication-services", label: "خدمات ارتباطی" },
  { value: "consumer-discretionary", label: "کالاهای مصرفی اختیاری" },
  { value: "consumer-staples", label: "کالاهای اساسی مصرفی" },
  { value: "energy", label: "انرژی" },
  { value: "financials", label: "مالی" },
  { value: "health-care", label: "بهداشت و درمان" },
  { value: "industrials", label: "صنعتی" },
  { value: "information-technology", label: "فناوری اطلاعات" },
  { value: "materials", label: "مواد" },
  { value: "real-estate", label: "املاک و مستغلات" },
  { value: "utilities", label: "خدمات عمومی" },
];

export const defaultDealStages = [
  { value: "opportunity", label: "فرصت" },
  { value: "proposal-sent", label: "پیشنهاد ارسال شد" },
  { value: "in-negociation", label: "در مذاکره" },
  { value: "won", label: "برنده" },
  { value: "lost", label: "باخته" },
  { value: "delayed", label: "به تعویق افتاده" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "other", label: "سایر" },
  { value: "copywriting", label: "کپی‌رایتینگ" },
  { value: "print-project", label: "پروژه چاپ" },
  { value: "ui-design", label: "طراحی رابط کاربری" },
  { value: "website-design", label: "طراحی وب‌سایت" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "سرد", color: "#7dbde8" },
  { value: "warm", label: "گرم", color: "#e8cb7d" },
  { value: "hot", label: "داغ", color: "#e88b7d" },
  { value: "in-contract", label: "در قرارداد", color: "#a4e87d" },
];

export const defaultTaskTypes = [
  { value: "none", label: "هیچ‌کدام" },
  { value: "email", label: "ایمیل" },
  { value: "demo", label: "دمو" },
  { value: "lunch", label: "ناهار" },
  { value: "meeting", label: "جلسه" },
  { value: "follow-up", label: "پیگیری" },
  { value: "thank-you", label: "تشکر" },
  { value: "ship", label: "ارسال" },
  { value: "call", label: "تماس" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
