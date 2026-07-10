'use strict';
// Website scraper — extracts full content from a business website
// Uses axios + cheerio for server-side extraction. No headless browser needed.

const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (compatible; LeadEngine/1.0; +https://leadengine.ai)';

async function fetchPage(url, timeout = 15000) {
  try {
    const res = await axios.get(url, {
      timeout,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
    });
    return { data: res.data, status: res.status, ok: res.status < 400, url: res.request?.res?.responseUrl || url };
  } catch (e) {
    return { data: null, status: 0, ok: false, url, error: e.message };
  }
}

function extractMeta($) {
  const meta = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('itemprop');
    const content = $(el).attr('content');
    if (name && content) meta[name] = content;
  });
  return meta;
}

function extractText($) {
  // Remove script, style, nav, footer, header for cleaner text
  $('script, style, noscript, iframe, svg, nav, footer, header').remove();
  const body = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();
  const h2s = [];
  $('h2').each((_, el) => { const t = $(el).text().trim(); if (t) h2s.push(t); });
  const paragraphs = [];
  $('p').each((_, el) => { const t = $(el).text().trim(); if (t && t.length > 30) paragraphs.push(t); });
  return { title, h1, h2s: h2s.slice(0, 10), paragraphs: paragraphs.slice(0, 20), bodyText: body.slice(0, 8000) };
}

function extractLinks($, baseUrl) {
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
      try {
        const resolved = new URL(href, baseUrl).href;
        links.push({ url: resolved, text: text.slice(0, 120) });
      } catch {}
    }
  });
  return links.slice(0, 50);
}

function extractImages($, baseUrl) {
  const images = [];
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || '';
    if (src && !src.startsWith('data:')) {
      try {
        images.push({ src: new URL(src, baseUrl).href, alt: alt.slice(0, 200) });
      } catch {}
    }
  });
  return images.slice(0, 30);
}

function extractSocialLinks($) {
  const social = {};
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    if (href.includes('facebook.com') || href.includes('fb.com')) social.facebook = $(el).attr('href');
    if (href.includes('twitter.com') || href.includes('x.com')) social.twitter = $(el).attr('href');
    if (href.includes('linkedin.com')) social.linkedin = $(el).attr('href');
    if (href.includes('instagram.com')) social.instagram = $(el).attr('href');
    if (href.includes('youtube.com')) social.youtube = $(el).attr('href');
  });
  return social;
}

function extractEmails(text) {
  const found = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(found)].slice(0, 10);
}

function extractPhones(text) {
  const found = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/g) || [];
  return [...new Set(found)].slice(0, 5);
}

async function scrapeWebsite(inputUrl) {
  let url = inputUrl.trim();
  if (!url.match(/^https?:\/\//i)) url = 'https://' + url;

  const result = {
    url,
    fetched: false,
    status: 0,
    error: null,
    title: '',
    description: '',
    meta: {},
    text: {},
    links: [],
    images: [],
    social: {},
    emails: [],
    phones: [],
    hasSsl: url.startsWith('https'),
  };

  const page = await fetchPage(url);
  if (!page.ok || !page.data) {
    result.error = page.error || `HTTP ${page.status}`;
    return result;
  }

  result.fetched = true;
  result.status = page.status;
  result.url = page.url;

  const $ = cheerio.load(page.data);
  result.meta = extractMeta($);
  result.description = result.meta.description || result.meta['og:description'] || '';
  result.text = extractText($);
  result.title = result.text.title || result.meta['og:title'] || '';
  result.links = extractLinks($, page.url);
  result.images = extractImages($, page.url);
  result.social = extractSocialLinks($);
  result.emails = extractEmails($.html());
  result.phones = extractPhones($.html());

  return result;
}

module.exports = { scrapeWebsite, fetchPage };
