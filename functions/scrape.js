const { json, error } = require('./lib/shared');
const cheerio = require('cheerio');

/**
 * Web Scraper
 * POST /api/scrape
 * body: { url }
 *
 * Fetches the target page and extracts job listings into a
 * structured format: title, company, location, description,
 * requirements, salary, type, remote, url.
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const targetUrl = (body.url || '').trim();
  if (!/^https?:\/\//.test(targetUrl)) return error('A valid http(s) URL is required');

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
    });
    if (!res.ok) return error('Failed to fetch page (status ' + res.status + ')');
    const raw = await res.text();
    const ct = res.headers.get('content-type') || '';

    let jobs = [];
    if (ct.includes('application/json') || ct.includes('text/json') || /^[\s]*[\[{]/.test(raw)) {
      const parsed = JSON.parse(raw);
      jobs = extractJobsFromJson(parsed, handleGreenhouseObject(parsed));
      if (!jobs.length) jobs = extractJobsFromJson(parsed);
    } else {
      jobs = extractJobs(raw, targetUrl);
    }
    return json({ url: targetUrl, count: jobs.length, jobs });
  } catch (e) {
    return error('Scrape error: ' + e.message);
  }
};

function handleGreenhouseObject(parsed) {
  return parsed.jobs || [];
}

function extractJobsFromJson(parsed, primary) {
  const list = primary || findJobArray(parsed);
  if (!Array.isArray(list)) return [];
  return list.map((j, idx) => {
    if (typeof j === 'string') {
      return { id: uid(), title: j, description: '', requirements: [], remote: false, location: '', type: '', salary: '', url: '', company: '' };
    }
    const obj = j || {};
    const text = safe(obj.title) + ' ' + safe(obj.name) + ' ' + safe(obj.content) + ' ' + safe(obj.description) + ' ' + safe(obj.requirements);
    const location = safe(obj.location && obj.location.name || obj.location) || safe(obj.address && obj.address.name);
    return {
      id: String(obj.id || obj.uuid || uid()),
      title: safe(obj.title || obj.name || obj.jobTitle || obj.position),
      company: safe(obj.company || obj.organization || obj.company_name),
      location,
      type: safe(obj.employment_type || obj.job_type || obj.type || obj.commitment),
      url: safe(obj.absolute_url || obj.url || obj.application_link || obj.apply_url),
      description: stripTags(safe(obj.content || obj.description || obj.summary || obj.responsibilities || text)).slice(0, 800),
      requirements: parseReqs(obj),
      remote: /remote/i.test(safe(obj.location) + ' ' + safe(obj.workplace_type) + ' ' + safe(obj.remote)),
      salary: safe(obj.salary || obj.compensation),
    };
  }).filter((j) => j.title && j.title.length > 1);
}

function findJobArray(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    if (node.some((x) => x && typeof x === 'object' && (x.title || x.name || x.jobTitle))) return node;
    for (const child of node) { const r = findJobArray(child); if (r) return r; }
    return null;
  }
  for (const key of Object.keys(node)) {
    // skip small primitives but recurse
    const val = node[key];
    if (Array.isArray(val) && val.length) {
      if (val.some((x) => x && typeof x === 'object' && (x.title || x.name || x.jobTitle || x.position))) return val;
    }
    const r = findJobArray(val);
    if (r) return r;
  }
  return null;
}

function parseReqs(obj) {
  const raw = [obj.requirements, obj.requirement, obj.skills, obj.keywords, obj.tags];
  const out = [];
  raw.filter(Boolean).forEach((r) => {
    if (Array.isArray(r)) r.forEach((x) => { if (typeof x === 'string') out.push(x); else out.push(safe(x.name || x.title || JSON.stringify(x))); });
    else out.push(safe(r));
  });
  return out.slice(0, 8);
}

function safe(s) { return s == null ? '' : String(s); }
function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function extractJobs(html, baseUrl) {
  const $ = cheerio.load(html);
  const jobs = [];

  // Greenhouse
  $('section[class*="opening"], div.opening, .opening, tr[data-id]').each((_, el) => {
    const t = $(el);
    const title = clean(t.find('.title a, a, .opening__title').first().text());
    if (!title) return;
    jobs.push({
      id: uid(),
      title,
      company: clean(t.find('.company_name, .opening__company').text()),
      location: clean(t.find('.location, .opening__location, .metadata').first().text()),
      type: clean(t.find('.employment-type, .time-type').text()),
      url: absolutize(t.find('a').first().attr('href'), baseUrl),
      description: clean(t.find('.content, .opening__description, td').last().text()).slice(0, 800),
      requirements: [],
      remote: /remote/i.test(t.text()),
      salary: '',
    });
  });

  // Lever
  $('.posting, .postings-group__item, article.posting').each((_, el) => {
    const t = $(el);
    const title = clean(t.find('.posting-title, .posting__title, h3').first().text());
    if (!title) return;
    jobs.push({
      id: uid(),
      title,
      company: clean(t.find('.posting-company, .company-name').text()),
      location: clean(t.find('.posting-categories, .location, .workplace-types').text()).replace(/\s+/g, ' ').trim(),
      type: clean(t.find('.commitment').text()),
      url: absolutize(t.find('a').first().attr('href'), baseUrl),
      description: clean(t.find('.posting-content, .posting__description').text()).slice(0, 800),
      requirements: [],
      remote: /remote/i.test(t.text()),
      salary: '',
    });
  });

  // Workable / Breezy / generic cards
  if (!jobs.length) {
    $('a[href*="job"], .job, .job-card, .job-listing, article, li[class*="job"], div[class*="job"]').each((_, el) => {
      const t = $(el);
      const title = clean(t.find('h2, h3, h4, .title, .job-title, a').first().text());
      if (!title || title.length > 120) return;
      const desc = clean(t.text());
      const keywords = ['remote', 'salary', 'requirements', 'responsibilities'];
      jobs.push({
        id: uid(),
        title,
        company: clean(t.find('.company').text()),
        location: clean(t.find('.location, .meta').first().text()),
        type: '',
        url: absolutize(t.find('a').attr('href'), baseUrl),
        description: desc.slice(0, 800),
        requirements: inferRequirements(desc),
        remote: /remote/i.test(desc),
        salary: (desc.match(/\$\s?\d[\d,]*(\s?[kK]?)/) || [])[0] || '',
      });
    });
  }

  // Dedup by title
  const seen = new Set();
  return jobs.filter((j) => {
    const key = (j.title + j.location).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferRequirements(desc) {
  const reqs = [];
  const patterns = [
    /(?:requirement|required)[^.\n]*?([^.\n]+)/gi,
    /(?:experience with|proficiency in|expertise in|familiarity with)[^.\n]{2,60}/gi,
    /(?:skills?)[:\s]([^.\n]{2,80})/gi,
  ];
  patterns.forEach((re) => {
    let m;
    while ((m = re.exec(desc)) && reqs.length < 8) {
      const r = (m[1] || m[0] || '').trim().replace(/^[\s:;-]+/, '');
      if (r.length > 2 && reqs.indexOf(r) === -1) reqs.push(r);
    }
  });
  return reqs.slice(0, 8);
}

function absolutize(href, base) {
  if (!href) return '';
  try { return new URL(href, base).toString(); } catch { return href; }
}
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function uid() { return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
