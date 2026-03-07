-- Add default_expense_type to suppliers for auto-fill when creating expenses
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS default_expense_type text;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_default_expense_type_check CHECK (
    default_expense_type IS NULL OR default_expense_type = ANY (ARRAY[
      'spostamento_km', 'pedaggio_autostradale', 'vitto_alloggio',
      'acquisto_materiale', 'abbonamento_software', 'noleggio',
      'altro', 'credito_ricevuto'
    ])
  );
