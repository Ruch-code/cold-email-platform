const { json, error } = require('./_shared');

/**
 * Job Scanner
 * POST /api/job-scan
 * body: { keywords, location?, role?, source? }
 *
 * Attempts to fetch real matching listings from public sources
 * (Greenhouse / Lever public boards). If nothing found, returns
 * the raw query so the client can fall back.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const keywords = (body.keywords || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!keywords.length) return error('At least one keyword is required');

  const location = body.location || '';
  const role = body.role || '';
  const source = body.source || 'aggregator';

  const found = [];

  // Try Greenhouse boards (very common for tech companies)
  try {
    const samples = [
      'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
      'https://boards-api.greenhouse.io/v1/boards/airbnb/jobs',
      'https://boards-api.greenhouse.io/v1/boards/dropbox/jobs',
      'https://boards-api.greenhouse.io/v1/boards/spotify/jobs',
      'https://boards-api.greenhouse.io/v1/boards/gusto/jobs',
      'https://boards-api.greenhouse.io/v1/boards/zapier/jobs',
    ];
    for (const url of samples) {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const data = await r.json();
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      for (const j of jobs) {
        if (found.length >= 30) break;
        const haystack = (j.title || '') + ' ' + (j.content || '') + ' ' + (j.location && j.location.name || '');
        const lower = haystack.toLowerCase();
        const matched = keywords.filter((k) => lower.includes(k.toLowerCase()));
        const locOk = !location || (j.location && (j.location.name || '').toLowerCase().includes(location.toLowerCase()));
        if (matched.length && locOk) {
          found.push({
            id: j.id || String(!found.length),
            title: j.title,
            company: body.preview || url.match(/boards\/([^/]+)/)?.[1] || 'Company',
            location: j.location ? j.location.name : '',
            source,
            description: (j.content || '').replace(/<[^>]+>/g, ' ').slice(0, 600),
            url: j.absolute_url || '',
            keywords: matched,
            posted: j.updated_at || '',
            role,
          });
        }
      }
      if (found.length >= 30) break;
    }
  } catch (e) { /* ignore network errors, continue */ }

  return json({ jobs: found, query: { keywords, location, role, source } });
};
