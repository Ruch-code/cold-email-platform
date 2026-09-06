const { json, error, getSupabase } = require('./lib/shared');

/**
 * Approve/Reject Access Request (Admin)
 * POST /api/admin/decision
 * body: { request_id, action: 'approve'|'reject', admin_notes }
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  const supabase = getSupabase();
  if (!supabase) return error('Supabase not configured');

  // Verify admin token
  const auth = event.headers.authorization?.replace('Bearer ', '');
  if (!auth || !auth.startsWith('admin:')) return error('Admin authentication required', 401);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON'); }

  const { request_id, action, admin_notes } = body;
  if (!request_id || !['approve', 'reject'].includes(action)) {
    return error('request_id and action (approve/reject) required');
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  
  const { data, error: err } = await supabase
    .from('access_requests')
    .update({ 
      status: newStatus, 
      reviewed_at: new Date().toISOString(),
      admin_notes: admin_notes || ''
    })
    .eq('id', request_id)
    .select()
    .single();

  if (err) return error(err.message);

  // If approved, create Supabase auth user (optional - they can sign up themselves)
  // For now, just update the request status

  return json({ request: data, message: `Request ${action}d successfully` });
};