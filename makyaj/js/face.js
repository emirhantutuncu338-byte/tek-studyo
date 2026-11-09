/* Yüz ve makyaj çizim motoru — canvas 2D, 600x780 mantıksal alan */
(function () {
  'use strict';

  var W = 600, H = 780, CX = 300;
  var FACE_TOP = 178, CHIN = 578;
  var EYE_Y = 372, EYE_DX = 80;
  var MOUTH_Y = 500;
  var TAU = Math.PI * 2;

  /* ---------- renk yardımcıları ---------- */

  function hexToRgb(h) {
    h = String(h || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    var r = Math.round(x.r + (y.r - x.r) * t);
    var g = Math.round(x.g + (y.g - x.g) * t);
    var bl = Math.round(x.b + (y.b - x.b) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  function bez(p0, c, p1, t) {
    var m = 1 - t;
    return {
      x: m * m * p0.x + 2 * m * t * c.x + t * t * p1.x,
      y: m * m * p0.y + 2 * m * t * c.y + t * t * p1.y
    };
  }

  /* ---------- geometri ---------- */

  function facePath(ctx, ch) {
    var fw = ch.faceWidth || 1;
    var hw = 150 * fw, jw = 120 * fw;
    ctx.beginPath();
    ctx.moveTo(CX, FACE_TOP);
    ctx.bezierCurveTo(CX + hw * 0.96, FACE_TOP - 4, CX + hw * 1.03, FACE_TOP + 160, CX + jw * 1.02, FACE_TOP + 270);
    ctx.bezierCurveTo(CX + jw * 0.94, CHIN - 88, CX + jw * 0.5, CHIN, CX, CHIN);
    ctx.bezierCurveTo(CX - jw * 0.5, CHIN, CX - jw * 0.94, CHIN - 88, CX - jw * 1.02, FACE_TOP + 270);
    ctx.bezierCurveTo(CX - hw * 1.03, FACE_TOP + 160, CX - hw * 0.96, FACE_TOP - 4, CX, FACE_TOP);
    ctx.closePath();
  }

  function eyePath(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + h * 0.18);
    ctx.quadraticCurveTo(cx - w * 0.45, cy - h * 1.22, cx + w * 0.18, cy - h * 0.9);
    ctx.quadraticCurveTo(cx + w * 0.8, cy - h * 0.55, cx + w, cy + h * 0.05);
    ctx.quadraticCurveTo(cx + w * 0.25, cy + h * 1.05, cx - w * 0.5, cy + h * 0.86);
    ctx.quadraticCurveTo(cx - w * 0.85, cy + h * 0.6, cx - w, cy + h * 0.18);
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hairGrad(ctx, c) {
    var g = ctx.createLinearGradient(CX - 190, 110, CX + 170, 730);
    g.addColorStop(0, mix(c, '#ffffff', 0.2));
    g.addColorStop(0.38, c);
    g.addColorStop(1, mix(c, '#000000', 0.36));
    return g;
  }

  /* ---------- arka plan ---------- */

  function drawBackground(ctx, theme) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.a);
    g.addColorStop(1, theme.b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var rg = ctx.createRadialGradient(W * 0.5, H * 0.34, 30, W * 0.5, H * 0.34, 440);
    rg.addColorStop(0, 'rgba(255,255,255,0.5)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    var dots = [[82, 128, 24], [520, 104, 17], [72, 636, 20], [546, 596, 28], [470, 210, 11], [112, 306, 9], [300, 78, 13]];
    for (var i = 0; i < dots.length; i++) {
      ctx.beginPath();
      ctx.arc(dots[i][0], dots[i][1], dots[i][2], 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
    }
  }

  /* ---------- gövde ---------- */

  function drawBody(ctx, ch, skin) {
    // boyun
    ctx.beginPath();
    ctx.moveTo(CX - 60, 512);
    ctx.bezierCurveTo(CX - 60, 596, CX - 74, 620, CX - 82, 632);
    ctx.lineTo(CX + 82, 632);
    ctx.bezierCurveTo(CX + 74, 620, CX + 60, 596, CX + 60, 512);
    ctx.closePath();
    var ng = ctx.createLinearGradient(CX - 62, 0, CX + 62, 0);
    ng.addColorStop(0, mix(skin, '#000000', 0.18));
    ng.addColorStop(0.45, skin);
    ng.addColorStop(1, mix(skin, '#000000', 0.18));
    ctx.fillStyle = ng;
    ctx.fill();

    // omuzlar / kıyafet
    ctx.beginPath();
    ctx.moveTo(CX - 280, H + 10);
    ctx.bezierCurveTo(CX - 258, 700, CX - 130, 646, CX - 66, 630);
    ctx.lineTo(CX + 66, 630);
    ctx.bezierCurveTo(CX + 130, 646, CX + 258, 700, CX + 280, H + 10);
    ctx.closePath();
    var og = ctx.createLinearGradient(0, 626, 0, H);
    og.addColorStop(0, ch.outfit);
    og.addColorStop(1, mix(ch.outfit, '#000000', 0.34));
    ctx.fillStyle = og;
    ctx.fill();

    // yaka ışığı
    ctx.beginPath();
    ctx.moveTo(CX - 80, 632);
    ctx.quadraticCurveTo(CX, 692, CX + 80, 632);
    ctx.quadraticCurveTo(CX, 662, CX - 80, 632);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
  }

  /* ---------- saç ---------- */

  function drawHairBack(ctx, ch, col) {
    var style = ch.hairStyle;
    ctx.save();
    ctx.fillStyle = hairGrad(ctx, col);

    if (style === 'long') {
      ctx.beginPath();
      ctx.moveTo(CX - 196, 238);
      ctx.bezierCurveTo(CX - 238, 420, CX - 234, 566, CX - 196, 704);
      ctx.quadraticCurveTo(CX, 732, CX + 196, 704);
      ctx.bezierCurveTo(CX + 234, 566, CX + 238, 420, CX + 196, 238);
      ctx.bezierCurveTo(CX + 176, 96, CX - 176, 96, CX - 196, 238);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'wavy') {
      ctx.beginPath();
      ctx.moveTo(CX - 200, 236);
      ctx.bezierCurveTo(CX - 244, 420, CX - 240, 566, CX - 202, 700);
      ctx.quadraticCurveTo(CX - 160, 736, CX - 110, 700);
      ctx.quadraticCurveTo(CX - 60, 664, CX, 700);
      ctx.quadraticCurveTo(CX + 60, 736, CX + 110, 700);
      ctx.quadraticCurveTo(CX + 160, 664, CX + 202, 700);
      ctx.bezierCurveTo(CX + 240, 566, CX + 244, 420, CX + 200, 236);
      ctx.bezierCurveTo(CX + 178, 94, CX - 178, 94, CX - 200, 236);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'bob') {
      ctx.beginPath();
      ctx.moveTo(CX - 192, 240);
      ctx.bezierCurveTo(CX - 224, 372, CX - 214, 468, CX - 152, 502);
      ctx.quadraticCurveTo(CX, 534, CX + 152, 502);
      ctx.bezierCurveTo(CX + 214, 468, CX + 224, 372, CX + 192, 240);
      ctx.bezierCurveTo(CX + 172, 96, CX - 172, 96, CX - 192, 240);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'curly') {
      var pts = [
        [CX - 188, 300], [CX - 206, 380], [CX - 196, 460], [CX - 158, 520],
        [CX - 104, 548], [CX - 46, 556], [CX + 14, 558], [CX + 74, 552],
        [CX + 132, 540], [CX + 176, 506], [CX + 202, 456], [CX + 212, 380],
        [CX + 196, 300], [CX + 170, 228], [CX + 128, 176], [CX + 68, 146],
        [CX, 136], [CX - 68, 146], [CX - 128, 176], [CX - 170, 228]
      ];
      for (var i = 0; i < pts.length; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], 52, 0, TAU);
        ctx.fill();
      }
    } else if (style === 'bun') {
      ctx.beginPath();
      ctx.ellipse(CX, 118, 68, 60, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(CX, 330, 198, 234, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(CX, 176, 46, 15, 0, 0, TAU);
      ctx.fillStyle = rgba(mix(col, '#000000', 0.55), 0.45);
      ctx.fill();
    } else if (style === 'pony') {
      ctx.beginPath();
      ctx.ellipse(CX, 328, 194, 218, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(CX + 148, 228);
      ctx.bezierCurveTo(CX + 264, 266, CX + 288, 430, CX + 252, 566);
      ctx.bezierCurveTo(CX + 238, 470, CX + 206, 356, CX + 136, 298);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(CX + 156, 268, 20, 13, -0.5, 0, TAU);
      ctx.fillStyle = rgba(mix(col, '#000000', 0.55), 0.4);
      ctx.fill();
    } else if (style === 'pixie') {
      ctx.beginPath();
      ctx.ellipse(CX, 330, 184, 198, 0, 0, TAU);
      ctx.fill();
    } else if (style === 'braids') {
      ctx.beginPath();
      ctx.ellipse(CX, 320, 196, 220, 0, 0, TAU);
      ctx.fill();
      var sides = [-1, 1];
      for (var s = 0; s < 2; s++) {
        var dir = sides[s];
        for (var k = 0; k < 5; k++) {
          var r = 34 - k * 3.6;
          ctx.beginPath();
          ctx.ellipse(CX + dir * (168 + k * 7), 424 + k * 56, r, r * 0.92, dir * 0.2, 0, TAU);
          ctx.fillStyle = k % 2 ? mix(col, '#000000', 0.16) : col;
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawHairFront(ctx, ch, col) {
    var style = ch.hairStyle;
    ctx.save();
    ctx.fillStyle = hairGrad(ctx, col);
    ctx.beginPath();
    ctx.moveTo(CX - 198, 300);
    ctx.bezierCurveTo(CX - 214, 108, CX + 214, 108, CX + 198, 300);

    if (style === 'bob') {
      ctx.quadraticCurveTo(CX + 94, 336, CX - 8, 320);
      ctx.quadraticCurveTo(CX - 120, 306, CX - 198, 300);
    } else if (style === 'curly') {
      ctx.quadraticCurveTo(CX + 150, 302, CX + 108, 286);
      ctx.quadraticCurveTo(CX + 58, 324, CX + 8, 288);
      ctx.quadraticCurveTo(CX - 44, 322, CX - 92, 288);
      ctx.quadraticCurveTo(CX - 152, 312, CX - 198, 300);
    } else if (style === 'bun' || style === 'pony') {
      ctx.quadraticCurveTo(CX, 284, CX - 198, 300);
    } else {
      ctx.bezierCurveTo(CX + 140, 296, CX + 46, 230, CX - 46, 256);
      ctx.bezierCurveTo(CX - 116, 272, CX - 158, 296, CX - 198, 300);
    }
    ctx.closePath();
    ctx.fill();

    // saç parlaklığı
    ctx.beginPath();
    ctx.moveTo(CX - 148, 214);
    ctx.bezierCurveTo(CX - 88, 142, CX + 88, 142, CX + 148, 214);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- kulaklar ---------- */

  function drawEars(ctx, ch, skin) {
    var fw = ch.faceWidth || 1;
    [-1, 1].forEach(function (s) {
      var ex = CX + s * 148 * fw;
      ctx.beginPath();
      ctx.ellipse(ex, 392, 20, 31, s * 0.12, 0, TAU);
      ctx.fillStyle = skin;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ex + s * 2, 394, 10, 18, s * 0.12, 0, TAU);
      ctx.fillStyle = rgba(mix(skin, '#000000', 0.28), 0.45);
      ctx.fill();
    });
  }

  /* ---------- yüz ---------- */

  function drawFaceBase(ctx, ch, m) {
    var base = m.skin || ch.skin;
    ctx.save();
    facePath(ctx, ch);
    ctx.clip();

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    var rg = ctx.createRadialGradient(CX - 24, 330, 20, CX - 10, 380, 300);
    rg.addColorStop(0, 'rgba(255,255,255,0.3)');
    rg.addColorStop(0.55, 'rgba(255,255,255,0.08)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);

    var sh = mix(base, '#7a3a2a', 0.4);
    [-1, 1].forEach(function (s) {
      var lg = ctx.createLinearGradient(CX + s * 178, 0, CX + s * 58, 0);
      lg.addColorStop(0, rgba(sh, 0.5));
      lg.addColorStop(1, rgba(sh, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(0, FACE_TOP - 10, W, 480);
    });

    if (m.contour) {
      var cc = mix(base, '#5a2a1e', 0.55);
      [-1, 1].forEach(function (s) {
        var g = ctx.createRadialGradient(CX + s * 118, 432, 4, CX + s * 112, 436, 58);
        g.addColorStop(0, rgba(cc, 0.4));
        g.addColorStop(0.6, rgba(cc, 0.2));
        g.addColorStop(1, rgba(cc, 0));
        ctx.beginPath();
        ctx.ellipse(CX + s * 112, 436, 58, 34, s * 0.4, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();

        var t = ctx.createRadialGradient(CX + s * 168, 320, 2, CX + s * 168, 320, 70);
        t.addColorStop(0, rgba(cc, 0.34));
        t.addColorStop(1, rgba(cc, 0));
        ctx.beginPath();
        ctx.arc(CX + s * 168, 320, 70, 0, TAU);
        ctx.fillStyle = t;
        ctx.fill();
      });
      // burun kenarı
      var n1 = ctx.createLinearGradient(CX - 26, 400, CX + 26, 400);
      n1.addColorStop(0, 'rgba(0,0,0,0)');
      n1.addColorStop(0.5, rgba(cc, 0.16));
      n1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = n1;
      ctx.fillRect(CX - 30, 396, 60, 60);
    }

    if (m.highlight) {
      var spots = [
        [CX - 96, 396, 42], [CX + 96, 396, 42], [CX, 412, 24],
        [CX, 552, 40], [CX - 74, 306, 34], [CX + 74, 306, 34]
      ];
      for (var i = 0; i < spots.length; i++) {
        var p = spots[i];
        var g2 = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], p[2]);
        g2.addColorStop(0, 'rgba(255,255,255,0.5)');
        g2.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(p[0], p[1], p[2], 0, TAU);
        ctx.fillStyle = g2;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawNose(ctx, ch, m) {
    var base = m.skin || ch.skin;
    var sh = mix(base, '#7a3a2a', 0.45);
    ctx.save();
    ctx.strokeStyle = rgba(sh, 0.55);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(CX - 6, 404);
    ctx.quadraticCurveTo(CX - 11, 436, CX - 3, 448);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CX - 15, 448);
    ctx.quadraticCurveTo(CX, 460, CX + 15, 448);
    ctx.strokeStyle = rgba(sh, 0.38);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(CX - 12, 447, 4.5, 3, 0.2, 0, TAU);
    ctx.ellipse(CX + 12, 447, 4.5, 3, -0.2, 0, TAU);
    ctx.fillStyle = rgba(sh, 0.4);
    ctx.fill();
    ctx.restore();
  }

  function drawBlush(ctx, ch, m) {
    if (!m.blush || !m.blush.color) return;
    var st = m.blush.strength || 0.9;
    var fw = ch.faceWidth || 1;
    ctx.save();
    facePath(ctx, ch);
    ctx.clip();
    [-1, 1].forEach(function (s) {
      var bx = CX + s * 96 * fw, by = 438;
      var g = ctx.createRadialGradient(bx, by, 3, bx, by, 78);
      g.addColorStop(0, rgba(m.blush.color, 0.55 * st));
      g.addColorStop(0.55, rgba(m.blush.color, 0.24 * st));
      g.addColorStop(1, rgba(m.blush.color, 0));
      ctx.beginPath();
      ctx.ellipse(bx, by, 78, 54, 0, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- kaşlar ---------- */

  function drawBrows(ctx, ch, m) {
    var color = (m.brow && m.brow.color) || mix(ch.hair, '#000000', 0.12);
    var th = (m.brow && m.brow.thick) || 5;
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(CX, 0);
      ctx.scale(s, 1);
      ctx.translate(-CX, 0);
      ctx.beginPath();
      ctx.moveTo(CX + 44, 334);
      ctx.quadraticCurveTo(CX + 78, 310, CX + 118, 322);
      ctx.strokeStyle = color;
      ctx.lineWidth = th;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ---------- gözler ---------- */

  function drawShadowBand(ctx, cx, cy, w, h, sh) {
    var lift = sh.style === 'smoky' ? 28 : 20;
    var st = sh.strength || 0.9;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w - 4, cy + h * 0.2);
    ctx.bezierCurveTo(cx - w * 0.9, cy - h * 1.2 - lift * 0.5, cx - w * 0.2, cy - h * 1.55 - lift, cx + w * 0.5, cy - h * 1.15 - lift);
    ctx.bezierCurveTo(cx + w * 0.98, cy - h * 0.95 - lift * 0.45, cx + w + 20, cy - h * 0.2 - lift * 0.1, cx + w + 26, cy + 6);
    ctx.bezierCurveTo(cx + w * 0.6, cy - h * 0.35, cx - w * 0.4, cy - h * 0.55, cx - w - 4, cy + h * 0.2);
    ctx.closePath();
    ctx.clip();

    var g = ctx.createLinearGradient(cx, cy - h * 1.6 - lift, cx, cy + h * 0.4);
    g.addColorStop(0, rgba(sh.color, 0));
    g.addColorStop(0.45, rgba(sh.color, 0.34 * st));
    g.addColorStop(1, rgba(sh.color, 0.95 * st));
    ctx.fillStyle = g;
    ctx.fillRect(cx - w - 40, cy - h * 2.4 - lift, (w + 40) * 2 + 20, h * 4 + lift + 60);

    if (sh.style === 'glitter') {
      var gl = [[cx - 26, cy - 34], [cx - 6, cy - 44], [cx + 16, cy - 36], [cx + 34, cy - 22], [cx - 40, cy - 18], [cx + 6, cy - 26]];
      for (var i = 0; i < gl.length; i++) {
        ctx.beginPath();
        ctx.arc(gl[i][0], gl[i][1], 2.4, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawEyeUnit(ctx, ch, m, cx) {
    var w = 41, h = 27, cy = EYE_Y;

    if (m.shadow && m.shadow.color) drawShadowBand(ctx, cx, cy, w, h, m.shadow);

    // göz akı
    ctx.save();
    eyePath(ctx, cx, cy, w, h);
    ctx.clip();
    var sg = ctx.createLinearGradient(0, cy - h, 0, cy + h);
    sg.addColorStop(0, '#ece1db');
    sg.addColorStop(0.45, '#ffffff');
    sg.addColorStop(1, '#fdf7f5');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - w - 8, cy - h * 2, (w + 8) * 2 + 16, h * 4);

    var ir = 18, iy = cy - 2;
    var ig = ctx.createRadialGradient(cx - 2, iy - 5, 1, cx, iy, ir);
    ig.addColorStop(0, mix(ch.eye, '#ffffff', 0.5));
    ig.addColorStop(0.55, ch.eye);
    ig.addColorStop(1, mix(ch.eye, '#000000', 0.55));
    ctx.beginPath();
    ctx.arc(cx, iy, ir, 0, TAU);
    ctx.fillStyle = ig;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, iy, ir - 0.6, 0, TAU);
    ctx.strokeStyle = rgba(mix(ch.eye, '#000000', 0.62), 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, iy, 7.5, 0, TAU);
    ctx.fillStyle = '#140d0b';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - 6, iy - 7, 5.4, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + 6.5, iy + 5, 2.8, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    var lg = ctx.createLinearGradient(0, cy - h * 1.35, 0, cy + h * 0.2);
    lg.addColorStop(0, 'rgba(70,35,35,0.4)');
    lg.addColorStop(1, 'rgba(70,35,35,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - w - 8, cy - h * 2, (w + 8) * 2 + 16, h * 2);
    ctx.restore();

    // kapak çizgisi / eyeliner
    var linerColor = (m.liner && m.liner.color) || '#4a2f28';
    var lw = (m.liner && m.liner.color) ? (m.liner.thick || 4) : 2.2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = linerColor;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(cx - w + 1, cy + h * 0.18);
    ctx.quadraticCurveTo(cx - w * 0.45, cy - h * 1.22, cx + w * 0.18, cy - h * 0.9);
    ctx.quadraticCurveTo(cx + w * 0.8, cy - h * 0.55, cx + w, cy + h * 0.05);
    ctx.stroke();

    if (m.liner && m.liner.color && m.liner.wing) {
      ctx.lineWidth = Math.max(2, lw * 0.62);
      ctx.beginPath();
      ctx.moveTo(cx + w - 8, cy + h * 0.02);
      ctx.quadraticCurveTo(cx + w + 12, cy - 3, cx + w + 27, cy - 16);
      ctx.stroke();
    }

    // kirpikler
    var count = m.mascara ? 7 : 3;
    var len = m.mascara ? 11 : 6;
    ctx.strokeStyle = '#2a1a16';
    ctx.lineWidth = 1.7;
    var p0 = { x: cx + w * 0.18, y: cy - h * 0.9 };
    var cp = { x: cx + w * 0.8, y: cy - h * 0.55 };
    var p1 = { x: cx + w, y: cy + h * 0.05 };
    for (var i = 0; i < count; i++) {
      var t = 0.16 + (i / (count - 1)) * 0.82;
      var p = bez(p0, cp, p1, t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 3 + t * len * 0.55, p.y - len * (0.95 - t * 0.3));
      ctx.stroke();
    }

    if (m.mascara) {
      for (var k = 0; k < 3; k++) {
        var tt = 0.3 + k * 0.25;
        var q = bez({ x: cx - w * 0.2, y: cy + h * 0.9 }, { x: cx + w * 0.5, y: cy + h * 0.6 }, { x: cx + w * 0.95, y: cy + h * 0.1 }, tt);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x + 1.5, q.y + 5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawEyes(ctx, ch, m) {
    [-1, 1].forEach(function (s) {
      ctx.save();
      ctx.translate(CX, 0);
      ctx.scale(s, 1);
      ctx.translate(-CX, 0);
      drawEyeUnit(ctx, ch, m, CX + EYE_DX);
      ctx.restore();
    });
  }

  /* ---------- dudaklar ---------- */

  function drawLips(ctx, ch, m) {
    var w = 38 * (ch.lipWidth || 1);
    var h = 20 * ((m.lip && m.lip.full) || 1);
    var col = (m.lip && m.lip.color) || ch.lipBase;
    var gloss = !m.lip || m.lip.finish !== 'mat';
    var cy = MOUTH_Y;

    // alt dudak
    ctx.beginPath();
    ctx.moveTo(CX - w, cy);
    ctx.bezierCurveTo(CX - w * 0.55, cy + h * 1.2, CX + w * 0.55, cy + h * 1.2, CX + w, cy);
    ctx.bezierCurveTo(CX + w * 0.45, cy + h * 0.12, CX - w * 0.45, cy + h * 0.12, CX - w, cy);
    ctx.closePath();
    var lg = ctx.createLinearGradient(0, cy, 0, cy + h * 1.1);
    lg.addColorStop(0, mix(col, '#000000', 0.12));
    lg.addColorStop(0.45, col);
    lg.addColorStop(1, mix(col, '#ffffff', 0.22));
    ctx.fillStyle = lg;
    ctx.fill();

    // üst dudak
    ctx.beginPath();
    ctx.moveTo(CX - w, cy);
    ctx.bezierCurveTo(CX - w * 0.75, cy - h * 0.85, CX - w * 0.42, cy - h * 1.05, CX - w * 0.18, cy - h * 0.72);
    ctx.bezierCurveTo(CX - w * 0.06, cy - h * 0.5, CX + w * 0.06, cy - h * 0.5, CX + w * 0.18, cy - h * 0.72);
    ctx.bezierCurveTo(CX + w * 0.42, cy - h * 1.05, CX + w * 0.75, cy - h * 0.85, CX + w, cy);
    ctx.bezierCurveTo(CX + w * 0.5, cy + h * 0.14, CX - w * 0.5, cy + h * 0.14, CX - w, cy);
    ctx.closePath();
    var ug = ctx.createLinearGradient(0, cy - h * 0.9, 0, cy);
    ug.addColorStop(0, mix(col, '#000000', 0.3));
    ug.addColorStop(1, mix(col, '#000000', 0.05));
    ctx.fillStyle = ug;
    ctx.fill();

    // ağız çizgisi
    ctx.beginPath();
    ctx.moveTo(CX - w * 0.94, cy);
    ctx.quadraticCurveTo(CX, cy + h * 0.14, CX + w * 0.94, cy);
    ctx.strokeStyle = rgba(mix(col, '#2a0a10', 0.65), 0.7);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (gloss) {
      ctx.beginPath();
      ctx.ellipse(CX - 9, cy + h * 0.5, 13, 5.4, -0.08, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(CX + 12, cy + h * 0.32, 5, 2.6, 0.1, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }
  }

  /* ---------- aksesuarlar ---------- */

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
    ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
    ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawAccessories(ctx, ch, m) {
    var fw = ch.faceWidth || 1;

    if (m.earrings) {
      [-1, 1].forEach(function (s) {
        var x = CX + s * 150 * fw, y = 404;
        ctx.beginPath();
        ctx.arc(x, y + 12, 5.5, 0, TAU);
        ctx.fillStyle = '#ffd479';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y + 31, 9, 13, 0, 0, TAU);
        ctx.fillStyle = '#ffcf5c';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - 2.5, y + 27, 3.2, 4.8, 0, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
      });
    }

    if (m.glasses) {
      var gy = EYE_Y - 2;
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#d0a72c';
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      [-1, 1].forEach(function (s) {
        roundRect(ctx, CX + s * EYE_DX - 52, gy - 34, 104, 70, 26);
        ctx.fill();
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(CX - 28, gy - 14);
      ctx.quadraticCurveTo(CX, gy - 26, CX + 28, gy - 14);
      ctx.stroke();
      ctx.restore();
    }

    if (m.crown) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(CX - 88, 170);
      ctx.quadraticCurveTo(CX, 132, CX + 88, 170);
      ctx.quadraticCurveTo(CX, 154, CX - 88, 170);
      ctx.closePath();
      ctx.fillStyle = '#ffd479';
      ctx.fill();

      var spikes = [[-54, 148, 106], [0, 142, 84], [54, 148, 106]];
      for (var i = 0; i < spikes.length; i++) {
        var sx = CX + spikes[i][0], sy = spikes[i][1], ty = spikes[i][2];
        ctx.beginPath();
        ctx.moveTo(sx - 18, sy);
        ctx.lineTo(sx, ty);
        ctx.lineTo(sx + 18, sy);
        ctx.closePath();
        ctx.fillStyle = '#ffcf5c';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, ty + 4, 6, 0, TAU);
        ctx.fillStyle = '#fff3c4';
        ctx.fill();
      }
      ctx.restore();
    }

    if (m.bow) {
      ctx.save();
      ctx.translate(CX - 132, 188);
      ctx.rotate(-0.2);
      ctx.fillStyle = '#ff6fa5';
      ctx.beginPath();
      ctx.ellipse(-24, 0, 25, 16, -0.32, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(24, 0, 25, 16, 0.32, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fillStyle = '#ff9bc3';
      ctx.fill();
      ctx.restore();
    }

    if (m.sparkle) {
      star(ctx, CX + 116, 448, 12, 'rgba(255,248,196,0.95)');
      star(ctx, CX - 122, 462, 9, 'rgba(255,248,196,0.85)');
      star(ctx, CX + 60, 300, 7, 'rgba(255,255,255,0.8)');
    }
  }

  /* ---------- dışa açılan API ---------- */

  var art = {};

  art.render = function (ctx, ch, m) {
    m = m || {};
    var hairColor = m.hair || ch.hair;
    var skin = m.skin || ch.skin;
    var themes = window.PALETTES.bg;
    var theme = themes[m.bg || 0] || themes[0];

    drawBackground(ctx, theme);
    drawHairBack(ctx, ch, hairColor);
    drawBody(ctx, ch, skin);
    drawEars(ctx, ch, skin);
    drawFaceBase(ctx, ch, m);
    drawEyes(ctx, ch, m);
    drawBrows(ctx, ch, m);
    drawNose(ctx, ch, m);
    drawBlush(ctx, ch, m);
    drawLips(ctx, ch, m);
    drawHairFront(ctx, ch, hairColor);
    drawAccessories(ctx, ch, m);
  };

  art.portrait = function (canvas, ch, m) {
    var size = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 90;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(size * dpr));
    canvas.height = Math.max(1, Math.round(size * dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = canvas.width / 470;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.clip();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(s, s);
    ctx.translate(-CX, -366);
    art.render(ctx, ch, m || {});
    ctx.restore();
  };

  window.FaceArt = art;
})();
