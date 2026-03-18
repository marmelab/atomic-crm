# Nosho CRM

Un CRM complet et moderne construit avec React 19, shadcn/ui, et Supabase.

> Fork de [Atomic CRM](https://github.com/marmelab/atomic-crm) par Marmelab, adapté et personnalisé pour Nosho.

## Features

- 📇 **Contacts & Sociétés** — Gestion centralisée de vos contacts et entreprises
- 📊 **Pipeline Kanban** — Visualisez et pilotez vos opportunités en drag & drop
- ⚡ **Alertes Slack temps réel** — Notifications instantanées à chaque nouveau deal (PostgreSQL triggers)
- 📝 **Notes & Activités** — Historique complet des interactions
- 🔄 **Import & Export** — CSV, données facilement transférables
- 🔐 **Authentification** — Email/mot de passe + Google SSO
- 🌍 **Multilingue** — Français & Anglais
- 🎨 **Thème personnalisé** — Design Nosho avec dark mode

## Tech Stack

### Core

| Technologie | Version | Rôle |
|---|---|---|
| React | 19.1 | Framework UI |
| TypeScript | 5.8 | Typage statique |
| Vite | 7.3 | Bundler & dev server |
| React Router | 7.13 | Navigation SPA |

### UI & Design System

| Technologie | Version | Rôle |
|---|---|---|
| Tailwind CSS | 4.1 | Utility-first CSS |
| shadcn/ui | 3.5 | Composants UI (36 installés) |
| Radix UI | — | Primitives accessibles (18 packages) |
| Lucide React | 0.542 | Bibliothèque d'icônes |
| class-variance-authority | 0.7 | Variants de composants |

### Data & Backend

| Technologie | Version | Rôle |
|---|---|---|
| Supabase | — | Backend-as-a-Service (Auth, DB, Storage) |
| React Admin (ra-core) | 5.14 | Framework CRUD/admin |
| TanStack React Query | 5.90 | Cache & data fetching |
| React Hook Form | 7.71 | Gestion de formulaires |
| Zod | 4.1 | Validation de schémas |

### Visualisation & UX

| Technologie | Version | Rôle |
|---|---|---|
| Nivo | 0.99 | Graphiques (barres) |
| @hello-pangea/dnd | 18.0 | Drag & drop (pipeline Kanban) |
| cmdk | 1.1 | Command palette (⌘K) |
| Sonner | 2.0 | Toasts / notifications |
| Vaul | 1.1 | Drawer mobile |

### Monitoring & Qualité

| Technologie | Version | Rôle |
|---|---|---|
| Sentry | 10.43 | Error tracking production |
| Vitest | 3.2 | Tests unitaires |
| ESLint | 9.22 | Linting |
| Prettier | 3.6 | Formatting |
| Husky | 9.1 | Git hooks (pre-commit) |

### Utilitaires

| Technologie | Rôle |
|---|---|
| Lodash | Utilitaires JS |
| PapaParse | Parsing CSV |
| Marked | Markdown → HTML |
| DOMPurify | Sanitisation HTML (XSS) |
| next-themes | Thème clair/sombre |

## Déploiement

| Élément | Service |
|---|---|
| **Hébergement** | Coolify Cloud + Scaleway |
| **Base de données** | Supabase (PostgreSQL) |
| **CI/CD** | GitHub → Coolify (auto-deploy sur push) |
| **Monitoring** | Sentry |
| **Notifications** | Slack (via PostgreSQL triggers) |

## Installation locale

Prérequis : Node 22 LTS, Docker

```sh
git clone https://github.com/nosho-org/nosho-crm.git
cd nosho-crm
npm install
npm run dev
```

L'app est accessible sur [http://localhost:5173](http://localhost:5173).

## License

Ce projet est sous licence MIT, basé sur [Atomic CRM](https://github.com/marmelab/atomic-crm) par [Marmelab](https://marmelab.com).
