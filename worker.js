/**
 * Tek Stüdyo — erişim kapısı + ücretsiz AI köprüsü.
 *
 * Ortam değişkenleri:
 *   INVITE_CODES    "kod1=Ada,kod2=Mert"  (Sites → Secrets; zorunlu)
 *   SESSION_SECRET  rastgele uzun bir metin (Sites → Secrets; zorunlu)
 *   POLLINATIONS_KEY ücretsiz anahtar (enter.pollinations.ai/keys; ses + görsel için önerilir)
 *   ASSETS         statik dosyalar (platform tarafından bağlanır)
 */

const COOKIE = 'ts_session';
const SESSION_TTL = 7 * 24 * 3600; // 7 gün
const MAX_TTS_CHARS = 900;

const enc = new TextEncoder();

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}

async function sign(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = b64url(await hmac(secret, body));
  return body + '.' + mac;
}

async function verify(secret, token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const expected = b64url(await hmac(secret, body));
  if (mac.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCodes(raw) {
  const map = new Map();
  if (!raw) return map;
  for (const part of raw.split(',')) {
    const item = part.trim();
    if (!item) continue;
    const idx = item.indexOf('=');
    const code = (idx < 0 ? item : item.slice(0, idx)).trim();
    const name = (idx < 0 ? 'Kullanıcı' : item.slice(idx + 1)).trim();
    if (code) map.set(code, name || 'Kullanıcı');
  }
  return map;
}

function cookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const chunk of header.split(';')) {
    const [k, ...rest] = chunk.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra
    }
  });
}

function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // form gönderimi / curl
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

async function currentUser(request, env) {
  if (!env.SESSION_SECRET) return null;
  const payload = await verify(env.SESSION_SECRET, cookieValue(request, COOKIE));
  if (!payload || !payload.u) return null;
  return { name: payload.u };
}

/* --- basit hız sınırı (isolate başına) --- */
const buckets = new Map();
function rateLimited(user, kind, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const key = user + ':' + kind;
  const cur = buckets.get(key);
  if (!cur || cur.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowSec });
    return false;
  }
  if (cur.count >= limit) return true;
  cur.count += 1;
  return false;
}

function upstreamHeaders(env) {
  const headers = { 'User-Agent': 'TekStudyoo/1.0' };
  if (env.POLLINATIONS_KEY) headers.Authorization = 'Bearer ' + env.POLLINATIONS_KEY;
  return headers;
}

const LOGIN_HTML = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tek Stüdyo — giriş</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a10;color:#f3eefb;
font-family:"Segoe UI",system-ui,sans-serif;background-image:radial-gradient(800px 400px at 20% 0%,rgba(139,108,255,.22),transparent 70%)}
.card{width:min(92vw,370px);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;
background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02))}
h1{margin:0 0 6px;font-size:24px;letter-spacing:-.02em}p{color:#9c93b0;font-size:13px;margin:0 0 18px}
input{width:100%;padding:13px;border-radius:11px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);
color:#fff;font:inherit;letter-spacing:.12em;margin-bottom:10px}
button{width:100%;padding:12px;border:0;border-radius:11px;font:inherit;font-weight:700;cursor:pointer;
background:linear-gradient(120deg,#8b6cff,#6d5bdb);color:#fff}
#msg{color:#ff6b81;font-size:12.5px;min-height:16px;margin-top:10px}
</style></head><body>
<div class="card">
  <h1>Tek Stüdyo</h1>
  <p>Bu alan davetli kullanıcılara açıktır. Erişim kodunu gir.</p>
  <form method="post" action="/api/login" id="f">
    <input name="code" id="code" type="password" placeholder="Erişim kodu" autocomplete="current-password" required>
    <button type="submit">Giriş yap</button>
  </form>
  <div id="msg"></div>
</div>
<script>
document.getElementById('f').addEventListener('submit', async function (e) {
  e.preventDefault();
  var msg = document.getElementById('msg');
  msg.textContent = '';
  try {
    var r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: document.getElementById('code').value })
    });
    var body = await r.json().catch(function () { return {}; });
    if (!r.ok) { msg.textContent = body.error || 'Kod geçersiz.'; return; }
    location.replace('/');
  } catch (err) { msg.textContent = 'Bağlantı hatası, tekrar dene.'; }
});
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ---------- oturum ---------- */
    if (path === '/api/session') {
      const user = await currentUser(request, env);
      if (!user) return json({ error: 'Oturum gerekli' }, 401);
      return json({ user });
    }

    if (path === '/api/login' && request.method === 'POST') {
      if (!sameOrigin(request, url)) return json({ error: 'Geçersiz kaynak.' }, 403);
      if (!env.INVITE_CODES || !env.SESSION_SECRET) {
        return json({ error: 'Sunucu yapılandırması eksik: INVITE_CODES / SESSION_SECRET.' }, 503);
      }
      let code = '';
      const ctype = request.headers.get('Content-Type') || '';
      if (ctype.includes('application/json')) {
        const body = await request.json().catch(() => ({}));
        code = String(body.code || '').trim();
      } else {
        const form = await request.formData().catch(() => null);
        code = form ? String(form.get('code') || '').trim() : '';
      }
      if (!code) return json({ error: 'Kod gerekli.' }, 400);

      const codes = parseCodes(env.INVITE_CODES);
      let name = null;
      for (const [c, n] of codes) {
        if (equal(c, code)) { name = n; break; }
      }
      if (!name) {
        const ip = request.headers.get('CF-Connecting-IP') || 'anon';
        if (rateLimited(ip, 'login', 8, 600)) return json({ error: 'Çok fazla deneme. 10 dakika bekle.' }, 429);
        return json({ error: 'Kod geçersiz.' }, 401);
      }

      const token = await sign(env.SESSION_SECRET, {
        u: name,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL
      });

      return json({ user: { name } }, 200, {
        'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}; Secure`
      });
    }

    if (path === '/api/logout') {
      if (!sameOrigin(request, url)) return json({ error: 'Geçersiz kaynak.' }, 403);
      return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure` });
    }

    /* ---------- girişli alan ---------- */
    const user = await currentUser(request, env);

    if (path.startsWith('/api/ai/')) {
      if (!user) return json({ error: 'Oturum gerekli' }, 401);

      if (path === '/api/ai/voice') {
        const text = (url.searchParams.get('text') || '').trim();
        const voice = (url.searchParams.get('voice') || 'nova').replace(/[^a-z0-9_-]/gi, '');
        if (!text) return json({ error: 'Metin boş.' }, 400);
        if (text.length > MAX_TTS_CHARS) return json({ error: `Metin en fazla ${MAX_TTS_CHARS} karakter.` }, 400);
        if (rateLimited(user.name, 'voice', 40, 3600)) return json({ error: 'Saatlik seslendirme sınırı doldu.' }, 429);

        const upstream = 'https://gen.pollinations.ai/audio/' + encodeURIComponent(text) + '?voice=' + voice;
        const res = await fetch(upstream, { headers: upstreamHeaders(env) });
        if (!res.ok) return json({ error: 'Seslendirme servisi yanıt vermedi (' + res.status + ').' }, 502);
        return new Response(res.body, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
            'Cache-Control': 'private, max-age=3600',
            'Content-Disposition': 'inline; filename="seslendirme.mp3"'
          }
        });
      }

      if (path === '/api/ai/image') {
        const prompt = (url.searchParams.get('prompt') || '').trim();
        if (!prompt) return json({ error: 'Prompt boş.' }, 400);
        if (prompt.length > 600) return json({ error: 'Prompt en fazla 600 karakter.' }, 400);
        if (rateLimited(user.name, 'image', 60, 3600)) return json({ error: 'Saatlik görsel sınırı doldu.' }, 429);

        const w = Math.min(1536, Math.max(256, parseInt(url.searchParams.get('width') || '1024', 10) || 1024));
        const h = Math.min(1536, Math.max(256, parseInt(url.searchParams.get('height') || '1024', 10) || 1024));
        const model = (url.searchParams.get('model') || 'flux').replace(/[^a-z0-9_-]/gi, '');
        const seed = parseInt(url.searchParams.get('seed') || '0', 10) || Math.floor(Math.random() * 1e9);

        const upstream = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
          `?width=${w}&height=${h}&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true`;
        const res = await fetch(upstream, { headers: upstreamHeaders(env) });
        if (!res.ok) return json({ error: 'Görsel servisi yanıt vermedi (' + res.status + ').' }, 502);
        return new Response(res.body, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'private, max-age=86400'
          }
        });
      }

      return json({ error: 'Bilinmeyen uç nokta' }, 404);
    }

    if (path.startsWith('/api/')) return json({ error: 'Bilinmeyen uç nokta' }, 404);

    /* ---------- statik dosyalar ---------- */
    const wantsHtml = !path.includes('.') || path.endsWith('.html');
    if (!user && wantsHtml) {
      return new Response(LOGIN_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
