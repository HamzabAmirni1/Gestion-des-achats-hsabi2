/**
 * AI Service for Brasti ERP
 * Powered by Google Gemini Web & Multi-tier AI Engine
 * Ported from bot-hamza-amirni-v2-master by Hamza Amirni
 */

// Helper to clean Markdown links from AI response
export function cleanAIResponse(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;

  // Remove [url](url) -> url
  cleaned = cleaned.replace(/\[\s*(https?:\/\/[^\s\]]+)\s*\]\(\s*https?:\/\/[^\s\)]+\s*\)/gi, '$1');
  // Remove [Label](url) -> Label: url
  cleaned = cleaned.replace(/(:\s*)?\[\s*([^\]\n]+?)\s*\]\(\s*(https?:\/\/[^\s\)]+)\s*\)/gi, (m, colon, label, url) => {
    return colon ? `${colon}${url.trim()}` : `${label.trim()} : ${url.trim()}`;
  });
  // Clean brackets around URLs
  cleaned = cleaned.replace(/\[\s*(https?:\/\/[^\s\]]+)\s*\]/gi, '$1');
  // Clean excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

// Safe cross-browser fetch with timeout (works on all mobile & desktop browsers)
function safeFetch(url, options = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => {
    try { ctrl.abort(); } catch (_) {}
  }, timeoutMs);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/**
 * Main function to request AI response:
 * 1. Calls Netlify Serverless Function (Google Gemini Web StreamGenerate RPC)
 * 2. Client-side fallback to fast AI API if Netlify function is unavailable
 */
export async function getGeminiReply(prompt, systemPrompt = '', history = []) {
  // 1. Try Netlify Serverless Function (Gemini Web)
  try {
    const res = await safeFetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt, history })
    }, 12000);

    if (res && res.ok) {
      const data = await res.json();
      if (data?.reply && typeof data.reply === 'string' && data.reply.trim().length > 1) {
        return cleanAIResponse(data.reply);
      }
    }
  } catch (err) {
    console.warn('Netlify function unavailable, attempting direct fallback...', err?.message);
  }

  // 2. Direct client-side Fallback (Pollinations with CORS support)
  try {
    const res = await safeFetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...(Array.isArray(history) ? history.slice(-4) : []),
          { role: 'user', content: prompt }
        ],
        model: 'openai',
        temperature: 0.7
      })
    }, 8000);

    if (res && res.ok) {
      const txt = await res.text();
      if (txt && typeof txt === 'string' && txt.trim().length > 1 && !txt.includes('<html>')) {
        return cleanAIResponse(txt);
      }
    }
  } catch (err) {
    console.warn('Client fallback failed:', err?.message);
  }

  return null;
}

export default {
  getGeminiReply,
  cleanAIResponse
};
