'use strict';
// DeepSeek API client — generates the complete 21-day roadmap plan.
// Replaces planner.js with AI-generated, fully personalized plans.

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

async function chat(messages, { apiKey, temperature = 0.4, maxTokens = 16000 } = {}) {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY is required');

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err.slice(0, 400)}`);
  }

  const json = await res.json();
  return json.choices[0].message.content;
}

function buildSystemPrompt() {
  return `You are an expert B2B lead generation strategist and marketing consultant. You ONLY output valid JSON. You never add explanations, markdown, or code fences. Your output is always parseable by JSON.parse() directly.

You create comprehensive 21-day marketing roadmaps. Every recommendation is specific, data-driven, and tailored to the exact business provided. Never use generic filler text.

IMPORTANT: You must follow the exact JSON schema provided. Do not add extra keys. Do not skip any required keys. Every array must have the exact number of items specified.`;
}

function buildUserPrompt(scrapedData, business) {
  const sc = scrapedData || {};
  const monthlyGoal = Number(business.monthlyGoal) || 10000;
  const pricePoint = Number(business.pricePoint) || 1500;
  const clientsNeeded = Math.ceil(monthlyGoal / pricePoint);
  const leadsNeeded = Math.ceil(clientsNeeded / 0.15);
  const dailyLeads = Math.ceil(leadsNeeded / 21);

  return `Generate a complete 21-day marketing roadmap as a single JSON object for this business:

BUSINESS DATA:
- Name: ${business.name || business.businessName || 'Unknown'}
- Website: ${business.website || 'N/A'}
- Niche: ${business.niche || 'Unknown'}
- Target Audience: ${business.audience || 'Unknown'}
- Offer: ${business.offer || 'Unknown'}
- Price Point: $${pricePoint}
- Monthly Revenue Goal: $${monthlyGoal}
- Channels: ${(business.channels || []).join(', ') || 'Not specified'}
- Tone: ${business.tone || 'professional'}
- Main Challenge: ${business.challenge || 'Not specified'}

SCRAPED WEBSITE DATA:
- Title: ${sc.title || 'N/A'}
- Description: ${sc.description || 'N/A'}
- Headings: ${(sc.text?.h2s || []).slice(0, 8).join(' | ') || 'N/A'}
- Content: ${(sc.text?.bodyText || '').slice(0, 1500)}
- Social: ${JSON.stringify(sc.social || {})}

OUTPUT THE FOLLOWING JSON (no markdown, no code fences, raw JSON only):

{
  "business": {
    "name": "${business.name || business.businessName || ''}",
    "website": "${business.website || ''}",
    "nicheLabel": "<human-readable niche name>",
    "audience": "<target audience>",
    "offer": "<their offer>",
    "tone": "${business.tone || 'professional'}",
    "challenge": "<their main challenge>"
  },
  "positioning": "<one powerful positioning statement for this business>",
  "kpis": {
    "monthlyGoal": ${monthlyGoal},
    "pricePoint": ${pricePoint},
    "clientsNeeded": ${clientsNeeded},
    "leadsNeeded": ${leadsNeeded},
    "dailyLeads": ${dailyLeads},
    "outreachPerDay": ${Math.ceil(dailyLeads * 3)},
    "estAdBudget": <estimated monthly ad budget as integer>
  },
  "icp": {
    "pains": ["<5 specific pain points of their ideal client>"],
    "hangouts": ["<5 online/offline places their ideal clients gather>"],
    "triggers": ["<5 buying triggers that make prospects ready to purchase>"]
  },
  "days": [
    {"day": 1, "phase": "FOUNDATION", "title": "<specific task title>", "tasks": ["<3-5 actionable tasks>"], "kpi": "<measurable target>"},
    ... (EXACTLY 21 days: days 1-7 = FOUNDATION, 8-14 = LAUNCH, 15-21 = SCALE)
  ],
  "emails": [
    {"label": "COLD OUTREACH #1", "subject": "<compelling subject line>", "body": "<full email body with {{firstName}} merge tags>"},
    {"label": "FOLLOW-UP #1", "subject": "...", "body": "..."},
    {"label": "FOLLOW-UP #2", "subject": "...", "body": "..."},
    {"label": "NURTURE #1", "subject": "...", "body": "..."},
    {"label": "NURTURE #2", "subject": "...", "body": "..."},
    {"label": "CASE STUDY", "subject": "...", "body": "..."},
    {"label": "SOCIAL PROOF", "subject": "...", "body": "..."},
    {"label": "OFFER", "subject": "...", "body": "..."},
    {"label": "LAST CHANCE", "subject": "...", "body": "..."},
    {"label": "RE-ENGAGEMENT", "subject": "...", "body": "..."}
  ],
  "ads": [
    {"style": "AWARENESS", "headline": "<ad headline>", "primary": "<primary ad text 2-3 sentences>", "cta": "<call to action button text>"},
    {"style": "SOCIAL PROOF", "headline": "...", "primary": "...", "cta": "..."},
    {"style": "DIRECT OFFER", "headline": "...", "primary": "...", "cta": "..."},
    {"style": "RETARGETING", "headline": "...", "primary": "...", "cta": "..."},
    {"style": "URGENCY", "headline": "...", "primary": "...", "cta": "..."}
  ],
  "leadMagnets": [
    "<lead magnet idea 1 as a single descriptive string>",
    "<lead magnet idea 2 as a single descriptive string>",
    "<lead magnet idea 3 as a single descriptive string>"
  ],
  "weeklySummary": [
    {"week": 1, "phase": "FOUNDATION", "days": "1–7", "focus": "<what this week achieves>", "goal": "<primary goal>", "metrics": ["<3-4 measurable KPIs>"], "checkpoint": "<end-of-week validation check>"},
    {"week": 2, "phase": "LAUNCH", "days": "8–14", "focus": "...", "goal": "...", "metrics": ["..."], "checkpoint": "..."},
    {"week": 3, "phase": "SCALE", "days": "15–21", "focus": "...", "goal": "...", "metrics": ["..."], "checkpoint": "..."}
  ],
  "milestones": [
    {"day": 3, "label": "<milestone>", "target": "<measurable target>", "status": "pending"},
    {"day": 7, "label": "...", "target": "...", "status": "pending"},
    {"day": 10, "label": "...", "target": "...", "status": "pending"},
    {"day": 14, "label": "...", "target": "...", "status": "pending"},
    {"day": 21, "label": "...", "target": "...", "status": "pending"}
  ],
  "offerStrategy": {
    "currentTier": "<STARTER|GROWTH|SCALE based on their price point>",
    "strategy": "<one paragraph on their pricing strategy>",
    "positioning": "<how to position the offer against competitors>",
    "pricingTiers": [
      {"name": "STARTER", "price": <number>, "desc": "<what's included>", "best": "<who it's best for>"},
      {"name": "CORE", "price": <number>, "desc": "...", "best": "..."},
      {"name": "PREMIUM", "price": <number>, "desc": "...", "best": "..."}
    ],
    "tips": ["<5 pricing psychology tips specific to their niche>"]
  },
  "competitor": {
    "landscape": "<paragraph about competitive landscape in their niche>",
    "theirWeakness": "<common weakness of competitors>",
    "yourEdge": "<unique advantage this business has>",
    "avoidTrap": "<common mistake to avoid>",
    "battlePlan": ["<5 strategic steps to beat competitors>"]
  },
  "channelStrategy": [
    {"channel": "<channel name>", "audience": "<who to target>", "budget": "<recommended budget>", "creative": "<creative approach>", "retargeting": "<retargeting strategy>"}
  ],
  "metricsTracker": {
    "daily": [
      {"metric": "<daily metric>", "target": "<target value>"},
      {"metric": "...", "target": "..."},
      {"metric": "...", "target": "..."}
    ],
    "weekly": [
      {"metric": "<weekly metric>", "target": "<target value>"},
      {"metric": "...", "target": "..."},
      {"metric": "...", "target": "..."}
    ],
    "monthly": [
      {"metric": "<monthly metric>", "target": "<target value>"},
      {"metric": "...", "target": "..."},
      {"metric": "...", "target": "..."}
    ]
  },
  "contentCalendar": [
    {"day": "MON", "focus": "OUTREACH", "task": "<specific content task>", "channel": "<platform>"},
    {"day": "TUE", "focus": "CONTENT", "task": "...", "channel": "..."},
    {"day": "WED", "focus": "ENGAGE", "task": "...", "channel": "..."},
    {"day": "THU", "focus": "NURTURE", "task": "...", "channel": "..."},
    {"day": "FRI", "focus": "CONVERT", "task": "...", "channel": "..."},
    {"day": "SAT", "focus": "BATCH", "task": "...", "channel": "..."},
    {"day": "SUN", "focus": "REST", "task": "...", "channel": "..."}
  ],
  "ninetyDay": [
    {"phase": "DAYS 22–40", "title": "<phase title>", "focus": "<focus area>", "tasks": ["<4-5 tasks>"], "milestone": "<end milestone>"},
    {"phase": "DAYS 41–60", "title": "...", "focus": "...", "tasks": ["..."], "milestone": "..."},
    {"phase": "DAYS 61–90", "title": "...", "focus": "...", "tasks": ["..."], "milestone": "..."}
  ],
  "risks": [
    {"risk": "<potential risk>", "mitigation": "<how to handle it>"},
    {"risk": "...", "mitigation": "..."},
    {"risk": "...", "mitigation": "..."},
    {"risk": "...", "mitigation": "..."},
    {"risk": "...", "mitigation": "..."}
  ],
  "geoAudit": {
    "overallScore": <number 1-100>,
    "scores": {"technicalSeo": <1-100>, "contentQuality": <1-100>, "aiVisibility": <1-100>, "trustSignals": <1-100>, "entityClarity": <1-100>},
    "strengths": ["<3 strengths>"],
    "weaknesses": ["<3 weaknesses>"],
    "improvements": [
      {"priority": "P0", "category": "technical", "action": "<specific fix>", "impact": "<expected result>"},
      {"priority": "P1", "category": "content", "action": "...", "impact": "..."},
      {"priority": "P2", "category": "ai", "action": "...", "impact": "..."}
    ],
    "aiReadiness": "<one paragraph on AI search readiness>",
    "competitorGap": "<what competitors do better>"
  },
  "mapsQueries": {
    "queries": [
      {"query": "<Google Maps search phrase>", "id": "<slug>", "category": "primary", "location": "<city>"}
    ],
    "suggestedLocations": ["<5 locations>"],
    "totalEstimatedLeads": "<number estimate>"
  },
  "imagePrompts": {
    "brandStyle": "<visual style>",
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "prompts": [
      {"id": "<slug>", "title": "<purpose>", "use": "ad_creative", "dallePrompt": "<DALL-E prompt>", "midjourneyPrompt": "<MJ prompt>", "dimensions": "1:1"}
    ]
  }
}

STRICT RULES:
1. Output ONLY the JSON object — no text before or after
2. EXACTLY 21 days in the "days" array (day 1-7 FOUNDATION, 8-14 LAUNCH, 15-21 SCALE)
3. EXACTLY 10 emails, 5 ads, 3 lead magnets (as plain strings), 3 weekly summaries, 5 milestones, 5 risks, 7 content calendar days, 3 ninety-day phases
4. All channelStrategy items must match the channels the business uses
5. estAdBudget must be an integer (no dollar sign)
6. All pricing tier prices must be integers
7. geoAudit scores must be integers
8. Every field tailored to THIS specific business — no generic advice
9. leadMagnets must be an array of plain strings, NOT objects`;
}

async function generateFullPlan(scrapedData, business, apiKey) {
  const resp = await chat([
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(scrapedData, business) },
  ], { apiKey, temperature: 0.4, maxTokens: 16000 });

  // Parse JSON from response — handle markdown code fences
  let cleaned = resp.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }

  try {
    const plan = JSON.parse(cleaned);
    return validateAndFix(plan, business);
  } catch (e) {
    // Try to extract JSON from the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const plan = JSON.parse(match[0]);
        return validateAndFix(plan, business);
      } catch { /* fall through */ }
    }
    throw new Error(`Failed to parse DeepSeek response as JSON: ${e.message}`);
  }
}

// Validate and fix common issues so the frontend never crashes
function validateAndFix(plan, business) {
  const monthlyGoal = Number(business.monthlyGoal) || 10000;
  const pricePoint = Number(business.pricePoint) || 1500;

  // Ensure business object
  if (!plan.business) plan.business = {};
  plan.business.name = plan.business.name || business.name || business.businessName || '';

  // Ensure positioning
  if (!plan.positioning) plan.positioning = 'Your personalized growth strategy';

  // Ensure kpis with correct numeric types
  if (!plan.kpis) plan.kpis = {};
  plan.kpis.monthlyGoal = Number(plan.kpis.monthlyGoal) || monthlyGoal;
  plan.kpis.pricePoint = Number(plan.kpis.pricePoint) || pricePoint;
  plan.kpis.clientsNeeded = Number(plan.kpis.clientsNeeded) || Math.ceil(monthlyGoal / pricePoint);
  plan.kpis.leadsNeeded = Number(plan.kpis.leadsNeeded) || Math.ceil(plan.kpis.clientsNeeded / 0.15);
  plan.kpis.dailyLeads = Number(plan.kpis.dailyLeads) || Math.ceil(plan.kpis.leadsNeeded / 21);
  plan.kpis.outreachPerDay = Number(plan.kpis.outreachPerDay) || plan.kpis.dailyLeads * 3;
  plan.kpis.estAdBudget = Number(plan.kpis.estAdBudget) || 500;

  // Ensure icp arrays
  if (!plan.icp) plan.icp = {};
  if (!Array.isArray(plan.icp.pains)) plan.icp.pains = ['No pain points generated'];
  if (!Array.isArray(plan.icp.hangouts)) plan.icp.hangouts = ['No hangouts generated'];
  if (!Array.isArray(plan.icp.triggers)) plan.icp.triggers = ['No triggers generated'];

  // Ensure days array
  if (!Array.isArray(plan.days) || plan.days.length === 0) plan.days = [];
  for (const d of plan.days) {
    if (!Array.isArray(d.tasks)) d.tasks = [d.title || 'Complete daily task'];
    if (!d.kpi) d.kpi = 'Complete all tasks';
  }

  // Ensure emails have .label
  if (!Array.isArray(plan.emails)) plan.emails = [];
  for (const em of plan.emails) {
    if (!em.label) em.label = em.type || 'EMAIL';
    if (!em.subject) em.subject = 'Follow up';
    if (!em.body) em.body = '';
  }

  // Ensure ads have .style, .headline, .primary, .cta
  if (!Array.isArray(plan.ads)) plan.ads = [];
  for (const ad of plan.ads) {
    if (!ad.style) ad.style = ad.platform || 'GENERAL';
    if (!ad.headline) ad.headline = '';
    if (!ad.primary) ad.primary = ad.body || '';
    if (!ad.cta) ad.cta = 'Learn More';
  }

  // Ensure leadMagnets is array of strings
  if (!Array.isArray(plan.leadMagnets)) plan.leadMagnets = [];
  plan.leadMagnets = plan.leadMagnets.map((m) => typeof m === 'string' ? m : `${m.title || ''} — ${m.description || m.format || ''}`);

  // Ensure weeklySummary
  if (!Array.isArray(plan.weeklySummary)) plan.weeklySummary = [];
  for (const w of plan.weeklySummary) {
    if (!w.days) w.days = w.week === 1 ? '1–7' : w.week === 2 ? '8–14' : '15–21';
    if (!w.goal) w.goal = w.focus || '';
    if (!Array.isArray(w.metrics)) w.metrics = w.deliverables || ['Track progress'];
    if (!w.checkpoint) w.checkpoint = 'Review and adjust';
  }

  // Ensure milestones
  if (!Array.isArray(plan.milestones)) plan.milestones = [];
  for (const m of plan.milestones) {
    if (!m.target) m.target = m.label || '';
    if (!m.status) m.status = 'pending';
  }

  // Ensure offerStrategy
  if (!plan.offerStrategy) {
    plan.offerStrategy = {
      currentTier: pricePoint < 500 ? 'STARTER' : pricePoint < 2000 ? 'GROWTH' : 'SCALE',
      strategy: 'Position your offer at the intersection of value and transformation.',
      positioning: 'Premium positioning based on results, not time.',
      pricingTiers: [
        { name: 'STARTER', price: Math.round(pricePoint * 0.5), desc: 'Entry-level access', best: 'New clients testing the waters' },
        { name: 'CORE', price: pricePoint, desc: 'Full service package', best: 'Serious clients ready for growth' },
        { name: 'PREMIUM', price: Math.round(pricePoint * 2.5), desc: 'Done-for-you with priority support', best: 'Clients who want maximum results fastest' },
      ],
      tips: ['Anchor with the premium tier first', 'Use odd pricing ($1,497 vs $1,500)', 'Add urgency with limited spots', 'Bundle bonuses to increase perceived value', 'Offer a guarantee to reduce risk'],
    };
  }
  if (!Array.isArray(plan.offerStrategy.pricingTiers)) plan.offerStrategy.pricingTiers = [];
  for (const t of plan.offerStrategy.pricingTiers) { t.price = Number(t.price) || 0; }
  if (!Array.isArray(plan.offerStrategy.tips)) plan.offerStrategy.tips = [];

  // Ensure competitor
  if (!plan.competitor) {
    plan.competitor = { landscape: 'Competitive market with opportunity for differentiation.', theirWeakness: 'Generic messaging and slow response times.', yourEdge: 'Personalized approach and deep niche expertise.', avoidTrap: 'Do not compete on price alone.', battlePlan: ['Differentiate on speed', 'Showcase social proof', 'Target underserved segments', 'Build authority content', 'Create referral loops'] };
  }
  if (!Array.isArray(plan.competitor.battlePlan)) plan.competitor.battlePlan = [];

  // Ensure channelStrategy
  if (!Array.isArray(plan.channelStrategy)) plan.channelStrategy = [];

  // Ensure metricsTracker
  if (!plan.metricsTracker) plan.metricsTracker = { daily: [], weekly: [], monthly: [] };
  if (!Array.isArray(plan.metricsTracker.daily)) plan.metricsTracker.daily = [];
  if (!Array.isArray(plan.metricsTracker.weekly)) plan.metricsTracker.weekly = [];
  if (!Array.isArray(plan.metricsTracker.monthly)) plan.metricsTracker.monthly = [];

  // Ensure contentCalendar
  if (!Array.isArray(plan.contentCalendar)) plan.contentCalendar = [];

  // Ensure ninetyDay
  if (!Array.isArray(plan.ninetyDay)) plan.ninetyDay = [];
  for (const p of plan.ninetyDay) { if (!Array.isArray(p.tasks)) p.tasks = []; }

  // Ensure risks
  if (!Array.isArray(plan.risks)) plan.risks = [];

  return plan;
}

module.exports = { chat, generateFullPlan };
