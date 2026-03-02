-- Insert pending €250 reimbursement from Gustare Sicilia (Diego Caltabiano).
-- Background: Diego gave Rosario an iPhone, initially valued at €500 and
-- offset against the Borghi Marinari invoice. The phone was later re-evaluated
-- at €250, so Diego owes Rosario the €250 difference.
-- This record is idempotent: skipped if a matching entry already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM payments
    WHERE amount = 250
      AND notes ILIKE '%iphone%'
      AND payment_type = 'rimborso'
  ) THEN
    INSERT INTO payments (client_id, project_id, payment_type, amount, payment_date, method, status, notes, created_at)
    SELECT
      c.id,
      p.id,
      'rimborso_spese',
      250.00,
      '2026-03-02',
      'contanti',
      'in_attesa',
      'Rimborso credito iPhone — telefono rivalutato da €500 a €250 rispetto all''accordo iniziale su Borghi Marinari. Diego deve versare €250 a Rosario.',
      now()
    FROM clients c
    JOIN projects p ON p.client_id = c.id
    WHERE c.name = 'ASSOCIAZIONE CULTURALE GUSTARE SICILIA'
      AND p.name = 'Gustare Sicilia — Borghi Marinari';
  END IF;
END $$;
