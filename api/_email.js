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
  const subject = `Welcome to ${BRAND.name}, ${name} — Your Access Is Ready`;

  const text = `Hey ${name},

Welcome aboard — and congratulations on making one of the smartest decisions for your business this year.

Most people keep struggling with inconsistent leads, chasing clients, and wasting money on agencies that overpromise and underdeliver. You just chose a different path.

The 21 Leads in 21 Days AI Engine puts the entire system in your hands — Meta Ads, Google Ads, Native Ads, SEO, AI Funnels, and Automation — so you can start generating qualified leads on autopilot, starting today.

YOUR LOGIN CREDENTIALS

Login URL: ${login}
Email: ${email}
Password: ${password}

Steps:
1- Click on the link and go to the access page
2- Submit your details (same as used on checkout) and login to your account
3- You will be redirected to the dashboard, where you can access all the material

Log in, go through the system, and start implementing. Everything is laid out step by step.

WANT US TO BUILD THIS PERSONALLY?

I'm opening a small number of free 1:1 strategy calls this week. On this call, we'll map out your exact:
- Lead generation funnel
- Meta Ads strategy
- 90-day action plan

— all tailored specifically to your business and niche. Only a few spots are available. Once they're gone, they're gone.

Book your free call here: ${BRAND.calendly}

Let's make this your best month yet.

To your success,
Team ADMEXO
AI & Performance Marketing Experts`;

  // Simple, clean email: same plain text with clickable links and preserved line breaks.
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#ffffff">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#222222;max-width:600px;margin:0 auto;white-space:pre-wrap">${esc(text)
  .replace(login, `<a href="${login}" style="color:#661fff">${login}</a>`)
  .replace(BRAND.calendly, `<a href="${BRAND.calendly}" style="color:#661fff">${BRAND.calendly}</a>`)}</div>
</body></html>`;

  return { subject, html, text };
}

async function sendEmail({ to, subject, html, text }) {
  const { SendEmailCommand } = require('@aws-sdk/client-ses');
  const ses = getSESClient();
  return ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
      CcAddresses: ['ryan@admexo.com'],
    },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: text } },
    },
  }));
}

module.exports = { BRAND, buildWelcomeEmail, sendEmail, getSESClient };
