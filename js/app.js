/* Arayüz: oturum, görünüm yönlendirme, seslendirme, görsel, video, araç panosu */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var current = 'home';
  var toastTimer = null;

  /* ---------- yardımcılar ---------- */

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function fmt(sec) {
    sec = Math.max(0, sec || 0);
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return m > 0 ? m + ':' + (s < 10 ? '0' : '') + s.toFixed(1) : s.toFixed(1) + 's';
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.disabled = true;
      btn.textContent = label || '…';
    } else {
      btn.disabled = false;
      btn.textContent = label || btn.dataset.label || btn.textContent;
    }
  }

  /* ---------- istatistikler ---------- */

  var stats = {};
  try { stats = JSON.parse(localStorage.getItem('ts_stats') || '{}') || {}; } catch (e) { stats = {}; }

  function bump(key, n) {
    stats[key] = (stats[key] || 0) + (n || 1);
    try { localStorage.setItem('ts_stats', JSON.stringify(stats)); } catch (e) { /* yoksay */ }
    paintStats();
  }

  function paintStats() {
    $('statVoice').textContent = stats.voice || 0;
    $('statImage').textContent = stats.image || 0;
    $('statClip').textContent = stats.clip || 0;
    $('statExport').textContent = stats.export || 0;
  }

  /* ---------- yönlendirme ---------- */

  var VIEWS = ['home', 'editor', 'voice', 'image', 'video', 'tools'];

  function show(view) {
    if (VIEWS.indexOf(view) < 0) view = 'home';
    current = view;
    VIEWS.forEach(function (v) {
      var sec = $('view-' + v);
      if (sec) sec.classList.toggle('active', v === view);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === view);
    });
    if (location.hash.replace('#', '') !== (view === 'home' ? '' : view)) {
      try { history.replaceState(null, '', view === 'home' ? location.pathname : '#' + view); } catch (e) { /* yoksay */ }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function routeFromHash() {
    var h = (location.hash || '').replace('#', '');
    show(VIEWS.indexOf(h) >= 0 ? h : 'home');
  }

  /* ---------- giriş ---------- */

  function showGate(msg) {
    $('appView').classList.add('hidden');
    $('gateView').classList.remove('hidden');
    if (msg) {
      $('loginMsg').textContent = msg;
      $('loginMsg').className = 'msg err';
    }
  }

  function boot(user) {
    $('gateView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    $('userName').textContent = user.name || 'Kullanıcı';
    $('helloName').textContent = user.name || '';
    $('usageNote').textContent = API.mode() === 'dev'
      ? 'Geliştirme modu — erişim kapısı sunucu tarafında çalışır.'
      : 'Oturum açık';
    paintStats();
    initEditor();
    initVoice();
    initImage();
    initVideo();
    initTools();
    routeFromHash();
  }

  function initLogin() {
    $('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var code = $('codeInput').value.trim();
      if (!code) return;
      setBusy($('loginBtn'), true, 'Kontrol ediliyor…');
      try {
        var user = await API.login(code);
        $('loginMsg').textContent = '';
        boot(user || { name: 'Kullanıcı' });
      } catch (err) {
        $('loginMsg').textContent = err.message || 'Kod geçersiz.';
        $('loginMsg').className = 'msg err';
      } finally {
        setBusy($('loginBtn'), false, 'Giriş yap');
      }
    });

    $('logoutBtn').addEventListener('click', async function () {
      await API.logout();
      location.reload();
    });
  }

  /* ---------- kurgu ---------- */

  function initEditor() {
    Editor.init($('stage'));
    Editor.on(function () { paintClips(); paintInspector(); paintTransport(); });
    Editor.onTick(function (t, total) {
      $('timeLabel').textContent = fmt(t) + ' / ' + fmt(total);
    });

    $('mediaInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) {
        Editor.addFiles(e.target.files);
        bump('clip', e.target.files.length);
        toast(e.target.files.length + ' medya eklendi');
      }
      e.target.value = '';
    });

    $('playBtn').addEventListener('click', function () {
      Editor.toggle();
    });

    $('aspectSel').addEventListener('change', function () {
      Editor.setAspect(this.value);
    });

    $('musicInput').addEventListener('change', function () {
      if (this.files && this.files[0]) {
        Editor.setMusic(this.files[0]);
        toast('Ses eklendi: ' + this.files[0].name);
      }
      this.value = '';
    });

    $('musicVol').addEventListener('input', function () {
      Editor.setVolume(parseFloat(this.value));
    });

    $('exportBtn').addEventListener('click', doExport);
    paintClips();
    paintInspector();
    paintTransport();
  }

  function paintTransport() {
    var playing = Editor.isPlaying();
    $('playBtn').textContent = playing ? '❚❚ Duraklat' : '▶ Oynat';
    $('stageEmpty').classList.toggle('hidden', Editor.clips().length > 0);
    $('musicName').textContent = Editor.musicName() || 'yok';
  }

  function paintClips() {
    var list = $('clipList');
    var clips = Editor.clips();
    var sel = Editor.selectedId();
    $('clipCount').textContent = clips.length + ' klip';
    list.innerHTML = '';
    if (!clips.length) {
      var p = document.createElement('p');
      p.className = 'tiny muted';
      p.textContent = 'Zaman çizelgesi boş. “+ Ekle” ile video veya fotoğraf yükle.';
      list.appendChild(p);
      return;
    }
    clips.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'clip-row' + (c.id === sel ? ' active' : '');
      row.dataset.id = c.id;

      var media;
      if (c.kind === 'image') {
        media = document.createElement('img');
        media.className = 'clip-thumb';
        media.src = c.url;
        media.alt = '';
      } else {
        media = document.createElement('video');
        media.className = 'clip-thumb';
        media.src = c.url;
        media.muted = true;
        media.preload = 'metadata';
      }
      row.appendChild(media);

      var meta = document.createElement('div');
      meta.className = 'clip-meta';
      var name = document.createElement('div');
      name.className = 'clip-name';
      name.textContent = (i + 1) + '. ' + c.name;
      var sub = document.createElement('div');
      sub.className = 'clip-sub';
      sub.textContent = (c.kind === 'image' ? 'fotoğraf' : 'video') + ' · ' + Editor.clipDur(c).toFixed(1) + ' sn';
      meta.appendChild(name);
      meta.appendChild(sub);
      row.appendChild(meta);

      [['↑', -1], ['↓', 1]].forEach(function (pair) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini-btn';
        b.textContent = pair[0];
        b.title = pair[0] === '↑' ? 'Yukarı taşı' : 'Aşağı taşı';
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          Editor.move(c.id, pair[1]);
        });
        row.appendChild(b);
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'mini-btn danger';
      del.textContent = '✕';
      del.title = 'Kaldır';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        Editor.remove(c.id);
      });
      row.appendChild(del);

      row.addEventListener('click', function () { Editor.select(c.id); });
      list.appendChild(row);
    });
  }

  function paintInspector() {
    var box = $('inspector');
    var id = Editor.selectedId();
    var clips = Editor.clips();
    var clip = null;
    clips.forEach(function (c) { if (c.id === id) clip = c; });
    box.innerHTML = '';
    if (!clip) {
      var p = document.createElement('p');
      p.className = 'tiny muted';
      p.textContent = 'Bir klibe dokun.';
      box.appendChild(p);
      return;
    }

    var max = clip.kind === 'video' ? (clip.duration || 5) : 20;

    box.appendChild(field('Başlangıç', function (inp) {
      inp.type = 'range';
      inp.min = 0;
      inp.max = Math.max(0.3, max - 0.3);
      inp.step = 0.1;
      inp.value = clip.trimStart;
      inp.addEventListener('input', function () {
        Editor.setTrim(clip.id, parseFloat(inp.value), Math.max(parseFloat(inp.value) + 0.3, clip.trimEnd));
      });
      return inp;
    }));

    box.appendChild(field('Bitiş', function (inp) {
      inp.type = 'range';
      inp.min = 0.3;
      inp.max = max;
      inp.step = 0.1;
      inp.value = clip.trimEnd;
      inp.addEventListener('input', function () {
        Editor.setTrim(clip.id, Math.min(clip.trimStart, parseFloat(inp.value) - 0.3), parseFloat(inp.value));
      });
      return inp;
    }));

    var info = document.createElement('p');
    info.className = 'tiny muted';
    info.textContent = 'Süre: ' + Editor.clipDur(clip).toFixed(1) + ' sn (kaynak ' + max.toFixed(1) + ' sn)';
    box.appendChild(info);

    box.appendChild(field('Yazı', function (inp) {
      inp.type = 'text';
      inp.placeholder = 'Klibe yazı ekle…';
      inp.value = clip.text || '';
      inp.addEventListener('input', function () {
        Editor.patch(clip.id, { text: inp.value });
      });
      return inp;
    }));

    if (clip.text) {
      box.appendChild(field('Yazı konumu', function (sel) {
        sel.tagName === 'SELECT';
        var s = document.createElement('select');
        [['bottom', 'Altta'], ['middle', 'Ortada'], ['top', 'Üstte']].forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o[0];
          opt.textContent = o[1];
          if (clip.textPos === o[0]) opt.selected = true;
          s.appendChild(opt);
        });
        s.addEventListener('change', function () { Editor.patch(clip.id, { textPos: s.value }); });
        return s;
      }));
    }

    if (clip.kind === 'image') {
      box.appendChild(field('Hareket', function () {
        var s = document.createElement('select');
        [['zoomIn', 'Yakınlaş'], ['zoomOut', 'Uzaklaş'], ['pan', 'Kaydır'], ['none', 'Sabit']].forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o[0];
          opt.textContent = o[1];
          if ((clip.motion || 'zoomIn') === o[0]) opt.selected = true;
          s.appendChild(opt);
        });
        s.addEventListener('change', function () { Editor.patch(clip.id, { motion: s.value }); });
        return s;
      }));
    }
  }

  function field(label, build) {
    var wrap = document.createElement('label');
    wrap.className = 'field';
    var span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    var input = document.createElement('input');
    wrap.appendChild(build(input) || input);
    return wrap;
  }

  async function doExport() {
    var btn = $('exportBtn');
    if (!Editor.clips().length) { toast('Önce klip ekle'); return; }
    var total = Editor.totalDur();
    setBusy(btn, true, 'Kaydediliyor… (gerçek zamanlı)');
    try {
      var blob = await Editor.exportVideo();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tek-studyo-' + Date.now() + '.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
      bump('export');
      toast('Video indirildi (' + Math.round(blob.size / 1048576 * 10) / 10 + ' MB, ' + Math.round(total) + ' sn)');
    } catch (err) {
      toast(err.message || 'Dışa aktarma başarısız');
    } finally {
      setBusy(btn, false, '⤓ Videoyu dışa aktar');
    }
  }

  /* ---------- seslendirme ---------- */

  var voiceUrl = null;
  var PRESETS = [
    'Yeni sezon koleksiyonumuz şimdi burada. Sen de keşfet.',
    'Merhaba! Bu videoda üç basit adımda nasıl yapıldığını göreceksin.',
    'Bugünün fırsatı: tüm ürünlerde yüzde yirmi indirim, sadece bu hafta sonu.'
  ];

  function initVoice() {
    var text = $('voiceText');
    var counter = $('voiceCount');
    function updateCount() {
      var n = text.value.length;
      counter.textContent = n + '/800';
      counter.style.color = n > 800 ? 'var(--danger)' : '';
    }
    text.addEventListener('input', updateCount);
    updateCount();

    var presets = $('voicePresets');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.textContent = p;
      b.addEventListener('click', function () {
        text.value = p;
        updateCount();
        text.focus();
      });
      presets.appendChild(b);
    });

    $('voiceGen').addEventListener('click', generateVoice);
    $('voiceSys').addEventListener('click', speakWithBrowser);
    $('voiceToEditor').addEventListener('click', sendVoiceToEditor);
  }

  function voiceMessage(msg, kind) {
    var el = $('voiceMsg');
    el.textContent = msg;
    el.className = 'msg' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
  }

  async function generateVoice() {
    var text = $('voiceText').value.trim();
    if (!text) { voiceMessage('Önce metni yaz.', 'err'); return; }
    if (text.length > 800) { voiceMessage('Metin 800 karakteri aşıyor.', 'err'); return; }
    setBusy($('voiceGen'), true, 'Üretiliyor…');
    voiceMessage('Ses üretiliyor, birkaç saniye…');
    try {
      var blob = await API.voice(text, $('voiceSel').value);
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
      voiceUrl = URL.createObjectURL(blob);
      var audio = $('voiceAudio');
      audio.src = voiceUrl;
      audio.classList.remove('hidden');
      audio.play().catch(function () {});
      var dl = $('voiceDl');
      dl.href = voiceUrl;
      dl.classList.remove('hidden');
      bump('voice');
      voiceMessage('Hazır · ' + Math.round(blob.size / 1024) + ' KB', 'ok');
    } catch (err) {
      voiceMessage(err.message || 'Seslendirme başarısız.', 'err');
    } finally {
      setBusy($('voiceGen'), false, '🎙 Seslendir');
    }
  }

  function speakWithBrowser() {
    var text = $('voiceText').value.trim();
    if (!text) { voiceMessage('Önce metni yaz.', 'err'); return; }
    if (!('speechSynthesis' in window)) { voiceMessage('Tarayıcı seslendirmeyi desteklemiyor.', 'err'); return; }
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    var voices = window.speechSynthesis.getVoices();
    var tr = voices.filter(function (v) { return /tr/i.test(v.lang); })[0];
    if (tr) utter.voice = tr;
    utter.lang = 'tr-TR';
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
    voiceMessage('Tarayıcı sesiyle okunuyor (indirilemez).', 'ok');
  }

  async function sendVoiceToEditor() {
    if (!voiceUrl) {
      voiceMessage('Önce bir seslendirme üret.', 'err');
      return;
    }
    try {
      var blob = await (await fetch(voiceUrl)).blob();
      var file = new File([blob], 'seslendirme.mp3', { type: blob.type || 'audio/mpeg' });
      Editor.setMusic(file);
      show('editor');
      toast('Seslendirme kurguya eklendi');
    } catch (err) {
      voiceMessage('Kurguya eklenemedi: ' + err.message, 'err');
    }
  }

  /* ---------- görsel ---------- */

  var STYLES = [
    { label: 'Sinematik', v: 'cinematic lighting, shallow depth of field, 35mm film' },
    { label: 'Stüdyo', v: 'studio lighting, seamless background, product photography' },
    { label: 'İllüstrasyon', v: 'flat vector illustration, bold shapes, clean lines' },
    { label: 'Anime', v: 'anime style, vibrant colors, detailed background' },
    { label: '3B render', v: '3d render, octane, soft global illumination' },
    { label: 'Retro', v: 'vintage 1980s poster, grain, warm palette' }
  ];

  var BUILDER = [
    { key: 'Konu', opts: ['bir kadın portresi', 'ürün şişesi', 'kafe iç mekânı', 'dağ manzarası', 'sokak kedisi'] },
    { key: 'Işık', opts: ['altın saat', 'neon', 'yumuşak gün ışığı', 'dramatik gölge'] },
    { key: 'Renk', opts: ['pastel', 'canlı', 'monokrom', 'toprak tonları'] }
  ];

  var imageHistory = [];
  var imageUrlCache = [];

  function initImage() {
    var chips = $('styleChips');
    STYLES.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (i === 0 ? ' on' : '');
      b.textContent = s.label;
      b.dataset.style = s.v;
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      chips.appendChild(b);
    });

    var builder = $('promptBuilder');
    BUILDER.forEach(function (group) {
      var row = document.createElement('div');
      row.className = 'b-row';
      var span = document.createElement('span');
      span.textContent = group.key;
      row.appendChild(span);
      var list = document.createElement('div');
      list.className = 'chips';
      group.opts.forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = opt;
        b.dataset.value = opt;
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(list.children, function (c) { c.classList.remove('on'); });
          b.classList.add('on');
        });
        list.appendChild(b);
      });
      row.appendChild(list);
      builder.appendChild(row);
    });

    $('builderApply').addEventListener('click', function () {
      var parts = [];
      Array.prototype.forEach.call(builder.querySelectorAll('.chip.on'), function (b) { parts.push(b.dataset.value); });
      var style = chips.querySelector('.chip.on');
      if (style) parts.push(style.dataset.style);
      $('imagePrompt').value = parts.join(', ');
      toast('Prompt hazır');
    });

    $('imageGen').addEventListener('click', generateImage);
  }

  function imageMessage(msg, kind) {
    var el = $('imageMsg');
    el.textContent = msg;
    el.className = 'msg' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
  }

  async function generateImage() {
    var prompt = $('imagePrompt').value.trim();
    if (!prompt) { imageMessage('Prompt yaz.', 'err'); return; }
    var style = $('styleChips').querySelector('.chip.on');
    if (style) prompt += ', ' + style.dataset.style;
    var size = $('imageSize').value.split('x');
    var model = $('imageModel').value;

    setBusy($('imageGen'), true, 'Üretiliyor…');
    imageMessage('Görsel üretiliyor…');
    try {
      var blob = await API.image(prompt, {
        width: parseInt(size[0], 10),
        height: parseInt(size[1], 10),
        model: model
      });
      var url = URL.createObjectURL(blob);
      imageHistory.unshift({ url: url, prompt: prompt });
      imageHistory = imageHistory.slice(0, 12);
      addImageCard(url, prompt);
      paintHistory();
      bump('image');
      imageMessage('Hazır · ' + Math.round(blob.size / 1024) + ' KB', 'ok');
    } catch (err) {
      imageMessage(err.message || 'Görsel üretilemedi.', 'err');
    } finally {
      setBusy($('imageGen'), false, '🖼 Üret');
    }
  }

  function addImageCard(url, prompt) {
    var grid = $('imageGrid');
    var card = document.createElement('div');
    card.className = 'image-card';

    var img = document.createElement('img');
    img.src = url;
    img.alt = prompt;
    card.appendChild(img);

    var acts = document.createElement('div');
    acts.className = 'acts';

    var dl = document.createElement('a');
    dl.className = 'btn small';
    dl.href = url;
    dl.download = 'gorsel-' + Date.now() + '.jpg';
    dl.textContent = 'İndir';
    acts.appendChild(dl);

    var useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.className = 'btn small';
    useBtn.textContent = 'Kurguya';
    useBtn.addEventListener('click', async function () {
      try {
        var blob = await (await fetch(url)).blob();
        Editor.addImageBlob(blob, 'ai-gorsel.jpg');
        bump('clip');
        show('editor');
        toast('Görsel kurguya eklendi');
      } catch (err) {
        toast('Eklenemedi');
      }
    });
    acts.appendChild(useBtn);

    card.appendChild(acts);
    grid.insertBefore(card, grid.firstChild);
  }

  function paintHistory() {
    var box = $('imageHistory');
    box.innerHTML = '';
    imageHistory.forEach(function (item) {
      var img = document.createElement('img');
      img.src = item.url;
      img.title = item.prompt;
      img.addEventListener('click', function () { window.open(item.url, '_blank'); });
      box.appendChild(img);
    });
  }

  /* ---------- video (görsellerden) ---------- */

  var videoFiles = [];

  function initVideo() {
    var input = $('videoImages');
    input.addEventListener('change', function () {
      addVideoImages(input.files);
      input.value = '';
    });

    var drop = $('videoDrop');
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.style.borderColor = ''; });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addVideoImages(e.dataTransfer.files);
    });

    $('videoBuild').addEventListener('click', function () {
      if (!videoFiles.length) { videoMsg('Önce fotoğraf ekle.', true); return; }
      var per = parseFloat($('videoPer').value) || 3;
      var motion = $('videoMotion').value;
      Editor.loadImages(videoFiles, per, motion);
      bump('clip', videoFiles.length);
      show('editor');
      toast('Kurguya aktarıldı — istediğin gibi düzenle');
    });
  }

  function videoMsg(msg, err) {
    var el = $('videoMsg');
    el.textContent = msg;
    el.className = 'msg' + (err ? ' err' : ' ok');
  }

  function addVideoImages(fileList) {
    var added = 0;
    Array.prototype.slice.call(fileList).forEach(function (f) {
      if (f && f.type.indexOf('image/') === 0) { videoFiles.push(f); added++; }
    });
    var row = $('videoThumbs');
    row.innerHTML = '';
    videoFiles.forEach(function (f) {
      var img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      row.appendChild(img);
    });
    videoMsg(added + ' fotoğraf eklendi · toplam ' + videoFiles.length, false);
  }

  /* ---------- araç panosu ---------- */

  var TOOLS = [
    { name: 'ChatGPT', url: 'https://chat.openai.com/', cats: ['metin'], note: 'Metin, fikir, senaryo' },
    { name: 'Gemini', url: 'https://gemini.google.com/', cats: ['metin', 'görsel'], note: 'Ücretsiz katman, görsel okuma' },
    { name: 'Claude', url: 'https://claude.ai/', cats: ['metin'], note: 'Uzun metin, düzenleme' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai/', cats: ['metin'], note: 'Kaynaklı araştırma' },
    { name: 'Copilot', url: 'https://copilot.microsoft.com/', cats: ['metin', 'görsel'], note: 'Görsel üretimi dahil' },
    { name: 'Leonardo AI', url: 'https://leonardo.ai/', cats: ['görsel'], note: 'Günlük ücretsiz kredi' },
    { name: 'Ideogram', url: 'https://ideogram.ai/', cats: ['görsel'], note: 'Yazı içeren görseller' },
    { name: 'Playground', url: 'https://playground.com/', cats: ['görsel'], note: 'Günlük ücretsiz üretim' },
    { name: 'Krea', url: 'https://www.krea.ai/', cats: ['görsel', 'video'], note: 'Gerçek zamanlı görsel' },
    { name: 'Runway', url: 'https://runwayml.com/', cats: ['video'], note: 'Ücretsiz kredi ile video' },
    { name: 'Pika', url: 'https://pika.art/', cats: ['video'], note: 'Kısa klip üretimi' },
    { name: 'Luma Dream Machine', url: 'https://lumalabs.ai/dream-machine', cats: ['video'], note: 'Görselden video' },
    { name: 'Kling', url: 'https://app.klingai.com/', cats: ['video'], note: 'Günlük ücretsiz kredi' },
    { name: 'Suno', url: 'https://suno.com/', cats: ['ses'], note: 'Şarkı ve müzik üretimi' },
    { name: 'ElevenLabs', url: 'https://elevenlabs.io/', cats: ['ses'], note: 'Ücretsiz aylık karakter' },
    { name: 'CapCut', url: 'https://www.capcut.com/', cats: ['kurgu'], note: 'Mobil video kurgu' },
    { name: 'Canva', url: 'https://www.canva.com/', cats: ['kurgu', 'görsel'], note: 'Tasarım ve şablonlar' },
    { name: 'Remove.bg', url: 'https://www.remove.bg/', cats: ['görsel'], note: 'Arka plan silme' }
  ];

  var activeFilter = 'hepsi';

  function initTools() {
    var filters = $('toolFilters');
    ['hepsi', 'metin', 'görsel', 'video', 'ses', 'kurgu'].forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (cat === 'hepsi' ? ' on' : '');
      b.textContent = cat;
      b.addEventListener('click', function () {
        activeFilter = cat;
        Array.prototype.forEach.call(filters.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        paintTools();
      });
      filters.appendChild(b);
    });

    $('copyPrompt').addEventListener('click', copyPrompt);
    paintTools();

    var strip = $('homeTools');
    if (strip) TOOLS.slice(0, 6).forEach(function (t) {
      var a = document.createElement('a');
      a.href = t.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '';
      a.appendChild(document.createTextNode(t.name));
      var span = document.createElement('span');
      span.textContent = t.note;
      a.appendChild(span);
      strip.appendChild(a);
    });
  }

  function paintTools() {
    var grid = $('toolGrid');
    grid.innerHTML = '';
    TOOLS.filter(function (t) {
      return activeFilter === 'hepsi' || t.cats.indexOf(activeFilter) >= 0;
    }).forEach(function (t) {
      var card = document.createElement('div');
      card.className = 'tool-card';

      var h = document.createElement('h3');
      h.textContent = t.name;
      card.appendChild(h);

      var p = document.createElement('p');
      p.textContent = t.note;
      card.appendChild(p);

      var tags = document.createElement('div');
      tags.className = 'tags';
      t.cats.forEach(function (c) {
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = c;
        tags.appendChild(tag);
      });
      card.appendChild(tags);

      var acts = document.createElement('div');
      acts.className = 'acts';

      var open = document.createElement('a');
      open.className = 'btn small primary';
      open.href = t.url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Aç';
      acts.appendChild(open);

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn small';
      copy.textContent = 'Prompt + aç';
      copy.addEventListener('click', function () {
        var text = $('toolPrompt').value.trim();
        if (text) copyText(text).then(function () { toast('Prompt kopyalandı — araca yapıştır'); });
        window.open(t.url, '_blank', 'noopener');
      });
      acts.appendChild(copy);

      card.appendChild(acts);
      grid.appendChild(card);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* yoksay */ }
    ta.remove();
  }

  function copyPrompt() {
    var text = $('toolPrompt').value.trim();
    if (!text) { toast('Önce prompt yaz'); return; }
    copyText(text).then(function () { toast('Kopyalandı'); });
  }

  /* ---------- başlat ---------- */

  function start() {
    initLogin();
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        show(a.getAttribute('data-nav'));
      });
    });
    window.addEventListener('hashchange', routeFromHash);

    API.session().then(function (user) {
      boot(user);
    }).catch(function () {
      showGate();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
