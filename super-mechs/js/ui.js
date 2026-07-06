/* ============================================================
   SUPER MECHS — интерфейс: мастерская, инвентарь, кампания,
   арена, рейд, магазин, экран боя, модалки.
   ============================================================ */
(function () {
  'use strict';
  const D = SM.DATA;
  const C = SM.core;
  const B = SM.battle;
  const R = SM.render;

  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const fmt = n => n.toLocaleString('ru-RU');

  const KIND_ICON = {
    torso: '🛡️', legs: '🦿', side: '🔫', top: '🚀', drone: '🛸',
    tele: '🌀', charge: '💨', hook: '🪝', module: '🔩', kit: '⚡',
  };
  const PAINTS = ['#3b7bd4', '#c23b3b', '#3bb54a', '#c9a13b', '#8a4bc9', '#3bbcc9', '#c95b9e', '#7a828f', '#2e343d', '#e0e4ea'];

  let screen = 'workshop';
  let wsSelectedSlot = null; // выбранный слот в мастерской
  let invFilter = 'all';

  /* ==================== ШАПКА ==================== */
  function renderHeader() {
    const s = C.state;
    $('#hdr-gold').textContent = fmt(s.gold);
    $('#hdr-tokens').textContent = fmt(s.tokens);
    $('#hdr-coins').textContent = fmt(s.arenaCoins);
    $('#hdr-relics').textContent = fmt(s.relics);
    $('#hdr-level').textContent = s.level;
    const need = C.xpForLevel(s.level);
    $('#hdr-xpbar-fill').style.width = Math.min(100, s.xp / need * 100) + '%';
    $('#hdr-xpbar').title = `XP: ${fmt(s.xp)} / ${fmt(need)}`;
    $('#hdr-name').textContent = s.name;
    $('#btn-sound').textContent = s.sound ? '🔊' : '🔇';
    const dq = s.dailies;
    const doneN = dq.quests.filter(q => q.done).length;
    $('#btn-dailies').textContent = `📋 ${doneN}/${dq.quests.length}`;
    $('#btn-dailies').classList.toggle('glow', C.dailiesComplete() && !dq.claimed);
  }

  /* ==================== НАВИГАЦИЯ ==================== */
  function show(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach(e => e.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
    if (name === 'workshop') renderWorkshop();
    if (name === 'campaign') renderCampaign();
    if (name === 'arena') renderArena();
    if (name === 'raid') renderRaid();
    if (name === 'shop') renderShop();
    renderHeader();
  }

  /* ==================== ПРЕДМЕТЫ: карточки ==================== */
  function statLine(inst) {
    const st = C.itemStats(inst);
    const def = C.itemDef(inst);
    const parts = [];
    if (def.kind === 'kit') return `+${fmt(def.power)} power`;
    if (st.dmg) parts.push(`⚔ ${st.dmg[0]}–${st.dmg[1]}`);
    if (st.hp) parts.push(`❤ ${st.hp}`);
    if (st.eng) parts.push(`⚡ ${st.eng}`);
    if (st.reg) parts.push(`↻ ${st.reg}`);
    if (st.heat) parts.push(`🔥 ${st.heat}`);
    if (st.cool) parts.push(`❄ ${st.cool}`);
    if (st.engDmg) parts.push(`⚡− ${st.engDmg}`);
    if (st.heatDmg) parts.push(`🔥+ ${st.heatDmg}`);
    if (st.allRes) parts.push(`🛡 all ${st.allRes}`);
    else {
      const r = [];
      if (st.phyRes) r.push('P' + st.phyRes);
      if (st.expRes) r.push('E' + st.expRes);
      if (st.eleRes) r.push('Э' + st.eleRes);
      if (r.length) parts.push('🛡 ' + r.join('/'));
    }
    if (def.range && def.kind !== 'legs' && def.kind !== 'torso') {
      if (['tele', 'charge', 'hook'].includes(def.kind)) { }
      else parts.push(`📏 ${def.range[0]}–${def.range[1]}`);
    }
    return parts.slice(0, 4).join('  ');
  }

  function itemCard(inst, opts) {
    opts = opts || {};
    const def = C.itemDef(inst);
    const ti = D.TIER_INFO[inst.tier];
    const card = el('div', 'item-card tier-' + inst.tier);
    card.style.borderColor = ti.color;
    const elemIcon = def.elem ? D.ELEM[def.elem].icon : '';
    const equipped = C.isEquipped(inst.uid);
    card.innerHTML = `
      <div class="ic-top">
        <span class="ic-kind">${KIND_ICON[def.kind] || ''}</span>
        <span class="ic-name">${def.name}</span>
        ${elemIcon ? `<span class="ic-elem">${elemIcon}</span>` : ''}
      </div>
      <div class="ic-mid">
        <span class="ic-tier" style="color:${ti.color}">${ti.name}</span>
        <span class="ic-lvl">${def.kind === 'kit' ? '' : 'ур. ' + inst.lvl + '/' + ti.cap}</span>
        ${def.w ? `<span class="ic-w">${def.w} кг</span>` : ''}
      </div>
      <div class="ic-stats">${statLine(inst)}</div>
      ${equipped && !opts.hideEquipped ? '<div class="ic-eq">ЭКИПИРОВАН</div>' : ''}
    `;
    if (opts.onClick) card.addEventListener('click', () => opts.onClick(inst));
    if (opts.selected) card.classList.add('selected');
    return card;
  }

  /* ==================== МАСТЕРСКАЯ ==================== */
  function renderWorkshop() {
    const s = C.state;
    const root = $('#screen-workshop');
    root.innerHTML = '';
    const ms = C.mechStats(s.activeMech);

    // --- левая колонка: превью + статы ---
    const left = el('div', 'ws-left');
    const tabs = el('div', 'mech-tabs');
    s.mechs.forEach((m, i) => {
      const b = el('button', 'mech-tab' + (i === s.activeMech ? ' active' : ''), 'Мех ' + (i + 1));
      b.onclick = () => { s.activeMech = i; C.save(); renderWorkshop(); };
      tabs.appendChild(b);
    });
    left.appendChild(tabs);

    const cv = el('canvas', 'mech-preview');
    cv.width = 300; cv.height = 240;
    left.appendChild(cv);

    // покраска
    const paints = el('div', 'paint-row');
    PAINTS.forEach(p => {
      const b = el('button', 'paint-dot' + (s.paint === p ? ' active' : ''));
      b.style.background = p;
      b.onclick = () => { s.paint = p; C.save(); renderWorkshop(); };
      paints.appendChild(b);
    });
    left.appendChild(paints);

    // вес
    const wFrac = Math.min(1, ms.weight / D.BATTLE.WEIGHT_MAX);
    const wColor = ms.weight > D.BATTLE.WEIGHT_MAX ? '#ff4040' : (ms.weight > D.BATTLE.WEIGHT_LIMIT ? '#ff9800' : '#52c46a');
    const wBox = el('div', 'weight-box', `
      <div class="wb-label">Вес: <b style="color:${wColor}">${ms.weight}</b> / ${D.BATTLE.WEIGHT_LIMIT} кг
        ${ms.overweight ? `<span class="ow">перегруз +${ms.overweight} кг → −${ms.hpPenalty} HP</span>` : ''}
        ${!ms.usable ? '<span class="ow bad">СЛИШКОМ ТЯЖЁЛЫЙ!</span>' : ''}
      </div>
      <div class="wb-bar"><div class="wb-fill" style="width:${wFrac * 100}%;background:${wColor}"></div></div>
    `);
    left.appendChild(wBox);

    const st = el('div', 'stat-grid', `
      <div>❤ HP</div><b>${fmt(ms.hp)}</b>
      <div>⚡ Энергия</div><b>${ms.eng} (+${ms.reg})</b>
      <div>🔥 Тепло</div><b>${ms.heat} (−${ms.cool})</b>
      <div>🛡 Резисты</div><b>${ms.phyRes}/${ms.expRes}/${ms.eleRes}</b>
      <div>👣 Ход / Прыжок</div><b>${ms.walk} / ${ms.jump}</b>
    `);
    left.appendChild(st);
    if (!ms.valid) left.appendChild(el('div', 'warn', '⚠ Нужны: корпус, ноги и хотя бы 1 оружие'));
    root.appendChild(left);

    // --- центр: слоты ---
    const mid = el('div', 'ws-slots');
    mid.appendChild(el('div', 'ws-title', 'СЛОТЫ'));
    const grid = el('div', 'slot-grid');
    D.SLOTS.forEach(sl => {
      const uid = s.mechs[s.activeMech][sl.key];
      const inst = uid ? C.invGet(uid) : null;
      const cell = el('div', 'slot-cell' + (inst ? ' filled' : '') + (wsSelectedSlot === sl.key ? ' selected' : ''));
      if (inst) {
        const ti = D.TIER_INFO[inst.tier];
        cell.style.borderColor = ti.color;
        cell.innerHTML = `<span class="sc-icon">${KIND_ICON[sl.kind]}</span>
          <span class="sc-name">${C.itemDef(inst).name}</span>
          <span class="sc-sub" style="color:${ti.color}">${inst.tier} · ур.${inst.lvl}</span>`;
      } else {
        cell.innerHTML = `<span class="sc-icon dim">${KIND_ICON[sl.kind]}</span><span class="sc-name dim">${sl.label}</span>`;
      }
      cell.onclick = () => { wsSelectedSlot = (wsSelectedSlot === sl.key ? null : sl.key); renderWorkshop(); };
      grid.appendChild(cell);
    });
    mid.appendChild(grid);
    root.appendChild(mid);

    // --- правая колонка: инвентарь ---
    const right = el('div', 'ws-right');
    const title = el('div', 'ws-title');
    if (wsSelectedSlot) {
      const sl = D.SLOTS.find(x => x.key === wsSelectedSlot);
      title.innerHTML = `ИНВЕНТАРЬ — <span class="hl">${sl.label}</span> <button class="mini-btn" id="btn-unequip">Снять</button>`;
    } else {
      title.textContent = 'ИНВЕНТАРЬ (выбери слот или предмет)';
    }
    right.appendChild(title);

    // фильтры
    const filters = el('div', 'inv-filters');
    const kinds = ['all', 'torso', 'legs', 'side', 'top', 'drone', 'tele', 'charge', 'hook', 'module', 'kit'];
    kinds.forEach(k => {
      const b = el('button', 'filter-btn' + (invFilter === k ? ' active' : ''), k === 'all' ? 'Все' : KIND_ICON[k]);
      b.title = k === 'all' ? 'Все' : D.KIND_LABEL[k];
      b.onclick = () => { invFilter = k; renderWorkshop(); };
      filters.appendChild(b);
    });
    right.appendChild(filters);

    const list = el('div', 'inv-list');
    let items = s.inventory.slice();
    if (wsSelectedSlot) {
      const sl = D.SLOTS.find(x => x.key === wsSelectedSlot);
      items = items.filter(i => C.itemDef(i).kind === sl.kind);
    } else if (invFilter !== 'all') {
      items = items.filter(i => C.itemDef(i).kind === invFilter);
    }
    items.sort((a, b) => D.tierIdx(b.tier) - D.tierIdx(a.tier) || b.lvl - a.lvl);
    items.forEach(inst => {
      list.appendChild(itemCard(inst, {
        onClick: (it) => {
          if (wsSelectedSlot) {
            const sl = D.SLOTS.find(x => x.key === wsSelectedSlot);
            if (C.itemDef(it).kind === sl.kind) {
              C.equip(s.activeMech, wsSelectedSlot, it.uid);
              renderWorkshop();
              return;
            }
          }
          openItemModal(it);
        },
      }));
    });
    if (!items.length) list.appendChild(el('div', 'empty', 'Пусто'));
    right.appendChild(list);
    root.appendChild(right);

    const unq = $('#btn-unequip');
    if (unq) unq.onclick = (e) => {
      e.stopPropagation();
      C.equip(s.activeMech, wsSelectedSlot, null);
      renderWorkshop();
    };

    // превью
    drawWorkshopPreview(cv, ms);
  }

  function drawWorkshopPreview(cv, ms) {
    const entries = {};
    for (const k in ms.items) entries[k] = { def: C.itemDef(ms.items[k]) };
    let raf;
    const loop = () => {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; }
      R.renderPreview(cv, entries, C.state.paint);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  /* ==================== МОДАЛКИ ==================== */
  function modal(contentEl, opts) {
    opts = opts || {};
    const back = el('div', 'modal-back');
    const box = el('div', 'modal-box' + (opts.wide ? ' wide' : ''));
    box.appendChild(contentEl);
    if (!opts.noClose) {
      const x = el('button', 'modal-x', '✕');
      x.onclick = () => back.remove();
      box.appendChild(x);
    }
    back.appendChild(box);
    if (!opts.noBackClose) back.addEventListener('click', e => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);
    return back;
  }

  // --- карточка предмета: инфо + прокачка + трансформация ---
  function openItemModal(inst) {
    const def = C.itemDef(inst);
    const ti = D.TIER_INFO[inst.tier];
    const st = C.itemStats(inst);
    const box = el('div');
    const statRows = [];
    const add = (label, v) => { if (v) statRows.push(`<div>${label}</div><b>${v}</b>`); };
    if (st.dmg) add('Урон (' + (def.elem ? D.ELEM[def.elem].name : '') + ')', st.dmg[0] + '–' + st.dmg[1]);
    add('HP', st.hp); add('Энергия', st.eng); add('Регенерация', st.reg);
    add('Теплоёмкость', st.heat); add('Охлаждение', st.cool);
    add('Дренаж энергии', st.engDmg); add('Нагрев', st.heatDmg);
    add('−Max энергии', st.maxEngDmg); add('−Max тепла', st.maxHeatDmg);
    add('−Регенерации', st.regDmg); add('−Охлаждения', st.coolDmg);
    add('−Резиста', st.resDmg);
    add('Физ. резист', st.phyRes); add('Взрыв. резист', st.expRes); add('Эн. резист', st.eleRes);
    add('Все резисты', st.allRes);
    if (def.range && !['torso', 'module', 'kit'].includes(def.kind)) add('Дальность', def.range[0] + '–' + def.range[1]);
    if (def.uses) add('Использований', def.uses);
    if (def.costE) add('Цена: энергия', def.costE);
    if (def.costH) add('Цена: нагрев', def.costH);
    if (def.push) add('Push', def.push);
    if (def.pull) add('Pull', '∞');
    if (def.recoil) add('Recoil', def.recoil);
    if (def.move) add('Ход / Прыжок', def.move.walk + ' / ' + def.move.jump);
    if (def.kind === 'kit') add('Power', fmt(def.power));

    const isMax = C.itemIsMaxLvl(inst);
    const tInfo = C.transformInfo(inst);
    box.innerHTML = `
      <h3 style="color:${ti.color}">${KIND_ICON[def.kind]} ${def.name}</h3>
      <div class="im-sub">${D.KIND_LABEL[def.kind]} · <span style="color:${ti.color}">${ti.name}</span>
        ${def.kind !== 'kit' ? ` · ур. ${inst.lvl}/${ti.cap}` : ''} · ${def.w} кг</div>
      <div class="stat-grid im-stats">${statRows.join('')}</div>
    `;
    const btns = el('div', 'modal-btns');
    if (def.kind !== 'kit') {
      if (!isMax) {
        const b = el('button', 'btn', '⬆ Прокачать');
        b.onclick = () => { box.closest('.modal-back').remove(); openFuseModal(inst); };
        btns.appendChild(b);
      }
      if (isMax && tInfo) {
        const b = el('button', 'btn gold', `✨ Трансформация → ${D.TIER_INFO[tInfo.toTier].name}`);
        b.onclick = () => { box.closest('.modal-back').remove(); openTransformModal(inst); };
        btns.appendChild(b);
      }
      if (inst.tier === 'D' || (isMax && !tInfo)) btns.appendChild(el('span', 'dim', 'Максимальный тир'));
    }
    if (!C.isEquipped(inst.uid)) {
      const del = el('button', 'btn danger', '🗑 Выбросить');
      del.onclick = () => {
        if (confirm('Уничтожить предмет ' + def.name + '?')) {
          C.invRemove(inst.uid); C.save();
          box.closest('.modal-back').remove();
          renderWorkshop();
        }
      };
      btns.appendChild(del);
    }
    box.appendChild(btns);
    modal(box, { wide: true });
  }

  // --- прокачка (fuse) ---
  function openFuseModal(target) {
    const s = C.state;
    const selected = new Set();
    const box = el('div');
    const back = modal(box, { wide: true });

    function redraw() {
      const def = C.itemDef(target);
      const ti = D.TIER_INFO[target.tier];
      const need = D.powerForLevel(target.tier, target.lvl);
      let gained = 0;
      selected.forEach(uid => {
        const f = C.invGet(uid); if (!f) return;
        const fdef = C.itemDef(f);
        if (fdef.kind === 'kit') gained += fdef.power;
        else gained += D.foodPower(f.tier, f.lvl, fdef.kind === def.kind, fdef.elem === def.elem);
      });
      const gold = gained ? D.fuseGold(gained) : 0;
      box.innerHTML = `
        <h3>⬆ Прокачка: <span style="color:${ti.color}">${def.name}</span></h3>
        <div class="im-sub">Уровень ${target.lvl}/${ti.cap} · накоплено ${fmt(target.power)} / ${fmt(need)} power</div>
        <div class="fuse-bar"><div style="width:${Math.min(100, (target.power + gained) / need * 100)}%"></div></div>
        <div class="im-sub">Выбрано топлива: <b>+${fmt(gained)} power</b> · Стоимость: <b class="${s.gold < gold ? 'bad' : ''}">${fmt(gold)} 💰</b>
          <span class="dim">(бонус +10% за тот же тип, +20% за тип и элемент)</span></div>
        <div class="inv-list fuse-list" id="fuse-list"></div>
      `;
      const list = box.querySelector('#fuse-list');
      const foods = s.inventory.filter(i => i.uid !== target.uid && !C.isEquipped(i.uid));
      foods.sort((a, b) => D.tierIdx(a.tier) - D.tierIdx(b.tier));
      foods.forEach(f => {
        const card = itemCard(f, {
          onClick: () => { selected.has(f.uid) ? selected.delete(f.uid) : selected.add(f.uid); redraw(); },
          selected: selected.has(f.uid),
        });
        list.appendChild(card);
      });
      if (!foods.length) list.appendChild(el('div', 'empty', 'Нет свободных предметов — открой ящики или сними предметы с мехов'));
      const btns = el('div', 'modal-btns');
      const ok = el('button', 'btn', '✔ Скормить');
      ok.disabled = !gained || s.gold < gold;
      ok.onclick = () => {
        const res = C.fuse(target.uid, [...selected]);
        if (res && !res.tooExpensive) {
          SM.sfx.coin();
          selected.clear();
          if (C.itemIsMaxLvl(target)) { back.remove(); openItemModal(target); }
          else redraw();
          renderHeader();
        }
      };
      const cancel = el('button', 'btn ghost', 'Закрыть');
      cancel.onclick = () => { back.remove(); renderWorkshop(); };
      btns.appendChild(ok); btns.appendChild(cancel);
      box.appendChild(btns);
      const x = el('button', 'modal-x', '✕');
      x.onclick = () => { back.remove(); renderWorkshop(); };
      box.appendChild(x);
    }
    redraw();
  }

  // --- трансформация ---
  function openTransformModal(target) {
    const s = C.state;
    const info = C.transformInfo(target);
    if (!info) return;
    const def = C.itemDef(target);
    const selected = new Set();
    const box = el('div');
    const back = modal(box, { wide: true });

    function redraw() {
      const toTi = D.TIER_INFO[info.toTier];
      box.innerHTML = `
        <h3>✨ Трансформация: ${def.name} → <span style="color:${toTi.color}">${toTi.name}</span></h3>
        <div class="im-sub">Стоимость: <b class="${s.gold < info.gold ? 'bad' : ''}">${fmt(info.gold)} 💰</b>
        ${info.relics ? ` + <b class="${s.relics < info.relics ? 'bad' : ''}">${info.relics} ✨ Ascension Relics (есть ${s.relics})</b>`
          : ` + <b>${info.items}</b> предмет(а) тира ${D.TIER_INFO[target.tier].name}`}</div>
      `;
      if (!info.relics) {
        box.appendChild(el('div', 'im-sub', `Выбрано жертв: ${selected.size}/${info.items}`));
        const list = el('div', 'inv-list fuse-list');
        const fodder = C.transformFodder(target);
        fodder.forEach(f => {
          list.appendChild(itemCard(f, {
            onClick: () => {
              if (selected.has(f.uid)) selected.delete(f.uid);
              else if (selected.size < info.items) selected.add(f.uid);
              redraw();
            },
            selected: selected.has(f.uid),
          }));
        });
        if (!fodder.length) list.appendChild(el('div', 'empty', 'Нет предметов того же тира для жертвы'));
        box.appendChild(list);
      }
      const btns = el('div', 'modal-btns');
      const ok = el('button', 'btn gold', '✨ Трансформировать');
      ok.disabled = s.gold < info.gold || (info.relics ? s.relics < info.relics : selected.size !== info.items);
      ok.onclick = () => {
        const res = C.transform(target.uid, [...selected]);
        if (res.ok) {
          SM.sfx.win();
          back.remove();
          renderWorkshop(); renderHeader();
          toast(res.msg);
        } else toast(res.msg, true);
      };
      const cancel = el('button', 'btn ghost', 'Отмена');
      cancel.onclick = () => back.remove();
      btns.appendChild(ok); btns.appendChild(cancel);
      box.appendChild(btns);
      const x = el('button', 'modal-x', '✕');
      x.onclick = () => back.remove();
      box.appendChild(x);
    }
    redraw();
  }

  function toast(msg, bad) {
    const t = el('div', 'toast' + (bad ? ' bad' : ''), msg);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('showing'), 10);
    setTimeout(() => { t.classList.remove('showing'); setTimeout(() => t.remove(), 400); }, 2600);
  }

  /* ==================== КАМПАНИЯ ==================== */
  let campChapter = 0, campDiff = 'normal';
  function renderCampaign() {
    const root = $('#screen-campaign');
    root.innerHTML = '';
    const head = el('div', 'camp-head');
    const chTabs = el('div', 'tab-row');
    D.CAMPAIGN.forEach((ch, i) => {
      const b = el('button', 'tab-btn' + (campChapter === i ? ' active' : ''), ch.name);
      b.onclick = () => { campChapter = i; renderCampaign(); };
      chTabs.appendChild(b);
    });
    const dfTabs = el('div', 'tab-row');
    Object.keys(D.DIFFICULTY).forEach(k => {
      const dd = D.DIFFICULTY[k];
      const b = el('button', 'tab-btn diff' + (campDiff === k ? ' active' : ''), dd.name);
      b.style.setProperty('--diff', dd.color);
      b.onclick = () => { campDiff = k; renderCampaign(); };
      dfTabs.appendChild(b);
    });
    head.appendChild(chTabs); head.appendChild(dfTabs);
    root.appendChild(head);

    const list = el('div', 'mission-list');
    const ch = D.CAMPAIGN[campChapter];
    ch.missions.forEach((m, mi) => {
      const unlocked = C.missionUnlocked(campChapter, mi, campDiff);
      const clears = C.missionClears(ch.id, mi, campDiff);
      const rew = C.campaignReward(campChapter, mi, campDiff);
      const row = el('div', 'mission-row' + (m.boss ? ' boss' : '') + (unlocked ? '' : ' locked'));
      row.innerHTML = `
        <div class="mr-num">${mi + 1}</div>
        <div class="mr-body">
          <div class="mr-name">${m.name} ${clears ? '<span class="mr-clear">✔ ×' + clears + '</span>' : ''}</div>
          <div class="mr-rew">💰 ${fmt(rew.gold)} · XP ${fmt(rew.xp)} ${!clears ? '· первый раз: +5 🔷' : ''}
            ${m.boss && campDiff === 'insane' && !clears ? '· +2 ✨' : ''}</div>
        </div>
        <button class="btn ${unlocked ? '' : 'ghost'}" ${unlocked ? '' : 'disabled'}>${unlocked ? '⚔ В БОЙ' : '🔒'}</button>
      `;
      if (unlocked) row.querySelector('button').onclick = () => startCampaignBattle(campChapter, mi, campDiff);
      list.appendChild(row);
    });
    root.appendChild(list);
  }

  function startCampaignBattle(chIdx, mi, diff) {
    const s = C.state;
    const ch = D.CAMPAIGN[chIdx];
    const m = ch.missions[mi];
    const dd = D.DIFFICULTY[diff];
    // сила врага растёт по миссиям и главам
    const base = (chIdx * 0.30) + mi * 0.038;
    const power = Math.min(1, base * dd.mult + (diff === 'insane' ? 0.12 : diff === 'hard' ? 0.05 : 0));
    const foe = C.buildFoe(m.foe, power, m.name.replace('БОСС: ', ''), dd.mult * (m.boss ? 1 : 0.92));
    launchBattle(foe, {
      title: `${ch.name} — ${m.name} [${dd.name}]`,
      onWin() {
        const res = C.completeMission(chIdx, mi, diff);
        let html = `<div class="reward-line">💰 +${fmt(res.gold)} · XP +${fmt(res.xp)}</div>`;
        if (res.tokens) html += `<div class="reward-line">🔷 +${res.tokens} (первое прохождение)</div>`;
        if (res.relics) html += `<div class="reward-line">✨ +${res.relics} Ascension Relics!</div>`;
        if (res.drop) html += `<div class="reward-line">📦 Выпал предмет: <b>${C.itemDef(res.drop).name}</b> (${D.TIER_INFO[res.drop.tier].name})</div>`;
        res.levelUps.forEach(lu => { html += `<div class="reward-line">🎉 Уровень ${lu.level}! +${lu.tokens} 🔷</div>`; });
        return html;
      },
      onLose() { return '<div class="reward-line">Поражение… Прокачай меха в Мастерской.</div>'; },
      backTo: 'campaign',
    });
  }

  /* ==================== АРЕНА ==================== */
  function renderArena() {
    const s = C.state;
    const root = $('#screen-arena');
    root.innerHTML = '';
    const a = s.arena;
    const starsNeed = D.ARENA.starsForRank(a.rank);
    const stars = '★'.repeat(a.stars) + '☆'.repeat(Math.max(0, starsNeed - a.stars));

    const box = el('div', 'arena-box');
    box.innerHTML = `
      <div class="arena-rank">
        <div class="ar-big">РАНГ ${a.rank}</div>
        <div class="ar-stars">${stars}</div>
        <div class="dim">Побед: ${a.wins} · Поражений: ${a.losses}</div>
        <div class="dim">Побед сегодня: ${a.winsToday}/5 дают 🏆 Arena Coins</div>
      </div>
      <div class="arena-actions">
        <button class="btn big" id="btn-arena-fight">⚔ НАЙТИ ПРОТИВНИКА</button>
      </div>
    `;
    root.appendChild(box);

    // магазин арены
    const shop = el('div', 'arena-shop');
    shop.appendChild(el('div', 'ws-title', `МАГАЗИН АРЕНЫ — перманентные бусты (🏆 ${fmt(s.arenaCoins)})`));
    const grid = el('div', 'ashop-grid');
    D.ARENA_SHOP.forEach(def => {
      const cur = s.arena.shop[def.key] || 0;
      const cost = def.base + cur * def.base;
      const card = el('div', 'ashop-card');
      card.innerHTML = `
        <div class="as-name">${def.name}</div>
        <div class="as-lvl">${'▮'.repeat(cur)}${'▯'.repeat(def.max - cur)} ${cur}/${def.max}</div>
        <button class="btn small" ${cur >= def.max || s.arenaCoins < cost ? 'disabled' : ''}>
          ${cur >= def.max ? 'МАКС' : cost + ' 🏆'}</button>
      `;
      card.querySelector('button').onclick = () => {
        if (C.buyArenaBoost(def.key)) { SM.sfx.coin(); renderArena(); renderHeader(); }
      };
      grid.appendChild(card);
    });
    shop.appendChild(grid);
    root.appendChild(shop);

    $('#btn-arena-fight').onclick = () => {
      const foe = C.buildArenaFoe();
      launchBattle(foe, {
        title: `АРЕНА — Ранг ${a.rank} · противник: ${foe.name}`,
        onWin() {
          const res = C.arenaWin();
          let html = '';
          if (res.coins) html += `<div class="reward-line">🏆 +${res.coins} Arena Coins</div>`;
          const gold = 800 + (25 - s.arena.rank) * 250;
          s.gold += gold;
          const lus = C.addXp(140 + (25 - s.arena.rank) * 40);
          html += `<div class="reward-line">💰 +${fmt(gold)}</div>`;
          if (res.rankUp) html += `<div class="reward-line">🎖 НОВЫЙ РАНГ ${res.rankUp.rank}! +${fmt(res.rankUp.gold)} 💰, +${res.rankUp.tokens} 🔷${res.rankUp.relics ? ', +' + res.rankUp.relics + ' ✨' : ''}</div>`;
          lus.forEach(lu => { html += `<div class="reward-line">🎉 Уровень ${lu.level}! +${lu.tokens} 🔷</div>`; });
          C.save();
          return html;
        },
        onLose() {
          C.arenaLoss();
          return '<div class="reward-line">Поражение. −1 ★</div>';
        },
        backTo: 'arena',
      });
    };
  }

  /* ==================== РЕЙД ==================== */
  function renderRaid() {
    const root = $('#screen-raid');
    root.innerHTML = '';
    root.appendChild(el('div', 'ws-title', 'РЕЙД — 6 тиров. Чем меньше урона получишь, тем больше награда.'));
    const grid = el('div', 'raid-grid');
    for (let t = 1; t <= 6; t++) {
      const card = el('div', 'raid-card');
      const gold = 2000 * t * t;
      card.innerHTML = `
        <div class="rc-tier">ТИР ${t}</div>
        <div class="rc-rew">до 💰 ${fmt(gold)} + 🔷 ${t * 3}</div>
        <button class="btn">⚔ В БОЙ</button>
      `;
      card.querySelector('button').onclick = () => {
        const foe = C.buildRaidFoe(t);
        launchBattle(foe, {
          title: `РЕЙД — Тир ${t}`,
          onWin(battle) {
            const me = battle.fighters[0];
            const frac = Math.max(0, me.hp / me.maxHp);
            const g = Math.round(gold * (0.4 + 0.6 * frac));
            const tok = Math.round(t * 3 * frac);
            C.state.gold += g; C.state.tokens += tok;
            const lus = C.addXp(300 * t);
            C.questProgress('win3'); C.save();
            let html = `<div class="reward-line">Сохранено HP: ${Math.round(frac * 100)}%</div>
              <div class="reward-line">💰 +${fmt(g)} · 🔷 +${tok}</div>`;
            lus.forEach(lu => { html += `<div class="reward-line">🎉 Уровень ${lu.level}! +${lu.tokens} 🔷</div>`; });
            return html;
          },
          onLose() { return '<div class="reward-line">Рейд-босс оказался сильнее.</div>'; },
          backTo: 'raid',
        });
      };
      grid.appendChild(card);
    }
    root.appendChild(grid);
  }

  /* ==================== МАГАЗИН ==================== */
  function renderShop() {
    const s = C.state;
    const root = $('#screen-shop');
    root.innerHTML = '';
    root.appendChild(el('div', 'ws-title', 'МАГАЗИН — ящики с предметами'));
    const grid = el('div', 'shop-grid');
    const boxMeta = {
      mix: { icon: '📦', desc: '1 предмет. Обычный лут.' },
      silver: { icon: '🗃️', desc: '2 предмета. Шанс Epic и выше.' },
      premium: { icon: '🎁', desc: 'Гарантированный Epic+. Только тут падают премиум L-M предметы!' },
      pack: { icon: '💎', desc: '5 премиум-предметов. Выгоднее на 10%.' },
    };
    Object.keys(D.BOXES).forEach(k => {
      const bx = D.BOXES[k];
      const meta = boxMeta[k];
      const cost = bx.cost.gold ? fmt(bx.cost.gold) + ' 💰' : fmt(bx.cost.tokens) + ' 🔷';
      const card = el('div', 'shop-card' + (bx.premium ? ' premium' : ''));
      card.innerHTML = `
        <div class="sc-big">${meta.icon}</div>
        <div class="sc-title">${bx.name}</div>
        <div class="sc-desc">${meta.desc}</div>
        <button class="btn ${bx.premium ? 'gold' : ''}">${cost}</button>
      `;
      card.querySelector('button').onclick = () => {
        const res = C.openBox(k);
        if (!res) return;
        if (res.err) { toast(res.err, true); return; }
        SM.sfx.coin();
        showBoxResult(bx.name, res.items);
        renderHeader();
      };
      grid.appendChild(card);
    });
    root.appendChild(grid);

    // обмен токенов на золото
    const ex = el('div', 'shop-exchange');
    ex.innerHTML = `<div class="ws-title">ОБМЕН</div>
      <button class="btn" id="btn-ex-gold">10 🔷 → 12 000 💰</button>`;
    root.appendChild(ex);
    $('#btn-ex-gold').onclick = () => {
      if (s.tokens < 10) { toast('Не хватает токенов', true); return; }
      s.tokens -= 10; s.gold += 12000; C.save();
      SM.sfx.coin(); renderHeader(); toast('+12 000 💰');
    };
  }

  function showBoxResult(boxName, items) {
    const box = el('div');
    box.innerHTML = `<h3>📦 ${boxName}</h3>`;
    const list = el('div', 'box-result');
    items.forEach(inst => list.appendChild(itemCard(inst, { hideEquipped: true, onClick: openItemModal })));
    box.appendChild(list);
    const btns = el('div', 'modal-btns');
    const ok = el('button', 'btn', 'Отлично!');
    btns.appendChild(ok);
    box.appendChild(btns);
    const back = modal(box, { wide: true });
    ok.onclick = () => back.remove();
  }

  /* ==================== ДЕЙЛИКИ ==================== */
  function openDailies() {
    const s = C.state;
    const box = el('div');
    box.innerHTML = '<h3>📋 Ежедневные задания</h3>';
    s.dailies.quests.forEach(q => {
      box.appendChild(el('div', 'daily-row' + (q.done ? ' done' : ''),
        `${q.done ? '✅' : '⬜'} ${q.text} <span class="dim">${q.have}/${q.need}</span>`));
    });
    const btns = el('div', 'modal-btns');
    const claim = el('button', 'btn gold', 'Забрать +10 🔷');
    claim.disabled = !C.dailiesComplete() || s.dailies.claimed;
    if (s.dailies.claimed) claim.textContent = 'Получено ✔';
    claim.onclick = () => {
      if (C.claimDailies()) { SM.sfx.coin(); renderHeader(); claim.disabled = true; claim.textContent = 'Получено ✔'; }
    };
    btns.appendChild(claim);
    box.appendChild(btns);
    modal(box);
  }

  /* ==================== БОЙ ==================== */
  let scene = null;
  let battleCtx = null; // {battle, opts, inputMode}

  function launchBattle(foe, opts) {
    const s = C.state;
    const ms = C.mechStats(s.activeMech);
    if (!ms.valid) { toast('Мех не собран: нужны корпус, ноги и оружие', true); show('workshop'); return; }
    if (!ms.usable) { toast('Мех тяжелее 1010 кг — сними что-нибудь', true); show('workshop'); return; }
    const fa = B.fighterFromMech(s.activeMech);
    const fb = B.fighterFromFoe(foe);
    const battle = B.start(fa, fb);
    battleCtx = { battle, opts, inputMode: null };
    window.__SM_BATTLE = battle; // отладочный хук (тесты)

    $('#battle-title').textContent = opts.title || 'БОЙ';
    $('#battle-overlay').classList.add('active');
    const cv = $('#battle-canvas');
    sizeBattleCanvas(cv);
    if (scene) scene.stop();
    scene = new R.BattleScene(cv, battle);
    $('#battle-log').innerHTML = '';
    renderBattleControls();
  }

  function sizeBattleCanvas(cv) {
    const w = Math.min(1100, window.innerWidth - 30);
    cv.width = w;
    cv.height = Math.min(480, Math.max(360, window.innerHeight - 320));
  }

  function pushLog() {
    const b = battleCtx.battle;
    const logEl = $('#battle-log');
    logEl.innerHTML = b.log.slice(-30).map(l => `<div>${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  function awaitIdle() {
    return new Promise(res => {
      if (!scene.current && !scene.queue.length) res();
      else scene.onIdle = res;
    });
  }

  async function playerAct(fn) {
    const b = battleCtx.battle;
    if (b.over || b.turn !== 0) return;
    const events = fn();
    if (!events.length) return;
    battleCtx.inputMode = null;
    scene.hoverTiles = null;
    renderBattleControls(true);
    scene.enqueue(events);
    await awaitIdle();
    pushLog();
    if (b.over) return battleEnd();
    if (b.actions <= 0) return doEndTurn();
    renderBattleControls();
  }

  async function doEndTurn() {
    const b = battleCtx.battle;
    battleCtx.inputMode = null;
    scene.hoverTiles = null;
    renderBattleControls(true);
    scene.enqueue(B.endTurn(b));
    await awaitIdle();
    pushLog();
    if (b.over) return battleEnd();
    if (b.turn === 1) return aiTurn();
    renderBattleControls();
  }

  async function aiTurn() {
    const b = battleCtx.battle;
    renderBattleControls(true);
    while (!b.over && b.turn === 1) {
      await sleep(420);
      const choice = b.actions > 0 ? B.aiChooseAction(b) : null;
      if (choice) {
        scene.enqueue(B.aiExecute(b, choice));
        await awaitIdle();
        pushLog();
        if (b.over) return battleEnd();
      } else {
        scene.enqueue(B.endTurn(b));
        await awaitIdle();
        pushLog();
        if (b.over) return battleEnd();
        // после endTurn ход мог вернуться к игроку, но игрок может быть перегрет (actions=0)
        if (b.turn === 0 && b.actions <= 0) {
          await sleep(650);
          return doEndTurn(); // пропуск хода игрока из-за перегрева
        }
      }
    }
    renderBattleControls();
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function battleEnd() {
    const b = battleCtx.battle;
    const won = b.winner === 0;
    if (won) SM.sfx.win(); else SM.sfx.lose();
    setTimeout(() => {
      const opts = battleCtx.opts;
      const html = won ? opts.onWin(b) : opts.onLose(b);
      const box = el('div');
      box.innerHTML = `<h3 class="${won ? 'vic' : 'def'}">${won ? '🏆 ПОБЕДА!' : '💥 ПОРАЖЕНИЕ'}</h3>${html}`;
      const btns = el('div', 'modal-btns');
      const ok = el('button', 'btn', 'Продолжить');
      btns.appendChild(ok);
      box.appendChild(btns);
      const back = modal(box, { noBackClose: true, noClose: true });
      ok.onclick = () => {
        back.remove();
        closeBattle(opts.backTo);
      };
      renderHeader();
    }, 900);
  }

  function closeBattle(backTo) {
    if (scene) { scene.stop(); scene = null; }
    $('#battle-overlay').classList.remove('active');
    battleCtx = null;
    show(backTo || 'workshop');
  }

  // --- панель действий ---
  function renderBattleControls(busy) {
    const wrap = $('#battle-controls');
    wrap.innerHTML = '';
    if (!battleCtx) return;
    const b = battleCtx.battle;
    const f = b.fighters[0];
    if (b.over) return;

    const info = el('div', 'bc-info');
    info.innerHTML = b.turn === 0
      ? `<b>ТВОЙ ХОД</b> · действий: <b class="hl">${b.actions}</b> · дистанция: ${B.dist(b)}`
      : `<b>ХОД ПРОТИВНИКА…</b>`;
    wrap.appendChild(info);

    if (busy || b.turn !== 0) return;

    const acts = B.availableActions(b);
    const row = el('div', 'bc-row');

    // оружие
    f.weapons.forEach(w => {
      const chk = acts.weapons[w.slotKey];
      const btn = el('button', 'wpn-btn elem-' + (w.def.elem || 'PHYS'));
      const uses = w.usesLeft === Infinity ? '∞' : w.usesLeft;
      btn.innerHTML = `
        <span class="wb-name">${w.def.name}</span>
        <span class="wb-sub">⚔ ${w.stats.dmg ? w.stats.dmg[0] + '–' + w.stats.dmg[1] : '—'} · 📏 ${w.def.range[0]}–${w.def.range[1]} · ×${uses}</span>
        <span class="wb-sub">${w.def.costE ? '⚡' + w.def.costE + ' ' : ''}${w.def.costH ? '🔥' + w.def.costH : ''}</span>
      `;
      btn.disabled = !chk.ok;
      btn.title = chk.ok ? '' : chk.why;
      btn.onclick = () => playerAct(() => B.doWeapon(b, w.slotKey));
      row.appendChild(btn);
    });

    // стомп
    if (f.items.legs) {
      const btn = el('button', 'wpn-btn');
      btn.innerHTML = `<span class="wb-name">🦿 СТОМП</span><span class="wb-sub">⚔ ${f.items.legs.stats.dmg[0]}–${f.items.legs.stats.dmg[1]} · 📏 1</span>`;
      btn.disabled = !acts.stomp.ok;
      btn.title = acts.stomp.ok ? '' : acts.stomp.why;
      btn.onclick = () => playerAct(() => B.doStomp(b));
      row.appendChild(btn);
    }
    wrap.appendChild(row);

    const row2 = el('div', 'bc-row');
    // движение
    const mv = el('button', 'act-btn' + (battleCtx.inputMode === 'move' ? ' active' : ''));
    mv.innerHTML = `👣 ДВИЖЕНИЕ`;
    mv.disabled = !acts.moves.length;
    mv.onclick = () => {
      battleCtx.inputMode = battleCtx.inputMode === 'move' ? null : 'move';
      scene.hoverTiles = battleCtx.inputMode === 'move' ? acts.moves : null;
      renderBattleControls();
    };
    row2.appendChild(mv);

    // спецы
    const spec = [
      ['tele', '🌀 ТЕЛЕПОРТ'], ['charge', '💨 ЧАРДЖ'], ['hook', '🪝 КРЮК'],
    ];
    spec.forEach(([k, label]) => {
      if (!f.items[k]) return;
      const chk = acts.specials[k];
      const btn = el('button', 'act-btn' + (battleCtx.inputMode === k ? ' active' : ''));
      const uses = f.items[k].usesLeft;
      btn.innerHTML = `${label} <span class="dim">×${uses === Infinity ? '∞' : uses}</span>`;
      btn.disabled = !chk || !chk.ok;
      btn.title = chk && !chk.ok ? chk.why : '';
      btn.onclick = () => {
        if (k === 'tele') {
          battleCtx.inputMode = battleCtx.inputMode === 'tele' ? null : 'tele';
          const tiles = [];
          for (let t = 0; t < D.BATTLE.TILES; t++) if (t !== b.fighters[0].pos && t !== b.fighters[1].pos) tiles.push(t);
          scene.hoverTiles = battleCtx.inputMode === 'tele' ? tiles : null;
          renderBattleControls();
        } else if (k === 'charge') playerAct(() => B.doCharge(b));
        else playerAct(() => B.doHook(b));
      };
      row2.appendChild(btn);
    });

    const end = el('button', 'act-btn end');
    end.textContent = '⏭ КОНЕЦ ХОДА';
    end.onclick = () => doEndTurn();
    row2.appendChild(end);

    const ff = el('button', 'act-btn danger');
    ff.textContent = '🏳 Сдаться';
    ff.onclick = () => {
      if (!confirm('Сдаться?')) return;
      b.over = true; b.winner = 1;
      battleEnd();
    };
    row2.appendChild(ff);
    wrap.appendChild(row2);
  }

  function onBattleCanvasClick(e) {
    if (!battleCtx || !scene) return;
    const b = battleCtx.battle;
    if (b.turn !== 0 || b.over || !battleCtx.inputMode) return;
    const rect = scene.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (scene.canvas.width / rect.width);
    // ближайший тайл
    let best = -1, bestD = 1e9;
    for (let t = 0; t < D.BATTLE.TILES; t++) {
      const d = Math.abs(scene.tileX(t) - x);
      if (d < bestD) { bestD = d; best = t; }
    }
    if (bestD > 40) return;
    if (battleCtx.inputMode === 'move') {
      if (B.moveTargets(b).includes(best)) playerAct(() => B.doMove(b, best));
    } else if (battleCtx.inputMode === 'tele') {
      playerAct(() => B.doTele(b, best));
    }
  }

  /* ==================== ИНИЦИАЛИЗАЦИЯ ==================== */
  function initUi() {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => { SM.sfx.click(); show(b.dataset.screen); });
    });
    $('#btn-sound').onclick = () => {
      C.state.sound = !C.state.sound; C.save(); renderHeader();
    };
    $('#btn-dailies').onclick = openDailies;
    $('#btn-reset').onclick = () => {
      if (confirm('Сбросить ВЕСЬ прогресс и начать заново?')) { C.resetSave(); location.reload(); }
    };
    $('#hdr-name').onclick = () => {
      const n = prompt('Имя пилота:', C.state.name);
      if (n && n.trim()) { C.state.name = n.trim().slice(0, 16); C.save(); renderHeader(); }
    };
    $('#battle-canvas').addEventListener('click', onBattleCanvasClick);
    window.addEventListener('resize', () => {
      if (scene) sizeBattleCanvas(scene.canvas);
    });

    if (!C.state.seenIntro) {
      C.state.seenIntro = true; C.save();
      const box = el('div');
      box.innerHTML = `
        <h3>🤖 SUPER MECHS</h3>
        <p>Собери боевого меха и освободи пустоши!</p>
        <ul class="intro-list">
          <li>🛠 <b>Мастерская</b> — экипируй корпус, ноги, оружие, дрона и модули. Лимит веса — 1000 кг (+10 кг перегруза со штрафом −15 HP/кг).</li>
          <li>⚔ <b>Бой</b> — 2 действия за ход. Следи за ⚡энергией и 🔥теплом: перегрев = пропуск хода!</li>
          <li>📦 Открывай ящики, прокачивай предметы и трансформируй их: Common → Rare → Epic → Legendary → Mythical → Divine.</li>
          <li>🏟 Арена, кампания и рейды ждут. Удачи, пилот!</li>
        </ul>`;
      const btns = el('div', 'modal-btns');
      const ok = el('button', 'btn', 'ПОЕХАЛИ!');
      btns.appendChild(ok);
      box.appendChild(btns);
      const back = modal(box, { noBackClose: true, noClose: true });
      ok.onclick = () => back.remove();
    }

    show('workshop');
  }

  SM.ui = { initUi, show, toast, renderHeader };
})();
