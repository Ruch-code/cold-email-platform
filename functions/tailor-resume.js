const { json, error } = require('./lib/shared');

/**
 * Tailor Resume
 * POST /api/tailor-resume
 * body: { resume, jd, keywords[], keepKeywords }
 *
 * Uses OpenAI to rewrite the resume against the job description,
 * while strictly keeping the matched keywords and true facts.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const resume = body.resume || '';
  const jd = body.jd || '';
  if (!resume || !jd) return error('Both resume and job description are required');

  const keywords = Array.isArray(body.keywords) ? body.keywords : [];
  const keepKeywords = body.keepKeywords !== false;

  const apiKey = process.env.OPENAI_API_KEY || body.openaiKey;
  if (!apiKey) {
    // No key: do a deterministic local transformation (keyword emphasis)
    return json({ resume: localTailor(resume, keywords), mode: 'local' });
  }

  try {
    const sys = `You are an expert resume writer. Rewrite the candidate's resume so it matches the given job description. STRICT RULES:
1. NEVER invent facts, skills, dates, or companies that are not in the original resume.
2. Emphasize relevant experience first, de-emphasize (but keep) unrelated items.
3. Keep ALL of these keywords present in the resume exactly: ${keywords.join(', ') || '(none specified)'}.
4. Use strong action verbs and quantify where the original supports it.
5. Stay under ~420 words. Output resume plain text with clear section headings (Summary, Experience, Skills, Education).`;

    const user = `JOB DESCRIPTION:\n${jd}\n\nCANDIDATE RESUME:\n${resume}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'OpenAI error');
    let tailored = data.choices?.[0]?.message?.content || '';

    // Guarantee keyword presence if requested
    if (keepKeywords && keywords.length) {
      for (const k of keywords) {
        if (!tailored.toLowerCase().includes(k.toLowerCase())) {
          tailored = tailored + '\n- ' + k;
        }
      }
    }
    return json({ resume: tailored, mode: 'ai', keywordsRetained: keywords.filter((k) => tailored.toLowerCase().includes(k.toLowerCase())) });
  } catch (e) {
    return json({ resume: localTailor(resume, keywords), mode: 'local', note: e.message });
  }
};

function localTailor(resume, keywords) {
  let out = resume;
  keywords.forEach((k) => {
    const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    out = out.replace(re, (m) => '**' + m + '**');
  });
  return 'KEYWORD-ENRICHED RESUME (no OpenAI key set — keywords bolded/kept):\n\n' + out;
}
