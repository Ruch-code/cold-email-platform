const { json, error } = require('./lib/shared');

/**
 * ATS-Optimize Resume
 * POST /api/ats-optimize
 * body: { resume, jd, keywords[], target_role }
 *
 * Optimizes resume for ATS parsing: keyword density, standard sections,
 * formatting, action verbs, quantified achievements
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { resume, jd, keywords = [], target_role } = body;
  if (!resume || !jd) return error('Resume and job description required');

  const apiKey = process.env.OPENAI_API_KEY || body.openaiKey;
  if (!apiKey) {
    return json({ resume: localATSOptimize(resume, keywords), mode: 'local', analysis: localATSAnalysis(resume, keywords) });
  }

  try {
    const sys = `You are an ATS optimization expert. Rewrite the resume to maximize ATS score while keeping all facts accurate.
RULES:
1. NEVER invent facts, dates, companies, or skills not in original resume.
2. Use standard ATS-friendly section headers: Professional Summary, Technical Skills, Work Experience, Education, Projects, Certifications.
3. Integrate these keywords naturally (exact matches): ${keywords.join(', ') || '(none specified)'}.
4. Use strong action verbs (Spearheaded, Engineered, Architected, Delivered, Optimized, Reduced, Increased, Automated).
5. Quantify achievements with metrics (%, $, time saved, scale).
6. Keep formatting clean - no tables, columns, graphics, or special characters.
7. Target role: ${target_role || 'Software Engineer'}.
8. Output plain text with clear section delimiters.`;

    const user = `JOB DESCRIPTION:\n${jd}\n\nORIGINAL RESUME:\n${resume}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'OpenAI error');

    let optimized = data.choices?.[0]?.message?.content || '';
    const analysis = analyzeATS(optimized, keywords);

    return json({ resume: optimized, analysis, mode: 'ai' });
  } catch (e) {
    return json({ resume: localATSOptimize(resume, keywords), analysis: localATSAnalysis(resume, keywords), mode: 'local', note: e.message });
  }
};

function localATSOptimize(resume, keywords) {
  let out = resume;
  // Ensure standard sections exist
  const sections = ['PROFESSIONAL SUMMARY', 'TECHNICAL SKILLS', 'WORK EXPERIENCE', 'EDUCATION', 'PROJECTS', 'CERTIFICATIONS'];
  sections.forEach(s => {
    if (!out.toUpperCase().includes(s)) out = s + '\n\n' + out;
  });
  // Bold keywords
  keywords.forEach(k => {
    const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    out = out.replace(re, (m) => '**' + m + '**');
  });
  return 'ATS-OPTIMIZED (local mode - add OpenAI key for AI optimization):\n\n' + out;
}

function localATSAnalysis(resume, keywords) {
  return analyzeATS(resume, keywords);
}

function analyzeATS(text, keywords) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const totalWords = words.length;
  const keywordMatches = keywords.filter(k => text.toLowerCase().includes(k.toLowerCase())).length;
  const keywordDensity = totalWords > 0 ? (keywordMatches / keywords.length * 100).toFixed(1) : 0;

  const hasStandardSections = [
    'summary', 'skills', 'experience', 'education', 'projects', 'certifications'
  ].filter(s => text.toLowerCase().includes(s)).length;

  const actionVerbs = ['spearheaded', 'engineered', 'architected', 'delivered', 'optimized', 'reduced', 'increased', 'automated', 'built', 'designed', 'implemented', 'led', 'managed', 'created', 'developed'];
  const verbCount = actionVerbs.filter(v => text.toLowerCase().includes(v)).length;

  const metrics = (text.match(/\d+%|\$\d+|\d+\s*(years?|months?|weeks?|days?)|\d+[km]?\s*(users?|customers?|requests?|transactions?)/gi) || []).length;

  return {
    keyword_coverage: `${keywordMatches}/${keywords.length} (${keywordDensity}%)`,
    standard_sections: `${hasStandardSections}/6`,
    action_verbs_used: verbCount,
    quantified_achievements: metrics,
    ats_score_estimate: Math.min(100, Math.round((keywordMatches/keywords.length)*40 + (hasStandardSections/6)*25 + Math.min(verbCount/5,1)*20 + Math.min(metrics/3,1)*15)),
    recommendations: generateRecommendations(keywordMatches, keywords.length, hasStandardSections, verbCount, metrics)
  };
}

function generateRecommendations(kwMatch, kwTotal, sections, verbs, metrics) {
  const recs = [];
  if (kwMatch < kwTotal) recs.push(`Add missing keywords: ${kwTotal - kwMatch} not found`);
  if (sections < 6) recs.push(`Add missing standard sections (${6-sections} missing)`);
  if (verbs < 5) recs.push('Use more strong action verbs (spearheaded, engineered, delivered, etc.)');
  if (metrics < 3) recs.push('Add more quantified achievements with metrics (%$, time, scale)');
  return recs;
}