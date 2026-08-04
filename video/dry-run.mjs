// Dry run — proves every shot is recordable WITHOUT pressing anything.
//
// Zero write operations by construction: this file contains no click, no type
// and no POST. It opens each page the take will visit, checks the things the
// narration claims are on screen, and saves a frame of each so they can be
// looked at before a run is spent.
//
//   node dry-run.mjs
//
// Attaches to the operator's own logged-in Chrome over CDP, so /agents renders
// the panel rather than the signed-out authority chain.

import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { SHOTS, SITE } from "./shots.mjs";

const PORT = 9222;
const OUT = new URL("./dry/", import.meta.url).pathname;
const W = 1280, H = 720;

mkdirSync(OUT, { recursive: true });

const log = [];
const say = (s) => { console.log(s); log.push(s.replace(/\[\d+m/g, "")); };

/** Scroll in steps, clamped to what the page can actually scroll.
 *  An unreachable target never resolves and takes the protocol down with it. */
const SMOOTH = `(target) => new Promise((done) => {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const to = Math.min(Math.max(0, target), max);
  let guard = 0;
  const tick = () => {
    const dy = to - window.scrollY;
    if (Math.abs(dy) < 2 || ++guard > 400) { window.scrollTo(0, to); return done(guard); }
    window.scrollBy(0, Math.sign(dy) * Math.min(60, Math.abs(dy)));
    requestAnimationFrame(tick);
  };
  tick();
})`;

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORT}`,
  defaultViewport: null,
  protocolTimeout: 300000, // a hung scroll must not abort the session
});

let page;
let failures = 0;
try {
  page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

  // Preflight: is this the operator's session? /agents answers 401 to a stranger.
  await page.goto(`${SITE}/bank`, { waitUntil: "networkidle2", timeout: 60000 });
  const authed = await page.evaluate(`fetch('/api/agents').then(r=>r.status)`);
  say(`preflight · GET /api/agents → ${authed} ${authed === 200 ? "✅ 操作员会话" : "❌ 未登录，/agents 那一幕会拍不到"}`);
  if (authed !== 200) failures++;

  // The hash the Arcscan shot will visit, read off the ledger rather than hardcoded.
  const arcscanUrl = await page.evaluate(`(() => {
    const a = document.querySelector('a.tx[href*="arcscan"]');
    return a ? a.href : null;
  })()`);
  say(`preflight · Arcscan 链接 ${arcscanUrl ? "✅ " + arcscanUrl.slice(0, 68) : "❌ 流水里没有带哈希的记录"}`);
  if (!arcscanUrl) failures++;
  const ctx = { arcscanUrl };

  for (const shot of SHOTS) {
    const url = shot.url(ctx);
    if (!url) { say(`\n[${shot.id}] ⏭ 跳过——没有可用的 URL`); failures++; continue; }
    say(`\n[${shot.id}] ${shot.at}s–${shot.until}s · ${shot.what}`);
    say(`  → ${url.slice(0, 96)}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    if (shot.settle) await new Promise((r) => setTimeout(r, shot.settle));

    if (shot.scrollTo) {
      const y = await page.evaluate(shot.scrollTo);
      if (y == null) { say("  ❌ 定位不到目标幻灯片"); failures++; }
      else {
        // Interpolated, not passed as an argument: evaluate() only forwards
        // args when handed a function, and silently ignores them for a string.
        const steps = await page.evaluate(`(${SMOOTH})(${y})`);
        // Then check the page actually moved. Asking whether the target could
        // be computed is not the same question as whether we got there.
        const landed = await page.evaluate(`Math.round(window.scrollY)`);
        const ok = Math.abs(landed - y) <= 4;
        if (!ok) failures++;
        say(`  ${ok ? "✅" : "❌"} 滚动到 y=${y}（实际 ${landed}，${steps} 帧）`);
      }
    }

    // Bring the element the shot is about into frame, then prove it is there.
    // Asserting that a node exists says nothing about whether the camera can
    // see it: /agents has the panel far below the fold, and the first pass
    // photographed the page header while every assertion passed.
    if (shot.focus) {
      const y = await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(shot.focus)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // Centre it, so a tall element does not sit half out of frame.
        return Math.round(r.top + window.scrollY - Math.max(0, (${H} - r.height) / 2));
      })()`);
      if (y == null) { say(`  ❌ 找不到焦点元素 ${shot.focus}`); failures++; }
      else {
        await page.evaluate(`(${SMOOTH})(${y})`);
        const vis = await page.evaluate(`(() => {
          const r = document.querySelector(${JSON.stringify(shot.focus)}).getBoundingClientRect();
          const shown = Math.min(r.bottom, ${H}) - Math.max(r.top, 0);
          return { top: Math.round(r.top), h: Math.round(r.height), shown: Math.round(shown) };
        })()`);
        const ok = vis.shown > 0 && vis.shown >= Math.min(vis.h, H) * 0.6;
        if (!ok) failures++;
        say(`  ${ok ? "✅" : "❌"} ${shot.focus} 入画（高 ${vis.h}px，视口内 ${vis.shown}px，top=${vis.top}）`);
      }
    }

    for (const a of shot.assert) {
      let got;
      try { got = await page.evaluate(a.expr); } catch (e) { got = `EVAL_ERROR: ${e.message.slice(0, 60)}`; }
      const ok = a.wantType ? typeof got === a.wantType : got === a.want;
      if (!ok) failures++;
      say(`  ${ok ? "✅" : "❌"} ${a.name}${ok ? "" : `  期望 ${a.wantType ?? JSON.stringify(a.want)}，实际 ${JSON.stringify(got)}`}`);
    }

    const file = `${OUT}${shot.id}.png`;
    await page.screenshot({ path: file });
    say(`  📷 ${file.split("/").pop()}`);
  }
} catch (e) {
  say(`\n💥 中断：${e.message}`);
  failures++;
} finally {
  // Leave the operator's own tabs exactly as they were.
  if (page) await page.close().catch(() => {});
  browser.disconnect();
}

say(`\n${failures === 0 ? "✅ 全部通过——可以正式录" : `❌ ${failures} 项不通过——先修再录`}`);
writeFileSync(`${OUT}report.txt`, log.join("\n"));
process.exit(failures === 0 ? 0 : 1);
