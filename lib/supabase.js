'use strict';
// Supabase client — replaces JSON file persistence for roadmaps, enrichment, and leads.
// Settings and file vault remain in lib/db.js (JSON files).

const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE = Boolean(URL && KEY);

let client = null;
function getClient() {
  if (!LIVE) return null;
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: false } });
  return client;
}

// ── Roadmaps ─────────────────────────────────────────────────────────────────

async function saveRoadmap(entry) {
  const c = getClient();
  if (!c) return null;
  const { error } = await c.from('roadmaps').upsert({
    id: entry.id,
    input: entry.input,
    plan: entry.plan || null,
    enrichment: entry.enrichment || null,
    status: entry.status || 'processing',
    created_at: entry.createdAt || new Date().toISOString(),
    ready_at: entry.readyAt || null,
    enriched_at: entry.enrichedAt || null,
  });
  if (error) { console.error('saveRoadmap error:', error.message); return null; }
  return entry;
}

async function getRoadmap(id) {
  const c = getClient();
  if (!c) return null;
  const { data, error } = await c.from('roadmaps').select('*').eq('id', id).single();
  if (error || !data) return null;
  return {
    id: data.id,
    input: data.input,
    plan: data.plan,
    enrichment: data.enrichment,
    status: data.status,
    createdAt: data.created_at,
    readyAt: data.ready_at,
    enrichedAt: data.enriched_at,
  };
}

async function listRoadmaps() {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c.from('roadmaps').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) { console.error('listRoadmaps error:', error.message); return []; }
  return (data || []).map((r) => ({
    id: r.id,
    input: r.input,
    plan: r.plan,
    enrichment: r.enrichment,
    status: r.status,
    createdAt: r.created_at,
    readyAt: r.ready_at,
    enrichedAt: r.enriched_at,
  }));
}

async function updateRoadmap(id, patch) {
  const c = getClient();
  if (!c) return null;
  const updates = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.plan !== undefined) updates.plan = patch.plan;
  if (patch.enrichment !== undefined) updates.enrichment = patch.enrichment;
  if (patch.enrichedAt !== undefined) updates.enriched_at = patch.enrichedAt;
  if (patch.readyAt !== undefined) updates.ready_at = patch.readyAt;
  const { error } = await c.from('roadmaps').update(updates).eq('id', id);
  if (error) { console.error('updateRoadmap error:', error.message); return null; }
  return getRoadmap(id);
}

// ── Leads ────────────────────────────────────────────────────────────────────

async function saveLeads(roadmapId, leads) {
  const c = getClient();
  if (!c) return [];
  if (!leads || leads.length === 0) return [];
  const rows = leads.map((l) => ({
    roadmap_id: roadmapId,
    name: l.name || l.title || '',
    phone: l.phone || l.phone_number || '',
    website: l.website || l.site || '',
    rating: String(l.rating || l.total_score || ''),
    reviews: String(l.reviews || l.reviews_count || ''),
    address: l.address || l.full_address || '',
    category: l.category || l.type || '',
  }));
  const { error } = await c.from('leads_db').insert(rows);
  if (error) { console.error('saveLeads error:', error.message); return []; }
  return rows;
}

async function getLeads(roadmapId) {
  const c = getClient();
  if (!c) return [];
  const { data, error } = await c.from('leads_db').select('*').eq('roadmap_id', roadmapId).order('created_at', { ascending: false });
  if (error) { console.error('getLeads error:', error.message); return []; }
  return data || [];
}

module.exports = { LIVE, saveRoadmap, getRoadmap, listRoadmaps, updateRoadmap, saveLeads, getLeads };
