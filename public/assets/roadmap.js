'use strict';
/* Roadmap wizard + plan renderer */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── wizard navigation ───────────────────────────────────────────── */
function showStep(n) {
  $$('.wiz-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== String(n)));
  $$('.wiz-step').forEach((s) => {
    const num = Number(s.dataset.s);
    s.classList.toggle('active', num === n);
    s.classList.toggle('done', num < n);
  });
  const lbl = document.getElementById('wiz-step-label');
  if (lbl) lbl.textContent = 'STEP ' + n + ' OF 4';
  const bar = document.getElementById('wiz-bar-fill');
  if (bar) bar.style.width = (n * 25) + '%';
}

document.addEventListener('click', (e) => {
  const next = e.target.closest('[data-next]');
  const prev = e.target.closest('[data-prev]');
  if (next) {
    const cur = next.closest('.wiz-panel');
    const inputs = cur.querySelectorAll('input[required], textarea[required]');
    for (const inp of inputs) {
      if (!inp.reportValidity()) return;
    }
    showStep(Number(next.dataset.next));
  }
  if (prev) showStep(Number(prev.dataset.prev));
});

/* ── chip selectors ──────────────────────────────────────────────── */
$$('.chipset').forEach((set) => {
  set.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (set.dataset.single) {
      set.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
    } else {
      const max = Number(set.dataset.max || 99);
      if (!btn.classList.contains('on') && set.querySelectorAll('.on').length >= max) {
        set.querySelector('.on').classList.remove('on');
      }
      btn.classList.toggle('on');
    }
  });
});

function chipValues(name) {
  const set = document.querySelector(`.chipset[data-name="${name}"]`);
  return Array.from(set.querySelectorAll('.on')).map((b) => b.dataset.v);
}

/* ── submit ──────────────────────────────────────────────────────── */
const GEN_MESSAGES = [
  'ANALYZING YOUR BUSINESS…',
  'PROFILING YOUR IDEAL CLIENT…',
  'CALCULATING LEAD TARGETS…',
  'WRITING YOUR EMAIL SCRIPTS…',
  'DESIGNING AD CREATIVES…',
  'ASSEMBLING 21-DAY MISSION PLAN…',
];

$('#rm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const niche = chipValues('niche')[0];
  if (!niche) { $('#rm-error').textContent = '⚠ SELECT YOUR BUSINESS TYPE (STEP 02)'; showStep(2); return; }

  const payload = {
    action: 'create',
    name: f.name.value,
    email: f.email.value,
    businessName: f.businessName.value,
    website: f.website.value,
    niche,
    audience: f.audience.value,
    offer: f.offer.value,
    pricePoint: f.pricePoint.value,
    monthlyGoal: f.monthlyGoal.value,
    channels: chipValues('channels'),
    tone: chipValues('tone')[0] || 'professional',
    challenge: f.challenge.value,
  };

  $('#generate-btn').disabled = true;
  $('#rm-error').textContent = '';
  $('#wizard-screen').classList.add('hidden');
  $('#gen-screen').classList.remove('hidden');

  let mi = 0;
  const msgTimer = setInterval(() => {
    mi = (mi + 1) % GEN_MESSAGES.length;
    $('#gen-status').textContent = GEN_MESSAGES[mi];
  }, 700);

  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');

    // small dramatic pause so the sequence is visible
    await new Promise((r) => setTimeout(r, 2200));
    clearInterval(msgTimer);
    localStorage.setItem('member_rm_id', data.id);
    localStorage.setItem('member_rm_ready', data.readyAt);
    history.replaceState(null, '', '/roadmap?id=' + data.id);
    $('#gen-screen').classList.add('hidden');
    openPlan(data.id);
  } catch (err) {
    clearInterval(msgTimer);
    $('#gen-screen').classList.add('hidden');
    $('#wizard-screen').classList.remove('hidden');
    $('#rm-error').textContent = '⚠ ' + err.message.toUpperCase();
    $('#generate-btn').disabled = false;
  }
});

$('#restart-btn').addEventListener('click', () => {
  history.replaceState(null, '', '/roadmap');
  location.reload();
});

/* ── plan rendering ──────────────────────────────────────────────── */
function renderPlan(plan, id) {
  $('#gen-screen').classList.add('hidden');
  $('#wizard-screen').classList.add('hidden');
  $('#plan-screen').classList.remove('hidden');
  window.scrollTo(0, 0);

  $('#plan-id').textContent = id;
  $('#plan-title').textContent = `${(plan.business.name || 'YOUR').toUpperCase()} · 21-DAY FLIGHT PLAN`;
  $('#plan-positioning').textContent = plan.positioning;

  // KPI strip
  const k = plan.kpis;
  $('#kpi-strip').innerHTML = [
    ['$' + k.monthlyGoal.toLocaleString(), 'MONTHLY TARGET'],
    [k.clientsNeeded, 'CLIENTS NEEDED'],
    [k.leadsNeeded, 'LEADS NEEDED'],
    [k.dailyLeads + '/DAY', 'LEAD PACE'],
    [k.outreachPerDay + '/DAY', 'OUTREACH TOUCHES'],
    ['~$' + k.estAdBudget.toLocaleString(), 'EST. AD BUDGET'],
  ].map(([v, l]) => `<div class="kpi"><b>${esc(v)}</b><small>${l}</small></div>`).join('');

  renderMission(plan);
  renderStrategy(plan);
  renderIcp(plan);
  renderEmails(plan);
  renderAds(plan);
  renderMagnets(plan);
  renderOffer(plan);
  renderCompetitor(plan);
  renderTracker(plan);
  renderCalendar(plan);
  renderNinetyDay(plan);
  renderRisks(plan);
  renderGeo(plan);
}

/* mission tab with progress checkboxes (persisted per plan) */
function renderMission(plan) {
  const key = 'rm_done_' + ($('#plan-id').textContent || 'x');
  const done = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  let html = '';
  let phase = '';
  for (const d of plan.days) {
    if (d.phase !== phase) {
      phase = d.phase;
      const range = phase === 'FOUNDATION' ? 'DAYS 1–7' : phase === 'LAUNCH' ? 'DAYS 8–14' : 'DAYS 15–21';
      html += `<div class="phase-head">PHASE · ${phase} · ${range}</div>`;
    }
    html += `<div class="day-card ${done.has(d.day) ? 'done' : ''}" data-day="${d.day}">
      <div class="day-num"><input type="checkbox" class="day-check" ${done.has(d.day) ? 'checked' : ''} title="Mark day complete"/><b>${String(d.day).padStart(2, '0')}</b><small>DAY</small></div>
      <div>
        <h4>${esc(d.title)}</h4>
        <ul>${d.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="day-kpi">◎ TARGET: ${esc(d.kpi)}</div>
      </div>
    </div>`;
  }
  $('#tab-mission').innerHTML = html;

  $('#tab-mission').addEventListener('change', (e) => {
    const cb = e.target.closest('.day-check');
    if (!cb) return;
    const card = cb.closest('.day-card');
    const day = Number(card.dataset.day);
    cb.checked ? done.add(day) : done.delete(day);
    card.classList.toggle('done', cb.checked);
    localStorage.setItem(key, JSON.stringify([...done]));
  });
}

function renderIcp(plan) {
  const block = (title, items) => `<div class="icp-card"><h4>${title}</h4><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  $('#tab-icp').innerHTML = `<div class="icp-grid">
    ${block('⚠ TOP PAIN POINTS', plan.icp.pains)}
    ${block('◎ WHERE THEY HANG OUT', plan.icp.hangouts)}
    ${block('⚡ BUYING TRIGGERS', plan.icp.triggers)}
  </div>`;
}

function renderEmails(plan) {
  $('#tab-emails').innerHTML = plan.emails.map((em, i) => `
    <div class="email-card">
      <div class="email-head">
        <span class="email-label">${esc(em.label)}</span>
        <span class="email-subject">SUBJECT: ${esc(em.subject)}</span>
      </div>
      <div class="email-body" id="em-body-${i}">${esc(em.body)}</div>
      <div class="email-actions">
        <button class="mini-btn" data-copy="${i}">⧉ COPY</button>
        <a class="mini-btn" href="mailto:?subject=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}">✉ SEND MAIL</a>
      </div>
    </div>`).join('');

  $('#tab-emails').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const text = plan.emails[Number(btn.dataset.copy)];
    await navigator.clipboard.writeText(`Subject: ${text.subject}\n\n${text.body}`);
    btn.textContent = '✓ COPIED';
    setTimeout(() => (btn.textContent = '⧉ COPY'), 1500);
  });
}

/* ── canvas ad creative generator ────────────────────────────────── */
const AD_THEMES = [
  { bg1: '#05080d', bg2: '#0d2b22', accent: '#21e6a1', text: '#eafff6' },
  { bg1: '#070b16', bg2: '#101f3c', accent: '#35c8f5', text: '#eaf6ff' },
  { bg1: '#120a05', bg2: '#2b1c08', accent: '#f5b83d', text: '#fff6ea' },
];

function drawAdCreative(canvas, ad, biz, theme) {
  const S = 1080;
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');

  // background
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);

  // grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < S; i += 72) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke();
  }

  // accent frame
  ctx.strokeStyle = theme.accent; ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, S - 80, S - 80);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(40, 40, 220, 10);

  // brand tag
  ctx.fillStyle = theme.accent;
  ctx.font = 'bold 34px "Share Tech Mono", monospace';
  ctx.fillText((biz || 'YOUR BRAND').toUpperCase().slice(0, 28), 90, 140);

  // headline (wrapped)
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 72px Rajdhani, sans-serif';
  wrapText(ctx, ad.headline, 90, 320, S - 180, 84);

  // primary text (wrapped, smaller)
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '38px Rajdhani, sans-serif';
  wrapText(ctx, ad.primary, 90, 640, S - 180, 52);

  // CTA button
  const ctaW = ctx.measureText(ad.cta).width + 140;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, 90, S - 200, Math.max(ctaW, 320), 92, 12);
  ctx.fill();
  ctx.fillStyle = theme.bg1;
  ctx.font = 'bold 44px Rajdhani, sans-serif';
  ctx.fillText(ad.cta.toUpperCase(), 130, S - 140);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y);
      line = w + ' ';
      y += lineH;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderAds(plan) {
  $('#tab-ads').innerHTML = `<div class="ads-grid">` + plan.ads.map((ad, i) => `
    <div class="ad-card">
      <div class="ad-style">CREATIVE ${i + 1} · ${esc(ad.style)}</div>
      <canvas id="ad-cv-${i}"></canvas>
      <div class="ad-copy">
        <b>${esc(ad.headline)}</b>
        ${esc(ad.primary)}
        <br/><span class="cta">${esc(ad.cta).toUpperCase()}</span>
      </div>
      <div class="ad-dl"><button class="mini-btn" data-dl="${i}">⬇ DOWNLOAD PNG (1080×1080)</button>
      <button class="mini-btn" data-copy-ad="${i}">⧉ COPY AD TEXT</button></div>
    </div>`).join('') + `</div>`;

  // draw after fonts load
  const draw = () => plan.ads.forEach((ad, i) =>
    drawAdCreative(document.getElementById('ad-cv-' + i), ad, plan.business.name, AD_THEMES[i % AD_THEMES.length]));
  (document.fonts?.ready || Promise.resolve()).then(draw);

  $('#tab-ads').addEventListener('click', async (e) => {
    const dl = e.target.closest('[data-dl]');
    if (dl) {
      const cv = document.getElementById('ad-cv-' + dl.dataset.dl);
      const a = document.createElement('a');
      a.download = `${(plan.business.name || 'ad').replace(/\W+/g, '-')}-creative-${Number(dl.dataset.dl) + 1}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    }
    const cp = e.target.closest('[data-copy-ad]');
    if (cp) {
      const ad = plan.ads[Number(cp.dataset.copyAd)];
      await navigator.clipboard.writeText(`Headline: ${ad.headline}\n\nPrimary text: ${ad.primary}\n\nCTA: ${ad.cta}`);
      cp.textContent = '✓ COPIED';
      setTimeout(() => (cp.textContent = '⧉ COPY AD TEXT'), 1500);
    }
  });
}

function renderMagnets(plan) {
  $('#tab-magnets').innerHTML = plan.leadMagnets.map((m, i) => `
    <div class="magnet-card"><div class="magnet-num">0${i + 1}</div><p>${esc(m)}</p></div>`).join('') +
    `<div class="magnet-card"><div class="magnet-num">★</div>
     <p><b style="color:#f5b83d">PRO TIP:</b> pick ONE, build it on Day 2, and don't touch the others until it converts.</p></div>`;
}

/* ── strategy tab: weekly summaries + milestones ─────────────────── */
function renderStrategy(plan) {
  const ws = plan.weeklySummary || [];
  const ms = plan.milestones || [];

  let html = '<div class="strategy-section"><h3 class="sec-title">WEEKLY STRATEGY OVERVIEW</h3>';
  html += '<div class="week-grid">';
  for (const w of ws) {
    html += `<div class="week-card">
      <div class="week-head"><b>WEEK ${w.week}</b> · ${esc(w.phase)} · DAYS ${esc(w.days)}</div>
      <p class="week-focus">${esc(w.focus)}</p>
      <div class="week-goal"><b>GOAL:</b> ${esc(w.goal)}</div>
      <ul class="week-metrics">${w.metrics.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <div class="week-checkpoint"><b>✓ CHECKPOINT:</b> ${esc(w.checkpoint)}</div>
    </div>`;
  }
  html += '</div></div>';

  html += '<div class="strategy-section"><h3 class="sec-title">MILESTONE TIMELINE</h3>';
  html += '<div class="milestone-track">';
  for (const m of ms) {
    html += `<div class="milestone-node ms-${esc(m.status)}">
      <div class="ms-dot">${m.day}</div>
      <div class="ms-info"><b>${esc(m.label)}</b><small>${esc(m.target)}</small></div>
    </div>`;
  }
  html += '</div></div>';

  $('#tab-strategy').innerHTML = html;
}

/* ── offer & pricing tab ──────────────────────────────────────────── */
function renderOffer(plan) {
  const o = plan.offerStrategy;
  if (!o) return;
  let html = `<div class="offer-section">
    <div class="offer-tier-badge">${esc(o.currentTier)}</div>
    <p class="offer-strategy-text">${esc(o.strategy)}</p>
    <p class="offer-positioning">${esc(o.positioning)}</p>
  </div>`;

  html += '<div class="pricing-grid">';
  for (const t of o.pricingTiers) {
    const isCore = t.name === 'CORE';
    html += `<div class="pricing-card ${isCore ? 'featured' : ''}">
      <div class="pricing-name">${esc(t.name)}</div>
      <div class="pricing-price">$${t.price.toLocaleString()}</div>
      <p class="pricing-desc">${esc(t.desc)}</p>
      <p class="pricing-best">${esc(t.best)}</p>
    </div>`;
  }
  html += '</div>';

  html += '<div class="offer-tips"><h4>PRICING PSYCHOLOGY TIPS</h4><ul>';
  for (const tip of o.tips) html += `<li>${esc(tip)}</li>`;
  html += '</ul></div>';

  $('#tab-offer').innerHTML = html;
}

/* ── competitor tab ───────────────────────────────────────────────── */
function renderCompetitor(plan) {
  const c = plan.competitor;
  if (!c) return;
  let html = '<div class="comp-grid">';
  html += `<div class="comp-card comp-landscape"><h4>⚔ COMPETITIVE LANDSCAPE</h4><p>${esc(c.landscape)}</p></div>`;
  html += `<div class="comp-card comp-weakness"><h4>◉ THEIR WEAKNESS</h4><p>${esc(c.theirWeakness)}</p></div>`;
  html += `<div class="comp-card comp-edge"><h4>⚡ YOUR EDGE</h4><p>${esc(c.yourEdge)}</p></div>`;
  html += `<div class="comp-card comp-avoid"><h4>✗ TRAP TO AVOID</h4><p>${esc(c.avoidTrap)}</p></div>`;
  html += '</div>';

  html += '<div class="comp-battle"><h4>BATTLE PLAN</h4><ol>';
  for (const step of c.battlePlan) html += `<li>${esc(step)}</li>`;
  html += '</ol></div>';

  if (plan.channelStrategy && plan.channelStrategy.length) {
    html += '<div class="comp-battle"><h4>CHANNEL DEEP DIVE</h4>';
    html += '<div class="channel-deep-grid">';
    for (const ch of plan.channelStrategy) {
      html += `<div class="channel-deep-card">
        <h5>${esc(ch.channel)}</h5>
        <div class="ch-row"><b>AUDIENCE</b><span>${esc(ch.audience)}</span></div>
        <div class="ch-row"><b>BUDGET</b><span>${esc(ch.budget)}</span></div>
        <div class="ch-row"><b>CREATIVE</b><span>${esc(ch.creative)}</span></div>
        <div class="ch-row"><b>RETARGETING</b><span>${esc(ch.retargeting)}</span></div>
      </div>`;
    }
    html += '</div></div>';
  }

  $('#tab-competitor').innerHTML = html;
}

/* ── metrics tracker tab ──────────────────────────────────────────── */
function renderTracker(plan) {
  const t = plan.metricsTracker;
  if (!t) return;
  const renderTable = (title, rows) => {
    let h = `<div class="tracker-block"><h4>${title}</h4>`;
    h += '<table class="tracker-table"><thead><tr><th>METRIC</th><th>TARGET</th><th>ACTUAL</th><th>HIT?</th></tr></thead><tbody>';
    for (const r of rows) {
      h += `<tr><td>${esc(r.metric)}</td><td>${esc(r.target)}</td><td>—</td><td>○</td></tr>`;
    }
    h += '</tbody></table></div>';
    return h;
  };
  $('#tab-tracker').innerHTML =
    `<div class="tracker-grid">${renderTable('DAILY METRICS', t.daily)}${renderTable('WEEKLY METRICS', t.weekly)}${renderTable('MONTHLY METRICS', t.monthly)}</div>` +
    `<div class="tracker-note">Print this page or copy into a spreadsheet. Fill "ACTUAL" daily and mark "HIT?" with ✓ or ✗. Review weekly.</div>`;
}

/* ── content calendar tab ─────────────────────────────────────────── */
function renderCalendar(plan) {
  const cal = plan.contentCalendar;
  if (!cal) return;
  let html = '<div class="cal-grid">';
  for (const day of cal) {
    const isWeekend = day.focus === 'BATCH' || day.focus === 'REST';
    html += `<div class="cal-card ${isWeekend ? 'cal-weekend' : ''}">
      <div class="cal-day">${esc(day.day)}</div>
      <div class="cal-focus">${esc(day.focus)}</div>
      <p class="cal-task">${esc(day.task)}</p>
      <div class="cal-channel">${esc(day.channel)}</div>
    </div>`;
  }
  html += '</div>';
  html += '<div class="cal-note">Repeat this weekly rhythm. Batch all content on Saturday. Review metrics on Sunday. Consistency beats intensity.</div>';
  $('#tab-calendar').innerHTML = html;
}

/* ── 90-day extension tab ─────────────────────────────────────────── */
function renderNinetyDay(plan) {
  const nd = plan.ninetyDay;
  if (!nd) return;
  let html = '<div class="ninety-intro"><h3>BEYOND 21 DAYS · YOUR 90-DAY GROWTH PATH</h3><p>You\'ve launched. Now systemize, delegate, and scale. Here\'s your roadmap for Days 22–90.</p></div>';
  html += '<div class="ninety-grid">';
  for (const phase of nd) {
    html += `<div class="ninety-card">
      <div class="ninety-phase">${esc(phase.phase)}</div>
      <h4>${esc(phase.title)}</h4>
      <p class="ninety-focus">${esc(phase.focus)}</p>
      <ul>${phase.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="ninety-milestone"><b>★ MILESTONE:</b> ${esc(phase.milestone)}</div>
    </div>`;
  }
  html += '</div>';
  $('#tab-ninetyday').innerHTML = html;
}

/* ── risk mitigation tab ──────────────────────────────────────────── */
function renderRisks(plan) {
  const risks = plan.risks;
  if (!risks) return;
  let html = '<div class="risk-grid">';
  for (const r of risks) {
    html += `<div class="risk-card">
      <div class="risk-warning">⚠ ${esc(r.risk)}</div>
      <div class="risk-fix">${esc(r.mitigation)}</div>
    </div>`;
  }
  html += '</div>';
  html += '<div class="risk-note">Every entrepreneur hits these walls. The difference between those who break through and those who quit is having a pre-planned response. You do now.</div>';
  $('#tab-risks').innerHTML = html;
}

function renderGeo(plan) {
  const geo = plan.geoAudit;
  if (!geo) {
    $('#tab-geo').innerHTML = '<div class="enrich-placeholder">No GEO audit available for this plan.</div>';
    return;
  }
  const scoreColor = geo.overallScore >= 70 ? '#22c55e' : geo.overallScore >= 40 ? '#f59e0b' : '#ef4444';
  const scoreLabel = geo.overallScore >= 70 ? 'GOOD' : geo.overallScore >= 40 ? 'NEEDS WORK' : 'CRITICAL';

  let html = '<div class="geo-detail">';
  html += `<div class="geo-detail-score"><div class="geo-score-num" style="color:${scoreColor}">${geo.overallScore || '?'}</div><div class="geo-score-label" style="color:${scoreColor}">${scoreLabel}</div></div>`;

  if (geo.scores) {
    html += '<div class="geo-bars">';
    for (const [k, v] of Object.entries(geo.scores)) {
      const color = v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444';
      html += `<div class="geo-bar-row"><span class="geo-bar-name">${esc(k.replace(/([A-Z])/g, ' $1').toUpperCase())}</span><div class="geo-bar-track"><div class="geo-bar-fill" style="width:${v}%;background:${color}"></div></div><span class="geo-bar-value">${v}</span></div>`;
    }
    html += '</div>';
  }

  if (geo.strengths?.length) {
    html += '<div class="geo-detail-section"><h4>STRENGTHS</h4><ul>' + geo.strengths.map(s => `<li class="geo-good">${esc(s)}</li>`).join('') + '</ul></div>';
  }
  if (geo.weaknesses?.length) {
    html += '<div class="geo-detail-section"><h4>WEAKNESSES</h4><ul>' + geo.weaknesses.map(w => `<li class="geo-bad">${esc(w)}</li>`).join('') + '</ul></div>';
  }
  if (geo.improvements?.length) {
    html += '<div class="geo-detail-section"><h4>TOP IMPROVEMENTS</h4><div class="geo-imp-list">' + geo.improvements.map(imp => `
      <div class="geo-imp-row">
        <span class="geo-imp-pri ${'geo-pri-' + (imp.priority || 'P2').toLowerCase()}">${esc(imp.priority || 'P2')}</span>
        <span class="geo-imp-cat">${esc(imp.category || '')}</span>
        <span class="geo-imp-action">${esc(imp.action || '')}</span>
      </div>`).join('') + '</div></div>';
  }
  if (geo.aiReadiness) {
    html += `<div class="geo-detail-section"><h4>AI READINESS</h4><p class="geo-detail-text">${esc(geo.aiReadiness)}</p></div>`;
  }
  if (geo.competitorGap) {
    html += `<div class="geo-detail-section"><h4>COMPETITOR GAP</h4><p class="geo-detail-text">${esc(geo.competitorGap)}</p></div>`;
  }
  html += '</div>';
  $('#tab-geo').innerHTML = html;
}

/* tabs */
$('#plan-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $$('#plan-tabs button').forEach((b) => b.classList.toggle('on', b === btn));
  $$('.tab-body').forEach((t) => t.classList.toggle('hidden', t.id !== 'tab-' + btn.dataset.tab));
});

/* ── countdown wait screen ──────────────────────────────────────── */
let waitTimer = null;
let pollTimer = null;
function showCountdown(id, readyAt) {
  $('#wizard-screen').classList.add('hidden');
  $('#plan-screen').classList.add('hidden');
  $('#wait-screen').classList.remove('hidden');
  clearInterval(waitTimer);
  clearInterval(pollTimer);

  const tick = () => {
    const left = +new Date(readyAt) - Date.now();
    if (left <= 0) {
      clearInterval(waitTimer);
      $('#wait-timer').textContent = 'CHECKING…';
      // Start polling every 15s until plan is available
      pollForPlan(id);
      return;
    }
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    $('#wait-timer').textContent =
      String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };
  tick();
  waitTimer = setInterval(tick, 1000);
}

async function pollForPlan(id) {
  clearInterval(pollTimer);
  const check = async () => {
    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', id }),
      });
      const data = await res.json();
      if (data.plan && data.status === 'ready') {
        clearInterval(pollTimer);
        $('#wait-screen').classList.add('hidden');
        renderPlan(data.plan, data.id);
      }
    } catch { /* retry next interval */ }
  };
  await check();
  pollTimer = setInterval(check, 15000);
}

/* ── open a plan by id (renders plan, or countdown if still pending) ───── */
async function openPlan(id) {
  const adminToken = new URLSearchParams(location.search).get('token');
  try {
    const res = await fetch('/api/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', id, token: adminToken || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return;
    if (data.status === 'processing' || data.pending) {
      const readyAt = data.readyAt || new Date(Date.now() + 30 * 60000).toISOString();
      showCountdown(id, readyAt);
    } else if (data.plan) {
      $('#wait-screen').classList.add('hidden');
      renderPlan(data.plan, data.id);
    } else {
      // Plan not ready yet but not marked processing — show generic wait
      showCountdown(id, data.readyAt || new Date(Date.now() + 5 * 60000).toISOString());
    }
  } catch { /* stay where we are */ }
}

/* ── reopen saved plan via ?id= ──────────────────────────────────── */
(function init() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) openPlan(id);
})();
