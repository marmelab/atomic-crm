import { diffBusinessDays, todayISODate } from "@/lib/dateTimezone";

export const getPaymentReminderDaysOverdue = (
  paymentDate?: string | null,
  todayIso = todayISODate(),
): number => {
  if (!paymentDate) return 0;

  const daysOverdue = diffBusinessDays(paymentDate, todayIso);
  if (daysOverdue == null) return 0;

  return Math.max(1, Math.abs(daysOverdue));
};
