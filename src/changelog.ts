export type ChangelogChange = {
  type: "feat" | "fix" | "chore";
  label: string;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  changes: ChangelogChange[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.9",
    date: "Avril 2026",
    changes: [
      {
        type: "feat",
        label:
          "Recherche de contacts par nom de société dans la création de tâche",
      },
      {
        type: "fix",
        label:
          "Opportunités : correction du filtre qui masquait les deals sans vue assignée",
      },
      {
        type: "fix",
        label: "Sauvegarde du type de société (Investisseur/Partenaire) sur le deal",
      },
    ],
  },
  {
    version: "v1.8",
    date: "Mars 2026",
    changes: [
      {
        type: "feat",
        label: "Vues Kanban personnalisées avec persistance des préférences",
      },
      {
        type: "fix",
        label: "Correction d'un bug affichant un deal dans deux vues simultanément",
      },
      {
        type: "fix",
        label: "Synchronisation du cache React Query à la création d'une vue",
      },
    ],
  },
];
