// Two subtitle tracks off one timeline.
//
// display.srt is burned into the picture and keeps CCTP, USYC and x402 — the
// judges are from Circle and the precision is the point when it is read.
//
// tts.srt drives CapCut's 文本朗读 and spells those out into words, because a
// speech engine reads CCTP as "C-C-T-P" and USYC as "U-S-Y-C", which is slow
// enough to overrun the cue and collide with the next line of speech.
//
// Cue length follows word count, not the clock, for the same reason: a cue
// holding more words than its seconds can carry is where TTS overruns start.
//
//   node video/build-srt.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SHOTS = [
  {
    at: 0, until: 25,
    text:
      "AI agents are starting to earn and spend real money. " +
      "But an agent's money has nowhere to live. " +
      "It sits in a raw wallet, earning nothing, governed by nothing — because a private key is all-or-nothing. " +
      "Ovolyn is a bank account built for an autonomous depositor. " +
      "I've just started a live run on Arc; let's talk while it settles.",
  },
  {
    at: 25, until: 55,
    text:
      "One account on Arc, four flows. " +
      "Deposit USDC from any chain over CCTP. " +
      "Idle balance sweeps into tokenized treasury yield. " +
      "A human sets the policy. " +
      "And the agent spends inside it, on its own, over x402. " +
      "It is built on Circle's own rails — Agent Stack for the wallet, Gateway for settlement, CCTP for the deposit, App Kit for currency, and USYC for the yield. " +
      "Nothing here is simulated.",
  },
  {
    at: 55, until: 78,
    text:
      "Deposit landed — three USDC burned on Sepolia, minted on Arc. " +
      "Thirty-four seconds, and I want to be precise about where that goes: " +
      "Circle's fast attestation waits two Ethereum confirmations — Sepolia's twelve-second slots. " +
      "The standard path would be fifteen to nineteen minutes. " +
      "Arc's own blocks are half a second. " +
      "Every hash here is live on Arcscan.",
  },
  {
    at: 78, until: 96,
    text:
      "The balance crossed the idle threshold, so the account swept the excess into USYC — tokenized treasury. " +
      "You can see the exact amount minted, on-chain. " +
      "The war chest earns while the agent sleeps.",
  },
  {
    at: 96, until: 116,
    text:
      "Then it spent. " +
      "A gas oracle priced at a tenth of a cent, bought from an independent merchant, settled through Gateway — 402 to 200. " +
      "These listings are open: anyone lists by signing with the address they want paid at, and an automated probe admits them. " +
      "There is no approval queue.",
  },
  {
    at: 116, until: 142,
    text:
      "And then it tried to spend five cents. Refused. " +
      "The policy caps any single transaction at one cent, so the payment never happened — " +
      "and the refusal is written into the ledger with its reason, right next to the payments that succeeded. " +
      "A bank that only records what succeeded isn't a bank.",
  },
  {
    at: 142, until: 166,
    text:
      "That boundary is what makes autonomy safe. " +
      "Given an open goal, the agent bought the three services it could afford. " +
      "When the deepest analysis came in over the limit, it didn't overreach and it didn't quietly drop it — " +
      "it stopped and asked me to raise the limit, naming the service and the number. " +
      "It asked, rather than took.",
  },
  {
    at: 166, until: 180,
    text:
      "Authority is created by humans; permission is derived to machines. " +
      "Built on Arc, with Circle's stack. Agentic Economy and DeFi. " +
      "We monetize the balance sheet — payments are why the balance exists.",
  },
];

// What a speech engine should say instead of what the screen should show.
// Kept close to the same length as what they replace: a spoken line that runs
// longer than the line it stands in for is the overrun this is meant to avoid.
const SPOKEN = [
  [/\bover CCTP\b/g, "over cross-chain transfer"],
  [/\bCCTP for the deposit\b/g, "cross-chain for the deposit"],
  [/\bUSYC for the yield\b/g, "treasury bills for the yield"],
  [/\binto USYC — tokenized treasury\b/g, "into tokenized treasury bills"],
  [/\bover x402\b/g, "over x four-oh-two"],
  [/\b402 to 200\b/g, "four-oh-two to two hundred"],
  [/\bDeFi\b/g, "dee-fye"],
];

const speak = (s) => SPOKEN.reduce((acc, [re, to]) => acc.replace(re, to), s);

const clock = (s) => {
  const ms = Math.round((s % 1) * 1000);
  const t = Math.floor(s);
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

/** Split on sentence ends, then merge fragments too short to be their own cue. */
function cues(text) {
  const parts = text.match(/[^.!?—]+(?:[.!?]|—|$)/g).map((s) => s.trim()).filter(Boolean);
  const merged = [];
  for (const p of parts) {
    const prev = merged[merged.length - 1];
    if (prev && (prev.split(/\s+/).length < 7 || p.split(/\s+/).length < 5)) {
      merged[merged.length - 1] = `${prev} ${p}`;
    } else merged.push(p);
  }
  return merged;
}

/** Two lines, break near the middle at a space — one long line reads badly. */
function wrap(s) {
  if (s.length <= 42) return s;
  const mid = Math.floor(s.length / 2);
  let cut = s.lastIndexOf(" ", mid);
  if (cut < 12) cut = s.indexOf(" ", mid);
  return cut < 0 ? s : `${s.slice(0, cut)}\n${s.slice(cut + 1)}`;
}

function build(spoken) {
  const out = [];
  let n = 0;
  for (const shot of SHOTS) {
    const span = shot.until - shot.at;
    // Substitute FIRST, then weigh: the spoken text is what has to fit the
    // seconds it is given, and it is not the same length as the shown text.
    const list = cues(spoken ? speak(shot.text) : shot.text);
    const weights = list.map((c) => c.split(/\s+/).length);
    const total = weights.reduce((a, b) => a + b, 0);
    let t = shot.at;
    list.forEach((c, i) => {
      // Seconds in proportion to words, so no cue carries more than it can say.
      const dur = i === list.length - 1 ? shot.until - t : (span * weights[i]) / total;
      out.push(`${++n}\n${clock(t)} --> ${clock(t + dur)}\n${wrap(c)}\n`);
      t += dur;
    });
  }
  return out.join("\n");
}

for (const [file, spoken] of [["video/ovolyn.display.srt", false], ["video/ovolyn.tts.srt", true]]) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, build(spoken));
  console.log(`  wrote ${file}`);
}

// Report the pace of every cue: over ~165 wpm a speech engine starts to overrun.
const src = build(true).split("\n\n").filter(Boolean);
let worst = 0, worstCue = "";
for (const block of src) {
  const [, time, ...rest] = block.split("\n");
  const [a, b] = time.split(" --> ").map((x) => {
    const [h, m, s] = x.split(":");
    return Number(h) * 3600 + Number(m) * 60 + parseFloat(s.replace(",", "."));
  });
  const words = rest.join(" ").split(/\s+/).filter(Boolean).length;
  const wpm = (words / (b - a)) * 60;
  if (wpm > worst) { worst = wpm; worstCue = rest.join(" ").slice(0, 50); }
}
console.log(`  cues: ${src.length} · fastest ${worst.toFixed(0)} wpm — "${worstCue}…"`);
console.log(worst <= 165 ? "  ✅ every cue is inside a speakable pace" : "  ⚠️ a cue is too dense; split it");
