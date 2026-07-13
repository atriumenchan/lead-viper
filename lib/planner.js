'use strict';
// Personalized Growth Plan Engine — deterministic, zero external APIs.
// Takes business intel and produces: ICP profile, KPI flight math, a 21-day
// day-by-day mission plan, 5 personalized email swipes, ad copy variants,
// lead magnet ideas and a positioning statement.

const NICHES = {
  agency:     { label: 'Marketing Agency',  closeRate: 0.15, replyRate: 0.08, leadCost: 6 },
  coach:      { label: 'Coach / Trainer',   closeRate: 0.20, replyRate: 0.10, leadCost: 5 },
  consultant: { label: 'Consultant',        closeRate: 0.18, replyRate: 0.09, leadCost: 7 },
  ecom:       { label: 'E-commerce Brand',  closeRate: 0.03, replyRate: 0.05, leadCost: 2 },
  saas:       { label: 'SaaS / Software',   closeRate: 0.08, replyRate: 0.06, leadCost: 8 },
  realtor:    { label: 'Real Estate',       closeRate: 0.12, replyRate: 0.07, leadCost: 9 },
  local:      { label: 'Local Business',    closeRate: 0.25, replyRate: 0.12, leadCost: 4 },
  freelancer: { label: 'Freelancer',        closeRate: 0.22, replyRate: 0.11, leadCost: 4 },
  other:      { label: 'Business',          closeRate: 0.15, replyRate: 0.08, leadCost: 6 },
};

const ICP = {
  agency: {
    pains: ['Inconsistent client pipeline', 'Competing on price against cheap freelancers', 'Founder stuck doing sales AND delivery'],
    hangouts: ['LinkedIn groups for founders', 'Facebook ad buyer communities', 'Local business meetups'],
    triggers: ['Just lost a big client', 'Hiring their first salesperson', 'Running ads with poor ROAS'],
  },
  coach: {
    pains: ['Feast-or-famine income', 'Low-ticket clients that drain energy', 'No repeatable client acquisition system'],
    hangouts: ['Instagram & TikTok self-improvement niches', 'Facebook groups in their transformation topic', 'Podcast audiences'],
    triggers: ['New year / new quarter goal setting', 'Life or career transition', 'Followed you for months without buying'],
  },
  consultant: {
    pains: ['Reliance on referrals only', 'Long unpredictable sales cycles', 'Positioned as a generalist'],
    hangouts: ['LinkedIn industry hashtags', 'Industry Slack & Discord communities', 'Trade conferences'],
    triggers: ['New funding or leadership change at target company', 'Regulatory change in their industry', 'Failed internal initiative'],
  },
  ecom: {
    pains: ['Rising ad costs eating margin', 'One-time buyers who never return', 'Weak email revenue'],
    hangouts: ['Instagram & TikTok product discovery', 'Pinterest boards', 'Niche subreddits'],
    triggers: ['Seasonal buying windows', 'Saw a friend post the product', 'Retargeted after site visit'],
  },
  saas: {
    pains: ['High churn from wrong-fit users', 'Long free-trial to paid conversion', 'Founder-led sales hitting a ceiling'],
    hangouts: ['Product Hunt & Hacker News', 'LinkedIn SaaS communities', 'G2/Capterra comparison pages'],
    triggers: ['Current tool renewal coming up', 'Team scaling pains', 'Integration requirements changed'],
  },
  realtor: {
    pains: ['Zillow leads shared with 5 other agents', 'No brand differentiation locally', 'Dead database of old contacts'],
    hangouts: ['Local Facebook community groups', 'Instagram local hashtags', 'Neighborhood events'],
    triggers: ['Job relocation', 'Growing family', 'Interest rate changes'],
  },
  local: {
    pains: ['Foot traffic dependent revenue', 'Invisible on Google Maps', 'No system to bring customers back'],
    hangouts: ['Google Search & Maps', 'Local Facebook groups', 'Community events'],
    triggers: ['Moved to the area recently', 'Bad experience with a competitor', 'Special occasion coming up'],
  },
  freelancer: {
    pains: ['Platform race-to-the-bottom pricing', 'Client work leaves no time for marketing', 'No recurring revenue'],
    hangouts: ['LinkedIn & X (Twitter) niche conversations', 'Slack communities for their skill', 'Indie hacker forums'],
    triggers: ['Agency laid off their team', 'Project deadline crunch', 'Budget season planning'],
  },
  other: {
    pains: ['Unpredictable lead flow', 'Unclear differentiation', 'Marketing feels like guesswork'],
    hangouts: ['LinkedIn', 'Facebook groups', 'Industry communities'],
    triggers: ['Growth targets increased', 'Competitor gained ground', 'New budget cycle'],
  },
};

const LEAD_MAGNETS = {
  agency: ['Free "Ad Account Audit" (10-point scorecard)', '"What 50 winning ads have in common" swipe file', 'ROI calculator template for ad spend'],
  coach: ['Free 5-day challenge in your transformation topic', '"Self-assessment scorecard" quiz with personalized results', '15-minute breakthrough call framework'],
  consultant: ['Industry benchmark report (1-pager)', 'Free 20-minute diagnostic session', '"The 7 mistakes companies make in X" whitepaper'],
  ecom: ['First-order discount + style/usage guide', 'Interactive product-finder quiz', 'VIP early-access list'],
  saas: ['Free tool / calculator solving one tiny problem', 'Comparison guide: you vs. the incumbent', 'Template pack your users need anyway'],
  realtor: ['Free instant home valuation', 'Neighborhood market report (monthly)', 'First-time buyer checklist'],
  local: ['First-visit discount voucher', 'Loyalty punch-card (digital)', 'Free consultation / sample'],
  freelancer: ['Free mini-audit of their current asset', 'Portfolio teardown video', 'Fixed-scope starter package'],
  other: ['Free audit / assessment', 'Checklist or template', 'Mini email course'],
};

const COMPETITORS = {
  agency:     { typical: 'Generalist agencies, freelance platforms (Upwork/Fiverr)', weakness: 'No niche specialization, poor reporting, cookie-cutter strategies', edge: 'Niche expertise + transparent dashboards + performance pricing', avoid: 'Competing on price — win on outcome specificity' },
  coach:      { typical: 'Other coaches in same transformation niche, free YouTube content', weakness: 'Generic advice, no accountability system, no measurable outcomes', edge: 'Structured program with milestones + community + direct access', avoid: 'Out-contenting free creators — win on transformation, not information' },
  consultant: { typical: 'Big 4 firms, boutique consultancies, internal hires', weakness: 'Slow delivery, high overhead, theoretical not practical', edge: 'Speed of implementation + hands-on + niche depth', avoid: 'Competing with brand prestige — win on results and speed' },
  ecom:       { typical: 'Amazon sellers, direct-to-consumer competitors, marketplace resellers', weakness: 'No brand loyalty, weak retention, commodity pricing', edge: 'Brand story + retention engine + community building', avoid: 'Race to bottom on price — win on LTV and experience' },
  saas:       { typical: 'Incumbent software, open-source alternatives, spreadsheets', weakness: 'Bloated features, slow onboarding, poor support, high switch cost', edge: 'Faster onboarding + niche workflow + white-glove support', avoid: 'Feature wars — win on time-to-value and support quality' },
  realtor:    { typical: 'Other local agents, Zillow Premier Agent, discount brokerages', weakness: 'No personal brand, shared leads, transactional not relational', edge: 'Personal brand + database nurturing + hyper-local expertise', avoid: 'Competing on commission rate — win on marketing and service' },
  local:      { typical: 'Nearby competitors, chains/franchises, online directories', weakness: 'No online presence, no reviews, no customer retention system', edge: 'Local SEO + review engine + loyalty program', avoid: 'Competing with chain pricing — win on community and reviews' },
  freelancer: { typical: 'Other freelancers, agencies, AI tools, template sellers', weakness: 'Inconsistent quality, no process, no guarantee', edge: 'Fixed-scope packages + guaranteed deliverables + fast turnaround', avoid: 'Hourly billing — win on outcome-based pricing' },
  other:      { typical: 'Direct competitors and substitute solutions', weakness: 'Generic positioning, no clear differentiation', edge: 'Niche focus + measurable outcome + superior process', avoid: 'Looking like everyone else — win on specificity' },
};

const OFFER_TIERS = {
  low:    { range: [0, 97],     label: 'LOW-TICKET', strategy: 'Volume play: optimize for conversion rate and LTV. Bundle a recurring component (membership, retainer, subscription). Goal: reduce CAC below 1 month revenue.' },
  mid:    { range: [98, 997],   label: 'MID-TICKET', strategy: 'Value ladder: low-ticket entry → mid-ticket core → high-ticket upsell. Use tripwire offers to convert cold traffic. Goal: 3x LTV within 90 days.' },
  high:   { range: [998, 4997], label: 'HIGH-TICKET', strategy: 'Consultative sale: application → call → proposal. Lead with diagnostic/audit. Scarcity: limit monthly slots. Goal: 5-10 clients/month at high margin.' },
  premium:{ range: [4998, Infinity], label: 'PREMIUM', strategy: 'Exclusive positioning: vetted intake, case-study driven, done-for-you delivery. 3-tier pricing (Good/Better/Best). Goal: 1-3 clients/month, referral-driven.' },
};

const RISK_MITIGATION = [
  { risk: 'No leads in first 5 days', mitigation: 'Don\'t panic — foundation phase is setup. If Day 8 launches and you get zero in 48h, audit: targeting, offer clarity, channel fit. Pivot one variable at a time.' },
  { risk: 'Leads but no calls booked', mitigation: 'Friction is killing you. Shorten booking to 1 click. Offer 2 specific time slots instead of a calendar. Add a P.S. in every email: "P.S. I have Tuesday 2pm or Thursday 11am open this week."' },
  { risk: 'Calls but no closes', mitigation: 'You\'re pitching too early. Spend 70% of the call diagnosing. Use a structured framework: Situation → Problem → Implication → Need-payoff. Then prescribe.' },
  { risk: 'Ad spend with no ROI', mitigation: 'Kill anything above 2x target CPL after 3 days. Rotate creatives weekly. Ensure landing page matches ad promise exactly. Retargeting is cheaper than cold — invest there first.' },
  { risk: 'Burnout by Day 14', mitigation: 'Block outreach in 90-minute sprints, not all-day. Batch content creation on weekends. Track energy, not just output. If energy drops 2 days straight, take a half-day off.' },
  { risk: 'Best channel stops performing', mitigation: 'Never go below 2 active channels. When one dips, shift budget to the backup. Revisit messaging — fatigue sets in at 7-10 days. Refresh creative weekly.' },
];

const CHANNEL_DEEP_DIVE = {
  facebook: {
    audience: 'Use detailed targeting: interests + behaviors + lookalikes from your email list',
    budget: 'Start $10-20/day per campaign. Scale winners 20% every 48h. Kill at 2x target CPL.',
    creative: 'Video > image for cold. User-generated content > polished. 3:1 ratio of value to promotion in feed.',
    retargeting: '7-day viewers, 30-day visitors, email opens — 3 separate ad sets at $5/day each',
  },
  linkedin: {
    audience: 'Filter by title, company size, industry. Sales Navigator worth it if target >$50k deals.',
    budget: 'Organic first. $10-20/day on boosted posts that get engagement. Sponsored content for cold reach.',
    creative: 'Text posts > links. Carousels get 3x reach. Personal stories > company news. Comment on 10 ICP posts daily.',
    retargeting: 'Retarget profile viewers and post engagers with lead magnet. DM within 24h of engagement.',
  },
  instagram: {
    audience: 'Hashtags: 5 niche + 3 community + 2 broad. Engage 20 min/day before posting.',
    budget: 'Organic first. Boost top-performing reels to warm audience. $5-10/day test budget.',
    creative: 'Reels > stories > feed. Before/after format wins. Save-worthy content > viral content for leads.',
    retargeting: 'Story ads to profile visitors. DM automation for lead magnet delivery.',
  },
  email: {
    audience: 'Your list is gold. Segment: engaged (30-day open), cold (60+ day), dead (90+ day).',
    budget: 'Tool: $0-30/mo for <1000 contacts. Focus on deliverability: warm up, segment, avoid spam words.',
    creative: 'Plain text > designed templates. One CTA per email. Subject line = 80% of results. Test 2 per send.',
    retargeting: 'Win-back sequence for 90+ day inactive. Re-engagement campaign before purging cold contacts.',
  },
  outreach: {
    audience: 'Quality > quantity. 20 hyper-personalized > 100 generic. Use trigger events (funding, hires, news).',
    budget: 'Tool: $0-50/mo for CRM. Time is the real cost: 90 min/day in 2 sprints.',
    creative: '3-sentence max first email. Reference something specific. No attachments. Follow up 3x minimum.',
    retargeting: 'Multi-touch: email → LinkedIn connect → comment on their post → email #2. 5-7 touches over 2 weeks.',
  },
  seo: {
    audience: 'Buyer-intent keywords only. "Best [solution] for [niche]" > "how to [generic topic]".',
    budget: 'Tool: $0-100/mo (Search Console free, Ahrefs/Semrush optional). Content: 1-2 posts/week.',
    creative: 'Answer the question in the first 100 words. Use FAQ schema. Internal link to your offer page from every post.',
    retargeting: 'Google Business Profile posts weekly. Get 1 review/week. Optimize for map pack first.',
  },
};

const TONE_STYLE = {
  professional: { greeting: 'Hi', signoff: 'Best regards', adjective: 'proven' },
  bold:         { greeting: 'Hey', signoff: 'Talk soon',   adjective: 'unfair-advantage' },
  friendly:     { greeting: 'Hey there', signoff: 'Cheers', adjective: 'refreshingly simple' },
};

const CHANNEL_TASKS = {
  facebook: {
    setup: 'Set up / verify your Facebook Business Manager, pixel and ad account',
    daily: 'Review Facebook ad metrics (CTR, CPC, CPL) and pause anything above target CPL',
    launch: 'Launch your Facebook lead campaign: 3 ad variants, $10–20/day, optimize for leads',
  },
  linkedin: {
    setup: 'Optimize your LinkedIn profile headline & banner around the outcome you deliver',
    daily: 'Send 15 personalized LinkedIn connection requests to your ICP + follow up with 10 existing connections',
    launch: 'Publish a LinkedIn post sharing one client insight or result — end with a soft CTA',
  },
  instagram: {
    setup: 'Switch to an Instagram business profile; write a bio with a clear CTA link',
    daily: 'Post 1 story + engage 20 minutes with your ICP\u2019s comments and hashtags',
    launch: 'Publish a reel showing the before/after of your offer',
  },
  email: {
    setup: 'Set up your email tool, sender domain (SPF/DKIM) and import existing contacts',
    daily: 'Send follow-up emails to yesterday\u2019s new leads within 24 hours',
    launch: 'Send Email #1 (intro swipe below) to your list / first 50 prospects',
  },
  outreach: {
    setup: 'Build a 100-prospect list matching your ICP (name, company, email, 1 personal note)',
    daily: 'Send 20 personalized cold messages using the swipes below; log replies in your tracker',
    launch: 'Start your first outreach sprint: 20 sends + 10 follow-ups',
  },
  seo: {
    setup: 'Set up Google Business Profile / Search Console; find 5 buyer-intent keywords',
    daily: 'Spend 30 minutes on one SEO task: internal links, one FAQ answer, or a review request',
    launch: 'Publish one buyer-intent page or post targeting your best keyword',
  },
};

function esc(s) {
  return String(s || '').trim();
}

// ── KPI math ─────────────────────────────────────────────────────────────────
function buildKpis(input, niche) {
  const goal = Math.max(Number(input.monthlyGoal) || 5000, 500);
  const price = Math.max(Number(input.pricePoint) || 500, 10);
  const clientsNeeded = Math.max(Math.ceil(goal / price), 1);
  const leadsNeeded = Math.ceil(clientsNeeded / niche.closeRate);
  const dailyLeads = Math.max(Math.ceil(leadsNeeded / 21), 1);
  const outreachPerDay = Math.max(Math.ceil(dailyLeads / niche.replyRate / 2), 10);
  const estAdBudget = leadsNeeded * niche.leadCost;

  return {
    monthlyGoal: goal,
    pricePoint: price,
    clientsNeeded,
    closeRate: Math.round(niche.closeRate * 100),
    leadsNeeded,
    dailyLeads,
    outreachPerDay: Math.min(outreachPerDay, 60),
    estAdBudget,
  };
}

// ── 21-day plan ──────────────────────────────────────────────────────────────
function buildPlan(input, kpis) {
  const biz = esc(input.businessName) || 'your business';
  const aud = esc(input.audience) || 'your ideal clients';
  const offer = esc(input.offer) || 'your offer';
  const channels = (input.channels && input.channels.length ? input.channels : ['outreach', 'email'])
    .filter((c) => CHANNEL_TASKS[c]);
  const ch = (i) => channels[i % channels.length];

  const days = [];
  const add = (day, phase, title, tasks, kpi) => days.push({ day, phase, title, tasks, kpi });

  // ── PHASE 1 · FOUNDATION (Days 1–7) ──
  add(1, 'FOUNDATION', 'ICP & Audience Setup', [
    `Write down exactly who ${biz} serves: "${aud}" — get specific on role, size and pain`,
    'Fill in the ICP profile below and pin it where you work',
    `Define your one-line promise: what result does "${offer}" deliver, for whom, in what timeframe?`,
    'Set up a simple lead tracker (sheet: name, source, status, next action)',
  ], 'ICP documented + tracker live');
  add(2, 'FOUNDATION', 'Build Your Lead Magnet', [
    `Create your lead magnet: "${(LEAD_MAGNETS[input.niche] || LEAD_MAGNETS.other)[0]}"`,
    'Keep it consumable in under 10 minutes — value density beats length',
    'Write a 2-sentence pitch for it you can paste anywhere',
  ], 'Lead magnet done');
  add(3, 'FOUNDATION', 'Channel Setup I', [
    CHANNEL_TASKS[ch(0)].setup,
    channels[1] ? CHANNEL_TASKS[ch(1)].setup : 'Double-check tracking: every lead source must be attributable',
    'Create your opt-in page: headline = the promise, form = name + email only',
  ], 'Primary channel operational');
  add(4, 'FOUNDATION', 'Channel Setup II + Swipes', [
    channels[2] ? CHANNEL_TASKS[ch(2)].setup : 'Set up a calendar booking link (Calendly or similar) with 3 open slots/day',
    'Personalize the 5 email swipes below — replace every [bracket] with your specifics',
    'Load emails into your sending tool as templates',
  ], 'All systems armed');
  add(5, 'FOUNDATION', 'Build the Prospect List', [
    `List 100 prospects matching: ${aud}`,
    'For each: one personal detail you can reference (post, news, mutual connection)',
    'Prioritize the 20 with an active buying trigger',
  ], '100 prospects listed');
  add(6, 'FOUNDATION', 'Create Your Ad Creatives', [
    'Generate your 3 ad creatives below (download the PNGs) or rebuild them in Canva',
    'Write 3 hook variations — lead with the pain, not your service',
    'Prepare 2 short proof points (result, testimonial, or personal story)',
  ], '3 creatives ready');
  add(7, 'FOUNDATION', 'Dry Run & Systems Check', [
    'Test the full funnel yourself: ad/post → opt-in → email → booking',
    'Fix every broken link and typo — first impressions convert',
    'Schedule Week 2 in your calendar: outreach blocks are non-negotiable',
  ], 'Funnel verified end-to-end');

  // ── PHASE 2 · LAUNCH (Days 8–14) ──
  add(8, 'LAUNCH', 'Launch Day — Go Live', [
    CHANNEL_TASKS[ch(0)].launch,
    channels[1] ? CHANNEL_TASKS[ch(1)].launch : 'Announce your lead magnet on every profile you own',
    `Target: first ${kpis.dailyLeads} lead(s) today`,
  ], `${kpis.dailyLeads} leads`);
  for (let d = 9; d <= 13; d++) {
    const focus = ch(d);
    add(d, 'LAUNCH', `Daily Ops — ${focus.toUpperCase()} Focus`, [
      CHANNEL_TASKS[focus].daily,
      `Send/continue outreach: ${kpis.outreachPerDay} touches today (new + follow-ups)`,
      'Reply to every lead within 4 hours — speed doubles conversion',
      d === 11 ? `Send Email #2 (value swipe) to all leads collected so far` :
      d === 13 ? `Send Email #3 (case study swipe) to unconverted leads` :
        'Log every conversation in your tracker before closing the day',
    ], `${kpis.dailyLeads} leads · ${kpis.outreachPerDay} touches`);
  }
  add(14, 'LAUNCH', 'Week 2 Debrief', [
    'Count: leads, conversations, calls booked, revenue. Write the numbers down',
    'Identify your best channel — it gets 70% of your time next week',
    'Kill the worst performer without mercy',
    'Ask 3 warm leads: "What almost stopped you from signing up?"',
  ], 'Debrief complete + reallocation done');

  // ── PHASE 3 · SCALE (Days 15–21) ──
  add(15, 'SCALE', 'Double Down', [
    'Shift 70% of effort/budget into your winning channel',
    `Raise daily outreach to ${Math.min(kpis.outreachPerDay + 10, 80)} touches using your best-performing message`,
    'Send Email #4 (objection swipe) to every lead who went quiet',
  ], 'Winner scaled');
  add(16, 'SCALE', 'Social Proof Engine', [
    'Collect 2 testimonials or results (even small wins count) from clients/pilots',
    'Turn each one into a post AND an ad variant',
    'Add proof to your opt-in page above the form',
  ], '2 proof assets published');
  add(17, 'SCALE', 'Referral Loop', [
    'Message every past/current client: "Who else do you know struggling with [pain]?"',
    'Offer a concrete referral incentive (free month, upgrade, or fee share)',
    'Add a P.S. referral ask to your email signature',
  ], '10 referral asks sent');
  add(18, 'SCALE', 'Conversion Day', [
    'Book calls with every warm lead: send them your booking link with 2 slot suggestions',
    'On calls: diagnose first (10 min), prescribe second (5 min), then ask for the business',
    'Send Email #5 (close swipe) — deadline + clear next step',
  ], `${Math.max(Math.ceil(kpis.clientsNeeded / 2), 1)} calls booked`);
  add(19, 'SCALE', 'Objection Autopsy', [
    'Write down every objection heard this week and script a 2-sentence answer for each',
    'Update your emails/ads to pre-answer the top objection',
    'Follow up with every "maybe" — a maybe left alone is a no',
  ], 'Objection playbook v1');
  add(20, 'SCALE', 'Systemize', [
    'Document your working process: list source → message → follow-up cadence → close',
    'Template every message you sent more than twice',
    'Decide what to automate or delegate first (usually: list building)',
  ], 'Playbook documented');
  add(21, 'SCALE', 'Debrief & Plan Next Steps', [
    `Final count vs target: ${kpis.leadsNeeded} leads, ${kpis.clientsNeeded} clients, ${'$' + kpis.monthlyGoal.toLocaleString('en-US')}`,
    'Write your Day 22–42 plan: keep the winner, add ONE new channel maximum',
    'Celebrate — then raise your daily minimums by 20%',
  ], 'Next 21-day cycle planned');

  return days;
}

// ── Email swipes ─────────────────────────────────────────────────────────────
function buildEmails(input, kpis) {
  const t = TONE_STYLE[input.tone] || TONE_STYLE.professional;
  const name = esc(input.name) || 'Me';
  const firstName = name.split(' ')[0];
  const biz = esc(input.businessName) || 'my company';
  const aud = esc(input.audience) || 'businesses like yours';
  const offer = esc(input.offer) || 'what we do';
  const pain = (ICP[input.niche] || ICP.other).pains[0].toLowerCase();

  return [
    {
      label: 'EMAIL 1 · COLD INTRO',
      subject: `quick question, [FirstName]`,
      body: `${t.greeting} [FirstName],\n\nI work with ${aud} and keep hearing the same thing: ${pain}.\n\nAt ${biz} we built a ${t.adjective} way to fix that — ${offer}.\n\nWorth a 10-minute look this week? If not, no hard feelings.\n\n${t.signoff},\n${firstName}`,
    },
    {
      label: 'EMAIL 2 · VALUE DROP',
      subject: `the 3 things holding [Company] back`,
      body: `${t.greeting} [FirstName],\n\nNo pitch today — just the 3 patterns I see stopping ${aud} from growing:\n\n1. ${(ICP[input.niche] || ICP.other).pains[0]}\n2. ${(ICP[input.niche] || ICP.other).pains[1]}\n3. ${(ICP[input.niche] || ICP.other).pains[2]}\n\nIf even one of these sounds familiar, I put together a short resource on exactly how we fix it: [Lead Magnet Link]\n\n${t.signoff},\n${firstName}`,
    },
    {
      label: 'EMAIL 3 · CASE STUDY',
      subject: `how [Client] got [Result] in 21 days`,
      body: `${t.greeting} [FirstName],\n\nQuick story: a client came to us dealing with ${pain}.\n\n21 days later: [specific result — number, %, or revenue].\n\nThe playbook was simple:\n• [Step 1]\n• [Step 2]\n• [Step 3]\n\nI can walk you through how it would map onto [Company] in 15 minutes. Open to it?\n\n${t.signoff},\n${firstName}`,
    },
    {
      label: 'EMAIL 4 · OBJECTION KILLER',
      subject: `"we've tried this before"`,
      body: `${t.greeting} [FirstName],\n\nThe most common thing I hear from ${aud}: "we tried something like this and it didn't work."\n\nTotally fair. Usually it failed because of [common reason — no follow-up system / wrong audience / gave up at day 10].\n\nThat's exactly what ${offer} is designed around.\n\nIf I'm wrong about your situation, tell me and I'll stop emailing. If I'm right — 15 minutes this week?\n\n${t.signoff},\n${firstName}`,
    },
    {
      label: 'EMAIL 5 · THE CLOSE',
      subject: `closing the loop, [FirstName]`,
      body: `${t.greeting} [FirstName],\n\nI'm finalizing this month's client slots at ${biz} — we take on ${Math.max(kpis.clientsNeeded, 3)} new ${aud.split(' ')[0] || 'client'} accounts at a time so delivery stays sharp.\n\nIf you want one of them, grab a time here: [Booking Link] (takes 30 seconds).\n\nAfter Friday I'll assume the timing isn't right and close your file — no hard feelings either way.\n\n${t.signoff},\n${firstName}`,
    },
  ];
}

// ── Ad copy ──────────────────────────────────────────────────────────────────
function buildAds(input, kpis) {
  const aud = esc(input.audience) || 'business owners';
  const offer = esc(input.offer) || 'our system';
  const biz = esc(input.businessName) || 'Us';
  const pain = (ICP[input.niche] || ICP.other).pains[0];

  return [
    {
      style: 'PAIN → PROMISE',
      headline: `Still dealing with ${pain.toLowerCase()}?`,
      primary: `Most ${aud} don't have a lead problem — they have a system problem. ${offer} fixes the system. See how in the free guide.`,
      cta: 'Download Free',
    },
    {
      style: 'PROOF-FIRST',
      headline: `${kpis.leadsNeeded}+ qualified leads in 21 days. Here's the math.`,
      primary: `${biz} built a repeatable 21-day engine for ${aud}. No guesswork — a daily checklist with exact targets. Get the plan free.`,
      cta: 'Get The Plan',
    },
    {
      style: 'CALL-OUT',
      headline: `${aud.charAt(0).toUpperCase() + aud.slice(1)}: read this before spending another $1 on ads`,
      primary: `There are 3 reasons your pipeline is unpredictable — and none of them are "the algorithm." Free breakdown inside.`,
      cta: 'Learn More',
    },
  ];
}

// ── Weekly strategy summaries ─────────────────────────────────────────────────
function buildWeeklySummary(kpis, channels) {
  return [
    {
      week: 1, phase: 'FOUNDATION', days: '1–7',
      focus: 'Build the machine — every system, asset and list must be ready before ignition',
      goal: `Setup complete: ICP locked, lead magnet built, ${channels.length} channel(s) configured, 100-prospect list ready`,
      metrics: ['Lead magnet created', 'Opt-in page live', '100 prospects listed', 'Funnel tested end-to-end'],
      checkpoint: 'By end of Day 7: could a stranger go from ad → opt-in → email → booking without any manual intervention?',
    },
    {
      week: 2, phase: 'LAUNCH', days: '8–14',
      focus: `Go live and generate — target ${kpis.dailyLeads} leads/day across ${channels.join(' + ').toUpperCase()}`,
      goal: `${kpis.dailyLeads * 7}+ leads captured, ${Math.max(Math.ceil(kpis.dailyLeads * 7 * 0.3), 1)}+ conversations started, ${Math.max(Math.ceil(kpis.clientsNeeded / 3), 1)}+ clients closed`,
      metrics: [`Daily leads: target ${kpis.dailyLeads}`, `Outreach touches: ${kpis.outreachPerDay}/day`, 'Response rate: track & aim >8%', 'Calls booked: track daily'],
      checkpoint: 'By end of Day 14: do you know which channel produces leads at the lowest cost? That channel gets 70% of Week 3 budget.',
    },
    {
      week: 3, phase: 'SCALE', days: '15–21',
      focus: `Double down on the winner — scale what works, kill what doesn't, close ${kpis.clientsNeeded} clients`,
      goal: `${kpis.clientsNeeded} clients closed · $${kpis.monthlyGoal.toLocaleString('en-US')} revenue · system documented for repeat`,
      metrics: [`Clients closed: target ${kpis.clientsNeeded}`, `Revenue: target $${kpis.monthlyGoal.toLocaleString('en-US')}`, 'Cost per acquisition: track & optimize', 'System documented: yes/no'],
      checkpoint: 'By end of Day 21: can you hand this playbook to a VA and have them run outreach without you? If yes, you have a business. If no, you have a job.',
    },
  ];
}

// ── Milestones ────────────────────────────────────────────────────────────────
function buildMilestones(kpis) {
  return [
    { day: 7,  label: 'FOUNDATION COMPLETE', target: 'All systems armed and tested', status: 'setup' },
    { day: 10, label: 'FIRST LEADS', target: `${kpis.dailyLeads * 3}+ leads in the pipeline`, status: 'traction' },
    { day: 14, label: 'CHANNEL WINNER IDENTIFIED', target: 'Know your CPL and best channel', status: 'data' },
    { day: 18, label: 'FIRST CLIENT CLOSED', target: '1+ paying client from the system', status: 'revenue' },
    { day: 21, label: 'TARGET HIT', target: `${kpis.clientsNeeded} clients · $${kpis.monthlyGoal.toLocaleString('en-US')}`, status: 'goal' },
    { day: 30, label: 'SYSTEM STABILIZED', target: 'Repeatable weekly client acquisition', status: 'system' },
    { day: 60, label: 'TEAM OR AUTOMATION', target: 'First hire or automation in place', status: 'scale' },
    { day: 90, label: '2X OR NEW CHANNEL', target: 'Double revenue or add a new channel', status: 'growth' },
  ];
}

// ── Metrics tracker template ──────────────────────────────────────────────────
function buildMetricsTracker(kpis, channels) {
  return {
    daily: [
      { metric: 'Leads captured', target: kpis.dailyLeads, type: 'number' },
      { metric: 'Outreach touches sent', target: kpis.outreachPerDay, type: 'number' },
      { metric: 'Conversations started', target: Math.max(Math.ceil(kpis.dailyLeads * 0.3), 1), type: 'number' },
      { metric: 'Calls booked', target: Math.max(Math.ceil(kpis.dailyLeads * 0.1), 1), type: 'number' },
      { metric: 'Response time (hours)', target: '< 4h', type: 'benchmark' },
      { metric: 'Cost per lead', target: '< $' + kpis.estAdBudget / kpis.leadsNeeded, type: 'currency' },
    ],
    weekly: [
      { metric: 'Total leads', target: kpis.dailyLeads * 7, type: 'number' },
      { metric: 'Calls completed', target: Math.max(Math.ceil(kpis.dailyLeads * 0.7), 1), type: 'number' },
      { metric: 'Clients closed', target: Math.max(Math.ceil(kpis.clientsNeeded / 3), 1), type: 'number' },
      { metric: 'Revenue', target: kpis.monthlyGoal / 3, type: 'currency' },
      { metric: 'Best channel (CPL)', target: 'Identify & document', type: 'qualitative' },
      { metric: 'Conversion rate', target: kpis.closeRate + '%+', type: 'percentage' },
    ],
    monthly: [
      { metric: 'Total revenue', target: kpis.monthlyGoal, type: 'currency' },
      { metric: 'Clients closed', target: kpis.clientsNeeded, type: 'number' },
      { metric: 'Total leads', target: kpis.leadsNeeded, type: 'number' },
      { metric: 'Cost per acquisition', target: '< $' + Math.round(kpis.estAdBudget / kpis.clientsNeeded), type: 'currency' },
      { metric: 'ROI', target: '> 3:1', type: 'ratio' },
    ],
  };
}

// ── Content calendar template ─────────────────────────────────────────────────
function buildContentCalendar(input, channels) {
  const biz = esc(input.businessName) || 'your business';
  const aud = esc(input.audience) || 'your audience';
  const week = [
    { day: 'MONDAY', focus: 'EDUCATION', task: `Share one lesson or insight that helps ${aud} avoid a common mistake`, channel: channels[0] || 'email' },
    { day: 'TUESDAY', focus: 'PROOF', task: 'Post a result, testimonial, or case study snippet', channel: channels[0] || 'email' },
    { day: 'WEDNESDAY', focus: 'STORY', task: `Personal story or behind-the-scenes from ${biz}`, channel: channels[1] || channels[0] || 'email' },
    { day: 'THURSDAY', focus: 'ENGAGEMENT', task: 'Ask a question, run a poll, or start a discussion in your ICP community', channel: channels[1] || channels[0] || 'email' },
    { day: 'FRIDAY', focus: 'OFFER', task: 'Soft CTA post: share your lead magnet or booking link with context', channel: channels[0] || 'email' },
    { day: 'SATURDAY', focus: 'BATCH', task: 'Create next week\'s content in one 2-hour session', channel: 'internal' },
    { day: 'SUNDAY', focus: 'REST', task: 'Review metrics, plan the week, rest', channel: 'internal' },
  ];
  return week;
}

// ── 90-day extension plan ─────────────────────────────────────────────────────
function buildNinetyDayExtension(kpis, channels, nicheKey) {
  const ch = channels.join(' + ').toUpperCase() || 'OUTREACH + EMAIL';
  return [
    {
      phase: 'DAYS 22–45', title: 'STABILIZE & SYSTEMIZE',
      focus: 'Turn your working 21-day playbook into a repeatable weekly system',
      tasks: [
        'Document the exact weekly routine that produced your first clients',
        'Template every repeatable action: outreach messages, follow-ups, call scripts',
        'Set up weekly metrics review (every Sunday: what worked, what didn\'t, what changes)',
        `Increase daily targets by 20%: ${Math.ceil(kpis.dailyLeads * 1.2)} leads/day, ${Math.ceil(kpis.outreachPerDay * 1.2)} touches/day`,
        'Build a simple CRM pipeline: Lead → Conversation → Call → Proposal → Close',
        'Start tracking LTV (lifetime value) of every closed client',
      ],
      milestone: 'Stable weekly client acquisition — no more "feast or famine"',
    },
    {
      phase: 'DAYS 46–70', title: 'DELEGATE & DEEPEN',
      focus: 'Free yourself from low-leverage tasks and deepen your competitive moat',
      tasks: [
        'Identify the 3 most time-consuming tasks that don\'t require your expertise',
        'Hire a VA or use automation for: list building, initial outreach, scheduling, reporting',
        `Add ONE new channel to your mix (current: ${ch}) — pick from your unused options`,
        'Create a referral system: ask every closed client for 2 introductions within 7 days of delivery',
        'Develop a case study from your best client result — use it in all marketing',
        'Raise prices 15-25% for new clients (you now have proof and demand)',
      ],
      milestone: 'First hire or automation live + 2nd channel producing leads',
    },
    {
      phase: 'DAYS 71–90', title: 'SCALE & DIVERSIFY',
      focus: 'Double down on what works and build a moat competitors can\'t copy',
      tasks: [
        `Target: 2x your Day 21 revenue — $${(kpis.monthlyGoal * 2).toLocaleString('en-US')}/month`,
        'Build a content engine: 1 pillar piece/week repurposed into 5-7 micro pieces',
        'Launch a community or group program (even small: 5-10 members) for recurring revenue',
        'Create an ascension model: entry offer → core offer → premium/done-for-you',
        'Systematize your unique process into a named methodology (makes you hard to compare)',
        'Plan your next 90 days: what would 3x look like? What needs to change?',
      ],
      milestone: '2x revenue + recurring revenue component + team or automation in place',
    },
  ];
}

// ── Offer strategy ────────────────────────────────────────────────────────────
function buildOfferStrategy(input, kpis) {
  const price = Number(input.pricePoint) || 500;
  const tier = Object.values(OFFER_TIERS).find((t) => price >= t.range[0] && price <= t.range[1]) || OFFER_TIERS.mid;
  const biz = esc(input.businessName) || 'your business';
  const offer = esc(input.offer) || 'your offer';

  const tiers = [
    { name: 'STARTER', price: Math.round(price * 0.5), desc: 'Self-serve or lite version — lower barrier to entry', best: 'For prospects who aren\'t ready for the full investment' },
    { name: 'CORE', price, desc: `Your main offer: ${offer}`, best: 'For ready-to-buy ICP matches' },
    { name: 'PREMIUM', price: Math.round(price * 2), desc: 'Done-for-you, priority, or expanded scope version', best: 'For high-intent clients who want maximum results' },
  ];

  return {
    currentTier: tier.label,
    strategy: tier.strategy,
    pricingTiers: tiers,
    positioning: `At $${price}/client, you need ${kpis.clientsNeeded} clients to hit $${kpis.monthlyGoal.toLocaleString('en-US')}/month. With a 3-tier model, you can hit the same revenue with fewer clients if 30% choose Premium.`,
    tips: [
      `Never quote just one price — always offer 3 tiers. 40%+ will choose the middle or top.`,
      `Anchor high: show the Premium price first, then the Core. The Core looks reasonable by comparison.`,
      `Add a guarantee only if you can deliver: "Results in 30 days or your money back" doubles conversion for high-ticket.`,
      `Bundle, don't discount: add bonuses instead of lowering price. Perceived value stays high.`,
    ],
  };
}

// ── Channel strategy deep dive ────────────────────────────────────────────────
function buildChannelStrategy(channels) {
  return channels.filter((c) => CHANNEL_DEEP_DIVE[c]).map((c) => ({
    channel: c.toUpperCase(),
    ...CHANNEL_DEEP_DIVE[c],
  }));
}

// ── Competitor playbook ───────────────────────────────────────────────────────
function buildCompetitorPlaybook(nicheKey, input) {
  const comp = COMPETITORS[nicheKey] || COMPETITORS.other;
  const biz = esc(input.businessName) || 'your business';
  return {
    landscape: comp.typical,
    theirWeakness: comp.weakness,
    yourEdge: comp.edge,
    avoidTrap: comp.avoid,
    battlePlan: [
      `Audit 3 competitors: visit their site, read their reviews, note their pricing and positioning`,
      `Find the gap they're not filling: ${comp.weakness.toLowerCase().split(',')[0]}`,
      `Make that gap your #1 marketing message: "${comp.edge}"`,
      `Create a comparison page/resource: "How ${biz} is different from [typical solution]"`,
      `Get your first 3 clients to publicly compare you favorably — reviews, testimonials, case studies`,
      `Don't mention competitors by name in ads — instead, describe the category and position against it`,
    ],
  };
}

// ── Main entry ───────────────────────────────────────────────────────────────
function generatePlan(input) {
  const nicheKey = NICHES[input.niche] ? input.niche : 'other';
  const niche = NICHES[nicheKey];
  const icp = ICP[nicheKey];
  const kpis = buildKpis(input, niche);

  return {
    business: {
      name: esc(input.businessName),
      website: esc(input.website),
      nicheKey,
      nicheLabel: niche.label,
      audience: esc(input.audience),
      offer: esc(input.offer),
      tone: input.tone || 'professional',
      challenge: esc(input.challenge),
    },
    positioning: `${esc(input.businessName) || 'We'} help ${esc(input.audience) || 'ambitious businesses'} get ${kpis.clientsNeeded}+ new clients per month with ${esc(input.offer) || 'a proven system'} — without ${(icp.pains[0] || 'the usual guesswork').toLowerCase()}.`,
    icp: { pains: icp.pains, hangouts: icp.hangouts, triggers: icp.triggers },
    kpis,
    leadMagnets: LEAD_MAGNETS[nicheKey] || LEAD_MAGNETS.other,
    days: buildPlan({ ...input, niche: nicheKey }, kpis),
    emails: buildEmails({ ...input, niche: nicheKey }, kpis),
    ads: buildAds({ ...input, niche: nicheKey }, kpis),
    weeklySummary: buildWeeklySummary(kpis, input.channels || ['email']),
    milestones: buildMilestones(kpis),
    metricsTracker: buildMetricsTracker(kpis, input.channels || ['email']),
    contentCalendar: buildContentCalendar(input, input.channels || ['email']),
    ninetyDay: buildNinetyDayExtension(kpis, input.channels || ['email'], nicheKey),
    offerStrategy: buildOfferStrategy(input, kpis),
    channelStrategy: buildChannelStrategy(input.channels || ['email']),
    competitor: buildCompetitorPlaybook(nicheKey, input),
    risks: RISK_MITIGATION,
  };
}

module.exports = { generatePlan, NICHES };
