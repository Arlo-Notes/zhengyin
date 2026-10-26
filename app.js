// 正音室网页版：拼音表 / 拼一拼 / 查拼音。装到 iPhone：Chrome 或 Safari 打开 → 分享 → 添加到主屏幕。
import * as P from './pinyin.js';
import * as C from './curriculum.js';
import * as A from './audio.js';

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

const data = { syllables: [], byBase: new Map(), converter: null, converterLoading: null, audioNames: [] };
const ui = {
  blend: { initial: C.INITIALS[0], final: C.FINALS[0], tone: 1 },
  lookup: { text: localStorage.getItem('zy-text') || '', chosen: {}, tokens: [] },
  tableQuery: '',
  sheet: null,      // { kind: 'quiz' | 'settings' | 'readings', ... }
  quiz: { q: null, answered: null, right: 0, total: 0 },
  offline: { cached: 0, total: 0, running: false },
};

// ---------- 小工具 ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  chart: svg('<rect x="3.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="15.5" width="5" height="5" rx="1.2"/>'),
  blend: svg('<rect x="2.5" y="6" width="8" height="12" rx="2.5"/><rect x="13.5" y="6" width="8" height="12" rx="2.5"/><path d="M10.5 12h3"/>'),
  lookup: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 9h5M10.5 7v6.5M8.5 12.5l4-1"/>'),
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  back: svg('<path d="M15 5 8 12l7 7"/>'),
  chevron: svg('<path d="m9 5 7 7-7 7"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
  wave: svg('<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0"/>'),
  speaker: svg('<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  ear: svg('<path d="M7 9a5 5 0 0 1 10 0c0 3-2.5 3.5-3 6s-1.5 4-3.5 4-3-1.5-3-3"/><path d="M10 9a2 2 0 0 1 4 0"/>'),
  mic: svg('<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4"/>'),
  cloud: svg('<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 3.8 3.8 0 0 1 17.5 18z"/><path d="M12 11v5m-2-2 2 2 2-2"/>'),
  home: svg('<path d="M12 4v11M8 8l4-4 4 4"/><rect x="4.5" y="11" width="15" height="9" rx="2.5"/>'),
};

/** 五度标调示意图：一声 55、二声 35、三声 214、四声 51 */
function contour(tone, w = 30, h = 20, sw = 2.5) {
  const p = sw;
  const y = (level) => (p + (5 - level) / 4 * (h - 2 * p)).toFixed(1);
  const x = (f) => (p + f * (w - 2 * p)).toFixed(1);
  const d = {
    1: `M${x(0)} ${y(5)} L${x(1)} ${y(5)}`,
    2: `M${x(0)} ${y(3)} Q${x(0.6)} ${y(3.4)} ${x(1)} ${y(5)}`,
    3: `M${x(0)} ${y(2)} Q${x(0.4)} ${y(0.2)} ${x(1)} ${y(4)}`,
    4: `M${x(0)} ${y(5)} Q${x(0.4)} ${y(4.8)} ${x(1)} ${y(1)}`,
  }[tone];
  const guides = [1, 2, 3, 4, 5].map((l) => `<line x1="0" x2="${w}" y1="${y(l)}" y2="${y(l)}" stroke="var(--faint)" stroke-opacity=".35" stroke-width=".6"/>`).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${guides}<path d="${d}" fill="none" stroke="var(--t${tone})" stroke-width="${sw}" stroke-linecap="round"/></svg>`;
}

function toast(text) {
  $toast.textContent = text;
  $toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $toast.classList.remove('show'), 1400);
}

function secHeader(title, { caption = '', color = 'var(--ink)', count = null, more = '' } = {}) {
  return `<div class="sec-h" style="--c:${color}"><span class="bar"></span><h2>${esc(title)}</h2>` +
    (count != null ? `<span class="count">${count} 个</span>` : '') +
    (caption ? `<span class="cap">${esc(caption)}</span>` : '') + more + '</div>';
}

const toneOf = (s) => P.split(s).tone;
const entry = (syl, tone) => syl?.tones?.[String(tone)] || null;

// ---------- 路由 ----------

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: page || 'chart', arg: arg ? decodeURIComponent(arg) : null };
}

function render() {
  const r = route();
  const tab = ['chart', 'table', 's'].includes(r.page) ? 'chart' : r.page;
  let title = '拼音表';
  let back = null;
  let body;
  if (r.page === 'blend') { title = '拼一拼'; body = renderBlend(); }
  else if (r.page === 'lookup') { title = '查拼音'; body = renderLookup(); }
  else if (r.page === 'table') { title = '音节总表'; back = '#/chart'; body = renderTable(); }
  else if (r.page === 's') { title = r.arg; back = '#/table'; body = renderDetail(r.arg); }
  else body = renderChart();

  $app.innerHTML = `
    <header class="topbar">
      ${back ? `<div class="side left"><a class="icon-btn" href="${back}" aria-label="返回">${ICON.back}</a></div>` : ''}
      <h1>${esc(title)}</h1>
      <div class="side right"><button class="icon-btn" data-act="settings" aria-label="设置">${ICON.gear}</button></div>
    </header>
    <main class="page">${body}</main>
    <nav class="tabbar">
      <a href="#/chart" class="${tab === 'chart' ? 'on' : ''}">${ICON.chart}<span>拼音表</span></a>
      <a href="#/blend" class="${tab === 'blend' ? 'on' : ''}">${ICON.blend}<span>拼一拼</span></a>
      <a href="#/lookup" class="${tab === 'lookup' ? 'on' : ''}">${ICON.lookup}<span>查拼音</span></a>
    </nav>`;
  if (r.page === 'lookup') setupLookup();
  if (r.page === 'table') setupTable();
  syncPlaying();
}

// ---------- 拼音表 ----------

function tile(it, color) {
  const long = it.symbol.length >= 4 ? ' long' : '';
  return `<button class="tile" style="--c:${color}" data-act="sound" data-sound="${it.sound}" data-pid="c-${it.symbol}" aria-label="${it.symbol}，例字${it.char}">` +
    `<span class="sym${long}">${it.symbol}</span><span class="ch">${it.char}</span></button>`;
}

function renderChart() {
  const grid = (items, color) => `<div class="grid6">${items.map((it) => tile(it, color)).join('')}</div>`;
  const finals = C.FINAL_GROUPS.map(([label, items]) => `<div class="sub-h">${label}</div>${grid(items, 'var(--indigo)')}`).join('');
  const tones = C.TONES.map((t) => `
    <button class="tone-tile" style="--c:var(--t${t.tone})" data-act="sound" data-sound="${t.example}" data-pid="tone${t.tone}">
      <span class="py t${t.tone}">${t.example}</span><span class="hz">${t.char}</span><span class="rh">${t.rhyme}</span>
    </button>`).join('');
  return `
    <section class="section">${secHeader('声母', { caption: '字音开头的音', color: 'var(--vermilion)' })}${grid(C.INITIALS, 'var(--vermilion)')}</section>
    <section class="section">${secHeader('韵母', { caption: '声母后面的部分', color: 'var(--indigo)' })}${finals}</section>
    <section class="section">${secHeader('整体认读', { caption: '整个读，不用拆开拼', color: 'var(--ochre)' })}${grid(C.WHOLE, 'var(--ochre)')}</section>
    <section class="section">${secHeader('声调', { caption: '音一样，声调不同就是不同的字', color: 'var(--t1)',
      more: `<button class="more" data-act="quiz">练一练${ICON.chevron.replace('<svg', '<svg width="12" height="12"')}</button>` })}
      <div class="tones">${tones}</div></section>
    <a class="row-link" href="#/table"><b>音节总表</b><span>全部 ${data.syllables.length} 个音节</span>${ICON.chevron}</a>`;
}

// ---------- 音节总表、详情 ----------

function renderTable() {
  return `<div class="search"><input id="table-q" type="search" placeholder="搜音节，比如 ma（打 v 代替 ü）" value="${esc(ui.tableQuery)}" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
    <p class="note">普通话音节共 ${data.syllables.length} 个，按声母排列。点一个看它的四个声调。</p>
    <div id="table-list">${tableList()}</div>`;
}

function tableList() {
  const key = ui.tableQuery.trim().toLowerCase().replace(/v/g, 'ü');
  const all = data.syllables.filter((s) => !key || s.base.startsWith(key));
  const order = [...C.INITIALS.map((i) => i.symbol), ''];
  const html = order.map((ini) => {
    const items = all.filter((s) => s.initial === ini);
    if (!items.length) return '';
    const cells = items.map((s) => `<a class="cell" href="#/s/${encodeURIComponent(s.base)}"><b>${s.base}</b><span>${[1, 2, 3, 4].map((t) => entry(s, t)?.char || '').join('')}</span></a>`).join('');
    return `<section class="section">${secHeader(ini || '没有声母', { count: items.length, color: ini ? 'var(--vermilion)' : 'var(--indigo)' })}<div class="grid4">${cells}</div></section>`;
  }).join('');
  return html || '<p class="loading">没有找到这个音节</p>';
}

function setupTable() {
  const input = document.getElementById('table-q');
  input.addEventListener('input', () => {
    ui.tableQuery = input.value;
    document.getElementById('table-list').innerHTML = tableList();
  });
}

function renderDetail(base) {
  const syl = data.byBase.get(base);
  if (!syl) return '<p class="loading">没有这个音节</p>';
  const rows = [1, 2, 3, 4].map((t) => {
    const e = entry(syl, t);
    const toned = P.mark(base, t);
    if (!e) {
      return `<div class="tone-row empty card"><span style="opacity:.3">${contour(t, 28, 24)}</span><span class="py">${toned}</span><span class="hz">常用字里没有这个音</span></div>`;
    }
    const word = e.word && e.wordPinyin
      ? `<button class="word" style="--c:var(--t${t})" data-act="sounds" data-sounds="${e.wordPinyin.replace(/ /g, ',')}" data-pause="0.04" data-pid="w-${base}${t}"><small>${e.wordPinyin}</small><b>${e.word}</b></button>`
      : '';
    return `<div class="tone-row card" style="--c:var(--t${t})" data-pid="d-${base}${t}">
      <button class="main" data-act="sound" data-sound="${toned}" data-fallback="${e.char}" data-pid="d-${base}${t}">${contour(t, 28, 24)}<span class="py t${t}">${toned}</span><span class="hz">${e.char}</span></button>${word}</div>`;
  }).join('');
  const tones = [1, 2, 3, 4].filter((t) => entry(syl, t));
  const all = tones.length > 1
    ? `<div class="pills" style="margin:4px 0 14px"><button class="pill" data-act="sounds" data-sounds="${tones.map((t) => P.mark(base, t)).join(',')}" data-pause="0.4">${ICON.play}四声连读</button></div>`
    : '';
  return `${rows}${all}<p class="note">点拼音听这个音，点右边的例词听整个词，都是真人录音。灰色的声调，常用字里没有这个读音。</p>`;
}

// ---------- 拼一拼 ----------

function blendSyllable() {
  const { initial, final } = ui.blend;
  const base = P.spell(initial.symbol, final.symbol);
  return { base, syl: data.byBase.get(base) };
}

function renderBlend() {
  const { initial, final } = ui.blend;
  const { base, syl } = blendSyllable();
  const tones = [1, 2, 3, 4].filter((t) => entry(syl, t));
  const tone = tones.includes(ui.blend.tone) ? ui.blend.tone : (tones[0] || 1);
  const result = syl
    ? `<span class="t${tone}">${P.mark(base, tone)}</span><span class="hz">${entry(syl, tone)?.char || ''}</span>`
    : '<span class="none">没有这个音</span>';
  const chips = [1, 2, 3, 4].map((t) => {
    const e = entry(syl, t);
    return `<button class="tchip ${e && t === tone ? 'sel' : ''}" style="--c:var(--t${t})" data-act="blend-tone" data-t="${t}" ${e ? '' : 'disabled'}>` +
      `${e ? P.mark(base, t) : C.TONES[t - 1].mark}<small>${e ? e.char : '—'}</small></button>`;
  }).join('');
  const canBlend = (f) => data.byBase.has(P.spell(initial.symbol, f.symbol));
  const chipGrid = (items, color, kind, selected, enabled) => `<div class="grid6">${items.map((it) => {
    const sel = it.symbol === selected.symbol;
    const ok = enabled(it);
    return `<button class="chip ${sel ? 'sel' : ''}" style="--c:${color}" data-act="${kind}" data-v="${it.symbol}" ${ok || sel ? '' : 'disabled'}>` +
      `<span class="sym">${it.symbol}</span><span class="ch">${it.char}</span></button>`;
  }).join('')}</div>`;
  return `
    <div class="blend-panel card">
      <div class="formula"><span style="color:var(--vermilion)">${initial.symbol}</span><span class="op">+</span><span style="color:var(--indigo)">${final.symbol}</span><span class="op">=</span>${result}</div>
      <div class="tchips">${chips}</div>
      <button class="primary" data-act="blend-read" data-pid="blend" ${syl ? '' : 'disabled'}>${ICON.play}<span>拼读</span></button>
    </div>
    <section class="section">${secHeader('声母', { color: 'var(--vermilion)' })}${chipGrid(C.INITIALS, 'var(--vermilion)', 'pick-initial', initial, () => true)}</section>
    <section class="section">${secHeader('韵母', { caption: `灰色的和 ${initial.symbol} 拼不出音`, color: 'var(--indigo)' })}${chipGrid(C.BLEND_FINALS, 'var(--indigo)', 'pick-final', final, canBlend)}</section>
    <section class="section">${secHeader('带 i u ü 的韵母', { caption: '声母 + i/u/ü + 韵母，如 j-i-a', color: 'var(--indigo)' })}${chipGrid(C.MEDIAL_FINALS, 'var(--indigo)', 'pick-final', final, canBlend)}</section>`;
}

// ---------- 查拼音 ----------

const SAMPLES = ['我们去银行取钱', '他长得很高', '睡觉前听音乐', '重新开始', '了解一下这个地方'];

function renderLookup() {
  return `
    <div class="input-card card">
      <textarea id="lookup-input" rows="1" placeholder="输入汉字，比如：今天天气很好" enterkeyhint="done">${esc(ui.lookup.text)}</textarea>
      <button class="clear" data-act="lookup-clear" aria-label="清空" ${ui.lookup.text ? '' : 'hidden'}>${ICON.x}</button>
    </div>
    <div id="lookup-result">${lookupResult()}</div>`;
}

function lookupResult() {
  const text = ui.lookup.text;
  if (!text.trim()) {
    return `<div class="empty-card card">
      <h3>把字标上拼音</h3>
      <p>点任意一个字，听真人读音。多音字按词判断，比如「银行」的「行」读 háng。</p>
      <p style="margin:0;font-size:13px">不会打字？用键盘上的手写或语音输入就行。</p>
      <hr><div class="sub-h" style="margin-top:0">试试这些</div>
      <div class="pills">${SAMPLES.map((s) => `<button class="pill" data-act="sample" data-text="${s}">${s}</button>`).join('')}</div></div>`;
  }
  if (!data.converter) return '<p class="loading">正在加载词典…</p>';
  const tokens = ui.lookup.tokens;
  const html = tokens.map((t, idx) => {
    if (t.text === '\n') return '<span class="br"></span>';
    if (!t.reading) return `<span class="tok plain"><span class="py">&nbsp;</span><span class="hz">${esc(t.text)}</span></span>`;
    const reading = ui.lookup.chosen[t.id] || t.reading;
    const tone = toneOf(reading);
    const poly = P.isPolyphonic(t.readings);
    return `<span class="tok" style="--c:var(--t${tone})" data-act="token" data-idx="${idx}" data-pid="tok${t.id}">` +
      `<span class="py t${tone} ${poly ? 'poly' : ''}">${reading}</span><span class="hz">${esc(t.text)}</span></span>`;
  }).join('');
  const hasPoly = tokens.some((t) => t.reading && P.isPolyphonic(t.readings));
  return `<div class="result card">${html}</div>
    <div class="pills">
      <button class="pill red" data-act="read-all" data-seqbtn="readAll" style="min-width:118px"></button>
      <button class="pill" data-act="speak-all" data-seqbtn="speak" style="min-width:86px"></button>
      <button class="pill" data-act="copy">${ICON.copy}复制拼音</button>
    </div>
    <p class="hint">「逐字朗读」用真人录音一个字一个字念；「整句」用手机的系统声音，连贯但不如真人准。${hasPoly ? '<br>拼音下有虚线的是多音字，长按可以换读音。' : ''}</p>`;
}

function updateLookup() {
  const text = ui.lookup.text;
  ui.lookup.tokens = data.converter && text ? data.converter.convert(text) : [];
  const box = document.getElementById('lookup-result');
  if (box) box.innerHTML = lookupResult();
  const clear = document.querySelector('[data-act="lookup-clear"]');
  if (clear) clear.hidden = !text;
  syncPlaying();
}

function setupLookup() {
  const input = document.getElementById('lookup-input');
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
  grow();
  input.addEventListener('input', () => {
    ui.lookup.text = input.value;
    ui.lookup.chosen = {};
    localStorage.setItem('zy-text', input.value);
    grow();
    updateLookup();
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); input.blur(); } });
  loadConverter().then(updateLookup);
}

async function gunzipText(url) {
  if ('DecompressionStream' in window) {
    const res = await fetch(url);
    return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return (await fetch(url.replace(/\.gz$/, ''))).text();
}

function loadConverter() {
  if (!data.converterLoading) {
    data.converterLoading = Promise.all([gunzipText('data/hanzi.tsv.gz'), gunzipText('data/phrases.tsv.gz')])
      .then(([h, p]) => { data.converter = new P.Converter(h, p); });
  }
  return data.converterLoading;
}

function readAllClips() {
  const clips = [];
  for (const t of ui.lookup.tokens) {
    if (t.reading) {
      clips.push(A.syllableClip(ui.lookup.chosen[t.id] || t.reading, `tok${t.id}`, t.text));
      clips.push({ pause: 0.12 });
    } else if (t.text.trim() || t.text === '\n') {
      clips.push({ pause: 0.35 });
    }
  }
  return clips;
}

// ---------- 弹出层：练一练、设置、换读音 ----------

function openSheet(sheet) { ui.sheet = sheet; renderSheet(); }
function closeSheet() { ui.sheet = null; $sheet.innerHTML = ''; }

function renderSheet() {
  const s = ui.sheet;
  if (!s) { $sheet.innerHTML = ''; return; }
  let title = '';
  let body = '';
  if (s.kind === 'quiz') { title = '练听声调'; body = renderQuiz(); }
  if (s.kind === 'settings') { title = '设置'; body = renderSettings(); }
  if (s.kind === 'readings') { title = `「${esc(s.token.text)}」的读音`; body = renderReadings(s.token); }
  $sheet.innerHTML = `<div class="backdrop" data-act="close-sheet"></div>
    <div class="sheet" role="dialog" aria-label="${title}"><div class="sheet-h"><h2>${title}</h2><button class="done" data-act="close-sheet">完成</button></div>${body}</div>`;
  syncPlaying();
}

const QUIZ_POOL = ['ma', 'ba', 'yi', 'wu', 'yu', 'tang', 'shi', 'qi', 'fu', 'hua', 'tong', 'li', 'ji', 'bao', 'zhu', 'xiang', 'jiang', 'mao', 'tu', 'da'];

function nextQuestion() {
  const pool = QUIZ_POOL.map((b) => data.byBase.get(b)).filter((s) => s && [1, 2, 3, 4].every((t) => entry(s, t)));
  const syl = pool[Math.floor(Math.random() * pool.length)];
  const tone = 1 + Math.floor(Math.random() * 4);
  ui.quiz.q = { base: syl.base, tone, char: entry(syl, tone).char };
  ui.quiz.answered = null;
  renderSheet();
  playQuestion();
}

function playQuestion() {
  const q = ui.quiz.q;
  if (q) A.playSyllable(q.base, q.tone, 'quiz', q.char);
}

function renderQuiz() {
  const z = ui.quiz;
  const head = `<div class="q-h"><b>听一个音，选它是第几声</b>${z.total ? `<span>答对 ${z.right}/${z.total}</span>` : ''}</div>`;
  if (!z.q) return `<div class="quiz card">${head}<button class="primary" data-act="quiz-next">开始</button></div>`;
  // 答完后：正确答案保持它自己的声调色并打勾，选错的变灰打叉（不用绿色表示对，免得和三声的绿混淆）
  const answers = [1, 2, 3, 4].map((t) => {
    const done = z.answered != null;
    const right = done && t === z.q.tone;
    const wrong = done && t === z.answered && t !== z.q.tone;
    const cls = right ? 'right' : (done ? 'dim' : '');
    const mark = right ? '✓' : (wrong ? '✕' : '');
    return `<button class="answer ${cls}" style="--c:var(--t${t})" data-act="quiz-answer" data-t="${t}">${contour(t, 30, 20)}${P.TONE_NAMES[t]}${mark ? `<span class="mark">${mark}</span>` : ''}</button>`;
  }).join('');
  const verdict = z.answered == null ? '' : `<div class="verdict"><span>${z.answered === z.q.tone ? '对了' : '是' + P.TONE_NAMES[z.q.tone]}</span>
    <span class="py t${z.q.tone}">${P.mark(z.q.base, z.q.tone)}</span><span>${z.q.char}</span>
    <button class="pill red" data-act="quiz-next">下一题</button></div>`;
  return `<div class="quiz card">${head}
    <button class="big-play" data-act="quiz-replay" data-pid="quiz" aria-label="再听一遍">${ICON.speaker}</button>
    <div class="tip">点喇叭再听一遍</div><div class="answers">${answers}</div>${verdict}</div>`;
}

function renderSettings() {
  const o = ui.offline;
  const offline = o.total && o.cached >= o.total
    ? `<div class="row">${ICON.check}<span>全部 ${o.total} 条录音已存到手机，断网也能用。</span></div>`
    : `<div class="row">${ICON.cloud}<span>录音已存 ${o.cached}/${o.total || '…'} 条${o.running ? '，正在下载…' : '。'}</span>
       ${o.running ? '' : '<button class="pill red" data-act="cache-all" style="margin-left:auto">全部下载</button>'}</div>`;
  const voices = A.mandarinVoices();
  const voiceRow = voices.length
    ? `<div class="row"><span style="flex:none">声音</span><select data-act="voice">${voices.map((v) =>
        `<option value="${esc(v.voiceURI)}" ${v.voiceURI === A.speech.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>`
    : '<div class="row"><span>这台设备没有普通话系统声音。</span></div>';
  return `
    <div class="group-t">发音</div>
    <div class="group card">
      <div class="row">${ICON.wave}<span>拼音表、拼一拼、例词、点字和逐字朗读，放的都是真人录音。</span></div>
      <div class="row">${ICON.wave}<span>轻声字没有单独录音，用一声录音念得轻而短。</span></div>
      <div class="row">${ICON.speaker}<span>只有查拼音里的「整句」用手机的系统声音。</span></div>
    </div>
    <div class="group-t">离线使用</div>
    <div class="group card">${offline}</div>
    <div class="group-t">「整句」的系统声音</div>
    <div class="group card">${voiceRow}
      <div class="row"><span style="flex:none">语速</span><input type="range" min="0.6" max="1.2" step="0.05" value="${A.speech.rate}" data-act="rate"></div>
    </div>
    <p class="foot">想要更自然的整句朗读：iPhone「设置 › 辅助功能 › 朗读内容 › 声音 › 中文」里下载「增强」或「高级」声音。</p>
    <div class="group-t">装到主屏幕</div>
    <div class="group card"><div class="row">${ICON.home}<span>iPhone：用 Chrome 或 Safari 打开本页，点分享按钮，选「添加到主屏幕」（找不到时点「查看更多」）。保留「作为网页 App 打开」，再点「添加」。之后从桌面图标打开，全屏使用。</span></div></div>
    <div class="group-t">致谢</div>
    <div class="group card">
      <div class="row"><span>音节录音：Chen Wang、Yue Tan，<a href="https://github.com/hugolpz/audio-cmn" target="_blank" rel="noopener">audio-cmn</a>（<a href="licenses/audio-cmn.txt" target="_blank">CC BY-SA</a>）</span></div>
      <div class="row"><span>拼音数据：<a href="https://github.com/mozillazg/pinyin-data" target="_blank" rel="noopener">pinyin-data</a>、<a href="https://github.com/mozillazg/phrase-pinyin-data" target="_blank" rel="noopener">phrase-pinyin-data</a>（<a href="licenses/pinyin-data.txt" target="_blank">MIT</a>）</span></div>
      <div class="row"><span>词频：<a href="https://github.com/fxsjy/jieba" target="_blank" rel="noopener">jieba</a>（<a href="licenses/jieba.txt" target="_blank">MIT</a>）</span></div>
    </div>`;
}

function renderReadings(token) {
  const cur = ui.lookup.chosen[token.id] || token.reading;
  return token.readings.map((r) =>
    `<button class="choice card ${r === cur ? 'on' : ''}" data-act="choose-reading" data-r="${r}"><span class="py t${toneOf(r)}">${r}</span>` +
    `${r === cur ? `<span style="margin-left:auto;color:var(--vermilion)">${ICON.check.replace('<svg', '<svg width="20" height="20"')}</span>` : ''}</button>`).join('');
}

// ---------- 播放高亮 ----------

function syncPlaying() {
  const { speakingId, sequence } = A.state;
  document.querySelectorAll('[data-pid]').forEach((el) => el.classList.toggle('playing', !!speakingId && el.dataset.pid === speakingId));
  const readAll = document.querySelector('[data-seqbtn="readAll"]');
  if (readAll) readAll.innerHTML = sequence === 'readAll' ? `${ICON.stop}停止` : `${ICON.wave}逐字朗读`;
  const speakAll = document.querySelector('[data-seqbtn="speak"]');
  if (speakAll) speakAll.innerHTML = sequence === 'speak' ? `${ICON.stop}停止` : `${ICON.speaker}整句`;
  const blend = document.querySelector('[data-act="blend-read"] span');
  if (blend) blend.textContent = sequence === 'blend' ? '拼读中…' : '拼读';
}
A.onChange(syncPlaying);

// ---------- 交互 ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.dataset.act === 'token') return;
  const act = el.dataset.act;
  const d = el.dataset;
  switch (act) {
    case 'sound': A.unlock(); A.playSound(d.sound, d.pid || null, d.fallback || null); break;
    case 'sounds': A.unlock(); A.playSounds(d.sounds.split(','), d.pid || null, Number(d.pause || 0.35)); break;
    case 'settings': openSheet({ kind: 'settings' }); refreshOffline(); break;
    case 'close-sheet': A.stop(); closeSheet(); break;
    case 'quiz': A.unlock(); openSheet({ kind: 'quiz' }); break;
    case 'quiz-next': A.unlock(); nextQuestion(); break;
    case 'quiz-replay': A.unlock(); playQuestion(); break;
    case 'quiz-answer': {
      if (ui.quiz.answered != null) break;
      ui.quiz.answered = Number(d.t);
      ui.quiz.total += 1;
      if (ui.quiz.answered === ui.quiz.q.tone) ui.quiz.right += 1;
      renderSheet();
      break;
    }
    case 'pick-initial':
    case 'pick-final': {
      A.unlock();
      const list = act === 'pick-initial' ? C.INITIALS : [...C.BLEND_FINALS, ...C.MEDIAL_FINALS];
      const it = list.find((x) => x.symbol === d.v);
      if (act === 'pick-initial') ui.blend.initial = it; else ui.blend.final = it;
      render();
      A.playSound(it.sound);
      break;
    }
    case 'blend-tone': {
      A.unlock();
      ui.blend.tone = Number(d.t);
      const { base, syl } = blendSyllable();
      render();
      A.playSyllable(base, ui.blend.tone, null, entry(syl, ui.blend.tone)?.char);
      break;
    }
    case 'blend-read': {
      A.unlock();
      const { base, syl } = blendSyllable();
      const tones = [1, 2, 3, 4].filter((t) => entry(syl, t));
      const tone = tones.includes(ui.blend.tone) ? ui.blend.tone : tones[0];
      const parts = [C.blendSound(ui.blend.initial), C.blendSound(ui.blend.final), P.mark(base, tone)].filter(Boolean);
      A.playSounds(parts, 'blend', 0.45);
      break;
    }
    case 'sample': {
      ui.lookup.text = d.text;
      ui.lookup.chosen = {};
      localStorage.setItem('zy-text', d.text);
      const input = document.getElementById('lookup-input');
      if (input) { input.value = d.text; input.dispatchEvent(new Event('input')); }
      break;
    }
    case 'lookup-clear': {
      const input = document.getElementById('lookup-input');
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.focus();
      break;
    }
    case 'read-all': A.unlock(); if (A.state.sequence === 'readAll') A.stop(); else A.play(readAllClips(), 'readAll'); break;
    case 'speak-all': if (A.state.sequence === 'speak') A.stop(); else A.speak(ui.lookup.text, 'speak'); break;
    case 'copy': {
      const text = ui.lookup.tokens.map((t) => (t.reading ? (ui.lookup.chosen[t.id] || t.reading) : t.text)).join(' ');
      navigator.clipboard?.writeText(text).then(() => toast('拼音已复制'), () => toast('复制失败'));
      break;
    }
    case 'choose-reading': {
      const token = ui.sheet.token;
      ui.lookup.chosen[token.id] = d.r;
      A.unlock();
      A.playSound(d.r, `tok${token.id}`, token.text);
      closeSheet();
      updateLookup();
      break;
    }
    case 'cache-all': startOfflineCache(); break;
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'voice') { A.speech.voiceURI = el.value; localStorage.setItem('zy-voice', el.value); A.speak('我们一起来练习'); }
  if (el.dataset.act === 'rate') { A.speech.rate = Number(el.value); localStorage.setItem('zy-rate', el.value); A.speak('我们一起来练习'); }
});

// 查拼音的字：轻点放录音，长按多音字换读音
let press = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-act="token"]');
  if (!el) return;
  const token = ui.lookup.tokens[Number(el.dataset.idx)];
  press = { el, token, x: e.clientX, y: e.clientY, long: false };
  if (P.isPolyphonic(token.readings)) {
    press.timer = setTimeout(() => { press.long = true; openSheet({ kind: 'readings', token }); }, 450);
  }
});
document.addEventListener('pointermove', (e) => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; }
});
document.addEventListener('pointerup', () => {
  if (!press) return;
  clearTimeout(press.timer);
  if (!press.long) {
    const t = press.token;
    A.unlock();
    A.playSound(ui.lookup.chosen[t.id] || t.reading, `tok${t.id}`, t.text);
  }
  press = null;
});
document.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-act="token"]')) e.preventDefault(); });

window.addEventListener('hashchange', () => { A.stop(); closeSheet(); render(); window.scrollTo(0, 0); });
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { if (ui.sheet?.kind === 'settings') renderSheet(); });

// ---------- 离线 ----------

async function refreshOffline() {
  if (!data.audioNames.length) return;
  const s = await A.offlineStatus(data.audioNames);
  ui.offline.cached = s.cached;
  ui.offline.total = s.total;
  if (ui.sheet?.kind === 'settings') renderSheet();
}

async function startOfflineCache() {
  if (ui.offline.running || !data.audioNames.length) return;
  ui.offline.running = true;
  await A.cacheAll(data.audioNames, (done, total) => {
    ui.offline.cached = done;
    ui.offline.total = total;
    if (ui.sheet?.kind === 'settings') renderSheet();
  });
  ui.offline.running = false;
  refreshOffline();
}

// ---------- 启动 ----------

async function start() {
  const [syllables, audioNames] = await Promise.all([
    fetch('data/syllables.json').then((r) => r.json()),
    fetch('audio/index.json').then((r) => r.json()).catch(() => []),
  ]);
  data.syllables = syllables.syllables;
  data.byBase = new Map(data.syllables.map((s) => [s.base, s]));
  data.audioNames = audioNames;
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // 空闲时预先加载词典，并在后台把全部录音存到手机（离线可用）
  setTimeout(() => { loadConverter().then(() => { if (route().page === 'lookup') updateLookup(); }); }, 1200);
  setTimeout(() => { if (navigator.onLine) startOfflineCache(); }, 3000);
}

start();
