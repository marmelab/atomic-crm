/** Formatting helpers used across dashboard charts and components. */

export const projectCategoryLabels: Record<string, string> = {
  produzione_tv: "Produzione TV",
  spot: "Spot",
  wedding: "Wedding",
  evento_privato: "Evento privato",
  sviluppo_web: "Sviluppo web",
  __flat: "Servizi diretti",
};

export const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

export const formatCurrencyPrecise = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

export const formatCompactCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  });

export const formatShortDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const formatDayMonth = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "--";
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
};

export const getCategoryLabel = (category: string) =>
  projectCategoryLabels[category] ?? category;
