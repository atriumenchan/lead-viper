'use strict';
// Lightweight JSON file persistence for settings, roadmap submissions and the
// file vault. Survives restarts, requires zero external services.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureDirs() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch { /* read-only filesystem in serverless — safe to ignore */ }
}

function readJson(file, fallback) {
  ensureDirs();
  const p = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  ensureDirs();
  const p = path.join(DATA_DIR, file);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

// ── Settings ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = { demoMode: true, autoRefreshSec: 30, roadmapDelayMin: 0 };

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
}

function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  writeJson('settings.json', next);
  return next;
}

// ── Roadmap submissions ──────────────────────────────────────────────────────
function listRoadmaps() {
  return readJson('roadmaps.json', []);
}

function saveRoadmap(entry) {
  const all = listRoadmaps();
  all.unshift(entry);
  writeJson('roadmaps.json', all.slice(0, 2000));
  return entry;
}

function getRoadmap(id) {
  return listRoadmaps().find((r) => r.id === id) || null;
}

function updateRoadmap(id, patch) {
  const all = listRoadmaps();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeJson('roadmaps.json', all);
  return all[idx];
}

// ── File vault ───────────────────────────────────────────────────────────────
const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.csv', '.xlsx', '.docx', '.pptx', '.txt', '.md', '.zip', '.json', '.mp4', '.mp3'];
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB

function listFiles() {
  return readJson('files.json', []);
}

function saveFile({ name, dataB64 }) {
  const ext = path.extname(name || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new Error(`File type ${ext || '(none)'} not allowed`);
  const buf = Buffer.from(dataB64, 'base64');
  if (buf.length === 0) throw new Error('Empty file');
  if (buf.length > MAX_FILE_BYTES) throw new Error('File exceeds 12 MB limit');

  ensureDirs();
  const id = crypto.randomBytes(10).toString('hex');
  const safeName = String(name).replace(/[^\w.\- ]/g, '_').slice(0, 120);
  fs.writeFileSync(path.join(UPLOADS_DIR, id + ext), buf);

  const meta = { id, name: safeName, ext, size: buf.length, uploadedAt: new Date().toISOString() };
  const all = listFiles();
  all.unshift(meta);
  writeJson('files.json', all);
  return meta;
}

function getFilePath(id) {
  const meta = listFiles().find((f) => f.id === id);
  if (!meta) return null;
  const p = path.join(UPLOADS_DIR, meta.id + meta.ext);
  return fs.existsSync(p) ? { path: p, meta } : null;
}

function deleteFile(id) {
  const all = listFiles();
  const meta = all.find((f) => f.id === id);
  if (!meta) return false;
  const p = path.join(UPLOADS_DIR, meta.id + meta.ext);
  try { fs.unlinkSync(p); } catch { /* already gone */ }
  writeJson('files.json', all.filter((f) => f.id !== id));
  return true;
}

module.exports = {
  getSettings, setSettings,
  listRoadmaps, saveRoadmap, getRoadmap, updateRoadmap,
  listFiles, saveFile, getFilePath, deleteFile,
  ALLOWED_EXT, MAX_FILE_BYTES,
};
