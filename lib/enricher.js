'use strict';
// Enrichment orchestrator — ties scraper, DeepSeek, and maps scraper together.
// Runs async after roadmap form submission. Saves everything to Supabase.

const { scrapeWebsite } = require('./scraper');
const { generateFullPlan } = require('./deepseek');
const { runLeadSearch } = require('./mapsclient');
const { generatePlan } = require('./planner');
const { getRoadmap, updateRoadmap, saveLeads } = require('./supabase');

async function enrichRoadmap(roadmapId, apiKey) {
  const entry = await getRoadmap(roadmapId);
  if (!entry) throw new Error('Roadmap not found in Supabase');

  const business = entry.input;
  const website = business.website;
  const result = {
    scraped: null,
    plan: null,
    enrichment: null,
    leadCount: 0,
    errors: [],
    usedFallback: false,
  };

  // Step 1: Scrape website
  if (website) {
    try {
      result.scraped = await scrapeWebsite(website);
    } catch (e) {
      result.errors.push(`Website scrape: ${e.message}`);
      result.scraped = { url: website, fetched: false, error: e.message };
    }
  }

  // Step 2: Generate full plan via DeepSeek (or fallback to planner.js)
  try {
    result.plan = await generateFullPlan(result.scraped || {}, business, apiKey);
  } catch (e) {
    result.errors.push(`DeepSeek: ${e.message}`);
    // Fallback to deterministic planner
    try {
      result.plan = generatePlan(business);
      result.usedFallback = true;
    } catch (e2) {
      result.errors.push(`Planner fallback: ${e2.message}`);
    }
  }

  // Step 3: Build enrichment object from plan
  if (result.plan) {
    result.enrichment = {
      icp: result.plan.icp || null,
      emails: result.plan.emails || null,
      geoAudit: result.plan.geoAudit || null,
      mapsQueries: result.plan.mapsQueries || null,
      imagePrompts: result.plan.imagePrompts || null,
      scraped: result.scraped,
      usedFallback: result.usedFallback,
    };
  }

  // Step 4: Save plan + enrichment to Supabase
  const enrichedAt = new Date().toISOString();
  await updateRoadmap(roadmapId, {
    plan: result.plan,
    enrichment: result.enrichment,
    status: 'ready',
    enrichedAt,
    readyAt: enrichedAt,
  });

  // Step 5: Run maps scraper for leads (if queries available)
  if (result.enrichment?.mapsQueries?.queries?.length > 0) {
    try {
      const leadResult = await runLeadSearch(
        `${business.name || 'Business'} Leads`,
        result.enrichment.mapsQueries.queries,
        apiKey
      );
      if (leadResult.leads && leadResult.leads.length > 0) {
        await saveLeads(roadmapId, leadResult.leads);
        result.leadCount = leadResult.leads.length;
      }
    } catch (e) {
      result.errors.push(`Lead search: ${e.message}`);
    }
  }

  return result;
}

async function enrichRoadmapAsync(roadmapId, apiKey) {
  // Fire and forget — enrichment runs in background
  setImmediate(() => {
    enrichRoadmap(roadmapId, apiKey).catch((e) => {
      console.error(`Enrichment failed for ${roadmapId}:`, e.message);
      // Mark as failed so dashboard can show error state
      updateRoadmap(roadmapId, { status: 'failed' }).catch(() => {});
    });
  });
  return { status: 'enrichment_started', roadmapId };
}

module.exports = { enrichRoadmap, enrichRoadmapAsync };
