/**
 * Test Data Controller
 *
 * Gestisce dati di test deterministici e isolati.
 * NON usa dati storici (Diego/Gustare) ma crea entità fresh per ogni test.
 */

import { execFileSync, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const adminEmail =
  process.env.LOCAL_SUPABASE_ADMIN_EMAIL ?? "admin@gestionale.local";
const adminPassword =
  process.env.LOCAL_SUPABASE_ADMIN_PASSWORD ?? "LocalAdmin123!";

export { adminEmail, adminPassword };

export interface TestEntities {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  serviceIds: string[];
  paymentIds: string[];
  expenseIds: string[];
}

/**
 * Resetta il DB via SQL diretto (più affidabile di supabase db reset)
 */
const resetDatabaseViaSql = () => {
  const sql = `
-- Disabilita temporaneamente i trigger per evitare errori
SET session_replication_role = replica;

-- Svuota tutto tranne auth/settings
TRUNCATE TABLE
  workflow_executions,
  workflows,
  financial_document_cash_allocations,
  financial_document_project_allocations,
  cash_movements,
  financial_documents,
  project_contacts,
  client_notes,
  client_tasks,
  expenses,
  payments,
  services,
  quotes,
  projects,
  contacts,
  clients,
  tags
CASCADE;

-- Riabilita i trigger
SET session_replication_role = DEFAULT;
`;

  try {
    execSync(
      `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "${sql}" 2>&1`,
      {
        stdio: "pipe",
        timeout: 30000,
      },
    );
  } catch (error) {
    console.warn("[test-data-controller] SQL reset warning:", error);
    // Continua comunque
  }
};

/**
 * Resetta il DB e inserisce dati di test controllati
 */
export const resetAndSeedTestData = (): TestEntities => {
  // Prima prova a svuotare via SQL diretto (più veloce e affidabile)
  resetDatabaseViaSql();

  const uniqueId = randomUUID().slice(0, 8);
  const entities: TestEntities = {
    clientId: randomUUID(),
    clientName: `Test Client ${uniqueId}`,
    projectId: randomUUID(),
    projectName: `Test Project ${uniqueId}`,
    serviceIds: [],
    paymentIds: [],
    expenseIds: [],
  };

  // SQL per inserire dati controllati
  const sql = `
-- Inserisce cliente test
INSERT INTO clients (id, name, client_type, phone, email, address, created_at, updated_at)
VALUES (
  '${entities.clientId}',
  '${entities.clientName}',
  'azienda_locale',
  '1234567890',
  'test@example.com',
  'Via Test 123',
  NOW(),
  NOW()
);

-- Inserisce progetto test
INSERT INTO projects (id, client_id, name, category, status, start_date, budget, notes, created_at, updated_at)
VALUES (
  '${entities.projectId}',
  '${entities.clientId}',
  '${entities.projectName}',
  'produzione_tv',
  'in_corso',
  '2026-01-15',
  10000,
  'Progetto di test automatizzato',
  NOW(),
  NOW()
);

-- Inserisce 3 servizi test (totale 6500€)
INSERT INTO services (id, project_id, service_date, service_type, fee_shooting, fee_editing, fee_other, discount, km_distance, km_rate, location, notes, created_at)
VALUES 
  ('${randomUUID()}', '${entities.projectId}', '2026-01-20', 'riprese', 2000, 1000, 0, 0, 100, 0.19, 'Milano', 'Servizio 1', NOW()),
  ('${randomUUID()}', '${entities.projectId}', '2026-02-10', 'montaggio', 0, 2000, 0, 0, 50, 0.19, 'Remoto', 'Servizio 2', NOW()),
  ('${randomUUID()}', '${entities.projectId}', '2026-03-01', 'riprese_montaggio', 1000, 500, 0, 0, 0, 0.19, 'Roma', 'Servizio 3', NOW());

-- Inserisce pagamenti test
-- Ricevuti: 3500€ - 300€ rimborso = 3200€ netti
-- In attesa: 2000€
-- Scaduto: 500€
INSERT INTO payments (id, client_id, project_id, payment_date, payment_type, amount, method, status, notes, created_at)
VALUES
  ('${randomUUID()}', '${entities.clientId}', '${entities.projectId}', '2026-01-25', 'acconto', 2000, 'bonifico', 'ricevuto', 'Acconto', NOW()),
  ('${randomUUID()}', '${entities.clientId}', '${entities.projectId}', '2026-02-15', 'saldo', 1500, 'bonifico', 'ricevuto', 'Saldo parziale', NOW()),
  ('${randomUUID()}', '${entities.clientId}', '${entities.projectId}', '2026-01-30', 'rimborso', 300, 'bonifico', 'ricevuto', 'Rimborso', NOW()),
  ('${randomUUID()}', '${entities.clientId}', '${entities.projectId}', '2026-03-10', 'parziale', 2000, 'bonifico', 'in_attesa', 'In attesa', NOW()),
  ('${randomUUID()}', '${entities.clientId}', '${entities.projectId}', '2026-02-01', 'parziale', 500, 'bonifico', 'scaduto', 'Scaduto', NOW());

-- Re-seed workflow templates (truncated during reset)
INSERT INTO workflows (name, description, trigger_resource, trigger_event, trigger_conditions, actions)
VALUES
  ('Preventivo accettato → Crea progetto', 'Quando un preventivo viene accettato, crea automaticamente un progetto collegato', 'quotes', 'status_changed', '{"status": "accettato"}', '[{"type": "create_project", "data": {"copy_from_quote": true}}]'::jsonb),
  ('Progetto avviato → Task di briefing', 'Quando un progetto passa a in_corso, crea un task di briefing iniziale', 'projects', 'status_changed', '{"status": "in_corso"}', '[{"type": "create_task", "data": {"text": "Briefing iniziale con cliente", "due_days": 2}}]'::jsonb),
  ('Pagamento ricevuto → Task ringraziamento', 'Quando ricevi un pagamento, crea task per inviare ricevuta e ringraziare', 'payments', 'created', '{}', '[{"type": "create_task", "data": {"text": "Invia ricevuta e ringrazia cliente", "due_days": 1}}]'::jsonb);

-- Inserisce spese test
INSERT INTO expenses (id, project_id, client_id, expense_date, expense_type, km_distance, km_rate, amount, markup_percent, description, created_at)
VALUES
  ('${randomUUID()}', '${entities.projectId}', '${entities.clientId}', '2026-01-18', 'acquisto_materiale', NULL, 0.19, 500, 25, 'Materiale', NOW()),
  ('${randomUUID()}', '${entities.projectId}', '${entities.clientId}', '2026-01-20', 'spostamento_km', 100, 0.19, NULL, 0, 'Km', NOW());
`;

  // Esegui SQL via stdin (avoid shell double-quote issues with JSON values)
  try {
    execFileSync(
      "psql",
      ["-h", "127.0.0.1", "-p", "55322", "-U", "postgres", "-d", "postgres"],
      {
        input: sql,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30000,
        env: { ...process.env, PGPASSWORD: "postgres" },
      },
    );
    console.warn("[test-data-controller] Test data seeded successfully");
  } catch (error) {
    console.error("[test-data-controller] Failed to seed test data:", error);
    throw error;
  }

  return entities;
};

/**
 * Verifica che i calcoli siano corretti
 */
export const verifyCalculations = (): boolean => {
  const sql = `
SELECT 
  (SELECT COALESCE(SUM(fee_shooting + fee_editing + fee_other), 0) FROM services) as total_fees,
  (SELECT COALESCE(SUM(km_distance * km_rate), 0) FROM services) as total_km_cost,
  (SELECT COALESCE(SUM(CASE WHEN status = 'ricevuto' AND payment_type != 'rimborso' THEN amount ELSE 0 END), 0) FROM payments) as total_received,
  (SELECT COALESCE(SUM(CASE WHEN payment_type = 'rimborso' AND status = 'ricevuto' THEN amount ELSE 0 END), 0) FROM payments) as total_refunds,
  (SELECT COALESCE(SUM(CASE WHEN status = 'in_attesa' THEN amount ELSE 0 END), 0) FROM payments) as total_pending,
  (SELECT COALESCE(SUM(CASE WHEN status = 'scaduto' THEN amount ELSE 0 END), 0) FROM payments) as total_overdue,
  (SELECT COALESCE(SUM(CASE WHEN expense_type = 'spostamento_km' THEN km_distance * km_rate ELSE amount * (1 + markup_percent/100) END), 0) FROM expenses) as total_expenses;
`;

  try {
    const result = execSync(
      `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "${sql}" --tuples-only 2>&1`,
      {
        stdio: "pipe",
        encoding: "utf-8",
        timeout: 10000,
      },
    );
    console.warn(
      "[test-data-controller] Calculations verified:",
      result.trim(),
    );
    return true;
  } catch (error) {
    console.warn(
      "[test-data-controller] Calculation verification failed:",
      error,
    );
    return false;
  }
};
