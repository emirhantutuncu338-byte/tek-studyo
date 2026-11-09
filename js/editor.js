/* Kurgu motoru: klip listesi + canvas önizleme + MediaRecorder ile dışa aktarma */
window.Editor = (function () {
  'use strict';

  var ASPECTS = { '9:16': [540, 960], '1:1': [720, 720], '16:9': [960, 540] };

  var canvas = null;
  var ctx = null;
  var W = 540, H = 960;

  var clips = [];
  var selectedId = null;
  var playing = false;
  var playhead = 0;
  var rafId = null;
  var lastTs = 0;
  var activeIndex = -1;
  var seq = 0;

  var listeners = [];
  var tickers = [];
  var stopResolvers = [];

  var musicEl = null;
  var musicName = '';
  var musicVolume = 0.8;
  var audioCtx = null;
  var audioSrc = null;
  var audioDest = null;

  /* ---------- yardımcılar ---------- */

  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function tick(t, total) { tickers.forEach(function (fn) { try { fn(t, total); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }
  function onTick(fn) { tickers.push(fn); }

  function clipDur(c) {
    return Math.max(0.3, (c.trimEnd || 0) - (c.trimStart || 0));
  }

  function totalDur() {
    var t = 0;
    for (var i = 0; i < clips.length; i++) t += clipDur(clips[i]);
    return t;
  }

  function startsArray() {
    var out = [], t = 0;
    for (var i = 0; i < clips.length; i++) {
      out.push(t);
      t += clipDur(clips[i]);
    }
    return out;
  }

  function indexAt(time) {
    var s = startsArray();
    for (var i = 0; i < clips.length; i++) {
      if (time < s[i] + clipDur(clips[i])) return i;
    }
    return clips.length - 1;
  }

  function clearStage() {
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '600 ' + Math.round(H * 0.028) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Klip ekleyince burada görünür', W / 2, H / 2);
    ctx.textAlign = 'start';
  }

  /* ---------- çizim ---------- */

  function drawCover(el, scaleBoost, offsetX, offsetY) {
    var sw = el.videoWidth || el.naturalWidth || 0;
    var sh = el.videoHeight || el.naturalHeight || 0;
    if (!sw || !sh) return false;
    var scale = Math.max(W / sw, H / sh) * (scaleBoost || 1);
    var dw = sw * scale;
    var dh = sh * scale;
    var dx = (W - dw) / 2 + (offsetX || 0);
    var dy = (H - dh) / 2 + (offsetY || 0);
    ctx.drawImage(el, dx, dy, dw, dh);
    return true;
  }

  function wrapText(text, maxWidth) {
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawText(c) {
    if (!c.text) return;
    var size = Math.round(H * 0.045);
    ctx.font = '700 ' + size + 'px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var maxW = W * 0.86;
    var lines = wrapText(c.text, maxW);
    var lh = size * 1.28;
    var blockH = lines.length * lh;
    var baseY = c.textPos === 'top' ? H * 0.14 : (c.textPos === 'middle' ? H / 2 : H * 0.84);
    var top = baseY - blockH / 2 + lh / 2;
    lines.forEach(function (line, i) {
      var y = top + i * lh;
      ctx.save();
      ctx.lineWidth = Math.max(4, size * 0.16);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineJoin = 'round';
      ctx.strokeText(line, W / 2, y, maxW);
      ctx.fillStyle = c.textColor || '#ffffff';
      ctx.fillText(line, W / 2, y, maxW);
      ctx.restore();
    });
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawClip(c, local) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (c.kind === 'video') {
      var ready = c.el.readyState >= 2;
      if (ready) {
        drawCover(c.el, 1, 0, 0);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '600 ' + Math.round(H * 0.026) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('video hazırlanıyor…', W / 2, H / 2);
        ctx.textAlign = 'start';
      }
    } else {
      var d = clipDur(c);
      var p = d > 0 ? Math.max(0, Math.min(1, local / d)) : 0;
      var motion = c.motion || 'zoomIn';
      var boost = 1, ox = 0, oy = 0;
      if (motion === 'zoomIn') boost = 1 + 0.07 * p;
      else if (motion === 'zoomOut') boost = 1.07 - 0.07 * p;
      else if (motion === 'pan') { boost = 1.1; ox = (0.5 - p) * W * 0.08; }
      if (!drawCover(c.el, boost, ox, oy)) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '600 ' + Math.round(H * 0.026) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('fotoğraf yükleniyor…', W / 2, H / 2);
        ctx.textAlign = 'start';
      }
    }
    drawText(c);
  }

  function renderAt(time) {
    if (!ctx || !clips.length) { clearStage(); return; }
    var idx = indexAt(time);
    var s = startsArray();
    var c = clips[idx];
    if (!c) { clearStage(); return; }
    var local = Math.max(0, Math.min(time - s[idx], clipDur(c)));
    drawClip(c, local);
  }

  /* ---------- oynatma ---------- */

  function pauseAllVideos(exceptIndex) {
    for (var i = 0; i < clips.length; i++) {
      if (i === exceptIndex) continue;
      if (clips[i].kind === 'video' && !clips[i].el.paused) clips[i].el.pause();
    }
  }

  function syncActive(idx) {
    if (idx === activeIndex) return;
    activeIndex = idx;
    var c = clips[idx];
    if (!c) return;
    pauseAllVideos(idx);
    if (playing && c.kind === 'video') {
      try { c.el.currentTime = c.trimStart; } catch (e) { /* henüz hazır değil */ }
      var p = c.el.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function frame(ts) {
    if (!playing) return;
    var dt = lastTs ? Math.min(0.12, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    var total = totalDur();
    playhead += dt;

    if (playhead >= total) {
      playhead = total;
      renderAt(Math.max(0, total - 0.001));
      tick(playhead, total);
      finish();
      return;
    }

    var idx = indexAt(playhead);
    syncActive(idx);

    // video gerçek zamanlı oynuyorsa kaymayı düzelt
    var c = clips[idx];
    if (c && c.kind === 'video' && playing) {
      var s = startsArray()[idx];
      var shouldBe = c.trimStart + (playhead - s);
      if (Math.abs(c.el.currentTime - shouldBe) > 0.35) {
        try { c.el.currentTime = shouldBe; } catch (e) { /* yoksay */ }
      }
    }

    renderAt(playhead);
    tick(playhead, total);
    rafId = requestAnimationFrame(frame);
  }

  function finish() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pauseAllVideos(-1);
    if (musicEl) musicEl.pause();
    stopResolvers.splice(0).forEach(function (fn) { fn(); });
    emit();
  }

  function play(fromStart) {
    if (!clips.length) return false;
    if (playing) return true;
    if (fromStart !== false) playhead = 0;
    playing = true;
    lastTs = 0;
    activeIndex = -1;
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
    if (musicEl && musicEl.src) {
      musicEl.currentTime = 0;
      var p = musicEl.play();
      if (p && p.catch) p.catch(function () {});
    }
    syncActive(indexAt(playhead));
    renderAt(playhead);
    rafId = requestAnimationFrame(frame);
    emit();
    return true;
  }

  function pause() {
    if (!playing) return;
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    pauseAllVideos(-1);
    if (musicEl) musicEl.pause();
    emit();
  }

  function toggle() {
    if (playing) pause();
    else play(playhead >= totalDur() - 0.01);
  }

  function seek(t) {
    playhead = Math.max(0, Math.min(t, totalDur()));
    renderAt(playhead);
    tick(playhead, totalDur());
  }

  /* ---------- ses ---------- */

  function ensureAudio() {
    if (!musicEl) return;
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        audioCtx = new AC();
        audioSrc = audioCtx.createMediaElementSource(musicEl);
        audioDest = audioCtx.createMediaStreamDestination();
        audioSrc.connect(audioCtx.destination);
        audioSrc.connect(audioDest);
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
  }

  function setMusic(file) {
    if (!musicEl) {
      musicEl = new Audio();
      musicEl.preload = 'auto';
    }
    if (musicEl.dataset.url) URL.revokeObjectURL(musicEl.dataset.url);
    var url = URL.createObjectURL(file);
    musicEl.dataset.url = url;
    musicEl.src = url;
    musicEl.volume = musicVolume;
    musicName = file.name || 'ses';
    emit();
  }

  function setMusicUrl(url, name) {
    if (!musicEl) { musicEl = new Audio(); musicEl.preload = 'auto'; }
    musicEl.src = url;
    musicEl.volume = musicVolume;
    musicName = name || 'ses';
    emit();
  }

  function setVolume(v) {
    musicVolume = v;
    if (musicEl) musicEl.volume = v;
  }

  /* ---------- klipler ---------- */

  function addVideoFile(file) {
    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    var clip = {
      id: 'c' + (++seq),
      kind: 'video',
      name: file.name || 'video',
      url: url,
      el: v,
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      text: '',
      textColor: '#ffffff',
      textPos: 'bottom',
      motion: null
    };
    v.addEventListener('loadedmetadata', function () {
      var d = isFinite(v.duration) && v.duration > 0 ? v.duration : 5;
      clip.duration = d;
      if (!clip.trimEnd) clip.trimEnd = d;
      emit();
    });
    v.addEventListener('loadeddata', function () { renderAt(playhead); });
    clips.push(clip);
    selectedId = clip.id;
    emit();
  }

  function addImageFile(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.src = url;
    var clip = {
      id: 'c' + (++seq),
      kind: 'image',
      name: file.name || 'fotoğraf',
      url: url,
      el: img,
      duration: 3,
      trimStart: 0,
      trimEnd: 3,
      text: '',
      textColor: '#ffffff',
      textPos: 'bottom',
      motion: 'zoomIn'
    };
    img.addEventListener('load', function () { renderAt(playhead); emit(); });
    clips.push(clip);
    selectedId = clip.id;
    emit();
  }

  function addFiles(fileList) {
    Array.prototype.slice.call(fileList).forEach(function (file) {
      if (!file) return;
      if (file.type.indexOf('video/') === 0) addVideoFile(file);
      else if (file.type.indexOf('image/') === 0) addImageFile(file);
      else if (file.type.indexOf('audio/') === 0) setMusic(file);
    });
    renderAt(playhead);
    emit();
  }

  function addImageBlob(blob, name) {
    var file = new File([blob], name || ('gorsel-' + Date.now() + '.jpg'), { type: blob.type || 'image/jpeg' });
    addImageFile(file);
    return clips[clips.length - 1];
  }

  function loadImages(files, per, motion) {
    clear();
    Array.prototype.slice.call(files).forEach(function (file) {
      addImageFile(file);
      var c = clips[clips.length - 1];
      c.trimEnd = per;
      c.duration = per;
      c.motion = motion || 'zoomIn';
    });
    selectedId = clips.length ? clips[0].id : null;
    playhead = 0;
    renderAt(0);
    emit();
  }

  function getClip(id) {
    for (var i = 0; i < clips.length; i++) if (clips[i].id === id) return clips[i];
    return null;
  }

  function select(id) { selectedId = id; emit(); }

  function remove(id) {
    var idx = -1;
    for (var i = 0; i < clips.length; i++) if (clips[i].id === id) idx = i;
    if (idx < 0) return;
    var c = clips[idx];
    if (c.el && c.kind === 'video') { c.el.pause(); c.el.removeAttribute('src'); }
    if (c.url) URL.revokeObjectURL(c.url);
    clips.splice(idx, 1);
    if (selectedId === id) selectedId = clips.length ? clips[Math.min(idx, clips.length - 1)].id : null;
    renderAt(playhead);
    emit();
  }

  function move(id, dir) {
    var idx = -1;
    for (var i = 0; i < clips.length; i++) if (clips[i].id === id) idx = i;
    var to = idx + dir;
    if (idx < 0 || to < 0 || to >= clips.length) return;
    var tmp = clips[idx];
    clips[idx] = clips[to];
    clips[to] = tmp;
    renderAt(playhead);
    emit();
  }

  function setTrim(id, start, end) {
    var c = getClip(id);
    if (!c) return;
    var min = 0;
    var max = c.kind === 'video' ? (c.duration || 5) : 20;
    start = Math.max(min, Math.min(start, max - 0.3));
    end = Math.max(start + 0.3, Math.min(end, max));
    c.trimStart = Math.round(start * 100) / 100;
    c.trimEnd = Math.round(end * 100) / 100;
    if (c.kind === 'video' && c.el) {
      try { c.el.currentTime = c.trimStart; } catch (e) { /* yoksay */ }
    }
    renderAt(Math.min(playhead, totalDur()));
    emit();
  }

  function patch(id, obj) {
    var c = getClip(id);
    if (!c) return;
    Object.keys(obj).forEach(function (k) { c[k] = obj[k]; });
    renderAt(playhead);
    emit();
  }

  function clear() {
    pause();
    clips.forEach(function (c) {
      if (c.kind === 'video') { c.el.pause(); c.el.removeAttribute('src'); }
      if (c.url) URL.revokeObjectURL(c.url);
    });
    clips = [];
    selectedId = null;
    playhead = 0;
    activeIndex = -1;
    clearStage();
    tick(0, 0);
    emit();
  }

  function setAspect(a) {
    if (!ASPECTS[a]) a = '9:16';
    var dims = ASPECTS[a];
    W = dims[0];
    H = dims[1];
    if (canvas) {
      canvas.width = W;
      canvas.height = H;
    }
    playhead = 0;
    renderAt(0);
    emit();
  }

  /* ---------- dışa aktarma ---------- */

  function waitForEnd() {
    if (!playing) return Promise.resolve();
    return new Promise(function (res) { stopResolvers.push(res); });
  }

  async function exportVideo() {
    if (!clips.length) throw new Error('Önce kurguya klip ekle.');
    if (!window.MediaRecorder) throw new Error('Bu tarayıcı video kaydını desteklemiyor.');

    seek(0);
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (e) { /* yoksay */ }
    }

    var stream = canvas.captureStream(30);
    if (audioDest && musicEl && musicEl.src) {
      audioDest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
    }

    var mime = '';
    ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].some(function (m) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) { mime = m; return true; }
      return false;
    });

    var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var finished = new Promise(function (res) {
      rec.onstop = function () { res(new Blob(chunks, { type: 'video/webm' })); };
    });

    rec.start(250);
    play(true);
    // sekme arka plana alınırsa animasyon durur; sonsuza kadar beklememek için üst sınır
    await Promise.race([
      waitForEnd(),
      new Promise(function (r) { setTimeout(r, totalDur() * 1000 + 8000); })
    ]);
    if (playing) finish();
    await new Promise(function (r) { setTimeout(r, 350); });
    rec.stop();
    return finished;
  }

  /* ---------- başlat ---------- */

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    setAspect('9:16');
    clearStage();
  }

  return {
    init: init,
    on: on,
    onTick: onTick,
    addFiles: addFiles,
    addImageBlob: addImageBlob,
    loadImages: loadImages,
    select: select,
    remove: remove,
    move: move,
    setTrim: setTrim,
    patch: patch,
    clear: clear,
    setAspect: setAspect,
    setMusic: setMusic,
    setMusicUrl: setMusicUrl,
    setVolume: setVolume,
    play: play,
    pause: pause,
    toggle: toggle,
    seek: seek,
    exportVideo: exportVideo,
    clipDur: clipDur,
    totalDur: totalDur,
    clips: function () { return clips; },
    selectedId: function () { return selectedId; },
    musicName: function () { return musicName; },
    isPlaying: function () { return playing; },
    time: function () { return playhead; }
  };
})();
