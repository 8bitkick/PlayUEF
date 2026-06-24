// PlayUEF structural-fidelity test (the non-data chunks).
//
// csw_test.js / encode_test.js / makeuef_arbiter_test.js all check the *data*
// blocks. They deliberately ignore everything else — carrier tone, gaps,
// security cycles, per-section base frequency and phase. This test covers that
// gap by measuring the *actual rendered PCM* against what each structural chunk
// in the UEF asks for. PlayUEF tags every chunk with the sample position it was
// written at (chunk.timestamp), so each region can be located and inspected.
//
// What it asserts, per structural chunk, reading real samples:
//   * 0x0112 / 0x0116 gap          — the region is pure silence of the right length
//   * 0x0110 / 0x0111 carrier tone — a high-frequency tone, right cycle count,
//                                    and the oscillation period matches the
//                                    currently-active base frequency (this is
//                                    what proves 0x0113 base-freq changes take
//                                    effect — a carrier after a 1216 Hz change
//                                    must oscillate at 1216, not a fixed 1200)
//   * 0x0114 security cycles       — the high/low wave pattern matches the chunk's
//                                    bit pattern (NOT rendered as flat carrier)
//   * 0x0113 base frequency        — verified via the following carrier (above)
//   * 0x0115 phase change          — the waveform after the change correlates
//                                    better with the new phase than the old one
//
// Pure PlayUEF + the in-repo tools; no MakeUEF needed, always runs in `npm test`.

const fs   = require('fs');
const path = require('path');
const tape = require('./lib/tape.js');

function quiet(fn) {
  const log = console.log, time = console.time, timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  try { return fn(); } finally { console.log = log; console.time = time; console.timeEnd = timeEnd; }
}
const playuef = quiet(() => require('./lib/playuef.js'));

const DATA      = path.join(__dirname, 'data');
const D         = playuef.DEFAULTS;                 // baud 1200, sampleRate 48000, phase π, ...
const HIGH_RATIO = D.highFreq / D.baud;             // '1'/carrier freq relative to base (2)

function findUefs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findUefs(full));
    else if (e.name.toLowerCase().endsWith('.uef')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// generateTone() length: floor((sampleRate / freq) * cycles).
const toneLen = (SR, freq, cycles) => Math.floor((SR / freq) * cycles);

// Peak absolute amplitude over [a, b).
function peak(pcm, a, b) {
  let m = 0;
  for (let i = a; i < b; i++) { const v = pcm[i] < 0 ? -pcm[i] : pcm[i]; if (v > m) m = v; }
  return m;
}

// Dot-product of a PCM region against a reference sine of (freq, phase).
function corr(pcm, start, n, SR, freq, phase) {
  let dot = 0;
  for (let k = 0; k < n; k++) dot += pcm[start + k] * Math.sin(phase + (k / SR) * (freq * 2 * Math.PI));
  return dot;
}

function checkUef(file) {
  return checkWav(quiet(() => playuef.generateWav(fs.readFileSync(file))));
}

// Core check, separated so the negative-control test can hand it a deliberately
// corrupted render and confirm each structural check actually fires.
function checkWav(wav) {
  const pcm    = wav.pcm, SR = wav.sampleRate, chunks = wav.chunks;
  const spc    = Math.floor(SR / D.baud);           // samplesPerCycle for integer gaps
  const fails  = [];
  const seen   = { gap: 0, carrier: 0, security: 0, baseFreq: 0, phase: 0 };

  let curBase = D.baud, curPhase = D.phase;
  let pendOld = null, pendTag = '';           // a phase change awaiting the next tone to verify against
  const TONE = new Set(['carrierTone', 'securityCycles', 'dataBlock', 'definedDataBlock']);
  const tsEnd = i => (i + 1 < chunks.length ? chunks[i + 1].timestamp : pcm.length);

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i], start = c.timestamp, end = tsEnd(i), len = end - start;
    const tag = `@${start}`;

    // A phase change (0x0115) only shows up in the audio at the next tone it
    // precedes — gaps in between are silent. Verify it there, with the base
    // frequency and phase that are actually in effect at that tone.
    if (pendOld !== null && TONE.has(c.type) && len > 0) {
      const freq = c.type === 'carrierTone'     ? curBase * HIGH_RATIO
                 : c.type === 'securityCycles'  ? (c.bits[0] === 1 ? curBase * HIGH_RATIO : curBase)
                 : curBase;                                  // data: first wave is the bit0 start bit
      const n = Math.floor(SR / freq);
      if (start + n <= pcm.length && Math.abs(curPhase - pendOld) > 0.05) {
        const cNew = corr(pcm, start, n, SR, freq, curPhase);
        const cOld = corr(pcm, start, n, SR, freq, pendOld);
        if (cNew <= cOld)
          fails.push(`phase ${pendTag}: ${(curPhase * 180 / Math.PI).toFixed(0)}deg not applied at ${tag} ` +
                     `(corr new ${cNew.toFixed(0)} <= old ${cOld.toFixed(0)})`);
      }
      pendOld = null;
    }

    if (c.type === 'integerGap') {
      seen.gap++;
      const want = (c.samples != null) ? c.samples : spc * c.cycles;
      if (len !== want) fails.push(`gap ${tag}: length ${len} != expected ${want}`);
      else if (peak(pcm, start, end) !== 0) fails.push(`gap ${tag}: not silent (peak ${peak(pcm, start, end)})`);

    } else if (c.type === 'carrierTone') {
      seen.carrier++;
      const cycLen = toneLen(SR, curBase * HIGH_RATIO, 1);     // expected samples per carrier cycle
      if (len !== c.cycles * cycLen) {
        fails.push(`carrier ${tag}: length ${len} != ${c.cycles}x${cycLen}`);
      } else if (c.cycles > 4) {                               // skip tiny inter-block carriers
        const pulses = tape.pcmToPulses(pcm.subarray(start, end));
        const cls    = tape.classify(pulses, SR);
        const shortFrac = cls.length ? cls.reduce((s, v) => s + (v === 0 ? 1 : 0), 0) / cls.length : 0;
        const measCyc   = pulses.length / 2;                  // 2 half-pulses per cycle
        const measCycLen = len / measCyc;                     // actual oscillation period
        if (shortFrac < 0.9)
          fails.push(`carrier ${tag}: not a pure high-freq tone (short pulses ${(shortFrac * 100).toFixed(0)}%)`);
        else if (Math.abs(measCyc - c.cycles) > Math.max(2, c.cycles * 0.02))
          fails.push(`carrier ${tag}: measured ${measCyc.toFixed(0)} cycles, expected ${c.cycles}`);
        else if (Math.abs(measCycLen - cycLen) > 1.5)
          fails.push(`carrier ${tag}: period ${measCycLen.toFixed(1)} != ${cycLen} (base ${curBase.toFixed(0)}Hz not applied?)`);
      }

    } else if (c.type === 'securityCycles') {
      seen.security++;
      const wantLow  = c.bits.reduce((s, b) => s + (b === 0 ? 1 : 0), 0);   // low-freq (1200) cycles
      const wantHigh = c.bits.length - wantLow;
      const pulses = tape.pcmToPulses(pcm.subarray(start, end));
      const cls    = tape.classify(pulses, SR);
      const longHalf  = cls.reduce((s, v) => s + (v === 1 ? 1 : 0), 0);     // long = 1200Hz half-pulses
      const measLow   = longHalf / 2;                                       // ~2 half-pulses per low cycle
      if (peak(pcm, start, end) === 0) {
        fails.push(`security ${tag}: silent, expected ${c.bits.length} cycles`);
      } else if (Math.abs(measLow - wantLow) > 1.5) {
        fails.push(`security ${tag}: ${measLow.toFixed(1)} low cycles, pattern wants ${wantLow}` +
                   (wantLow > 0 && measLow < 0.5 ? ' (rendered as flat carrier?)' : ''));
      }
      void wantHigh;

    } else if (c.type === 'baseFreq') {
      seen.baseFreq++;
      curBase = c.freq;                                   // following carrier/data check enforces it

    } else if (c.type === 'phaseChange') {
      seen.phase++;
      if (pendOld === null) { pendOld = curPhase; pendTag = tag; }   // keep the oldest pending phase
      curPhase = c.phase;
    }
  }
  return { fails, seen };
}

function main() {
  const uefs = findUefs(DATA);
  console.log(`\nPlayUEF structural-fidelity test — ${uefs.length} UEF(s)\n`);
  let failures = 0;
  for (const file of uefs) {
    const name = path.relative(DATA, file);
    let r;
    try { r = checkUef(file); }
    catch (e) { console.log(`FAIL  ${name}\n        error: ${e.message}`); failures++; continue; }

    const s = r.seen;
    const summary = `gap:${s.gap} carrier:${s.carrier} sec:${s.security} base:${s.baseFreq} phase:${s.phase}`;
    if (r.fails.length === 0) {
      console.log(`PASS  ${name}  (${summary})`);
    } else {
      failures++;
      console.log(`FAIL  ${name}  (${summary})`);
      for (const f of r.fails.slice(0, 5)) console.log(`        ${f}`);
      if (r.fails.length > 5) console.log(`        ...and ${r.fails.length - 5} more`);
    }
  }
  console.log(`\n${uefs.length - failures}/${uefs.length} passed\n`);
  process.exit(failures ? 1 : 0);
}

if (require.main === module) main();

module.exports = { playuef, quiet, checkWav, findUefs, DATA };
