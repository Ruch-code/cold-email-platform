const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

/** AWS-lambda-style response for Netlify function compatibility. */
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  };
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!global.__supabase) global.__supabase = require('@supabase/supabase-js').createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return global.__supabase;
}

module.exports = { corsHeaders, json, error, getSupabase };
