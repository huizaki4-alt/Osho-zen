/* Recent readings: newest 5, dropped after 24 hours. Per page. */
(function (global) {
  var MAX = 5;
  var TTL = 24 * 60 * 60 * 1000;

  function key(page) {
    return 'divination.history.v1.' + page;
  }

  function readRaw(page) {
    try {
      var v = JSON.parse(localStorage.getItem(key(page)) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function write(page, list) {
    localStorage.setItem(key(page), JSON.stringify(list));
  }

  function fresh(list, t) {
    var now = t == null ? Date.now() : t;
    return list.filter(function (r) {
      return r && typeof r.ts === 'number' && (now - r.ts) <= TTL;
    }).sort(function (a, b) {
      return b.ts - a.ts;
    }).slice(0, MAX);
  }

  function load(page, t) {
    var raw = readRaw(page);
    var list = fresh(raw, t);
    if (JSON.stringify(list) !== JSON.stringify(raw)) write(page, list);
    return list;
  }

  function save(page, record, t) {
    var now = t == null ? Date.now() : t;
    if (!record || typeof record !== 'object') return load(page, now);
    if (typeof record.ts !== 'number') record.ts = now;
    var list = readRaw(page).filter(function (r) { return r && r.id !== record.id; });
    list.push(record);
    list = fresh(list, now);
    write(page, list);
    return list;
  }

  function formatLondon(ts) {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(ts));
    var g = {};
    parts.forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    return g.year + '-' + g.month + '-' + g.day + ' ' + g.hour + ':' + g.minute;
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  var pageName = '';
  var onOpen = null;
  var panel = null;
  var openBtn = null;

  function close() {
    if (panel) panel.hidden = true;
    if (openBtn) openBtn.hidden = false;
  }

  function renderList() {
    var list = load(pageName);
    var box = panel.querySelector('.dh-list');
    box.textContent = '';
    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'dh-empty';
      empty.textContent = '這 24 小時內未有記錄';
      box.appendChild(empty);
      return;
    }
    list.forEach(function (rec) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dh-item';
      btn.dataset.id = rec.id || '';

      var top = document.createElement('div');
      top.className = 'dh-top';
      var time = document.createElement('div');
      time.className = 'dh-time';
      time.textContent = formatLondon(rec.ts);
      var mode = document.createElement('div');
      mode.className = 'dh-mode';
      mode.textContent = rec.modeLabel || '';
      top.appendChild(time);
      top.appendChild(mode);
      btn.appendChild(top);

      if (rec.question) {
        var q = document.createElement('div');
        q.className = 'dh-q';
        q.textContent = rec.question;
        btn.appendChild(q);
      }
      if (rec.summary) {
        var sum = document.createElement('div');
        sum.className = 'dh-sum';
        sum.textContent = rec.summary;
        btn.appendChild(sum);
      }
      btn.addEventListener('click', function () {
        var found = load(pageName).filter(function (r) { return r.id === rec.id; })[0];
        close();
        if (found && typeof onOpen === 'function') onOpen(found);
      });
      box.appendChild(btn);
    });
  }

  function open() {
    renderList();
    panel.hidden = false;
    openBtn.hidden = true;
  }

  function ensureUI() {
    if (document.getElementById('dh-open')) return;
    var style = document.createElement('style');
    style.textContent = [
      '#dh-open{position:fixed;top:12px;right:12px;z-index:120;background:rgba(7,6,10,.78);border:1px solid rgba(201,169,110,.6);color:#c9a96e;font-family:"Noto Serif TC",serif;font-size:14px;letter-spacing:4px;padding:9px 16px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}',
      '#dh-open:active{background:rgba(201,169,110,.16);}',
      '#dh-panel{position:fixed;inset:0;z-index:300;background:#07060a;color:#ccc0a8;font-family:"Noto Serif TC",serif;overflow:auto;padding:22px 18px 40px;}',
      '#dh-panel[hidden]{display:none !important;}',
      '.dh-back{background:none;border:none;color:#6b6050;font-family:inherit;font-size:12px;letter-spacing:3px;cursor:pointer;padding:8px 0 12px;}',
      '.dh-title{text-align:center;color:#c9a96e;font-size:22px;letter-spacing:8px;}',
      '.dh-sub{text-align:center;color:#6b6050;font-size:11px;letter-spacing:2px;margin:8px 0 22px;}',
      '.dh-item{display:block;width:100%;text-align:left;background:rgba(201,169,110,.06);border:1px solid #211d2a;color:#ccc0a8;padding:16px 16px 14px;margin:0 0 12px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}',
      '.dh-item:active{border-color:#3d3450;}',
      '.dh-top{display:flex;justify-content:space-between;gap:12px;align-items:baseline;}',
      '.dh-time{font-size:12px;letter-spacing:1px;color:#c9a96e;}',
      '.dh-mode{font-size:12px;letter-spacing:2px;color:#c9a96e;flex-shrink:0;}',
      '.dh-q{margin-top:8px;font-size:15px;line-height:1.5;color:#e8dcc4;}',
      '.dh-sum{margin-top:6px;font-size:13px;line-height:1.6;color:#ccc0a8;}',
      '.dh-empty{text-align:center;color:#6b6050;letter-spacing:2px;margin-top:56px;font-size:13px;}'
    ].join('');
    document.head.appendChild(style);

    openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.id = 'dh-open';
    openBtn.textContent = '記錄';
    openBtn.addEventListener('click', open);
    document.body.appendChild(openBtn);

    panel = document.createElement('div');
    panel.id = 'dh-panel';
    panel.hidden = true;
    panel.innerHTML = '<button type="button" class="dh-back">← 返回</button><div class="dh-title">記錄</div><div class="dh-sub">最近 5 次 · 24 小時內 · 倫敦時間</div><div class="dh-list"></div>';
    panel.querySelector('.dh-back').addEventListener('click', close);
    document.body.appendChild(panel);
  }

  function attach(opts) {
    pageName = opts.page;
    onOpen = opts.reopen || null;
    load(pageName);
    if (document.body) ensureUI();
    else document.addEventListener('DOMContentLoaded', ensureUI);
  }

  global.DivinationHistory = {
    MAX: MAX,
    TTL: TTL,
    key: key,
    load: load,
    save: save,
    formatLondon: formatLondon,
    uid: uid,
    attach: attach,
    close: close,
    open: open
  };
})(window);
