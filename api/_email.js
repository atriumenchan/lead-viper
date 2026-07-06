'use strict';
// Shared email utilities for AI Lead Engine.
// Underscore-prefixed so Vercel does NOT treat this as an API route.

const BRAND = {
  name: 'AI Lead Engine',
  purple: '#661fff',
  purpleDark: '#4c1fb3',
  ink: '#1a1033',
  site: 'https://leadengine.admexo.com',
  calendly: 'https://tidycal.com/1kgnz9d/ai-lead-engine-bonus-growth-strategy-call',
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

// Builds an abandoned-checkout reminder email. `stage` is 1, 2, or 3.
// Returns { subject, html, text }.
function buildReminderEmail({ firstName, checkoutUrl, stage = 1 } = {}) {
  const name = firstName || 'there';
  const url = checkoutUrl || `${BRAND.site}/checkout`;

  const stages = {
    1: {
      subject: `${name}, you left your AI Lead Engine behind`,
      heading: 'You were one step away',
      body: `Hey ${name},

I noticed you started getting your AI Lead Engine but didn't finish checking out.

No worries — it happens. Your spot is still saved, and you can pick up right where you left off.

Inside you get the full system to generate qualified leads on autopilot: Meta Ads, Google Ads, Native Ads, SEO, AI Funnels, and Automation — all laid out step by step.

Finish setting up your account here:`,
      cta: 'Complete My Order',
    },
    2: {
      subject: `Still chasing leads the hard way, ${name}?`,
      heading: 'Your competitors are automating. Are you?',
      body: `Hey ${name},

A couple of days ago you came this close to grabbing the AI Lead Engine.

Here's what you're still missing out on:
- A done-for-you lead generation system across Meta, Google, Native, and SEO
- Plug-and-play AI agents that write your funnels, scripts, and offers
- The exact 21 Leads in 21 Days playbook

Most people keep paying agencies that overpromise and underdeliver. You can own the entire system instead — for a fraction of the price.

Your checkout is still ready:`,
      cta: 'Get Instant Access',
    },
    3: {
      subject: `Last call, ${name} — your AI Lead Engine access`,
      heading: 'This is the final reminder',
      body: `Hey ${name},

This is the last time I'll reach out about your AI Lead Engine.

You showed up because you want consistent, qualified leads without the agency markups and the guesswork. That goal hasn't changed — and the system that gets you there is still one click away.

If now isn't the right time, no problem at all. But if you're ready to finally put your lead generation on autopilot, complete your order below before your saved spot expires:`,
      cta: 'Claim My Access Now',
    },
  };

  const s = stages[stage] || stages[1];
  const text = `${s.body}

${url}

Questions? Just reply to this email or reach us at support@admexo.com

To your success,
Team ADMEXO
AI & Performance Marketing Experts`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ececf0">
  <tr><td style="background:${BRAND.purple};padding:22px 32px">
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#ffffff">&#9889; ${BRAND.name}</span>
  </td></tr>
  <tr><td style="padding:34px 36px 8px">
    <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:21px;color:#1a1033">${s.heading}</h1>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#333;white-space:pre-wrap">${esc(s.body)}</div>
  </td></tr>
  <tr><td align="center" style="padding:24px 36px 8px">
    <a href="${url}" style="display:inline-block;background:${BRAND.purple};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 38px;border-radius:9px">${s.cta} &rarr;</a>
  </td></tr>
  <tr><td style="padding:18px 36px 34px">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#777">Questions? Just reply to this email or reach us at <a href="mailto:support@admexo.com" style="color:${BRAND.purple}">support@admexo.com</a>.<br><br>To your success,<br>Team ADMEXO</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  return { subject: s.subject, html, text };
}

async function sendEmail({ to, subject, html, text }) {
  const { SendEmailCommand } = require('@aws-sdk/client-ses');
  const ses = getSESClient();
  return ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
      BccAddresses: ['admexoemailreports@gmail.com'],
    },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: text } },
    },
  }));
}

module.exports = { BRAND, buildWelcomeEmail, buildReminderEmail, sendEmail, getSESClient };
