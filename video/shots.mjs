// The shot list, shared by the dry run and the real take so they cannot drift.
//
// Timings match video/ovolyn.display.srt. `assert` is what has to be true on
// screen before the shot is worth recording — the dry run checks every one of
// them without touching a button, so a missing selector or an empty panel is
// found before a run is spent rather than after.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const SITE = "https://ovolyn.xyz";
export const DECK = pathToFileURL(
  resolve("/Users/nangua/Desktop/Arc第三期黑客松/ovolyn/docs/deck.html"),
).href;

/** Slides are 720 CSS px tall; slide N sits at (N-1) * height. */
export const slideY = (n) => `(() => {
  const s = document.querySelectorAll('section.slide');
  if (s.length < ${n}) return null;
  const r = s[${n - 1}].getBoundingClientRect();
  return Math.round(r.top + window.scrollY);
})()`;

// 每一幕的 focus 是"必须出现在画面里"的元素。断言元素存在不等于它在视口里——
// deck 那一幕曾经截到封面、/agents 那一幕曾经截到页顶，都是这个区别造成的。
export const SHOTS = [
  {
    id: "1-press-run",
    at: 0, until: 25,
    url: () => `${SITE}/bank`,
    what: "四张阶段卡 + Run again 按钮（正式录时在这里点击）",
    focus: '.runpanel',
    assert: [
      { name: "Run 按钮存在且可点", expr:
        `(()=>{const b=[...document.querySelectorAll('button')].find(x=>/run again|run the bank/i.test(x.textContent||''));return b?(b.disabled?'disabled':'ok'):'missing'})()`,
        want: "ok" },
      { name: "四张阶段卡都在", expr: `document.querySelectorAll('.stage').length`, want: 4 },
      { name: "四张余额卡都在", expr: `document.querySelectorAll('.balances .card').length`, want: 4 },
    ],
  },
  {
    id: "2-deck-how",
    at: 25, until: 55,
    url: () => DECK,
    scrollTo: slideY(4),
    what: "deck 第 4 页 How it works",
    assert: [
      { name: "deck 共 9 页", expr: `document.querySelectorAll('section.slide').length`, want: 9 },
      { name: "第 4 页可定位", expr: slideY(4), wantType: "number" },
    ],
  },
  {
    id: "3-deposit-hash",
    at: 55, until: 68,
    url: () => `${SITE}/bank`,
    what: "Deposit 卡已绿 + 交易哈希",
    focus: '.stages',
    assert: [
      { name: "Deposit 卡显示 done", expr:
        `(()=>{const s=[...document.querySelectorAll('.stage')].find(e=>/deposit/i.test(e.textContent||''));return s?(s.className.match(/done|running|failed|skipped/)||['none'])[0]:'missing'})()`,
        want: "done" },
      { name: "流水里有 Arcscan 链接", expr:
        `document.querySelectorAll('a.tx[href*="arcscan"]').length > 0`, want: true },
    ],
  },
  {
    id: "3b-arcscan",
    at: 68, until: 78,
    // Navigated in the same tab on purpose: the ledger's link is target=_blank
    // and a new tab is not what the recorder is bound to.
    url: (ctx) => ctx.arcscanUrl,
    what: "Arcscan 上那笔 mint（同标签导航，不点 _blank 链接）",
    settle: 4000,
    assert: [
      { name: "页面不是错误页", expr:
        `!/not found|error/i.test(document.title) && document.body.innerText.length > 200`, want: true },
    ],
  },
  {
    id: "4-earn",
    at: 78, until: 96,
    url: () => `${SITE}/bank`,
    what: "Earn 卡 + USYC 余额（旁白念屏幕上的实际数字）",
    focus: '.balances',
    assert: [
      { name: "Earn 卡显示 done", expr:
        `(()=>{const s=[...document.querySelectorAll('.stage')].find(e=>/earn/i.test(e.textContent||''));return s?(s.className.match(/done|running|failed|skipped/)||['none'])[0]:'missing'})()`,
        want: "done" },
      { name: "Earn 文案里有 USYC 数量", expr:
        `(()=>{const s=[...document.querySelectorAll('.stage')].find(e=>/earn/i.test(e.textContent||''));return s? /minted [0-9.]+ USYC/.test(s.textContent) : false})()`,
        want: true },
      { name: "Yield sleeve 卡有数字", expr:
        `(()=>{const c=[...document.querySelectorAll('.balances .card')].find(e=>/yield sleeve/i.test(e.textContent||''));return c? /[0-9]+\\.[0-9]+/.test(c.querySelector('.value')?.textContent||'') : false})()`,
        want: true },
    ],
  },
  {
    id: "5-market",
    at: 96, until: 116,
    url: () => `${SITE}/market`,
    what: "四个摊位 + 探测徽章 + 开放登记",
    focus: '.listing-table',
    assert: [
      { name: "至少四条挂牌", expr: `document.querySelectorAll('.listing-row').length >= 4`, want: true },
      { name: "有 FIRST-PARTY 徽章", expr: `/first-party/i.test(document.body.innerText)`, want: true },
      { name: "水龙头区块在", expr: `document.querySelectorAll('.tryit').length`, want: 1 },
    ],
  },
  {
    id: "6-blocked",
    at: 116, until: 142,
    url: () => `${SITE}/ledger`,
    what: "主镜头：BLOCKED 那行 + 拒绝理由",
    focus: 'table.ledger',
    assert: [
      { name: "有 BLOCKED 记录", expr: `/BLOCKED/.test(document.body.innerText)`, want: true },
      { name: "拒绝理由写着超限", expr:
        `/exceeds per-tx limit \\$0\\.01/.test(document.body.innerText)`, want: true },
      { name: "同一张表里也有 SETTLED", expr: `/SETTLED/.test(document.body.innerText)`, want: true },
    ],
  },
  {
    id: "7-autonomy",
    at: 142, until: 166,
    url: () => `${SITE}/agents`,
    what: "自主运行面板：三笔成交 → 被拒 → 向人类上报",
    focus: '.steps',
    assert: [
      { name: "面板有五步", expr: `document.querySelectorAll('.runpanel .step, .steps .step').length`, want: 5 },
      { name: "第四步是 refused", expr: `/refused/i.test(document.body.innerText)`, want: true },
      { name: "有『↑ to the human』上报", expr:
        `document.querySelectorAll('.stepescalate').length > 0`, want: true },
      { name: "上报文字点名了金额", expr:
        `/raise the per-transaction limit to at least \\$0\\.05/i.test(document.body.innerText)`, want: true },
    ],
  },
  {
    id: "8-deck-close",
    at: 166, until: 180,
    url: () => DECK,
    scrollTo: slideY(9),
    what: "deck 尾页 Shipped / Next",
    assert: [
      { name: "第 9 页可定位", expr: slideY(9), wantType: "number" },
    ],
  },
];
