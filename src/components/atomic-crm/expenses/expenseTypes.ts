export const expenseTypeChoices = [
  { id: "spostamento_km", name: "Spostamento Km" },
  { id: "pedaggio_autostradale", name: "Pedaggio autostradale" },
  { id: "vitto_alloggio", name: "Vitto e alloggio" },
  { id: "acquisto_materiale", name: "Acquisto materiale" },
  { id: "abbonamento_software", name: "Abbonamento software" },
  { id: "noleggio", name: "Noleggio" },
  { id: "credito_ricevuto", name: "Credito ricevuto" },
  { id: "altro", name: "Altro" },
] as const;

export const expenseTypeLabels: Record<string, string> = {
  spostamento_km: "Spostamento Km",
  pedaggio_autostradale: "Pedaggio autostradale",
  vitto_alloggio: "Vitto e alloggio",
  acquisto_materiale: "Acquisto materiale",
  abbonamento_software: "Abbonamento software",
  noleggio: "Noleggio",
  credito_ricevuto: "Credito ricevuto",
  altro: "Altro",
};

export const expenseTypeDescriptions: Record<string, string> = {
  spostamento_km: "Rimborso chilometrico per trasferta",
  pedaggio_autostradale: "Caselli, Telepass, pedaggi",
  vitto_alloggio: "Pranzo, cena, hotel, pernottamento",
  acquisto_materiale: "Hard disk, cavi, accessori, ecc.",
  abbonamento_software: "Claude, Adobe, hosting, domini, SaaS",
  noleggio: "Noleggio attrezzatura (droni, luci, ecc.)",
  credito_ricevuto: "Bene o sconto ricevuto dal cliente (riduce il dovuto)",
  altro: "Spesa non classificata",
};
