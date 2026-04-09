const PRODUCT_TYPE_LABELS: Record<string, string> = {
  thermique: "Tondeuse thermique",
  electrique: "Tondeuse électrique",
  robot: "Robot tondeuse",
  autoportee: "Autoportée",
  accessoires: "Accessoires",
};

export const formatPrice = (centimes: number | null): string => {
  if (centimes === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(centimes / 100);
};

export const getProductTypeLabel = (type: string): string =>
  PRODUCT_TYPE_LABELS[type] ?? type;

export const PRODUCT_TYPE_CHOICES = Object.entries(PRODUCT_TYPE_LABELS).map(
  ([value, label]) => ({ id: value, name: label }),
);
