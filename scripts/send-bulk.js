'use strict';
require('dotenv').config();
const XLSX     = require('xlsx');
const axios    = require('axios');
const path     = require('path');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// ── Config ────────────────────────────────────────────────────────────────────
const EXCEL_FILE  = path.join('C:/Users/ADMEXO/Downloads/leads generation', 'Leads_READY_final.xlsx');
const TRACKER     = process.env.TRACKER_URL || 'https://tracker-ye72.onrender.com';
const GEO_API     = 'http://localhost:3001/api/audit';
const FROM_DOMAIN = 'promotions@admexo.com';
const YOUR_NAME   = 'Ritabrata Ray';
const YOUR_TITLE  = 'Founder';
const YOUR_CO     = 'ADMEXO';
const DELAY_MS    = 1200; // 1.2s between sends — ~50/min, well under SES limits

// ── Helpers ───────────────────────────────────────────────────────────────────
const slugify = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
const sleep   = ms => new Promise(r => setTimeout(r, ms));

function parseCity(address) {
  if (!address) return 'your city';
  const parts = address.split(',').map(s => s.trim());
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p && !/\d{5}/.test(p) && !/United States/i.test(p) && p.length > 2) {
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
    const res = await axios.post(GEO_API, { url }, { timeout: 15000 });
    const data = res.data;
    const findings = [];
    for (const level of ['p0', 'p1', 'p2']) {
      for (const item of (data.improvements?.[level] || [])) {
        if (findings.length >= 3) break;
        findings.push(`${item.action} — ${item.impact}`);
      }
      if (findings.length >= 3) break;
    }
    if (findings.length < 3) {
      for (const issue of (data.issues || [])) {
        if (findings.length >= 3) break;
        findings.push(`${issue.title} — ${issue.desc.split('.')[0]}`);
      }
    }
    return findings.slice(0, 3);
  } catch {
    return [];
  }
}

function getFirstEmail(raw) {
  if (!raw) return null;
  const emails = String(raw).split(/[,;\s]+/).map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return emails[0] || null;
}

// ── Email Builders ────────────────────────────────────────────────────────────
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

function buildV2({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `A competitor just claimed your AI search spot in ${city}`;
  const text = `Hi ${firstName},\n\nAI search doesn't show a list — it picks one answer. Right now for "${service} in ${city}", that answer isn't ${businessName}.\n\nYour GEO score: ${score}/100. That ${missed}-point gap is being filled by whoever moves first.\n\nWhat's giving them the edge:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nSee the full competitive breakdown: ${REPORT_LINK}\n\nWe track AI search positioning daily and fix the gaps.\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
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

function buildV3({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `${score}/100 — here's what that score costs ${businessName} per month`;
  const text = `Hi ${firstName},\n\nYour AI Visibility Score is ${score}/100.\n\nIn real terms: ${missed}% of people who search for "${service} in ${city}" on AI are landing on a competitor's site instead of yours. Every month. Quietly.\n\nIf you close even 2 of those leads — at average case value — that's revenue walking out the door.\n\nWhat's causing it:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull cost breakdown + exact fixes: ${REPORT_LINK}\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0369a1;margin-bottom:4px">Search Intelligence</p>
  <hr style="border:none;border-top:2px solid #0369a1;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>Your AI Visibility Score is <strong style="font-size:20px;color:#0369a1">${score}/100</strong>.</p>
  <p>In real terms: <strong>${missed}%</strong> of people who search for <em>"${service} in ${city}"</em> on AI are landing on a competitor's site instead of yours. Every month. Quietly.</p>
  <p style="background:#eff6ff;border-left:4px solid #0369a1;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px">If you close even 2 of those leads — at average case value — that's revenue walking out the door every single month.</p>
  <p><strong>What's causing it:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#0369a1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">See Full Cost Breakdown + Fixes &rarr;</a></p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'Search Intelligence' };
}

function buildV4({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `By 2027, most of your new clients will find you through AI. Here's where ${businessName} stands.`;
  const text = `Hi ${firstName},\n\nAI search currently drives ~35% of discovery for ${industry} businesses in the US. Analysts project 60%+ by end of 2027.\n\nWe ran ${businessName} today. Score: ${score}/100.\n\nThe businesses fixing this in 2025 will own those results in 2027.\n\nHere's what needs fixing:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull report: ${REPORT_LINK}\n\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e293b;max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#059669;margin-bottom:4px">AI Visibility Report</p>
  <hr style="border:none;border-top:2px solid #059669;margin:0 0 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>AI search currently drives <strong>~35%</strong> of discovery for ${industry} businesses in the US. Analysts project <strong>60%+</strong> by end of 2027.</p>
  <p>We ran <strong>${businessName}</strong> today. Score: <strong style="font-size:20px;color:#059669">${score}/100</strong>.</p>
  <p style="background:#f0fdf4;border-left:4px solid #059669;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#14532d">The businesses fixing this in 2025 will own those results in 2027. The ones waiting will spend that time paying to catch up.</p>
  <p><strong>Here's what needs fixing right now:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">View ${businessName}'s AI Visibility Report &rarr;</a></p>
  <p><a href="https://calendly.com/admexoofficial/30min" style="display:inline-block;background:#0f0f1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Book a 15-min call &rarr;</a></p>
  <p style="margin-top:28px;font-size:13px;color:#64748b">${YOUR_NAME} · ${YOUR_CO}</p>
</div></body></html>`;
  return { subject, html, text, senderName: 'AI Visibility Report' };
}

function buildV5({ businessName, firstName, service, city, score, findings, industry, reportUrl }) {
  const REPORT_LINK = reportUrl || 'https://leadengine.admexo.com';
  const missed = 100 - score;
  const f1 = findings[0] || 'No llms.txt — AI crawlers cannot prioritize your site';
  const f2 = findings[1] || 'No FAQPage schema — Perplexity skips your content entirely';
  const f3 = findings[2] || null;
  const findingItems = [f1,f2,f3].filter(Boolean).map(f=>`<li style="margin-bottom:8px">${f}</li>`).join('');
  const subject = `I ran a free AI audit on your site this morning — here's what came back`;
  const text = `Hi ${firstName},\n\nI ran a quick AI visibility audit on your site this morning. Wanted to share what I found before I move on to the next firm on my list.\n\nScore: ${score}/100. ChatGPT, Perplexity, and Gemini are routing ~${missed}% of "${service} ${city}" searches away from you.\n\nThree specific reasons why:\n${[f1,f2,f3].filter(Boolean).map(f=>`→ ${f}`).join('\n')}\n\nFull report — no form, no login:\n${REPORT_LINK}\n\nI have a few slots open this week if you want to talk through a fix:\nhttps://calendly.com/admexoofficial/30min\n\n— ${YOUR_NAME}\n${YOUR_TITLE}, ${YOUR_CO}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:580px;margin:0 auto;padding:32px 24px">
  <p>Hi <strong>${firstName}</strong>,</p>
  <p>I ran a quick AI visibility audit on your site this morning. Wanted to share what I found before I move on to the next firm on my list.</p>
  <p>Score: <strong style="font-size:18px;color:#661fff">${score}/100</strong>. That means ChatGPT, Perplexity, and Gemini are routing roughly <strong>${missed}%</strong> of <em>"${service} ${city}"</em> searches away from you.</p>
  <p><strong>Three specific reasons why:</strong></p>
  <ul style="padding-left:20px;margin:0 0 20px">${findingItems}</ul>
  <p><a href="${REPORT_LINK}" style="display:inline-block;background:#661fff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Full Report — No Form, No Login &rarr;</a></p>
  <p>I have a few slots open this week if you want to talk through a fix:<br>
  <a href="https://calendly.com/admexoofficial/30min" style="color:#661fff">calendly.com/admexoofficial/30min</a></p>
  <p style="margin-top:28px">${YOUR_NAME}<br><span style="color:#888;font-size:13px">${YOUR_TITLE}, ${YOUR_CO}</span></p>
  <p style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:16px;margin-top:24px">P.S. I only audit a handful of ${industry} businesses at a time — reply with "score" and I'll send the full fix list.</p>
</div></body></html>`;
  return { subject, html, text, senderName: `${YOUR_NAME} from ADMEXO` };
}

const BUILDERS = [buildV1, buildV2, buildV3, buildV4, buildV5];

function injectTracking(v, trackId) {
  const pixel = `<img src="${TRACKER}/t/open/${trackId}" width="1" height="1" style="display:none" alt="">`;
  const html  = v.html
    .replace('</body>', `${pixel}\n</body>`)
    .replace(/href="(https:\/\/admexo-reports\.netlify\.app[^"]+)"/g,
      (_, url) => `href="${TRACKER}/t/click/${trackId}?url=${encodeURIComponent(url)}"`);
  return { ...v, html };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const wb   = XLSX.readFile(EXCEL_FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const ses = new SESClient({
    region: 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });

  let sent = 0, skipped = 0, failed = 0;
  console.log(`\nStarting bulk send — ${rows.length} leads, ~${Math.round(rows.length * DELAY_MS / 60000)} min\n`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const email = getFirstEmail(row.emails);
    if (!email) { console.log(`[${i+1}] SKIP — no email: ${row.title}`); skipped++; continue; }

    const businessName = String(row.title || '').trim();
    const firstName    = businessName.split(' ')[0];
    const category     = String(row.category || row.categories || '');
    const service      = inferService(category);
    const industry     = inferIndustry(category);
    const city         = parseCity(String(row.address || ''));
    const score        = Number(row.geo) || 50;
    const reportUrl    = String(row.report_url || 'https://leadengine.admexo.com');
    const website      = String(row.website_clean || row.website || '');

    // Fetch GEO findings (skipped if API down — uses fallback text in builder)
    const findings = await getGeoFindings(website);

    // Round-robin variant assignment
    const vIdx    = i % 5;
    const vKey    = `v${vIdx + 1}`;
    const builder = BUILDERS[vIdx];
    const params  = { businessName, firstName, service, city, score, findings, industry, reportUrl };
    const built   = builder(params);
    const trackId = `${slugify(businessName)}-${vKey}`;
    const tracked = injectTracking(built, trackId);
    const from    = `${built.senderName} <${FROM_DOMAIN}>`;

    try {
      const r = await ses.send(new SendEmailCommand({
        Source:      from,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: tracked.subject },
          Body:    { Html: { Data: tracked.html }, Text: { Data: tracked.text } },
        },
      }));
      console.log(`[${i+1}/${rows.length}] ✓ ${vKey} → ${email} — ${businessName}`);
      sent++;
    } catch (err) {
      console.log(`[${i+1}/${rows.length}] ✗ FAILED — ${email} — ${err.message}`);
      failed++;
    }

    if (i < rows.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Sent:    ${sent}`);
  console.log(`  Skipped: ${skipped} (no email)`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Stats:   ${TRACKER}/stats`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
