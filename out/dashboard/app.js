// Token Radar's dashboard: it reads window.RADAR (the board main.ts writes) and window.RadarPlan (the plan
// engine main.ts runs) and renders the ranked board, a protocol's page and the model's page. No network, no
// framework, no image. For the reader of this source: 213 pre-token rows, 40 watchlist all covered, 173 early
// rows below the $50M floor, 24 live-token protocols set aside; no protocol name is ever special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var PLAN = window.RadarPlan;
  if (!DATA || !PLAN) return;
  var app = document.getElementById('board');
  var state = { view: 'board', q: '', category: 'all', scope: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  // figures

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtChains(chains) {
    if (!chains || chains.length === 0) return 'an unnamed chain';
    if (chains.length === 1) return chains[0];
    if (chains.length === 2) return chains[0] + ', ' + chains[1];
    return chains[0] + ', ' + chains[1] + ' +' + (chains.length - 2);
  }

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  // The model, in one function (radar-3). The page recomputes every row from the snapshot's own figures and
// prints them, so the code and the board's data are visibly the same arithmetic.
//
//   implied = round( tvl_usd x 0.25
//     x (1 + clamp(change_7d, -40, 120) / 100 x 1.5)
//     x (0.5 + min(age_days, 1460) / 1460 x 0.7)
//     x (1 + min(max(chains - 1, 0), 4) x 0.05) )
//
// base: a launch is worth a fraction of the value already locked in it; 0.25 is the snapshot's own median
// market cap over TVL, rounded, stated on the page. growth: money moving in is the best short-term sign a
// launch is near, so it counts half again, clamped because the fastest grower is +4448% and one week should
// not decide a rank. maturity: a long run with no token has had longer to build the base a launch rewards,
// 0.5x at day 0 to 1.2x at four years, the snapshot's 95th-percentile age. chains: each chain past the first
// adds 0.05, capped at four, worth something but never dominating. An unknown age is a neutral 365 days.
  function factors(row) {
    var m = DATA.model;
    var growth = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, m.growth_floor, m.growth_cap);
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturityMult = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chains = row.chains ? row.chains.length : 0;
    var chainMult = 1 + Math.min(Math.max(chains - 1, 0), m.chain_cap) * m.chain_step;
    var base = row.tvl_usd * m.base_multiple;
    return {
      base: base,
      growthPct: growth,
      growthMult: growthMult,
      maturityMult: maturityMult,
      chainMult: chainMult,
      implied: Math.max(1, Math.round(base * growthMult * maturityMult * chainMult)),
    };
  }

  // dom

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // address

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('view') === 'method') state.view = 'method';
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('scope')) state.scope = params.get('scope');
    if (params.get('tab') === 'live') state.tab = 'live';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.selected) params.set('p', state.selected);
    if (state.view === 'method') params.set('view', 'method');
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.tab === 'live') params.set('tab', 'live');
    var next = params.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }
  function go(view, slug) {
    state.view = view;
    state.selected = slug || null;
    writeHash();
    render();
  }

  // selection

  function rowBySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortRows(list) {
    var key = state.sort;
    var dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av;
      var bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // chrome

  function header() {
    return el('header', { class: 'top' }, [
      el('div', { class: 'brand' }, [
        el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('span', { class: 'brand-name', text: 'Token Radar' }),
        el('span', { class: 'brand-sub', text: 'pre-token launches, ranked' }),
      ]),
      el('div', { class: 'top-right' }, [
        el('nav', { class: 'nav', 'aria-label': 'Views' }, [
          el('button', { class: state.view === 'board' && !state.selected ? 'nav-link on' : 'nav-link', type: 'button', text: 'Board', onclick: function () { go('board'); } }),
          el('button', { class: state.view === 'method' && !state.selected ? 'nav-link on' : 'nav-link', type: 'button', text: 'Method', onclick: function () { go('method'); } }),
        ]),
        el('span', { class: 'top-meta', text: 'Snapshot ' + DATA.as_of + ' · ' + DATA.model_version }),
      ]),
    ]);
  }

  function lede() {
    var facts = [
      ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size],
      ['Pre-token rows ranked', String(DATA.board_size)],
      ['Early rows below the floor', String(DATA.early_size)],
      ['Live-token protocols set aside', String(DATA.live_size)],
    ];
    return el('section', { class: 'lede' }, [
      el('div', { class: 'lede-copy' }, [
        el('h1', { text: 'What a token would be worth' }),
        el('p', { class: 'lede-text', text: 'Pre-token protocols, ranked by the implied value of the token each could still issue. The watchlist is the floor, never the ceiling: every other rankable pre-token protocol below its $' + Math.round(DATA.floor_usd / 1e6) + 'M floor is here too, as the early radar. Each row carries a farm plan with its cost and its time. Protocols whose token already trades sit in their own tab with the token each carries, never in the ranking. Implied value is a model, stated on the Method page, not a promise.' }),
      ]),
      el('dl', { class: 'facts' }, facts.map(function (f) {
        return el('div', { class: 'fact' }, [el('dt', { text: f[0] }), el('dd', { text: f[1] })]);
      })),
    ]);
  }

  function seg(label, options, value, onPick) {
    return el('div', { class: 'field' }, [
      el('span', { class: 'field-label', text: label }),
      el('div', { class: 'seg', role: 'group' }, options.map(function (o) {
        return el('button', { type: 'button', 'aria-pressed': o[0] === value ? 'true' : 'false', text: o[1], onclick: function () { onPick(o[0]); } });
      })),
    ]);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', value: state.q, placeholder: 'Name, category or chain', 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' }, [
      el('option', { value: 'all', text: 'All categories' }),
    ].concat(categories.map(function (c) {
      return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
    })));
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });

    var children = [
      el('div', { class: 'field search' }, [el('label', { class: 'field-label', for: 'q', text: 'Search' }), search]),
      el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'category', text: 'Category' }), select]),
      state.tab === 'pre-token' ? seg('Scope', [['all', 'All ' + DATA.board_size], ['watchlist', 'Watchlist ' + DATA.watchlist_size], ['early', 'Early ' + DATA.early_size]], state.scope, function (v) { state.scope = v; writeHash(); render(); }) : null,
      seg('Token status', [['pre-token', 'Pre-token'], ['live', 'Live token']], state.tab, function (v) { state.tab = v; writeHash(); render(); }),
    ];
    var count = state.tab === 'pre-token' ? visibleRows().length + ' rows shown' : DATA.live.length + ' live-token protocols';
    children.push(el('span', { class: 'count', text: count }));
    return el('div', { class: 'controls' }, children);
  }

  function sortHeader(key, label, className) {
    var on = state.sort === key;
    return el('th', { scope: 'col', class: className || null }, [
      el('button', { type: 'button', onclick: function () {
        if (on) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
        render();
      } }, [
        label,
        on ? el('span', { class: 'sort-mark', 'aria-hidden': 'true', text: state.dir < 0 ? '▼' : '▲' }) : null,
      ]),
    ]);
  }

  // board

  function boardPage() {
    var frag = el('div', { class: 'board-view' }, [lede(), controls()]);
    frag.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    return frag;
  }

  function boardTable() {
    var list = sortRows(visibleRows());
    if (list.length === 0) {
      return el('div', { class: 'panel empty' }, [
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.scope = 'all'; writeHash(); render(); } }),
      ]);
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var cls = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', {
        tabindex: '0',
        onclick: function () { go('board', r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('board', r.slug); } },
      }, [
        el('td', { class: 'cell-rank' }, [el('span', { class: r.rank <= 3 ? 'rank top3' : r.rank <= 10 ? 'rank top10' : 'rank', text: String(r.rank) })]),
        el('td', { class: 'cell-name' }, [
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + fmtChains(r.chains) }),
        ]),
        el('td', null, [el('span', { class: r.watchlist ? 'pill wl' : 'pill early', text: r.watchlist ? 'watchlist' : 'early' })]),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + cls, text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'cell-implied' }, [
          el('div', { class: 'implied' }, [
            el('div', { class: 'bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + Math.max(2, Math.round((r.implied_value_usd / max) * 100)) + '%' })]),
            el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          ]),
        ]),
        el('td', { class: 'num sub cell-plan', text: PLAN.planFor(r).length + ' steps' }),
      ]));
    });
    return el('div', { class: 'panel' }, [
      el('div', { class: 'table-wrap' }, [
        el('table', null, [
          el('caption', { class: 'caption', text: 'Pre-token protocols, strongest implied value first. A row opens its model and its farm plan; the column heads sort.' }),
          el('thead', null, [el('tr', null, [
            el('th', { scope: 'col', class: 'cell-rank', text: 'Rank' }),
            sortHeader('name', 'Protocol', 'cell-name'),
            el('th', { scope: 'col', text: 'Scope' }),
            sortHeader('tvl', 'TVL', 'num'),
            sortHeader('growth', '7d', 'num'),
            sortHeader('age', 'Age', 'num'),
            sortHeader('implied', 'Implied value', 'cell-implied'),
            el('th', { scope: 'col', class: 'cell-plan', text: 'Plan' }),
          ])]),
          tbody,
        ]),
      ]),
    ]);
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', { class: 'static' }, [
        el('td', { class: 'cell-name' }, [el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + fmtChains(r.chains) })]),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', null, [el('span', { class: 'ticker num', text: r.symbol || 'token recorded' })]),
        el('td', null, [el('span', { class: 'pill live', text: 'already trades' })]),
        el('td', { class: 'sub', text: 'set aside' }),
      ]));
    });
    return el('div', { class: 'panel' }, [
      el('div', { class: 'table-wrap' }, [
        el('table', null, [
          el('caption', { class: 'caption', text: 'The 24 largest protocols whose record already carries a token, by TVL. They are the ones the radar sets aside — a protocol that trades is not a launch — and they are listed here so the board is visibly pre-token only.' }),
          el('thead', null, [el('tr', null, [
            el('th', { scope: 'col', class: 'cell-name', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }),
            el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', text: 'Token' }),
            el('th', { scope: 'col', text: 'Status' }),
            el('th', { scope: 'col', text: 'On this board' }),
          ])]),
          tbody,
        ]),
      ]),
    ]);
  }

  // a protocol

  function waterfall(row, opts) {
    var f = factors(row);
    var m = DATA.model;
    var brief = !!(opts && opts.brief);
    var rows = brief ? [
      ['TVL', '', fmtUsd(row.tvl_usd), ''],
      ['× base', m.base_multiple + '×', fmtUsd(f.base), m.base_multiple + '× of TVL'],
      ['× growth', f.growthMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult), fmtPct(row.change_7d) + ' over 7 days'],
      ['× maturity', f.maturityMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult * f.maturityMult), (row.age_days === null ? m.unknown_age_days : row.age_days) + ' days'],
      ['× chains', f.chainMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult * f.maturityMult * f.chainMult), (row.chains ? row.chains.length : 0) + ' chains'],
    ] : [
      ['TVL, from the snapshot', '', fmtUsd(row.tvl_usd), ''],
      ['Base claim', m.base_multiple + '×', fmtUsd(f.base), m.base_multiple + '× of TVL'],
      ['Growth', f.growthMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult), fmtPct(row.change_7d) + ' over 7 days'],
      ['Maturity', f.maturityMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult * f.maturityMult), (row.age_days === null ? m.unknown_age_days + ' days, the unknown-age default' : row.age_days + ' days with no token')],
      ['Chains', f.chainMult.toFixed(4) + '×', fmtUsd(f.base * f.growthMult * f.maturityMult * f.chainMult), (row.chains ? row.chains.length : 0) + ' chains'],
    ];
    var list = el('ol', { class: 'waterfall' }, rows.map(function (r) {
      return el('li', { class: 'wf' }, [
        el('span', { class: 'wf-label', text: r[0] }),
        el('span', { class: 'wf-mult num', text: r[1] }),
        el('b', { class: 'wf-value num', text: r[2] }),
        el('span', { class: 'wf-note sub', text: r[3] || '' }),
      ]);
    }).concat([
      el('li', { class: 'wf total' }, [
        el('span', { class: 'wf-label', text: brief ? '= implied value' : 'Implied value' }),
        el('span', { class: 'wf-mult num', text: '' }),
        el('b', { class: 'wf-value num', text: brief ? fmtFull(f.implied) : fmtUsd(f.implied) }),
        el('span', { class: 'wf-note sub', text: brief ? '' : 'rounded to whole dollars' }),
      ]),
    ]));
    var head = el('div', { class: 'card-head' }, [
      el('h2', { text: (opts && opts.title) || 'How the value is built' }),
      el('span', { class: 'sub', text: (opts && opts.sub) || ('Model ' + DATA.model_version) }),
    ]);
    if (opts && opts.foot === false) return el('section', { class: 'card' }, [head, list]);
    return el('section', { class: 'card' }, [head, list, el('p', { class: 'foot', text: 'Recomputed here from the snapshot figures: ' + fmtFull(f.implied) + ', ' + (f.implied === row.implied_value_usd ? 'the same number board.json carries.' : 'which differs from the board, so the data would be stale.') })]);
  }

  function watchNotes(row) {
    var notes = [];
    var g = row.change_7d;
    if (g !== null && g !== undefined) {
      if (g <= -20) notes.push('TVL is down ' + fmtPct(g) + ' in seven days: check whether users are leaving before you add a position, because a falling protocol can still launch but a farm there is a bigger bet.');
      else if (g >= 40) notes.push('TVL is up ' + fmtPct(g) + ' in seven days: inflows that steep usually mean a campaign is already paying, so join before the next snapshot, not after it.');
      else notes.push('TVL moved ' + fmtPct(g) + ' in seven days: neither bleeding nor being pumped, which is when a position is cheapest to open.');
    }
    if (row.age_days === null) notes.push('The snapshot carries no first-listed date, so there is no record of how long it has run: read the protocol\'s own launch post before you deposit.');
    else if (row.age_days < 180) notes.push('Tracked for ' + row.age_days + ' days only: an audit check and a look at the TVL history come before any deposit, because a young protocol\'s yield is a risk premium.');
    else if (row.age_days >= 1095) notes.push('Tracked ' + (row.age_days / 365).toFixed(1) + ' years with no token: the long record is why its maturity multiplier sits near the cap, and why a points program may already have open rounds.');
    if (row.chains && row.chains.length > 3) notes.push('Live on ' + row.chains.length + ' chains: the plan puts the main position on the chain its record lists first and a smaller one on its second, so the width does not become a gas bill.');
    return notes.slice(0, 3);
  }

  function protocolPage(slug) {
    var row = rowBySlug(slug);
    if (!row) {
      return el('div', { class: 'panel empty' }, [
        el('h2', { text: 'That protocol is not on the board' }),
        el('p', { text: 'The row may have been filtered out of the link that opened it.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Back to the board', onclick: function () { go('board'); } }),
      ]);
    }
    var plan = PLAN.planFor(row);
    var f = factors(row);
    var cap = PLAN.capitalFor(row.tvl_usd);
    var open = plan[3] ? plan[3].time : '';

    var steps = el('ol', { class: 'plan-steps' }, plan.map(function (s, i) {
      return el('li', null, [
        el('span', { class: 'step-n num', text: String(i + 1) }),
        el('div', { class: 'step-body' }, [
          el('p', { class: 'step-text', text: s.text }),
          el('div', { class: 'chips' }, [
            el('span', { class: 'chip' }, [el('span', { class: 'chip-label', text: 'Cost' }), el('span', { text: s.cost })]),
            el('span', { class: 'chip' }, [el('span', { class: 'chip-label', text: 'Time' }), el('span', { text: s.time })]),
          ]),
        ]),
      ]);
    }));

    return el('div', { class: 'protocol-view' }, [
      el('div', { class: 'crumbs' }, [
        el('button', { class: 'link', type: 'button', text: '← The board', onclick: function () { go('board'); } }),
        el('span', { class: 'sep', text: '/' }),
        el('span', { class: 'crumb-rank', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('span', { class: row.watchlist ? 'pill wl' : 'pill early', text: row.watchlist ? 'watchlist' : 'early radar' }),
        el('span', { class: 'pill quiet', text: 'no token on record' }),
      ]),
      el('header', { class: 'protocol-head' }, [
        el('div', { class: 'protocol-title' }, [
          el('h1', { text: row.name }),
          el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + fmtChains(row.chains) + (row.listed_at ? ' · tracked since ' + row.listed_at : ' · first-listed date not recorded') }),
        ]),
        el('div', { class: 'head-value' }, [
          el('span', { class: 'head-label', text: 'Implied value' }),
          el('b', { class: 'num', text: fmtUsd(f.implied) }),
          el('em', { class: 'num', text: fmtFull(f.implied) }),
          el('em', { class: 'num quiet', text: (f.implied / row.tvl_usd).toFixed(2) + '× TVL' }),
        ]),
      ]),
      el('div', { class: 'protocol-grid' }, [
        el('section', { class: 'card plan-card' }, [
          el('div', { class: 'card-head' }, [
            el('h2', { text: 'Farm plan' }),
            el('span', { class: 'sub', text: plan.length + ' steps · ' + fmtUsd(cap) + ' of capital · ' + open }),
          ]),
          steps,
          el('p', { class: 'foot', text: 'Derived from this protocol\'s record — category, chains, TVL, age — by the same function that writes board.json\'s farm_steps; no name is special-cased.' }),
        ]),
        el('aside', { class: 'protocol-side' }, [
          waterfall(row),
          el('section', { class: 'card' }, [
            el('div', { class: 'card-head' }, [el('h2', { text: 'What to watch' })]),
            el('ul', { class: 'notes' }, watchNotes(row).map(function (n) { return el('li', { text: n }); })),
          ]),
        ]),
      ]),
    ]);
  }

  // the method

  function medianOf(list) {
    if (!list.length) return null;
    var sorted = list.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function methodPage() {
    var m = DATA.model;
    var example = DATA.rows[0];
    var f = factors(example);
    var boardMedian = medianOf(DATA.rows.map(function (r) { return r.implied_value_usd / r.tvl_usd; }));
    var liveMedian = DATA.live_mc_tvl_median;

    function term(name, body, note) {
      return el('div', { class: 'term' }, [
        el('span', { class: 'term-name', text: name }),
        el('code', { class: 'term-body', text: body }),
        el('span', { class: 'term-note sub', text: note }),
      ]);
    }

    return el('div', { class: 'method-view' }, [
      el('header', { class: 'method-head' }, [
        el('h1', { text: 'The model, in full' }),
        el('p', { class: 'lede-text', text: 'One function scores every row: TVL × 0.25, then the seven-day growth, the days the protocol has run with no token and its chain count. No protocol name appears in it, and no row is hand-picked.' }),
      ]),
      el('section', { class: 'card formula-card' }, [
        el('div', { class: 'card-head' }, [el('h2', { text: 'Implied value' }), el('span', { class: 'sub', text: DATA.model_version + ' · every row, same function' })]),
        el('div', { class: 'formula-split' }, [
          el('div', { class: 'formula' }, [
            el('div', { class: 'formula-line', text: 'implied = round(' }),
            term('base', 'tvl_usd × ' + m.base_multiple, 'a launch is priced at what a listed token of the same TVL already trades at'),
            term('growth', '(1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 × ' + m.growth_weight + ')', 'money moving in counts half again as much as the base; one wild week is clamped'),
            term('maturity', '(' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' × ' + m.maturity_range + ')', 'a long run with no token earns up to 1.2×, a new protocol starts at 0.5×'),
            term('chains', '(1 + min(max(chains − 1, 0), ' + m.chain_cap + ') × ' + m.chain_step + ')', 'each chain past the first adds ' + m.chain_step + ', capped at ' + m.chain_cap + ' extras'),
            el('div', { class: 'formula-line', text: ')' }),
          ]),
          el('aside', { class: 'anchor' }, [
            el('span', { class: 'anchor-label', text: 'Where the base comes from' }),
            el('b', { class: 'num', text: liveMedian === null ? 'n/a' : liveMedian.toFixed(3) + '×' }),
            el('span', { class: 'sub', text: 'median market cap over TVL, across the ' + DATA.live_token_count + ' protocols here that record both and are not exchanges (0.214× with the nine exchange tokens counted)' }),
            el('p', { text: 'The base is 0.25×, rounded from that median: the price of a listed token at the same TVL. The corrections move each row around it, and the board lands at a median ' + (boardMedian === null ? 'n/a' : boardMedian.toFixed(2) + '×') + ' of TVL, below the listed market on purpose: a launch is a claim on a future listing, not a listing.' }),
          ]),
        ]),
        el('p', { class: 'foot', text: 'An age the snapshot does not record uses ' + m.unknown_age_days + ' days: a neutral guess, never a zero. Four years is the maturity cap because the snapshot\'s 95th-percentile age sits there.' }),
      ]),
      el('div', { class: 'method-grid' }, [
        waterfall(example, { brief: true, title: 'A worked example', sub: 'rank 1, ' + example.name, foot: false }),
        el('section', { class: 'card' }, [
          el('div', { class: 'card-head' }, [el('h2', { text: 'What it does not do' })]),
          el('ul', { class: 'notes' }, [
            el('li', { text: 'It names no protocol: the same function scores a $5M vault and a $2.7B curator, on the snapshot\'s own fields.' }),
            el('li', { text: 'It predicts no price, date or launch. It answers one question — if this protocol issued a token against today\'s record, what would it be worth — and the board is that answer sorted.' }),
            el('li', { text: 'It does not rank a protocol whose token already trades: the ' + DATA.live_size + ' largest sit in the Live token tab, as the comparison the pre-token rows are priced against.' }),
            el('li', { text: 'It does not claim a token exists where a record is silent: every row says the protocol records no token, which is the index\'s word, not proof none was ever issued.' }),
          ]),
        ]),
      ]),
      el('p', { class: 'coverage-line', text: 'Coverage: ' + DATA.watchlist_size + ' watchlist protocols, all ranked, plus ' + DATA.early_size + ' pre-token protocols below the $' + Math.round(DATA.floor_usd / 1e6) + 'M floor — ' + DATA.board_size + ' rows. The ' + DATA.live_size + ' largest protocols whose token already trades are set aside with their token, as the comparison these rows are priced against.' }),
    ]);
  }

  // render

  function render() {
    var focused = document.activeElement && document.activeElement.id === 'q';
    app.textContent = '';
    var shell = el('div', { class: 'shell' }, [header()]);
    if (state.selected) shell.appendChild(protocolPage(state.selected));
    else if (state.view === 'method') shell.appendChild(methodPage());
    else shell.appendChild(boardPage());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (focused) {
      var box = document.getElementById('q');
      if (box) {
        box.focus();
        var at = box.value.length;
        try { box.setSelectionRange(at, at); } catch (e) { /* not a text field */ }
      }
    }
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () {
    state.selected = null;
    state.view = 'board';
    readHash();
    render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected) go('board');
  });
})();
