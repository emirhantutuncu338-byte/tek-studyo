/* Oyun akışı: karakter seçimi, makyaj paneli, kaydetme */
(function () {
  'use strict';

  var P = window.PALETTES;
  var CHARS = window.CHARACTERS;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('faceCanvas');
  var ctx = canvas.getContext('2d');
  var toastEl = $('toast');
  var toastTimer = null;
  var activeTab = 'cilt';
  var state = { currentId: null, makeup: {} };

  /* ---------- durum ---------- */

  function defaultMakeup() {
    return {
      skin: null,
      blush: { color: null, strength: 0.9 },
      shadow: { color: null, style: 'soft', strength: 0.9 },
      liner: { color: null, thick: 4, wing: false },
      mascara: false,
      brow: { color: null, thick: 5 },
      lip: { color: null, finish: 'gloss', full: 1 },
      contour: false,
      highlight: false,
      bg: 0,
      hair: null,
      bow: false,
      crown: false,
      glasses: false,
      earrings: false,
      sparkle: false
    };
  }

  function makeupFor(id) {
    if (!state.makeup[id]) state.makeup[id] = defaultMakeup();
    return state.makeup[id];
  }

  function currentChar() {
    for (var i = 0; i < CHARS.length; i++) {
      if (CHARS[i].id === state.currentId) return CHARS[i];
    }
    return CHARS[0];
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1700);
  }

  /* ---------- çizim ---------- */

  function render() {
    if (!state.currentId || !canvas.width) return;
    var ch = currentChar();
    var m = makeupFor(state.currentId);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = canvas.width / 600;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    window.FaceArt.render(ctx, ch, m);
  }

  function fitCanvas() {
    var frame = $('stageFrame');
    var w = frame.clientWidth;
    var h = frame.clientHeight;
    if (!w || !h) return;
    var scale = Math.min(w / 600, h / 780);
    var cw = Math.floor(600 * scale);
    var chh = Math.floor(780 * scale);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = cw + 'px';
    canvas.style.height = chh + 'px';
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(chh * dpr));
    render();
  }

  /* ---------- karakter seçimi ---------- */

  function buildGrid() {
    var grid = $('charGrid');
    grid.innerHTML = '';
    CHARS.forEach(function (ch) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'char-card';
      card.setAttribute('data-char', ch.id);

      var holder = document.createElement('div');
      holder.className = 'avatar';
      var c = document.createElement('canvas');
      holder.appendChild(c);
      card.appendChild(holder);

      var nm = document.createElement('span');
      nm.className = 'char-name';
      nm.textContent = ch.name;
      card.appendChild(nm);

      card.addEventListener('click', function () { openStudio(ch); });
      grid.appendChild(card);
    });
    requestAnimationFrame(refreshAvatars);
  }

  function refreshAvatars() {
    var cards = document.querySelectorAll('.char-card');
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-char');
      var c = cards[i].querySelector('canvas');
      var ch = null;
      for (var j = 0; j < CHARS.length; j++) {
        if (CHARS[j].id === id) ch = CHARS[j];
      }
      if (c && ch) window.FaceArt.portrait(c, ch, makeupFor(id));
    }
  }

  function openStudio(ch) {
    state.currentId = ch.id;
    makeupFor(ch.id);
    $('studioName').textContent = ch.name;
    $('selectScreen').classList.add('hidden');
    $('studioScreen').classList.remove('hidden');
    activeTab = 'cilt';
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === 'cilt');
    }
    buildPanel('cilt');
    requestAnimationFrame(function () {
      fitCanvas();
      requestAnimationFrame(fitCanvas);
    });
  }

  function showSelect() {
    $('studioScreen').classList.add('hidden');
    $('selectScreen').classList.remove('hidden');
    refreshAvatars();
  }

  /* ---------- panel parçaları ---------- */

  function row(label) {
    var r = document.createElement('div');
    r.className = 'row';
    var t = document.createElement('div');
    t.className = 'row-label';
    t.textContent = label;
    var body = document.createElement('div');
    body.className = 'row-body';
    r.appendChild(t);
    r.appendChild(body);
    return { root: r, body: body };
  }

  function swatches(body, colors, value, onPick, noneLabel) {
    var wrap = document.createElement('div');
    wrap.className = 'swatches';
    if (noneLabel) {
      var nb = document.createElement('button');
      nb.type = 'button';
      nb.className = 'swatch none' + (value == null ? ' active' : '');
      nb.title = noneLabel;
      nb.setAttribute('aria-label', noneLabel);
      nb.addEventListener('click', function () { onPick(null); });
      wrap.appendChild(nb);
    }
    colors.forEach(function (col) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (value === col ? ' active' : '');
      b.style.background = col;
      b.setAttribute('aria-label', col);
      b.addEventListener('click', function () { onPick(col); });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }

  function slider(body, min, max, step, value, onInput) {
    var s = document.createElement('input');
    s.type = 'range';
    s.className = 'slider';
    s.min = min;
    s.max = max;
    s.step = step;
    s.value = value;
    s.addEventListener('input', function () { onInput(parseFloat(s.value)); });
    body.appendChild(s);
  }

  function chips(body, options, value, onPick) {
    var wrap = document.createElement('div');
    wrap.className = 'chips';
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (value === o.v ? ' active' : '');
      b.textContent = o.label;
      b.addEventListener('click', function () { onPick(o.v); });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }

  function toggle(label, value, onChange) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'toggle' + (value ? ' on' : '');
    b.setAttribute('aria-pressed', value ? 'true' : 'false');
    var dot = document.createElement('span');
    dot.className = 'dot';
    var t = document.createElement('span');
    t.textContent = label;
    b.appendChild(dot);
    b.appendChild(t);
    b.addEventListener('click', function () { onChange(!value); });
    return b;
  }

  function toggleGrid(items) {
    var wrap = document.createElement('div');
    wrap.className = 'toggle-grid';
    items.forEach(function (el) { wrap.appendChild(el); });
    return wrap;
  }

  /* ---------- paneller ---------- */

  function buildPanel(tab) {
    var panel = $('panel');
    var scroll = panel.scrollTop;
    panel.innerHTML = '';
    var ch = currentChar();
    var m = makeupFor(state.currentId);
    var reload = function () { buildPanel(tab); };

    if (tab === 'cilt') {
      var r1 = row('Ten rengi');
      swatches(r1.body, P.foundation, m.skin, function (v) { m.skin = v; render(); reload(); }, 'Doğal');
      panel.appendChild(r1.root);

      var r2 = row('Allık');
      swatches(r2.body, P.blush, m.blush.color, function (v) { m.blush.color = v; render(); reload(); }, 'Yok');
      panel.appendChild(r2.root);

      var r3 = row('Allık yoğunluğu');
      slider(r3.body, 0.3, 1.6, 0.05, m.blush.strength, function (v) { m.blush.strength = v; render(); });
      panel.appendChild(r3.root);

      var r4 = row('Cilt efektleri');
      r4.body.appendChild(toggleGrid([
        toggle('Kontür', m.contour, function (v) { m.contour = v; render(); reload(); }),
        toggle('Aydınlatıcı', m.highlight, function (v) { m.highlight = v; render(); reload(); })
      ]));
      panel.appendChild(r4.root);
    }

    if (tab === 'goz') {
      var g1 = row('Far rengi');
      swatches(g1.body, P.shadow, m.shadow.color, function (v) { m.shadow.color = v; render(); reload(); }, 'Yok');
      panel.appendChild(g1.root);

      var g2 = row('Far stili');
      chips(g2.body, [
        { v: 'soft', label: 'Düz' },
        { v: 'smoky', label: 'Sisli' },
        { v: 'glitter', label: 'Işıltılı' }
      ], m.shadow.style, function (v) { m.shadow.style = v; render(); reload(); });
      panel.appendChild(g2.root);

      var g3 = row('Eyeliner');
      swatches(g3.body, P.liner, m.liner.color, function (v) { m.liner.color = v; render(); reload(); }, 'Yok');
      panel.appendChild(g3.root);

      if (m.liner.color) {
        var g4 = row('Kalınlık');
        slider(g4.body, 2, 8, 0.5, m.liner.thick, function (v) { m.liner.thick = v; render(); });
        panel.appendChild(g4.root);
      }

      var g5 = row('Kirpik');
      g5.body.appendChild(toggleGrid([
        toggle('Maskara', m.mascara, function (v) { m.mascara = v; render(); reload(); }),
        toggle('Kanat', m.liner.wing, function (v) { m.liner.wing = v; render(); reload(); })
      ]));
      panel.appendChild(g5.root);

      var g6 = row('Kaş rengi');
      swatches(g6.body, P.brow, m.brow.color, function (v) { m.brow.color = v; render(); reload(); }, 'Doğal');
      panel.appendChild(g6.root);

      var g7 = row('Kaş kalınlığı');
      slider(g7.body, 3, 9, 0.5, m.brow.thick, function (v) { m.brow.thick = v; render(); });
      panel.appendChild(g7.root);
    }

    if (tab === 'dudak') {
      var d1 = row('Ruj');
      swatches(d1.body, P.lip, m.lip.color, function (v) { m.lip.color = v; render(); reload(); }, 'Doğal');
      panel.appendChild(d1.root);

      var d2 = row('Bitim');
      chips(d2.body, [
        { v: 'gloss', label: 'Parlak' },
        { v: 'mat', label: 'Mat' }
      ], m.lip.finish, function (v) { m.lip.finish = v; render(); reload(); });
      panel.appendChild(d2.root);

      var d3 = row('Dolgunluk');
      slider(d3.body, 0.75, 1.4, 0.05, m.lip.full, function (v) { m.lip.full = v; render(); });
      panel.appendChild(d3.root);
    }

    if (tab === 'stil') {
      var t1 = row('Arka plan');
      var bgWrap = document.createElement('div');
      bgWrap.className = 'swatches';
      P.bg.forEach(function (theme, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch bg-swatch' + (m.bg === i ? ' active' : '');
        b.style.background = 'linear-gradient(160deg,' + theme.a + ',' + theme.b + ')';
        b.setAttribute('aria-label', 'Arka plan ' + (i + 1));
        b.addEventListener('click', function () { m.bg = i; render(); reload(); });
        bgWrap.appendChild(b);
      });
      t1.body.appendChild(bgWrap);
      panel.appendChild(t1.root);

      var t2 = row('Saç rengi');
      swatches(t2.body, P.hair, m.hair, function (v) { m.hair = v; render(); reload(); }, 'Doğal');
      panel.appendChild(t2.root);

      var t3 = row('Aksesuar');
      t3.body.appendChild(toggleGrid([
        toggle('Fiyonk', m.bow, function (v) { m.bow = v; render(); reload(); }),
        toggle('Taç', m.crown, function (v) { m.crown = v; render(); reload(); }),
        toggle('Gözlük', m.glasses, function (v) { m.glasses = v; render(); reload(); }),
        toggle('Küpe', m.earrings, function (v) { m.earrings = v; render(); reload(); }),
        toggle('Işıltı', m.sparkle, function (v) { m.sparkle = v; render(); reload(); })
      ]));
      panel.appendChild(t3.root);
    }

    panel.scrollTop = scroll;
  }

  /* ---------- eylemler ---------- */

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomize() {
    if (!state.currentId) return;
    var m = makeupFor(state.currentId);
    var r = Math.random;
    m.skin = r() < 0.3 ? pick(P.foundation) : null;
    m.blush.color = r() < 0.8 ? pick(P.blush) : null;
    m.blush.strength = 0.5 + r() * 0.9;
    m.shadow.color = r() < 0.85 ? pick(P.shadow) : null;
    m.shadow.style = pick(['soft', 'smoky', 'glitter']);
    m.shadow.strength = 0.6 + r() * 0.6;
    m.liner.color = r() < 0.7 ? pick(P.liner) : null;
    m.liner.thick = 2.5 + r() * 4;
    m.liner.wing = r() < 0.55;
    m.mascara = r() < 0.75;
    m.brow.color = r() < 0.45 ? pick(P.brow) : null;
    m.lip.color = r() < 0.9 ? pick(P.lip) : null;
    m.lip.finish = pick(['gloss', 'mat']);
    m.contour = r() < 0.4;
    m.highlight = r() < 0.6;
    m.bg = Math.floor(r() * P.bg.length);
    m.bow = r() < 0.35;
    m.crown = r() < 0.22;
    m.glasses = r() < 0.16;
    m.earrings = r() < 0.5;
    m.sparkle = r() < 0.45;
    render();
    buildPanel(activeTab);
    toast('Yeni bir kombinasyon 💫');
  }

  function resetAll() {
    if (!state.currentId) return;
    state.makeup[state.currentId] = defaultMakeup();
    render();
    buildPanel(activeTab);
    toast('Makyaj temizlendi');
  }

  function savePhoto() {
    if (!state.currentId) return;
    var ch = currentChar();
    var m = makeupFor(state.currentId);
    var off = document.createElement('canvas');
    off.width = 1200;
    off.height = 1560;
    var o = off.getContext('2d');
    o.setTransform(2, 0, 0, 2, 0, 0);
    window.FaceArt.render(o, ch, m);

    var done = function (url, name) {
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      toast('Fotoğraf kaydedildi 💖');
    };

    if (off.toBlob) {
      off.toBlob(function (blob) {
        if (!blob) { toast('Kaydedilemedi'); return; }
        done(URL.createObjectURL(blob), 'makyaj-' + ch.id + '.png');
      }, 'image/png');
    } else {
      done(off.toDataURL('image/png'), 'makyaj-' + ch.id + '.png');
    }
  }

  /* ---------- başlat ---------- */

  function init() {
    buildGrid();

    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        activeTab = this.getAttribute('data-tab');
        for (var k = 0; k < tabs.length; k++) {
          tabs[k].classList.toggle('active', tabs[k] === this);
        }
        buildPanel(activeTab);
      });
    }

    $('backBtn').addEventListener('click', showSelect);
    $('randomBtn').addEventListener('click', randomize);
    $('randomBtnTop').addEventListener('click', randomize);
    $('resetBtn').addEventListener('click', resetAll);
    $('saveBtn').addEventListener('click', savePhoto);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { fitCanvas(); });
      ro.observe($('stageFrame'));
    } else {
      window.addEventListener('resize', fitCanvas);
    }
    window.addEventListener('orientationchange', function () {
      setTimeout(fitCanvas, 250);
    });

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
