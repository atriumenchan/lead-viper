'use strict';
/**
 * send-test-outreach.js
 * Picks first row from Leads_READY.xlsx, fills the outreach template with
 * real GEO data, and sends a TEST copy to gaurav.mishra@admexo.com via SES.
 *
 * Run from: C:\Users\ADMEXO\Downloads\ai-lead-backend
 *   node scripts/send-test-outreach.js
 */
require('dotenv').config();

const path    = require('path');
const XLSX    = require('xlsx');
const axios   = require('axios');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// ── Config ────────────────────────────────────────────────────────────────────
const EXCEL_PATH = path.join(
  'C:\\Users\\ADMEXO\\Downloads\\leads generation',
  'Leads_READY_final.xlsx'
);
const GEO_API    = 'http://localhost:3001/api/audit';
const TEST_TO    = 'gaurav.mishra@admexo.com';
const FROM_EMAIL = 'Promotions <promotions@admexo.com>';
const YOUR_NAME  = 'Ritabrata Ray';
const YOUR_TITLE = 'Founder';
const YOUR_CO    = 'ADMEXO';

// ── Helpers ───────────────────────────────────────────────────────────────────
const slugify = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);

function parseCity(address) {
  if (!address) return 'your city';
  // "3101 Bee Caves Rd #301, Austin, TX 78746, United States" → "Austin"
  const parts = address.split(',').map(s => s.trim());
  // City is usually the 2nd segment, before the state/zip
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p && !/\d{5}/.test(p) && !/United States/i.test(p) && p.length > 2) {
      // Skip if it looks like a state abbreviation (2 letters)
      const words = p.split(' ').filter(Boolean);
      if (words.length === 1 && words[0].length === 2) continue;
      return p.replace(/,.*$/, '').trim();
    }
  }
  return 'your city';
}

function inferService(category) {
  if (!category) return 'your services';
  const c = category.toLowerCase();
  if (c.includes('plastic') || c.includes('cosmetic')) return 'plastic surgery';
  if (c.includes('orthodon')) return 'orthodontist';
  if (c.includes('dental') || c.includes('dentist'))   return 'dental services';
  if (c.includes('injury') || c.includes('accident'))  return 'personal injury lawyer';
  if (c.includes('medsp') || c.includes('med spa'))    return 'med spa';
  if (c.includes('dermatol'))  return 'dermatology';
  if (c.includes('law') || c.includes('attorney'))     return 'legal services';
  if (c.includes('surgeon') || c.includes('surgery'))  return 'surgical services';
  return category.split('|')[0].trim().toLowerCase();
}

function inferIndustry(category) {
  if (!category) return 'professional services';
  const c = category.toLowerCase();
  if (c.includes('dental') || c.includes('orthodon') || c.includes('dentist')) return 'dental';
  if (c.includes('plastic') || c.includes('cosmetic') || c.includes('surgeon')) return 'aesthetic & plastic surgery';
  if (c.includes('injury') || c.includes('law') || c.includes('attorney')) return 'legal';
  if (c.includes('med spa') || c.includes('medsp')) return 'med spa';
  return 'healthcare';
}

async function getGeoFindings(url) {
  try {
    const res = await axios.post(GEO_API, { url }, { timeout: 20000 });
    const data = res.data;
    const findings = [];
    for (const level of ['p0', 'p1', 'p2']) {
      for (const item of (data.improvements?.[level] || [])) {
        if (findings.length >= 3) break;
        findings.push(`${item.action} — ${item.impact}`);
      }
      if (findings.length >= 3) break;
    }
    // Fallback: use issues
    if (findings.length < 3) {
      for (const issue of (data.issues || [])) {
        if (findings.length >= 3) break;
        findings.push(`${issue.title} — ${issue.desc.split('.')[0]}`);
      }
    }
    return findings.slice(0, 3);
  } catch (e) {
    console.warn('GEO API error:', e.message);
    return [];
  }
}

function buildEmail({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot understand or prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity and Google AI Overviews skip your content entirely';
  const f3 = findings[2] || null;

  // Score-driven traffic loss framing
  const missed     = 100 - score;
  const lossPhrase = missed >= 70
    ? `nearly ${missed}% of people asking AI about ${service} in ${city} are being sent to your competitors`
    : missed >= 40
    ? `roughly ${missed} out of every 100 people searching for "${service} in ${city}" on AI are being directed away from you`
    : `${missed} out of every 100 AI-driven searches for "${service} in ${city}" are going to someone else right now`;

  const urgency = score < 40
    ? `At this score, ${businessName} is effectively invisible on AI. That window to fix this is closing fast.`
    : score < 60
    ? `At this score, the majority of AI-referred customers in ${city} are landing on a competitor\u2019s website \u2014 not yours.`
    : `At this score, you\u2019re losing a significant slice of AI-referred traffic every single day. And it compounds \u2014 the longer it stays unfixed, the harder it is to recover ground once a competitor claims it.`;

  const subject = `${businessName}: ${missed}% of AI searches for your service aren\u2019t finding you`;

  const findingLines = [f1, f2, f3].filter(Boolean)
    .map(f => `  \u2022 ${f}`).join('\n');

  const text = `Hi ${firstName},

Quick question \u2014 when someone opens ChatGPT or Perplexity and types \u201c${service} in ${city}\u201d, does ${businessName} come up?

I ran your site through our AI Visibility audit. Here\u2019s what came back:

  Your GEO Score: ${score}/100

What that number actually means:
${lossPhrase}.

${urgency}

AI search now accounts for 30\u201340% of all discovery traffic for local and professional services in the US. That number will cross 50% within 12 months. Unlike Google, there\u2019s no \u201crank tracker\u201d for AI \u2014 most business owners don\u2019t even know they\u2019re invisible until a competitor has already locked in that position.

Here\u2019s exactly why ${businessName} is being skipped right now:

${findingLines}

Each of these is an open door sending your potential clients straight to whoever fixed it first.

Here\u2019s what to do about it:
${REPORT_LINK}

(Free, no login \u2014 full breakdown of every issue and the exact fix for each one.)

What we do:
We close those doors. We handle structured data, llms.txt setup, citation building, schema implementation, and ongoing AI visibility tracking across ChatGPT, Gemini, Claude, Perplexity, and Bing \u2014 so when someone in ${city} asks for a ${service}, ${businessName} is the name they get.

If you want to move on this before a competitor does, I have a few slots open this week.

${REPORT_LINK}
Or reply directly and I\u2019ll send over a full fix plan.

\u2014 ${YOUR_NAME}
${YOUR_TITLE}, ${YOUR_CO}

P.S. We\u2019re onboarding a limited number of ${industry} businesses this month. The ones who move first are the ones who get cited. Reply with \u201cscore\u201d and I\u2019ll personally walk you through the findings.`;

  const findingItems = [f1, f2, f3].filter(Boolean).map(f => {
    const [action, impact] = f.split(' \u2014 ');
    return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f3f3;vertical-align:top">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
          background:#dc2626;margin-right:10px;vertical-align:middle;flex-shrink:0"></span>
        <strong style="color:#111;font-size:14px">${action || f}</strong>
        ${impact ? `<div style="margin-top:4px;padding-left:18px;font-size:13px;color:#666;line-height:1.5">${impact}</div>` : ''}
      </td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%">

  <!-- Header -->
  <tr>
    <td style="background:#0f0f1a;border-radius:10px 10px 0 0;padding:20px 32px">
      <span style="font-size:17px;font-weight:800;color:#fff">ADMEXO</span>
      <span style="font-size:10px;color:#6366f1;margin-left:8px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600">AI Visibility</span>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:32px">

      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.7">
        Hi <strong>${firstName}</strong>,
      </p>

      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.7">
        Quick question &mdash; when someone opens ChatGPT or Perplexity and types
        <em style="color:#111">&ldquo;${service} in ${city}&rdquo;</em>,
        does <strong>${businessName}</strong> come up?
      </p>

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.7">
        I ran your site through our AI Visibility audit. Here&rsquo;s what came back:
      </p>

      <!-- Score alert box -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#fff8f8;border:2px solid #fecaca;border-radius:10px;margin-bottom:24px">
        <tr>
          <td style="padding:20px 24px">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#dc2626;font-weight:700;margin-bottom:8px">
              AI Visibility Score &mdash; ${businessName}
            </div>
            <div style="font-size:42px;font-weight:900;color:#dc2626;line-height:1">
              ${score}<span style="font-size:20px;color:#f87171">/100</span>
            </div>
            <p style="margin:12px 0 0;font-size:14px;color:#7f1d1d;line-height:1.6">
              That means <strong>${lossPhrase}</strong>.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7">
        ${urgency}
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7">
        AI search now accounts for <strong>30&ndash;40% of all discovery traffic</strong>
        for local and professional services in the US. That number will cross
        <strong>50% within 12 months.</strong> Unlike Google, there&rsquo;s no rank
        tracker for AI &mdash; most business owners don&rsquo;t even know they&rsquo;re
        invisible until a competitor has already locked in that position.
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

      <!-- Findings -->
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;
        letter-spacing:.6px;color:#dc2626">
        Why ${businessName} is being skipped right now:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;overflow:hidden">
        <tbody>${findingItems}</tbody>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.7">
        Each of these is an open door sending your potential clients straight to whoever
        fixed it first.
      </p>

      <!-- CTA 1 -->
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111">Here&rsquo;s what to do about it:</p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
        <tr>
          <td style="background:#661fff;border-radius:8px">
            <a href="${REPORT_LINK}"
               style="display:inline-block;padding:13px 26px;color:#fff;
                      font-size:15px;font-weight:700;text-decoration:none">
              View ${businessName}&rsquo;s Full AI Visibility Report &rarr;
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:-20px 0 24px;font-size:12px;color:#999">Free &middot; No login &middot; Full breakdown of every issue and the exact fix for each one</p>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

      <!-- What we do -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#0f0f1a;border-radius:8px;margin-bottom:24px">
        <tr>
          <td style="padding:20px 24px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;
              color:#6366f1;font-weight:700;margin-bottom:8px">What We Do</div>
            <p style="margin:0;font-size:14px;color:#ccc;line-height:1.7">
              We close those doors. We handle structured data, llms.txt, citation building,
              schema implementation, and ongoing tracking across
              <strong style="color:#fff">ChatGPT, Gemini, Claude, Perplexity and Bing</strong>
              &mdash; so when someone in ${city} asks for a ${service},
              <strong style="color:#fff">${businessName}</strong> is the name they get.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.7">
        If you want to move on this before a competitor does,
        I have a few slots open this week.
      </p>

      <!-- CTA 2 -->
      <table cellpadding="0" cellspacing="0" style="margin-bottom:32px">
        <tr>
          <td style="background:#0f0f1a;border-radius:8px;border:1px solid #333">
            <a href="https://calendly.com/admexoofficial/30min"
               style="display:inline-block;padding:13px 26px;color:#fff;
                      font-size:15px;font-weight:700;text-decoration:none">
              Book a Free 15-min Strategy Call &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Signature -->
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-left:3px solid #6366f1;padding-left:12px">
            <div style="font-size:15px;font-weight:700;color:#111">${YOUR_NAME}</div>
            <div style="font-size:13px;color:#888;margin-top:2px">${YOUR_TITLE} &middot; ${YOUR_CO}</div>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- PS -->
  <tr>
    <td style="background:#f9f9fb;border:1px solid #eee;border-top:none;
      border-radius:0 0 10px 10px;padding:18px 32px">
      <p style="margin:0;font-size:13px;color:#555;line-height:1.6">
        <strong>P.S.</strong> We&rsquo;re onboarding a limited number of
        <strong>${industry}</strong> businesses this month. The ones who move first
        are the ones who get cited. Reply with <em>&ldquo;score&rdquo;</em> and
        I&rsquo;ll personally walk you through the findings.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

// ── 5 A/B Variants ────────────────────────────────────────────────────────────

// V1 — Silent Leak  |  Sender: AI Audit Lab
function buildV1({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `${businessName} is leaking ${missed} AI leads a month (we traced it)`;
  const text = `Hi ${firstName},\n\nWe ran an AI visibility trace on your site. Every time someone asks ChatGPT or Perplexity for "${service} in ${city}", ${missed} out of 100 are being sent somewhere else.\n\nHere's exactly where the leak is:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull trace report (free): ${REPORT_LINK}\n\nWe fix this. Full structured data, llms.txt, citation building, schema — across ChatGPT, Gemini, Claude and Perplexity.\n\nIf you want the leak sealed before a competitor does it first:\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#dc2626;margin-bottom:4px">AI Audit Lab</p>
  <hr style="border:none;border-top:2px solid #dc2626;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>We ran an AI visibility trace on your site. Every time someone asks ChatGPT or Perplexity for <em>"${service} in ${city}"</em>, <strong style="color:#dc2626">${missed} out of 100</strong> are being sent somewhere else.</p>
  <p><strong>Here's exactly where the leak is:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">View Full Trace Report &rarr;</a></p>
  <p>We fix this. Full structured data, llms.txt, citation building, schema — across ChatGPT, Gemini, Claude and Perplexity.</p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'AI Audit Lab' };
}

// V2 — Competitor  |  Sender: GEO Watch
function buildV2({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `A competitor just claimed your AI search spot in ${city}`;
  const text = `Hi ${firstName},\n\nAI search doesn't show a list — it picks one answer. Right now for "${service} in ${city}", that answer isn't ${businessName}.\n\nYour GEO score: ${score}/100. That ${missed}-point gap is being filled by whoever moves first.\n\nWhat's giving them the edge:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nSee the full competitive breakdown: ${REPORT_LINK}\n\nWe track AI search positioning daily and fix the gaps. ChatGPT, Gemini, Claude, Perplexity — all covered.\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7c3aed;margin-bottom:4px">GEO Watch</p>
  <hr style="border:none;border-top:2px solid #7c3aed;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>AI search doesn't show a list &mdash; it picks <strong>one answer</strong>. Right now for <em>"${service} in ${city}"</em>, that answer isn't <strong>${businessName}</strong>.</p>
  <p>Your GEO score: <strong style="font-size:20px;color:#7c3aed">${score}/100</strong>. That ${missed}-point gap is being filled by whoever moves first.</p>
  <p><strong>What's giving competitors the edge right now:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">See Full Competitive Breakdown &rarr;</a></p>
  <p>We track AI search positioning daily and fix the gaps. ChatGPT, Gemini, Claude, Perplexity &mdash; all covered.</p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'GEO Watch' };
}

// V3 — Cost  |  Sender: Search Intelligence
function buildV3({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `${score}/100 — here's what that score costs ${businessName} per month`;
  const text = `Hi ${firstName},\n\nYour AI Visibility Score is ${score}/100.\n\nIn real terms: ${missed}% of people who search for "${service} in ${city}" on AI are landing on a competitor's site instead of yours. Every month. Quietly.\n\nIf you close even 2 of those leads — at average case value — that's revenue walking out the door and compounding.\n\nWhat's causing it:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull cost breakdown + exact fixes: ${REPORT_LINK}\n\nWe handle the entire fix — structured data, citations, AI-specific content, ongoing tracking.\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0369a1;margin-bottom:4px">Search Intelligence</p>
  <hr style="border:none;border-top:2px solid #0369a1;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>Your AI Visibility Score is <strong style="font-size:20px;color:#0369a1">${score}/100</strong>.</p>
  <p>In real terms: <strong>${missed}%</strong> of people who search for <em>"${service} in ${city}"</em> on AI are landing on a competitor's site instead of yours. Every month. Quietly.</p>
  <p style="background:#eff6ff;border-left:4px solid #0369a1;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px">If you close even 2 of those leads — at average case value — that's revenue walking out the door and compounding every single month.</p>
  <p><strong>What's causing it:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#0369a1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">See Full Cost Breakdown + Fixes &rarr;</a></p>
  <p>We handle the entire fix — structured data, citations, AI-specific content, ongoing tracking.</p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'Search Intelligence' };
}

// V4 — Timeline  |  Sender: AI Visibility Report
function buildV4({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `By 2027, most of your new clients will find you through AI. Here's where ${businessName} stands.`;
  const text = `Hi ${firstName},\n\nAI search currently drives ~35% of discovery for ${industry} businesses in the US. Analysts project 60%+ by end of 2027.\n\nWe ran ${businessName} through our AI Visibility audit today. Score: ${score}/100.\n\nThe businesses fixing this in 2025 will own those results in 2027. The ones waiting will spend that time paying to catch up — if they can at all.\n\nHere's what needs fixing right now:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull report: ${REPORT_LINK}\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;margin-bottom:4px">AI Visibility Report</p>
  <hr style="border:none;border-top:2px solid #059669;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>AI search currently drives <strong>~35%</strong> of discovery for ${industry} businesses in the US. Analysts project <strong>60%+</strong> by end of 2027.</p>
  <p>We ran <strong>${businessName}</strong> through our AI Visibility audit today. Score: <strong style="font-size:20px;color:#059669">${score}/100</strong>.</p>
  <p style="background:#f0fdf4;border-left:4px solid #059669;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#14532d">The businesses fixing this in 2025 will own those results in 2027. The ones waiting will spend that time paying to catch up — if they can at all.</p>
  <p><strong>Here's what needs fixing right now:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">View ${businessName}'s AI Visibility Report &rarr;</a></p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'AI Visibility Report' };
}

// V5 — Personal Find  |  Sender: Ritabrata from ADMEXO
function buildV5({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `I ran a free AI audit on your site this morning — here's what came back`;
  const text = `Hi ${firstName},\n\nI ran a quick AI visibility audit on your site this morning. Wanted to share what I found before I move on to the next firm on my list.\n\nScore: ${score}/100. That means ChatGPT, Perplexity, and Gemini are routing roughly ${missed}% of "${service} ${city}" searches away from you right now.\n\nThree specific reasons why:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull report here — no form, no login:\n${REPORT_LINK}\n\nWorth 5 minutes if you care about where your next client comes from.\n\nIf it's useful and you want to talk through a fix, I have a few slots open this week:\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}\n${YOUR_TITLE}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:580px;margin:0 auto;padding:32px 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>I ran a quick AI visibility audit on your site this morning. Wanted to share what I found before I move on to the next firm on my list.</p>
  <p>Score: <strong style="font-size:18px;color:#661fff">${score}/100</strong>. That means ChatGPT, Perplexity, and Gemini are routing roughly <strong>${missed}%</strong> of <em>"${service} ${city}"</em> searches away from you right now.</p>
  <p><strong>Three specific reasons why:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#661fff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Full Report — No Form, No Login &rarr;</a></p>
  <p style="font-size:14px;color:#555">Worth 5 minutes if you care about where your next client comes from.</p>
  <p>If it's useful and you want to talk through a fix, I have a few slots open this week:<br>
  <a href="https://calendly.com/admexoofficial/30min" style="color:#661fff">calendly.com/admexoofficial/30min</a></p>
  <p style="margin-top:28px">${YOUR_NAME}<br><span style="color:#888;font-size:13px">${YOUR_TITLE}, ${YOUR_CO}</span></p>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:16px;margin-top:24px">P.S. I only audit a handful of ${industry} businesses at a time — reply with "score" and I'll send the full fix list.</p>
</div></body></html>`;
  return { subject, html, text, senderName: `${YOUR_NAME} from ADMEXO` };
}

// ── Version B: original structure, subtle score context only ────────────────
function buildEmailB({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const f1 = findings[0] || 'No llms.txt file found — AI crawlers like ChatGPT and Claude cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity and Google AI Overviews cannot extract your answers';
  const f3 = findings[2] || null;

  const missed      = 100 - score;
  const futureWorse = Math.min(missed + 15, 90);

  const subject = `AI search is sending your customers to competitors \u2014 here\u2019s proof`;

  const text = `Hi ${firstName},

Quick question \u2014 when someone asks ChatGPT or Perplexity for "${service} in ${city}", does ${businessName} come up?

I checked. Right now your GEO score is ${score}/100.

Here\u2019s what that number means today: roughly ${missed} out of every 100 people who search for "${service} in ${city}" on AI are being sent to a competitor instead of you.

And it gets worse \u2014 if nothing changes, that number climbs. AI platforms reinforce whoever is already visible. Within the next few months, that gap could widen to ${futureWorse}% or more \u2014 at which point recovering that ground becomes significantly harder.

Here\u2019s what\u2019s causing it right now:
${[f1,f2,f3].filter(Boolean).map(f=>`\u2192 ${f}`).join('\n')}

Full report (free, no login): View ${businessName}\u2019s AI Visibility Report \u2192 ${REPORT_LINK}

AI search is now driving 30\u201340% of discovery for local and professional services in the US and UK. Unlike Google, where you can track rankings, most business owners don\u2019t even know they\u2019re invisible on AI until a competitor locks in that visibility first.

What we do:
We fix this. We optimize your business presence across ChatGPT, Gemini, Claude, Perplexity, and emerging AI assistants \u2014 so when someone asks for what you do, you\u2019re the answer they get.

This email is the 1% \u2014 the free score. The full service covers structured data fixes, citation building, AI-specific content strategy, and ongoing tracking across all major models.

If ${businessName} wants to own that AI real estate before a competitor does, let\u2019s talk this week.

Book a 15-min call \u2192 https://calendly.com/admexoofficial/30min

${YOUR_NAME}
${YOUR_TITLE}, ${YOUR_CO}

P.S. We\u2019re onboarding a limited number of ${industry} clients this month \u2014 reply with "score" and I\u2019ll send over a detailed fix list specific to your business.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#222222;max-width:600px;margin:0 auto;padding:32px 24px">

  <p>Hi <strong>${firstName}</strong>,</p>

  <p>Quick question &mdash; when someone asks ChatGPT or Perplexity for
  <em>&ldquo;${service} in ${city}&rdquo;</em>, does <strong>${businessName}</strong> come up?</p>

  <p>I checked. Right now your GEO score is <strong style="font-size:18px;color:#661fff">${score}/100</strong>.</p>

  <p>Here&rsquo;s what that number means <strong>today</strong>: roughly
  <strong>${missed} out of every 100 people</strong> who search for
  &ldquo;${service} in ${city}&rdquo; on AI are being sent to a competitor instead of you.</p>

  <p style="background:#fff8f0;border-left:4px solid #f97316;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#7c2d12">
    And it gets worse &mdash; if nothing changes, that number climbs. AI platforms reinforce
    whoever is already visible. Within the next few months, that gap could widen to
    <strong>${futureWorse}%</strong> or more. At that point, recovering that ground
    becomes significantly harder.
  </p>

  <p style="margin-top:16px">Here&rsquo;s what&rsquo;s causing it right now:</p>
  <ul style="padding-left:20px;margin:0 0 16px">
    <li style="margin-bottom:8px">${f1}</li>
    <li style="margin-bottom:8px">${f2}</li>
    ${f3 ? `<li style="margin-bottom:8px">${f3}</li>` : ''}
  </ul>

  <p>
    <a href="${REPORT_LINK}"
       style="display:inline-block;background:#661fff;color:#ffffff;padding:12px 24px;
              border-radius:6px;text-decoration:none;font-weight:bold">
      View ${businessName}&rsquo;s AI Visibility Report &rarr;
    </a>
  </p>

  <p>AI search is now driving 30&ndash;40% of discovery for local and professional services
  in the US and UK. Unlike Google, where you can track rankings, most business owners
  don&rsquo;t even know they&rsquo;re invisible on AI until a competitor locks in that
  visibility first.</p>

  <p><strong>What we do:</strong><br>
  We fix this. We optimize your business presence across ChatGPT, Gemini, Claude,
  Perplexity, and emerging AI assistants &mdash; so when someone asks for what you do,
  you&rsquo;re the answer they get.</p>

  <p>This email is the 1% &mdash; the free score. The full service covers structured data
  fixes, citation building, AI-specific content strategy, and ongoing tracking across all
  major models.</p>

  <p>If <strong>${businessName}</strong> wants to own that AI real estate before a competitor
  does, let&rsquo;s talk this week.</p>

  <p>
    <a href="https://calendly.com/admexoofficial/30min"
       style="display:inline-block;background:#1a1033;color:#ffffff;padding:12px 24px;
              border-radius:6px;text-decoration:none;font-weight:bold">
      Book a 15-min call &rarr;
    </a>
  </p>

  <p style="margin-top:32px">${YOUR_NAME}<br>
  <span style="color:#666">${YOUR_TITLE}, ${YOUR_CO}</span></p>

  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
    P.S. We&rsquo;re onboarding a limited number of <strong>${industry}</strong> clients this
    month &mdash; reply with &ldquo;score&rdquo; and I&rsquo;ll send over a detailed fix list
    specific to your business.
  </p>
</div>
</body>
</html>`;

  return { subject, html, text };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read Excel
  console.log('Reading Excel...');
  const wb   = XLSX.readFile(EXCEL_PATH);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  // Pick first row that has an email and a website
  const row = rows.find(r => r.emails && r.website_clean);
  if (!row) { console.error('No suitable row found.'); process.exit(1); }

  const businessName = String(row.title  || 'Your Business');
  const firstName    = businessName;
  const category     = String(row.category || row.categories || '');
  const city         = parseCity(String(row.address || ''));
  const service      = inferService(category);
  const industry     = inferIndustry(category);
  const score        = Math.round(Number(row.geo) || 0);
  const website      = String(row.website_clean);
  const reportUrl    = String(row.report_url || 'https://leadengine.admexo.com');

  console.log(`Row: ${businessName} | ${website} | score=${score} | city=${city}`);

  // 2. Get 3 GEO findings from the local audit API
  console.log('Fetching GEO findings...');
  const findings = await getGeoFindings(website);
  console.log('Findings:', findings);

  const params = { businessName, firstName, service, city, score, findings, industry, reportUrl };

  // 3. Build all 5 variants
  const variants = [
    { key: 'v1', build: buildV1 },
    { key: 'v2', build: buildV2 },
    { key: 'v3', build: buildV3 },
    { key: 'v4', build: buildV4 },
    { key: 'v5', build: buildV5 },
  ].map(({ key, build }) => ({ key, ...build(params) }));

  // ── Tracking ───────────────────────────────────────────────────────────────
  const TRACKER = process.env.TRACKER_URL || 'https://tracker-ye72.onrender.com';
  const slug    = slugify(businessName);

  function injectTracking(v, trackId) {
    const pixel = `<img src="${TRACKER}/t/open/${trackId}" width="1" height="1" style="display:none" alt="">`;
    const trackedHtml = v.html
      .replace('</body>', `${pixel}\n</body>`)
      .replace(/href="(https:\/\/admexo-reports\.netlify\.app[^"]+)"/g,
        (_, url) => `href="${TRACKER}/t/click/${trackId}?url=${encodeURIComponent(url)}"`);
    return { ...v, html: trackedHtml };
  }

  const ses = new SESClient({
    region: 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });

  for (const v of variants) {
    const trackId = `${slug}-${v.key}`;
    const tracked = injectTracking(v, trackId);
    const from    = `${v.senderName} <promotions@admexo.com>`;
    console.log(`\n[${v.key}] Subject : ${v.subject}`);
    console.log(`[${v.key}] From    : ${from}`);
    const r = await ses.send(new SendEmailCommand({
      Source:      from,
      Destination: { ToAddresses: [TEST_TO] },
      Message: {
        Subject: { Data: tracked.subject },
        Body:    { Html: { Data: tracked.html }, Text: { Data: tracked.text } },
      },
    }));
    console.log(`[${v.key}] Sent!   MessageId:`, r.MessageId);
  }

  console.log(`\nAll 5 sent. Stats: ${TRACKER}/stats`);
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  if (err.name) console.error('Code:', err.name);
  process.exit(1);
});
