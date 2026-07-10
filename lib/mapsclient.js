'use strict';
// Google Maps Scraper API client
// Calls the melogabriel/google-maps-scraper REST API
// Default: https://google-maps-scraper-6lcb.onrender.com (demo instance)
// Set MAPS_SCRAPER_URL env var for your own deployment

const MAPS_SCRAPER_URL = process.env.MAPS_SCRAPER_URL || 'https://google-maps-scraper-6lcb.onrender.com';

async function createJob({ name, keywords, lang = 'en', depth = 10, email = true, maxTimeSec = 600, lat = '0', lon = '0', zoom = 12, radius = 15000 }) {
  const body = {
    name,
    keywords: Array.isArray(keywords) ? keywords : [keywords],
    lang,
    zoom,
    lat,
    lon,
    fast_mode: false,
    radius,
    depth,
    email,
    max_time: maxTimeSec,
    proxies: [],
  };

  const res = await fetch(`${MAPS_SCRAPER_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Maps scraper error ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.id;
}

async function getJob(jobId) {
  const res = await fetch(`${MAPS_SCRAPER_URL}/api/v1/jobs/${jobId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Maps scraper error ${res.status}`);
  }
  return res.json();
}

async function waitForJob(jobId, pollMs = 5000, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const job = await getJob(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'ok') return job;
    if (job.status === 'failed') throw new Error('Scraping job failed');
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error('Timed out waiting for scraping job');
}

async function downloadResults(jobId) {
  const res = await fetch(`${MAPS_SCRAPER_URL}/api/v1/jobs/${jobId}/download`);
  if (!res.ok) throw new Error(`Download error ${res.status}`);
  return res.text();
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').replace(/^"|"$/g, ''); });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

async function runLeadSearch(name, queries, apiKey) {
  const keywords = queries.map((q) => q.query);
  const jobId = await createJob({ name, keywords, email: true, depth: 5, maxTimeSec: 600 });
  const job = await waitForJob(jobId);
  const csv = await downloadResults(jobId);
  const leads = parseCSV(csv);
  return { jobId, job, leads, totalLeads: leads.length };
}

module.exports = { createJob, getJob, waitForJob, downloadResults, parseCSV, runLeadSearch, MAPS_SCRAPER_URL };
