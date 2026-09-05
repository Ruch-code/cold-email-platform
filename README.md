# Cold Email Platform

A Netlify-hosted cold emailing platform that finds job opportunities, scrapes job listings, and sends personalized cold emails to recruiters.

## Features

- 🔍 **Job Scanner** — Search for jobs by desired keywords/skills and save them to the database
- 🕷️ **Web Scraper** — Scrape any careers/jobs page and get structured output (title, company, location, description, requirements)
- 📄 **Resume Booster** — Upload your resume once; it's rewritten per job description, keeping matched keywords
- ✉️ **Cold Email Engine** — Generate personalized cold emails to recruiters and send them via Resend
- 🗃️ **Database** — All leads, jobs, and resumes stored (localStorage backup + Supabase-ready)

## Quick Start (Local)

```bash
npm install
netlify dev
```

Open http://localhost:8888

## Environment Variables

Create `.env` (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for sending emails |
| `OPENAI_API_KEY` | OpenAI key for resume tailoring & email generation (optional; has offline fallback) |
| `SUPABASE_URL` | Supabase URL (optional; falls back to localStorage) |
| `SUPABASE_ANON_KEY` | Supabase anon key (optional) |

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import from Git** and pick this repo.
3. Set the env vars above.
4. Deploy — any push to `main` auto-deploys.
