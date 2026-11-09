/* Sunucu (Worker) varsa onun üzerinden, yoksa doğrudan ücretsiz uç noktalardan çalışır. */
window.API = (function () {
  'use strict';

  var state = {
    user: null,
    mode: 'dev',           // 'worker' | 'dev'
    base: ''
  };

  var IMAGE_HOST = 'https://image.pollinations.ai';
  var AUDIO_HOST = 'https://gen.pollinations.ai';

  function jsonFetch(url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) {
          var err = new Error(body.error || ('HTTP ' + r.status));
          err.status = r.status;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  }

  async function session() {
    try {
      var res = await jsonFetch('/api/session', { cache: 'no-store' });
      state.user = res.user || null;
      state.mode = 'worker';
      if (!state.user) {
        var e = new Error('Oturum yok');
        e.status = 401;
        throw e;
      }
      return state.user;
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) throw err;
      // Sunucu yok (yerel geliştirme): doğrudan mod
      state.mode = 'dev';
      state.user = { name: 'Geliştirme', dev: true };
      return state.user;
    }
  }

  async function login(code) {
    var res = await jsonFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code })
    });
    state.mode = 'worker';
    state.user = res.user || null;
    return res.user;
  }

  async function logout() {
    try {
      await jsonFetch('/api/logout', { method: 'POST' });
    } catch (err) { /* yoksay */ }
    state.user = null;
  }

  function voiceUrl(text, voice) {
    var q = 'text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice || 'nova');
    if (state.mode === 'worker') return '/api/ai/voice?' + q;
    return AUDIO_HOST + '/audio/' + encodeURIComponent(text) + '?voice=' + encodeURIComponent(voice || 'nova');
  }

  async function voice(text, voice) {
    var url = voiceUrl(text, voice);
    var res = await fetch(url, { credentials: state.mode === 'worker' ? 'same-origin' : 'omit' });
    if (!res.ok) {
      throw new Error(await errorText(res, 'Seslendirme başarısız'));
    }
    var blob = await res.blob();
    if (!blob.size) throw new Error('Ses boş döndü, tekrar dene.');
    return blob;
  }

  async function errorText(res, fallback) {
    var text = '';
    try {
      var raw = await res.text();
      try {
        var body = JSON.parse(raw);
        text = typeof body.error === 'string' ? body.error : (body.error ? JSON.stringify(body.error) : '');
        if (!text && body.message) text = String(body.message);
      } catch (e) {
        text = raw.slice(0, 160);
      }
    } catch (e) { /* yoksay */ }
    return (fallback || 'İstek başarısız') + (text ? ': ' + text : ' (HTTP ' + res.status + ')');
  }

  function imageUrl(prompt, opts) {
    opts = opts || {};
    var w = opts.width || 1024;
    var h = opts.height || 1024;
    var model = opts.model || 'flux';
    var seed = opts.seed || Math.floor(Math.random() * 1e9);
    var q = 'width=' + w + '&height=' + h + '&model=' + encodeURIComponent(model) + '&seed=' + seed + '&nologo=true';
    if (state.mode === 'worker') {
      return '/api/ai/image?prompt=' + encodeURIComponent(prompt) + '&' + q;
    }
    return IMAGE_HOST + '/prompt/' + encodeURIComponent(prompt) + '?' + q;
  }

  function directImageUrl(prompt, opts) {
    opts = opts || {};
    var q = 'width=' + (opts.width || 1024) + '&height=' + (opts.height || 1024) +
      '&model=' + encodeURIComponent(opts.model || 'flux') +
      '&seed=' + (opts.seed || Math.floor(Math.random() * 1e9)) + '&nologo=true';
    return IMAGE_HOST + '/prompt/' + encodeURIComponent(prompt) + '?' + q;
  }

  async function image(prompt, opts) {
    var firstError = null;
    var res = await fetch(imageUrl(prompt, opts), {
      credentials: state.mode === 'worker' ? 'same-origin' : 'omit',
      cache: 'no-store'
    });
    if (!res.ok) {
      firstError = new Error(await errorText(res, 'Görsel üretilemedi'));
    } else {
      var blob = await res.blob();
      if (blob.size) return blob;
      firstError = new Error('Görsel boş döndü, tekrar dene.');
    }
    // Worker köprüsü kotaya takıldıysa kullanıcının kendi IP'sinden doğrudan dene
    if (state.mode === 'worker') {
      try {
        var direct = await fetch(directImageUrl(prompt, opts), { credentials: 'omit', cache: 'no-store' });
        if (direct.ok) {
          var directBlob = await direct.blob();
          if (directBlob.size) return directBlob;
        }
      } catch (e) { /* ilk hatayı bildir */ }
    }
    throw firstError || new Error('Görsel üretilemedi');
  }

  function mode() { return state.mode; }
  function user() { return state.user; }

  return {
    session: session,
    login: login,
    logout: logout,
    voice: voice,
    voiceUrl: voiceUrl,
    image: image,
    imageUrl: imageUrl,
    mode: mode,
    user: user
  };
})();
