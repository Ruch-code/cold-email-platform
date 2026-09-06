const { json, error } = require('./lib/shared');

/**
 * Remote Job Aggregator
 * POST /api/remote-fetch
 * body: { source, url, keywords[], timeFilter, parser }
 * 
 * Fetches and parses remote jobs from various sources
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { source, url, keywords = [], timeFilter, parser } = body;
  if (!source) return error('Source identifier required');

  try {
    let jobs = [];
    
    switch (parser || source) {
      case 'github':
        jobs = await fetchGitHubJobs(url, keywords);
        break;
      case 'remoteok':
        jobs = await fetchRemoteOK(url, keywords);
        break;
      case 'wwr':
      case 'weworkremotely':
        jobs = await fetchWeWorkRemotely(url, keywords);
        break;
      case 'remotive':
        jobs = await fetchRemotive(url, keywords);
        break;
      case 'stackoverflow':
        jobs = await fetchStackOverflow(url, keywords);
        break;
      case 'custom':
        jobs = await fetchCustomSource(url, keywords);
        break;
      default:
        jobs = await fetchGenericSource(url, keywords);
    }

    // Filter by time if specified
    if (timeFilter && timeFilter !== '') {
      jobs = filterByTime(jobs, timeFilter);
    }

    // Filter by keywords
    if (keywords.length) {
      jobs = jobs.filter(job => matchesKeywords(job, keywords));
    }

    return json({ source, count: jobs.length, jobs });
  } catch (err) {
    return error('Fetch failed: ' + err.message);
  }
};

async function fetchGitHubJobs(url, keywords) {
  try {
    const res = await fetch(url || 'https://jobs.github.com/positions.json?description=remote', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map(j => ({
      id: j.id || uid(),
      title: j.title,
      company: j.company,
      location: j.location || 'Remote',
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
      url: j.url,
      tags: j.tags || [],
      posted: j.created_at,
      salary: '',
      type: j.type,
      remote: true
    }));
  } catch { return []; }
}

async function fetchRemoteOK(url, keywords) {
  try {
    const res = await fetch(url || 'https://remoteok.io/api', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(1).map(j => ({ // First item is metadata
      id: j.id || uid(),
      title: j.position,
      company: j.company,
      location: j.location || 'Remote',
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
      url: j.url,
      tags: j.tags || [],
      posted: j.date,
      salary: j.salary,
      type: 'Full-time',
      remote: true
    }));
  } catch { return []; }
}

async function fetchWeWorkRemotely(url, keywords) {
  try {
    const res = await fetch(url || 'https://weworkremotely.com/remote-jobs.rss', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseWWRRSS(text);
  } catch { return []; }
}

function parseWWRRSS(xml) {
  const jobs = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) && jobs.length < 50) {
    const item = match[1];
    const title = extractXML(item, 'title');
    const link = extractXML(item, 'link');
    const description = extractXML(item, 'description');
    const pubDate = extractXML(item, 'pubDate');
    const category = extractXML(item, 'category');
    
    if (title && link) {
      jobs.push({
        id: uid(),
        title: title.replace('🌎', '').trim(),
        company: category || 'Company',
        location: 'Remote',
        description: description.replace(/<[^>]+>/g, ' ').slice(0, 800),
        url: link,
        tags: [],
        posted: pubDate,
        salary: '',
        type: 'Full-time',
        remote: true
      });
    }
  }
  return jobs;
}

function extractXML(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() : '';
}

async function fetchRemotive(url, keywords) {
  try {
    const res = await fetch(url || 'https://remotive.io/api/remote-jobs', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      id: j.id || uid(),
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      description: (j.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800),
      url: j.url,
      tags: j.tags || [],
      posted: j.publication_date,
      salary: j.salary,
      type: j.job_type,
      remote: true
    }));
  } catch { return []; }
}

async function fetchStackOverflow(url, keywords) {
  try {
    const res = await fetch(url || 'https://stackoverflow.com/jobs/feed', {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseStackOverflowRSS(text);
  } catch { return []; }
}

function parseStackOverflowRSS(xml) {
  const jobs = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) && jobs.length < 30) {
    const item = match[1];
    const title = extractXML(item, 'title');
    const link = extractXML(item, 'link');
    const description = extractXML(item, 'description');
    const pubDate = extractXML(item, 'pubDate');
    
    if (title && link && /remote/gi.test(title + description)) {
      jobs.push({
        id: uid(),
        title: title.replace(' - Stack Overflow', '').trim(),
        company: 'Stack Overflow Jobs',
        location: 'Remote',
        description: description.replace(/<[^>]+>/g, ' ').slice(0, 800),
        url: link,
        tags: [],
        posted: pubDate,
        salary: '',
        type: 'Full-time',
        remote: true
      });
    }
  }
  return jobs;
}

async function fetchCustomSource(url, keywords) {
  // For custom sources, try to scrape as generic HTML
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    return extractGenericJobs(html, url);
  } catch { return []; }
}

async function fetchGenericSource(url, keywords) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'HiredHunter/1.0' }
    });
    if (!res.ok) return [];
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const data = await res.json();
      return Array.isArray(data) ? data.slice(0, 50).map(j => normalizeJob(j)) : [];
    }
    const html = await res.text();
    return extractGenericJobs(html, url);
  } catch { return []; }
}

function normalizeJob(j) {
  return {
    id: j.id || j.uuid || uid(),
    title: j.title || j.position || j.name || 'Position',
    company: j.company || j.company_name || j.organization || 'Company',
    location: j.location || j.address || j.candidate_required_location || 'Remote',
    description: (j.description || j.summary || '').toString().replace(/<[^>]+>/g, ' ').slice(0, 800),
    url: j.url || j.absolute_url || j.apply_url || j.link || '',
    tags: j.tags || j.keywords || [],
    posted: j.date || j.created_at || j.publication_date || j.updated_at,
    salary: j.salary || j.compensation || '',
    type: j.type || j.job_type || j.employment_type || 'Full-time',
    remote: /remote/gi.test(JSON.stringify(j))
  };
}

function extractGenericJobs(html, baseUrl) {
  const jobs = [];
  const $ = require('cheerio').load(html);
  
  // Common job card selectors
  const selectors = [
    '.job', '.job-card', '.job-listing', '.position', '.opening',
    '[class*="job"]', '[class*="position"]', '[class*="opening"]',
    'article', 'li[class*="job"]', 'tr[class*="job"]'
  ];
  
  for (const sel of selectors) {
    const elements = $(sel);
    if (elements.length > 0 && elements.length < 100) {
      elements.each((_, el) => {
        const $el = $(el);
        const title = $el.find('h1, h2, h3, h4, .title, .job-title, a').first().text().trim();
        const company = $el.find('.company, .company-name, .org').first().text().trim();
        const location = $el.find('.location, .loc, .remote').first().text().trim();
        const desc = $el.find('.description, .summary, .desc, p').first().text().trim();
        const link = $el.find('a').first().attr('href');
        
        if (title && title.length > 3 && title.length < 120) {
          jobs.push({
            id: uid(),
            title,
            company: company || 'Company',
            location: location || 'Remote',
            description: desc.slice(0, 800),
            url: link ? new URL(link, baseUrl).toString() : '',
            tags: [],
            posted: '',
            salary: '',
            type: 'Full-time',
            remote: /remote/gi.test(title + ' ' + location + ' ' + desc)
          });
        }
      });
      if (jobs.length > 0) break;
    }
  }
  
  return jobs.slice(0, 50);
}

function filterByTime(jobs, timeFilter) {
  const now = Date.now();
  const limits = {
    '24h': 24 * 60 * 60 * 1000,
    'week': 7 * 24 * 60 * 60 * 1000,
    'month': 30 * 24 * 60 * 60 * 1000
  };
  const limit = limits[timeFilter];
  if (!limit) return jobs;
  
  return jobs.filter(job => {
    if (!job.posted) return true;
    const posted = new Date(job.posted).getTime();
    return isNaN(posted) || (now - posted) < limit;
  });
}

function matchesKeywords(job, keywords) {
  const haystack = (job.title + ' ' + job.description + ' ' + job.company + ' ' + (job.tags || []).join(' ')).toLowerCase();
  return keywords.some(k => haystack.includes(k.toLowerCase()));
}

function uid() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}