/* ============================================================
   SUPER MECHS — отрисовка: векторные мехи (canvas 2D), сцена боя,
   анимации, частицы, всплывающий урон, простые WebAudio-звуки.
   ============================================================ */
(function () {
  'use strict';
  const D = SM.DATA;

  // ---------- Утилиты цвета ----------
  function shade(hex, f) { // f: -1..1 (затемнить/осветлить)
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  const ELEM_COLOR = { PHYS: '#ffd23f', HEAT: '#ff5c33', ENER: '#33bbff' };

  /* ============================================================
     ЗВУК (маленький синтезатор, без ассетов)
     ============================================================ */
  let audioCtx = null;
  function actx() {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    return audioCtx;
  }
  function beep(freq, dur, type, vol, slide) {
    if (!SM.core.state || !SM.core.state.sound) return;
    const ctx = actx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.value = vol || 0.06;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, vol) {
    if (!SM.core.state || !SM.core.state.sound) return;
    const ctx = actx(); if (!ctx) return;
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol || 0.08;
    src.connect(g).connect(ctx.destination); src.start();
  }
  SM.sfx = {
    shot(elem) {
      if (elem === 'ENER') beep(880, 0.14, 'sawtooth', 0.05, -500);
      else if (elem === 'HEAT') { noise(0.18, 0.06); beep(160, 0.2, 'sawtooth', 0.05, -80); }
      else { noise(0.1, 0.07); beep(220, 0.1, 'square', 0.05, -120); }
    },
    impact() { noise(0.22, 0.1); beep(90, 0.25, 'sine', 0.09, -40); },
    move() { beep(140, 0.08, 'triangle', 0.04, 60); },
    tele() { beep(1200, 0.3, 'sine', 0.05, -900); },
    overheat() { noise(0.5, 0.06); beep(70, 0.5, 'sawtooth', 0.05, -30); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'square', 0.06), i * 130)); },
    lose() { [400, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.28, 'sawtooth', 0.05), i * 160)); },
    coin() { beep(988, 0.08, 'square', 0.05); setTimeout(() => beep(1319, 0.15, 'square', 0.05), 70); },
    click() { beep(600, 0.05, 'triangle', 0.03); },
  };

  /* ============================================================
     ОТРИСОВКА МЕХА (векторная, из частей)
     ============================================================ */
  // items: slotKey -> {def} (достаточно def). paint — hex.
  // facing: 1 (вправо) / -1 (влево). t — время для анимации (боб).
  function drawMech(ctx, x, y, scale, opts) {
    const { items = {}, paint = '#3b7bd4', facing = 1, t = 0, visual = 'mech',
      overheated = false, flashSlot = null, hidden = false, alpha = 1 } = opts || {};
    if (hidden) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    const bob = Math.sin(t / 500) * 2;

    if (visual === 'buggy') { drawBuggy(ctx, paint, t); ctx.restore(); return; }
    if (visual === 'tank') { drawTank(ctx, paint, t); ctx.restore(); return; }

    const torsoDef = items.torso && items.torso.def;
    const legsDef = items.legs && items.legs.def;
    const elem = torsoDef ? torsoDef.elem : 'PHYS';
    const accent = ELEM_COLOR[elem] || '#ffd23f';
    const boss = visual === 'boss';
    const p = boss ? '#23232e' : paint;

    // ---- НОГИ ----
    const legType = legsDef ? (legsDef.move.walk >= 3 ? 'wheels' : (legsDef.id === 'legs_claw' ? 'claw' : 'boots')) : 'boots';
    drawLegs(ctx, legType, p, bob);

    // ---- КОРПУС ----
    ctx.save();
    ctx.translate(0, -52 + bob);
    // нижняя юбка
    ctx.fillStyle = shade(p, -0.45);
    rr(ctx, -20, -6, 40, 12, 4); ctx.fill();
    // основной корпус
    const grad = ctx.createLinearGradient(0, -46, 0, 4);
    grad.addColorStop(0, shade(p, 0.15)); grad.addColorStop(1, shade(p, -0.35));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-26, 0); ctx.lineTo(-30, -26); ctx.lineTo(-20, -44);
    ctx.lineTo(18, -46); ctx.lineTo(30, -30); ctx.lineTo(28, -4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(p, -0.55); ctx.lineWidth = 1.6; ctx.stroke();
    // броневые пластины
    ctx.fillStyle = shade(p, -0.18);
    rr(ctx, -22, -24, 20, 18, 3); ctx.fill();
    ctx.fillStyle = shade(p, 0.06);
    rr(ctx, 2, -40, 22, 14, 3); ctx.fill();
    // «глаз»
    ctx.fillStyle = boss ? '#ff3030' : accent;
    ctx.shadowColor = boss ? '#ff3030' : accent; ctx.shadowBlur = 8;
    rr(ctx, 12, -35, 12, 5, 2.5); ctx.fill();
    ctx.shadowBlur = 0;
    // акцентная полоса элемента
    ctx.fillStyle = accent;
    rr(ctx, -18, -8, 34, 3, 1.5); ctx.fill();
    // вентиляция / перегрев
    if (overheated) {
      ctx.fillStyle = 'rgba(255,90,40,' + (0.5 + 0.3 * Math.sin(t / 90)) + ')';
      rr(ctx, -16, -20, 4, 10, 2); ctx.fill();
      rr(ctx, -9, -20, 4, 10, 2); ctx.fill();
    }
    ctx.restore();

    // ---- БОКОВОЕ ОРУЖИЕ (руки-пушки) ----
    const sides = ['side1', 'side2'].map(k => items[k]).filter(Boolean);
    sides.forEach((it, i) => {
      const wy = -74 + bob + i * 13;
      drawGun(ctx, 16, wy, it.def, flashSlot === it.slotKeyDraw, t, 1.0 - i * 0.15);
    });
    // ---- ВЕРХНЕЕ ОРУЖИЕ (на плече) ----
    const tops = ['top1', 'top2'].map(k => items[k]).filter(Boolean);
    tops.forEach((it, i) => {
      drawTopGun(ctx, -6 - i * 10, -100 + bob + i * 2, it.def, t);
    });
    // ---- ДРОН ----
    if (items.drone) drawDrone(ctx, 34, -128 + Math.sin(t / 350) * 5, items.drone.def, t);

    ctx.restore();
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLegs(ctx, type, p, bob) {
    const dark = shade(p, -0.4), mid = shade(p, -0.15);
    if (type === 'wheels') {
      ctx.fillStyle = mid; rr(ctx, -24, -52 + bob, 48, 22, 6); ctx.fill();
      [-14, 12].forEach(wx => {
        ctx.fillStyle = '#22262b';
        ctx.beginPath(); ctx.arc(wx, -14, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#3d444d';
        ctx.beginPath(); ctx.arc(wx, -14, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#181b1f';
        ctx.beginPath(); ctx.arc(wx, -14, 3, 0, 7); ctx.fill();
      });
      return;
    }
    if (type === 'claw') {
      ctx.fillStyle = dark;
      [-1, 1].forEach(s => {
        ctx.beginPath();
        ctx.moveTo(0, -50 + bob); ctx.lineTo(s * 26, -20); ctx.lineTo(s * 32, 0);
        ctx.lineTo(s * 18, 0); ctx.lineTo(s * 8, -24); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = mid; rr(ctx, -14, -56 + bob, 28, 14, 4); ctx.fill();
      return;
    }
    // boots (двуногий)
    [[-13, -0.3], [7, -0.1]].forEach(([lx, sh]) => {
      ctx.fillStyle = shade(p, sh - 0.15);
      rr(ctx, lx, -52 + bob, 12, 22, 3); ctx.fill();       // бедро
      ctx.fillStyle = shade(p, sh - 0.3);
      rr(ctx, lx - 1, -32 + bob * 0.5, 13, 22, 3); ctx.fill(); // голень
      ctx.fillStyle = shade(p, sh - 0.45);
      rr(ctx, lx - 4, -10, 22, 10, 3); ctx.fill();          // ступня
    });
  }

  function drawGun(ctx, x, y, def, flash, t, fade) {
    const c = ELEM_COLOR[def.elem] || '#ffd23f';
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.fillStyle = '#2c3138';
    rr(ctx, x - 8, y - 5, 20, 12, 3); ctx.fill();   // ствольная коробка
    ctx.fillStyle = '#454c55';
    rr(ctx, x + 10, y - 3, 22, 7, 2); ctx.fill();   // ствол
    ctx.fillStyle = c;
    rr(ctx, x - 4, y - 3, 6, 8, 2); ctx.fill();     // индикатор элемента
    ctx.restore();
  }

  function drawTopGun(ctx, x, y, def, t) {
    const c = ELEM_COLOR[def.elem] || '#ffd23f';
    ctx.fillStyle = '#343a42';
    rr(ctx, x - 10, y, 24, 10, 3); ctx.fill();
    ctx.fillStyle = '#4d545e';
    rr(ctx, x + 12, y + 2, 26, 6, 2); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x - 2, y + 5, 2.6, 0, 7); ctx.fill();
  }

  function drawDrone(ctx, x, y, def, t) {
    const c = ELEM_COLOR[def.elem] || '#ffd23f';
    ctx.fillStyle = '#2c3138';
    rr(ctx, x - 10, y - 5, 20, 10, 4); ctx.fill();
    ctx.fillStyle = '#454c55';
    rr(ctx, x + 8, y - 2, 8, 4, 2); ctx.fill();
    ctx.fillStyle = c;
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(x - 3, y, 2.6, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    // винты
    ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 7); ctx.lineTo(x - 2, y - 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y - 7); ctx.lineTo(x + 12, y - 7); ctx.stroke();
  }

  function drawBuggy(ctx, p, t) {
    ctx.fillStyle = shade(p, -0.2);
    rr(ctx, -26, -34, 52, 20, 6); ctx.fill();
    ctx.fillStyle = shade(p, 0.1);
    rr(ctx, -10, -46, 24, 14, 4); ctx.fill();
    ctx.fillStyle = '#454c55';
    rr(ctx, 12, -42, 20, 5, 2); ctx.fill(); // пушечка
    [[-14], [14]].forEach(([wx]) => {
      ctx.fillStyle = '#22262b';
      ctx.beginPath(); ctx.arc(wx, -10, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d444d';
      ctx.beginPath(); ctx.arc(wx, -10, 5, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(6, -40, 2.5, 0, 7); ctx.fill();
  }

  function drawTank(ctx, p, t) {
    ctx.fillStyle = '#22262b';
    rr(ctx, -34, -22, 68, 18, 8); ctx.fill(); // гусеницы
    ctx.fillStyle = '#3d444d';
    for (let i = -28; i <= 26; i += 9) { ctx.beginPath(); ctx.arc(i, -13, 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = shade(p, -0.15);
    rr(ctx, -28, -40, 56, 20, 5); ctx.fill(); // корпус
    ctx.fillStyle = shade(p, 0.08);
    rr(ctx, -12, -54, 26, 16, 5); ctx.fill(); // башня
    ctx.fillStyle = '#454c55';
    rr(ctx, 12, -50, 30, 6, 2); ctx.fill();   // ствол
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(-2, -48, 2.5, 0, 7); ctx.fill();
  }

  /* ============================================================
     ПРЕВЬЮ МЕХА в мастерской
     ============================================================ */
  function renderPreview(canvas, itemsEntries, paint, visual) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // подиум
    const g = ctx.createRadialGradient(W / 2, H - 20, 10, W / 2, H - 20, W / 2);
    g.addColorStop(0, 'rgba(80,140,220,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(W / 2, H - 18, W / 2.4, 14, 0, 0, 7); ctx.fill();
    drawMech(ctx, W / 2, H - 22, H / 190, {
      items: itemsEntries, paint, facing: 1, t: performance.now(), visual: visual || 'mech',
    });
  }

  /* ============================================================
     СЦЕНА БОЯ
     ============================================================ */
  function BattleScene(canvas, battle) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.battle = battle;
    this.queue = [];        // очередь анимаций
    this.current = null;
    this.particles = [];
    this.floaters = [];
    this.projectiles = [];
    this.shake = 0;
    this.onIdle = null;     // колбэк, когда очередь опустела
    this.vis = battle.fighters.map(f => ({
      pos: f.pos, hp: f.hp, eng: f.eng, heat: f.heat, flash: 0, hidden: false,
    }));
    this.running = true;
    this.lastT = performance.now();
    const self = this;
    (function loop(t) {
      if (!self.running) return;
      self.tick(t);
      requestAnimationFrame(loop);
    })(performance.now());
  }

  BattleScene.prototype.stop = function () { this.running = false; };

  BattleScene.prototype.tileX = function (tile) {
    const W = this.canvas.width;
    const pad = 60;
    return pad + (W - pad * 2) * (tile / (D.BATTLE.TILES - 1));
  };
  BattleScene.prototype.groundY = function () { return this.canvas.height - 46; };

  // ---------- Очередь событий движка → анимации ----------
  BattleScene.prototype.enqueue = function (events, done) {
    const self = this;
    events.forEach(ev => self.queue.push(ev));
    if (done) this.queue.push({ type: '_cb', cb: done });
  };

  BattleScene.prototype.startEvent = function (ev) {
    const B = this.battle;
    const self = this;
    const mk = (dur, extra) => Object.assign({ ev, t0: performance.now(), dur }, extra);
    switch (ev.type) {
      case '_cb': ev.cb(); return null;
      case 'move': SM.sfx.move(); return mk(420);
      case 'tele': SM.sfx.tele(); return mk(500);
      case 'charge': SM.sfx.move(); return mk(320);
      case 'hook': SM.sfx.shot('PHYS'); return mk(450);
      case 'fire': case 'stomp': case 'drone': case 'teleHit': case 'chargeHit': case 'hookHit': {
        SM.sfx.shot(ev.elem);
        return mk(520, { impactDone: false });
      }
      case 'overheat': SM.sfx.overheat(); this.addFloater(this.tileX(this.battle.fighters[ev.who].pos), this.groundY() - 150, 'ПЕРЕГРЕВ!', '#ff6a3d', 22); return mk(700);
      case 'cooldown': return mk(120);
      case 'turn': return mk(200);
      case 'end': return mk(500);
    }
    return mk(100);
  };

  BattleScene.prototype.addFloater = function (x, y, text, color, size) {
    this.floaters.push({ x, y, text, color, size: size || 16, t: 0 });
  };
  BattleScene.prototype.burst = function (x, y, color, n, spd) {
    for (let i = 0; i < (n || 14); i++) {
      const a = Math.random() * Math.PI * 2, v = (spd || 2.4) * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2, life: 1, color });
    }
  };

  BattleScene.prototype.tick = function (t) {
    const dt = Math.min(50, t - this.lastT);
    this.lastT = t;
    const B = this.battle;

    // запуск следующей анимации
    while (!this.current && this.queue.length) {
      this.current = this.startEvent(this.queue.shift());
    }
    if (!this.current && this.onIdle) { const cb = this.onIdle; this.onIdle = null; cb(); }

    // обновление текущей анимации
    if (this.current) {
      const a = this.current, ev = a.ev;
      const p = Math.min(1, (t - a.t0) / a.dur);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      if (ev.type === 'move' || ev.type === 'charge') {
        const v = this.vis[ev.who];
        v.pos = ev.from + (ev.to - ev.from) * ease;
        if (ev.type === 'move' && ev.jump) v.jumpY = Math.sin(p * Math.PI) * 46;
        else v.jumpY = 0;
        if (p >= 1) { v.pos = ev.to; v.jumpY = 0; }
      } else if (ev.type === 'tele') {
        const v = this.vis[ev.who];
        if (p < 0.45) { v.alpha = 1 - p / 0.45; }
        else { v.pos = ev.to; v.alpha = (p - 0.45) / 0.55; }
        if (p >= 1) { v.alpha = 1; v.pos = ev.to; }
        if (Math.random() < 0.4) this.burst(this.tileX(v.pos), this.groundY() - 60, '#7fd8ff', 2, 1.5);
      } else if (ev.type === 'hook') {
        // цель едет к источнику
        const tgt = this.vis[1 - ev.who];
        const dest = this.battle.fighters[1 - ev.who].pos;
        if (p > 0.4) tgt.pos = ev.targetFrom + (dest - ev.targetFrom) * ((p - 0.4) / 0.6);
        if (p >= 1) tgt.pos = dest;
      } else if (['fire', 'stomp', 'drone', 'teleHit', 'chargeHit', 'hookHit'].includes(ev.type)) {
        // импакт на 45% времени
        if (p > 0.45 && !a.impactDone) {
          a.impactDone = true;
          const who = ev.who, tgtI = 1 - who;
          const tv = this.vis[tgtI];
          const tx = this.tileX(tv.pos), ty = this.groundY() - 70;
          SM.sfx.impact();
          this.shake = Math.min(14, 4 + (ev.dmg || 0) / 40);
          this.burst(tx, ty, ELEM_COLOR[ev.elem] || '#ffd23f', 16, 3);
          if (ev.dmg) this.addFloater(tx, ty - 30, '-' + ev.dmg, '#ffffff', 20);
          if (ev.drained) this.addFloater(tx + 26, ty - 8, '-' + ev.drained + '⚡', '#33bbff', 14);
          if (ev.energyBreak) this.addFloater(tx - 30, ty - 52, 'BREAK +' + ev.energyBreak, '#8be0ff', 14);
          if (ev.heated) this.addFloater(tx + 30, ty - 44, '+' + ev.heated + '🔥', '#ff8c5a', 14);
          if (ev.backfire) {
            const sv = this.vis[who];
            this.addFloater(this.tileX(sv.pos), this.groundY() - 120, '-' + ev.backfire, '#ff9090', 14);
          }
          // сдвиги
          if (ev.pushedTo !== undefined) this.slideTo(tgtI, ev.pushedTo);
          if (ev.pulledTo !== undefined) this.slideTo(tgtI, ev.pulledTo);
          if (ev.recoilTo !== undefined) this.slideTo(who, ev.recoilTo);
        }
        // вспышка у стреляющего
        if (p < 0.3) this.vis[ev.who].flash = 1;
      } else if (ev.type === 'end') {
        if (p > 0.3 && !a.impactDone) {
          a.impactDone = true;
          const loser = 1 - ev.winner;
          const lv = this.vis[loser];
          this.burst(this.tileX(lv.pos), this.groundY() - 60, '#ff8040', 40, 5);
          this.shake = 18;
        }
      }
      if (p >= 1) this.current = null;
    }

    // плавные слайды от push/pull
    this.vis.forEach((v, i) => {
      if (v.slideTarget !== undefined) {
        const d = v.slideTarget - v.pos;
        if (Math.abs(d) < 0.02) { v.pos = v.slideTarget; delete v.slideTarget; }
        else v.pos += d * Math.min(1, dt / 120);
      }
      // тянем бары
      const f = B.fighters[i];
      v.hp += (f.hp - v.hp) * Math.min(1, dt / 200);
      v.eng += (f.eng - v.eng) * Math.min(1, dt / 200);
      v.heat += (f.heat - v.heat) * Math.min(1, dt / 200);
      v.flash = Math.max(0, v.flash - dt / 150);
    });

    // частицы/флоатеры
    this.particles.forEach(pt => {
      pt.x += pt.vx * dt / 16; pt.y += pt.vy * dt / 16;
      pt.vy += 0.08 * dt / 16; pt.life -= dt / 700;
    });
    this.particles = this.particles.filter(p2 => p2.life > 0);
    this.floaters.forEach(fl => { fl.t += dt / 1000; fl.y -= dt / 28; });
    this.floaters = this.floaters.filter(fl => fl.t < 1.4);
    this.shake = Math.max(0, this.shake - dt / 28);

    this.draw(t);
  };

  BattleScene.prototype.slideTo = function (i, tile) { this.vis[i].slideTarget = tile; };

  BattleScene.prototype.draw = function (t) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const B = this.battle;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // небо
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#121a2b'); sky.addColorStop(0.7, '#2b2233'); sky.addColorStop(1, '#3a2a2a');
    ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
    // луна
    ctx.fillStyle = 'rgba(255,220,180,.7)';
    ctx.beginPath(); ctx.arc(W * 0.82, 60, 26, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(18,26,43,1)';
    ctx.beginPath(); ctx.arc(W * 0.82 + 10, 54, 22, 0, 7); ctx.fill();
    // руины на фоне
    ctx.fillStyle = '#1a2030';
    for (let i = 0; i < 7; i++) {
      const bx = (i * 173) % W, bw = 60 + (i * 47) % 70, bh = 60 + (i * 91) % 110;
      ctx.fillRect(bx, H - 46 - bh, bw, bh);
    }
    ctx.fillStyle = '#141926';
    for (let i = 0; i < 5; i++) {
      const bx = (i * 251 + 90) % W, bw = 80 + (i * 37) % 60, bh = 100 + (i * 71) % 90;
      ctx.fillRect(bx, H - 46 - bh, bw, bh);
    }

    // земля + тайлы
    const gy = this.groundY();
    ctx.fillStyle = '#2e3038'; ctx.fillRect(-20, gy, W + 40, H - gy + 20);
    ctx.fillStyle = '#43464f'; ctx.fillRect(-20, gy, W + 40, 5);
    for (let i = 0; i < D.BATTLE.TILES; i++) {
      const x = this.tileX(i);
      const active = this.hoverTiles && this.hoverTiles.includes(i);
      ctx.fillStyle = active ? 'rgba(90,200,120,.85)' : 'rgba(140,150,170,.28)';
      ctx.beginPath(); ctx.ellipse(x, gy + 12, 26, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = active ? '#c9ffd9' : 'rgba(200,210,230,.45)';
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, gy + 15);
    }

    // мехи
    B.fighters.forEach((f, i) => {
      const v = this.vis[i];
      const x = this.tileX(v.pos);
      const y = gy + 6 - (v.jumpY || 0);
      // тень
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.ellipse(x, gy + 10, 30, 7, 0, 0, 7); ctx.fill();
      drawMech(ctx, x, y, 0.92, {
        items: f.items, paint: f.paint, facing: i === 0 ? 1 : -1,
        t: t + i * 400, visual: f.visual, overheated: f.overheated,
        alpha: v.alpha === undefined ? 1 : v.alpha,
      });
      // вспышка выстрела
      if (v.flash > 0) {
        ctx.fillStyle = `rgba(255,240,150,${v.flash * 0.9})`;
        const fx = x + (i === 0 ? 40 : -40);
        ctx.beginPath(); ctx.arc(fx, y - 66, 10 + v.flash * 8, 0, 7); ctx.fill();
      }
      this.drawBars(f, v, x, y - 158, i);
    });

    // частицы
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    // флоатеры
    this.floaters.forEach(fl => {
      ctx.globalAlpha = Math.max(0, 1 - fl.t / 1.4);
      ctx.font = `bold ${fl.size}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  BattleScene.prototype.drawBars = function (f, v, x, y, side) {
    const ctx = this.ctx;
    const w = 120, h = 9;
    const bar = (yy, val, max, color, label) => {
      ctx.fillStyle = 'rgba(10,14,20,.75)';
      rr(ctx, x - w / 2, yy, w, h, 3); ctx.fill();
      const frac = max > 0 ? Math.max(0, Math.min(1, val / max)) : 0;
      ctx.fillStyle = color;
      if (frac > 0) { rr(ctx, x - w / 2 + 1, yy + 1, (w - 2) * frac, h - 2, 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.max(0, Math.round(val))}/${Math.round(max)}`, x, yy + h - 1.5);
    };
    // имя
    ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = this.battle.turn === side && !this.battle.over ? '#ffe066' : 'rgba(230,235,245,.9)';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.name, x, y - 4);
    ctx.fillText(f.name, x, y - 4);
    bar(y, v.hp, f.maxHp, '#52c46a');
    bar(y + 11, v.eng, f.maxEng, '#33bbff');
    // тепло: рисуем heat относительно cap, краснеет при переполнении
    const hotColor = v.heat > f.heatCap ? '#ff3838' : '#ff8c1a';
    bar(y + 22, v.heat, Math.max(f.heatCap, 1), hotColor);
  };

  SM.render = { drawMech, renderPreview, BattleScene, ELEM_COLOR, shade, rr };
})();
