#!/usr/bin/env python3
"""
Provision the Nosho CRM Analytics dashboard in Metabase via API.

Usage:
    METABASE_URL=https://metabase.nosho.live METABASE_API_KEY=mb_xxx python3 scripts/provision-metabase-dashboard.py

Creates:
- 1 Collection "Nosho CRM Analytics"
- 1 Dashboard with 5 tabs
- ~20 native SQL questions (KPIs, charts, tables)
- All cards laid out in the dashboard

Requires the analytics views to be deployed (migration 20260315165456).
If views aren't deployed yet, the questions will be created but won't return data.
"""

import json
import os
import sys
import time
import requests

METABASE_URL = os.environ.get("METABASE_URL", "").rstrip("/")
METABASE_API_KEY = os.environ.get("METABASE_API_KEY", "")
DATABASE_ID = int(os.environ.get("METABASE_DATABASE_ID", "3"))
COLLECTION_NAME = "Nosho CRM Analytics"
DASHBOARD_NAME = "CRM Analytics - Nosho"

if not METABASE_URL or not METABASE_API_KEY:
    print("Error: METABASE_URL and METABASE_API_KEY environment variables required")
    sys.exit(1)

session = requests.Session()
session.headers.update({
    "x-api-key": METABASE_API_KEY,
    "Content-Type": "application/json",
})


def api(method, path, data=None):
    """Make a Metabase API call with retry."""
    url = f"{METABASE_URL}/api/{path}"
    for attempt in range(3):
        try:
            resp = session.request(method, url, json=data, timeout=30)
            if resp.status_code >= 400:
                print(f"  API error {resp.status_code}: {resp.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
            return resp.json()
        except Exception as e:
            print(f"  Request error: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    return None


def find_or_create_collection():
    """Find existing or create new collection."""
    collections = api("GET", "collection")
    for c in (collections or []):
        if c.get("name") == COLLECTION_NAME and not c.get("archived"):
            print(f"Found existing collection: {c['id']}")
            return c["id"]

    result = api("POST", "collection", {
        "name": COLLECTION_NAME,
        "description": "Dashboard analytics pour le CRM Nosho - B2B SaaS Santé",
    })
    print(f"Created collection: {result['id']}")
    return result["id"]


def create_native_question(collection_id, name, sql, display="table", viz_settings=None):
    """Create a native SQL question."""
    payload = {
        "name": name,
        "collection_id": collection_id,
        "dataset_query": {
            "database": DATABASE_ID,
            "type": "native",
            "native": {"query": sql},
        },
        "display": display,
        "visualization_settings": viz_settings or {},
    }
    result = api("POST", "card", payload)
    if result and "id" in result:
        print(f"  Created question: {name} (ID: {result['id']})")
        return result["id"]
    print(f"  FAILED to create question: {name}")
    return None


def create_dashboard(collection_id):
    """Create the dashboard."""
    result = api("POST", "dashboard", {
        "name": DASHBOARD_NAME,
        "collection_id": collection_id,
        "description": "Tableau de bord analytique CRM - Pipeline, Revenus, Performance, Essais",
    })
    print(f"Created dashboard: {result['id']}")
    return result["id"]


def create_tabs(dashboard_id):
    """Create 5 tabs on the dashboard via PUT (Metabase v0.57+)."""
    tab_names = [
        "Vue ensemble (KPIs)",
        "Pipeline et Funnel",
        "Revenus et Segments",
        "Performance commerciale",
        "Essais et Engagement",
    ]
    # Metabase v0.57+ creates tabs via PUT /api/dashboard/:id with negative IDs
    tab_specs = [{"id": -(i + 1), "name": name} for i, name in enumerate(tab_names)]
    result = api("PUT", f"dashboard/{dashboard_id}", {"tabs": tab_specs, "dashcards": []})
    if result:
        tabs = result.get("tabs", [])
        for t in tabs:
            print(f"  Created tab: {t['name']} (ID: {t['id']})")
        return tabs
    return []


# ============================================================================
# SQL Queries for each question
# ============================================================================

QUERIES = {
    # --- Tab 1: KPIs (inline SQL, no views required) ---
    "kpi_active_deals": {
        "name": "Deals actifs",
        "sql": "SELECT COUNT(*) FILTER (WHERE stage NOT IN ('closed-won','perdu','trial-failed','declined') AND archived_at IS NULL) AS active_deals FROM deals",
        "display": "scalar",
    },
    "kpi_pipeline_value": {
        "name": "Pipeline actif (€)",
        "sql": "SELECT SUM(COALESCE(amount,0)) FILTER (WHERE stage NOT IN ('closed-won','perdu','trial-failed','declined') AND archived_at IS NULL) / 100.0 AS pipeline_eur FROM deals",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_weighted_pipeline": {
        "name": "Pipeline pondéré (€)",
        "sql": "SELECT SUM(COALESCE(amount,0) * CASE stage WHEN 'lead' THEN 0.10 WHEN 'qualified' THEN 0.30 WHEN 'follow-up' THEN 0.50 WHEN 'rdv-prix' THEN 0.70 WHEN 'trial' THEN 0.80 ELSE 0 END) FILTER (WHERE stage NOT IN ('closed-won','perdu','trial-failed','declined') AND archived_at IS NULL) / 100.0 AS weighted_pipeline_eur FROM deals",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_revenue_month": {
        "name": "Revenue ce mois (€)",
        "sql": "SELECT SUM(COALESCE(amount,0)) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('month', NOW())) / 100.0 AS revenue_month_eur FROM deals",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_revenue_quarter": {
        "name": "Revenue ce trimestre (€)",
        "sql": "SELECT SUM(COALESCE(amount,0)) FILTER (WHERE stage = 'closed-won' AND updated_at >= DATE_TRUNC('quarter', NOW())) / 100.0 AS revenue_quarter_eur FROM deals",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_win_rate": {
        "name": "Win rate global",
        "sql": "SELECT CASE WHEN COUNT(*) FILTER (WHERE stage IN ('closed-won','perdu','trial-failed','declined')) > 0 THEN ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'closed-won') / COUNT(*) FILTER (WHERE stage IN ('closed-won','perdu','trial-failed','declined')), 1) ELSE NULL END AS win_rate_pct FROM deals",
        "display": "scalar",
        "viz": {"number_suffix": "%"},
    },
    "kpi_avg_deal": {
        "name": "Deal moyen gagné (€)",
        "sql": "SELECT AVG(COALESCE(amount,0)) FILTER (WHERE stage = 'closed-won' AND amount > 0) / 100.0 AS avg_deal_eur FROM deals",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_cycle": {
        "name": "Cycle de vente moyen (jours)",
        "sql": "SELECT ROUND(AVG(EXTRACT(DAY FROM (updated_at - created_at))) FILTER (WHERE stage = 'closed-won')) AS avg_cycle_days FROM deals",
        "display": "scalar",
        "viz": {"number_suffix": " jours"},
    },
    "kpi_new_deals": {
        "name": "Nouveaux deals ce mois",
        "sql": "SELECT COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) AS new_deals FROM deals",
        "display": "scalar",
    },

    # --- Tab 2: Pipeline & Funnel ---
    "pipeline_by_stage": {
        "name": "Pipeline par stage",
        "sql": """SELECT stage,
    COUNT(*) FILTER (WHERE archived_at IS NULL AND stage NOT IN ('closed-won','perdu','trial-failed','declined')) AS nb_active_deals,
    SUM(COALESCE(amount,0)) / 100.0 AS total_eur
FROM deals
GROUP BY stage
HAVING COUNT(*) FILTER (WHERE archived_at IS NULL AND stage NOT IN ('closed-won','perdu','trial-failed','declined')) > 0
ORDER BY CASE stage
    WHEN 'lead' THEN 1 WHEN 'qualified' THEN 2 WHEN 'follow-up' THEN 3
    WHEN 'rdv-prix' THEN 4 WHEN 'trial' THEN 5 ELSE 6
END""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["stage"],
            "graph.metrics": ["total_eur"],
            "graph.x_axis.title_text": "Stage",
            "graph.y_axis.title_text": "Montant (€)",
        },
    },
    "conversion_funnel": {
        "name": "Funnel de conversion",
        "sql": """WITH stage_order AS (
    SELECT unnest(ARRAY['lead','qualified','follow-up','rdv-prix','trial','closed-won']) AS stage,
           generate_series(1,6) AS stage_num
), deal_max_stage AS (
    SELECT d.id, d.stage, so.stage_num, d.amount
    FROM deals d JOIN stage_order so ON d.stage = so.stage
    UNION ALL
    SELECT d.id, d.stage, CASE d.stage WHEN 'perdu' THEN 2 WHEN 'trial-failed' THEN 5 WHEN 'declined' THEN 4 ELSE 1 END, d.amount
    FROM deals d WHERE d.stage IN ('perdu','trial-failed','declined')
)
SELECT so.stage, COUNT(DISTINCT dms.id) FILTER (WHERE dms.stage_num >= so.stage_num) AS nb_deals_reached
FROM stage_order so LEFT JOIN deal_max_stage dms ON TRUE
GROUP BY so.stage, so.stage_num
ORDER BY so.stage_num""",
        "display": "funnel",
        "viz": {
            "funnel.dimension": "stage",
            "funnel.metric": "nb_deals_reached",
        },
    },
    "pipeline_detail": {
        "name": "Pipeline détaillé (deals actifs)",
        "sql": """SELECT d.name AS deal_name, c.name AS company_name, d.stage,
    d.amount / 100.0 AS montant_eur,
    COALESCE(d.amount,0) * CASE d.stage
        WHEN 'lead' THEN 0.10 WHEN 'qualified' THEN 0.30 WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70 WHEN 'trial' THEN 0.80 WHEN 'closed-won' THEN 1.00 ELSE 0
    END / 100.0 AS pondere_eur,
    EXTRACT(DAY FROM (NOW() - d.created_at)) AS age_jours,
    s.first_name || ' ' || s.last_name AS commercial
FROM deals d
LEFT JOIN companies c ON d.company_id = c.id
LEFT JOIN sales s ON d.sales_id = s.id
WHERE d.stage NOT IN ('closed-won','perdu','trial-failed','declined') AND d.archived_at IS NULL
ORDER BY COALESCE(d.amount,0) * CASE d.stage
    WHEN 'lead' THEN 0.10 WHEN 'qualified' THEN 0.30 WHEN 'follow-up' THEN 0.50
    WHEN 'rdv-prix' THEN 0.70 WHEN 'trial' THEN 0.80 ELSE 0 END DESC""",
        "display": "table",
    },
    "revenue_forecast": {
        "name": "Forecast revenus",
        "sql": """SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(d.expected_closing_date::timestamp, d.created_at + INTERVAL '90 days')), 'YYYY-MM') AS mois,
    d.stage,
    SUM(COALESCE(d.amount,0) * CASE d.stage
        WHEN 'lead' THEN 0.10 WHEN 'qualified' THEN 0.30 WHEN 'follow-up' THEN 0.50
        WHEN 'rdv-prix' THEN 0.70 WHEN 'trial' THEN 0.80 ELSE 0
    END) / 100.0 AS montant_pondere_eur
FROM deals d
WHERE d.stage NOT IN ('closed-won','perdu','trial-failed','declined') AND d.archived_at IS NULL
    AND COALESCE(d.expected_closing_date::timestamp, d.created_at + INTERVAL '90 days') >= DATE_TRUNC('month', NOW())
GROUP BY 1, d.stage ORDER BY 1, d.stage""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["montant_pondere_eur"],
            "stackable.stack_type": "stacked",
        },
    },

    # --- Tab 3: Revenus & Segments ---
    "monthly_revenue": {
        "name": "Revenus mensuels",
        "sql": """SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(d.trial_start_date::timestamp, d.expected_closing_date::timestamp, d.updated_at)), 'YYYY-MM') AS mois,
    SUM(COALESCE(d.amount,0)) / 100.0 AS revenue_eur,
    COUNT(*) AS nb_deals_won
FROM deals d WHERE d.stage = 'closed-won'
GROUP BY 1 ORDER BY 1""",
        "display": "line",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["revenue_eur"],
            "graph.y_axis.title_text": "Revenue (€)",
        },
    },
    "revenue_by_category": {
        "name": "Revenue par catégorie",
        "sql": """SELECT COALESCE(d.category, 'non-categorise') AS categorie,
    SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') / 100.0 AS revenue_eur,
    COUNT(*) FILTER (WHERE d.stage = 'closed-won') AS nb_deals_won,
    CASE WHEN COUNT(*) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')) > 0
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE d.stage = 'closed-won') / COUNT(*) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')),1)
        ELSE NULL END AS win_rate_pct
FROM deals d GROUP BY 1
HAVING SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') > 0
ORDER BY revenue_eur DESC""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["categorie"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "revenue_by_sector": {
        "name": "Revenue par secteur",
        "sql": """SELECT COALESCE(c.sector, 'inconnu') AS secteur,
    SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') / 100.0 AS revenue_eur,
    COUNT(DISTINCT c.id) AS entreprises,
    CASE WHEN COUNT(d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')) > 0
        THEN ROUND(100.0 * COUNT(d.id) FILTER (WHERE d.stage = 'closed-won') / COUNT(d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')),1)
        ELSE NULL END AS win_rate_pct
FROM companies c LEFT JOIN deals d ON d.company_id = c.id
GROUP BY 1 HAVING SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') > 0
ORDER BY revenue_eur DESC""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["secteur"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "by_company_size": {
        "name": "Performance par taille d'entreprise",
        "sql": """SELECT CASE c.size
        WHEN 1 THEN '1 - Solo' WHEN 10 THEN '2-10 - Petit cabinet'
        WHEN 50 THEN '11-50 - Cabinet moyen' WHEN 250 THEN '51-250 - Centre / Clinique'
        WHEN 500 THEN '250+ - Hopital / Groupe' ELSE 'Non renseigne'
    END AS taille,
    SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') / 100.0 AS revenue_eur,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') AS deals_gagnes,
    CASE WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')) > 0
        THEN ROUND(100.0 * COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') / COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')),1)
        ELSE NULL END AS win_rate_pct
FROM companies c LEFT JOIN deals d ON d.company_id = c.id
GROUP BY c.size ORDER BY c.size NULLS LAST""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["taille"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "deals_timeline": {
        "name": "Timeline des deals",
        "sql": """SELECT TO_CHAR(DATE_TRUNC('month', d.created_at), 'YYYY-MM') AS mois,
    COUNT(*) FILTER (WHERE d.stage = 'closed-won') AS gagnes,
    COUNT(*) FILTER (WHERE d.stage IN ('perdu','trial-failed','declined')) AS perdus,
    COUNT(*) FILTER (WHERE d.stage NOT IN ('closed-won','perdu','trial-failed','declined') AND d.archived_at IS NULL) AS actifs
FROM deals d GROUP BY 1 ORDER BY 1""",
        "display": "area",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["gagnes", "perdus", "actifs"],
            "stackable.stack_type": "stacked",
        },
    },

    # --- Tab 4: Performance commerciale ---
    "sales_performance": {
        "name": "Scorecard commerciaux",
        "sql": """SELECT s.first_name || ' ' || s.last_name AS commercial,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') AS deals_gagnes,
    SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage = 'closed-won') / 100.0 AS revenue_eur,
    CASE WHEN COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')) > 0
        THEN ROUND(100.0 * COUNT(DISTINCT d.id) FILTER (WHERE d.stage = 'closed-won') / COUNT(DISTINCT d.id) FILTER (WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')),1)
        ELSE NULL END AS win_rate_pct,
    ROUND(AVG(EXTRACT(DAY FROM (COALESCE(d.archived_at, d.updated_at) - d.created_at))) FILTER (WHERE d.stage = 'closed-won')) AS cycle_jours,
    SUM(COALESCE(d.amount,0)) FILTER (WHERE d.stage NOT IN ('closed-won','perdu','trial-failed','declined')) / 100.0 AS pipeline_eur,
    COUNT(DISTINCT d.id) FILTER (WHERE d.stage NOT IN ('closed-won','perdu','trial-failed','declined')) AS deals_actifs
FROM sales s LEFT JOIN deals d ON d.sales_id = s.id
WHERE s.disabled = FALSE
GROUP BY s.id, s.first_name, s.last_name
ORDER BY revenue_eur DESC NULLS LAST""",
        "display": "table",
    },
    "activity_weekly": {
        "name": "Activité par semaine",
        "sql": """SELECT TO_CHAR(week, 'YYYY-WW') AS semaine, activity_type AS type_activite, SUM(nb) AS nb_activities
FROM (
    SELECT DATE_TRUNC('week', cn.date) AS week, 'note_contact' AS activity_type, COUNT(*) AS nb FROM contact_notes cn GROUP BY 1
    UNION ALL SELECT DATE_TRUNC('week', dn.date), 'note_deal', COUNT(*) FROM deal_notes dn GROUP BY 1
    UNION ALL SELECT DATE_TRUNC('week', t.done_date), 'task_done', COUNT(*) FROM tasks t WHERE t.done_date IS NOT NULL GROUP BY 1
    UNION ALL SELECT DATE_TRUNC('week', d.created_at), 'deal_created', COUNT(*) FROM deals d GROUP BY 1
) sub WHERE week >= NOW() - INTERVAL '3 months' AND week IS NOT NULL
GROUP BY 1, 2 ORDER BY 1 DESC""",
        "display": "line",
        "viz": {
            "graph.dimensions": ["semaine"],
            "graph.metrics": ["nb_activities"],
            "stackable.stack_type": "stacked",
        },
    },
    "win_loss": {
        "name": "Analyse Win/Loss",
        "sql": """SELECT d.name AS deal_name,
    CASE WHEN d.stage = 'closed-won' THEN 'won' ELSE 'lost' END AS resultat,
    c.name AS entreprise, d.category AS categorie,
    d.amount / 100.0 AS montant_eur,
    EXTRACT(DAY FROM (d.updated_at - d.created_at)) AS duree_jours,
    s.first_name || ' ' || s.last_name AS commercial, c.sector AS secteur
FROM deals d LEFT JOIN companies c ON d.company_id = c.id LEFT JOIN sales s ON d.sales_id = s.id
WHERE d.stage IN ('closed-won','perdu','trial-failed','declined')
ORDER BY d.updated_at DESC""",
        "display": "table",
    },

    # --- Tab 5: Essais & Engagement ---
    "trials": {
        "name": "Suivi des essais",
        "sql": """SELECT d.name AS deal_name, c.name AS entreprise, d.trial_start_date AS debut_essai,
    CASE WHEN d.trial_start_date IS NOT NULL AND d.stage = 'closed-won'
        THEN EXTRACT(DAY FROM (d.updated_at - d.trial_start_date::timestamp))
        WHEN d.trial_start_date IS NOT NULL AND d.stage = 'trial'
        THEN EXTRACT(DAY FROM (NOW() - d.trial_start_date::timestamp))
        ELSE NULL END AS duree_jours,
    CASE WHEN d.stage = 'trial' THEN 'en_cours' WHEN d.stage = 'closed-won' THEN 'converti'
        WHEN d.stage = 'trial-failed' THEN 'echec' ELSE 'autre' END AS resultat,
    d.amount / 100.0 AS montant_eur, s.first_name || ' ' || s.last_name AS commercial
FROM deals d LEFT JOIN companies c ON d.company_id = c.id LEFT JOIN sales s ON d.sales_id = s.id
WHERE d.stage IN ('trial','closed-won','trial-failed') OR d.trial_start_date IS NOT NULL
ORDER BY d.trial_start_date DESC NULLS LAST""",
        "display": "table",
    },
    "trial_kpi_conversion": {
        "name": "Taux conversion essais",
        "sql": """SELECT CASE WHEN COUNT(*) FILTER (WHERE stage IN ('closed-won','trial-failed')) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE stage = 'closed-won') / COUNT(*) FILTER (WHERE stage IN ('closed-won','trial-failed')),1)
    ELSE NULL END AS taux_conversion_pct
FROM deals WHERE stage IN ('trial','closed-won','trial-failed') OR trial_start_date IS NOT NULL""",
        "display": "scalar",
        "viz": {"number_suffix": "%"},
    },
    "contacts_engagement": {
        "name": "Engagement contacts par cohorte",
        "sql": """SELECT TO_CHAR(DATE_TRUNC('month', co.first_seen), 'YYYY-MM') AS cohorte,
    COUNT(*) FILTER (WHERE co.status = 'hot') AS chauds,
    COUNT(*) FILTER (WHERE co.status = 'warm') AS tiedes,
    COUNT(*) FILTER (WHERE co.status = 'cold') AS froids,
    COUNT(*) FILTER (WHERE co.status = 'in-contract') AS signes
FROM contacts co GROUP BY 1 ORDER BY 1""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["cohorte"],
            "graph.metrics": ["chauds", "tiedes", "froids", "signes"],
            "stackable.stack_type": "stacked",
        },
    },
}

# Card layout: maps query keys to (tab_index, col, row, width, height)
# Dashboard grid is 24 columns wide
LAYOUT = {
    # Tab 1: KPIs (3x3 grid of scalar cards)
    "kpi_active_deals":      (0, 0,  0, 5, 3),
    "kpi_pipeline_value":    (0, 5,  0, 5, 3),
    "kpi_weighted_pipeline": (0, 10, 0, 5, 3),
    "kpi_revenue_month":     (0, 0,  3, 6, 3),
    "kpi_revenue_quarter":   (0, 6,  3, 6, 3),
    "kpi_win_rate":          (0, 12, 3, 6, 3),
    "kpi_avg_deal":          (0, 0,  6, 8, 3),
    "kpi_cycle":             (0, 8,  6, 8, 3),
    "kpi_new_deals":         (0, 16, 6, 8, 3),

    # Tab 2: Pipeline & Funnel
    "pipeline_by_stage":   (1, 0,  0, 12, 8),
    "conversion_funnel":   (1, 12, 0, 12, 8),
    "pipeline_detail":     (1, 0,  8, 24, 10),
    "revenue_forecast":    (1, 0,  18, 24, 8),

    # Tab 3: Revenus & Segments
    "monthly_revenue":      (2, 0,  0, 24, 8),
    "revenue_by_category":  (2, 0,  8, 12, 8),
    "revenue_by_sector":    (2, 12, 8, 12, 8),
    "by_company_size":      (2, 0,  16, 12, 8),
    "deals_timeline":       (2, 12, 16, 12, 8),

    # Tab 4: Performance commerciale
    "sales_performance": (3, 0,  0, 24, 10),
    "activity_weekly":   (3, 0,  10, 24, 8),
    "win_loss":          (3, 0,  18, 24, 10),

    # Tab 5: Essais & Engagement
    "trial_kpi_conversion":  (4, 0,  0, 8, 3),
    "trials":                (4, 0,  3, 24, 10),
    "contacts_engagement":   (4, 0,  13, 24, 8),
}


def main():
    print("=" * 60)
    print("Provisioning Nosho CRM Analytics Dashboard in Metabase")
    print(f"URL: {METABASE_URL}")
    print(f"Database ID: {DATABASE_ID}")
    print("=" * 60)

    # 1. Collection
    print("\n[1/4] Collection...")
    collection_id = find_or_create_collection()

    # 2. Create questions
    print("\n[2/4] Creating questions...")
    card_ids = {}
    for key, q in QUERIES.items():
        card_id = create_native_question(
            collection_id,
            q["name"],
            q["sql"],
            q.get("display", "table"),
            q.get("viz"),
        )
        if card_id:
            card_ids[key] = card_id

    print(f"\n  Created {len(card_ids)}/{len(QUERIES)} questions")

    # 3. Create dashboard + tabs
    print("\n[3/4] Creating dashboard and tabs...")
    dashboard_id = create_dashboard(collection_id)
    tabs = create_tabs(dashboard_id)

    if len(tabs) < 5:
        print("WARNING: Not all tabs were created. Proceeding with available tabs.")

    # 4. Add cards to dashboard
    print("\n[4/4] Adding cards to dashboard...")
    dashcards = []
    for key, (tab_idx, col, row, width, height) in LAYOUT.items():
        if key not in card_ids:
            print(f"  Skipping {key} (question not created)")
            continue
        if tab_idx >= len(tabs):
            print(f"  Skipping {key} (tab {tab_idx} not available)")
            continue

        dashcards.append({
            "id": -len(dashcards) - 1,  # temporary negative ID for new cards
            "card_id": card_ids[key],
            "dashboard_tab_id": tabs[tab_idx]["id"],
            "col": col,
            "row": row,
            "size_x": width,
            "size_y": height,
            "visualization_settings": QUERIES[key].get("viz", {}),
        })

    # Use PUT to set all cards at once, preserving tabs
    tab_specs = [{"id": t["id"], "name": t["name"]} for t in tabs]
    result = api("PUT", f"dashboard/{dashboard_id}", {
        "tabs": tab_specs,
        "dashcards": dashcards,
    })

    if result:
        print(f"\n  Added {len(dashcards)} cards to dashboard")
    else:
        print("\n  WARNING: Failed to add cards to dashboard")

    # Summary
    print("\n" + "=" * 60)
    print("DONE!")
    print(f"Dashboard URL: {METABASE_URL}/dashboard/{dashboard_id}")
    print(f"Collection URL: {METABASE_URL}/collection/{collection_id}")
    print("=" * 60)

    return {
        "dashboard_id": dashboard_id,
        "dashboard_url": f"{METABASE_URL}/dashboard/{dashboard_id}",
        "collection_id": collection_id,
        "card_ids": card_ids,
    }


if __name__ == "__main__":
    result = main()
    # Output JSON for automation
    print("\n" + json.dumps(result, indent=2))
