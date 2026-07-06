/* ============================================================
   SUPER MECHS — боевой движок (1v1, линейное поле из 10 тайлов)
   + ИИ противника. Механики: 2 действия/ход, энергия/регенерация,
   тепло/охлаждение, Overheat/Shutdown, Energy Break, резисты,
   push/pull/recoil, дрон, телепорт, чардж, крюк, стомп.
   ============================================================ */
(function () {
  'use strict';
  const D = SM.DATA;
  const C = () => SM.core;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const WEAPON_SLOTS = ['side1', 'side2', 'side3', 'side4', 'top1', 'top2'];

  // ---------- Создание бойцов ----------
  function fighterFromItems(items, opts) {
    opts = opts || {};
    const mult = opts.statMult || 1;
    const f = {
      name: opts.name || 'MECH',
      side: 0, pos: 0,
      paint: opts.paint || '#3b7bd4',
      visual: opts.visual || 'mech',
      items: {},          // slotKey -> {inst, def, stats, usesLeft}
      weapons: [],        // ссылки на боевые слоты
      hp: 0, maxHp: 0, eng: 0, maxEng: 0, reg: 0,
      heat: 0, heatCap: 0, cool: 0,
      phyRes: 0, expRes: 0, eleRes: 0,
      walk: 1, jump: 0,
      dmgMult: (opts.dmgMult || 1) * mult,
      firedThisTurn: {},
      overheated: false,
      isAI: !!opts.isAI,
    };
    let base = { hp: 0, eng: 0, reg: 0, heat: 0, cool: 0, phyRes: 0, expRes: 0, eleRes: 0 };
    for (const slotKey in items) {
      const inst = items[slotKey];
      if (!inst) continue;
      const def = C().itemDef(inst);
      const stats = C().itemStats(inst);
      const entry = { slotKey, inst, def, stats, usesLeft: def.uses === 0 ? Infinity : (def.uses || Infinity) };
      f.items[slotKey] = entry;
      ['hp', 'eng', 'reg', 'heat', 'cool', 'phyRes', 'expRes', 'eleRes'].forEach(k => { if (stats[k]) base[k] += stats[k]; });
      if (stats.allRes) { base.phyRes += stats.allRes; base.expRes += stats.allRes; base.eleRes += stats.allRes; }
      if (def.kind === 'legs' && def.move) { f.walk = def.move.walk; f.jump = def.move.jump; }
      if (WEAPON_SLOTS.includes(slotKey)) f.weapons.push(entry);
    }
    if (opts.hpPenalty) base.hp = Math.max(1, base.hp - opts.hpPenalty);
    f.maxHp = Math.max(1, Math.round(base.hp * mult * (opts.hpMult || 1)));
    f.hp = f.maxHp;
    f.maxEng = Math.round(base.eng * mult); f.eng = f.maxEng;
    f.reg = Math.round(base.reg * mult);
    f.heatCap = Math.round(base.heat * mult); f.cool = Math.round(base.cool * mult);
    f.phyRes = base.phyRes; f.expRes = base.expRes; f.eleRes = base.eleRes;
    return f;
  }

  function fighterFromMech(mechIdx) {
    const st = C().state;
    const ms = C().mechStats(mechIdx);
    if (!ms.valid || !ms.usable) return null;
    const items = {};
    for (const k in ms.items) items[k] = ms.items[k];
    const f = fighterFromItems(items, {
      name: st.name, paint: st.paint, dmgMult: ms.dmgMult,
    });
    // mechStats уже учёл бусты арены и перегруз — применим готовые цифры
    f.maxHp = ms.hp; f.hp = ms.hp;
    f.maxEng = ms.eng; f.eng = ms.eng;
    f.reg = ms.reg; f.heatCap = ms.heat; f.cool = ms.cool;
    f.phyRes = ms.phyRes; f.expRes = ms.expRes; f.eleRes = ms.eleRes;
    return f;
  }

  function fighterFromFoe(foe) {
    return fighterFromItems(foe.items, {
      name: foe.name, statMult: foe.statMult, visual: foe.visual,
      paint: foe.paint || '#b03535', isAI: true,
    });
  }

  // ---------- Бой ----------
  function start(fa, fb) {
    fa.side = 0; fa.pos = 1;
    fb.side = 1; fb.pos = D.BATTLE.TILES - 2;
    const b = {
      fighters: [fa, fb],
      turn: 0,                 // индекс активного бойца
      actions: D.BATTLE.ACTIONS,
      round: 1,
      over: false, winner: null,
      log: [],
    };
    // перегрев на старте невозможен; проверка не нужна
    return b;
  }

  const me = b => b.fighters[b.turn];
  const en = b => b.fighters[1 - b.turn];
  const dist = b => Math.abs(b.fighters[0].pos - b.fighters[1].pos);

  function log(b, msg) { b.log.push(msg); }

  // ---------- Применение урона / эффектов ----------
  function applyHit(b, src, tgt, entry, events, tag) {
    const def = entry.def, st = entry.stats;
    const ev = { type: tag || 'hit', who: src.side, slot: entry.slotKey, elem: def.elem || 'PHYS' };
    let dmg = 0;
    if (st.dmg) {
      dmg = rnd(st.dmg[0], st.dmg[1]);
      dmg = Math.round(dmg * src.dmgMult);
      const resKey = def.elem === 'HEAT' ? 'expRes' : (def.elem === 'ENER' ? 'eleRes' : 'phyRes');
      dmg = Math.max(1, dmg - Math.max(0, tgt[resKey]));
    }
    // Дренаж энергии + Energy Break
    let drained = 0, brk = 0;
    if (st.engDmg) {
      const drain = st.engDmg;
      drained = Math.min(tgt.eng, drain);
      brk = Math.max(0, drain - tgt.eng);
      tgt.eng -= drained;
      dmg += brk; // излишек дренажа = доп. урон
    }
    // Нагрев
    let heated = 0;
    if (st.heatDmg) { heated = st.heatDmg; tgt.heat += heated; }
    // Дебаффы
    if (st.maxEngDmg) { tgt.maxEng = Math.max(0, tgt.maxEng - st.maxEngDmg); tgt.eng = Math.min(tgt.eng, tgt.maxEng); }
    if (st.maxHeatDmg) { tgt.heatCap = Math.max(0, tgt.heatCap - st.maxHeatDmg); }
    if (st.regDmg) tgt.reg = Math.max(0, tgt.reg - st.regDmg);
    if (st.coolDmg) tgt.cool = Math.max(0, tgt.cool - st.coolDmg);
    if (st.resDmg) {
      const rk = def.elem === 'HEAT' ? 'expRes' : (def.elem === 'ENER' ? 'eleRes' : 'phyRes');
      tgt[rk] -= st.resDmg; // может уйти в минус — как в оригинале
    }
    tgt.hp -= dmg;
    ev.dmg = dmg; ev.drained = drained; ev.energyBreak = brk; ev.heated = heated;
    // Push / Pull / Recoil
    const dir = tgt.pos > src.pos ? 1 : -1;
    if (def.push) {
      const to = clamp(tgt.pos + dir * def.push, 0, D.BATTLE.TILES - 1);
      if (to !== src.pos) { ev.pushedTo = to; tgt.pos = to; }
    }
    if (def.pull) {
      const near = src.pos + dir; // клетка вплотную к источнику
      if (near !== tgt.pos && near >= 0 && near < D.BATTLE.TILES) { ev.pulledTo = near; tgt.pos = near; }
    }
    if (def.recoil) {
      const to = clamp(src.pos - dir * def.recoil, 0, D.BATTLE.TILES - 1);
      if (to !== tgt.pos) { ev.recoilTo = to; src.pos = to; }
    }
    if (def.backfire) { src.hp -= def.backfire; ev.backfire = def.backfire; }
    events.push(ev);
    log(b, `${src.name}: ${entry.def.name} → ${dmg} урона` +
      (drained ? `, −${drained} энергии` : '') + (brk ? ` (Energy Break +${brk})` : '') +
      (heated ? `, +${heated} тепла` : ''));
    checkEnd(b, events);
    return ev;
  }

  function checkEnd(b, events) {
    if (b.over) return;
    const [a, c] = b.fighters;
    if (a.hp <= 0 || c.hp <= 0) {
      b.over = true;
      b.winner = a.hp <= 0 ? 1 : 0;
      events.push({ type: 'end', winner: b.winner });
      log(b, `ПОБЕДА: ${b.fighters[b.winner].name}`);
    }
  }

  // ---------- Доступность действий ----------
  function canUseWeapon(b, entry) {
    const f = me(b), o = en(b);
    const def = entry.def;
    if (!entry || entry.usesLeft <= 0) return { ok: false, why: 'Нет зарядов' };
    if (b.actions <= 0) return { ok: false, why: 'Нет действий' };
    if (f.firedThisTurn[entry.slotKey]) return { ok: false, why: 'Уже стреляло в этот ход' };
    const d = dist(b);
    if (d < def.range[0] || d > def.range[1]) return { ok: false, why: `Дальность ${def.range[0]}–${def.range[1]}` };
    if ((def.costE || 0) > f.eng) return { ok: false, why: 'Не хватает энергии' };
    return { ok: true };
  }

  function canStomp(b) {
    const f = me(b);
    const legs = f.items.legs;
    if (!legs) return { ok: false, why: 'Нет ног' };
    if (b.actions <= 0) return { ok: false, why: 'Нет действий' };
    if (f.firedThisTurn.legs) return { ok: false, why: 'Уже топал' };
    if (dist(b) !== 1) return { ok: false, why: 'Только вплотную' };
    return { ok: true };
  }

  function canSpecial(b, key) { // tele / charge / hook
    const f = me(b), entry = f.items[key];
    if (!entry) return { ok: false, why: 'Слот пуст' };
    if (b.actions <= 0) return { ok: false, why: 'Нет действий' };
    if (entry.usesLeft <= 0) return { ok: false, why: 'Использовано' };
    if ((entry.def.costE || 0) > f.eng) return { ok: false, why: 'Не хватает энергии' };
    if ((key === 'charge' || key === 'hook') && dist(b) < 2) return { ok: false, why: 'Слишком близко' };
    return { ok: true };
  }

  // Клетки, куда можно дойти
  function moveTargets(b) {
    const f = me(b), o = en(b);
    const out = [];
    const maxStep = Math.max(f.walk, f.jump);
    if (b.actions <= 0 || maxStep <= 0) return out;
    for (let t = f.pos - maxStep; t <= f.pos + maxStep; t++) {
      if (t < 0 || t >= D.BATTLE.TILES || t === f.pos || t === o.pos) continue;
      // без прыжка нельзя пройти сквозь врага
      const crosses = (f.pos < o.pos && t > o.pos) || (f.pos > o.pos && t < o.pos);
      if (crosses && f.jump <= 0) continue;
      out.push(t);
    }
    return out;
  }

  // ---------- Действия ----------
  function spendAction(b) { b.actions--; }

  function doMove(b, tile) {
    const events = [];
    if (!moveTargets(b).includes(tile)) return events;
    const f = me(b);
    const jumped = (f.pos < en(b).pos && tile > en(b).pos) || (f.pos > en(b).pos && tile < en(b).pos) || f.jump > 0;
    events.push({ type: 'move', who: f.side, from: f.pos, to: tile, jump: f.jump > 0 });
    log(b, `${f.name} перемещается на клетку ${tile + 1}`);
    f.pos = tile;
    spendAction(b);
    return events;
  }

  function doWeapon(b, slotKey) {
    const events = [];
    const f = me(b);
    const entry = f.items[slotKey];
    if (!entry) return events;
    const chk = canUseWeapon(b, entry);
    if (!chk.ok) return events;
    f.eng -= entry.def.costE || 0;
    f.heat += entry.def.costH || 0;
    if (entry.usesLeft !== Infinity) entry.usesLeft--;
    f.firedThisTurn[slotKey] = true;
    spendAction(b);
    applyHit(b, f, en(b), entry, events, 'fire');
    return events;
  }

  function doStomp(b) {
    const events = [];
    const chk = canStomp(b);
    if (!chk.ok) return events;
    const f = me(b);
    const legs = f.items.legs;
    f.firedThisTurn.legs = true;
    spendAction(b);
    applyHit(b, f, en(b), legs, events, 'stomp');
    return events;
  }

  function doTele(b, tile) {
    const events = [];
    const chk = canSpecial(b, 'tele');
    if (!chk.ok) return events;
    const f = me(b), o = en(b);
    if (tile < 0 || tile >= D.BATTLE.TILES || tile === o.pos || tile === f.pos) return events;
    const entry = f.items.tele;
    f.eng -= entry.def.costE || 0;
    f.heat += entry.def.costH || 0;
    entry.usesLeft--;
    spendAction(b);
    events.push({ type: 'tele', who: f.side, from: f.pos, to: tile });
    log(b, `${f.name} телепортируется на клетку ${tile + 1}`);
    f.pos = tile;
    if (Math.abs(f.pos - o.pos) === 1) applyHit(b, f, o, entry, events, 'teleHit');
    return events;
  }

  function doCharge(b) {
    const events = [];
    const chk = canSpecial(b, 'charge');
    if (!chk.ok) return events;
    const f = me(b), o = en(b);
    const entry = f.items.charge;
    f.eng -= entry.def.costE || 0;
    f.heat += entry.def.costH || 0;
    entry.usesLeft--;
    spendAction(b);
    const dir = o.pos > f.pos ? 1 : -1;
    const to = o.pos - dir;
    events.push({ type: 'charge', who: f.side, from: f.pos, to });
    log(b, `${f.name} делает рывок!`);
    f.pos = to;
    applyHit(b, f, o, entry, events, 'chargeHit');
    return events;
  }

  function doHook(b) {
    const events = [];
    const chk = canSpecial(b, 'hook');
    if (!chk.ok) return events;
    const f = me(b), o = en(b);
    const entry = f.items.hook;
    f.eng -= entry.def.costE || 0;
    f.heat += entry.def.costH || 0;
    entry.usesLeft--;
    spendAction(b);
    events.push({ type: 'hook', who: f.side, targetFrom: o.pos });
    log(b, `${f.name} притягивает врага крюком!`);
    applyHit(b, f, o, entry, events, 'hookHit');
    return events;
  }

  // ---------- Завершение хода ----------
  function endTurn(b) {
    const events = [];
    if (b.over) return events;
    const f = me(b), o = en(b);
    // Дрон стреляет автоматически в конце хода владельца
    const drone = f.items.drone;
    if (drone && drone.usesLeft > 0 && (drone.def.costE || 0) <= f.eng) {
      const d = dist(b);
      if (d >= drone.def.range[0] && d <= drone.def.range[1]) {
        f.eng -= drone.def.costE || 0;
        f.heat += drone.def.costH || 0;
        applyHit(b, f, o, drone, events, 'drone');
      }
    }
    if (b.over) return events;
    // Cooldown-фаза владельца хода
    const engGain = Math.min(f.reg, f.maxEng - f.eng);
    const heatLoss = Math.min(f.heat, f.cool);
    f.eng += engGain;
    f.heat -= heatLoss;
    events.push({ type: 'cooldown', who: f.side, engGain, heatLoss });
    // Передача хода
    b.turn = 1 - b.turn;
    b.round += b.turn === 0 ? 1 : 0;
    const nf = me(b);
    nf.firedThisTurn = {};
    b.actions = D.BATTLE.ACTIONS;
    // Перегрев: превышение heatCap → ход тратится на вентиляцию (shutdown-loop при слабом cooling)
    if (nf.heat > nf.heatCap) {
      const vent = Math.min(nf.heat, Math.max(nf.cool * 2, Math.round(nf.heatCap * 0.35)));
      nf.heat -= vent;
      b.actions = 0;
      nf.overheated = true;
      events.push({ type: 'overheat', who: nf.side, vent });
      log(b, `${nf.name} ПЕРЕГРЕТ! Пропуск хода (−${vent} тепла)`);
    } else {
      nf.overheated = false;
    }
    events.push({ type: 'turn', who: b.turn, round: b.round, skipped: nf.overheated });
    return events;
  }

  // ---------- Сводка доступных действий (для UI) ----------
  function availableActions(b) {
    const f = me(b);
    const out = { weapons: {}, stomp: canStomp(b), moves: moveTargets(b), specials: {} };
    f.weapons.forEach(w => { out.weapons[w.slotKey] = canUseWeapon(b, w); });
    ['tele', 'charge', 'hook'].forEach(k => { if (f.items[k]) out.specials[k] = canSpecial(b, k); });
    return out;
  }

  /* ============================================================
     ИИ противника
     ============================================================ */
  function expectedDamage(src, tgt, entry) {
    const st = entry.stats, def = entry.def;
    let v = 0;
    if (st.dmg) {
      const avg = (st.dmg[0] + st.dmg[1]) / 2 * src.dmgMult;
      const resKey = def.elem === 'HEAT' ? 'expRes' : (def.elem === 'ENER' ? 'eleRes' : 'phyRes');
      v += Math.max(1, avg - Math.max(0, tgt[resKey]));
    }
    if (st.engDmg) {
      const brk = Math.max(0, st.engDmg - tgt.eng);
      v += brk + Math.min(tgt.eng, st.engDmg) * 0.35; // ценность дренажа
    }
    if (st.heatDmg) {
      // нагрев ценнее, когда враг близок к перегреву
      const overFrac = clamp((tgt.heat + st.heatDmg) / Math.max(1, tgt.heatCap), 0, 1.4);
      v += st.heatDmg * (0.25 + 0.45 * overFrac);
    }
    v += (st.resDmg || 0) * 2 + (st.coolDmg || 0) * 1.5 + (st.regDmg || 0) * 1.5 +
         (st.maxEngDmg || 0) * 0.8 + (st.maxHeatDmg || 0) * 0.8;
    return v;
  }

  function heatPenalty(f, costH) {
    const after = f.heat + (costH || 0);
    if (after <= f.heatCap) return 0;
    return (after - f.heatCap) * 1.6 + 60; // не хотим перегреваться
  }

  function bestWeaponAt(b, f, o, d) {
    let best = null, bestV = 0;
    f.weapons.forEach(w => {
      if (w.usesLeft <= 0 || f.firedThisTurn[w.slotKey]) return;
      if (d < w.def.range[0] || d > w.def.range[1]) return;
      if ((w.def.costE || 0) > f.eng) return;
      const v = expectedDamage(f, o, w) - heatPenalty(f, w.def.costH);
      if (v > bestV) { bestV = v; best = w; }
    });
    return { entry: best, value: bestV };
  }

  // Выбор одного действия ИИ. Возвращает {action, arg} или null (= закончить ход)
  function aiChooseAction(b) {
    const f = me(b), o = en(b);
    if (b.actions <= 0) return null;
    const d = dist(b);
    const candidates = [];

    // 1) стрелять сейчас
    const nowShot = bestWeaponAt(b, f, o, d);
    if (nowShot.entry) {
      let v = nowShot.value;
      const st = nowShot.entry.stats;
      if (st.dmg && st.dmg[1] * f.dmgMult >= o.hp) v += 900; // добивание
      candidates.push({ v, action: 'weapon', arg: nowShot.entry.slotKey });
    }
    // 2) стомп
    if (canStomp(b).ok) {
      const legs = f.items.legs;
      candidates.push({ v: expectedDamage(f, o, legs), action: 'stomp' });
    }
    // 3) движение — ценим позицию, откуда можно стрелять (в этот же ход, если останутся действия)
    const moves = moveTargets(b);
    moves.forEach(t => {
      const nd = Math.abs(t - o.pos);
      const shot = bestWeaponAt(b, f, o, nd);
      let v = 0;
      if (shot.entry) v = shot.value * (b.actions >= 2 ? 0.92 : 0.55);
      // лёгкий бонус за уход из чужой оптимальной дальности (range bullying)
      const foeShot = bestWeaponAt(b, o, f, nd);
      const foeNow = bestWeaponAt(b, o, f, d);
      v += Math.max(0, (foeNow.entry ? foeNow.value : 0) - (foeShot.entry ? foeShot.value : 0)) * 0.35;
      if (v > 0) candidates.push({ v, action: 'move', arg: t });
    });
    // 4) чардж / крюк / телепорт — чтобы попасть в дальность
    if (canSpecial(b, 'charge').ok) {
      const entry = f.items.charge;
      const nd = 1;
      const after = bestWeaponAt(b, f, o, nd);
      const v = expectedDamage(f, o, entry) + (b.actions >= 2 && after.entry ? after.value * 0.8 : 0)
        - heatPenalty(f, entry.def.costH);
      candidates.push({ v, action: 'charge' });
    }
    if (canSpecial(b, 'hook').ok) {
      const entry = f.items.hook;
      const nd = 1;
      const after = bestWeaponAt(b, f, o, nd);
      const v = expectedDamage(f, o, entry) + (b.actions >= 2 && after.entry ? after.value * 0.8 : 0)
        - heatPenalty(f, entry.def.costH);
      candidates.push({ v, action: 'hook' });
    }
    if (canSpecial(b, 'tele').ok) {
      const entry = f.items.tele;
      // лучший тайл телепорта
      let bestTile = -1, bestV = 0;
      for (let t = 0; t < D.BATTLE.TILES; t++) {
        if (t === f.pos || t === o.pos) continue;
        const nd = Math.abs(t - o.pos);
        const shot = bestWeaponAt(b, f, o, nd);
        let v = (shot.entry && b.actions >= 2 ? shot.value * 0.8 : 0);
        if (nd === 1) v += expectedDamage(f, o, entry);
        if (v > bestV) { bestV = v; bestTile = t; }
      }
      if (bestTile >= 0 && bestV > 40) candidates.push({ v: bestV, action: 'tele', arg: bestTile });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b2) => b2.v - a.v);
    const top = candidates[0];
    if (top.v <= 5) return null; // ничего осмысленного
    return top;
  }

  function aiExecute(b, choice) {
    switch (choice.action) {
      case 'weapon': return doWeapon(b, choice.arg);
      case 'stomp': return doStomp(b);
      case 'move': return doMove(b, choice.arg);
      case 'charge': return doCharge(b);
      case 'hook': return doHook(b);
      case 'tele': return doTele(b, choice.arg);
    }
    return [];
  }

  SM.battle = {
    fighterFromMech, fighterFromFoe, fighterFromItems,
    start, me, en, dist,
    availableActions, moveTargets, canUseWeapon, canStomp, canSpecial,
    doMove, doWeapon, doStomp, doTele, doCharge, doHook, endTurn,
    aiChooseAction, aiExecute,
    WEAPON_SLOTS,
  };
})();
