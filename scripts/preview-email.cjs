// Renders the welcome email to scripts/preview-welcome.html for visual review.
const fs = require('fs');
const path = require('path');
const { buildWelcomeEmail } = require('../api/_email');

const { html } = buildWelcomeEmail({
  firstName: 'Donald',
  email: 'don@dreamcatchers247.com',
  password: '1795W2UQ',
  tierLabel: 'Gold',
  bumps: ['AI Funnel Copy Creation Agent', 'AI Prompts That Build Your Offer'],
});

const out = path.join(__dirname, 'preview-welcome.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote', out);
