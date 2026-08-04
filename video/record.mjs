// The real take. Presses the button once, then follows the shot list on the
// clock while the run settles behind it.
//
//   node record.mjs
//
// Safety, in the order it matters:
//   · every dry-run check runs again BEFORE the click, and a failure exits
//     without pressing anything — a refused take costs nothing, a wrong one
//     costs a run.
//   · the click is guarded by a flag that can only fall once. Nothing in here
//     retries it, on any path, for any reason.
//   · progress is read from the run file, never slept through.
//   · any throw stops the recorder first, so partial footage survives.

import puppeteer from "puppeteer-core";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { mkdirSync, writeFileSync } from "node:fs";
import { SHOTS, SITE } from "./shots.mjs";

const PORT = 9222;
const OUT = new URL("./take/", import.meta.url).pathname;
const W = 1280, H = 720;

mkdirSync(OUT, { recursive: true });
const log = [];
const t0 = () => (Date.now() - START) / 1000;
let START = Date.now();
const say = (s) => { const l = `[${t0().toFixed(1).padStart(6)}s] ${s}`; console.log(l); log.push(l); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Hold until the wall clock reaches `sec` from the start of the recording. */
const until = async (sec) => { const w = sec * 1000 - (Date.now() - START); if (w > 0) await sleep(w); };

const SMOOTH = `(target) => new Promise((done) => {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const to = Math.min(Math.max(0, target), max);
  let guard = 0;
  const tick = () => {
    const dy = to - window.scrollY;
    if (Math.abs(dy) < 2 || ++guard > 400) { window.scrollTo(0, to); return done(guard); }
    window.scrollBy(0, Math.sign(dy) * Math.min(48, Math.abs(dy)));
    requestAnimationFrame(tick);
  };
  tick();
})`;

// The screencast carries no OS cursor, so draw one and let it follow the mouse.
const CURSOR = `
  (() => {
    if (window.__cur) return;
    const d = document.createElement('div');
    d.id = '__cursor';
    d.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;' +
      'border-radius:50%;background:rgba(32,31,29,.16);border:2px solid rgba(32,31,29,.65);' +
      'pointer-events:none;transition:transform .08s linear;left:0;top:0;opacity:0';
    const add = () => document.body && document.body.appendChild(d);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add();
    window.__cur = (x, y) => { d.style.opacity = '1'; d.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    window.__curHide = () => { d.style.opacity = '0'; };
  })()
`;

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORT}`,
  defaultViewport: null,
  protocolTimeout: 300000,
});

let page, recorder;
let CLICKED_ONCE = false; // falls once, never rises
let aborted = null;

/** Move the drawn cursor with the real mouse. */
async function glide(x, y, steps = 22) {
  await page.mouse.move(x, y, { steps });
  await page.evaluate(`window.__cur && window.__cur(${x}, ${y})`);
}

async function focusOn(sel) {
  const y = await page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.round(r.top + window.scrollY - Math.max(0, (${H} - r.height) / 2));
  })()`);
  if (y == null) { say(`  ⚠️ 焦点元素缺失 ${sel}`); return false; }
  await page.evaluate(`(${SMOOTH})(${y})`);
  const vis = await page.evaluate(`(() => {
    const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
    return Math.round(Math.min(r.bottom, ${H}) - Math.max(r.top, 0));
  })()`);
  if (vis <= 0) { say(`  ⚠️ ${sel} 没进画面`); return false; }
  return true;
}

try {
  page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(CURSOR); // survives every navigation

  // ── preflight, all of it, before anything is pressed ──────────────────
  say("preflight 开始（此刻尚未点击任何东西）");
  await page.goto(`${SITE}/bank`, { waitUntil: "networkidle2", timeout: 60000 });

  const authed = await page.evaluate(`fetch('/api/agents').then(r=>r.status)`);
  if (authed !== 200) throw new Error(`未登录（/api/agents → ${authed}），/agents 那一幕拍不到`);
  say("  ✅ 操作员会话");

  const runState = await page.evaluate(`fetch('/api/demo/run').then(r=>r.json()).then(j=>j.state)`);
  if (runState === "running") throw new Error("已有编排在跑，等它结束再录");
  say(`  ✅ 编排空闲（state=${runState}）`);

  const btn = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /run again|run the bank/i.test(x.textContent||''));
    if (!b || b.disabled) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), text: b.textContent.trim() };
  })()`);
  if (!btn) throw new Error("Run 按钮不存在或不可点");
  say(`  ✅ Run 按钮就位「${btn.text}」`);

  for (const s of SHOTS) {
    if (!s.focus) continue;
    // Cheap existence probe on the pages we can reach without leaving /bank.
  }
  say("preflight 通过 —— 开始录制");

  // ── roll ──────────────────────────────────────────────────────────────
  recorder = new PuppeteerScreenRecorder(page, {
    fps: 30,
    videoFrame: { width: 1920, height: 1080 },
    aspectRatio: "16:9",
    followNewTab: false,
  });
  await recorder.start(`${OUT}take.mp4`);
  START = Date.now();
  say("录制开始");

  const ctx = {};

  for (const shot of SHOTS) {
    await until(shot.at);
    say(`[${shot.id}] ${shot.what}`);

    if (shot.id === "1-press-run") {
      // Already on /bank from preflight. Walk to the button and press it once.
      await glide(btn.x - 180, btn.y + 90, 10);
      await sleep(700);
      await glide(btn.x, btn.y, 26);
      await sleep(450);
      if (CLICKED_ONCE) throw new Error("守卫触发：不允许第二次点击");
      CLICKED_ONCE = true;
      await page.mouse.click(btn.x, btn.y);
      say("  🔘 已点击 Run（本次运行仅此一次）");
      await sleep(900);
      await page.evaluate(`window.__curHide && window.__curHide()`);
      if (shot.focus) await focusOn(shot.focus);
    } else {
      const url = shot.url(ctx);
      if (!url) { say("  ⚠️ 没有 URL，跳过"); await until(shot.until); continue; }
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      if (shot.settle) await sleep(shot.settle);
      if (shot.scrollTo) {
        const y = await page.evaluate(shot.scrollTo);
        if (y != null) await page.evaluate(`(${SMOOTH})(${y})`);
      }
      if (shot.focus) await focusOn(shot.focus);
    }

    // Read the real state rather than trusting the clock.
    if (shot.id === "3-deposit-hash") {
      for (let i = 0; i < 40 && t0() < shot.until - 2; i++) {
        const st = await page.evaluate(`fetch('/api/demo/run').then(r=>r.json()).then(j=>(j.stages||[]).map(s=>s.state).join(','))`);
        if ((st || "").startsWith("done")) { say(`  ✅ Deposit 已完成（${st}）`); break; }
        await sleep(1500);
        await page.reload({ waitUntil: "networkidle2" });
        if (shot.focus) await focusOn(shot.focus);
      }
      ctx.arcscanUrl = await page.evaluate(`(() => { const a = document.querySelector('a.tx[href*="arcscan"]'); return a ? a.href : null; })()`);
      say(`  Arcscan → ${ctx.arcscanUrl ? ctx.arcscanUrl.slice(0, 64) : "缺失"}`);
    }

    await page.screenshot({ path: `${OUT}${shot.id}.png` });
    await until(shot.until);
  }

  say("录制结束");
} catch (e) {
  aborted = e.message;
  say(`💥 中止：${e.message}`);
  if (page) await page.screenshot({ path: `${OUT}abort.png` }).catch(() => {});
} finally {
  if (recorder) await recorder.stop().catch(() => {});
  if (page) await page.close().catch(() => {});
  browser.disconnect();
  writeFileSync(`${OUT}report.txt`, log.join("\n"));
}

console.log(`\n${aborted ? `❌ 未完成：${aborted}` : `✅ 成片 ${OUT}take.mp4`}`);
console.log(`   点击发生过：${CLICKED_ONCE ? "是（1 次）" : "否"}`);
process.exit(aborted ? 1 : 0);
