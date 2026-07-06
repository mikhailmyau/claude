/* ============================================================
   SUPER MECHS — ядро: состояние игрока, инвентарь, статы меха,
   экономика, ящики, прокачка и трансформация предметов.
   ============================================================ */
(function () {
  'use strict';
  const D = SM.DATA;

  const SAVE_KEY = 'supermechs_save_v1';
  let uidCounter = 1;

  // ---------- Утилиты ----------
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Экземпляр предмета ----------
  function makeItem(id, tier, lvl) {
    const def = D.ITEMS_BY_ID[id];
    if (!def) throw new Error('Unknown item: ' + id);
    tier = tier || def.tierMin;
    if (D.tierIdx(tier) < D.tierIdx(def.tierMin)) tier = def.tierMin;
    return {
      uid: 'i' + (uidCounter++),
      id, tier,
      lvl: clamp(lvl || 1, 1, D.TIER_INFO[tier].cap),
      power: 0, // накопленный power к следующему уровню
    };
  }

  function itemDef(inst) { return D.ITEMS_BY_ID[inst.id]; }

  // Вычисленные статы предмета с учётом тира/уровня
  function itemStats(inst) {
    const def = itemDef(inst);
    const f = D.statFrac(inst.tier, inst.lvl);
    const out = {};
    for (const k in def.stats) out[k] = Math.round(def.stats[k] * f);
    if (def.dmg) out.dmg = [Math.round(def.dmg[0] * f), Math.round(def.dmg[1] * f)];
    return out;
  }

  function itemIsMaxLvl(inst) { return inst.lvl >= D.TIER_INFO[inst.tier].cap; }
  function itemCanTransform(inst) {
    const def = itemDef(inst);
    if (inst.tier === 'D') return false;
    if (!itemIsMaxLvl(inst)) return false;
    if (inst.tier === 'M') return true; // → Divine через реликвии
    return true;
  }

  // ---------- Состояние игрока ----------
  function defaultState() {
    return {
      name: 'Пилот',
      gold: 20000, tokens: 120, arenaCoins: 0, relics: 0,
      xp: 0, level: 1,
      paint: '#3b7bd4',
      inventory: [],           // экземпляры предметов
      mechs: [null, null, null].map(() => emptyMechSetup()),
      activeMech: 0,
      arena: { rank: 25, stars: 0, wins: 0, losses: 0, winsToday: 0, day: dayStamp(), shop: {} },
      campaign: {},            // 'ch1:0:normal' -> clears count
      dailies: freshDailies(),
      stats: { battles: 0, boxesOpened: 0 },
      sound: true,
      seenIntro: false,
    };
  }

  function emptyMechSetup() {
    const s = {};
    D.SLOTS.forEach(sl => { s[sl.key] = null; }); // uid предмета или null
    return s;
  }

  function dayStamp() { return new Date().toISOString().slice(0, 10); }
  function freshDailies() {
    return {
      day: dayStamp(),
      quests: [
        { id: 'win_arena', text: 'Победить в Арене', need: 1, have: 0, done: false },
        { id: 'win3', text: 'Выиграть 3 боя', need: 3, have: 0, done: false },
        { id: 'openbox', text: 'Открыть ящик', need: 1, have: 0, done: false },
      ],
      claimed: false,
    };
  }

  let state = null;

  // ---------- Сохранение ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, _uid: uidCounter })); }
    catch (e) { console.warn('save failed', e); }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      uidCounter = s._uid || 1;
      delete s._uid;
      // миграции / дневной сброс
      const def = defaultState();
      for (const k in def) if (!(k in s)) s[k] = def[k];
      if (s.dailies.day !== dayStamp()) s.dailies = freshDailies();
      if (s.arena.day !== dayStamp()) { s.arena.day = dayStamp(); s.arena.winsToday = 0; }
      return s;
    } catch (e) { console.warn('load failed', e); return null; }
  }
  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
    state = newGameState();
    save();
  }

  // ---------- Старт новой игры ----------
  function newGameState() {
    const s = defaultState();
    state = s;
    // стартовый набор: рабочий мех + запас
    const starters = [
      ['torso_avenger', 'C', 1], ['legs_ironboots', 'C', 1],
      ['side_backstabber', 'C', 1], ['side_emberpistol', 'C', 1],
      ['top_longshot', 'C', 1], ['drone_gnat', 'C', 1],
      ['tele_basic', 'C', 1], ['charge_basic', 'C', 1], ['hook_basic', 'C', 1],
      ['mod_ironplating', 'C', 1], ['mod_heatengine', 'C', 1], ['mod_energyengine', 'C', 1],
      ['kit_common', 'C', 1], ['kit_common', 'C', 1],
    ];
    starters.forEach(([id, t, l]) => s.inventory.push(makeItem(id, t, l)));
    // авто-экипировка первого меха
    const m = s.mechs[0];
    const eq = (slot, idx) => { m[slot] = s.inventory[idx].uid; };
    eq('torso', 0); eq('legs', 1); eq('side1', 2); eq('side2', 3);
    eq('top1', 4); eq('drone', 5); eq('tele', 6); eq('charge', 7); eq('hook', 8);
    eq('mod1', 9); eq('mod2', 10); eq('mod3', 11);
    return s;
  }

  function init() {
    state = load() || newGameState();
    save();
    return state;
  }

  // ---------- Инвентарь ----------
  function invGet(uid) { return state.inventory.find(i => i.uid === uid) || null; }
  function invRemove(uid) {
    const idx = state.inventory.findIndex(i => i.uid === uid);
    if (idx >= 0) state.inventory.splice(idx, 1);
    // снять со всех мехов
    state.mechs.forEach(m => { for (const k in m) if (m[k] === uid) m[k] = null; });
  }
  function isEquipped(uid) {
    return state.mechs.some(m => Object.values(m).includes(uid));
  }

  function equip(mechIdx, slotKey, uid) {
    const m = state.mechs[mechIdx];
    const slot = D.SLOTS.find(s => s.key === slotKey);
    if (!slot) return false;
    if (uid === null) { m[slotKey] = null; save(); return true; }
    const inst = invGet(uid);
    if (!inst) return false;
    const def = itemDef(inst);
    if (def.kind !== slot.kind) return false;
    // предмет нельзя надеть в 2 слота одного меха; с другого меха — можно снять
    for (const k in m) if (m[k] === uid) m[k] = null;
    m[slotKey] = uid;
    save();
    return true;
  }

  // ---------- Статы собранного меха ----------
  function mechStats(mechIdx) {
    const m = state.mechs[mechIdx];
    const out = {
      hp: 0, eng: 0, reg: 0, heat: 0, cool: 0,
      phyRes: 0, expRes: 0, eleRes: 0,
      weight: 0, walk: 1, jump: 0,
      valid: false, overweight: 0, hpPenalty: 0, usable: true,
      items: {},
    };
    let hasWeapon = false;
    D.SLOTS.forEach(sl => {
      const uid = m[sl.key];
      if (!uid) return;
      const inst = invGet(uid);
      if (!inst) { m[sl.key] = null; return; }
      const def = itemDef(inst);
      const st = itemStats(inst);
      out.items[sl.key] = inst;
      out.weight += def.w;
      ['hp', 'eng', 'reg', 'heat', 'cool', 'phyRes', 'expRes', 'eleRes'].forEach(k => {
        if (st[k]) out[k] += st[k];
      });
      if (st.allRes) { out.phyRes += st.allRes; out.expRes += st.allRes; out.eleRes += st.allRes; }
      if (def.kind === 'legs' && def.move) { out.walk = def.move.walk; out.jump = def.move.jump; }
      if (def.kind === 'side' || def.kind === 'top') hasWeapon = true;
    });
    out.valid = !!(m.torso && m.legs && hasWeapon);
    if (out.weight > D.BATTLE.WEIGHT_LIMIT) {
      out.overweight = out.weight - D.BATTLE.WEIGHT_LIMIT;
      out.hpPenalty = out.overweight * D.BATTLE.OVERWEIGHT_HP;
      out.hp = Math.max(1, out.hp - out.hpPenalty);
      if (out.weight > D.BATTLE.WEIGHT_MAX) out.usable = false;
    }
    // бусты арены
    const sh = state.arena.shop || {};
    const b = k => 1 + 0.02 * (sh[k] || 0);
    out.hp = Math.round(out.hp * b('hp'));
    out.eng = Math.round(out.eng * b('eng'));
    out.reg = Math.round(out.reg * b('reg'));
    out.heat = Math.round(out.heat * b('heat'));
    out.cool = Math.round(out.cool * b('cool'));
    out.dmgMult = 1 + 0.02 * (sh.dmg || 0);
    return out;
  }

  // ---------- Прокачка (fuse/boost) ----------
  // Сколько power нужно предмету до макс. уровня текущего тира
  function powerToMax(inst) {
    let total = -inst.power;
    for (let l = inst.lvl; l < D.TIER_INFO[inst.tier].cap; l++) total += D.powerForLevel(inst.tier, l);
    return Math.max(0, total);
  }

  // Скормить предметы/киты. foodUids — массив uid. Возвращает {gained, gold} или null
  function fuse(targetUid, foodUids) {
    const target = invGet(targetUid);
    if (!target || itemIsMaxLvl(target)) return null;
    const tdef = itemDef(target);
    let gained = 0;
    const foods = [];
    for (const fu of foodUids) {
      if (fu === targetUid) return null;
      const f = invGet(fu);
      if (!f || isEquipped(fu)) return null;
      foods.push(f);
    }
    for (const f of foods) {
      const fdef = itemDef(f);
      if (fdef.kind === 'kit') gained += fdef.power;
      else gained += D.foodPower(f.tier, f.lvl, fdef.kind === tdef.kind, fdef.elem === tdef.elem);
    }
    const gold = D.fuseGold(gained);
    if (state.gold < gold) return { gained, gold, tooExpensive: true };
    state.gold -= gold;
    foods.forEach(f => invRemove(f.uid));
    // применить power
    target.power += gained;
    const cap = D.TIER_INFO[target.tier].cap;
    while (target.lvl < cap) {
      const need = D.powerForLevel(target.tier, target.lvl);
      if (target.power >= need) { target.power -= need; target.lvl++; }
      else break;
    }
    if (target.lvl >= cap) target.power = 0;
    save();
    return { gained, gold };
  }

  // ---------- Трансформация ----------
  function transformInfo(inst) {
    const def = itemDef(inst);
    if (!itemCanTransform(inst)) return null;
    if (inst.tier === 'M') {
      const base = def.tierMin;
      return {
        toTier: 'D', relics: D.TRANSFORM.M.relics[base] || 5,
        gold: D.TRANSFORM.M.gold[base] || 1000000, items: 0,
      };
    }
    const t = D.TRANSFORM[inst.tier];
    const toTier = D.TIERS[D.tierIdx(inst.tier) + 1];
    return { toTier, items: t.items, itemTier: inst.tier, gold: t.gold, relics: 0 };
  }

  // Кандидаты в «жертвы» для трансформации (тот же тир, не экипированы, не сам предмет)
  function transformFodder(inst) {
    return state.inventory.filter(i =>
      i.uid !== inst.uid && i.tier === inst.tier &&
      itemDef(i).kind !== 'kit' && !isEquipped(i.uid));
  }

  function transform(targetUid, fodderUids) {
    const target = invGet(targetUid);
    if (!target) return { ok: false, msg: 'Предмет не найден' };
    const info = transformInfo(target);
    if (!info) return { ok: false, msg: 'Предмет должен быть на макс. уровне' };
    if (state.gold < info.gold) return { ok: false, msg: 'Не хватает золота' };
    if (info.relics) {
      if (state.relics < info.relics) return { ok: false, msg: 'Не хватает Ascension Relics' };
      state.relics -= info.relics;
    } else {
      if (!fodderUids || fodderUids.length !== info.items) return { ok: false, msg: `Нужно предметов: ${info.items}` };
      for (const fu of fodderUids) {
        const f = invGet(fu);
        if (!f || f.tier !== target.tier || f.uid === targetUid || isEquipped(fu))
          return { ok: false, msg: 'Неверная жертва для трансформации' };
      }
      fodderUids.forEach(fu => invRemove(fu));
    }
    state.gold -= info.gold;
    target.tier = info.toTier;
    target.lvl = 1;
    target.power = 0;
    if (target.tier === 'D') target.lvl = 1;
    save();
    return { ok: true, msg: `Трансформация: теперь ${D.TIER_INFO[target.tier].name}!` };
  }

  // ---------- Ящики ----------
  function rollTier(pool) {
    let total = 0;
    for (const k in pool) total += pool[k];
    let r = Math.random() * total;
    for (const k in pool) { r -= pool[k]; if (r <= 0) return k; }
    return Object.keys(pool)[0];
  }

  function rollItem(boxKey) {
    const box = D.BOXES[boxKey];
    const tier = rollTier(box.pool);
    // предметы, которые могут существовать в этом тире
    let candidates = D.ITEMS.filter(it => {
      if (it.kind === 'kit') return false;
      const minI = D.tierIdx(it.tierMin);
      const tI = D.tierIdx(tier);
      if (tI < minI) return false;
      if (!box.premium && D.tierIdx(it.tierMin) >= D.tierIdx('L')) return false; // премиум L-M только из премиум-ящиков
      return true;
    });
    if (!candidates.length) candidates = D.ITEMS.filter(i => i.kind !== 'kit');
    const def = pick(candidates);
    const lvl = 1;
    return makeItem(def.id, tier, lvl);
  }

  function openBox(boxKey) {
    const box = D.BOXES[boxKey];
    if (!box) return null;
    if (box.cost.gold && state.gold < box.cost.gold) return { err: 'Не хватает золота' };
    if (box.cost.tokens && state.tokens < box.cost.tokens) return { err: 'Не хватает токенов' };
    if (box.cost.gold) state.gold -= box.cost.gold;
    if (box.cost.tokens) state.tokens -= box.cost.tokens;
    const items = [];
    for (let i = 0; i < box.rolls; i++) {
      // шанс power kit вместо предмета в дешёвых ящиках
      if (!box.premium && Math.random() < 0.18) {
        const kit = Math.random() < 0.7 ? 'kit_common' : 'kit_rare';
        items.push(makeItem(kit));
      } else items.push(rollItem(boxKey));
    }
    items.forEach(it => state.inventory.push(it));
    state.stats.boxesOpened++;
    questProgress('openbox');
    save();
    return { items };
  }

  // Бесплатный ящик за победу в кампании (реже — за арену)
  function freeBoxDrop(chance, poolKey) {
    if (Math.random() < chance) {
      const it = rollItem(poolKey || 'mix');
      state.inventory.push(it);
      return it;
    }
    return null;
  }

  // ---------- XP / уровень ----------
  function xpForLevel(n) { return Math.round(50 * n * n); } // до следующего
  function addXp(amount) {
    state.xp += amount;
    const gains = [];
    while (state.level < 250 && state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level++;
      const tok = 5 + Math.floor(state.level / 25) * 5;
      state.tokens += tok;
      gains.push({ level: state.level, tokens: tok });
    }
    return gains;
  }

  // ---------- Дейлики ----------
  function questProgress(id, n) {
    const q = state.dailies.quests.find(q => q.id === id);
    if (!q || q.done) return;
    q.have = Math.min(q.need, q.have + (n || 1));
    if (q.have >= q.need) q.done = true;
  }
  function dailiesComplete() { return state.dailies.quests.every(q => q.done); }
  function claimDailies() {
    if (!dailiesComplete() || state.dailies.claimed) return false;
    state.dailies.claimed = true;
    state.tokens += 10;
    save();
    return true;
  }

  // ---------- Арена: прогресс рангов ----------
  function arenaWin() {
    const a = state.arena;
    a.wins++; a.winsToday++;
    let coins = 0;
    if (a.winsToday <= 5) { coins = 10 + Math.round((25 - a.rank) * 1.5); a.arenaCoinsGain = coins; state.arenaCoins += coins; }
    a.stars++;
    let rankUp = null;
    if (a.stars >= D.ARENA.starsForRank(a.rank) && a.rank > 1) {
      a.rank--; a.stars = 0;
      const reward = { gold: 3000 + (25 - a.rank) * 900, tokens: a.rank <= 10 ? 15 : 5, relics: a.rank <= 8 ? 1 : 0 };
      state.gold += reward.gold; state.tokens += reward.tokens; state.relics += reward.relics;
      rankUp = { rank: a.rank, ...reward };
    }
    questProgress('win_arena');
    questProgress('win3');
    save();
    return { coins, rankUp };
  }
  function arenaLoss() {
    const a = state.arena;
    a.losses++;
    if (a.stars > 0) a.stars--;
    else if (a.rank < 25 && Math.random() < 0.5) a.rank++; // мягкий дерейтинг
    save();
  }

  function buyArenaBoost(key) {
    const def = D.ARENA_SHOP.find(s => s.key === key);
    const cur = state.arena.shop[key] || 0;
    if (!def || cur >= def.max) return false;
    const cost = def.base + cur * def.base;
    if (state.arenaCoins < cost) return false;
    state.arenaCoins -= cost;
    state.arena.shop[key] = cur + 1;
    save();
    return true;
  }

  // ---------- Кампания: прогресс ----------
  function missionKey(ch, mi, diff) { return `${ch}:${mi}:${diff}`; }
  function missionClears(ch, mi, diff) { return state.campaign[missionKey(ch, mi, diff)] || 0; }
  function missionUnlocked(chIdx, mi, diff) {
    const ch = D.CAMPAIGN[chIdx];
    if (diff === 'hard' && !missionClears(ch.id, D.CAMPAIGN[chIdx].missions.length - 1, 'normal')) return false;
    if (diff === 'insane' && !missionClears(ch.id, D.CAMPAIGN[chIdx].missions.length - 1, 'hard')) return false;
    if (mi === 0) {
      if (chIdx === 0) return true;
      // глава открывается после босса предыдущей на той же сложности
      const prev = D.CAMPAIGN[chIdx - 1];
      return missionClears(prev.id, prev.missions.length - 1, diff) > 0;
    }
    return missionClears(ch.id, mi - 1, diff) > 0;
  }

  function campaignReward(chIdx, mi, diff) {
    const dd = D.DIFFICULTY[diff];
    const m = D.CAMPAIGN[chIdx].missions[mi];
    const base = 400 + chIdx * 1200 + mi * 260;
    const gold = Math.round(base * dd.rewardMult * (m.boss ? 2.4 : 1));
    const xp = Math.round((110 + chIdx * 260 + mi * 55) * dd.rewardMult * (m.boss ? 2 : 1));
    return { gold, xp };
  }

  function completeMission(chIdx, mi, diff) {
    const ch = D.CAMPAIGN[chIdx];
    const key = missionKey(ch.id, mi, diff);
    const first = !state.campaign[key];
    state.campaign[key] = (state.campaign[key] || 0) + 1;
    const reward = campaignReward(chIdx, mi, diff);
    state.gold += reward.gold;
    const levelUps = addXp(reward.xp);
    let tokens = 0;
    if (first) { tokens = 5; state.tokens += 5; } // первое прохождение = 5 Tokens
    // Insane-боссы: реликвии за первое прохождение
    let relics = 0;
    if (first && diff === 'insane' && ch.missions[mi].boss) { relics = 2; state.relics += 2; }
    const drop = freeBoxDrop(ch.missions[mi].boss ? 0.65 : 0.3, 'mix');
    questProgress('win3');
    state.stats.battles++;
    save();
    return { ...reward, tokens, relics, drop, first, levelUps };
  }

  // ---------- Генерация вражеских мехов ----------
  // power 0..1 — сила противника (тир и уровень предметов)
  function tierLvlForPower(p) {
    // 0 → common lvl1; 1 → mythical 50
    const scale = [
      { t: 'C', lo: 1, hi: 10, upto: 0.14 },
      { t: 'R', lo: 1, hi: 20, upto: 0.32 },
      { t: 'E', lo: 1, hi: 30, upto: 0.58 },
      { t: 'L', lo: 1, hi: 40, upto: 0.82 },
      { t: 'M', lo: 1, hi: 50, upto: 1.01 },
    ];
    let prev = 0;
    for (const s of scale) {
      if (p <= s.upto) {
        const f = (p - prev) / (s.upto - prev);
        return { tier: s.t, lvl: Math.max(1, Math.round(s.lo + f * (s.hi - s.lo))) };
      }
      prev = s.upto;
    }
    return { tier: 'M', lvl: 50 };
  }

  const FOE_TEMPLATES = {
    buggy: { // слабая колёсная машинка
      torso: 'torso_avenger', legs: 'legs_rolling',
      weapons: { side1: 'side_backstabber' }, drone: null,
      mods: ['mod_ironplating'], statMult: 0.55, visual: 'buggy',
    },
    tank: {
      torso: 'torso_avenger', legs: 'legs_rolling',
      weapons: { side1: 'side_backstabber', top1: 'top_longshot' },
      drone: null, mods: ['mod_ironplating', 'mod_ironplating'], statMult: 0.8, visual: 'tank',
    },
    mech_phys: {
      torso: 'torso_windigo', legs: 'legs_ironboots',
      weapons: { side1: 'side_nightfall', side2: 'side_annihilation', top1: 'top_nighteagle' },
      drone: 'drone_clash', mods: ['mod_ironplating', 'mod_titanplating', 'mod_heatengine', 'mod_energyengine'],
      statMult: 1, visual: 'mech',
    },
    mech_heat: {
      torso: 'torso_zarkares', legs: 'legs_devastation',
      weapons: { side1: 'side_corrupt', side2: 'side_sorrow', top1: 'top_heatpoint' },
      drone: 'drone_void', mods: ['mod_titanplating', 'mod_heatengine', 'mod_coolbooster', 'mod_storage'],
      statMult: 1, visual: 'mech',
    },
    mech_ener: {
      torso: 'torso_nightmare', legs: 'legs_lightning',
      weapons: { side1: 'side_malice', side2: 'side_boltdisruptor', top1: 'top_ultrabright' },
      drone: 'drone_nemo', mods: ['mod_titanplating', 'mod_energyengine', 'mod_energybooster', 'mod_storage'],
      statMult: 1, visual: 'mech',
    },
    boss_phys: {
      torso: 'torso_hollow', legs: 'legs_ironboots',
      weapons: { side1: 'side_spartan', side2: 'side_nightfall', top1: 'top_falcon' },
      drone: 'drone_greedy', mods: ['mod_platplating', 'mod_titanplating', 'mod_heatengine', 'mod_energyengine', 'mod_defmatrix'],
      statMult: 1.25, visual: 'boss',
    },
    boss_heat: {
      torso: 'torso_sabretooth', legs: 'legs_devastation',
      weapons: { side1: 'side_desolation', side2: 'side_vandal', top1: 'top_crimson' },
      drone: 'drone_torment', mods: ['mod_platplating', 'mod_coolbooster', 'mod_heatengine', 'mod_storage', 'mod_defmatrix'],
      statMult: 1.3, visual: 'boss',
    },
  };

  // Собрать «виртуальный мех» врага для боя
  function buildFoe(templateKey, power, name, extraMult) {
    const t = FOE_TEMPLATES[templateKey];
    const { tier, lvl } = tierLvlForPower(clamp(power, 0, 1));
    const items = {};
    const mk = (id) => {
      if (!id) return null;
      const def = D.ITEMS_BY_ID[id];
      let useTier = tier, useLvl = lvl;
      if (D.tierIdx(def.tierMin) > D.tierIdx(tier)) { useTier = def.tierMin; useLvl = 1; }
      return makeItem(id, useTier, useLvl);
    };
    items.torso = mk(t.torso);
    items.legs = mk(t.legs);
    for (const k in t.weapons) items[k] = mk(t.weapons[k]);
    if (t.drone) items.drone = mk(t.drone);
    (t.mods || []).forEach((mid, i) => { items['mod' + (i + 1)] = mk(mid); });
    if (power > 0.45) { items.tele = mk('tele_basic'); items.charge = mk('charge_basic'); items.hook = mk('hook_basic'); }
    const mult = (t.statMult || 1) * (extraMult || 1);
    return { name: name || templateKey.toUpperCase(), items, statMult: mult, visual: t.visual, paint: t.visual === 'boss' ? '#1a1a22' : null };
  }

  // Арена: билд противника по рангу
  function buildArenaFoe() {
    const rank = state.arena.rank;
    const p = clamp((25 - rank) / 24, 0, 1);
    const tmpl = pick(['mech_phys', 'mech_heat', 'mech_ener']);
    const names = ['CRUSHER-9', 'VOLT KING', 'PYRO LORD', 'IRON WIDOW', 'NULL VECTOR', 'DUST REAPER', 'OMEGA FIST', 'CINDER WOLF'];
    const power = clamp(p + (Math.random() * 0.08 - 0.04), 0.02, 1);
    return buildFoe(tmpl, power, pick(names), 0.9 + p * 0.25);
  }

  // Рейд: 6 тиров
  function buildRaidFoe(tierNum) { // 1..6
    const p = clamp(0.12 + tierNum * 0.15, 0, 1);
    const tmpl = tierNum >= 5 ? 'boss_heat' : (tierNum >= 3 ? 'boss_phys' : 'mech_phys');
    return buildFoe(tmpl, p, 'RAID BOSS T' + tierNum, 0.9 + tierNum * 0.12);
  }

  SM.core = {
    init, save, resetSave,
    get state() { return state; },
    makeItem, itemDef, itemStats, itemIsMaxLvl, itemCanTransform,
    invGet, invRemove, isEquipped, equip,
    mechStats, powerToMax, fuse,
    transformInfo, transformFodder, transform,
    openBox, xpForLevel, addXp,
    questProgress, dailiesComplete, claimDailies,
    arenaWin, arenaLoss, buyArenaBoost,
    missionUnlocked, missionClears, completeMission, campaignReward,
    buildFoe, buildArenaFoe, buildRaidFoe,
    rnd, pick, clamp,
  };
})();
