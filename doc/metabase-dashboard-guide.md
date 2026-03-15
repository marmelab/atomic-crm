# Guide Dashboard Metabase - Nosho CRM

## Vues Analytics disponibles

15 vues SQL ont été créées dans Supabase, préfixées `analytics_*`. Elles sont directement exploitables dans Metabase.

> **Note** : Les montants (`amount`) sont stockés en **centimes**. Divisez par 100 dans Metabase pour afficher en euros.

---

## Dashboard recommandé : structure en 5 onglets

### Onglet 1 : Vue d'ensemble (KPIs)

**Source** : `analytics_kpis` (1 seule ligne, parfait pour des "number cards")

| Card | Champ | Format |
|------|-------|--------|
| Deals actifs | `active_deals` | Number |
| Pipeline actif (€) | `active_pipeline_value / 100` | Currency |
| Pipeline pondéré (€) | `weighted_pipeline_value / 100` | Currency |
| Revenue ce mois (€) | `revenue_this_month / 100` | Currency |
| Revenue ce trimestre (€) | `revenue_this_quarter / 100` | Currency |
| Win rate global | `global_win_rate_pct` | Percent |
| Deal moyen gagné (€) | `avg_won_deal_size / 100` | Currency |
| Cycle de vente moyen | `avg_sales_cycle_days` | Number + "jours" |
| Nouveaux deals ce mois | `new_deals_this_month` | Number |

---

### Onglet 2 : Pipeline & Funnel

#### 2.1 Pipeline par stage (bar chart horizontal)
**Source** : `analytics_pipeline_by_stage`
- X : `stage`, Y : `total_amount / 100`
- Couleur par stage
- Afficher aussi `nb_deals` en label

#### 2.2 Funnel de conversion (funnel chart)
**Source** : `analytics_conversion_funnel`
- Stages : `stage`, Valeur : `nb_deals_reached`
- Label : `conversion_rate_pct` %

#### 2.3 Pipeline détaillé (table)
**Source** : `analytics_pipeline_overview`
- Filtrer : `deal_status = 'active'`
- Colonnes : deal_name, company_name, stage, amount/100, weighted_amount/100, deal_age_days, sales_name
- Tri : weighted_amount DESC

#### 2.4 Forecast revenus (stacked bar chart)
**Source** : `analytics_revenue_forecast`
- X : `forecast_month`, Y : `weighted_amount / 100`
- Stack par `stage`
- Filtrer les mois futurs

---

### Onglet 3 : Revenus & Segments

#### 3.1 Revenus mensuels (line chart)
**Source** : `analytics_monthly_revenue`
- X : `revenue_month`, Y : `total_revenue / 100`
- Ligne secondaire : `nb_deals_won`

#### 3.2 Revenue par catégorie médicale (bar chart)
**Source** : `analytics_revenue_by_category`
- X : `category`, Y : `revenue_won / 100`
- Couleur : `win_rate_pct`
- Tri : revenue_won DESC

#### 3.3 Revenue par secteur (bar chart)
**Source** : `analytics_revenue_by_sector`
- X : `sector`, Y : `revenue_won / 100`
- Afficher `nb_companies` et `win_rate_pct`

#### 3.4 Performance par taille d'entreprise (bar chart)
**Source** : `analytics_by_company_size`
- X : `company_size_label`, Y : `revenue_won / 100`
- Ligne : `win_rate_pct`

#### 3.5 Timeline des deals (area chart)
**Source** : `analytics_deals_timeline`
- X : `month`
- Y stacked : `nb_won`, `nb_lost`, `nb_still_active`

---

### Onglet 4 : Performance commerciale

#### 4.1 Scorecard commerciaux (table)
**Source** : `analytics_sales_performance`
- Colonnes : sales_name, nb_deals_won, revenue_won/100, win_rate_pct, avg_sales_cycle_days, pipeline_value/100
- Conditional formatting sur win_rate_pct

#### 4.2 Activité par semaine (line chart)
**Source** : `analytics_activity`
- X : `week`, Y : `nb_activities`
- Filtrer par `sales_name`
- Stack par `activity_type`

#### 4.3 Win/Loss analysis (table)
**Source** : `analytics_win_loss`
- Filtres : outcome, category, company_sector
- Colonnes : deal_name, outcome, company_name, amount/100, cycle_days, sales_name

---

### Onglet 5 : Essais & Engagement

#### 5.1 Suivi des essais (table + KPIs)
**Source** : `analytics_trials`
- KPI : taux de conversion trial → won
- Table : deal_name, company_name, trial_start_date, trial_duration_days, trial_outcome
- Filtrer `trial_outcome`

#### 5.2 Engagement contacts (bar chart)
**Source** : `analytics_contacts_engagement`
- X : `cohort_month`
- Stack : nb_hot, nb_warm, nb_cold, nb_signed

---

## Métriques clés pour B2B SaaS Santé

### Métriques prioritaires à suivre

1. **Pipeline pondéré** (`weighted_pipeline_value`) - Revenus prévisionnels ajustés par probabilité de closing
2. **Win rate par segment** - Identifier quels types de structures de santé convertissent le mieux
3. **Cycle de vente moyen** - Typiquement 30-90 jours pour SaaS santé
4. **Trial conversion rate** - % d'essais convertis en clients payants
5. **Revenue par catégorie** - Quelles spécialités médicales génèrent le plus de revenus
6. **Taille d'entreprise idéale** - Solo vs cabinet vs hôpital : quel ICP convertit le mieux

### Alertes recommandées (Metabase Alerts)

- Pipeline pondéré < seuil mensuel
- Deals actifs sans mise à jour depuis > 14 jours
- Win rate en baisse sur 3 mois glissants
- Essais en cours depuis > 30 jours sans conversion

---

## Requêtes SQL custom utiles pour Metabase

### Deals stagnants (pas de mise à jour depuis 14j)
```sql
SELECT * FROM analytics_pipeline_overview
WHERE deal_status = 'active'
  AND updated_at < NOW() - INTERVAL '14 days'
ORDER BY deal_age_days DESC;
```

### Top 10 deals par valeur pondérée
```sql
SELECT deal_name, company_name, stage, amount/100 as amount_eur,
       weighted_amount/100 as weighted_eur, sales_name
FROM analytics_pipeline_overview
WHERE deal_status = 'active'
ORDER BY weighted_amount DESC
LIMIT 10;
```

### Évolution mensuelle du win rate
```sql
SELECT
    DATE_TRUNC('month', updated_at) AS month,
    ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'closed-won')
      / NULLIF(COUNT(*) FILTER (WHERE stage IN ('closed-won','perdu','trial-failed','declined')), 0), 1) AS win_rate
FROM deals
WHERE stage IN ('closed-won','perdu','trial-failed','declined')
GROUP BY 1
ORDER BY 1;
```

### Temps moyen par étape du pipeline
```sql
SELECT stage,
       ROUND(AVG(EXTRACT(DAY FROM (updated_at - created_at)))) AS avg_days
FROM deals
WHERE stage = 'closed-won'
GROUP BY stage;
```
