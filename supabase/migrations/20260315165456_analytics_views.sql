-- ============================================================================
-- Analytics Views for Metabase Dashboard
-- Nosho CRM - B2B SaaS Santé & Éditeurs Logiciels
-- ============================================================================

-- ============================================================================
-- 1. PIPELINE OVERVIEW
-- Vue principale du pipeline avec valeur pondérée par stage
-- ============================================================================
CREATE OR REPLACE VIEW analytics_pipeline_overview AS
SELECT
    d.id AS deal_id,
    d.name AS deal_name,
    d.stage,
    d.category,
    d.amount,
    d.created_at,
    d.updated_at,
    d.archived_at,
    d.expected_closing_date,
    d.trial_start_date,
    c.name AS company_name,
    c.sector AS company_sector,
    c.type AS company_type,
    c.size AS company_size,
    c.city AS company_city,
    s.first_name || ' ' || s.last_name AS sales_name,
    s.id AS sales_id,
    -- Pondération par stage (probabilité de closing)
    CASE d.stage
        WHEN 'lead' THEN 0.10
        WHEN 'qualified' THEN 0.30
        WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70
        WHEN 'trial' THEN 0.80
        WHEN 'closed-won' THEN 1.00
        WHEN 'perdu' THEN 0.00
        WHEN 'trial-failed' THEN 0.00
        WHEN 'declined' THEN 0.00
        ELSE 0.00
    END AS stage_weight,
    -- Valeur pondérée
    COALESCE(d.amount, 0) * CASE d.stage
        WHEN 'lead' THEN 0.10
        WHEN 'qualified' THEN 0.30
        WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70
        WHEN 'trial' THEN 0.80
        WHEN 'closed-won' THEN 1.00
        ELSE 0.00
    END AS weighted_amount,
    -- Statut du deal
    CASE
        WHEN d.stage IN ('closed-won') THEN 'won'
        WHEN d.stage IN ('perdu', 'trial-failed', 'declined') THEN 'lost'
        WHEN d.archived_at IS NOT NULL THEN 'archived'
        ELSE 'active'
    END AS deal_status,
    -- Âge du deal en jours
    EXTRACT(DAY FROM (COALESCE(d.archived_at, NOW()) - d.created_at)) AS deal_age_days,
    -- Nombre de contacts associés
    COALESCE(array_length(d.contact_ids, 1), 0) AS nb_contacts
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN sales s ON d.sales_id = s.id;

-- ============================================================================
-- 2. PIPELINE PAR STAGE (agrégé)
-- Résumé du pipeline groupé par étape
-- ============================================================================
CREATE OR REPLACE VIEW analytics_pipeline_by_stage AS
SELECT
    stage,
    COUNT(*) AS nb_deals,
    COUNT(*) FILTER (WHERE archived_at IS NULL AND stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS nb_active_deals,
    SUM(COALESCE(amount, 0)) AS total_amount,
    AVG(COALESCE(amount, 0)) FILTER (WHERE amount IS NOT NULL AND amount > 0) AS avg_deal_size,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(amount, 0)) FILTER (WHERE amount IS NOT NULL AND amount > 0) AS median_deal_size,
    MIN(created_at) AS oldest_deal,
    MAX(created_at) AS newest_deal,
    AVG(EXTRACT(DAY FROM (COALESCE(archived_at, NOW()) - created_at))) AS avg_deal_age_days
FROM deals
GROUP BY stage
ORDER BY
    CASE stage
        WHEN 'lead' THEN 1
        WHEN 'qualified' THEN 2
        WHEN 'follow-up' THEN 3
        WHEN 'rdv-prix' THEN 4
        WHEN 'trial' THEN 5
        WHEN 'closed-won' THEN 6
        WHEN 'perdu' THEN 7
        WHEN 'trial-failed' THEN 8
        WHEN 'declined' THEN 9
    END;

-- ============================================================================
-- 3. REVENUS MENSUELS (won deals)
-- MRR et tendances de revenus
-- ============================================================================
CREATE OR REPLACE VIEW analytics_monthly_revenue AS
SELECT
    DATE_TRUNC('month', COALESCE(d.trial_start_date::timestamp, d.expected_closing_date::timestamp, d.updated_at)) AS revenue_month,
    COUNT(*) AS nb_deals_won,
    SUM(COALESCE(d.amount, 0)) AS total_revenue,
    AVG(COALESCE(d.amount, 0)) FILTER (WHERE d.amount > 0) AS avg_deal_size,
    COUNT(*) FILTER (WHERE d.category IS NOT NULL) AS nb_categorized
FROM deals d
WHERE d.stage = 'closed-won'
GROUP BY DATE_TRUNC('month', COALESCE(d.trial_start_date::timestamp, d.expected_closing_date::timestamp, d.updated_at))
ORDER BY revenue_month;

-- ============================================================================
-- 4. REVENUS PAR CATÉGORIE (spécialité médicale / type)
-- Performance par segment de marché
-- ============================================================================
CREATE OR REPLACE VIEW analytics_revenue_by_category AS
SELECT
    COALESCE(d.category, 'non-categorise') AS category,
    COUNT(*) AS nb_deals_total,
    COUNT(*) FILTER (WHERE d.stage = 'closed-won') AS nb_deals_won,
    COUNT(*) FILTER (WHERE d.stage IN ('perdu', 'trial-failed', 'declined')) AS nb_deals_lost,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS nb_deals_active,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won') AS revenue_won,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS pipeline_value,
    AVG(COALESCE(d.amount, 0)) FILTER (WHERE d.amount > 0) AS avg_deal_size,
    CASE
        WHEN COUNT(*) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined')) > 0
        THEN ROUND(
            100.0 * COUNT(*) FILTER (WHERE d.stage = 'closed-won')
            / COUNT(*) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined'))
        , 1)
        ELSE NULL
    END AS win_rate_pct
FROM deals d
GROUP BY COALESCE(d.category, 'non-categorise')
ORDER BY revenue_won DESC NULLS LAST;

-- ============================================================================
-- 5. REVENUS PAR SECTEUR D'ENTREPRISE
-- Performance par secteur (santé, logiciel, etc.)
-- ============================================================================
CREATE OR REPLACE VIEW analytics_revenue_by_sector AS
SELECT
    COALESCE(c.sector, 'inconnu') AS sector,
    COUNT(DISTINCT c.id) AS nb_companies,
    COUNT(d.id) AS nb_deals_total,
    COUNT(d.id) FILTER (WHERE d.stage = 'closed-won') AS nb_deals_won,
    COUNT(d.id) FILTER (WHERE d.stage IN ('perdu', 'trial-failed', 'declined')) AS nb_deals_lost,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won') AS revenue_won,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS pipeline_value,
    AVG(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won' AND d.amount > 0) AS avg_won_deal_size,
    CASE
        WHEN COUNT(d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined')) > 0
        THEN ROUND(
            100.0 * COUNT(d.id) FILTER (WHERE d.stage = 'closed-won')
            / COUNT(d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined'))
        , 1)
        ELSE NULL
    END AS win_rate_pct
FROM companies c
LEFT JOIN deals d ON d.company_id = c.id
GROUP BY COALESCE(c.sector, 'inconnu')
ORDER BY revenue_won DESC NULLS LAST;

-- ============================================================================
-- 6. PERFORMANCE COMMERCIALE PAR SALES
-- KPIs individuels des commerciaux
-- ============================================================================
CREATE OR REPLACE VIEW analytics_sales_performance AS
SELECT
    s.id AS sales_id,
    s.first_name || ' ' || s.last_name AS sales_name,
    -- Deals
    COUNT(DISTINCT d.id) AS nb_deals_total,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS nb_deals_active,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') AS nb_deals_won,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('perdu', 'trial-failed', 'declined')) AS nb_deals_lost,
    -- Revenus
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won') AS revenue_won,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')) AS pipeline_value,
    -- Win rate
    CASE
        WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined')) > 0
        THEN ROUND(
            100.0 * COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won')
            / COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined'))
        , 1)
        ELSE NULL
    END AS win_rate_pct,
    -- Cycle de vente moyen (deals gagnés)
    AVG(EXTRACT(DAY FROM (COALESCE(d.archived_at, d.updated_at) - d.created_at))) FILTER (WHERE d.stage = 'closed-won') AS avg_sales_cycle_days,
    -- Contacts & Companies
    COUNT(DISTINCT co.id) AS nb_contacts,
    COUNT(DISTINCT comp.id) AS nb_companies,
    -- Activité (notes créées ce mois)
    COUNT(DISTINCT cn.id) FILTER (WHERE cn.date >= DATE_TRUNC('month', NOW())) AS notes_this_month,
    COUNT(DISTINCT dn.id) FILTER (WHERE dn.date >= DATE_TRUNC('month', NOW())) AS deal_notes_this_month,
    -- Tâches
    COUNT(DISTINCT t.id) FILTER (WHERE t.done_date IS NULL AND (t.due_date IS NULL OR t.due_date >= NOW())) AS tasks_pending,
    COUNT(DISTINCT t.id) FILTER (WHERE t.done_date IS NULL AND t.due_date < NOW()) AS tasks_overdue
FROM sales s
LEFT JOIN deals d ON d.sales_id = s.id
LEFT JOIN contacts co ON co.sales_id = s.id
LEFT JOIN companies comp ON comp.sales_id = s.id
LEFT JOIN contact_notes cn ON cn.sales_id = s.id
LEFT JOIN deal_notes dn ON dn.sales_id = s.id
LEFT JOIN tasks t ON t.sales_id = s.id
WHERE s.disabled = FALSE
GROUP BY s.id, s.first_name, s.last_name;

-- ============================================================================
-- 7. FUNNEL DE CONVERSION
-- Taux de passage entre chaque étape du pipeline
-- ============================================================================
CREATE OR REPLACE VIEW analytics_conversion_funnel AS
WITH stage_order AS (
    SELECT unnest(ARRAY['lead', 'qualified', 'follow-up', 'rdv-prix', 'trial', 'closed-won']) AS stage,
           generate_series(1, 6) AS stage_num
),
deal_max_stage AS (
    SELECT
        d.id,
        d.stage,
        so.stage_num,
        d.created_at,
        d.amount
    FROM deals d
    JOIN stage_order so ON d.stage = so.stage
    UNION ALL
    SELECT
        d.id,
        d.stage,
        CASE d.stage
            WHEN 'perdu' THEN 2
            WHEN 'trial-failed' THEN 5
            WHEN 'declined' THEN 4
            ELSE 1
        END AS stage_num,
        d.created_at,
        d.amount
    FROM deals d
    WHERE d.stage IN ('perdu', 'trial-failed', 'declined')
)
SELECT
    so.stage,
    so.stage_num,
    COUNT(DISTINCT dms.id) FILTER (WHERE dms.stage_num >= so.stage_num) AS nb_deals_reached,
    SUM(COALESCE(dms.amount, 0)) FILTER (WHERE dms.stage_num >= so.stage_num) AS value_reached,
    CASE
        WHEN so.stage_num = 1 THEN 100.0
        WHEN LAG(COUNT(DISTINCT dms.id) FILTER (WHERE dms.stage_num >= so.stage_num)) OVER (ORDER BY so.stage_num) > 0
        THEN ROUND(
            100.0 * COUNT(DISTINCT dms.id) FILTER (WHERE dms.stage_num >= so.stage_num)
            / LAG(COUNT(DISTINCT dms.id) FILTER (WHERE dms.stage_num >= so.stage_num)) OVER (ORDER BY so.stage_num)
        , 1)
        ELSE 0
    END AS conversion_rate_pct
FROM stage_order so
LEFT JOIN deal_max_stage dms ON TRUE
GROUP BY so.stage, so.stage_num
ORDER BY so.stage_num;

-- ============================================================================
-- 8. DEALS TIMELINE (pour analyse temporelle)
-- Deals créés par mois avec métriques
-- ============================================================================
CREATE OR REPLACE VIEW analytics_deals_timeline AS
SELECT
    DATE_TRUNC('month', d.created_at) AS month,
    COUNT(*) AS nb_deals_created,
    COUNT(*) FILTER (WHERE d.stage = 'closed-won') AS nb_won,
    COUNT(*) FILTER (WHERE d.stage IN ('perdu', 'trial-failed', 'declined')) AS nb_lost,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined') AND d.archived_at IS NULL) AS nb_still_active,
    SUM(COALESCE(d.amount, 0)) AS total_value_created,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won') AS total_value_won,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage IN ('perdu', 'trial-failed', 'declined')) AS total_value_lost,
    AVG(COALESCE(d.amount, 0)) FILTER (WHERE d.amount > 0) AS avg_deal_size
FROM deals d
GROUP BY DATE_TRUNC('month', d.created_at)
ORDER BY month;

-- ============================================================================
-- 9. CONTACTS & ENGAGEMENT
-- Analyse de l'engagement des contacts
-- ============================================================================
CREATE OR REPLACE VIEW analytics_contacts_engagement AS
SELECT
    DATE_TRUNC('month', co.first_seen) AS cohort_month,
    co.status,
    c.sector AS company_sector,
    c.type AS company_type,
    COUNT(*) AS nb_contacts,
    COUNT(*) FILTER (WHERE co.status = 'hot') AS nb_hot,
    COUNT(*) FILTER (WHERE co.status = 'warm') AS nb_warm,
    COUNT(*) FILTER (WHERE co.status = 'cold') AS nb_cold,
    COUNT(*) FILTER (WHERE co.status = 'in-contract') AS nb_signed,
    COUNT(DISTINCT co.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM deals d WHERE co.id = ANY(d.contact_ids)
    )) AS nb_with_deals,
    COUNT(DISTINCT co.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM tasks t WHERE t.contact_id = co.id AND t.done_date IS NULL
    )) AS nb_with_pending_tasks
FROM contacts co
LEFT JOIN companies c ON co.company_id = c.id
GROUP BY DATE_TRUNC('month', co.first_seen), co.status, c.sector, c.type
ORDER BY cohort_month DESC;

-- ============================================================================
-- 10. ACTIVITÉ COMMERCIALE
-- Volume d'activité par période
-- ============================================================================
CREATE OR REPLACE VIEW analytics_activity AS
SELECT
    DATE_TRUNC('week', activity_date) AS week,
    activity_type,
    COUNT(*) AS nb_activities,
    sales_name
FROM (
    SELECT cn.date AS activity_date, 'note_contact' AS activity_type,
           s.first_name || ' ' || s.last_name AS sales_name
    FROM contact_notes cn
    LEFT JOIN sales s ON cn.sales_id = s.id

    UNION ALL

    SELECT dn.date AS activity_date, 'note_deal' AS activity_type,
           s.first_name || ' ' || s.last_name AS sales_name
    FROM deal_notes dn
    LEFT JOIN sales s ON dn.sales_id = s.id

    UNION ALL

    SELECT t.done_date AS activity_date, 'task_done' AS activity_type,
           s.first_name || ' ' || s.last_name AS sales_name
    FROM tasks t
    LEFT JOIN sales s ON t.sales_id = s.id
    WHERE t.done_date IS NOT NULL

    UNION ALL

    SELECT d.created_at AS activity_date, 'deal_created' AS activity_type,
           s.first_name || ' ' || s.last_name AS sales_name
    FROM deals d
    LEFT JOIN sales s ON d.sales_id = s.id

    UNION ALL

    SELECT co.first_seen AS activity_date, 'contact_created' AS activity_type,
           s.first_name || ' ' || s.last_name AS sales_name
    FROM contacts co
    LEFT JOIN sales s ON co.sales_id = s.id
) activities
WHERE activity_date IS NOT NULL
GROUP BY DATE_TRUNC('week', activity_date), activity_type, sales_name
ORDER BY week DESC;

-- ============================================================================
-- 11. PRÉVISIONS DE REVENUS (weighted pipeline)
-- Forecast des prochains mois
-- ============================================================================
CREATE OR REPLACE VIEW analytics_revenue_forecast AS
SELECT
    DATE_TRUNC('month', COALESCE(d.expected_closing_date::timestamp, d.created_at + INTERVAL '90 days')) AS forecast_month,
    d.stage,
    COUNT(*) AS nb_deals,
    SUM(COALESCE(d.amount, 0)) AS total_amount,
    SUM(COALESCE(d.amount, 0) * CASE d.stage
        WHEN 'lead' THEN 0.10
        WHEN 'qualified' THEN 0.30
        WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70
        WHEN 'trial' THEN 0.80
        ELSE 0
    END) AS weighted_amount
FROM deals d
WHERE d.stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined')
  AND d.archived_at IS NULL
GROUP BY DATE_TRUNC('month', COALESCE(d.expected_closing_date::timestamp, d.created_at + INTERVAL '90 days')), d.stage
ORDER BY forecast_month, d.stage;

-- ============================================================================
-- 12. ANALYSE WIN/LOSS
-- Détail des deals gagnés/perdus pour analyse
-- ============================================================================
CREATE OR REPLACE VIEW analytics_win_loss AS
SELECT
    d.id AS deal_id,
    d.name AS deal_name,
    d.stage,
    CASE
        WHEN d.stage = 'closed-won' THEN 'won'
        WHEN d.stage IN ('perdu', 'trial-failed', 'declined') THEN 'lost'
    END AS outcome,
    d.category,
    d.amount,
    d.created_at,
    d.updated_at,
    EXTRACT(DAY FROM (d.updated_at - d.created_at)) AS cycle_days,
    c.name AS company_name,
    c.sector AS company_sector,
    c.type AS company_type,
    c.size AS company_size,
    s.first_name || ' ' || s.last_name AS sales_name,
    (SELECT dn.text FROM deal_notes dn WHERE dn.deal_id = d.id ORDER BY dn.date DESC LIMIT 1) AS last_note
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN sales s ON d.sales_id = s.id
WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined');

-- ============================================================================
-- 13. KPIs SNAPSHOT (indicateurs clés en une seule ligne)
-- ============================================================================
CREATE OR REPLACE VIEW analytics_kpis AS
SELECT
    -- Pipeline actif
    COUNT(*) FILTER (WHERE stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined') AND archived_at IS NULL) AS active_deals,
    SUM(COALESCE(amount, 0)) FILTER (WHERE stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined') AND archived_at IS NULL) AS active_pipeline_value,
    SUM(COALESCE(amount, 0) * CASE stage
        WHEN 'lead' THEN 0.10
        WHEN 'qualified' THEN 0.30
        WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70
        WHEN 'trial' THEN 0.80
        ELSE 0
    END) FILTER (WHERE stage NOT IN ('closed-won', 'perdu', 'trial-failed', 'declined') AND archived_at IS NULL) AS weighted_pipeline_value,
    -- Deals gagnés (all time)
    COUNT(*) FILTER (WHERE stage = 'closed-won') AS total_deals_won,
    SUM(COALESCE(amount, 0)) FILTER (WHERE stage = 'closed-won') AS total_revenue_won,
    -- Ce mois
    COUNT(*) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('month', NOW())) AS deals_won_this_month,
    SUM(COALESCE(amount, 0)) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('month', NOW())) AS revenue_this_month,
    -- Ce trimestre
    COUNT(*) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('quarter', NOW())) AS deals_won_this_quarter,
    SUM(COALESCE(amount, 0)) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('quarter', NOW())) AS revenue_this_quarter,
    -- Win rate global
    CASE
        WHEN COUNT(*) FILTER (WHERE stage IN ('closed-won', 'perdu', 'trial-failed', 'declined')) > 0
        THEN ROUND(
            100.0 * COUNT(*) FILTER (WHERE stage = 'closed-won')
            / COUNT(*) FILTER (WHERE stage IN ('closed-won', 'perdu', 'trial-failed', 'declined'))
        , 1)
        ELSE NULL
    END AS global_win_rate_pct,
    -- Deal size moyen
    AVG(COALESCE(amount, 0)) FILTER (WHERE stage = 'closed-won' AND amount > 0) AS avg_won_deal_size,
    -- Cycle de vente moyen
    AVG(EXTRACT(DAY FROM (updated_at - created_at))) FILTER (WHERE stage = 'closed-won') AS avg_sales_cycle_days,
    -- Nouveaux deals ce mois
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) AS new_deals_this_month
FROM deals;

-- ============================================================================
-- 14. TAILLE D'ENTREPRISE & PERFORMANCE
-- Analyse par taille de structure (important pour B2B santé)
-- ============================================================================
CREATE OR REPLACE VIEW analytics_by_company_size AS
SELECT
    CASE c.size
        WHEN 1 THEN '1 - Solo'
        WHEN 10 THEN '2-10 - Petit cabinet'
        WHEN 50 THEN '11-50 - Cabinet moyen'
        WHEN 250 THEN '51-250 - Centre / Clinique'
        WHEN 500 THEN '250+ - Hopital / Groupe'
        ELSE 'Non renseigne'
    END AS company_size_label,
    c.size AS company_size_num,
    COUNT(DISTINCT c.id) AS nb_companies,
    COUNT(DISTINCT d.id) AS nb_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') AS nb_deals_won,
    SUM(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won') AS revenue_won,
    AVG(COALESCE(d.amount, 0)) FILTER (WHERE d.stage = 'closed-won' AND d.amount > 0) AS avg_deal_size,
    CASE
        WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined')) > 0
        THEN ROUND(
            100.0 * COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won')
            / COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won', 'perdu', 'trial-failed', 'declined'))
        , 1)
        ELSE NULL
    END AS win_rate_pct
FROM companies c
LEFT JOIN deals d ON d.company_id = c.id
GROUP BY c.size
ORDER BY c.size NULLS LAST;

-- ============================================================================
-- 15. ESSAIS (TRIALS) TRACKING
-- Suivi spécifique des essais - critique pour SaaS
-- ============================================================================
CREATE OR REPLACE VIEW analytics_trials AS
SELECT
    d.id AS deal_id,
    d.name AS deal_name,
    d.trial_start_date,
    d.expected_closing_date,
    d.stage,
    d.amount,
    d.category,
    c.name AS company_name,
    c.sector AS company_sector,
    c.size AS company_size,
    s.first_name || ' ' || s.last_name AS sales_name,
    CASE
        WHEN d.trial_start_date IS NOT NULL AND d.stage = 'closed-won'
        THEN EXTRACT(DAY FROM (d.updated_at - d.trial_start_date::timestamp))
        WHEN d.trial_start_date IS NOT NULL AND d.stage = 'trial'
        THEN EXTRACT(DAY FROM (NOW() - d.trial_start_date::timestamp))
        ELSE NULL
    END AS trial_duration_days,
    CASE
        WHEN d.stage = 'trial' THEN 'en_cours'
        WHEN d.stage = 'closed-won' THEN 'converti'
        WHEN d.stage = 'trial-failed' THEN 'echec'
        ELSE 'autre'
    END AS trial_outcome
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN sales s ON d.sales_id = s.id
WHERE d.stage IN ('trial', 'closed-won', 'trial-failed')
   OR d.trial_start_date IS NOT NULL;

-- ============================================================================
-- GRANT READ ACCESS pour les vues analytics
-- ============================================================================
GRANT SELECT ON analytics_pipeline_overview TO authenticated;
GRANT SELECT ON analytics_pipeline_by_stage TO authenticated;
GRANT SELECT ON analytics_monthly_revenue TO authenticated;
GRANT SELECT ON analytics_revenue_by_category TO authenticated;
GRANT SELECT ON analytics_revenue_by_sector TO authenticated;
GRANT SELECT ON analytics_sales_performance TO authenticated;
GRANT SELECT ON analytics_conversion_funnel TO authenticated;
GRANT SELECT ON analytics_deals_timeline TO authenticated;
GRANT SELECT ON analytics_contacts_engagement TO authenticated;
GRANT SELECT ON analytics_activity TO authenticated;
GRANT SELECT ON analytics_revenue_forecast TO authenticated;
GRANT SELECT ON analytics_win_loss TO authenticated;
GRANT SELECT ON analytics_kpis TO authenticated;
GRANT SELECT ON analytics_by_company_size TO authenticated;
GRANT SELECT ON analytics_trials TO authenticated;
