-- Workflow Automation System
-- Per uso personale: automazione semplice basata su trigger

CREATE TABLE IF NOT EXISTS public.workflows (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Trigger configuration
  trigger_resource TEXT NOT NULL CHECK (trigger_resource IN ('projects', 'quotes', 'payments', 'client_tasks')),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('created', 'updated', 'status_changed')),
  trigger_conditions JSONB DEFAULT '{}', -- {"status": "in_corso", "category": "wedding"}

  -- Actions to execute (array of actions)
  actions JSONB NOT NULL DEFAULT '[]',
  -- Example: [
  --   {"type": "create_task", "data": {"text": "Follow up", "due_days": 3}},
  --   {"type": "update_field", "data": {"field": "status", "value": "in_lavorazione"}}
  -- ]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow execution log (for debugging and tracking)
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_resource TEXT NOT NULL,
  trigger_record_id TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'running', 'completed', 'failed')),
  execution_result JSONB DEFAULT '{}',
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated full access" ON public.workflows
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated full access" ON public.workflow_executions
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflows_active ON public.workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON public.workflows(trigger_resource, trigger_event);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_record ON public.workflow_executions(trigger_resource, trigger_record_id);

-- Reuse existing set_updated_at() function from earlier migrations
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON public.workflows;
CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Default workflow templates
INSERT INTO public.workflows (name, description, trigger_resource, trigger_event, trigger_conditions, actions)
VALUES
  (
    'Preventivo accettato → Crea progetto',
    'Quando un preventivo viene accettato, crea automaticamente un progetto collegato',
    'quotes',
    'status_changed',
    '{"status": "accettato"}',
    '[{"type": "create_project", "data": {"copy_from_quote": true}}]'::jsonb
  ),
  (
    'Progetto avviato → Task di briefing',
    'Quando un progetto passa a in_corso, crea un task di briefing iniziale',
    'projects',
    'status_changed',
    '{"status": "in_corso"}',
    '[{"type": "create_task", "data": {"text": "Briefing iniziale con cliente", "due_days": 2}}]'::jsonb
  ),
  (
    'Pagamento ricevuto → Task ringraziamento',
    'Quando ricevi un pagamento, crea task per inviare ricevuta e ringraziare',
    'payments',
    'created',
    '{}',
    '[{"type": "create_task", "data": {"text": "Invia ricevuta e ringrazia cliente", "due_days": 1}}]'::jsonb
  );
