// PlayUEF round-trip test.
//
// For every game in test/data that has a matching real-tape CSW capture and a
// UEF, this proves that the WAV PlayUEF generates from the UEF carries the
// same files as the original tape:
//
//   real tape CSW ---------------decode--------------> CFS blocks  (reference)
//   UEF --PlayUEF--> WAV --zero-crossing+decode------> CFS blocks  (under test)
//
// Assertion: every CFS block we can read from the real tape *with certainty*
// (valid header CRC and valid data CRC) must be reproduced byte-for-byte by
// PlayUEF. Blocks where the CSW decode itself fails its data CRC are dropped
// from the reference — those are real-tape read errors / decode noise, not
// something PlayUEF should be judged against. PlayUEF is allowed to produce
// *extra* blocks: its synthetic audio is cleaner than a noisy cassette, so it
// often recovers blocks the original recording could not.
//
// The comparison is at the decoded-data level, so it is invariant to
// carrier-tone length, gap timing and sample rate, which all differ between a
// real recording and PlayUEF's synthetic output.

const fs   = require('fs');
const path = require('path');
const tape = require('./lib/tape.js');

// console silencing so uef2wave's verbose logging doesn't drown the report.
function quiet(fn) {
  const log = console.log, time = console.time, timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  try { return fn(); } finally { console.log = log; console.time = time; console.timeEnd = timeEnd; }
}
const playuef = quiet(() => require('./lib/playuef.js'));

const DATA = path.join(__dirname, 'data');

// Collect { name, uef, csw } pairs: every .csw that has a sibling .uef.
function findPairs() {
  const pairs = [];
  for (const dir of fs.readdirSync(DATA)) {
    const full = path.join(DATA, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.toLowerCase().endsWith('.csw')) continue;
      const base = f.slice(0, -4);
      const uef  = path.join(full, base + '.uef');
      if (fs.existsSync(uef)) {
        pairs.push({ name: dir + '/' + base, uef, csw: path.join(full, f) });
      }
    }
  }
  return pairs.sort((a, b) => a.name.localeCompare(b.name));
}

// Identify a block by file + load address + block number. The load address
// matters because some tapes (e.g. Knight Lore) hold several distinct files
// that share a filename but load at different addresses.
const key = b => `${b.name}@${(b.load >>> 0).toString(16)}#${b.blkNum}`;
const hex = b => Buffer.from(b.data || []).toString('hex');

// PlayUEF's audio length should track the real tape. With per-section base
// frequencies (UEF 0x0113) honoured, real tapes all land within ~2.5%, so 5%
// is a tight guard: it catches both the historical carrier bug (~40% long) and
// a regression that stopped honouring 0x0113 (~7% off).
const DURATION_TOLERANCE = 0.05;

function comparePair(pair) {
  const csw    = tape.readCSW(fs.readFileSync(pair.csw));
  const cswAll = tape.decodeTape(csw.pulses, csw.sampleRate);
  const ref    = cswAll.filter(b => b.dcrcOK);        // trusted reference blocks only
  const cswDur = csw.pulses.reduce((a, b) => a + b, 0) / csw.sampleRate;

  const wav  = quiet(() => playuef.generateWav(fs.readFileSync(pair.uef)));
  const got  = tape.decodeTape(tape.pcmToPulses(wav.pcm), wav.sampleRate);
  const gotMap = new Map(got.map(b => [key(b), b]));
  const puDur = wav.pcm.length / wav.sampleRate;

  const missing = [], diff = [];
  for (const b of ref) {
    const g = gotMap.get(key(b));
    if (!g)               missing.push(key(b));
    else if (hex(g) !== hex(b)) diff.push(key(b));
  }
  const durDelta = Math.abs(puDur - cswDur) / cswDur;
  const durOK = durDelta <= DURATION_TOLERANCE;
  const pass = ref.length > 0 && missing.length === 0 && diff.length === 0 && durOK;
  return {
    pass,
    refTrusted: ref.length,
    refNoisy:   cswAll.length - ref.length,   // CSW blocks dropped as unreliable
    gotCount:   got.length,
    extra:      got.length - ref.length,
    cswDur, puDur, durDelta, durOK,
    missing, diff
  };
}

function main() {
  const pairs = findPairs();
  if (pairs.length === 0) { console.error('No CSW/UEF pairs found under test/data'); process.exit(1); }

  console.log(`\nPlayUEF round-trip test — ${pairs.length} tape(s)\n`);
  let failures = 0;
  for (const pair of pairs) {
    let r;
    try { r = comparePair(pair); }
    catch (e) { console.log(`FAIL  ${pair.name}\n        error: ${e.message}`); failures++; continue; }

    const extraNote = r.extra > 0 ? `, +${r.extra} extra recovered` : '';
    const dur = `${r.puDur.toFixed(0)}s vs tape ${r.cswDur.toFixed(0)}s`;
    if (r.pass) {
      console.log(`PASS  ${pair.name}  (${r.refTrusted} tape blocks reproduced${extraNote}; ${dur})`);
    } else {
      failures++;
      console.log(`FAIL  ${pair.name}`);
      console.log(`        tape blocks (trusted) ${r.refTrusted}, PlayUEF blocks ${r.gotCount}`);
      if (r.missing.length) console.log(`        ${r.missing.length} tape block(s) missing from PlayUEF: ${r.missing.slice(0, 5).join(', ')}`);
      if (r.diff.length)    console.log(`        ${r.diff.length} block(s) with differing data: ${r.diff.slice(0, 5).join(', ')}`);
      if (!r.durOK)         console.log(`        duration off by ${(r.durDelta * 100).toFixed(0)}% (${dur}, tolerance ${(DURATION_TOLERANCE * 100)}%)`);
    }
  }
  console.log(`\n${pairs.length - failures}/${pairs.length} passed\n`);
  process.exit(failures ? 1 : 0);
}

main();
