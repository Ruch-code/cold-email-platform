const { json, error, getSupabase } = require('./lib/shared');

/**
 * Request Access
 * POST /api/auth/request-access
 * body: { name, email, reason, role }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { name, email, reason, role } = body;
  if (!name || !email || !reason) return error('Name, email, and reason required');

  // Check if already exists
  const { data: existing } = await supabase
    .from('access_requests')
    .select('id, status')
    .eq('email', email)
    .single();

  if (existing) {
    return json({ 
      request: existing, 
      message: existing.status === 'pending' ? 'Request already pending' : 
               existing.status === 'approved' ? 'Already approved - please sign in' : 
               'Previous request was rejected. You may submit a new one.' 
    });
  }

  const { data, error: err } = await supabase
    .from('access_requests')
    .insert([{ 
      name, 
      email, 
      reason, 
      current_role: role, 
      status: 'pending',
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (err) return error(err.message);

  return json({ request: data, message: 'Access request submitted. Admin will review within 24 hours.' });
};