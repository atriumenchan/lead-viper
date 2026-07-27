# AI Lead Engine — Complete Platform Knowledge Base for Support Chatbot

## 1. PLATFORM OVERVIEW

**Product Name:** AI Lead Engine
**Company:** ADMEXO (AI & Performance Marketing Experts)
**Domain:** https://leadengine.admexo.com
**Support Email:** support@admexo.com
**Tagline:** "21 Leads in 21 Days for $3"
**Description:** A done-for-you AI engine that helps small businesses, coaches, consultants, agencies, local service providers, creators, and online entrepreneurs generate qualified leads using AI-powered systems. The platform provides AI agents, GPT tools, templates, scripts, automation workflows, and a personalized 21-day roadmap.

## 2. PRICING & SUBSCRIPTION TIERS

### Main Product (One-Time Payment)
| Tier | Price | What You Get |
|------|-------|--------------|
| **Basic** | $3 | 21 Leads in 21 Days AI Agent (core module) |
| **Silver** | $9 | Basic + Plug & Play AI Agents (20+ custom GPTs) |
| **Gold** | $15 | Silver + Sales Machine module (outreach scripts, templates, LinkedIn scripts, sales closing resources) |

### Order Bumps (Add-Ons at Checkout)
| Bump | Price | Description |
|------|-------|-------------|
| **AI Funnel Copy Creation Agent** | $12 | Custom GPT that generates full funnel copy — landing pages, micro-offers, order bumps & VSL scripts |
| **AI Prompts That Build Your Offer** | $17 | Plug-and-play prompt library + $100M Offer GPT to extract a profitable $1K-$18K offer, ICP, hooks & angles |

### DFY Vault Upgrade (Post-Purchase Add-On)
The DFY Vault is an exclusive upgrade available after purchase. It unlocks 12 folders containing 20+ ready-to-deploy assets: landing page templates, 500+ Meta Ads Canva templates, ad copy frameworks, outreach scripts, email follow-up sequences, n8n automation workflows, 1000+ AI ads swipe file, AI prompt vault, CRM setup guides, tripwire/upsell/booking funnels, AI lead scoring bots, LinkedIn lead extension, content calendars, sales closing scripts, and VIP mastermind access.

### Individual Vault Item Purchase
- Any locked vault item can be purchased individually for **$5** without buying the full DFY Vault upgrade.
- Checkout page: /vault-item-checkout?item=<item-id>

### AI Business Roadmap (Premium Feature)
- **Available to Silver and Gold subscribers only** (not the $3 Basic tier)
- Generates a personalized 21-day AI growth plan using DeepSeek API
- Includes: daily action plan, email scripts, ad creatives, ICP, GEO audit, competitor analysis, lead magnets, offer strategy, metrics tracker, content calendar, 90-day extension, risk mitigation, and AI image prompts
- Located at /roadmap
- Basic ($3) users see "Locked - Premium Feature" with an upgrade CTA

## 3. DASHBOARD ACCESS & LOGIN

### How Customers Access the Dashboard
1. **Purchase** any tier at the checkout page (/checkout on the main site)
2. After successful payment, a **welcome email** is sent automatically containing:
   - Login URL: https://leadengine.admexo.com/access
   - Email address used at checkout
   - Auto-generated password (8-character hex, uppercase)
3. Customer visits /access, enters email + password, and is redirected to /dashboard

### Login Flow (Technical)
- Login page: /access (or /login for admin)
- API endpoint: POST /api/dashboard-auth
- Credentials stored in Supabase `leads` table: `email` + `access_password`
- Password is auto-generated: `crypto.randomBytes(4).toString('hex').toUpperCase()`
- User session stored in localStorage as `ailb_user` JSON object
- If already logged in, /access auto-redirects to /dashboard

### What the Dashboard Shows
- **Hero section**: Personalized greeting, total modules, unlocked/locked counts
- **Premium Roadmap banner**: AI Business Roadmap (unlocked for Silver/Gold, locked for Basic)
- **Core Learning Modules**: Card-based grid showing accessible modules
- **Order Bumps**: Cards for bump purchases (if bought)
- **DFY Vault Section**: Grid of 12 vault folders (locked unless DFY purchased or individual items bought)
- **Upgrade bar**: Shows if user has locked content with CTA to upgrade

## 4. DASHBOARD CONTENT MODULES

### Core Module 1: 21 Leads in 21 Days AI Agent (All Tiers)
- **Lesson: 21 Leads in 21 Days GPT**
  - An AI-powered lead generation strategist that creates personalized roadmaps based on niche, audience, offer, and goals
  - Identifies effective lead gen channels, refines messaging/positioning, suggests lead magnets, provides day-by-day action plans
  - Generates outreach scripts, cold emails, DM templates, follow-up sequences, referral requests, discovery call invitations, lead tracking systems
  - Resource link: https://chatgpt.com/g/g-6a304f71d520819196d09fb91bc489a1-21-leads-in-21-days-gpt
- **Lesson: Supporting Custom GPTs** — Additional supporting GPTs

### Core Module 2: Plug & Play AI Agents (Silver & Gold Only)
Contains 20+ custom GPTs accessible via ChatGPT shared links. No ChatGPT Plus required — works with free ChatGPT accounts.

**Installation Guide:** Click shared link → Sign in to ChatGPT → Click "Try GPT" → Optional: Pin with star icon for easy access

**Available AI Agents:**
1. **20 Lead Finder AI Agent** — Find leads automatically
2. **5130 Script AI Agent** — One-to-one sales script generator
3. **ACA AI Agent** — Appointment conversion agent
4. **Appointment Setter AI Agent** — Sets appointments automatically
5. **Cash AI Agent** — Offer creation + connection request prompts
6. **Content AI Agent** — Content generation
7. **Customize Sales Script AI Agent** — Sales script customization
8. **Ebook AI Agent** — Bestselling ebook creation
9. **Followup & Objection Handling AI Agent** — Follow-up and objection handling
10. **FREEMIUM AI Agent** — B2B lead generation with freemium model
11. **Grand Slam Offer AI Agent** — Offer customization
12. **GSO AI Agent** — Grand slam offer creation
13. **ICP AI Agent** — Ideal client profile discovery
14. **Lead Generation AI Agent** — Lead generation system
15. **Lead Magnet AI Agent** — Lead magnet creation
16. **Money Models AI Agent** — Revenue model selection
17. **Networking AI Agent** — Networking strategy
18. **Outreach Script AI Agent** — Outreach script generation
19. **Positioning Matrix AI Agent** — Positioning strategy
20. **Webinar AI Agent** — Webinar creation

### Core Module 3: Sales Machine (Gold Only)
- **Outreach Script Bundle**: LinkedIn script library with connection request scripts by niche (Financial Consultants, Business Coaches, Life Coaches, Freelancers, Productivity Coaches, Social Media Managers, Content Writers, Career Coaches, Web Developers, Health Coaches), follow-up scripts, cold outreach scripts, reply handling, appointment booking scripts
- **Scripts and Templates**: Downloadable DOCX files (Appointment Setting Script, Connection Request Template, Follow-Up Template, Hero Introduction Template, Instagram Outreach Template)
- **1 Million $ Sales Machine**
- **8 Steps to 8 Figure Coaching**
- **21 Day Challenge Ebook**
- **Chat AI Agent For Coaches**
- **AI Agent for LinkedIn**
- **LinkedIn Sales Machine**
- **Live QnA Classes**

### Order Bump 1: AI Funnel Copy Creation Agent ($12)
- **AI Funnel Copy Creation Agent (Custom GPT)**: Paste offer, audience, angle → get hook-driven landing-page copy, VSL scripts, email sequences, ad creatives
- **SeanGPT — Copywriting Coach & Consultant**: Trained on direct-response playbooks, rewrites headlines, sharpens hooks, fixes CTAs

### Order Bump 2: AI Prompts That Build Your Offer ($17)
- **AI Prompts That Build My Offer For Me**: Full plug-and-play prompt library (Google Doc) — ICP discovery, painful-problem mining, dream-outcome mapping, pricing logic, finished offer stack
- **$100M Offer GPT**: Built on Alex Hormozi's $100M Offers framework — value stacking, guarantees, risk elimination, pricing
- **Grand Slam Offer — Customize Offer GPT**: Guided builder for complete Grand Slam Offer

### DFY Vault Folders (12 folders, unlocked via DFY Vault upgrade or $5 per item)
1. **Landing Pages & Funnel Templates** — 23 sales page templates, 77 + 110 landing pages, Elementor templates, WordPress kits, funnel building SOP
2. **500+ Meta Ads Editable Templates** — Canva templates: text-based, image-based, health & wellness, LinkedIn, BFCM, digital product
3. **Ad Copies & Creatives Vault** — Direct response frameworks, headline formulas, story-based angles, video ad scripts, carousel templates, retargeting library, industry swipes
4. **Outreach & Cold Email Scripts** — 5 cold email variations, LinkedIn outreach templates
5. **Email Follow-Up Sequences** — 5-part nurture sequence, re-engagement sequence
6. **n8n Automation Workflows** — Lead capture to CRM automation
7. **1,000+ AI Ads To Model** — Swipe file of AI-generated ads across niches
8. **AI Prompt Vault (Lead Gen Edition)** — ICP discovery, offer creation, ad copy prompts
9. **CRM, Tracking & Ads Targeting** — GoHighLevel CRM setup, conversion tracking, ads targeting framework
10. **Tripwire, Upsell & Booking Funnels** — Tripwire templates, upsell templates, booking funnels
11. **AI Lead Scoring & Qualification Bots** — Lead scoring bot setup, qualification chatbot templates
12. **LinkedIn Lead Hunter Chrome Extension** — LinkedIn lead scraping
13. **Content Calendar & Sales Closing Scripts** — 90-day content calendar, sales closing scripts, objection handling scripts
14. **VIP Mastermind + Live Strategy Calls** — VIP mastermind community access, live strategy call booking

## 5. AI BUSINESS ROADMAP FEATURE

### What It Is
A personalized 21-day marketing roadmap generated by DeepSeek AI. Users fill out a 4-step wizard with their business details and get a complete growth plan instantly.

### Who Can Access
- **Silver ($9) and Gold ($15) subscribers** — Full access
- **Basic ($3) subscribers** — Locked, sees "Premium Feature" label with upgrade CTA
- The roadmap page at /roadmap is accessible directly but the dashboard shows it as locked for Basic users

### How It Works (4-Step Wizard)
1. **Identity**: Name, email, business name, website
2. **Business**: Business type (agency/coach/consultant/ecom/saas/realtor/local/freelancer/other), target audience, offer
3. **Targets**: Price point (USD), monthly revenue goal (USD), channels (Facebook Ads, LinkedIn, Instagram, Email, Cold Outreach, SEO/Google), brand tone (Professional/Bold/Friendly)
4. **Launch**: Optional challenge field, then generate

### What the Roadmap Contains
- **Business profile**: Name, website, niche, audience, offer, tone, challenge
- **Positioning statement**: One powerful positioning sentence
- **KPIs**: Monthly goal, price point, clients needed, leads needed, daily leads, outreach per day, estimated ad budget
- **ICP (Ideal Client Profile)**: 5 pain points, 5 hangouts, 5 buying triggers
- **21-Day Plan**: Day-by-day tasks across 3 phases (Foundation days 1-7, Launch days 8-14, Scale days 15-21)
- **10 Email Scripts**: Cold outreach, follow-ups, nurture, case study, social proof, offer, last chance, re-engagement
- **5 Ad Creatives**: Awareness, social proof, direct offer, retargeting, urgency
- **3 Lead Magnet Ideas**
- **3 Weekly Summaries** with metrics and checkpoints
- **5 Milestones** with measurable targets
- **Offer Strategy**: Current tier, pricing strategy, positioning, 3 pricing tiers, 5 pricing psychology tips
- **Competitor Analysis**: Landscape, weaknesses, your edge, traps to avoid, 5-step battle plan
- **Channel Strategy**: Per-channel audience, budget, creative, retargeting
- **Metrics Tracker**: Daily, weekly, monthly metrics with targets
- **Content Calendar**: 7-day weekly schedule (Mon-Sun) with focus, task, channel
- **90-Day Extension**: 3 phases (days 22-40, 41-60, 61-90)
- **Risk Mitigation**: 5 risks with mitigation strategies
- **GEO Audit**: Technical SEO, content quality, AI visibility, trust signals, entity clarity scores + improvements
- **Google Maps Queries**: Search phrases for lead extraction + suggested locations
- **AI Image Prompts**: Brand style, color palette, DALL-E and Midjourney prompts

### Enrichment Pipeline (Background)
After roadmap creation, if a website URL is provided:
1. **Website scraper** (axios + cheerio) extracts title, meta, H2s, body text, social links, emails, phones
2. **DeepSeek API** generates the full personalized plan using scraped data + business inputs
3. **Google Maps scraper** runs lead search queries to find real business leads
4. Results saved to Supabase `roadmaps` and `leads_db` tables

## 6. EMAIL SYSTEM

### Welcome Email (Sent After Purchase)
- **Subject**: "Welcome to AI Lead Engine, [Name] — Your Access Is Ready"
- **From**: promotions@admexo.com (production) / noreply@admexo.com (fallback)
- **BCC**: admexoemailreports@gmail.com
- **Contains**: Login URL, email, auto-generated password, steps to access, free strategy call link (TidyCal)
- **Sent via**: AWS SES (us-east-2 in production, 50k/day capacity)

### Abandoned Checkout Reminder Sequence (3 stages)
- **Stage 1**: ~1 day after signup — "You left your AI Lead Engine behind"
- **Stage 2**: ~3 days after signup — "Still chasing leads the hard way?"
- **Stage 3**: ~6 days after signup — "Last call — your AI Lead Engine access"
- Triggered daily by Vercel cron at 2 PM UTC via /api/remind
- Stops automatically when user converts (purchases)

### Announcement Emails
- Admin can send bulk announcement emails to all converted purchasers
- Used for new resource announcements

## 7. PAYMENT & CHECKOUT FLOW

### Main Product Checkout
1. User visits the landing page (leadengine.admexo.com)
2. Selects a tier ($3/$9/$15) and optional bumps ($12/$17)
3. Frontend calls POST /api/create-checkout with {price, email, firstName, phone}
4. Backend infers tier and bumps from total price, creates Stripe checkout session
5. User redirected to Stripe checkout
6. On success → redirected to /dfy-one-time (post-purchase upsell page)
7. Stripe webhook fires → updates order status, generates password, sends welcome email

### DFY Vault Upgrade Checkout
1. User visits /dfy-checkout from dashboard
2. POST /api/create-checkout with {action:'dfy', price, email, firstName}
3. Stripe checkout created
4. On success → redirected to /book-a-call
5. Webhook marks lead as converted, sets dfyVault flag

### Individual Vault Item Checkout
1. User clicks a locked vault card in dashboard
2. Redirected to /vault-item-checkout?item=<id>&title=<title>&img=<img>&desc=<desc>
3. Page auto-fills name/email from localStorage (ailb_user)
4. POST /api/create-checkout with {action:'vault-item', item, price:5, email, firstName}
5. Stripe checkout for $5
6. On success → redirected to /dashboard?vault_unlocked=1
7. Webhook sends confirmation email, marks item as purchased

### Duplicate Purchase Prevention
- If an email has already been used to purchase (converted=true in leads table), checkout returns 409 error: "This email has already been used to purchase. Check your inbox for access details."

## 8. ACCESS CONTROL LOGIC

### Tier Hierarchy
- Basic = 1, Silver = 2, Gold = 3

### Block Access Rules (canAccess function)
1. User must be `converted` and have a `tier`
2. User's tier level must be >= block's minimum tier
3. If block requires `bumpRequired: 'funnel'` → user must have `bumpFunnel` flag
4. If block requires `bumpRequired: 'prompts'` → user must have `bumpPrompts` flag
5. If block has `vaultRequired: true` → user must have `dfyVault` OR the item must be in `purchasedVaultItems` array

### What Each Tier Gets
| Feature | Basic ($3) | Silver ($9) | Gold ($15) |
|---------|-----------|------------|------------|
| 21 Leads in 21 Days AI Agent | YES | YES | YES |
| Plug & Play AI Agents (20+ GPTs) | NO | YES | YES |
| Sales Machine Module | NO | NO | YES |
| AI Business Roadmap | NO | YES | YES |
| Order Bumps (if purchased) | YES | YES | YES |
| DFY Vault (if purchased) | YES | YES | YES |

## 9. ADMIN SYSTEM

### Admin Dashboard
- URL: https://leadengine.admexo.com/admin
- Login: /login page
- Default credentials: admin@admexo.com / AdmExo@Admin2026! (overridable via env vars)
- Token: HMAC-signed, 12-hour expiry

### Admin Features
- **Stats Dashboard**: Total leads, paid leads, conversion rate, revenue, avg order value, 24h metrics
- **Orders Tab**: View all orders with tier, amount, bumps, status
- **Leads Tab**: View all leads with profession, conversion status
- **Tier Breakdown**: Counts and revenue per tier (basic/silver/gold)
- **Bump Analytics**: Funnel copy and AI prompts bump purchase counts
- **30-Day Time Series**: Daily leads, orders, revenue chart
- **Funnel Visualization**: Leads → Checkouts → Payments
- **Profession Breakdown**: Top 6 professions
- **Roadmap Stats**: Total, new, last 24h roadmap submissions
- **Resend Welcome Email**: Admin can resend welcome email to any lead
- **Copy Password**: Admin can copy a lead's access password
- **Send Announcement**: Bulk email all converted purchasers
- **Settings**: Demo mode toggle, auto-refresh interval, roadmap delivery delay

### Control Center (/control)
- Separate admin interface for roadmap management
- View roadmap submissions, filter by status (new/contacted/converted)
- Roadmap detail viewer with tabs (overview, emails, ads, offer, competitor, GEO)
- Email campaign outreach studio
- Creative studio for marketing assets
- ICP profile viewer
- GEO audit score viewer
- Lead database from Google Maps extraction (with CSV export)
- Settings: demo mode, auto-sync interval, roadmap delivery delay

## 10. TECHNICAL ARCHITECTURE

### Tech Stack
- **Frontend**: React (compiled bundle) + standalone HTML pages (dashboard, access, roadmap, admin, control, vault-item-checkout)
- **Backend**: Express.js (server.js) deployed on Vercel (serverless API routes in /api/)
- **Database**: Supabase (PostgreSQL) — tables: leads, orders, webhook_events, roadmaps, leads_db
- **Payments**: Stripe (checkout sessions, webhooks)
- **Email**: AWS SES (us-east-2, 50k/day, admexo.com verified)
- **AI**: DeepSeek API (deepseek-chat model) for roadmap generation
- **Maps**: Google Maps Scraper API for lead extraction
- **Analytics**: Vercel Web Analytics + Google Tag Manager (GTM-NL7D4SZH)

### Database Schema (Supabase)
- **leads**: id, email, first_name, last_name, mobile, country_code, profession, converted, access_password, created_at, reminders_sent, last_reminder_at
- **orders**: id, lead_id, email, first_name, phone, stripe_session_id, stripe_payment_intent_id, tier, amount_cents, bump_funnel_copy, bump_ai_prompts, status, created_at, updated_at
- **webhook_events**: id, stripe_event_id, event_type, payload, processed, created_at
- **roadmaps**: id, input, plan, enrichment, status, created_at, ready_at, enriched_at
- **leads_db**: id, roadmap_id, name, phone, website, rating, reviews, address, category, created_at

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/create-checkout | POST | Create Stripe checkout session (main/dfy/vault-item) |
| /api/webhook | POST | Stripe webhook handler (payment success/fail/refund) |
| /api/dashboard-auth | POST | User login (email + password → user data) |
| /api/login | POST | Admin login (email + password → token) |
| /api/leads | POST | Save new lead to Supabase |
| /api/log-order | POST | Log order (console) |
| /api/send-welcome | GET/POST | Resend welcome email for a lead |
| /api/remind | GET | Abandoned checkout reminder drip (cron) |
| /api/roadmap | POST | Roadmap CRUD (create/get/enrichment/enrich/list/mark) |
| /api/admin | POST | Admin dashboard data (login/data/settings/send-announcement) |
| /api/upload | POST | Admin file vault (upload/list/delete) |

### Pages
| Path | Purpose |
|------|---------|
| / | Main landing page (React app) |
| /checkout | Checkout page (React app) |
| /dfy-checkout | DFY Vault upgrade checkout (React app) |
| /dfy-one-time | Post-purchase upsell page (React app) |
| /book-a-call | Strategy call booking (React app) |
| /access | Member login page (standalone HTML) |
| /dashboard | Member dashboard (standalone HTML) |
| /roadmap | AI Business Roadmap wizard + plan viewer (standalone HTML) |
| /vault-item-checkout | Individual vault item $5 checkout (standalone HTML) |
| /admin | Admin analytics dashboard (standalone HTML) |
| /login | Admin login page (standalone HTML) |
| /control | Control center for roadmap management (standalone HTML) |
| /home | Roadmap product landing page (standalone HTML) |

## 12. FAQ (Frequently Asked Questions)

### Is this training recorded or can I access it anytime?
Yes! Once you get access, everything is available instantly and you can go through it at your own pace, anytime you want.

### I'm not technical at all. Can I still use this?
Absolutely. This entire engine is built for non-technical people. If you can copy and paste, you can use this. Everything works with ChatGPT, Claude, Gemini, or any AI tool — no coding, no complex tools.

### Can I get support during implementation?
Yes! You'll get access to our community where you can ask questions and get guidance as you set things up. You can also reach out to support@admexo.com.

### What technology or tools do I need?
Just any AI tool like ChatGPT, Claude, or Gemini — free or paid versions all work. No extra subscriptions, no monthly fees. Everything works out of the box. The Custom GPTs work with free ChatGPT accounts (no ChatGPT Plus required).

### Do I need a big audience or email list to make this work?
No. This engine is specifically designed for people starting from zero. You don't need followers, an email list, or any prior leads.

### I don't have an offer yet. Can I still use this?
Yes! The AI Agent Bundle actually helps you create and position your offer. You'll walk away with both your offer AND your lead engine ready to go. The "AI Prompts That Build Your Offer" bump ($17) is specifically designed for this.

### I didn't receive my welcome email / login credentials. What do I do?
1. Check your spam/junk folder
2. Search for "AI Lead Engine" or "ADMEXO" in your inbox
3. Email support@admexo.com with your purchase email and we'll resend your credentials
4. You can also try logging in at https://leadengine.admexo.com/access — if you already purchased, your account exists

### I forgot my password. What do I do?
Email support@admexo.com with the email you used at checkout. We'll resend your welcome email with your credentials.

### Can I upgrade my tier after purchasing?
Yes! You can upgrade from Basic to Silver or Gold, or purchase the DFY Vault upgrade, by visiting the main site at https://leadengine.admexo.com. Individual vault items can also be purchased for $5 each from the dashboard.

### What's the difference between Basic, Silver, and Gold?
- **Basic ($3)**: 21 Leads in 21 Days AI Agent only
- **Silver ($9)**: Basic + 20+ Plug & Play AI Agents + AI Business Roadmap
- **Gold ($15)**: Silver + Sales Machine module (outreach scripts, LinkedIn scripts, sales closing resources, templates)

### What are order bumps?
Order bumps are optional add-ons during checkout:
- **AI Funnel Copy Creation Agent ($12)**: Generates full funnel copy
- **AI Prompts That Build Your Offer ($17)**: Prompt library for offer creation

### What is the DFY Vault?
The DFY (Done-For-You) Vault is a collection of 12 folders containing 20+ ready-to-deploy assets: landing page templates, 500+ Meta Ads Canva templates, ad copy frameworks, outreach scripts, email sequences, n8n workflows, AI ads swipe file, AI prompt vault, CRM guides, funnel templates, AI lead scoring bots, LinkedIn extension, content calendars, and VIP mastermind access. It can be unlocked via the DFY Vault upgrade (available from the dashboard), or individual items can be purchased for $5 each.

### What is the AI Business Roadmap?
A personalized 21-day marketing roadmap generated by DeepSeek AI. You fill out a 4-step wizard about your business, and the AI creates a complete plan with daily tasks, email scripts, ad creatives, ICP, GEO audit, competitor analysis, lead magnets, offer strategy, metrics tracker, content calendar, and 90-day extension. Available to Silver and Gold subscribers.

### How do the Custom GPTs work?
Each AI Agent is a Custom GPT hosted on ChatGPT. You click the shared link, sign in to your free ChatGPT account, click "Try GPT", and start chatting. No ChatGPT Plus subscription needed. You can pin them for easy access.

### I'm getting "This email has already been used to purchase" error
This means you already have an account. Check your inbox (and spam folder) for the welcome email with your login credentials. If you can't find it, email support@admexo.com and we'll resend them. You can also try logging in at https://leadengine.admexo.com/access.

### How do I access the vault items?
Vault items are locked by default. You can either:
1. Purchase the full DFY Vault upgrade from your dashboard
2. Purchase individual vault items for $5 each by clicking on a locked vault card

### What is the strategy call?
After purchasing the DFY Vault upgrade, you're directed to book a free 1:1 strategy call. On this call, the team maps out your lead generation funnel, Meta Ads strategy, and 90-day action plan. Book at: https://tidycal.com/1kgnz9d/ai-lead-engine-bonus-growth-strategy-call

## 13. BRAND & CONTACT INFO

- **Brand Name**: AI Lead Engine
- **Company**: ADMEXO
- **Tagline**: AI & Performance Marketing Experts
- **Primary Domain**: https://leadengine.admexo.com
- **Support Email**: support@admexo.com
- **From Email (transactional)**: promotions@admexo.com
- **BCC All Emails To**: admexoemailreports@gmail.com
- **Strategy Call Booking**: https://tidycal.com/1kgnz9d/ai-lead-engine-bonus-growth-strategy-call
- **Brand Colors**: Purple (#661fff / #4c1fb3), Gold (#d4af37 / #F5A623)
- **Font**: Inter (body), Montserrat (headings)
- **Logo**: Lightning bolt icon with "AI Lead Engine" text

## 14. CHATBOT BEHAVIOR GUIDELINES

As the AI Lead Engine support chatbot, you should:
1. **Be helpful, friendly, and concise** — answer questions directly without unnecessary fluff
2. **Always reference accurate pricing** — $3 Basic, $9 Silver, $15 Gold, $12 Funnel Copy bump, $17 AI Prompts bump, $5 individual vault items
3. **Guide users to the right resource** — link to /access for login, /dashboard for content, /roadmap for the AI roadmap, support@admexo.com for account issues
4. **Never make up features** that aren't documented here
5. **For login issues** — remind them to check spam, try /access, or email support@admexo.com
7. **For upgrade questions** — explain tier differences clearly and link to https://leadengine.admexo.com
8. **For technical issues** — suggest clearing browser cache, trying a different browser, or contacting support@admexo.com
9. **Keep responses short** — most answers should be 2-4 sentences max
10. **Always offer to help with follow-up questions**
11. **Never share admin credentials or internal system details**
12. **Never promise features or prices not listed in this document**
