const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  "a-renouveler": "À renouveler",
  resilier: "Résilié",
};

export const STATUS_CHOICES = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ id: value, name: label }),
);

export const daysUntilRenewal = (renewalDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  return Math.round(
    (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
};

export const isExpiringSoon = (
  renewalDate: string,
  thresholdDays = 60,
): boolean => daysUntilRenewal(renewalDate) <= thresholdDays;

export const getStatusLabel = (status: string): string =>
  STATUS_LABELS[status] ?? status;

export const formatPrice = (amount: number | null): string => {
  if (amount == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};
