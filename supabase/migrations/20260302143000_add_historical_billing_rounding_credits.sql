-- =============================================================================
-- Historical billing rounding credits
--
-- Small residual balances on a few Gustare projects come from legacy billing
-- rounding and stamp-duty semantics. Record them explicitly as
-- `credito_ricevuto` so project_financials reaches the intended zero balance
-- without relying on local rebuild scripts.
--
-- The migration is idempotent: if the exact adjustment already exists, it does
-- nothing.
-- =============================================================================

DO $$
DECLARE
  v_gustare_client UUID;
  v_gustare_project UUID;
  v_borghi_project UUID;
  v_carratois_project UUID;
BEGIN
  SELECT id
  INTO v_gustare_client
  FROM public.clients
  WHERE name = 'ASSOCIAZIONE CULTURALE GUSTARE SICILIA'
  LIMIT 1;

  IF v_gustare_client IS NULL THEN
    RAISE NOTICE 'Skipping historical billing rounding credits: Gustare client not present.';
    RETURN;
  END IF;

  SELECT id
  INTO v_gustare_project
  FROM public.projects
  WHERE client_id = v_gustare_client
    AND name = 'Gustare Sicilia'
  LIMIT 1;

  SELECT id
  INTO v_borghi_project
  FROM public.projects
  WHERE client_id = v_gustare_client
    AND name = 'Gustare Sicilia — Borghi Marinari'
  LIMIT 1;

  SELECT id
  INTO v_carratois_project
  FROM public.projects
  WHERE client_id = v_gustare_client
    AND name = 'Spot Camping Carratois'
  LIMIT 1;

  IF v_gustare_project IS NOT NULL THEN
    INSERT INTO public.expenses (
      project_id,
      client_id,
      expense_date,
      expense_type,
      amount,
      markup_percent,
      description,
      invoice_ref
    )
    SELECT
      v_gustare_project,
      v_gustare_client,
      DATE '2025-10-14',
      'credito_ricevuto',
      7.32,
      0,
      'Arrotondamento storico fatturazione',
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.expenses
      WHERE project_id = v_gustare_project
        AND client_id = v_gustare_client
        AND expense_date = DATE '2025-10-14'
        AND expense_type = 'credito_ricevuto'
        AND amount = 7.32
        AND description = 'Arrotondamento storico fatturazione'
    );
  END IF;

  IF v_borghi_project IS NOT NULL THEN
    INSERT INTO public.expenses (
      project_id,
      client_id,
      expense_date,
      expense_type,
      amount,
      markup_percent,
      description,
      invoice_ref
    )
    SELECT
      v_borghi_project,
      v_gustare_client,
      DATE '2025-09-06',
      'credito_ricevuto',
      0.10,
      0,
      'Arrotondamento storico fatturazione',
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.expenses
      WHERE project_id = v_borghi_project
        AND client_id = v_gustare_client
        AND expense_date = DATE '2025-09-06'
        AND expense_type = 'credito_ricevuto'
        AND amount = 0.10
        AND description = 'Arrotondamento storico fatturazione'
    );
  END IF;

  IF v_carratois_project IS NOT NULL THEN
    INSERT INTO public.expenses (
      project_id,
      client_id,
      expense_date,
      expense_type,
      amount,
      markup_percent,
      description,
      invoice_ref
    )
    SELECT
      v_carratois_project,
      v_gustare_client,
      DATE '2024-07-03',
      'credito_ricevuto',
      2.00,
      0,
      'Arrotondamento storico fatturazione',
      NULL
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.expenses
      WHERE project_id = v_carratois_project
        AND client_id = v_gustare_client
        AND expense_date = DATE '2024-07-03'
        AND expense_type = 'credito_ricevuto'
        AND amount = 2.00
        AND description = 'Arrotondamento storico fatturazione'
    );
  END IF;
END $$;
