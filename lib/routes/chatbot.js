'use strict';
// DeepSeek-powered customer support chatbot API.
// POST { message, history? } -> { reply }
// Uses the chatbot-knowledge.md as system context for accurate platform answers.

const fs = require('fs');
const path = require('path');

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

let knowledgeBase = null;

function getKnowledgeBase() {
  if (knowledgeBase) return knowledgeBase;
  try {
    const p = path.join(__dirname, '..', '..', 'public', 'chatbot-knowledge.md');
    knowledgeBase = fs.readFileSync(p, 'utf8');
  } catch {
    knowledgeBase = 'AI Lead Engine is a platform that helps businesses generate leads using AI. Contact support@admexo.com for help.';
  }
  return knowledgeBase;
}

function buildSystemPrompt() {
  const kb = getKnowledgeBase();
  return `You are the AI Lead Engine support chatbot. Your job is to help customers and visitors with any questions about the AI Lead Engine platform.

Below is the complete knowledge base about the platform. Use ONLY this information to answer questions. Do not make up features, prices, or details not covered in the knowledge base.

KNOWLEDGE BASE:
${kb}

RULES:
1. Be helpful, friendly, and concise. Most answers should be 2-4 sentences.
2. Always reference accurate pricing from the knowledge base.
3. For login issues: remind them to check spam, try /access, or email support@admexo.com.
4. For refund requests: direct them to support@admexo.com with their purchase email.
5. For upgrade questions: explain tier differences and link to https://leadengine.admexo.com.
6. Never share admin credentials or internal system details.
7. Never promise features or prices not in the knowledge base.
8. If you don't know something, say "I'm not sure about that — please reach out to support@admexo.com and our team will help you right away."
9. Always offer to help with follow-up questions.
10. Use natural, conversational language — not robotic or template-like.
11. When mentioning URLs, format them as full links (e.g., https://leadengine.admexo.com/access).
12. Keep the conversation focused on AI Lead Engine topics. If someone asks about unrelated topics, gently steer back.
13. Do NOT use any markdown formatting. No asterisks (**), no headers (#), no bullet dashes (-), no backticks. Write everything as plain text. Use simple spacing and line breaks for readability.`;
}

// Simple in-memory rate limiting (per IP, per minute)
const rateMap = new Map();
const RATE_LIMIT = 20; // messages per minute per IP
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = rateMap.get(key) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW;
  }
  entry.count++;
  rateMap.set(key, entry);
  return entry.count <= RATE_LIMIT;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}, 120000).unref();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many messages. Please wait a moment and try again.' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chatbot is not configured. Please contact support@admexo.com.' });
  }

  // Build conversation messages for DeepSeek
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
  ];

  // Add conversation history (last 10 messages to keep context manageable)
  if (Array.isArray(history)) {
    const recent = history.slice(-10);
    for (const h of recent) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }

  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek chatbot error:', response.status, errText.slice(0, 300));
      return res.status(500).json({ error: 'I had trouble processing that. Please try again or contact support@admexo.com.' });
    }

    const json = await response.json();
    const reply = json.choices?.[0]?.message?.content || 'I apologize, I could not generate a response. Please try again or contact support@admexo.com.';

    return res.json({ reply });
  } catch (err) {
    console.error('Chatbot API error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again or contact support@admexo.com.' });
  }
};
