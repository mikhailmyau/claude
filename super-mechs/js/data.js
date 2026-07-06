/* ============================================================
   SUPER MECHS —  база данных предметов, тиры, скейлинг, кампания
   Все статы указаны для maxed Mythical (уровень 50), как в ТЗ.
   Реальные значения вычисляются из тира и уровня предмета.
   ============================================================ */
window.SM = window.SM || {};

(function () {
  'use strict';

  // ---------- Тиры (редкости) ----------
  const TIERS = ['C', 'R', 'E', 'L', 'M', 'D'];
  const TIER_INFO = {
    C: { name: 'Common',    color: '#9aa4ad', cap: 10 },
    R: { name: 'Rare',      color: '#4da6ff', cap: 20 },
    E: { name: 'Epic',      color: '#b36bff', cap: 30 },
    L: { name: 'Legendary', color: '#ffcc33', cap: 40 },
    M: { name: 'Mythical',  color: '#ff8c1a', cap: 50 },
    D: { name: 'Divine',    color: '#f4f7ff', cap: 1  },
  };
  // Доля от maxed-Mythical стата: [на 1 уровне, на макс. уровне тира]
  const TIER_FRAC = {
    C: [0.20, 0.32],
    R: [0.32, 0.46],
    E: [0.46, 0.64],
    L: [0.64, 0.82],
    M: [0.82, 1.00],
    D: [1.05, 1.05], // Divine = Mythical max +5%
  };

  function tierIdx(t) { return TIERS.indexOf(t); }

  function statFrac(tier, lvl) {
    const cap = TIER_INFO[tier].cap;
    const [a, b] = TIER_FRAC[tier];
    if (cap <= 1) return b;
    const t = (Math.min(lvl, cap) - 1) / (cap - 1);
    return a + (b - a) * t;
  }

  // Статы, которые масштабируются уровнем/тиром
  const SCALED_STATS = ['hp', 'eng', 'reg', 'heat', 'cool',
    'phyRes', 'expRes', 'eleRes', 'allRes',
    'engDmg', 'heatDmg', 'maxEngDmg', 'maxHeatDmg', 'regDmg', 'coolDmg', 'resDmg'];

  // ---------- Прокачка (boost / fuse) ----------
  // Требование power на следующий уровень
  const LVL_BASE = { C: 60, R: 160, E: 500, L: 1400, M: 3400 };
  function powerForLevel(tier, lvl) { // power чтобы перейти с lvl на lvl+1
    return Math.round(LVL_BASE[tier] * (1 + 0.15 * (lvl - 1)));
  }
  // Сколько power даёт предмет-«еда»
  const FOOD_BASE = { C: 150, R: 700, E: 3500, L: 15000, M: 50000, D: 90000 };
  function foodPower(tier, lvl, sameKind, sameElem) {
    let p = FOOD_BASE[tier] * (1 + 0.06 * (lvl - 1));
    if (sameKind) p *= sameElem ? 1.20 : 1.10; // бонусы как в ТЗ
    return Math.round(p);
  }
  // Золото за использованный power (калибровка под цифры ТЗ: C≈720g, M≈500k)
  function fuseGold(power) { return Math.max(5, Math.round(power * 0.65 / 5) * 5); }

  // ---------- Трансформация ----------
  // { itemsNeeded (тир = текущий тир предмета), gold }
  const TRANSFORM = {
    C: { items: 2, gold: 25000 },
    R: { items: 3, gold: 25000 },
    E: { items: 4, gold: 50000 },
    L: { items: 5, gold: 100000 },
    // M→D: Ascension Relics, зависит от БАЗОВОГО тира предмета
    M: {
      relics: { C: 2, R: 3, E: 4, L: 5, M: 5 },
      gold:   { C: 100000, R: 200000, E: 500000, L: 1000000, M: 1000000 },
    },
  };

  // ---------- Элементы ----------
  const ELEM = {
    PHYS: { name: 'Физический',   color: '#ffd23f', icon: '⚙' },
    HEAT: { name: 'Тепловой',     color: '#ff5c33', icon: '🔥' },
    ENER: { name: 'Энергетический', color: '#33bbff', icon: '⚡' },
  };

  /* ============================================================
     ПРЕДМЕТЫ. kind: torso|legs|side|top|drone|tele|charge|hook|module|kit
     stats — значения на maxed Mythical.
     Оружие: dmg:[min,max] (тип по element), range:[min,max],
     uses (0 = безлимит), costE/costH — цена выстрела,
     push/pull/recoil/advance, backfire, reqJump.
     tierMin — базовая редкость (C / R / E / L / M).
     ============================================================ */
  const ITEMS = [
    // ================= TORSOS =================
    { id: 'torso_avenger', name: 'AVENGER', kind: 'torso', elem: 'PHYS', w: 347, tierMin: 'C',
      stats: { hp: 1152, eng: 181, reg: 57, heat: 319, cool: 86, phyRes: 24, expRes: 18, eleRes: 18 } },
    { id: 'torso_interceptor', name: 'INTERCEPTOR', kind: 'torso', elem: 'ENER', w: 320, tierMin: 'R',
      stats: { hp: 950, eng: 260, reg: 93, heat: 250, cool: 85, phyRes: 18, expRes: 18, eleRes: 26 } },
    { id: 'torso_zarkares', name: 'ZARKARES', kind: 'torso', elem: 'HEAT', w: 362, tierMin: 'E',
      stats: { hp: 1136, eng: 193, reg: 64, heat: 312, cool: 112, phyRes: 16, expRes: 24, eleRes: 16 } },
    { id: 'torso_brutality', name: 'BRUTALITY', kind: 'torso', elem: 'PHYS', w: 341, tierMin: 'E',
      stats: { hp: 1033, eng: 217, reg: 64, heat: 290, cool: 88, phyRes: 22, expRes: 16, eleRes: 22 } },
    { id: 'torso_nightmare', name: 'NIGHTMARE', kind: 'torso', elem: 'ENER', w: 315, tierMin: 'E',
      stats: { hp: 879, eng: 193, reg: 64, heat: 290, cool: 96, phyRes: 22, expRes: 16, eleRes: 22 } },
    { id: 'torso_windigo', name: 'WINDIGO', kind: 'torso', elem: 'PHYS', w: 345, tierMin: 'E',
      stats: { hp: 1167, eng: 217, reg: 72, heat: 301, cool: 112, phyRes: 30, expRes: 16, eleRes: 22 } },
    { id: 'torso_efa', name: 'ENERGY FREE ARMOR', kind: 'torso', elem: 'PHYS', w: 335, tierMin: 'L',
      stats: { hp: 1343, eng: 25, reg: 8, heat: 223, cool: 80, phyRes: 24, expRes: 24, eleRes: 24 } },
    { id: 'torso_hollow', name: 'HOLLOW ARMOR', kind: 'torso', elem: 'PHYS', w: 370, tierMin: 'L',
      stats: { hp: 1589, eng: 241, reg: 80, heat: 241, cool: 80, phyRes: 14, expRes: 14, eleRes: 14 } },
    { id: 'torso_sabretooth', name: 'SABRETOOTH', kind: 'torso', elem: 'HEAT', w: 358, tierMin: 'M',
      stats: { hp: 1520, eng: 205, reg: 70, heat: 330, cool: 120, phyRes: 20, expRes: 20, eleRes: 20 } },
    { id: 'torso_molten', name: 'MOLTEN PLATINUM VEST', kind: 'torso', elem: 'HEAT', w: 375, tierMin: 'L',
      stats: { hp: 1524, eng: 199, reg: 64, heat: 337, cool: 125, phyRes: 17, expRes: 23, eleRes: 17 } },

    // ================= LEGS =================
    { id: 'legs_ironboots', name: 'IRON BOOTS', kind: 'legs', elem: 'PHYS', w: 138, tierMin: 'C',
      move: { walk: 2, jump: 2 }, dmg: [163, 213], range: [1, 1], push: 1, uses: 0, costE: 0, costH: 0,
      stats: { hp: 478 } },
    { id: 'legs_rolling', name: 'ROLLING BEASTS', kind: 'legs', elem: 'PHYS', w: 134, tierMin: 'C',
      move: { walk: 3, jump: 0 }, dmg: [160, 242], range: [1, 1], push: 1, uses: 0, costE: 0, costH: 0,
      stats: { hp: 451 } },
    { id: 'legs_sparked', name: 'SPARKED RUNNERS', kind: 'legs', elem: 'ENER', w: 133, tierMin: 'R',
      move: { walk: 3, jump: 0 }, dmg: [150, 226], range: [1, 1], push: 1, engDmgFlag: true, uses: 0, costE: 0, costH: 0,
      stats: { hp: 430, engDmg: 30 } },
    { id: 'legs_devastation', name: 'DEVASTATION SWARM', kind: 'legs', elem: 'HEAT', w: 140, tierMin: 'E',
      move: { walk: 2, jump: 2 }, dmg: [150, 230], range: [1, 1], push: 1, uses: 0, costE: 0, costH: 0,
      stats: { hp: 460, heatDmg: 40 } },
    { id: 'legs_lightning', name: 'LIGHTNING SUPPORTERS', kind: 'legs', elem: 'ENER', w: 140, tierMin: 'E',
      move: { walk: 2, jump: 2 }, dmg: [150, 230], range: [1, 1], push: 1, uses: 0, costE: 0, costH: 0,
      stats: { hp: 460, engDmg: 40 } },
    { id: 'legs_claw', name: 'THE CLAW', kind: 'legs', elem: 'PHYS', w: 150, tierMin: 'L',
      move: { walk: 1, jump: 0 }, dmg: [79, 111], range: [1, 1], push: 0, uses: 0, costE: 0, costH: 0,
      stats: { hp: 860 } },

    // ================= SIDE WEAPONS =================
    { id: 'side_backstabber', name: 'BACKSTABBER', kind: 'side', elem: 'PHYS', w: 48, tierMin: 'C',
      dmg: [190, 270], range: [2, 4], uses: 3, costE: 0, costH: 10, stats: {} },
    { id: 'side_boltdisruptor', name: 'BOLT DISRUPTOR', kind: 'side', elem: 'ENER', w: 50, tierMin: 'C',
      dmg: [130, 215], range: [3, 6], uses: 0, costE: 40, costH: 0, stats: { engDmg: 60 } },
    { id: 'side_emberpistol', name: 'EMBER PISTOL', kind: 'side', elem: 'HEAT', w: 46, tierMin: 'C',
      dmg: [125, 205], range: [3, 6], uses: 0, costE: 0, costH: 38, stats: { heatDmg: 55 } },
    { id: 'side_nightfall', name: 'NIGHTFALL', kind: 'side', elem: 'PHYS', w: 49, tierMin: 'E',
      dmg: [237, 355], range: [2, 4], uses: 3, costE: 31, costH: 31, stats: { resDmg: 11 } },
    { id: 'side_annihilation', name: 'ANNIHILATION', kind: 'side', elem: 'PHYS', w: 65, tierMin: 'E',
      dmg: [203, 341], range: [1, 2], uses: 3, costE: 0, costH: 0, stats: { resDmg: 15 } },
    { id: 'side_warhammer', name: 'WAR HAMMER', kind: 'side', elem: 'PHYS', w: 58, tierMin: 'E',
      dmg: [254, 427], range: [1, 1], uses: 2, costE: 31, costH: 31, push: 3, stats: { maxHeatDmg: 24 } },
    { id: 'side_bloodweep', name: 'BLOODWEEP', kind: 'side', elem: 'PHYS', w: 51, tierMin: 'L',
      dmg: [208, 288], range: [3, 6], uses: 2, costE: 25, costH: 25, stats: { resDmg: 8 } },
    { id: 'side_spartan', name: 'SPARTAN CARNAGE', kind: 'side', elem: 'PHYS', w: 76, tierMin: 'L',
      dmg: [224, 336], range: [1, 2], uses: 3, costE: 0, costH: 0, stats: { resDmg: 20 } },
    { id: 'side_malice', name: 'MALICE BEAM', kind: 'side', elem: 'ENER', w: 55, tierMin: 'E',
      dmg: [140, 236], range: [3, 6], uses: 0, costE: 47, costH: 16, stats: { engDmg: 123, maxEngDmg: 24 } },
    { id: 'side_emp', name: 'EMP', kind: 'side', elem: 'ENER', w: 70, tierMin: 'L',
      dmg: [37, 61], range: [2, 4], uses: 1, costE: 393, costH: 0, stats: { engDmg: 334 } },
    { id: 'side_lastwords', name: 'LAST WORDS', kind: 'side', elem: 'ENER', w: 60, tierMin: 'L',
      dmg: [190, 280], range: [1, 3], uses: 2, costE: 60, costH: 0, stats: { engDmg: 80 } },
    { id: 'side_corrupt', name: 'CORRUPT LIGHT', kind: 'side', elem: 'HEAT', w: 51, tierMin: 'E',
      dmg: [140, 236], range: [3, 6], uses: 0, costE: 16, costH: 47, stats: { heatDmg: 93, maxHeatDmg: 24 } },
    { id: 'side_heatbomb', name: 'HEAT BOMB', kind: 'side', elem: 'HEAT', w: 50, tierMin: 'L',
      dmg: [40, 59], range: [2, 4], uses: 1, costE: 0, costH: 393, stats: { heatDmg: 393 } },
    { id: 'side_sorrow', name: 'SORROW', kind: 'side', elem: 'HEAT', w: 60, tierMin: 'L',
      dmg: [168, 262], range: [2, 4], uses: 2, costE: 0, costH: 62, stats: { heatDmg: 76, coolDmg: 12 } },
    { id: 'side_desolation', name: 'DESOLATION', kind: 'side', elem: 'HEAT', w: 68, tierMin: 'L',
      dmg: [165, 330], range: [2, 4], uses: 2, costE: 0, costH: 80, stats: { heatDmg: 60 } },
    { id: 'side_vandal', name: 'VANDAL RAGE', kind: 'side', elem: 'HEAT', w: 62, tierMin: 'E',
      dmg: [118, 186], range: [4, 8], uses: 2, costE: 0, costH: 50, stats: { heatDmg: 132, coolDmg: 13 } },

    // ================= TOP WEAPONS =================
    { id: 'top_solartorch', name: 'SOLAR TORCH', kind: 'top', elem: 'HEAT', w: 45, tierMin: 'C',
      dmg: [130, 210], range: [3, 5], uses: 3, costE: 0, costH: 45, stats: { heatDmg: 60 } },
    { id: 'top_stormweaver', name: 'STORM WEAVER', kind: 'top', elem: 'ENER', w: 44, tierMin: 'C',
      dmg: [122, 200], range: [3, 5], uses: 3, costE: 48, costH: 0, stats: { engDmg: 55 } },
    { id: 'top_longshot', name: 'LONG SHOT', kind: 'top', elem: 'PHYS', w: 46, tierMin: 'C',
      dmg: [140, 225], range: [3, 6], uses: 3, costE: 0, costH: 12, stats: {} },
    { id: 'top_nighteagle', name: 'NIGHT EAGLE', kind: 'top', elem: 'PHYS', w: 47, tierMin: 'R',
      dmg: [152, 244], range: [3, 6], uses: 3, costE: 0, costH: 12, stats: { resDmg: 8 } },
    { id: 'top_heatpoint', name: 'HEAT POINT', kind: 'top', elem: 'HEAT', w: 40, tierMin: 'R',
      dmg: [66, 102], range: [3, 6], uses: 3, costE: 0, costH: 40, stats: { heatDmg: 120 } },
    { id: 'top_rockrecoiler', name: 'ROCK RECOILER', kind: 'top', elem: 'PHYS', w: 66, tierMin: 'E',
      dmg: [211, 322], range: [2, 4], uses: 3, costE: 0, costH: 31, recoil: 1, stats: {} },
    { id: 'top_supreme', name: 'SUPREME CANNON', kind: 'top', elem: 'HEAT', w: 68, tierMin: 'E',
      dmg: [179, 269], range: [4, 8], uses: 2, costE: 0, costH: 66, stats: { heatDmg: 87 } },
    { id: 'top_ultrabright', name: 'ULTRABRIGHT', kind: 'top', elem: 'ENER', w: 55, tierMin: 'E',
      dmg: [146, 224], range: [4, 8], uses: 3, costE: 72, costH: 0, stats: { engDmg: 78 } },
    { id: 'top_falcon', name: 'FALCON', kind: 'top', elem: 'PHYS', w: 63, tierMin: 'L',
      dmg: [178, 292], range: [3, 6], uses: 3, costE: 0, costH: 15, stats: { resDmg: 14 } },
    { id: 'top_crimson', name: 'CRIMSON RAPTURE', kind: 'top', elem: 'HEAT', w: 61, tierMin: 'L',
      dmg: [143, 244], range: [2, 4], uses: 2, costE: 0, costH: 93, stats: { heatDmg: 154, coolDmg: 17 } },
    { id: 'top_valiant', name: 'VALIANT SNIPER', kind: 'top', elem: 'ENER', w: 60, tierMin: 'L',
      dmg: [194, 262], range: [5, 8], uses: 2, costE: 100, costH: 0, stats: { engDmg: 114, maxEngDmg: 26 } },

    // ================= DRONES =================
    { id: 'drone_snack', name: 'SNACK', kind: 'drone', elem: 'HEAT', w: 22, tierMin: 'C',
      dmg: [75, 120], range: [1, 8], uses: 0, costE: 0, costH: 18, stats: { heatDmg: 25 } },
    { id: 'drone_spark', name: 'SPARK', kind: 'drone', elem: 'ENER', w: 22, tierMin: 'C',
      dmg: [72, 118], range: [1, 8], uses: 0, costE: 22, costH: 0, stats: { engDmg: 26 } },
    { id: 'drone_gnat', name: 'GNAT', kind: 'drone', elem: 'PHYS', w: 20, tierMin: 'C',
      dmg: [80, 128], range: [1, 8], uses: 0, costE: 6, costH: 6, stats: {} },
    { id: 'drone_clash', name: 'CLASH', kind: 'drone', elem: 'PHYS', w: 25, tierMin: 'E',
      dmg: [106, 172], range: [1, 8], uses: 0, costE: 12, costH: 6, stats: { resDmg: 5 } },
    { id: 'drone_void', name: 'VOID', kind: 'drone', elem: 'HEAT', w: 30, tierMin: 'E',
      dmg: [105, 166], range: [1, 8], uses: 0, costE: 0, costH: 24, stats: { heatDmg: 31, coolDmg: 6 } },
    { id: 'drone_nemo', name: 'NEMO', kind: 'drone', elem: 'ENER', w: 27, tierMin: 'E',
      dmg: [96, 160], range: [1, 8], uses: 0, costE: 30, costH: 0, stats: { engDmg: 44 } },
    { id: 'drone_torment', name: 'TORMENT', kind: 'drone', elem: 'HEAT', w: 33, tierMin: 'L',
      dmg: [108, 170], range: [1, 8], uses: 0, costE: 0, costH: 31, stats: { heatDmg: 58, coolDmg: 6 } },
    { id: 'drone_whiteout', name: 'WHITEOUT', kind: 'drone', elem: 'ENER', w: 33, tierMin: 'L',
      dmg: [102, 164], range: [1, 8], uses: 0, costE: 34, costH: 0, stats: { engDmg: 62, regDmg: 6 } },
    { id: 'drone_greedy', name: 'GREEDY', kind: 'drone', elem: 'PHYS', w: 32, tierMin: 'L',
      dmg: [121, 201], range: [1, 8], uses: 0, costE: 10, costH: 10, stats: { resDmg: 8 } },

    // ================= SPECIALS =================
    { id: 'tele_basic', name: 'TELEPORTER', kind: 'tele', elem: 'PHYS', w: 10, tierMin: 'C',
      dmg: [60, 90], range: [0, 9], uses: 1, costE: 25, costH: 0, stats: {} },
    { id: 'tele_advanced', name: 'ADVANCED TELEPORTER', kind: 'tele', elem: 'ENER', w: 11, tierMin: 'E',
      dmg: [103, 135], range: [0, 9], uses: 1, costE: 31, costH: 0, stats: { engDmg: 48 } },
    { id: 'charge_basic', name: 'CHARGE ENGINE', kind: 'charge', elem: 'PHYS', w: 20, tierMin: 'C',
      dmg: [132, 174], range: [0, 9], uses: 1, costE: 20, costH: 20, push: 1, stats: {} },
    { id: 'charge_goliath', name: 'GOLIATH CHARGE', kind: 'charge', elem: 'PHYS', w: 24, tierMin: 'L',
      dmg: [150, 210], range: [0, 9], uses: 2, costE: 25, costH: 25, push: 1, stats: {} },
    { id: 'hook_basic', name: 'GRAPPLING HOOK', kind: 'hook', elem: 'PHYS', w: 12, tierMin: 'C',
      dmg: [90, 130], range: [0, 9], uses: 1, costE: 0, costH: 25, pull: 99, stats: {} },
    { id: 'hook_platinum', name: 'PLATINUM GRAPPLING HOOK', kind: 'hook', elem: 'PHYS', w: 17, tierMin: 'L',
      dmg: [143, 187], range: [0, 9], uses: 1, costE: 0, costH: 31, pull: 99, stats: {} },

    // ================= MODULES =================
    { id: 'mod_ironplating', name: 'IRON PLATING', kind: 'module', elem: null, w: 40, tierMin: 'C',
      stats: { hp: 145 } },
    { id: 'mod_titanplating', name: 'TITAN PLATING', kind: 'module', elem: null, w: 47, tierMin: 'E',
      stats: { hp: 235 } },
    { id: 'mod_platplating', name: 'PLATINUM PLATING', kind: 'module', elem: null, w: 40, tierMin: 'L',
      stats: { hp: 315 } },
    { id: 'mod_energyengine', name: 'ENERGY ENGINE', kind: 'module', elem: 'ENER', w: 35, tierMin: 'C',
      stats: { eng: 90, reg: 30 } },
    { id: 'mod_heatengine', name: 'HEAT ENGINE', kind: 'module', elem: 'HEAT', w: 35, tierMin: 'C',
      stats: { heat: 90, cool: 30 } },
    { id: 'mod_energybooster', name: 'ENERGY MASS BOOSTER', kind: 'module', elem: 'ENER', w: 40, tierMin: 'E',
      stats: { eng: 76, reg: 44 } },
    { id: 'mod_coolbooster', name: 'COOLING MASS BOOSTER', kind: 'module', elem: 'HEAT', w: 40, tierMin: 'E',
      stats: { heat: 76, cool: 44 } },
    { id: 'mod_storage', name: 'COMBINED STORAGE UNIT', kind: 'module', elem: null, w: 40, tierMin: 'E',
      stats: { eng: 121, heat: 112 } },
    { id: 'mod_quadcore', name: 'QUAD CORE BOOSTER', kind: 'module', elem: null, w: 40, tierMin: 'L',
      stats: { eng: 97, reg: 46, heat: 89, cool: 46 } },
    { id: 'mod_phyprot', name: 'MAXIMUM PROTECTOR', kind: 'module', elem: 'PHYS', w: 25, tierMin: 'E',
      stats: { phyRes: 52 } },
    { id: 'mod_expprot', name: 'HEAT PROTECTOR', kind: 'module', elem: 'HEAT', w: 25, tierMin: 'E',
      stats: { expRes: 52 } },
    { id: 'mod_eleprot', name: 'ENERGY PROTECTOR', kind: 'module', elem: 'ENER', w: 25, tierMin: 'E',
      stats: { eleRes: 52 } },
    { id: 'mod_defmatrix', name: 'DEFENSE MATRIX', kind: 'module', elem: null, w: 60, tierMin: 'L',
      stats: { hp: 170, allRes: 39 } },

    // ================= POWER KITS =================
    { id: 'kit_common', name: 'COMMON POWER KIT', kind: 'kit', elem: null, w: 0, tierMin: 'C', power: 1200, stats: {} },
    { id: 'kit_rare', name: 'RARE POWER KIT', kind: 'kit', elem: null, w: 0, tierMin: 'R', power: 6000, stats: {} },
    { id: 'kit_epic', name: 'EPIC POWER KIT', kind: 'kit', elem: null, w: 0, tierMin: 'E', power: 30000, stats: {} },
  ];

  const ITEMS_BY_ID = {};
  ITEMS.forEach(it => { ITEMS_BY_ID[it.id] = it; });

  // ---------- Слоты меха ----------
  const SLOTS = [
    { key: 'torso',  kind: 'torso',  label: 'Корпус' },
    { key: 'legs',   kind: 'legs',   label: 'Ноги' },
    { key: 'top1',   kind: 'top',    label: 'Верхнее 1' },
    { key: 'top2',   kind: 'top',    label: 'Верхнее 2' },
    { key: 'side1',  kind: 'side',   label: 'Боковое 1' },
    { key: 'side2',  kind: 'side',   label: 'Боковое 2' },
    { key: 'side3',  kind: 'side',   label: 'Боковое 3' },
    { key: 'side4',  kind: 'side',   label: 'Боковое 4' },
    { key: 'drone',  kind: 'drone',  label: 'Дрон' },
    { key: 'tele',   kind: 'tele',   label: 'Телепорт' },
    { key: 'charge', kind: 'charge', label: 'Чардж' },
    { key: 'hook',   kind: 'hook',   label: 'Крюк' },
    { key: 'mod1', kind: 'module', label: 'Модуль 1' },
    { key: 'mod2', kind: 'module', label: 'Модуль 2' },
    { key: 'mod3', kind: 'module', label: 'Модуль 3' },
    { key: 'mod4', kind: 'module', label: 'Модуль 4' },
    { key: 'mod5', kind: 'module', label: 'Модуль 5' },
    { key: 'mod6', kind: 'module', label: 'Модуль 6' },
    { key: 'mod7', kind: 'module', label: 'Модуль 7' },
    { key: 'mod8', kind: 'module', label: 'Модуль 8' },
  ];

  const KIND_LABEL = {
    torso: 'Корпус', legs: 'Ноги', side: 'Боковое оружие', top: 'Верхнее оружие',
    drone: 'Дрон', tele: 'Телепорт', charge: 'Чардж', hook: 'Крюк',
    module: 'Модуль', kit: 'Power Kit',
  };

  // ---------- Правила боя ----------
  const BATTLE = {
    TILES: 10,          // линейное поле из 10 позиций (0..9)
    ACTIONS: 2,         // 2 действия за ход
    WEIGHT_LIMIT: 1000, // базовый лимит
    WEIGHT_MAX: 1010,   // абсолютный максимум
    OVERWEIGHT_HP: 15,  // −15 HP за 1 кг перегруза
  };

  // ---------- Кампания ----------
  // Шаблоны врагов: сборки из базы предметов, масштабируются tier/lvl
  const CAMPAIGN = [
    {
      id: 'ch1', name: 'Глава 1: Пустоши', missions: [
        { name: 'Разведка боем',   foe: 'buggy',  boss: false },
        { name: 'Колёса смерти',   foe: 'buggy',  boss: false },
        { name: 'Стальной патруль', foe: 'tank',  boss: false },
        { name: 'Засада на песке', foe: 'mech_phys', boss: false },
        { name: 'Горячая точка',   foe: 'mech_heat', boss: false },
        { name: 'Короткое замыкание', foe: 'mech_ener', boss: false },
        { name: 'Танковый прорыв', foe: 'tank',   boss: false },
        { name: 'БОСС: Ржавый Голем', foe: 'boss_phys', boss: true },
      ],
    },
    {
      id: 'ch2', name: 'Глава 2: Логово Оверлорда', missions: [
        { name: 'Врата крепости',  foe: 'mech_phys', boss: false },
        { name: 'Огненный ров',    foe: 'mech_heat', boss: false },
        { name: 'Энергосети',      foe: 'mech_ener', boss: false },
        { name: 'Элитная стража',  foe: 'mech_phys', boss: false },
        { name: 'Раскалённый цех', foe: 'mech_heat', boss: false },
        { name: 'Реакторный зал',  foe: 'mech_ener', boss: false },
        { name: 'Тронный коридор', foe: 'tank',   boss: false },
        { name: 'БОСС: Оверлорд',  foe: 'boss_heat', boss: true },
      ],
    },
  ];

  const DIFFICULTY = {
    normal: { name: 'Normal', color: '#4caf50', mult: 1.00, rewardMult: 1.0 },
    hard:   { name: 'Hard',   color: '#ff9800', mult: 1.35, rewardMult: 1.8 },
    insane: { name: 'Insane', color: '#f44336', mult: 1.75, rewardMult: 3.0 },
  };

  // ---------- Арена ----------
  const ARENA = {
    MAX_RANK: 25, // 25 → 1
    starsForRank(rank) { return rank > 15 ? 3 : (rank > 5 ? 4 : 5); },
  };

  // Магазин арены: перманентные бусты (Arena Coins)
  const ARENA_SHOP = [
    { key: 'hp',   name: 'Броня (+2% HP)',        max: 10, base: 40 },
    { key: 'dmg',  name: 'Урон (+2%)',            max: 10, base: 50 },
    { key: 'eng',  name: 'Энергия (+2%)',         max: 10, base: 30 },
    { key: 'reg',  name: 'Регенерация (+2%)',     max: 10, base: 30 },
    { key: 'heat', name: 'Теплоёмкость (+2%)',    max: 10, base: 30 },
    { key: 'cool', name: 'Охлаждение (+2%)',      max: 10, base: 30 },
  ];

  // ---------- Ящики (лутбоксы) ----------
  const BOXES = {
    mix:     { name: 'Mix Box',        cost: { gold: 2500 },  rolls: 1, pool: { C: 62, R: 28, E: 9, L: 1 } },
    silver:  { name: 'Silver Box',     cost: { gold: 7500 },  rolls: 2, pool: { C: 45, R: 35, E: 16, L: 3.7, M: 0.3 } },
    premium: { name: 'Premium Box',    cost: { tokens: 75 },  rolls: 1, pool: { E: 68, L: 27, M: 5 }, premium: true },
    pack:    { name: 'Premium Pack',   cost: { tokens: 335 }, rolls: 5, pool: { E: 62, L: 31, M: 7 }, premium: true },
  };

  SM.DATA = {
    TIERS, TIER_INFO, TIER_FRAC, tierIdx, statFrac, SCALED_STATS,
    powerForLevel, foodPower, fuseGold, TRANSFORM,
    ELEM, ITEMS, ITEMS_BY_ID, SLOTS, KIND_LABEL,
    BATTLE, CAMPAIGN, DIFFICULTY, ARENA, ARENA_SHOP, BOXES,
  };
})();
