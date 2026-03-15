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
    # --- Tab 1: KPIs ---
    "kpi_active_deals": {
        "name": "Deals actifs",
        "sql": "SELECT active_deals FROM analytics_kpis",
        "display": "scalar",
    },
    "kpi_pipeline_value": {
        "name": "Pipeline actif (€)",
        "sql": "SELECT active_pipeline_value / 100.0 FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_weighted_pipeline": {
        "name": "Pipeline pondéré (€)",
        "sql": "SELECT weighted_pipeline_value / 100.0 FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_revenue_month": {
        "name": "Revenue ce mois (€)",
        "sql": "SELECT revenue_this_month / 100.0 FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_revenue_quarter": {
        "name": "Revenue ce trimestre (€)",
        "sql": "SELECT revenue_this_quarter / 100.0 FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_win_rate": {
        "name": "Win rate global",
        "sql": "SELECT global_win_rate_pct FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_suffix": "%"},
    },
    "kpi_avg_deal": {
        "name": "Deal moyen gagné (€)",
        "sql": "SELECT avg_won_deal_size / 100.0 FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_style": "currency", "currency": "EUR"},
    },
    "kpi_cycle": {
        "name": "Cycle de vente moyen (jours)",
        "sql": "SELECT ROUND(avg_sales_cycle_days) FROM analytics_kpis",
        "display": "scalar",
        "viz": {"number_suffix": " jours"},
    },
    "kpi_new_deals": {
        "name": "Nouveaux deals ce mois",
        "sql": "SELECT new_deals_this_month FROM analytics_kpis",
        "display": "scalar",
    },

    # --- Tab 2: Pipeline & Funnel ---
    "pipeline_by_stage": {
        "name": "Pipeline par stage",
        "sql": """SELECT stage, nb_active_deals, total_amount / 100.0 AS total_eur
FROM analytics_pipeline_by_stage
WHERE nb_active_deals > 0
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
        "sql": """SELECT stage, nb_deals_reached, ROUND(conversion_rate_pct, 1) AS conversion_pct
FROM analytics_conversion_funnel
ORDER BY stage_num""",
        "display": "funnel",
        "viz": {
            "funnel.dimension": "stage",
            "funnel.metric": "nb_deals_reached",
        },
    },
    "pipeline_detail": {
        "name": "Pipeline détaillé (deals actifs)",
        "sql": """SELECT deal_name, company_name, stage,
       amount / 100.0 AS montant_eur,
       weighted_amount / 100.0 AS pondéré_eur,
       deal_age_days AS age_jours,
       sales_name AS commercial
FROM analytics_pipeline_overview
WHERE deal_status = 'active'
ORDER BY weighted_amount DESC""",
        "display": "table",
    },
    "revenue_forecast": {
        "name": "Forecast revenus",
        "sql": """SELECT TO_CHAR(forecast_month, 'YYYY-MM') AS mois,
       stage,
       weighted_amount / 100.0 AS montant_pondéré_eur
FROM analytics_revenue_forecast
WHERE forecast_month >= DATE_TRUNC('month', NOW())
ORDER BY forecast_month, stage""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["montant_pondéré_eur"],
            "stackable.stack_type": "stacked",
            "series_settings": {},
        },
    },

    # --- Tab 3: Revenus & Segments ---
    "monthly_revenue": {
        "name": "Revenus mensuels",
        "sql": """SELECT TO_CHAR(revenue_month, 'YYYY-MM') AS mois,
       total_revenue / 100.0 AS revenue_eur,
       nb_deals_won
FROM analytics_monthly_revenue
ORDER BY revenue_month""",
        "display": "line",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["revenue_eur"],
            "graph.y_axis.title_text": "Revenue (€)",
        },
    },
    "revenue_by_category": {
        "name": "Revenue par catégorie",
        "sql": """SELECT category AS catégorie,
       revenue_won / 100.0 AS revenue_eur,
       nb_deals_won,
       win_rate_pct
FROM analytics_revenue_by_category
WHERE revenue_won > 0
ORDER BY revenue_won DESC""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["catégorie"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "revenue_by_sector": {
        "name": "Revenue par secteur",
        "sql": """SELECT sector AS secteur,
       revenue_won / 100.0 AS revenue_eur,
       nb_companies AS entreprises,
       win_rate_pct
FROM analytics_revenue_by_sector
WHERE revenue_won > 0
ORDER BY revenue_won DESC""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["secteur"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "by_company_size": {
        "name": "Performance par taille d'entreprise",
        "sql": """SELECT company_size_label AS taille,
       revenue_won / 100.0 AS revenue_eur,
       nb_deals_won AS deals_gagnés,
       win_rate_pct
FROM analytics_by_company_size
ORDER BY company_size_num NULLS LAST""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["taille"],
            "graph.metrics": ["revenue_eur"],
        },
    },
    "deals_timeline": {
        "name": "Timeline des deals",
        "sql": """SELECT TO_CHAR(month, 'YYYY-MM') AS mois,
       nb_won AS gagnés,
       nb_lost AS perdus,
       nb_still_active AS actifs
FROM analytics_deals_timeline
ORDER BY month""",
        "display": "area",
        "viz": {
            "graph.dimensions": ["mois"],
            "graph.metrics": ["gagnés", "perdus", "actifs"],
            "stackable.stack_type": "stacked",
        },
    },

    # --- Tab 4: Performance commerciale ---
    "sales_performance": {
        "name": "Scorecard commerciaux",
        "sql": """SELECT sales_name AS commercial,
       nb_deals_won AS deals_gagnés,
       revenue_won / 100.0 AS revenue_eur,
       win_rate_pct,
       ROUND(avg_sales_cycle_days) AS cycle_jours,
       pipeline_value / 100.0 AS pipeline_eur,
       nb_deals_active AS deals_actifs,
       tasks_pending AS tâches_en_cours,
       tasks_overdue AS tâches_en_retard
FROM analytics_sales_performance
ORDER BY revenue_won DESC NULLS LAST""",
        "display": "table",
    },
    "activity_weekly": {
        "name": "Activité par semaine",
        "sql": """SELECT TO_CHAR(week, 'YYYY-WW') AS semaine,
       activity_type AS type_activité,
       nb_activities,
       sales_name AS commercial
FROM analytics_activity
WHERE week >= NOW() - INTERVAL '3 months'
ORDER BY week DESC""",
        "display": "line",
        "viz": {
            "graph.dimensions": ["semaine"],
            "graph.metrics": ["nb_activities"],
            "stackable.stack_type": "stacked",
        },
    },
    "win_loss": {
        "name": "Analyse Win/Loss",
        "sql": """SELECT deal_name, outcome AS résultat,
       company_name AS entreprise,
       category AS catégorie,
       amount / 100.0 AS montant_eur,
       cycle_days AS durée_jours,
       sales_name AS commercial,
       company_sector AS secteur
FROM analytics_win_loss
ORDER BY updated_at DESC""",
        "display": "table",
    },

    # --- Tab 5: Essais & Engagement ---
    "trials": {
        "name": "Suivi des essais",
        "sql": """SELECT deal_name, company_name AS entreprise,
       trial_start_date AS début_essai,
       trial_duration_days AS durée_jours,
       trial_outcome AS résultat,
       amount / 100.0 AS montant_eur,
       sales_name AS commercial
FROM analytics_trials
ORDER BY trial_start_date DESC NULLS LAST""",
        "display": "table",
    },
    "trial_kpi_conversion": {
        "name": "Taux conversion essais",
        "sql": """SELECT
    COUNT(*) FILTER (WHERE trial_outcome = 'converti') AS convertis,
    COUNT(*) FILTER (WHERE trial_outcome = 'echec') AS échecs,
    COUNT(*) FILTER (WHERE trial_outcome = 'en_cours') AS en_cours,
    CASE WHEN COUNT(*) FILTER (WHERE trial_outcome IN ('converti','echec')) > 0
        THEN ROUND(100.0 * COUNT(*) FILTER (WHERE trial_outcome = 'converti')
            / COUNT(*) FILTER (WHERE trial_outcome IN ('converti','echec')), 1)
        ELSE NULL
    END AS taux_conversion_pct
FROM analytics_trials""",
        "display": "scalar",
        "viz": {"number_suffix": "%"},
    },
    "contacts_engagement": {
        "name": "Engagement contacts par cohorte",
        "sql": """SELECT TO_CHAR(cohort_month, 'YYYY-MM') AS cohorte,
       SUM(nb_hot) AS chauds,
       SUM(nb_warm) AS tièdes,
       SUM(nb_cold) AS froids,
       SUM(nb_signed) AS signés
FROM analytics_contacts_engagement
GROUP BY cohort_month
ORDER BY cohort_month""",
        "display": "bar",
        "viz": {
            "graph.dimensions": ["cohorte"],
            "graph.metrics": ["chauds", "tièdes", "froids", "signés"],
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
