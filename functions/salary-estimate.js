const { json, error } = require('./lib/shared');

const SALARY_DATA = {
  // Base salaries by role (USD, annual)
  roles: {
    'software engineer': { base: 130000, exp_multiplier: 0.12 },
    'senior software engineer': { base: 165000, exp_multiplier: 0.1 },
    'staff engineer': { base: 200000, exp_multiplier: 0.08 },
    'principal engineer': { base: 240000, exp_multiplier: 0.05 },
    'frontend engineer': { base: 125000, exp_multiplier: 0.12 },
    'backend engineer': { base: 135000, exp_multiplier: 0.12 },
    'full stack engineer': { base: 130000, exp_multiplier: 0.12 },
    'devops engineer': { base: 140000, exp_multiplier: 0.1 },
    'ml engineer': { base: 155000, exp_multiplier: 0.12 },
    'data engineer': { base: 145000, exp_multiplier: 0.1 },
    'data scientist': { base: 140000, exp_multiplier: 0.12 },
    'engineering manager': { base: 185000, exp_multiplier: 0.08 },
    'tech lead': { base: 175000, exp_multiplier: 0.08 },
    'product manager': { base: 150000, exp_multiplier: 0.1 },
    'designer': { base: 110000, exp_multiplier: 0.12 },
    'qa engineer': { base: 100000, exp_multiplier: 0.1 },
    'security engineer': { base: 150000, exp_multiplier: 0.12 },
    'platform engineer': { base: 155000, exp_multiplier: 0.1 },
    'site reliability engineer': { base: 150000, exp_multiplier: 0.1 },
  },

  // Location multipliers (moderated)
  locations: {
    'san francisco': 1.25, 'sf': 1.25, 'bay area': 1.22,
    'new york': 1.2, 'nyc': 1.2, 'manhattan': 1.22,
    'seattle': 1.15, 'boston': 1.12, 'los angeles': 1.12,
    'austin': 1.05, 'denver': 1.08, 'chicago': 1.05,
    'atlanta': 1.02, 'remote': 1.0, 'remote us': 1.0,
    'london': 0.95, 'uk': 0.7, 'berlin': 0.8, 'amsterdam': 0.85,
    'toronto': 0.8, 'vancouver': 0.85, 'sydney': 0.9,
    'singapore': 0.95, 'tokyo': 0.8,
  },

  // Industry multipliers (moderated)
  industries: {
    'fintech': 1.1, 'ai': 1.15, 'ml': 1.15, 'crypto': 1.15,
    'big tech': 1.15, 'faang': 1.2, 'unicorn': 1.12,
    'healthcare': 1.05, 'ecommerce': 1.02, 'saas': 1.05,
    'gaming': 1.0, 'edtech': 0.95, 'nonprofit': 0.9,
  },

  // Skill premiums (annual $)
  skill_premiums: {
    'kubernetes': 15000, 'aws': 10000, 'gcp': 10000, 'azure': 8000,
    'terraform': 8000, 'kafka': 10000, 'spark': 12000,
    'react': 5000, 'typescript': 5000, 'go': 8000, 'rust': 12000,
    'python': 5000, 'java': 3000, 'c++': 8000,
    'graphql': 5000, 'microservices': 8000, 'system design': 10000,
  },
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({});
  if (event.httpMethod !== 'POST') return error('Method not allowed', 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return error('Invalid JSON body'); }

  const { role, location, experience_years, skills = [], industry, company_size } = body;
  if (!role) return error('Role is required');

  const normalizedRole = role.toLowerCase().trim();
  const roleData = SALARY_DATA.roles[normalizedRole] || SALARY_DATA.roles['software engineer'];

  const locKey = (location || 'remote').toLowerCase().trim();
  const locationMult = SALARY_DATA.locations[locKey] || 1.0;

  const expYears = Math.max(0, Math.min(20, parseInt(experience_years) || 0));
  const expMult = 1 + (expYears * roleData.exp_multiplier);

  const industryKey = (industry || '').toLowerCase();
  const industryMult = SALARY_DATA.industries[industryKey] || 1.0;

  const skillPremium = skills
    .map(s => SALARY_DATA.skill_premiums[s.toLowerCase().trim()] || 0)
    .reduce((a, b) => a + b, 0);

  const companySizeMult = company_size === 'startup' ? 0.9 : company_size === 'enterprise' ? 1.05 : 1.0;

  // Simplified realistic calculation
  const base = roleData.base;
  const locationAdjusted = Math.round(base * locationMult);
  const experienceAdj = Math.round(base * (expMult - 1) * 0.6);
  const industryAdj = Math.round(base * (industryMult - 1) * 0.4);
  const sizeAdj = Math.round(base * (companySizeMult - 1) * 0.3);

  const estimated = locationAdjusted + experienceAdj + industryAdj + sizeAdj + skillPremium;
  const range = {
    low: Math.round(estimated * 0.85),
    mid: estimated,
    high: Math.round(estimated * 1.2),
  };

  const equity = estimateEquity(company_size, role, industry);
  const benefits = estimateBenefits(company_size, location);

  return json({
    role,
    location: location || 'Remote',
    experience_years: expYears,
    estimated_salary: range,
    breakdown: {
      base_role: base,
      location_multiplier: locationMult,
      experience_multiplier: expMult.toFixed(2),
      industry_multiplier: industryMult,
      company_size_multiplier: companySizeMult,
      skill_premiums: skillPremium,
    },
    equity,
    benefits,
    currency: 'USD',
    confidence: 'medium',
    note: 'Estimates based on 2024 market data. Actual offers vary by company, negotiation, and market conditions.',
  });
};

function estimateEquity(size, role, industry) {
  if (size === 'startup' || size === 'early') {
    const roleEquity = ['staff engineer', 'principal engineer', 'engineering manager', 'tech lead'].includes(role.toLowerCase()) ? '0.1-0.5%' : '0.01-0.1%';
    return { type: 'ISO/NSO', range: roleEquity, vesting: '4 years, 1yr cliff' };
  }
  if (['big tech', 'faang', 'unicorn'].includes((industry || '').toLowerCase())) {
    return { type: 'RSU', range: '$50k-$300k over 4 years', vesting: '4 years, quarterly' };
  }
  return { type: 'Typically none', range: 'N/A', vesting: 'N/A' };
}

function estimateBenefits(size, location) {
  const base = ['Health/Dental/Vision', '401k matching', 'PTO (15-20 days)', 'Sick leave', 'Parental leave'];
  if (size === 'big tech' || size === 'faang') {
    return [...base, 'Free meals', 'Commuter benefits', 'Learning budget ($2-5k)', 'Wellness stipend', 'Stock refreshers'];
  }
  if (size === 'startup') {
    return [...base, 'Flexible hours', 'Remote-friendly', 'Learning budget ($1-3k)', 'Equity upside'];
  }
  return base;
}