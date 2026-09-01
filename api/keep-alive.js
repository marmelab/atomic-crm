import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    return res.status(200).json({ message: 'Supabase pinged successfully!' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to ping Supabase' });
  }
}