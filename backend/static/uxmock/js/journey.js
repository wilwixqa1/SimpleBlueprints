// ============================================================
// SBP MOCK JOURNEY -- three acts, one canvas, a title block that
// fills itself in as the drawing set comes into existence.
// ============================================================
(function () {
  var S = {
    act: 1,
    address: '', parcel: null,
    lot: null, setbacks: { front: 25, side: 5, rear: 15 },
    house: null, north: 0, street: 'Street', jurisdiction: '',
    deck: { off: 14, w: 16, d: 12, h: 36 },
    zones: [], stairs: [],
    snow: 30, frost: 36,
    finish: { decking: 'PT pine', railing: 'Wood baluster' },
    corners: { FL: 0, FR: 0 },
    view: 'deck'
  };

  var $ = function (id) { return document.getElementById(id); };
  var rail = $('rail');
  function hud() { return $('canvas-hud'); }

  // ---------- helpers ----------
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function toast(msg) {
    var t = el('<div class="toast">' + msg + '</div>');
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function tb(id, val, filled) {
    var n = $(id); n.textContent = val;
    n.className = 'tb-val ' + (filled ? 'filled' : 'empty');
  }
  function updateTitleblock() {
    tb('tb-address', S.address ? S.address : '— pending lookup —', !!S.address);
    tb('tb-parcel', S.parcel ? (S.parcel.parcelId + ' · ' + (S.parcel.zoning || '').split(' ')[0]) : '—', !!S.parcel);
    var dk = S.act >= 2 ? (S.deck.w + "' × " + S.deck.d + "' · " + S.deck.h + '" HIGH' + (S.zones.length ? ' · ' + S.zones.length + ' WING' + (S.zones.length > 1 ? 'S' : '') : '')) : '—';
    tb('tb-deck', dk, S.act >= 2);
    tb('tb-set', (S.act >= 3 ? '8 OF 8 SHEETS · PREVIEW' : S.act === 2 ? 'DRAFTING…' : '0 OF 8 SHEETS'), S.act >= 3);
  }
  function setActNav() {
    [1, 2, 3].forEach(function (i) {
      var b = $('nav-act' + i);
      b.classList.toggle('active', S.act === i);
      b.classList.toggle('done', S.act > i);
      b.disabled = i > S.act && !(i === 2 && S.lot) && !(i === 3 && S.act >= 2);
    });
  }
  function go(act) { S.act = act; setActNav(); updateTitleblock(); renderAct(); }
  [1, 2, 3].forEach(function (i) {
    $('nav-act' + i).addEventListener('click', function () { if (!this.disabled) go(i); });
  });

  // ---------- ACT I: your property ----------
  function renderAct1() {
    restoreStage();
    SBPCanvas.setMode('confirm');
    hud().innerHTML = '';
    if (!S.lot) {
      rail.innerHTML = '';
      rail.appendChild(el(
        '<div class="card">' +
        '<h3>Find your property</h3>' +
        '<div class="field"><span class="tb-label">Project address</span>' +
        '<input id="addr-in" type="text" placeholder="4739 Sweetgrass Ln, Colorado Springs, CO" value="' + (S.address || '') + '"></div>' +
        '<div style="margin-top:10px;display:flex;gap:8px">' +
        '<button class="btn primary" id="addr-go" style="flex:1;justify-content:center">Find my lot</button></div>' +
        '<p style="font-size:11.5px;color:var(--mut);margin-top:10px">We search public parcel records for your lot lines, setbacks, and house footprint. Nothing is submitted anywhere.</p>' +
        '</div>'));
      rail.appendChild(el(
        '<div class="card"><h3>Other ways in</h3>' +
        '<button class="opt-row" id="alt-survey">' +
        '<span class="or-head"><span class="or-title">Upload a survey</span><span class="or-tag">BEST OPTION IF YOU HAVE ONE</span></span>' +
        '<span class="or-desc">Your property survey is the most accurate source there is. Our AI reads the lot lines, dimensions, house, and north arrow off the page \u2014 you just confirm.</span></button>' +
        '<button class="opt-row" id="alt-manual">' +
        '<span class="or-head"><span class="or-title">Draw my lot manually</span><span class="or-tag">LAST RESORT</span></span>' +
        '<span class="or-desc">Use this only if the address lookup can\u2019t find your parcel and you don\u2019t have a survey. You\u2019ll sketch the lot and place the house yourself.</span></button>' +
        '<p style="font-size:11.5px;color:var(--mut);margin-top:10px">Whichever way in, you confirm everything on the canvas before designing.</p></div>'));
      $('addr-go').addEventListener('click', function () { lookup($('addr-in').value || '4739 Sweetgrass Ln, Colorado Springs, CO'); });
      $('addr-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('addr-go').click(); });
      $('alt-survey').addEventListener('click', surveyFlow);
      $('alt-manual').addEventListener('click', manualFlow);
    } else {
      renderConfirmRail();
    }
    SBPCanvas.setState(S.lot ? S : Object.assign({}, S, { lot: null }));
  }

  function lookupStatus(rows) {
    rail.innerHTML = '';
    var card = el('<div class="card"><h3>Reading public records</h3><div class="lookup-status" id="ls"></div></div>');
    rail.appendChild(card);
    var ls = $('ls');
    rows.forEach(function (r) {
      ls.appendChild(el('<div class="ls-row" id="ls-' + r.id + '"><span class="ls-dot"></span><span>' + r.label + '</span></div>'));
    });
  }
  function lsMark(id, cls) { var n = $('ls-' + id); if (n) n.className = 'ls-row ' + cls; }

  function lookup(address) {
    S.address = address;
    updateTitleblock();
    lookupStatus([
      { id: 'parcel', label: 'Parcel records — lot shape + dimensions' },
      { id: 'zoning', label: 'Zoning — setback requirements' },
      { id: 'house', label: 'House footprint — mapping data' },
      { id: 'street', label: 'Street edge — orientation check' }
    ]);
    lsMark('parcel', 'doing');
    fetch('/api/mock/parcel?address=' + encodeURIComponent(address))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        lsMark('parcel', 'done'); lsMark('zoning', 'doing');
        setTimeout(function () {
          lsMark('zoning', 'done'); lsMark('house', 'doing');
          setTimeout(function () {
            lsMark('house', 'done'); lsMark('street', 'doing');
            setTimeout(function () {
              lsMark('street', 'done');
              applyParcel(d);
            }, 500);
          }, 650);
        }, 500);
      });
  }
  function applyParcel(d) {
    S.parcel = d;
    S._sbOrig = Object.assign({}, d.setbacks);
    S.lot = d.lotVertices; S.setbacks = d.setbacks; S.house = d.house;
    S.north = d.northAngle; S.street = d.street || 'Street'; S.jurisdiction = d.jurisdiction;
    S.address = d.address;
    S.deck.off = Math.round((S.house.w - S.deck.w) / 2);
    updateTitleblock();
    SBPCanvas.setState(S);
    if (d.demo_note) toast(d.demo_note);
    else if (d.real_note) toast(d.real_note);
    renderConfirmRail(d);
  }
  function renderConfirmRail(d) {
    hud().innerHTML = '';
    hud().appendChild(el('<div class="hud-note">Found it. Confirm the house position and north arrow — drag either on the canvas.</div>'));
    rail.innerHTML = '';
    var conf = (d && d.confidence) || { lot: 'high', house: 'high', street: 'verified' };
    rail.appendChild(el(
      '<div class="card"><h3>Is this your property? <span class="stamp-ok">RECORDS FOUND</span></h3>' +
      '<div class="spec-rows">' +
      '<div class="spec-row"><span class="sr-k">Address</span><span class="sr-v">' + S.address.split(',')[0] + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Parcel</span><span class="sr-v">' + (S.parcel ? S.parcel.parcelId : '—') + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Lot area</span><span class="sr-v">' + (S.parcel ? S.parcel.lotArea.toLocaleString() : '—') + ' SF</span></div>' +
      '<div class="spec-row"><span class="sr-k">Zoning</span><span class="sr-v">' + (S.parcel ? S.parcel.zoning.split(' ')[0] : '—') + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Lot boundary</span><span class="sr-v" style="color:var(--ok)">' + conf.lot.toUpperCase() + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">House footprint</span><span class="sr-v" style="color:' + (conf.house === 'approximate' ? 'var(--mut)' : 'var(--ok)') + '">' + conf.house.toUpperCase() + (conf.house === 'approximate' ? ' \u2014 DRAG TO FIX' : '') + '</span></div>' +
      '</div>' +
      '<button class="btn quiet" id="re-search" style="width:100%;justify-content:center;margin-top:12px">Wrong address? Search again</button></div>'));
    rail.appendChild(el(
      '<div class="card"><h3>Setbacks (from zoning)</h3>' +
      sbSlider('front', 'Front', S.setbacks.front) + sbSlider('side', 'Sides', S.setbacks.side) + sbSlider('rear', 'Rear', S.setbacks.rear) +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px">' +
      '<p style="font-size:11.5px;color:var(--mut);margin:0">Pulled from your zoning district. Adjust if your jurisdiction told you otherwise.</p>' +
      '<button class="btn quiet" id="sb-reset" style="white-space:nowrap">Reset to lookup</button></div></div>'));
    var goCard = el(
      '<div class="card"><button class="btn primary" id="confirm-go" style="width:100%;justify-content:center">That\u2019s my house — design my deck</button>' +
      '<p style="font-size:11.5px;color:var(--mut);margin-top:8px;text-align:center">You can come back and adjust any of this later.</p></div>');
    rail.appendChild(goCard);
    ['front', 'side', 'rear'].forEach(function (k) {
      $('sb-' + k).addEventListener('input', function () {
        S.setbacks[k] = +this.value; $('sb-' + k + '-o').value = this.value + "'";
        SBPCanvas.render();
      });
    });
    $('sb-reset').addEventListener('click', function () {
      if (!S._sbOrig) return;
      S.setbacks = Object.assign({}, S._sbOrig);
      [['front', 'front'], ['side', 'side'], ['rear', 'rear']].forEach(function (pair) {
        var inp = $('sb-' + pair[0]); if (inp) { inp.value = S.setbacks[pair[1]]; $('sb-' + pair[0] + '-o').value = S.setbacks[pair[1]] + "'"; }
      });
      SBPCanvas.render();
      toast('Setbacks reset to the lookup values.');
    });
    $('re-search').addEventListener('click', function () {
      // keep the typed address for editing; clear everything derived from it
      S.parcel = null; S.lot = null; S.house = null; S.north = 0; S._sbOrig = null;
      S.setbacks = { front: 25, side: 5, rear: 15 };
      S.zones = []; S.stairs = []; S._chat = null;
      S.deck = { off: 14, w: 16, d: 12, h: 36 };
      S.corners = { FL: 0, FR: 0 };
      updateTitleblock(); setActNav();
      renderAct1();
      toast('Cleared. Search a different address or pick another way in.');
    });
    $('confirm-go').addEventListener('click', function () { go(2); });
  }
  function sbSlider(id, label, val) {
    return '<div class="slider-row"><label for="sb-' + id + '">' + label + '</label>' +
      '<input type="range" id="sb-' + id + '" min="0" max="50" value="' + val + '">' +
      '<output id="sb-' + id + '-o">' + val + "'</output></div>";
  }

  function surveyFlow() {
    lookupStatus([
      { id: 'up', label: 'Survey received (mock upload)' },
      { id: 'ai', label: 'AI reading lot lines, dimensions, house' },
      { id: 'north', label: 'Reading compass rose' }
    ]);
    lsMark('up', 'done'); lsMark('ai', 'doing');
    fetch('/api/mock/extract').then(function (r) { return r.json(); }).then(function (d) {
      lsMark('ai', 'done'); lsMark('north', 'doing');
      setTimeout(function () {
        lsMark('north', 'done');
        S.address = S.address || d.address;
        applyParcel(d);
        toast('Survey read. North angle is low-confidence — check the dial.');
      }, 600);
    });
  }
  function manualFlow() {
    var d = SBPSheets.demoState();
    S.address = S.address || 'My project';
    applyParcel({ address: S.address, parcelId: 'MANUAL', zoning: 'Manual entry', lotArea: 9480, lotVertices: d.lot, setbacks: d.setbacks, house: d.house, northAngle: 0, jurisdiction: '' });
    toast('Manual mode: drag the house, set setbacks, adjust the dial.');
  }

  // ---------- ACT II: your deck ----------
  function renderAct2() {
    restoreStage();
    SBPCanvas.setMode('design');
    hud().innerHTML = '';
    var hudMsg = S.view === 'site' ? 'Site view: drag the deck to place it on your lot. Setback conflicts show in red.'
      : S.view === 'axon' ? '3D view: use the sliders or switch to Deck view to edit.'
      : 'Drag the green handles to resize. Drag stairs along their edge. Click + to add a zone.';
    hud().appendChild(el('<div class="hud-note" id="viol-note">' + hudMsg + '</div>'));
    hud().appendChild(el('<div class="view-toggle"><button id="vt-deck" class="' + (S.view === 'deck' ? 'on' : '') + '">Deck</button><button id="vt-site" class="' + (S.view === 'site' ? 'on' : '') + '">Site</button><button id="vt-axon" class="' + (S.view === 'axon' ? 'on' : '') + '">3D</button></div>'));
    $('vt-deck').addEventListener('click', function () { S.view = 'deck'; renderAct2(); });
    $('vt-site').addEventListener('click', function () { S.view = 'site'; renderAct2(); });
    $('vt-axon').addEventListener('click', function () { S.view = 'axon'; renderAct2(); });

    rail.innerHTML = '';
    // deck dims
    rail.appendChild(el(
      '<div class="card"><h3>Your deck</h3>' +
      dSlider('w', 'Width', S.deck.w, 6, 32, "'") + dSlider('d', 'Depth', S.deck.d, 6, 20, "'") + dSlider('h', 'Height', S.deck.h, 12, 96, '"') +
      '<div class="chips" style="margin-top:10px">' +
      '<button class="chip' + (hasZone('left') ? ' on' : '') + '" id="z-left">+ Left wing</button>' +
      '<button class="chip' + (hasZone('right') ? ' on' : '') + '" id="z-right">+ Right wing</button>' +
      '</div>' +
      '<div class="tb-label" style="margin-top:12px">Stairs \u2014 any edge, any wing</div>' +
      '<div class="chips" style="margin-top:6px">' +
      ['front', 'left', 'right'].map(function (e) {
        return '<button class="chip' + (hasStair(e) ? ' on' : '') + '" data-stair-edge="' + e + '">' + (e === 'front' ? 'Outer' : e.charAt(0).toUpperCase() + e.slice(1)) + '</button>';
      }).join('') +
      S.zones.map(function (z, i) {
        return '<button class="chip' + (hasZoneStair(i) ? ' on' : '') + '" data-stair-zone="' + i + '">Wing ' + (i + 1) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="tb-label" style="margin-top:12px">Corner modifiers \u2014 45\u00b0 chamfers</div>' +
      [['FL', 'Outer left'], ['FR', 'Outer right']].map(function (cn) {
        var on = (S.corners[cn[0]] || 0) > 0;
        return '<div class="slider-row"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-corner="' + cn[0] + '"' + (on ? ' checked' : '') + '> ' + cn[1] + '</label>' +
          '<input type="range" data-cornersize="' + cn[0] + '" min="2" max="8" value="' + (S.corners[cn[0]] || 3) + '"' + (on ? '' : ' disabled') + '>' +
          '<output>' + (on ? (S.corners[cn[0]] + "'") : '\u2014') + '</output></div>';
      }).join('') +
      '</div>'));
    // per-zone dimensions
    if (S.zones.length) {
      rail.appendChild(el(
        '<div class="card"><h3>Zones</h3>' +
        S.zones.map(function (z, i) {
          return '<div class="tb-label" style="margin-top:' + (i ? '10px' : '0') + '">Zone ' + (i + 1) + ' \u00b7 ' + z.edge + '</div>' +
            '<div class="slider-row"><label>Width</label><input type="range" data-zw="' + i + '" min="4" max="16" value="' + z.w + '"><output id="zw-o-' + i + '">' + z.w + "'</output></div>" +
            '<div class="slider-row"><label>Depth</label><input type="range" data-zd="' + i + '" min="4" max="16" value="' + z.d + '"><output id="zd-o-' + i + '">' + z.d + "'</output></div>";
        }).join('') + '</div>'));
    }
    // site conditions
    rail.appendChild(el(
      '<div class="card"><h3>Site conditions</h3>' +
      '<div class="slider-row"><label>Snow load</label><select id="cond-snow" style="grid-column:2/4;border:1px solid var(--ruling);border-radius:3px;padding:7px;font-family:var(--mono);font-size:12px;background:var(--paper)">' +
      opt(30, '30 psf — typical', S.snow) + opt(50, '50 psf — heavy snow', S.snow) + opt(70, '70 psf — mountain', S.snow) + '</select></div>' +
      '<div class="slider-row"><label>Frost depth</label><select id="cond-frost" style="grid-column:2/4;border:1px solid var(--ruling);border-radius:3px;padding:7px;font-family:var(--mono);font-size:12px;background:var(--paper)">' +
      opt(24, '24 in', S.frost) + opt(36, '36 in — typical', S.frost) + opt(48, '48 in — cold climate', S.frost) + '</select></div>' +
      '<p style="font-size:11.5px;color:var(--mut);margin-top:4px">The only two questions the code needs from you. Everything else is calculated.</p></div>'));
    // finishes
    rail.appendChild(el(
      '<div class="card"><h3>Finishes</h3>' +
      '<div class="slider-row"><label>Decking</label><select id="fin-deck" style="grid-column:2/4;border:1px solid var(--ruling);border-radius:3px;padding:7px;font-family:var(--mono);font-size:12px;background:var(--paper)">' +
      fopt('PT pine', S.finish.decking) + fopt('Cedar', S.finish.decking) + fopt('Composite', S.finish.decking) + '</select></div>' +
      '<div class="slider-row"><label>Railing</label><select id="fin-rail" style="grid-column:2/4;border:1px solid var(--ruling);border-radius:3px;padding:7px;font-family:var(--mono);font-size:12px;background:var(--paper)">' +
      fopt('Wood baluster', S.finish.railing) + fopt('Metal baluster', S.finish.railing) + fopt('Cable', S.finish.railing) + '</select></div>' +
      '<p style="font-size:11.5px;color:var(--mut);margin-top:4px">Cosmetic \u2014 shown on the cover sheet and materials list. Structure is unaffected.</p></div>'));
    // live spec
    rail.appendChild(el('<div class="card"><h3>Structure <span class="stamp-ok" id="spec-stamp">SIZED TO IRC 2021</span></h3><div class="spec-rows" id="spec-rows"></div></div>'));
    // AI helper (history persists in S._chat across re-renders)
    if (!S._chat) S._chat = [{ who: 'bot', html: 'I can change the design for you — try \u201cmake it 18 by 14\u201d, \u201cadd stairs\u201d, or ask why a beam got bigger.' }];
    rail.appendChild(el(
      '<div class="card"><h3>Ask the drafter</h3><div class="ai-log" id="ai-log">' +
      S._chat.map(function (m) { return '<div class="ai-msg ' + m.who + '">' + m.html + '</div>'; }).join('') +
      '</div><div class="ai-input"><input id="ai-in" type="text" placeholder="e.g. make it 18x14 with a left wing"><button class="btn quiet" id="ai-go">Send</button></div></div>'));
    // continue
    rail.appendChild(el('<div class="card"><button class="btn primary" id="to-plans" style="width:100%;justify-content:center">Preview my drawing set</button></div>'));

    ['w', 'd', 'h'].forEach(function (k) {
      $('dk-' + k).addEventListener('input', function () {
        S.deck[k] = +this.value;
        $('dk-' + k + '-o').value = this.value + (k === 'h' ? '"' : "'");
        onDesignChange('slider');
      });
    });
    $('z-left').addEventListener('click', function () { toggleZone('left'); });
    $('z-right').addEventListener('click', function () { toggleZone('right'); });
    rail.querySelectorAll('[data-stair-edge]').forEach(function (b) {
      b.addEventListener('click', function () { toggleStair(b.getAttribute('data-stair-edge')); });
    });
    rail.querySelectorAll('[data-stair-zone]').forEach(function (b) {
      b.addEventListener('click', function () { toggleZoneStair(+b.getAttribute('data-stair-zone')); });
    });
    $('fin-deck').addEventListener('change', function () { S.finish.decking = this.value; });
    $('fin-rail').addEventListener('change', function () { S.finish.railing = this.value; });
    rail.querySelectorAll('[data-corner]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var k = cb.getAttribute('data-corner');
        S.corners[k] = cb.checked ? (S.corners[k] > 0 ? S.corners[k] : 3) : 0;
        renderAct2();
      });
    });
    rail.querySelectorAll('[data-cornersize]').forEach(function (r) {
      r.addEventListener('input', function () {
        var k = r.getAttribute('data-cornersize');
        if (S.corners[k] > 0) { S.corners[k] = +r.value; r.parentNode.querySelector('output').textContent = r.value + "'"; onDesignChange(); }
      });
    });
    rail.querySelectorAll('[data-zw]').forEach(function (r) {
      r.addEventListener('input', function () {
        var i = +r.getAttribute('data-zw'); S.zones[i].w = +r.value;
        $('zw-o-' + i).textContent = r.value + "'"; onDesignChange();
      });
    });
    rail.querySelectorAll('[data-zd]').forEach(function (r) {
      r.addEventListener('input', function () {
        var i = +r.getAttribute('data-zd'); S.zones[i].d = +r.value;
        $('zd-o-' + i).textContent = r.value + "'"; onDesignChange();
      });
    });
    $('cond-snow').addEventListener('change', function () { S.snow = +this.value; onDesignChange(); });
    $('cond-frost').addEventListener('change', function () { S.frost = +this.value; onDesignChange(); });
    $('ai-go').addEventListener('click', aiSend);
    $('ai-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') aiSend(); });
    $('to-plans').addEventListener('click', function () { go(3); });

    SBPCanvas.setState(S);
    refreshSpec();
    updateTitleblock();
  }
  function dSlider(k, label, val, min, max, unit) {
    return '<div class="slider-row"><label for="dk-' + k + '">' + label + '</label>' +
      '<input type="range" id="dk-' + k + '" min="' + min + '" max="' + max + '" value="' + val + '">' +
      '<output id="dk-' + k + '-o">' + val + unit + '</output></div>';
  }
  function opt(v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; }
  function fopt(v, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + v + '</option>'; }
  function hasZone(edge) { return S.zones.some(function (z) { return z.edge === edge; }); }
  function hasStair(edge) {
    if (edge == null) return S.stairs.length > 0;
    return S.stairs.some(function (st) { return st.edge === edge && st.zone == null; });
  }
  function hasZoneStair(i) { return S.stairs.some(function (st) { return st.zone === i; }); }
  function toggleZone(edge) {
    if (hasZone(edge)) {
      var idx = S.zones.findIndex(function (z) { return z.edge === edge; });
      S.zones = S.zones.filter(function (z) { return z.edge !== edge; });
      S.stairs = S.stairs.filter(function (st) { return st.zone == null; }).concat(
        S.stairs.filter(function (st) { return st.zone != null && st.zone !== idx; })
          .map(function (st) { return { zone: st.zone > idx ? st.zone - 1 : st.zone }; }));
    }
    else if (S.zones.length >= 3) { toast('Wing limit: 3 (matches the production zone cap).'); return; }
    else S.zones.push({ edge: edge, w: 8, d: 8 });
    renderAct2();
  }
  function toggleStair(edge) {
    if (hasStair(edge)) S.stairs = S.stairs.filter(function (st) { return !(st.edge === edge && st.zone == null); });
    else S.stairs.push({ edge: edge });
    renderAct2();
  }
  function toggleZoneStair(i) {
    if (hasZoneStair(i)) S.stairs = S.stairs.filter(function (st) { return st.zone !== i; });
    else S.stairs.push({ zone: i });
    renderAct2();
  }

  function onDesignChange(src) {
    if (typeof src === 'string' && src.indexOf('addzone-') === 0) {
      toggleZone(src.slice(8));
      return;
    }
    SBPCanvas.setState(S);
    refreshSpec();
    updateTitleblock();
  }
  window.addEventListener('sbp-canvas-change', onDesignChange);

  var specTimer = null, specSeq = 0;
  function specRowsHTML(rows, area, engine) {
    return rows.map(function (r) {
      return '<div class="spec-row"><span class="sr-k">' + r.k + '</span><span class="sr-v">' + r.v + '<span class="sr-cite">' + r.cite + '</span></span></div>';
    }).join('') + '<div class="spec-row"><span class="sr-k">Area (main)</span><span class="sr-v">' + area + ' SF</span></div>' +
      '<div class="spec-row"><span class="sr-k">Engine</span><span class="sr-v" style="color:' + (engine ? 'var(--ok)' : 'var(--mut)') + '">' + (engine || 'estimating\u2026') + '</span></div>';
  }
  function fetchRealSpec() {
    var seq = ++specSeq;
    fetch('/api/mock/spec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (seq !== specSeq || S.act !== 2) return;
        var rows = $('spec-rows'); if (!rows) return;
        rows.innerHTML = specRowsHTML(d.rows, d.area, 'calculate_structure()');
      })
      .catch(function () { /* local estimate stays up */ });
  }
  function refreshSpec() {
    var rows = $('spec-rows'); if (!rows) return;
    var spec = SBPSpec.compute(S);
    rows.innerHTML = specRowsHTML(spec.rows, spec.area, null);
    if (S.lot) { clearTimeout(specTimer); specTimer = setTimeout(fetchRealSpec, 350); }
    // violation note
    var v = window.SBPCanvas_violations();
    var stamp = $('spec-stamp'), note = $('viol-note');
    if (v.length) {
      stamp.className = 'stamp-warn'; stamp.textContent = 'SETBACK CONFLICT';
      if (note) { note.textContent = 'Part of the deck crosses the setback line. Shrink it, move it, or adjust setbacks in Act I.'; note.style.color = 'var(--warn)'; }
    } else {
      stamp.className = 'stamp-ok'; stamp.textContent = 'SIZED TO IRC 2021';
      if (note) { note.textContent = 'Drag the deck to move it. Drag the square handles to resize. Structure re-sizes itself as you go.'; note.style.color = 'var(--mut)'; }
    }
  }

  // ---------- AI helper (mocked, but its actions are real) ----------
  function aiSend() {
    var inp = $('ai-in'), q = inp.value.trim();
    if (!q) return;
    inp.value = '';
    var log = $('ai-log');
    S._chat.push({ who: 'user', html: escapeHtml(q) });
    log.appendChild(el('<div class="ai-msg user">' + escapeHtml(q) + '</div>'));
    var res = aiHandle(q.toLowerCase());
    setTimeout(function () {
      var botHtml = res.text + (res.act ? '<span class="ai-act">ACTION: ' + res.act + '</span>' : '');
      S._chat.push({ who: 'bot', html: botHtml });
      if (res.changed) { renderAct2(); }
      else { log.appendChild(el('<div class="ai-msg bot">' + botHtml + '</div>')); }
      var l2 = $('ai-log'); if (l2) l2.scrollTop = l2.scrollHeight;
    }, 350);
    log.scrollTop = log.scrollHeight;
  }
  function aiHandle(q) {
    var m = q.match(/(\d{1,2})\s*(?:x|by)\s*(\d{1,2})/);
    if (m) {
      S.deck.w = Math.min(32, +m[1]); S.deck.d = Math.min(20, +m[2]);
      var extra = '';
      if (/wing|zone|l.?shape/.test(q) && S.zones.length < 3) { S.zones.push({ edge: /right/.test(q) ? 'right' : 'left', w: 8, d: 8 }); extra = ' + wing'; }
      if (/stair/.test(q) && !hasStair()) { S.stairs = [{ edge: 'front' }]; extra += ' + stairs'; }
      return { changed: true, text: 'Done — deck set to ' + S.deck.w + "' × " + S.deck.d + "'" + (extra ? ', ' + extra.replace(/^\s\+\s/, 'added ') : '') + '. Structure has been re-sized below.', act: 'setSize(' + S.deck.w + ',' + S.deck.d + ')' + extra };
    }
    if (/remove (all )?stairs/.test(q)) { S.stairs = []; return { changed: true, text: 'All stairs removed.', act: 'removeStairs()' }; }
    if (/stair/.test(q)) {
      var wingM = q.match(/wing\s*(\d)/) || (/left wing/.test(q) ? [0, findWing('left')] : null) || (/right wing/.test(q) ? [0, findWing('right')] : null);
      if (wingM && wingM[1] != null && wingM[1] !== -1) {
        var wi = typeof wingM[1] === 'number' ? wingM[1] : (+wingM[1] - 1);
        if (wi < 0 || wi >= S.zones.length) return { changed: false, text: 'That wing doesn\u2019t exist yet \u2014 add it first.' };
        if (hasZoneStair(wi)) return { changed: false, text: 'Wing ' + (wi + 1) + ' already has stairs.' };
        S.stairs.push({ zone: wi });
        return { changed: true, text: 'Added stairs on wing ' + (wi + 1) + '\u2019s outer edge.', act: 'addStair(wing ' + (wi + 1) + ')' };
      }
      var edge = /left/.test(q) ? 'left' : /right/.test(q) ? 'right' : 'front';
      if (hasStair(edge)) return { changed: false, text: 'There are already stairs on that edge \u2014 you can have one set per edge plus one per wing.' };
      S.stairs.push({ edge: edge });
      return { changed: true, text: 'Added stairs on the ' + (edge === 'front' ? 'outer' : edge) + ' edge. At ' + S.deck.h + '" high that\u2019s ' + Math.max(3, Math.round(S.deck.h / 7.5)) + ' risers.', act: 'addStair(' + edge + ')' };
    }
    if (/wing|zone/.test(q)) {
      if (S.zones.length >= 3) return { changed: false, text: 'You\u2019re at the 3-wing limit — same cap as production. Remove one first.' };
      var edge = /right/.test(q) ? 'right' : 'left';
      S.zones.push({ edge: edge, w: 8, d: 8 });
      return { changed: true, text: 'Added an 8×8 ' + edge + ' wing. The framing plan will show it as a separate joist field.', act: 'addZone(' + edge + ')' };
    }
    if (/height\s*(\d+)/.test(q)) {
      S.deck.h = Math.min(96, +q.match(/height\s*(\d+)/)[1]);
      return { changed: true, text: 'Height set to ' + S.deck.h + '". ' + (S.deck.h >= 30 ? 'That\u2019s over 30", so guards are required (IRC R312.1) — they\u2019re on your elevations.' : 'Under 30", so no guard requirement.'), act: 'setParam(height,' + S.deck.h + ')' };
    }
    if (/beam|why/.test(q)) {
      var spec = SBPSpec.compute(S);
      return { changed: false, text: 'At ' + S.deck.d + "' deep with " + S.snow + ' psf snow, the joist span drives the beam to ' + spec.rows[1].v + ' per ' + spec.rows[1].cite + '. Shorten the depth or add a mid-beam to bring it down.' };
    }
    if (/permit|approve/.test(q)) {
      return { changed: false, text: 'Your set will include everything ' + (S.jurisdiction || 'your building department') + ' typically asks for: site plan with setbacks, plan + framing, elevations, details, and notes. The department always has final say.' };
    }
    return { changed: false, text: 'I can set sizes (\u201c18 by 14\u201d), add wings or stairs, set the height, or explain any structural callout. What would you like?' };
  }
  function findWing(edge) { return S.zones.findIndex(function (z) { return z.edge === edge; }); }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- ACT III: your plans ----------
  var stageHTML = null;
  function restoreStage() {
    if (stageHTML !== null) {
      var sc = $('stage-canvas');
      sc.innerHTML = stageHTML; stageHTML = null;
      SBPCanvas.init($('stage-svg'), S, function (a) { onDesignChange(a); });
    }
  }
  function renderAct3() {
    var sc = $('stage-canvas');
    if (stageHTML === null) stageHTML = sc.innerHTML;
    var stFull = fullState();
    // instant placeholders: local SVG facsimiles, swapped for real renders below
    S._display = SBPSheets.sheetList().map(function (sh) {
      return { no: sh.no, name: sh.name, svg: SBPSheets.render(sh.id, stFull) };
    });
    drawPreviewGrid(sc, 'DRAWING YOUR SET THROUGH THE REAL PIPELINE\u2026');
    fetchRealSheets(sc);

    rail.innerHTML = '';
    var spec = SBPSpec.compute(S);
    rail.appendChild(el(
      '<div class="card"><h3>Your drawing set <span class="stamp-ok">DRAWN FROM YOUR DESIGN</span></h3>' +
      '<p style="font-size:13px;color:#454d3f">Instant previews appear first; within a few seconds each sheet is re-rendered by the same production pipeline that generates the final PDF. Click any sheet to inspect it. Revise anything in Act II and the set redraws.</p></div>'));
    rail.appendChild(el(
      '<div class="card"><h3>Summary</h3><div class="spec-rows">' +
      '<div class="spec-row"><span class="sr-k">Deck</span><span class="sr-v">' + S.deck.w + "' × " + S.deck.d + "' · " + S.deck.h + '" HIGH</span></div>' +
      '<div class="spec-row"><span class="sr-k">Total area</span><span class="sr-v">' + spec.area + ' SF</span></div>' +
      '<div class="spec-row"><span class="sr-k">Structure</span><span class="sr-v">' + spec.rows[0].v + ' / ' + spec.rows[1].v + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Finishes</span><span class="sr-v">' + S.finish.decking + ' / ' + S.finish.railing + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Stairs</span><span class="sr-v">' + (S.stairs.length || 'None') + (S.stairs.length ? ' SET' + (S.stairs.length > 1 ? 'S' : '') : '') + '</span></div>' +
      '<div class="spec-row"><span class="sr-k">Jurisdiction</span><span class="sr-v">' + (S.jurisdiction ? S.jurisdiction.replace('Regional Building Department', 'RBD') : '—') + '</span></div>' +
      '</div></div>'));
    rail.appendChild(el(
      '<div class="card"><h3>Download</h3>' +
      '<div class="spec-rows">' +
      '<div class="spec-row"><span class="sr-k">Standard — full 8-sheet set</span><span class="sr-v">$49</span></div>' +
      '<div class="spec-row"><span class="sr-k">Complete — + cut list &amp; materials</span><span class="sr-v">$79</span></div>' +
      '</div>' +
      '<button class="btn primary" id="buy" style="width:100%;justify-content:center;margin-top:12px">Download plan set</button>' +
      '<p style="font-size:11px;color:var(--mut);margin-top:8px;text-align:center">Free until this button. Revisions after purchase are free too.</p></div>'));
    rail.appendChild(el('<div class="card"><button class="btn ghost" id="back-design" style="width:100%;justify-content:center">Back to designing</button></div>'));
    $('buy').addEventListener('click', function () { toast('Checkout is out of scope for this mock — this is where Stripe goes.'); });
    $('back-design').addEventListener('click', function () { go(2); });
    hudless();
  }
  function hudless() { var h = $('canvas-hud'); if (h) h.innerHTML = ''; }
  function fullState() {
    return Object.assign({}, S, { street: S.street, address: S.address });
  }
  function drawPreviewGrid(sc, note) {
    var grid = '<div class="preview-grid">' + S._display.map(function (d, i) {
      var inner = d.png ? '<img src="data:image/png;base64,' + d.png + '" style="width:100%;display:block" alt="' + d.name + '">' : (d.svg || '<div style="padding:30px;font-family:var(--mono);font-size:11px;color:var(--warn)">RENDER ERROR: ' + (d.error || '') + '</div>');
      return '<div class="pv-sheet" data-idx="' + i + '">' + inner +
        '<div class="st-cap"><b>' + d.no + '</b><span>' + d.name + (d.png ? ' \u00b7 REAL RENDER' : '') + '</span></div></div>';
    }).join('') + '</div>' +
      (note ? '<div style="padding:0 18px 14px;font-family:var(--mono);font-size:10.5px;color:var(--mut)" id="pv-note">' + note + '</div>' : '');
    sc.innerHTML = grid;
    sc.querySelectorAll('.pv-sheet').forEach(function (n) {
      n.addEventListener('click', function () { openLightbox(+n.getAttribute('data-idx')); });
    });
  }
  function buildPayload() {
    return {
      address: S.address, street: S.street, lot: S.lot, setbacks: S.setbacks,
      house: S.house, north: S.north, deck: S.deck, zones: S.zones,
      stairs: S.stairs, snow: S.snow, frost: S.frost, finish: S.finish,
      corners: S.corners
    };
  }
  function fetchRealSheets(sc) {
    var payload = buildPayload();
    fetch('/api/mock/render-sheets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (resp) {
        if (S.act !== 3) return; // navigated away
        S._display = resp.sheets;
        drawPreviewGrid(sc, 'RENDERED BY THE PRODUCTION DRAWING PIPELINE \u00b7 ' + resp.sheets.filter(function (x) { return x.png; }).length + ' SHEETS');
        var tbs = $('tb-set'); if (tbs) { tbs.textContent = resp.sheets.length + ' OF ' + resp.sheets.length + ' SHEETS \u00b7 REAL RENDER'; }
      })
      .catch(function (e) {
        if (S.act !== 3) return;
        var note = $('pv-note'); if (note) note.textContent = 'REAL-PIPELINE RENDER UNAVAILABLE (' + e.message + ') \u00b7 SHOWING LOCAL PREVIEWS';
      });
  }
  function openLightbox(idx) {
    var d = S._display[idx]; if (!d) return;
    var root = $('lightbox-root');
    var inner = d.png ? '<img src="data:image/png;base64,' + d.png + '" style="width:100%;display:block" alt="' + d.name + '">' : (d.svg || '');
    root.innerHTML = '<div class="lightbox" id="lb"><div class="lb-inner">' + inner +
      '<div class="st-cap" style="border-top:1px solid var(--ruling);padding:8px 12px;font-family:var(--mono);font-size:11px;color:var(--mut);display:flex;justify-content:space-between"><b>' + d.no + '</b><span>' + d.name + ' — CLICK ANYWHERE TO CLOSE</span></div></div></div>';
    $('lb').addEventListener('click', function () { root.innerHTML = ''; });
  }

  function renderAct() {
    if (S.act === 1) renderAct1();
    else if (S.act === 2) renderAct2();
    else renderAct3();
  }

  // ---------- boot ----------
  SBPCanvas.init($('stage-svg'), S, function (a) { onDesignChange(a); });
  setActNav(); updateTitleblock(); renderAct();

  // deep links from landing: /app?address=... | ?mode=survey | ?mode=manual
  var qs = new URLSearchParams(location.search);
  if (qs.get('address')) { S.address = qs.get('address'); lookup(S.address); }
  else if (qs.get('mode') === 'survey') surveyFlow();
  else if (qs.get('mode') === 'manual') manualFlow();
})();
