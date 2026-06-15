'use strict';
// Shared email utilities for AI Lead Engine.
// Underscore-prefixed so Vercel does NOT treat this as an API route.

const BRAND = {
  name: 'AI Lead Engine',
  purple: '#661fff',
  purpleDark: '#4c1fb3',
  ink: '#1a1033',
  site: 'https://leadengine.admexo.com',
  calendly: 'https://calendly.com/admexoofficial/30min?month=2026-06',
};

function getSESClient() {
  const { SESClient } = require('@aws-sdk/client-ses');
  return new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Builds the branded welcome email. Returns { subject, html, text }.
function buildWelcomeEmail({ firstName, email, password, loginUrl, tierLabel, bumps } = {}) {
  const name = firstName || 'there';
  const login = loginUrl || `${BRAND.site}/access`;
  const bumpList = Array.isArray(bumps) ? bumps.filter(Boolean) : [];
  const unlocked = tierLabel
    ? `the <strong>${esc(tierLabel)} Plan</strong>${bumpList.length ? ' + ' + bumpList.map(esc).join(' + ') : ''}`
    : 'your full system';

  const subject = `Welcome to ${BRAND.name}, ${name} — Your Access Is Ready`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f0fb;font-family:Arial,Helvetica,sans-serif;color:#1a1033">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0fb;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;max-width:600px;box-shadow:0 8px 30px rgba(76,31,179,.10)">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,${BRAND.purpleDark} 0%,${BRAND.purple} 100%);padding:34px 40px;text-align:center">
    <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85">AI &amp; Performance Marketing</div>
    <h1 style="color:#ffffff;margin:6px 0 0;font-size:26px;font-weight:800;letter-spacing:-.02em">Welcome to ${BRAND.name}</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:34px 40px 8px">
    <p style="font-size:16px;margin:0 0 16px">Hey ${esc(name)},</p>
    <p style="font-size:15px;line-height:1.7;color:#3b3357;margin:0 0 16px">Welcome aboard — and congratulations on making one of the smartest decisions for your business this year.</p>
    <p style="font-size:15px;line-height:1.7;color:#3b3357;margin:0 0 16px">Most people keep struggling with inconsistent leads, chasing clients, and wasting money on agencies that overpromise and underdeliver. You just chose a different path.</p>
    <p style="font-size:15px;line-height:1.7;color:#3b3357;margin:0 0 8px">The <strong>21 Leads in 21 Days AI Engine</strong> puts the entire system in your hands — Meta Ads, Google Ads, Native Ads, SEO, AI Funnels, and Automation — so you can start generating qualified leads on autopilot, starting today.</p>
    <p style="font-size:14px;color:#6b6385;margin:8px 0 0">You've unlocked ${unlocked}.</p>
  </td></tr>

  <!-- Credentials -->
  <tr><td style="padding:16px 40px 8px">
    <div style="background:#f6f3ff;border-left:4px solid ${BRAND.purple};border-radius:0 10px 10px 0;padding:20px 22px">
      <p style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.purple};margin:0 0 12px">Your Login Credentials</p>
      <p style="margin:6px 0;font-size:14px;color:#3b3357"><strong>Login URL:</strong> <a href="${login}" style="color:${BRAND.purple};text-decoration:none">${login}</a></p>
      <p style="margin:6px 0;font-size:14px;color:#3b3357"><strong>Email:</strong> ${esc(email)}</p>
      <p style="margin:6px 0;font-size:14px;color:#3b3357"><strong>Password:</strong> <span style="font-family:monospace;background:#ece5ff;padding:3px 9px;border-radius:5px;font-size:14px">${esc(password)}</span></p>
    </div>
  </td></tr>

  <!-- Steps -->
  <tr><td style="padding:14px 40px 8px">
    <p style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1a1033;margin:0 0 10px">Getting Started</p>
    <table cellpadding="0" cellspacing="0" width="100%">
      ${[
        'Click the link above to open the access page.',
        'Submit your details (same as used on checkout) and log in to your account.',
        'You\u2019ll be redirected to the dashboard, where you can access all the material.',
      ].map((s, i) => `<tr>
        <td valign="top" style="width:30px;padding:5px 0"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:${BRAND.purple};color:#fff;border-radius:50%;font-size:12px;font-weight:700">${i + 1}</span></td>
        <td style="padding:5px 0;font-size:14px;line-height:1.6;color:#3b3357">${s}</td>
      </tr>`).join('')}
    </table>
  </td></tr>

  <!-- CTA button -->
  <tr><td style="padding:18px 40px 6px" align="center">
    <a href="${login}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.purpleDark},${BRAND.purple});color:#ffffff;font-weight:800;font-size:16px;padding:15px 42px;border-radius:9px;text-decoration:none">Access Your Dashboard &rarr;</a>
  </td></tr>
  <tr><td style="padding:0 40px 18px" align="center">
    <p style="color:#9a92b5;font-size:12px;margin:8px 0 0">Save this email — you'll need it to log back in.</p>
  </td></tr>

  <!-- Strategy call -->
  <tr><td style="padding:6px 40px 30px">
    <div style="border:1px solid #e6def9;border-radius:12px;padding:24px;background:#faf8ff">
      <p style="font-size:16px;font-weight:800;color:#1a1033;margin:0 0 8px">Want Us To Build This Personally?</p>
      <p style="font-size:14px;line-height:1.7;color:#3b3357;margin:0 0 12px">I'm opening a small number of <strong>free 1:1 strategy calls</strong> this week. On this call we'll map out your exact:</p>
      <table cellpadding="0" cellspacing="0">
        ${['Lead generation funnel', 'Meta Ads strategy', '90-day action plan'].map(b => `<tr><td style="padding:3px 0;font-size:14px;color:#3b3357">&#10003;&nbsp; ${b}</td></tr>`).join('')}
      </table>
      <p style="font-size:14px;line-height:1.7;color:#3b3357;margin:12px 0 16px">— all tailored specifically to your business and niche. Only a few spots are available. Once they're gone, they're gone.</p>
      <a href="${BRAND.calendly}" style="display:inline-block;background:#ffffff;border:2px solid ${BRAND.purple};color:${BRAND.purple};font-weight:800;font-size:14px;padding:11px 26px;border-radius:8px;text-decoration:none">Book Your Free Call &rarr;</a>
    </div>
    <p style="font-size:15px;line-height:1.7;color:#3b3357;margin:22px 0 0">Let's make this your best month yet.</p>
    <p style="font-size:15px;line-height:1.7;color:#3b3357;margin:14px 0 0">To your success,<br><strong>Team ADMEXO</strong><br><span style="color:#9a92b5;font-size:13px">AI &amp; Performance Marketing Experts</span></p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f6f3ff;padding:18px 40px;text-align:center">
    <p style="color:#9a92b5;font-size:12px;margin:0">${BRAND.name} · <a href="${BRAND.site}" style="color:${BRAND.purple};text-decoration:none">leadengine.admexo.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Hey ${name},

Welcome aboard — and congratulations on making one of the smartest decisions for your business this year.

The 21 Leads in 21 Days AI Engine puts the entire system in your hands — Meta Ads, Google Ads, Native Ads, SEO, AI Funnels, and Automation.

YOUR LOGIN CREDENTIALS
Login URL: ${login}
Email: ${email}
Password: ${password}

Steps:
1. Click the link and open the access page.
2. Submit your details (same as used on checkout) and log in.
3. You'll be redirected to the dashboard with all the material.

WANT US TO BUILD THIS PERSONALLY?
Book a free 1:1 strategy call: ${BRAND.calendly}

To your success,
Team ADMEXO
AI & Performance Marketing Experts
${BRAND.site}`;

  return { subject, html, text };
}

async function sendEmail({ to, subject, html, text }) {
  const { SendEmailCommand } = require('@aws-sdk/client-ses');
  const ses = getSESClient();
  return ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
    Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: text } },
    },
  }));
}

module.exports = { BRAND, buildWelcomeEmail, sendEmail, getSESClient };
