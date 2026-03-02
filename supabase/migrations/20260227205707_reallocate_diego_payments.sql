-- =============================================================================
-- Reallocate ALL Diego Caltabiano payments based on fogli contabili.
--
-- Problem: All Foglio 1 payments (€12,407.19) were assigned to "Gustare Sicilia"
-- but actually covered GS + BTF + 6 Spots. Foglio 2 payments were also misallocated.
--
-- Source of truth: CSV fogli "Servizi per Diego Caltabiano — DAL 27 10 24 AL 07 04 25"
-- Cross-referenced with fatture XML (FPR 7/24, FPR 1/25, FPR 2/25, FPR 4/25, FPR 6/25).
--
-- DELETE 10 erroneous records, CREATE 11 correctly allocated records.
-- Total ricevuto stays exactly €23,985.64 (net zero change).
-- =============================================================================

DO $$
DECLARE
  v_client_id UUID;
  -- Project IDs resolved dynamically so the migration stays replayable on a clean local bootstrap.
  v_gs         UUID;
  v_btf        UUID;
  v_bm         UUID;
  v_colate     UUID;
  v_rosemary   UUID;
  v_panino     UUID;
  v_hclinic    UUID;
  v_spritz     UUID;
  v_castellac  UUID;
BEGIN
  SELECT id INTO v_client_id
  FROM clients
  WHERE name = 'Diego Caltabiano'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_gs
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Gustare Sicilia'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_btf
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Bella tra i Fornelli'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_bm
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Gustare Sicilia — Borghi Marinari'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_colate
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot Colate Verdi Evo Etna'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_rosemary
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot Rosemary''s Pub'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_panino
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot Panino Mania'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_hclinic
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot HCLINIC'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_spritz
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot Spritz & Co'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_castellac
  FROM projects
  WHERE client_id = v_client_id
    AND name = 'Spot Il Castellaccio'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_id IS NULL
     OR v_gs IS NULL
     OR v_btf IS NULL
     OR v_bm IS NULL
     OR v_colate IS NULL
     OR v_rosemary IS NULL
     OR v_panino IS NULL
     OR v_hclinic IS NULL
     OR v_spritz IS NULL
     OR v_castellac IS NULL THEN
    RAISE EXCEPTION 'Diego payment reallocation requires the historical Diego client and all imported projects to exist before replaying this migration.';
  END IF;

  -- =========================================================================
  -- STEP 1: Delete 10 misallocated payment records
  -- =========================================================================

  -- Foglio 1: 6 payments all wrongly assigned to GS (total €12,407.19).
  DELETE FROM payments
  WHERE client_id = v_client_id
    AND (
      (payment_date = '2024-12-27' AND amount = 999.00)
      OR (payment_date = '2025-02-10' AND amount = 2000.00)
      OR (payment_date = '2025-03-03' AND amount = 3113.00)
      OR (payment_date = '2025-04-22' AND amount = 2500.00)
      OR (payment_date = '2025-04-30' AND amount = 2000.00)
      OR (payment_date = '2025-05-14' AND amount = 1795.19)
    );

  -- Foglio 2: 4 payments with wrong project allocations (total €9,834.45).
  DELETE FROM payments
  WHERE client_id = v_client_id
    AND (
      (payment_date = '2025-10-14' AND amount = 2682.35)
      OR (payment_date = '2025-11-10' AND amount = 989.24)
      OR (payment_date = '2025-11-10' AND amount = 5201.36)
      OR (payment_date = '2025-11-10' AND amount = 961.50)
    );

  -- =========================================================================
  -- STEP 2: Create 11 correctly allocated payments
  -- =========================================================================

  -- --- FOGLIO 1: 8 records totaling €12,407.19 ---

  -- GS: servizi €6,229 + km 1261*0.19=€239.59 + HD €293 = €6,761.59
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_gs, '2025-05-14', 'saldo', 6761.59, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1 (GS servizi + km + HD)');

  -- BTF: servizi €3,807 + km 2109*0.19=€400.71 = €4,207.71
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_btf, '2025-05-14', 'saldo', 4207.71, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1 (BTF servizi + km)');

  -- Spot Colate Verdi: €125 (0 km)
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_colate, '2025-05-14', 'saldo', 125.00, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1');

  -- Spot Rosemary Pub: €250 + km 163*0.19=€30.97 = €280.97
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_rosemary, '2025-05-14', 'saldo', 280.97, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1 (servizi + km)');

  -- Spot Panino Mania: €250 (0 km)
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_panino, '2025-05-14', 'saldo', 250.00, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1');

  -- Spot HCLINIC: €250 + km 168*0.19=€31.92 = €281.92
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_hclinic, '2025-05-14', 'saldo', 281.92, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1 (servizi + km)');

  -- Spot Spritz & Co: €250 (0 km)
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_spritz, '2025-05-14', 'saldo', 250.00, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1');

  -- Spot Il Castellaccio: €250 (0 km)
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_castellac, '2025-05-14', 'saldo', 250.00, 'bonifico', 'FPR 2/25',
          'ricevuto', 'Saldo foglio 1');

  -- --- FOGLIO 2: 3 records totaling €9,834.45 ---

  -- GS (FPR 4/25 share): 3 puntate €1,308 + km 275*0.19=€52.25 = €1,360.25
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_gs, '2025-10-14', 'acconto', 1360.25, 'bonifico', 'FPR 4/25',
          'ricevuto', 'Acconto foglio 2 (3 puntate + km)');

  -- BTF (FPR 4/25 share): Cantina+Spazio €1,248 + km 390*0.19=€74.10 = €1,322.10
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_btf, '2025-10-14', 'acconto', 1322.10, 'bonifico', 'FPR 4/25',
          'ricevuto', 'Acconto foglio 2 (Cantina+Spazio + km)');

  -- GS Borghi Marinari (FPR 6/25): 16 puntate €6,976 + km €416.10 + HD €260 - iPhone €500 = €7,152.10
  INSERT INTO payments (client_id, project_id, payment_date, payment_type, amount, method, invoice_ref, status, notes)
  VALUES (v_client_id, v_bm, '2025-11-10', 'saldo', 7152.10, 'bonifico', 'FPR 6/25',
          'ricevuto', 'Saldo Borghi Marinari (16 puntate + km + HD - iPhone)');

END $$;
