// Two subtitle tracks off one timeline.
//
// display.srt is burned into the picture and keeps CCTP, USYC and x402 — the
// judges are from Circle and the precision is the point when it is read.
//
// tts.srt drives CapCut's 文本朗读 and spells those out into words, because a
// speech engine reads CCTP as "C-C-T-P", which is slow enough to overrun.
//
// Both files carry the SAME cue boundaries and the SAME timings, so a burned
// line and the voice reading it stay together. Duration comes from how long
// the SPOKEN text takes to say, since that is what the engine actually does.
//
// The first version of this got two things wrong, both visible on screen:
//   · it merged short fragments into their neighbour, producing cues of two
//     sentences that covered the frame.
//   · it spread each shot's seconds across its cues, which stretched every cue
//     to fill the shot. The voice finished early and the line sat there.
// So: one clause per cue, and a cue lasts as long as its words take.
//
//   node video/build-srt.mjs            # 165 wpm
//   RATE=150 node video/build-srt.mjs   # slower voice

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const RATE = Number(process.env.RATE || 165); // words per minute the voice reads at
const GAP = 0.18;   // silence between cues, so lines do not butt together
const MAX_LINE = 40; // characters per line
const MAX_LINES = 2;
const MIN_DUR = 1.1;

const SHOTS = [
  { at: 0, until: 25, text:
    "AI agents are starting to earn and spend real money. " +
    "But an agent's money has nowhere to live. " +
    "It sits in a raw wallet, earning nothing, governed by nothing, " +
    "because a private key is all-or-nothing. " +
    "Ovolyn is a bank account built for an autonomous depositor. " +
    "I've just started a live run on Arc. Let's talk while it settles." },
  { at: 25, until: 55, text:
    "One account on Arc, four flows. " +
    "Deposit USDC from any chain over CCTP. " +
    "Idle balance sweeps into tokenized treasury yield. " +
    "A human sets the policy. " +
    "And the agent spends inside it, on its own, over x402. " +
    "It is built on Circle's own rails: " +
    "Agent Stack for the wallet, Gateway for settlement, " +
    "CCTP for the deposit, App Kit for currency, USYC for the yield. " +
    "Nothing here is simulated." },
  { at: 55, until: 78, text:
    "Deposit landed. " +
    "Three USDC burned on Sepolia, minted on Arc. " +
    "Thirty-three seconds, and I want to be precise about where that goes. " +
    "Circle's fast attestation waits two Ethereum confirmations, " +
    "and those are Sepolia's twelve-second slots. " +
    "The standard path would be fifteen to nineteen minutes. " +
    "Arc's own blocks are half a second. " +
    "Every hash here is live on Arcscan." },
  { at: 78, until: 96, text:
    "The balance crossed the idle threshold, " +
    "so the account swept the excess into USYC. " +
    "Tokenized treasury. " +
    "You can see the exact amount minted, on-chain. " +
    "The war chest earns while the agent sleeps." },
  { at: 96, until: 116, text:
    "Then it spent. " +
    "A gas oracle priced at a tenth of a cent, " +
    "bought from an independent merchant, " +
    "settled through Gateway. 402 to 200. " +
    "These listings are open. " +
    "Anyone lists by signing with the address they want paid at, " +
    "and an automated probe admits them. " +
    "There is no approval queue." },
  { at: 116, until: 142, text:
    "And then it tried to spend five cents. Refused. " +
    "The policy caps any single transaction at one cent, " +
    "so the payment never happened. " +
    "And the refusal is written into the ledger with its reason, " +
    "right next to the payments that succeeded. " +
    "A bank that only records what succeeded isn't a bank." },
  { at: 142, until: 166, text:
    "That boundary is what makes autonomy safe. " +
    "Given an open goal, the agent bought the three services it could afford. " +
    "When the deepest analysis came in over the limit, " +
    "it didn't overreach and it didn't quietly drop it. " +
    "It stopped and asked me to raise the limit, " +
    "naming the service and the number. " +
    "It asked, rather than took." },
  { at: 166, until: 180, text:
    "Authority is created by humans; permission is derived to machines. " +
    "Built on Arc, with Circle's stack. " +
    "Agentic Economy and DeFi. " +
    "We monetize the balance sheet. " +
    "Payments are why the balance exists." },
];

// Said aloud, not shown. Kept close in length to what they replace.
const SPOKEN = [
  [/\bover CCTP\b/g, "over cross-chain transfer"],
  [/\bCCTP for the deposit\b/g, "cross-chain for the deposit"],
  [/\bUSYC for the yield\b/g, "treasury bills for the yield"],
  [/\binto USYC\b/g, "into tokenized treasury bills"],
  [/\bover x402\b/g, "over x four-oh-two"],
  [/\b402 to 200\b/g, "four-oh-two to two hundred"],
  [/\bDeFi\b/g, "dee-fye"],
];
const speak = (s) => SPOKEN.reduce((a, [re, to]) => a.replace(re, to), s);

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** Round to whole milliseconds FIRST, then split.
 *  Flooring the seconds and rounding the fraction separately loses the carry:
 *  68.9996 became "00:01:08,1000", a four-digit millisecond field that parsers
 *  read as 68.1 — the cue then opened early and overlapped the one before it. */
const clock = (sec) => {
  const total = Math.max(0, Math.round(sec * 1000));
  const ms = total % 1000;
  const s = (total - ms) / 1000;
  return `${String((s / 3600) | 0).padStart(2, "0")}:${String(((s / 60) | 0) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

/** One clause per cue. Split at sentence ends, then at clause marks, then —
 *  only if still too wide — at a space. Nothing is ever merged. */
function split(text) {
  const budget = MAX_LINE * MAX_LINES;
  let parts = text.match(/[^.!?]+[.!?]?/g).map((s) => s.trim()).filter(Boolean);
  const byClause = [];
  for (const p of parts) {
    if (p.length <= budget) { byClause.push(p); continue; }
    let buf = "";
    for (const piece of p.split(/(?<=[,;:—])\s+/)) {
      if (buf && (buf + " " + piece).length > budget) { byClause.push(buf); buf = piece; }
      else buf = buf ? `${buf} ${piece}` : piece;
    }
    if (buf) byClause.push(buf);
  }
  const out = [];
  for (const p of byClause) {
    if (p.length <= budget) { out.push(p); continue; }
    let buf = "";
    for (const w of p.split(/\s+/)) {
      if (buf && (buf + " " + w).length > budget) { out.push(buf); buf = w; }
      else buf = buf ? `${buf} ${w}` : w;
    }
    if (buf) out.push(buf);
  }
  return out;
}

/** Break into at most MAX_LINES lines at a space, never mid-word. */
function wrap(s) {
  if (s.length <= MAX_LINE) return s;
  const lines = [];
  let buf = "";
  for (const w of s.split(/\s+/)) {
    if (buf && (buf + " " + w).length > MAX_LINE) { lines.push(buf); buf = w; }
    else buf = buf ? `${buf} ${w}` : w;
  }
  if (buf) lines.push(buf);
  return lines.slice(0, MAX_LINES).join("\n") + (lines.length > MAX_LINES ? " " + lines.slice(MAX_LINES).join(" ") : "");
}

const cues = [];
const report = [];
for (const shot of SHOTS) {
  const shown = split(shot.text);
  let t = shot.at;
  for (const s of shown) {
    const spokenText = speak(s);
    // A cue lasts as long as its words take to say — not as long as the
    // remaining slice of the shot.
    const dur = Math.max(MIN_DUR, (words(spokenText) / RATE) * 60);
    cues.push({ start: t, end: t + dur, show: s, say: spokenText });
    t += dur + GAP;
  }
  const used = t - GAP - shot.at;
  const span = shot.until - shot.at;
  report.push({ at: shot.at, span, used, n: shown.length, over: used > span });
}

const render = (pick) =>
  cues.map((c, i) => `${i + 1}\n${clock(c.start)} --> ${clock(c.end)}\n${wrap(pick(c))}\n`).join("\n");

for (const [file, pick] of [
  ["video/ovolyn.display.srt", (c) => c.show],
  ["video/ovolyn.tts.srt", (c) => c.say],
]) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(pick));
  console.log(`  wrote ${file}`);
}

const longest = cues.reduce((a, b) => (b.show.length > a.show.length ? b : a));
const longestDur = cues.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
console.log(`\n  ${cues.length} cues at ${RATE} wpm`);
console.log(`  最长一条 ${longest.show.length} 字符：“${longest.show.slice(0, 52)}…”`);
console.log(`  最久一条 ${(longestDur.end - longestDur.start).toFixed(1)}s`);
console.log(`  说话总时长 ${cues.reduce((s, c) => s + (c.end - c.start), 0).toFixed(1)}s / 180s\n`);
console.log("  幕     窗口   占用   条数");
for (const r of report) {
  console.log(`  ${String(r.at).padStart(3)}s  ${String(r.span).padStart(4)}s ${r.used.toFixed(1).padStart(6)}s  ${String(r.n).padStart(3)}   ${r.over ? "❌ 超出窗口" : ""}`);
}
const bad = report.filter((r) => r.over).length;
console.log(bad ? `\n  ❌ ${bad} 幕的旁白装不下——删字或调 RATE` : "\n  ✅ 每一幕都装得下");

// Read the files back and check them as a parser would. Writing a timestamp is
// not the same as writing a valid one, and the malformed millisecond that
// caused two cues to overlap was invisible until something parsed it.
console.log("\n  自检（回读文件，按解析器的眼光看）");
let problems = 0;
for (const file of ["video/ovolyn.display.srt", "video/ovolyn.tts.srt"]) {
  const raw = (await import("node:fs")).readFileSync(file, "utf8");
  const blocks = raw.trim().split("\n\n");
  const secs = (s) => {
    const m = s.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
    if (!m) { console.log(`  ❌ ${file} 时间码畸形：“${s}”`); problems++; return NaN; }
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
  };
  let prevEnd = -1;
  blocks.forEach((b, i) => {
    const [n, time, ...text] = b.split("\n");
    if (Number(n) !== i + 1) { console.log(`  ❌ ${file} 序号跳号于 #${n}`); problems++; }
    const [a, z] = time.split(" --> ");
    const s = secs(a), e = secs(z);
    if (e <= s) { console.log(`  ❌ ${file} #${n} 结束不晚于开始`); problems++; }
    if (s < prevEnd - 1e-9) { console.log(`  ❌ ${file} #${n} 与上一条重叠`); problems++; }
    if (text.length > MAX_LINES) { console.log(`  ❌ ${file} #${n} 有 ${text.length} 行`); problems++; }
    if (e > 180.001) { console.log(`  ❌ ${file} #${n} 超出 180s`); problems++; }
    prevEnd = e;
  });
}
console.log(problems === 0 ? "  ✅ 时间码合法、无重叠、无跳号、不超 2 行、不超 180s" : `  ❌ ${problems} 处问题`);
process.exit(problems === 0 && bad === 0 ? 0 : 1);
