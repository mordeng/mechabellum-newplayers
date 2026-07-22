/* Mechabellum Companion — mobile-first, no dependencies.
 * Data lives in data/units.json; user adjustments (votes, custom counters,
 * live board) live in localStorage and can be exported/imported. */
(() => {
  'use strict';

  const REPO_URL = 'https://github.com/mordeng/mechabellum-newplayers';
  const STORE_KEY = 'mecha-companion-v1';

  const state = {
    units: [],
    unitsById: new Map(),
    generalTips: [],
    edges: [],            // {enemy, counter, reason, strength, custom, key}
    tab: 'counter',
    selectedEnemy: null,  // counter-finder selection
    unitSearch: '',
    counterSearch: '',
    store: loadStore(),
  };

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const s = raw ? JSON.parse(raw) : {};
      return {
        votes: s.votes || {},          // key -> -1 | 1
        custom: s.custom || [],        // {enemyId, counterId, strength, reason}
        live: s.live || {},            // enemyId -> count
      };
    } catch {
      return { votes: {}, custom: [], live: {} };
    }
  }

  function saveStore() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  }

  // ---------- data ----------

  async function loadData() {
    const res = await fetch('data/units.json');
    const data = await res.json();
    state.units = data.units;
    state.generalTips = data.generalTips || [];
    state.unitsById = new Map(state.units.map(u => [u.id, u]));
    buildEdges();
  }

  function nameToId(name) {
    const id = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return state.unitsById.has(id) ? id : null;
  }

  function edgeKey(enemyId, counterId) { return enemyId + '>' + counterId; }

  /* Merge both directions from the data file (unit.counteredBy and other
   * units' "counters" lists) plus the user's custom entries into one edge
   * list: enemy -> counter. */
  function buildEdges() {
    const map = new Map();
    const add = (enemyId, counterId, reason, strength, custom) => {
      if (!enemyId || !counterId || enemyId === counterId) return;
      const key = edgeKey(enemyId, counterId);
      const explicit = strength != null;
      const existing = map.get(key);
      if (existing) {
        if (!existing.reason && reason) existing.reason = reason;
        if ((explicit && !existing.explicit) || custom) {
          existing.strength = strength;
          existing.explicit = true;
        }
        if (custom) existing.custom = true;
        return;
      }
      map.set(key, { key, enemyId, counterId, reason: reason || '', strength: strength ?? 2, explicit, custom: !!custom });
    };

    for (const u of state.units) {
      for (const c of (u.counteredBy || [])) {
        add(u.id, nameToId(c.unit), c.reason, c.strength, false);
      }
      for (const c of (u.counters || [])) {
        add(nameToId(c.unit), u.id, c.reason, c.strength, false);
      }
    }
    for (const c of state.store.custom) {
      add(c.enemyId, c.counterId, c.reason, c.strength, true);
    }
    state.edges = [...map.values()];
  }

  function countersFor(enemyId) {
    return state.edges
      .filter(e => e.enemyId === enemyId)
      .map(e => ({ ...e, vote: state.store.votes[e.key] || 0 }))
      .sort((a, b) => score(b) - score(a) || a.counterId.localeCompare(b.counterId));
  }

  function score(edge) {
    return edge.strength * 2 + (state.store.votes[edge.key] || 0);
  }

  // ---------- rendering helpers ----------

  const $ = sel => document.querySelector(sel);
  const view = () => $('#view');

  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function unitEmoji(u) { return u.emoji || '🤖'; }

  /* Unit portrait <img> (scraped set in img/units/), falling back to the
   * emoji if the image is missing — e.g. for future units. */
  function unitIcon(u, cls = '') {
    const src = u.icon || `img/units/${u.id}.jpg`;
    return `<img class="unit-icon ${cls}" src="${src}" alt="" loading="lazy"` +
      ` onerror="this.style.display='none';this.nextElementSibling.style.display=''">` +
      `<span class="unit-icon-fallback ${cls}" style="display:none">${unitEmoji(u)}</span>`;
  }

  function unitBadges(u) {
    let b = `<span class="badge ${u.type === 'air' ? 'air' : ''}">${u.type}</span>`;
    if (u.giant) b += ' <span class="badge giant">giant</span>';
    return b;
  }

  function strengthLabel(s) {
    return s >= 3 ? 'hard counter' : s === 2 ? 'good counter' : 'soft counter';
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---------- sheet ----------

  function openSheet(contentFrag) {
    const sheet = $('#sheet');
    const c = $('#sheetContent');
    c.innerHTML = '';
    c.appendChild(contentFrag);
    sheet.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    $('#sheet').classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ---------- unit grid ----------

  function unitGrid({ filter = '', onTap, counts = null, selectedId = null }) {
    const grid = document.createElement('div');
    grid.className = 'unit-grid';
    const q = filter.trim().toLowerCase();
    for (const u of state.units) {
      if (q && !u.name.toLowerCase().includes(q)) continue;
      const cell = document.createElement('button');
      cell.className = 'unit-cell' + (selectedId === u.id ? ' selected' : '');
      cell.innerHTML =
        unitIcon(u, 'icon-cell') +
        `<span>${esc(u.name)}</span>` +
        `<span class="unit-cost">${u.cost} supply</span>` +
        (counts && counts[u.id] ? `<span class="unit-count-badge">${counts[u.id]}</span>` : '');
      cell.addEventListener('click', () => onTap(u));
      grid.appendChild(cell);
    }
    if (!grid.children.length) {
      grid.appendChild(h(`<div class="empty">No units match "${esc(filter)}"</div>`));
    }
    return grid;
  }

  function searchBar(value, placeholder, onInput) {
    const input = document.createElement('input');
    input.className = 'searchbar';
    input.type = 'search';
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('input', () => onInput(input.value));
    return input;
  }

  // ---------- counter rows ----------

  function counterRow(edge, { showEnemy = false } = {}) {
    const counter = state.unitsById.get(edge.counterId);
    const enemy = state.unitsById.get(edge.enemyId);
    if (!counter || !enemy) return document.createDocumentFragment();
    const vote = state.store.votes[edge.key] || 0;
    const effective = Math.max(1, Math.min(3, edge.strength + vote));

    const row = document.createElement('div');
    row.className = 'counter-row';
    row.innerHTML =
      unitIcon(counter, 'icon-row') +
      `<div class="counter-main">` +
        `<div class="counter-name">${esc(counter.name)}<span class="unit-cost">${counter.cost} supply</span></div>` +
        (edge.reason ? `<div class="counter-reason">${esc(edge.reason)}</div>` : '') +
        `<div class="counter-meta">` +
          `<span class="strength s${effective}">${strengthLabel(effective)}</span>` +
          unitBadges(counter) +
          (edge.custom ? '<span class="badge custom">yours</span>' : '') +
          (showEnemy ? `<span class="badge">vs ${esc(enemy.name)}</span>` : '') +
        `</div>` +
      `</div>` +
      `<div class="vote-box">` +
        `<button class="vote-btn up ${vote === 1 ? 'voted' : ''}" aria-label="Works for me">▲</button>` +
        `<span class="vote-score ${vote > 0 ? 'pos' : vote < 0 ? 'neg' : ''}">${vote > 0 ? '+' + vote : vote || '·'}</span>` +
        `<button class="vote-btn down ${vote === -1 ? 'voted' : ''}" aria-label="Doesn't work for me">▼</button>` +
      `</div>`;

    row.querySelector('.counter-main').addEventListener('click', () => openUnitSheet(counter.id));
    row.querySelector('.vote-btn.up').addEventListener('click', () => castVote(edge.key, 1));
    row.querySelector('.vote-btn.down').addEventListener('click', () => castVote(edge.key, -1));
    return row;
  }

  function castVote(key, dir) {
    const cur = state.store.votes[key] || 0;
    const next = cur === dir ? 0 : dir;
    if (next === 0) delete state.store.votes[key];
    else state.store.votes[key] = next;
    saveStore();
    render();
    toast(next === 0 ? 'Vote removed' : next > 0 ? 'Marked as working for you' : 'Marked as not working');
  }

  // ---------- view: counter finder ----------

  function renderCounterFinder() {
    const root = view();
    root.innerHTML = '';

    if (!state.selectedEnemy) {
      root.appendChild(h(`
        <div class="section-title">I'm having trouble against…</div>
        <p class="hint">Tap the enemy unit that's wrecking you and get the best answers, ranked. Vote ▲▼ on what works for you — the list adapts.</p>
      `));
      root.appendChild(searchBar(state.counterSearch, 'Search enemy unit…', v => {
        state.counterSearch = v;
        render();
      }));
      root.appendChild(unitGrid({
        filter: state.counterSearch,
        onTap: u => { state.selectedEnemy = u.id; render(); window.scrollTo(0, 0); },
      }));
      return;
    }

    const enemy = state.unitsById.get(state.selectedEnemy);
    const list = countersFor(enemy.id);

    const head = h(`
      <div class="row spread" style="margin-bottom:12px">
        <button class="btn small" id="backBtn">← Pick another</button>
        <button class="btn small" id="addCounterBtn">+ Add counter</button>
      </div>
      <div class="card">
        <div class="row">
          ${unitIcon(enemy, 'icon-row')}
          <div>
            <div class="counter-name">Trouble against ${esc(enemy.name)}</div>
            <div class="counter-meta">${unitBadges(enemy)} <span class="badge">${enemy.cost} supply</span></div>
          </div>
        </div>
        ${enemy.description ? `<p class="hint" style="margin:10px 0 0">${esc(enemy.description)}</p>` : ''}
      </div>
      <div class="section-title">Best answers</div>
    `);
    head.querySelector('#backBtn').addEventListener('click', () => { state.selectedEnemy = null; render(); });
    head.querySelector('#addCounterBtn').addEventListener('click', () => openAddCounterSheet(enemy.id));
    root.appendChild(head);

    if (!list.length) {
      root.appendChild(h(`<div class="empty"><span class="big">🤷</span>No counters recorded yet.<br>Add one with “+ Add counter”.</div>`));
    } else {
      for (const edge of list) root.appendChild(counterRow(edge));
    }

    const suggest = h(`
      <p class="hint" style="margin-top:14px">Think the community data is wrong?
      <a href="${suggestIssueUrl(enemy)}" target="_blank" rel="noopener" style="color:var(--accent-2)">Suggest a change on GitHub</a>.</p>
    `);
    root.appendChild(suggest);
  }

  function suggestIssueUrl(enemy) {
    const title = encodeURIComponent(`[Counter data] ${enemy.name}`);
    const body = encodeURIComponent(
      `**Unit:** ${enemy.name}\n\n**What should change?** (add/remove/reword a counter, adjust strength)\n\n**Why?** (replay, experience, source)\n`);
    return `${REPO_URL}/issues/new?title=${title}&body=${body}`;
  }

  // ---------- add custom counter ----------

  function openAddCounterSheet(enemyId) {
    const options = state.units
      .map(u => `<option value="${u.id}">${esc(u.name)}</option>`)
      .join('');
    const frag = h(`
      <h2>Add a counter</h2>
      <p>Stored on your device and mixed into your lists. Export it in ⚙ Settings to share.</p>
      <div class="field" style="margin-top:14px">
        <label>Enemy unit (you're fighting against)</label>
        <select id="acEnemy">${options}</select>
      </div>
      <div class="field">
        <label>Counter with</label>
        <select id="acCounter">${options}</select>
      </div>
      <div class="field">
        <label>How strong?</label>
        <div class="seg" id="acStrength">
          <button data-v="1">Soft</button>
          <button data-v="2" class="active">Good</button>
          <button data-v="3">Hard</button>
        </div>
      </div>
      <div class="field">
        <label>Why does it work? (optional)</label>
        <textarea id="acReason" placeholder="e.g. Out-ranges it and kills it before it closes the gap"></textarea>
      </div>
      <button class="btn primary" id="acSave" style="width:100%">Save counter</button>
    `);
    frag.getElementById('acEnemy').value = enemyId;
    let strength = 2;
    frag.getElementById('acStrength').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      strength = +b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    frag.getElementById('acSave').addEventListener('click', () => {
      const enemy = $('#acEnemy').value;
      const counter = $('#acCounter').value;
      if (enemy === counter) { toast('Pick two different units'); return; }
      state.store.custom = state.store.custom.filter(c => !(c.enemyId === enemy && c.counterId === counter));
      state.store.custom.push({ enemyId: enemy, counterId: counter, strength, reason: $('#acReason').value.trim() });
      saveStore();
      buildEdges();
      closeSheet();
      render();
      toast('Counter added');
    });
    openSheet(frag);
  }

  // ---------- view: live match ----------

  function renderLive() {
    const root = view();
    root.innerHTML = '';
    const counts = state.store.live;
    const picked = Object.entries(counts).filter(([, n]) => n > 0);

    root.appendChild(h(`
      <div class="section-title">Opponent's board</div>
      <p class="hint">During a match, tap what your opponent is fielding (tap again for more). Suggestions below update as their army grows.</p>
    `));

    if (picked.length) {
      const chips = document.createElement('div');
      chips.className = 'threat-list';
      for (const [id, n] of picked) {
        const u = state.unitsById.get(id);
        if (!u) continue;
        const chip = document.createElement('button');
        chip.className = 'threat-chip';
        chip.innerHTML = `${unitIcon(u, 'icon-chip')} ${esc(u.name)} ×${n} <span class="x">−</span>`;
        chip.addEventListener('click', () => {
          counts[id] = n - 1;
          if (counts[id] <= 0) delete counts[id];
          saveStore(); render();
        });
        chips.appendChild(chip);
      }
      const clear = document.createElement('button');
      clear.className = 'btn small danger';
      clear.textContent = 'Clear board';
      clear.addEventListener('click', () => { state.store.live = {}; saveStore(); render(); });
      const wrap = document.createElement('div');
      wrap.className = 'live-summary';
      wrap.appendChild(chips);
      wrap.appendChild(clear);
      root.appendChild(wrap);
    }

    root.appendChild(unitGrid({
      counts,
      onTap: u => {
        counts[u.id] = (counts[u.id] || 0) + 1;
        saveStore(); render();
      },
    }));

    if (picked.length) {
      root.appendChild(h(`<div class="section-title">What you should build</div>`));
      const suggestions = liveSuggestions(counts).slice(0, 8);
      if (!suggestions.length) {
        root.appendChild(h(`<div class="empty">No counter data for this board yet.</div>`));
      }
      for (const s of suggestions) {
        const u = state.unitsById.get(s.counterId);
        const row = document.createElement('div');
        row.className = 'counter-row';
        row.innerHTML =
          unitIcon(u, 'icon-row') +
          `<div class="counter-main">` +
            `<div class="counter-name">${esc(u.name)}<span class="unit-cost">${u.cost} supply</span></div>` +
            `<div class="covers">Covers: ${s.covers.map(c => `<b>${esc(c.name)}</b>&nbsp;×${c.n}`).join(', ')}</div>` +
            `<div class="counter-meta">${unitBadges(u)}</div>` +
          `</div>`;
        row.addEventListener('click', () => openUnitSheet(u.id));
        root.appendChild(row);
      }
    }
  }

  function liveSuggestions(counts) {
    const perCounter = new Map();
    for (const [enemyId, n] of Object.entries(counts)) {
      if (n <= 0) continue;
      const enemy = state.unitsById.get(enemyId);
      for (const edge of state.edges) {
        if (edge.enemyId !== enemyId) continue;
        const w = n * score(edge);
        const entry = perCounter.get(edge.counterId) || { counterId: edge.counterId, total: 0, covers: [] };
        entry.total += w;
        entry.covers.push({ name: enemy.name, n, w });
        perCounter.set(edge.counterId, entry);
      }
    }
    return [...perCounter.values()]
      .map(e => ({ ...e, covers: e.covers.sort((a, b) => b.w - a.w) }))
      .sort((a, b) => b.total - a.total || b.covers.length - a.covers.length);
  }

  // ---------- view: units ----------

  function renderUnits() {
    const root = view();
    root.innerHTML = '';
    root.appendChild(h(`<div class="section-title">All units</div>`));
    root.appendChild(searchBar(state.unitSearch, 'Search units…', v => {
      state.unitSearch = v;
      render();
    }));
    root.appendChild(unitGrid({
      filter: state.unitSearch,
      onTap: u => openUnitSheet(u.id),
    }));
  }

  function openUnitSheet(unitId) {
    const u = state.unitsById.get(unitId);
    const goodAgainst = state.edges.filter(e => e.counterId === u.id);
    const weakTo = countersFor(u.id);

    const frag = h(`
      <div class="row">
        ${unitIcon(u, 'icon-sheet')}
        <div>
          <h2>${esc(u.name)}</h2>
          <div class="counter-meta">${unitBadges(u)} <span class="badge">${u.cost} supply</span></div>
        </div>
      </div>
      ${u.description ? `<p style="margin-top:10px">${esc(u.description)}</p>` : ''}
      ${weakTo.length ? '<h3>Countered by</h3><div id="usWeak"></div>' : ''}
      ${goodAgainst.length ? '<h3>Good against</h3><div id="usGood"></div>' : ''}
      ${(u.tips || []).length ? `<h3>Tips</h3><ul>${u.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="row" style="margin-top:16px">
        <button class="btn" id="usTrouble">🎯 I'm having trouble against this</button>
      </div>
    `);

    const mini = (edge, otherId, prefix) => {
      const other = state.unitsById.get(otherId);
      if (!other) return null;
      const el = document.createElement('div');
      el.className = 'mini-counter';
      el.innerHTML = `${unitIcon(other, 'icon-mini')}<b>${esc(other.name)}</b>` +
        `<span class="reason">${esc(edge.reason || '')}</span>`;
      el.addEventListener('click', () => openUnitSheet(other.id));
      return el;
    };

    const weakBox = frag.getElementById('usWeak');
    if (weakBox) for (const e of weakTo.slice(0, 6)) {
      const el = mini(e, e.counterId);
      if (el) weakBox.appendChild(el);
    }
    const goodBox = frag.getElementById('usGood');
    if (goodBox) for (const e of goodAgainst.slice(0, 6)) {
      const el = mini(e, e.enemyId);
      if (el) goodBox.appendChild(el);
    }
    frag.getElementById('usTrouble').addEventListener('click', () => {
      closeSheet();
      state.tab = 'counter';
      state.selectedEnemy = u.id;
      syncTabs();
      render();
    });
    openSheet(frag);
  }

  // ---------- view: tips ----------

  function renderTips() {
    const root = view();
    root.innerHTML = '';
    root.appendChild(h(`
      <div class="section-title">New player tips</div>
      <p class="hint">The fundamentals that win games before unit micro ever matters. Baseline from the excellent guides at <a href="https://mechamonarch.com" target="_blank" rel="noopener" style="color:var(--accent-2)">mechamonarch.com</a>.</p>
    `));
    for (const t of state.generalTips) {
      root.appendChild(h(`
        <div class="card tip-card">
          <div class="tip-cat">${esc(t.category)}</div>
          <div class="tip-text">${esc(t.tip)}</div>
        </div>
      `));
    }
  }

  // ---------- settings ----------

  function openSettings() {
    const nVotes = Object.keys(state.store.votes).length;
    const nCustom = state.store.custom.length;
    const frag = h(`
      <h2>Settings</h2>
      <h3>Your adjustments</h3>
      <p>${nVotes} vote${nVotes === 1 ? '' : 's'}, ${nCustom} custom counter${nCustom === 1 ? '' : 's'} — stored only on this device.</p>
      <div class="row" style="margin-top:10px">
        <button class="btn" id="setExport">⬆ Export</button>
        <button class="btn" id="setImport">⬇ Import</button>
        <button class="btn danger" id="setReset">Reset all</button>
      </div>
      <h3>Community</h3>
      <p>The counter database is a plain JSON file anyone can improve. Open an issue or PR:</p>
      <div class="row" style="margin-top:10px">
        <a class="btn" href="${REPO_URL}" target="_blank" rel="noopener">GitHub repo</a>
        <a class="btn" href="${REPO_URL}/issues/new" target="_blank" rel="noopener">Report wrong data</a>
      </div>
      <h3>About</h3>
      <p>Companion app for Mechabellum new players. Counter baseline adapted from the unit guides at mechamonarch.com — go read them, they're great. Not affiliated with Game River or mechamonarch.</p>
    `);
    frag.getElementById('setExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ votes: state.store.votes, custom: state.store.custom }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mecha-companion-adjustments.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    frag.getElementById('setImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.addEventListener('change', async () => {
        try {
          const data = JSON.parse(await input.files[0].text());
          if (data.votes) Object.assign(state.store.votes, data.votes);
          if (Array.isArray(data.custom)) {
            for (const c of data.custom) {
              if (c && c.enemyId && c.counterId) {
                state.store.custom = state.store.custom.filter(x => !(x.enemyId === c.enemyId && x.counterId === c.counterId));
                state.store.custom.push(c);
              }
            }
          }
          saveStore(); buildEdges(); closeSheet(); render();
          toast('Adjustments imported');
        } catch {
          toast('Could not read that file');
        }
      });
      input.click();
    });
    frag.getElementById('setReset').addEventListener('click', () => {
      if (!confirm('Delete all your votes and custom counters?')) return;
      state.store.votes = {};
      state.store.custom = [];
      saveStore(); buildEdges(); closeSheet(); render();
      toast('Adjustments reset');
    });
    openSheet(frag);
  }

  // ---------- shell ----------

  function syncTabs() {
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === state.tab));
  }

  function render() {
    switch (state.tab) {
      case 'counter': return renderCounterFinder();
      case 'live': return renderLive();
      case 'units': return renderUnits();
      case 'tips': return renderTips();
    }
  }

  function init() {
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        state.tab = t.dataset.tab;
        syncTabs();
        render();
        window.scrollTo(0, 0);
      });
    });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#sheet').querySelector('.sheet-backdrop').addEventListener('click', closeSheet);
    $('#sheetClose').addEventListener('click', closeSheet);

    loadData()
      .then(render)
      .catch(() => {
        view().innerHTML = '<div class="empty"><span class="big">📡</span>Could not load unit data.<br>If you opened the file directly, serve it over HTTP (e.g. <code>npx serve</code>).</div>';
      });

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
