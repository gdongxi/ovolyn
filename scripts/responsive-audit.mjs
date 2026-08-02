// Does any page stick out sideways? Measures horizontal overflow per page per
// width and names the outermost element responsible. No dependencies.
//
//   chrome --headless --remote-debugging-port=9333 --user-data-dir=/tmp/cdp &
//   BASE=http://localhost:3000 node scripts/responsive-audit.mjs
//
// Screenshots taken with `--window-size` are not evidence: older headless
// clamps the window to a minimum width and then crops the image to what you
// asked for, which reads as overflow that is not there. Device metrics set
// over CDP are what a phone actually does, so that is what this measures.
const PORT = Number(process.env.CDP_PORT || 9333);
const BASE = process.env.BASE || 'https://ovolyn.xyz';
const PAGES = (process.env.PAGES || '/,/bank,/market,/ledger,/agents').split(',');
const WIDTHS = (process.env.WIDTHS || '320,375,414').split(',').map(Number);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return r.json();
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else if (m.method) {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].method === m.method) { waiters[i].resolve(m.params); waiters.splice(i, 1); }
      }
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
    once: (method, timeout = 20000) =>
      new Promise((resolve) => {
        const w = { method, resolve };
        waiters.push(w);
        setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); resolve(null); } }, timeout);
      }),
  };
}

// Runs in the page. Finds the OUTERMOST elements that stick out past the viewport.
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const over = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    // outermost only: skip if an ancestor already overflows
    let anc = el.parentElement, covered = false;
    while (anc && anc !== document.body) {
      const ar = anc.getBoundingClientRect();
      if (ar.right > vw + 1 || ar.left < -1) { covered = true; break; }
      anc = anc.parentElement;
    }
    if (covered) continue;
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    over.push({
      tag: el.tagName.toLowerCase() + cls,
      right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width),
    });
  }
  const seen = new Set(), uniq = [];
  for (const o of over) { if (!seen.has(o.tag)) { seen.add(o.tag); uniq.push(o); } }
  return JSON.stringify({
    vw,
    scrollW: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth - vw,
    offenders: uniq.slice(0, 8),
  });
})()`;

const t = await newTarget();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
const c = cdp(ws);
await c.send('Page.enable');

const results = [];
for (const w of WIDTHS) {
  for (const p of PAGES) {
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: 800, deviceScaleFactor: 2, mobile: true,
    });
    const loaded = c.once('Page.loadEventFired');
    await c.send('Page.navigate', { url: BASE + p });
    await loaded;
    await sleep(1400);
    const { result } = await c.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    results.push({ width: w, page: p, ...JSON.parse(result.value) });
  }
}
ws.close();

let bad = 0;
for (const w of WIDTHS) {
  console.log(`\n══ viewport ${w}px ══`);
  for (const r of results.filter((x) => x.width === w)) {
    const ok = r.overflow <= 1;
    if (!ok) bad++;
    console.log(`  ${ok ? '✅' : '❌'} ${r.page.padEnd(8)} scrollWidth=${r.scrollW} (溢出 ${r.overflow}px)`);
    if (!ok) for (const o of r.offenders) console.log(`        ↳ ${o.tag}  right=${o.right} width=${o.width}`);
  }
}
console.log(`\n结果：${results.length - bad}/${results.length} 通过`);
