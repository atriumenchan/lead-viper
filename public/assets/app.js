'use strict';
/* AI Lead Engine — Control Center frontend */

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const API = '/api/admin';
const REFRESH_MS = 30000;

let token = sessionStorage.getItem('cc_token') || localStorage.getItem('admin_token') || null;
let refreshTimer = null;
let latest = null;
let submissions = [];
let refreshMs = REFRESH_MS;
let activeDetailId = null;
let activeDetailPlan = null;
let activeDetailTab = 'overview';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         d.toTimeString().slice(0, 5);
};

async function api(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

/* ── auth ────────────────────────────────────────────────────────── */
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('login-btn');
  btn.disabled = true; btn.textContent = 'AUTHENTICATING…';
  $('login-error').textContent = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('login-email').value,
        password: $('login-password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid credentials');
    token = data.token;
    sessionStorage.setItem('cc_token', data.token);
    localStorage.setItem('admin_token', data.token);
    enterDashboard();
  } catch (err) {
    $('login-error').textContent = '⚠ ACCESS DENIED — ' + err.message.toUpperCase();
  } finally {
    btn.disabled = false; btn.textContent = 'INITIATE SESSION';
  }
});

$('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('cc_token');
  localStorage.removeItem('admin_token');
  token = null;
  clearInterval(refreshTimer);
  // Clear cookie and redirect to login
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = '/login';
});

$('refresh-btn').addEventListener('click', () => loadData());

function enterDashboard() {
  $('login-screen').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  loadData();
  loadSubmissions();
  loadMission();
  loadEnrichment();
  startTimer();
}

function startTimer() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { loadData(); loadSubmissions(); }, refreshMs);
}

/* ── data load ───────────────────────────────────────────────────── */
async function loadData() {
  try {
    const data = await api({ action: 'data', token });
    latest = data;
    render(data);
  } catch (err) {
    if (err.status === 401) { $('logout-btn').click(); }
  }
}

/* ── render ──────────────────────────────────────────────────────── */
function render(data) {
  const badge = $('mode-badge');
  badge.textContent = data.mode === 'live' ? 'LIVE DATA' : data.mode === 'offline' ? 'OFFLINE' : 'DEMO MODE';
  badge.classList.toggle('live', data.mode === 'live');
  $('foot-mode').textContent = data.mode === 'live' ? 'LIVE DATA LINK' : data.mode === 'offline' ? 'OFFLINE — NO DATA SOURCE' : 'DEMO DATA (SEEDED)';
  if (data.settings) applySettings(data.settings);
}

/* ── settings ────────────────────────────────────────────────── */
function applySettings(s) {
  $('demo-toggle').classList.toggle('on', !!s.demoMode);
  $('refresh-select').value = String(s.autoRefreshSec || 30);
  if ([0, 5, 30, 60].includes(Number(s.roadmapDelayMin))) $('delay-select').value = String(s.roadmapDelayMin);
  const ms = (s.autoRefreshSec || 30) * 1000;
  if (ms !== refreshMs) { refreshMs = ms; startTimer(); }
  if (latest && latest.mode === 'offline') {
    $('settings-note').textContent = '⚠ DEMO OFF + NO SUPABASE CONFIGURED — SHOWING EMPTY LIVE STATE';
  } else if (latest && latest.mode === 'live') {
    $('settings-note').textContent = '● CONNECTED TO SUPABASE — DEMO SETTING IGNORED';
  } else {
    $('settings-note').textContent = '';
  }
}

$('demo-toggle').addEventListener('click', async () => {
  const next = !$('demo-toggle').classList.contains('on');
  $('demo-toggle').classList.toggle('on', next);
  try {
    await api({ action: 'set-settings', token, demoMode: next });
    loadData();
  } catch { /* revert on next sync */ }
});

$('refresh-select').addEventListener('change', async (e) => {
  try { await api({ action: 'set-settings', token, autoRefreshSec: Number(e.target.value) }); } catch {}
  refreshMs = Number(e.target.value) * 1000;
  startTimer();
});

$('delay-select').addEventListener('change', async (e) => {
  try { await api({ action: 'set-settings', token, roadmapDelayMin: Number(e.target.value) }); } catch {}
});

/* ── mission command panel (CTA → countdown → personalized) ───────── */
let missionTimer = null;

async function loadMission() {
  const id = localStorage.getItem('member_rm_id');
  if (!id) return renderMissionCta();
  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', id }),
    });
    const data = await res.json();
    if (!res.ok) { localStorage.removeItem('member_rm_id'); return renderMissionCta(); }
    if (data.pending) renderMissionCountdown(id, data.readyAt);
    else renderMissionReady(data.plan, id, data.readyAt);
  } catch {
    renderMissionCta();
  }
}

function renderMissionCta() {
  clearInterval(missionTimer);
  $('mission-body').innerHTML = `
    <div class="mission-cta">
      <div class="mission-cta-text">
        <h3>NO ACTIVE MISSION — THIS DECK IS RUNNING ON DEMO TELEMETRY</h3>
        <p>Answer 10 quick questions about your business and our engine + team will assemble a fully personalized 21-day plan: daily tasks, email scripts, ad creatives and exact lead targets.</p>
      </div>
      <a class="mission-cta-btn" href="/roadmap">
        <span class="mcb-big">⚡ GET YOUR 21-DAY ROADMAP READY</span>
        <span class="mcb-sub">FREE · TAKES 2 MINUTES · DELIVERED TO THIS DASHBOARD</span>
      </a>
    </div>`;
}

function renderMissionCountdown(id, readyAt) {
  clearInterval(missionTimer);
  $('mission-body').innerHTML = `
    <div class="mission-wait">
      <div class="mw-left">
        <h3>✈ ROADMAP IN PRODUCTION</h3>
        <p>Your submission is locked in. Our engine + team are assembling your personalized 21-day mission plan. This dashboard transforms automatically when the countdown hits zero.</p>
      </div>
      <div class="mw-timer" id="mission-countdown">--:--:--</div>
    </div>`;

  const tick = () => {
    const left = +new Date(readyAt) - Date.now();
    const el = $('mission-countdown');
    if (!el) { clearInterval(missionTimer); return; }
    if (left <= 0) {
      clearInterval(missionTimer);
      loadMission();
      return;
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  tick();
  missionTimer = setInterval(tick, 1000);
}

function renderMissionReady(plan, id, readyAt) {
  clearInterval(missionTimer);
  const DAY_MS = 86400000;
  const currentDay = Math.min(21, Math.max(1, Math.floor((Date.now() - +new Date(readyAt)) / DAY_MS) + 1));
  const today = plan.days[currentDay - 1];
  const doneKey = 'rm_done_' + id;
  const done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]'));
  const pct = Math.round((done.size / 21) * 100);
  const k = plan.kpis;

  const weekNum = currentDay <= 7 ? 1 : currentDay <= 14 ? 2 : 3;
  const weekInfo = (plan.weeklySummary || [])[weekNum - 1] || {};
  const weekDaysDone = [...done].filter((d) =>
    weekNum === 1 ? d <= 7 : weekNum === 2 ? d >= 8 && d <= 14 : d >= 15 && d <= 21
  ).length;
  const weekPct = Math.round((weekDaysDone / 7) * 100);

  const ms = plan.milestones || [];
  const nextMs = ms.find((m) => !done.has(m.day) && m.day >= currentDay) || ms[ms.length - 1];

  const phaseColor = today.phase === 'FOUNDATION' ? 'var(--cyan)' : today.phase === 'LAUNCH' ? 'var(--amber)' : 'var(--hud)';

  $('mission-body').innerHTML = `
    <div class="mission-ready">
      <div class="mr-status">
        <div class="mr-day" style="border-color:${phaseColor}"><b style="color:${phaseColor}">${String(currentDay).padStart(2, '0')}</b><small>DAY OF 21</small></div>
        <div class="mr-progress">
          <div class="fn-label"><span>MISSION PROGRESS · ${esc(plan.business.name || '').toUpperCase()}</span><b>${pct}%</b></div>
          <div class="fn-track"><div class="fn-fill" style="width:${pct}%"></div></div>
          <div class="mr-phase">PHASE: ${esc(today.phase)} · ${done.size}/21 DAYS COMPLETE</div>
          <div class="mr-week-bar">
            <div class="mr-week-label">WEEK ${weekNum} · ${esc(weekInfo.phase || '')} · ${weekPct}%</div>
            <div class="fn-track sm"><div class="fn-fill" style="width:${weekPct}%;background:${phaseColor}"></div></div>
          </div>
        </div>
      </div>
      <div class="mr-today">
        <h3>TODAY · ${esc(today.title).toUpperCase()}</h3>
        <ul>${today.tasks.map((t, i) => `
          <li><label><input type="checkbox" class="task-check" data-task="${i}" ${done.has(currentDay) ? 'checked' : ''} /> ${esc(t)}</label></li>`).join('')}</ul>
        <div class="day-target">◎ TARGET: ${esc(today.kpi)}</div>
        ${nextMs ? `<div class="mr-next-ms">⏭ NEXT MILESTONE · DAY ${nextMs.day}: ${esc(nextMs.label)}</div>` : ''}
      </div>
      <div class="mr-side">
        <div class="mr-kpis">
          <div><b>$${k.monthlyGoal.toLocaleString()}</b><small>GOAL</small></div>
          <div><b>${k.dailyLeads}/DAY</b><small>LEAD PACE</small></div>
          <div><b>${k.outreachPerDay}</b><small>TOUCHES/DAY</small></div>
        </div>
        <a class="tb-btn mr-open" href="/roadmap?id=${esc(id)}" target="_blank">OPEN FULL PLAN ↗</a>
        <button class="tb-btn" id="mission-complete-day">${done.has(currentDay) ? '✓ DAY ' + currentDay + ' COMPLETE' : 'MARK DAY ' + currentDay + ' DONE'}</button>
      </div>
    </div>`;

  $('mission-complete-day').addEventListener('click', () => {
    done.has(currentDay) ? done.delete(currentDay) : done.add(currentDay);
    localStorage.setItem(doneKey, JSON.stringify([...done]));
    renderMissionReady(plan, id, readyAt);
  });
}


/* ── enrichment tools (email campaign + creative studio + ICP + GEO + leads) ── */
let enrichmentPollTimer = null;

async function loadEnrichment() {
  const id = localStorage.getItem('member_rm_id');
  if (!id) return;
  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enrichment', id }),
    });
    const data = await res.json();
    if (!res.ok) return;

    if (data.status === 'processing') {
      renderProcessingState();
      if (!enrichmentPollTimer) {
        enrichmentPollTimer = setInterval(loadEnrichment, 5000);
      }
      return;
    }

    clearInterval(enrichmentPollTimer);
    enrichmentPollTimer = null;

    if (!data.enrichment) return;
    renderICP(data.enrichment);
    renderGEOAudit(data.enrichment);
    renderEmailCampaign(data.enrichment);
    renderCreativeStudio(data.enrichment);
    if (data.leads && data.leads.length > 0) renderLeadDatabase(data.leads);
  } catch { /* enrichment not available yet */ }
}

function renderProcessingState() {
  $('row-enrich').classList.remove('hidden');
  $('row-icpgeo').classList.remove('hidden');
  $('email-campaign-body').innerHTML = '<div class="enrich-placeholder"><div class="spinner"></div>AI is analyzing the website and generating your personalized plan…</div>';
  $('creative-body').innerHTML = '<div class="enrich-placeholder"><div class="spinner"></div>Generating marketing assets…</div>';
  $('icp-body').innerHTML = '<div class="enrich-placeholder"><div class="spinner"></div>Building Ideal Client Profile…</div>';
  $('geo-body').innerHTML = '<div class="enrich-placeholder"><div class="spinner"></div>Running GEO audit…</div>';
}

function renderICP(enrichment) {
  $('row-icpgeo').classList.remove('hidden');
  const icp = enrichment.icp;
  if (!icp) {
    $('icp-body').innerHTML = '<div class="enrich-placeholder">No ICP data available.</div>';
    return;
  }

  $('icp-body').innerHTML = `
    <div class="icp-card">
      <div class="icp-ideal"><b>IDEAL CLIENT:</b> ${esc(icp.idealClient || 'N/A')}</div>
      ${icp.demographics ? `
      <div class="icp-section">
        <div class="icp-label">DEMOGRAPHICS</div>
        <div class="icp-tags">${(icp.demographics.industries || []).map((i) => `<span class="icp-tag">${esc(i)}</span>`).join('')}</div>
        <div class="icp-meta">Size: ${esc(icp.demographics.companySize || 'N/A')} · Titles: ${(icp.demographics.jobTitles || []).join(', ')}</div>
        <div class="icp-meta">Locations: ${(icp.demographics.locations || []).join(', ')}</div>
      </div>` : ''}
      <div class="icp-section">
        <div class="icp-label">PAIN POINTS</div>
        <ul class="icp-list">${(icp.pains || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
      <div class="icp-section">
        <div class="icp-label">BUYING TRIGGERS</div>
        <ul class="icp-list">${(icp.triggers || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
      <div class="icp-section">
        <div class="icp-label">WHERE THEY HANGOUT</div>
        <div class="icp-tags">${(icp.hangouts || []).map((h) => `<span class="icp-tag icp-tag-hangout">${esc(h)}</span>`).join('')}</div>
      </div>
    </div>`;
}

function renderGEOAudit(enrichment) {
  $('row-icpgeo').classList.remove('hidden');
  const geo = enrichment.geoAudit;
  if (!geo) {
    $('geo-body').innerHTML = '<div class="enrich-placeholder">No GEO audit data available.</div>';
    return;
  }

  const scoreColor = geo.overallScore >= 70 ? 'var(--hud)' : geo.overallScore >= 40 ? 'var(--amber)' : 'var(--red)';
  const scoreLabel = geo.overallScore >= 70 ? 'GOOD' : geo.overallScore >= 40 ? 'NEEDS WORK' : 'CRITICAL';

  $('geo-body').innerHTML = `
    <div class="geo-card">
      <div class="geo-score-wrap">
        <div class="geo-score" style="color:${scoreColor}">${geo.overallScore || '?'}</div>
        <div class="geo-score-label" style="color:${scoreColor}">${scoreLabel}</div>
      </div>
      <div class="geo-scores">
        ${geo.scores ? Object.entries(geo.scores).map(([k, v]) => `
          <div class="geo-bar">
            <div class="geo-bar-label">${esc(k.replace(/([A-Z])/g, ' $1').toUpperCase())}</div>
            <div class="geo-bar-track"><div class="geo-bar-fill" style="width:${v}%;background:${v >= 70 ? 'var(--hud)' : v >= 40 ? 'var(--amber)' : 'var(--red)'}"></div></div>
            <div class="geo-bar-val">${v}</div>
          </div>`).join('') : ''}
      </div>
      <div class="geo-section">
        <div class="geo-label">STRENGTHS</div>
        <ul class="geo-list">${(geo.strengths || []).map((s) => `<li class="geo-good">${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="geo-section">
        <div class="geo-label">WEAKNESSES</div>
        <ul class="geo-list">${(geo.weaknesses || []).map((w) => `<li class="geo-bad">${esc(w)}</li>`).join('')}</ul>
      </div>
      <div class="geo-section">
        <div class="geo-label">TOP IMPROVEMENTS</div>
        ${(geo.improvements || []).slice(0, 5).map((imp) => `
          <div class="geo-imp">
            <span class="geo-imp-pri geo-pri-${(imp.priority || 'p2').toLowerCase()}">${esc(imp.priority || 'P2')}</span>
            <span class="geo-imp-cat">${esc(imp.category || '')}</span>
            <span class="geo-imp-action">${esc(imp.action || '')}</span>
          </div>`).join('')}
      </div>
      ${geo.aiReadiness ? `<div class="geo-section"><div class="geo-label">AI READINESS</div><p class="geo-text">${esc(geo.aiReadiness)}</p></div>` : ''}
    </div>`;
}

function renderEmailCampaign(enrichment) {
  $('row-enrich').classList.remove('hidden');
  const emails = enrichment.emails;
  if (!emails || emails.error || !Array.isArray(emails)) {
    $('email-campaign-body').innerHTML = '<div class="enrich-placeholder">No email copies generated yet. Add a DeepSeek API key and website URL to enable.</div>';
    return;
  }

  const typeColors = { cold_outreach: 'var(--cyan)', follow_up: 'var(--amber)', nurture: 'var(--hud)', case_study: '#a78bfa', offer: 'var(--red)' };

  $('email-campaign-body').innerHTML = `
    <div class="email-campaign-grid">
      ${emails.map((e, i) => `
        <div class="ec-card">
          <div class="ec-header">
            <span class="ec-num">#${String(i + 1).padStart(2, '0')}</span>
            <span class="ec-type" style="color:${typeColors[e.type] || 'var(--muted)'}">${esc((e.type || 'outreach').toUpperCase())}</span>
            <span class="ec-persona">${esc(e.targetPersona || '')}</span>
          </div>
          <div class="ec-subject">${esc(e.subject || '')}</div>
          <div class="ec-preheader">${esc(e.preheader || '')}</div>
          <div class="ec-body">${esc((e.body || '').slice(0, 400))}${(e.body || '').length > 400 ? '…' : ''}</div>
          <button class="tb-btn ec-copy" data-email="${esc(e.subject || '')}">📋 COPY</button>
        </div>
      `).join('')}
    </div>
    <div class="ec-smtp-section">
      <div class="panel-title" style="margin-top:16px">📮 SEND VIA SMTP / IMAP</div>
      <div class="smtp-form">
        <div class="smtp-row">
          <input class="smtp-input" id="smtp-host" placeholder="SMTP HOST (e.g. smtp.gmail.com)" />
          <input class="smtp-input" id="smtp-port" placeholder="PORT (587)" value="587" />
          <select class="tbl-filter" id="smtp-security">
            <option value="tls">TLS</option>
            <option value="ssl">SSL</option>
            <option value="none">NONE</option>
          </select>
        </div>
        <div class="smtp-row">
          <input class="smtp-input" id="smtp-user" placeholder="EMAIL / USERNAME" />
          <input class="smtp-input" id="smtp-pass" type="password" placeholder="PASSWORD / APP PASSWORD" />
          <button class="tb-btn" id="smtp-save">SAVE SMTP CONFIG</button>
        </div>
        <div class="smtp-note">Credentials stored locally in your browser. For Gmail: use an <a href="https://myaccount.google.com/apppasswords" target="_blank">App Password</a>.</div>
      </div>
    </div>`;

  document.querySelectorAll('.ec-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const emailText = btn.closest('.ec-card').querySelector('.ec-body').textContent;
      navigator.clipboard.writeText(emailText).then(() => {
        btn.textContent = '✓ COPIED';
        setTimeout(() => { btn.textContent = '📋 COPY'; }, 2000);
      });
    });
  });

  // Load saved SMTP config
  const smtp = JSON.parse(localStorage.getItem('smtp_config') || '{}');
  if (smtp.host) $('smtp-host').value = smtp.host;
  if (smtp.port) $('smtp-port').value = smtp.port;
  if (smtp.security) $('smtp-security').value = smtp.security;
  if (smtp.user) $('smtp-user').value = smtp.user;
  if (smtp.pass) $('smtp-pass').value = smtp.pass;

  $('smtp-save').addEventListener('click', () => {
    const config = {
      host: $('smtp-host').value.trim(),
      port: $('smtp-port').value.trim(),
      security: $('smtp-security').value,
      user: $('smtp-user').value.trim(),
      pass: $('smtp-pass').value,
    };
    localStorage.setItem('smtp_config', JSON.stringify(config));
    $('smtp-save').textContent = '✓ SAVED';
    setTimeout(() => { $('smtp-save').textContent = 'SAVE SMTP CONFIG'; }, 2000);
  });
}

function renderCreativeStudio(enrichment) {
  $('row-enrich').classList.remove('hidden');
  const prompts = enrichment.imagePrompts;
  if (!prompts || prompts.error || !prompts.prompts) {
    $('creative-body').innerHTML = '<div class="enrich-placeholder">No image prompts generated yet. Add a DeepSeek API key and website URL to enable.</div>';
    return;
  }

  const useIcons = { hero_banner: '🖼', social_post: '📱', ad_creative: '📢', email_header: '📧', logo_concept: '🔷', product_shot: '📦' };

  $('creative-body').innerHTML = `
    <div class="creative-info">
      <div class="ci-style"><b>STYLE:</b> ${esc(prompts.brandStyle || 'N/A')}</div>
      <div class="ci-palette">${(prompts.colorPalette || []).map((c) => `<span class="ci-swatch" style="background:${esc(c)}" title="${esc(c)}"></span>`).join('')}</div>
    </div>
    <div class="creative-grid">
      ${prompts.prompts.map((p) => `
        <div class="cr-card">
          <div class="cr-use">${useIcons[p.use] || '🎯'} ${esc((p.use || '').toUpperCase())}</div>
          <div class="cr-title">${esc(p.title || '')}</div>
          <div class="cr-prompt">
            <div class="cr-prompt-label">DALL-E</div>
            <div class="cr-prompt-text">${esc(p.dallePrompt || '')}</div>
          </div>
          <div class="cr-prompt">
            <div class="cr-prompt-label">MIDJOURNEY</div>
            <div class="cr-prompt-text">${esc(p.midjourneyPrompt || '')}</div>
          </div>
          <div class="cr-dims">${esc(p.dimensions || '1:1')}</div>
          <button class="tb-btn cr-generate" disabled>🖼 GENERATE (COMING SOON)</button>
        </div>
      `).join('')}
    </div>
    <div class="cr-note">Image generation via AI models coming soon. Prompts are ready to use in DALL-E, Midjourney, or Stable Diffusion manually.</div>`;
}

function renderLeadDatabase(leads) {
  $('row-leadsdb').classList.remove('hidden');
  $('leadsdb-count').textContent = leads.length;

  const render = (filter) => {
    const q = (filter || '').toLowerCase();
    const filtered = leads.filter((l) =>
      !q || (l.name || '').toLowerCase().includes(q) || (l.website || '').toLowerCase().includes(q) || (l.category || '').toLowerCase().includes(q)
    );
    $('leadsdb-body').innerHTML = filtered.map((l) => `<tr>
      <td title="${esc(l.name || '')}">${esc((l.name || '').slice(0, 40))}</td>
      <td>${esc(l.phone || '-')}</td>
      <td>${l.website ? `<a href="${esc(l.website)}" target="_blank">${esc(l.website.slice(0, 30))}</a>` : '-'}</td>
      <td>${esc(l.rating || '-')}</td>
      <td>${esc(l.reviews || '-')}</td>
      <td>${esc((l.address || '').slice(0, 40))}</td>
    </tr>`).join('') || '<tr><td colspan="6">No matching leads</td></tr>';
  };

  render();
  $('leadsdb-search').addEventListener('input', (e) => render(e.target.value));

  $('leadsdb-export').addEventListener('click', () => {
    const csv = ['Name,Phone,Website,Rating,Reviews,Address'].concat(
      leads.map((l) => `"${l.name || ''}","${l.phone || ''}","${l.website || ''}","${l.rating || ''}","${l.reviews || ''}","${l.address || ''}"`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leads_export.csv';
    a.click();
  });
}

/* ── roadmap submissions ────────────────────────────────────────── */
async function loadSubmissions() {
  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', token }),
    });
    const data = await res.json();
    if (res.ok) { submissions = data.submissions; renderSubmissions(); updateStats(); }
  } catch { /* keep old */ }
}

function updateStats() {
  const total = submissions.length;
  const newCount = submissions.filter(s => s.status === 'new').length;
  const ready = submissions.filter(s => s.plan && !s.pending).length;
  const processing = submissions.filter(s => s.pending).length;
  $('stat-total').textContent = total;
  $('stat-new').textContent = newCount;
  $('stat-ready').textContent = ready;
  $('stat-processing').textContent = processing;
}

['rm-search', 'rm-filter'].forEach((id) => $(id).addEventListener('input', renderSubmissions));

const RM_STATUS_NEXT = { new: 'contacted', contacted: 'converted', converted: 'new' };
function renderSubmissions() {
  const q = $('rm-search').value.toLowerCase();
  const f = $('rm-filter').value;
  $('rm-count').textContent = submissions.filter((s) => s.status === 'new').length + ' NEW';
  const rows = submissions.filter((s) =>
    (!f || s.status === f) &&
    (!q || (s.name + ' ' + s.email + ' ' + s.business + ' ' + s.niche).toLowerCase().includes(q))
  );
  const pill = { new: 'pill-pending', contacted: 'pill-refunded', converted: 'pill-completed' };
  $('rm-body').innerHTML = rows.map((s) => `<tr>
    <td>${fmtTime(s.createdAt)}</td>
    <td title="${esc(s.email)}">${esc(s.name)}</td>
    <td title="${esc(s.website || '')}">${esc(s.business)}</td>
    <td>${esc(s.niche)}</td>
    <td>$${Number(s.goal || 0).toLocaleString()}</td>
    <td><span class="pill ${pill[s.status] || 'pill-pending'}">${esc(s.status).toUpperCase()}</span></td>
    <td>
      <button class="tb-btn" data-detail="${esc(s.id)}" title="Quick preview of this plan">VIEW</button>
      <a class="icon-btn" href="/roadmap?id=${esc(s.id)}&token=${encodeURIComponent(token)}" target="_blank" title="Open full public plan">FULL ↗</a>
      <a class="icon-btn" href="mailto:${esc(s.email)}?subject=${encodeURIComponent('Your personalized roadmap — ' + s.business)}" title="Email them">MAIL</a>
      <button class="icon-btn" data-rmid="${esc(s.id)}" data-rmstatus="${esc(RM_STATUS_NEXT[s.status] || 'contacted')}" title="Cycle status">⟳</button>
    </td>
  </tr>`).join('') || '<tr><td colspan="7">NO SUBMISSIONS YET — SHARE /roadmap</td></tr>';
}

$('rm-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-rmid]');
  if (btn) {
    try {
      await fetch('/api/roadmap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark', token, id: btn.dataset.rmid, status: btn.dataset.rmstatus }),
      });
      loadSubmissions();
    } catch {}
    return;
  }
  const viewBtn = e.target.closest('[data-detail]');
  if (viewBtn) {
    showDetail(viewBtn.dataset.detail);
  }
});

/* ── roadmap detail panel (preview any plan from the admin dashboard) ── */
async function showDetail(id) {
  const sub = submissions.find((s) => s.id === id);
  if (!sub) return;
  activeDetailId = id;
  $('detail-sub').textContent = `${esc(sub.business)} · ${esc(sub.email)} · ${esc(sub.niche || '')}`;
  $('detail-open').href = `/roadmap?id=${esc(id)}&token=${encodeURIComponent(token)}`;
  $('row-detail').classList.remove('hidden');
  $('detail-body').innerHTML = '<div class="detail-empty"><div class="spinner"></div>Loading plan from DeepSeek enrichment…</div>';

  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', id, token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load plan');
    if (data.pending) {
      $('detail-body').innerHTML = '<div class="detail-empty">Plan is still processing. Check again shortly.</div>';
      return;
    }
    activeDetailPlan = data.plan || data;
    renderDetail();
  } catch (err) {
    $('detail-body').innerHTML = `<div class="detail-empty">Error loading plan: ${esc(err.message)}</div>`;
  }
}

function hideDetail() {
  $('row-detail').classList.add('hidden');
  activeDetailId = null;
  activeDetailPlan = null;
}
$('detail-close').addEventListener('click', hideDetail);

$('#detail-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  activeDetailTab = btn.dataset.dtab;
  $$('#detail-tabs button').forEach((b) => b.classList.toggle('on', b === btn));
  renderDetail();
});

function renderDetail() {
  const plan = activeDetailPlan;
  if (!plan) return;
  const body = $('detail-body');
  const tab = activeDetailTab;

  switch (tab) {
    case 'overview':
      body.innerHTML = `
        <div class="detail-block"><h4>POSITIONING</h4><p>${esc(plan.positioning || '—')}</p></div>
        <div class="detail-block"><h4>STRATEGY</h4><p>${esc(plan.strategy || '—')}</p></div>
        <div class="detail-block"><h4>CHANNELS</h4><ul>${(plan.channels || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="detail-block"><h4>VALUE PROPOSITION</h4><p>${esc(plan.valueProposition || '—')}</p></div>
        <div class="detail-block"><h4>OPTIMISATION CHECKLIST</h4><ul>${(plan.optimisationChecklist || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>
        ${plan.weeklySummary ? `<div class="detail-block"><h4>WEEKLY FOCUS</h4><ul>${plan.weeklySummary.map(w => `<li><b>${esc(w.phase)}</b> — ${esc(w.focus)}</li>`).join('')}</ul></div>` : ''}
      `;
      break;
    case 'emails':
      body.innerHTML = (plan.emails || []).length ? `<div class="detail-list">${plan.emails.map((e, i) => `
        <div class="detail-card">
          <div class="dc-head">${esc((e.type || 'outreach').toUpperCase())} · ${esc(e.targetPersona || '')}</div>
          <div class="dc-title">${esc(e.subject || '')}</div>
          <div class="dc-body">${esc(e.body || '')}</div>
        </div>`).join('')}</div>` : '<div class="detail-empty">No email scripts generated.</div>';
      break;
    case 'ads':
      body.innerHTML = (plan.ads || []).length ? `<div class="detail-list">${plan.ads.map((a) => `
        <div class="detail-card">
          <div class="dc-head">${esc((a.platform || 'AD').toUpperCase())} · ${esc(a.format || '')}</div>
          <div class="dc-title">${esc(a.headline || '')}</div>
          <div class="dc-body">${esc(a.body || '')}</div>
          <div class="dc-body">CTA: ${esc(a.cta || '')}</div>
        </div>`).join('')}</div>` : '<div class="detail-empty">No ad creatives generated.</div>';
      break;
    case 'offer':
      body.innerHTML = `
        <div class="detail-block"><h4>CORE OFFER</h4><p>${esc(plan.offer?.coreOffer || '—')}</p></div>
        <div class="detail-block"><h4>PRICING STRATEGY</h4><p>${esc(plan.offer?.pricingStrategy || '—')}</p></div>
        <div class="detail-block"><h4>ORDER BUMP</h4><p>${esc(plan.offer?.orderBump || '—')}</p></div>
        <div class="detail-block"><h4>URGENCY TACTICS</h4><ul>${(plan.offer?.urgencyTactics || []).map(u => `<li>${esc(u)}</li>`).join('')}</ul></div>
        <div class="detail-block"><h4>OBJECTION HANDLING</h4><ul>${(plan.offer?.objectionHandling || []).map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>
      `;
      break;
    case 'competitor':
      body.innerHTML = (plan.competitors || []).length ? `<div class="detail-list">${plan.competitors.map((c) => `
        <div class="detail-card">
          <div class="dc-title">${esc(c.name || '')}</div>
          <div class="dc-body">Strength: ${esc(c.strength || '—')}</div>
          <div class="dc-body">Weakness: ${esc(c.weakness || '—')}</div>
          <div class="dc-body">Gap: ${esc(c.gap || '—')}</div>
        </div>`).join('')}</div>` : '<div class="detail-empty">No competitor analysis generated.</div>';
      break;
    case 'geo':
      const geo = plan.geoAudit;
      if (!geo) { body.innerHTML = '<div class="detail-empty">No GEO audit available.</div>'; break; }
      body.innerHTML = `
        <div class="detail-block"><h4>OVERALL SCORE</h4><p style="font-size:22px;font-weight:800;color:${geo.overallScore >= 70 ? '#22c55e' : geo.overallScore >= 40 ? '#f59e0b' : '#ef4444'}">${geo.overallScore || '?'}</p></div>
        <div class="detail-block"><h4>STRENGTHS</h4><ul>${(geo.strengths || []).map(s => `<li class="geo-good">${esc(s)}</li>`).join('')}</ul></div>
        <div class="detail-block"><h4>WEAKNESSES</h4><ul>${(geo.weaknesses || []).map(w => `<li class="geo-bad">${esc(w)}</li>`).join('')}</ul></div>
        <div class="detail-block"><h4>TOP IMPROVEMENTS</h4><ul>${(geo.improvements || []).map(imp => `<li>${esc(imp.priority || 'P2')} · ${esc(imp.category || '')} · ${esc(imp.action || '')}</li>`).join('')}</ul></div>
      `;
      break;
  }
}

/* auto-login if session token exists */
if (token) { enterDashboard(); } else { $('login-screen').classList.remove('hidden'); }
