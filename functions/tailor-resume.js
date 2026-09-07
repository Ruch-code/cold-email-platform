const { json, error } = require('./lib/shared');
const { callAIWithFallback, buildProviderChain } = require('./lib/ai-providers');

/**
 * Tailor Resume
 * POST /api/tailor-resume
 * body: { resume, jd, keywords[], keepKeywords }
 *
 * Uses multi-provider AI (Experiential Labs models + OpenAI fallback)
 * to rewrite the resume against the job description.
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

  // Build provider chain from env vars (Experiential Labs + OpenAI fallback)
  const providerChain = buildProviderChain(process.env);
  
  if (providerChain.length === 0) {
    return json({ resume: localTailor(resume, keywords), mode: 'local' });
  }

  const sys = `You are an expert resume writer. Rewrite the candidate's resume so it matches the given job description. STRICT RULES:
1. NEVER invent facts, skills, dates, or companies that are not in the original resume.
2. Emphasize relevant experience first, de-emphasize (but keep) unrelated items.
3. Keep ALL of these keywords present in the resume exactly: ${keywords.join(', ') || '(none specified)'}.
4. Use strong action verbs and quantify where the original supports it.
5. Stay under ~420 words. Output resume plain text with clear section headings (Summary, Experience, Skills, Education).`;

  const user = `JOB DESCRIPTION:\n${jd}\n\nCANDIDATE RESUME:\n${resume}`;

  try {
    const { content: tailored, provider, model } = await callAIWithFallback(
      providerChain,
      {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        maxTokens: 2000,
      }
    );

    // Guarantee keyword presence if requested
    let tailoredResume = tailored;
    if (keepKeywords && keywords.length) {
      for (const k of keywords) {
        if (!tailoredResume.toLowerCase().includes(k.toLowerCase())) {
          tailoredResume = tailoredResume + '\n- ' + k;
        }
      }
    }
    return json({ 
      resume: tailoredResume, 
      mode: 'ai', 
      provider,
      model,
      keywordsRetained: keywords.filter((k) => tailoredResume.toLowerCase().includes(k.toLowerCase())) 
    });
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
  return 'KEYWORD-ENRICHED RESUME (no AI key set — keywords bolded/kept):\n\n' + out;
}