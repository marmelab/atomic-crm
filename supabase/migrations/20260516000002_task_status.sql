ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';

UPDATE public.tasks
  SET status = 'completed'
  WHERE done_date IS NOT NULL AND status = 'todo';
