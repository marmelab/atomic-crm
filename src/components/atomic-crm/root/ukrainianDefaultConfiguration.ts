import type { ConfigurationContextValue } from "./ConfigurationContext";
import { defaultConfiguration } from "./defaultConfiguration";

/**
 * Default labels for a Ukrainian interface. The values are the same as in
 * defaultConfiguration (records store values, not labels), so switching the
 * language never breaks existing deals, notes or tasks. Labels a business set
 * in its settings take precedence over these.
 */
export const ukrainianDefaultConfiguration: ConfigurationContextValue = {
  ...defaultConfiguration,
  companySectors: [
    { value: "communication-services", label: "Звʼязок і медіа" },
    { value: "consumer-discretionary", label: "Товари та послуги для людей" },
    { value: "consumer-staples", label: "Продукти й товари щоденного вжитку" },
    { value: "energy", label: "Енергетика" },
    { value: "financials", label: "Фінанси" },
    { value: "health-care", label: "Медицина" },
    { value: "industrials", label: "Промисловість і транспорт" },
    { value: "information-technology", label: "IT" },
    { value: "materials", label: "Матеріали й сировина" },
    { value: "real-estate", label: "Нерухомість" },
    { value: "utilities", label: "Комунальні послуги" },
  ],
  dealStages: [
    { value: "opportunity", label: "Нова" },
    { value: "proposal-sent", label: "Пропозицію надіслано" },
    { value: "in-negociation", label: "Переговори" },
    { value: "won", label: "Виграно" },
    { value: "lost", label: "Програно" },
    { value: "delayed", label: "Відкладено" },
  ],
  dealCategories: [
    { value: "other", label: "Інше" },
    { value: "copywriting", label: "Тексти" },
    { value: "print-project", label: "Друк" },
    { value: "ui-design", label: "Дизайн інтерфейсу" },
    { value: "website-design", label: "Сайт" },
  ],
  noteStatuses: [
    { value: "cold", label: "Холодний", color: "#7dbde8" },
    { value: "warm", label: "Теплий", color: "#e8cb7d" },
    { value: "hot", label: "Гарячий", color: "#e88b7d" },
    { value: "in-contract", label: "Договір", color: "#a4e87d" },
  ],
  taskTypes: [
    { value: "none", label: "Без типу" },
    { value: "email", label: "Лист" },
    { value: "demo", label: "Демонстрація" },
    { value: "lunch", label: "Обід" },
    { value: "meeting", label: "Зустріч" },
    { value: "follow-up", label: "Нагадати" },
    { value: "thank-you", label: "Подякувати" },
    { value: "ship", label: "Відправити" },
    { value: "call", label: "Дзвінок" },
  ],
};
