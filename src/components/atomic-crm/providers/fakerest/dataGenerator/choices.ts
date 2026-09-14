import type { Choice } from "../../../types";
import type { Db } from "./types";

/** Seeded option lists, mirroring supabase/migrations (`choices` table). */
export const choiceLabels: Record<string, string[]> = {
  company_sector: [
    "Services de communication",
    "Consommation discrétionnaire",
    "Consommation de base",
    "Énergie",
    "Finance",
    "Santé",
    "Industrie",
    "Technologies de l'information",
    "Matériaux",
    "Immobilier",
    "Services aux collectivités",
  ],
  deal_origin: [
    "Préventica",
    "Solutions CSE",
    "Site internet",
    "Prospection",
    "Linkedin",
    "Recommandation",
    "Partenaire",
  ],
  deal_objective: [
    "Sensibiliser",
    "Former",
    "Structurer une démarche",
    "Réduire les RPS",
    "Accompagner les managers",
    "Répondre à une obligation",
  ],
  rdv_mode: ["Présentiel", "Visioconférence", "Téléphone", "Salon"],
  rdv_type: [
    "Premier contact",
    "Rendez-vous découverte",
    "Rendez-vous de suivi",
    "Restitution",
    "Bilan annuel",
    "Préparation d'une proposition",
    "Lancement de mission",
  ],
};

export const generateChoices = (_?: Db): Choice[] => {
  let id = 0;
  return Object.entries(choiceLabels).flatMap(([category, labels]) =>
    labels.map((label) => ({ id: id++, category, label })),
  );
};
