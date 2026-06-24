// PlayUEF round-trip arbitrated by the real MakeUEF.
//
// csw_test.js / encode_test.js decode PlayUEF's audio with the in-repo
// open-source decoder (lib/tape.js). This test instead hands PlayUEF's audio
// to the *closed-source professional MakeUEF V2.4* — the reference tool that
// produced the UEFs in the first place — and asks it to arbitrate:
//
//   UEF --PlayUEF--> WAV --> CSW --MakeUEF.exe <tape's own flags>--> UEF'  (under test)
//   UEF (original, produced by MakeUEF from the real tape)                 (reference)
//
// The MakeUEF flags are NOT hardcoded — they are read from each tape's sibling
// !BuildUEF.bat (see flagsFor). They are genuinely tape-specific: -w 0 180 (the
// recorded phase) applies only to some tapes, and the per-block -z parity hints
// produce the &0104 blocks. Replaying the exact flags MakeUEF used to make the
// reference is the only fair round-trip; forcing one tape's flags on all of them
// makes MakeUEF misread the others' data tones as security waves (recovers none).
//
// We then parse every data block — &0100 (implicit 8N1) and &0104 (defined
// format, e.g. 8E1/8O1) — from both UEFs and compare. Because MakeUEF made the
// original, a faithful PlayUEF render must round-trip back to the same blocks.
//
// MakeUEF is proprietary and is NOT bundled here. Point MAKEUEF_EXE at a
// MakeUEF.exe whose runtime DLLs sit alongside it; the test SKIPs (exit 0) if it
// is not configured, so `npm test` stays green without it.
//
//   MAKEUEF_EXE="C:\\tools\\makeuef\\MakeUEF.exe" node test/makeuef_arbiter_test.js
//   # with no path arg: runs every .uef under test/data
//   # optional path arg: a single UEF to test
//   # optional --rate N : PlayUEF render rate (default 44100, the tape CSW rate;
//   #                     48000 gives identical data blocks)
//
// What it asserts:
//   * every data block (a &0100 chunk longer than one byte, plus every &0104
//     defined-format block) is reproduced byte-for-byte, and the count matches.
// What it only reports (does not fail on):
//   * single-byte &0100 chunks — MakeUEF treats a size-1 block as a "dummy byte"
//     that does not increment the data-block count (see the V2.4 manual). These
//     are marginal carrier/security-wave detections in the gaps between files;
//     a clean synthetic render legitimately lands a few more or fewer of them.

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const MAKEUEF_EXE = process.env.MAKEUEF_EXE;
const DATA = path.join(__dirname, 'data');

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
let rate = 44100, uefArg = null;          // 44100 = the original tape CSW rate
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--rate') rate = parseInt(argv[++i], 10);
  else uefArg = argv[i];
}

// console silencing so uef2wave's verbose logging doesn't drown the report.
function quiet(fn) {
  const log = console.log, time = console.time, timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  try { return fn(); } finally { console.log = log; console.time = time; console.timeEnd = timeEnd; }
}

// ---- PlayUEF render + CSW encoding ---------------------------------------
const playuef = quiet(() => require('./lib/playuef.js'));

// Encode 16-bit mono PCM as a Ramsoft CSW v2.00 file (uncompressed RLE), which
// MakeUEF accepts. A CSW pulse is a run of constant signal polarity, measured in
// samples; zero samples extend the current run (they never flip polarity) so the
// exact zero-crossing samples of the synthetic sine don't create spurious
// 1-sample pulses.
function pcmToCsw(pcm, sampleRate) {
  const pulses = [];
  let pol = 0, run = 0, first = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i], s = v > 0 ? 1 : v < 0 ? -1 : 0;
    if (pol === 0)               { run++; if (s !== 0) { pol = s; first = s; } }
    else if (s === 0 || s === pol) run++;
    else                         { pulses.push(run); pol = s; run = 1; }
  }
  if (run > 0) pulses.push(run);

  const header = Buffer.alloc(0x34);
  header.write('Compressed Square Wave', 0, 'ascii');
  header[0x16] = 0x1A; header[0x17] = 0x02; header[0x18] = 0x00; // "...\x1A" v2.00
  header.writeUInt32LE(sampleRate, 0x19);
  header.writeUInt32LE(pulses.length, 0x1D);
  header[0x21] = 0x01;                          // compression: 1 = RLE
  header[0x22] = first > 0 ? 0x01 : 0x00;       // flags bit0 = initial polarity high
  header[0x23] = 0x00;                          // header extension length
  header.write('PlayUEF', 0x24, 'ascii');       // encoding application

  const parts = [header];
  let body = Buffer.alloc(1 << 20), bp = 0;
  const ensure = n => { if (bp + n > body.length) { parts.push(body.slice(0, bp)); body = Buffer.alloc(Math.max(1 << 20, n)); bp = 0; } };
  for (const p of pulses) {
    if (p < 256) { ensure(1); body[bp++] = p; }
    else         { ensure(5); body[bp++] = 0; body.writeUInt32LE(p, bp); bp += 4; }   // 0x00 escape + uint32
  }
  parts.push(body.slice(0, bp));
  return Buffer.concat(parts);
}

// ---- UEF parsing ---------------------------------------------------------
function loadUef(p) {
  let b = fs.readFileSync(p);
  if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);   // gunzip if gzipped
  return b;
}
// Extract the ordered data payloads from a UEF: implicit-8N1 blocks (&0100) and
// defined-format blocks (&0104, e.g. 8E1/8O1 parity). For &0104 the first three
// bytes are the format descriptor (data bits, parity, stop bits) — strip them so
// we compare the actual program bytes, not the framing metadata.
function dataBlocks(b) {
  if (b.slice(0, 9).toString('latin1') !== 'UEF File!') throw new Error('not a UEF file');
  const data = [];
  let dummy = 0;
  let off = 12;                                                // skip "UEF File!\0" + 2 version bytes
  while (off + 6 <= b.length) {
    const id = b.readUInt16LE(off), len = b.readUInt32LE(off + 2);
    const body = b.slice(off + 6, off + 6 + len);
    if (id === 0x0100) {
      if (body.length > 1) data.push(body);                    // real data block
      else dummy++;                                            // size-1 "dummy byte" marker
    } else if (id === 0x0104) {
      data.push(body.slice(3));                                // drop bits/parity/stop bytes
    }
    off += 6 + len;
  }
  return { data, dummy };
}

// Recursively collect every .uef under a directory (handles nested layouts
// like Citadel's "2nd Tape" subfolder, which a one-level walk would miss).
function findUefs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findUefs(full));
    else if (e.name.toLowerCase().endsWith('.uef')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// Replay each tape's *own* MakeUEF flags, taken from its sibling !BuildUEF.bat.
// These are tape-specific: -w 0 180 (the recorded phase) applies only to some
// tapes — forcing it on the rest makes MakeUEF misread their data tones as
// security waves and recover nothing — and the per-block -z <idx> <fmt> parity
// hints (8N1/8E1/8O1/BBC) are what make MakeUEF emit the &0104 defined-format
// blocks at all. We strip the -i input and -g description and our own -c/-o, and
// replay whatever decode flags the original build used.
function flagsFor(uefIn) {
  const bat = path.join(path.dirname(uefIn), '!BuildUEF.bat');
  if (!fs.existsSync(bat)) return [];
  const cswName = path.basename(uefIn).replace(/\.uef$/i, '.csw').toLowerCase();
  for (const raw of fs.readFileSync(bat, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^makeuef\b/i.test(line) || !line.toLowerCase().includes(cswName)) continue;
    let mid = line.replace(/^makeuef\s*/i, '');
    const g = mid.search(/\s-g(\s|$)/i);            // drop the -g "..." trailer
    if (g >= 0) mid = mid.slice(0, g);
    mid = mid.replace(/-i\s*\S*?\.csw/i, ' ');      // drop "-iFoo.csw" / "-i Foo.csw"
    return mid.trim().split(/\s+/).filter(Boolean);
  }
  return [];
}

// ---- one UEF: PlayUEF render -> CSW -> MakeUEF -> compare data blocks -----
function testOne(uefIn) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'playuef-makeuef-'));
  const csw  = path.join(work, 'render.csw');
  const out  = path.join(work, 'roundtrip');
  try {
    const wav = quiet(() => playuef.generateWav(loadUef(uefIn), { sampleRate: rate }));
    fs.writeFileSync(csw, pcmToCsw(wav.pcm, wav.sampleRate));

    // Replay the tape's own build flags (-w phase, -z parity hints); -c gives
    // uncompressed output for easy parsing. These are the same flags MakeUEF
    // used to make the reference UEF, so a faithful render must round-trip back.
    const flags = flagsFor(uefIn);
    execFileSync(MAKEUEF_EXE, ['-i', csw, ...flags, '-c', '-o', out],
                 { cwd: work, stdio: 'ignore' });

    // MakeUEF may append nothing / "hq.uef" / ".uef" to -o; find what it wrote.
    const made = fs.readdirSync(work)
      .filter(f => f.startsWith('roundtrip'))
      .map(f => path.join(work, f))[0];
    if (!made) return { error: 'MakeUEF produced no output UEF' };

    const ref = dataBlocks(loadUef(uefIn));
    const got = dataBlocks(loadUef(made));
    const refData = ref.data, gotData = got.data;

    let firstBad = -1;
    for (let i = 0; i < Math.min(refData.length, gotData.length); i++) {
      if (Buffer.compare(refData[i], gotData[i]) !== 0) { firstBad = i; break; }
    }
    const ok    = refData.length === gotData.length && firstBad === -1;
    const bytes = refData.reduce((s, d) => s + d.length, 0);
    return {
      ok, flags,
      refData: refData.length, gotData: gotData.length,
      refDummy: ref.dummy, gotDummy: got.dummy, firstBad, bytes,
      firstBadLens: firstBad >= 0 ? [refData[firstBad].length, gotData[firstBad].length] : null
    };
  } catch (e) {
    return { error: e.message };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });   // drop the temp CSW/UEF
  }
}

// ---- driver: every UEF under test/data (or a single path arg) ------------
function run() {
  if (!MAKEUEF_EXE || !fs.existsSync(MAKEUEF_EXE)) {
    console.log('SKIP  makeuef_arbiter_test — set MAKEUEF_EXE to a real MakeUEF.exe to run it');
    process.exit(0);
  }

  let list;
  if (uefArg) {
    if (!fs.existsSync(uefArg)) {
      console.log(`SKIP  makeuef_arbiter_test — UEF not found: ${uefArg}`);
      process.exit(0);
    }
    list = [uefArg];
  } else {
    list = findUefs(DATA);
  }

  console.log(`\nMakeUEF-arbitrated round-trip — ${list.length} UEF(s) @ ${rate} Hz\n`);

  let passed = 0, failed = 0, errored = 0;
  for (const uefIn of list) {
    const name = path.relative(DATA, uefIn) || path.basename(uefIn);
    const r = testOne(uefIn);

    if (r.error) {
      errored++;
      console.log(`ERROR ${name}\n      ${r.error}`);
      continue;
    }
    const dd = r.gotDummy - r.refDummy;   // dummy-marker delta (informational)
    if (r.ok) {
      passed++;
      const note = dd !== 0 ? `  [${dd > 0 ? '+' : ''}${dd} dummy marker(s)]` : '';
      console.log(`PASS  ${name}  — ${r.refData} data blocks / ${r.bytes} bytes byte-identical${note}`);
    } else {
      failed++;
      const why = r.refData !== r.gotData
        ? `block count ${r.refData} vs ${r.gotData}`
        : `block #${r.firstBad} differs (len ${r.firstBadLens[0]} vs ${r.firstBadLens[1]})`;
      console.log(`FAIL  ${name}  — ${why}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${errored} errored  (of ${list.length} UEFs)`);
  process.exit(failed + errored > 0 ? 1 : 0);
}

// Run when invoked directly; export the pipeline pieces so the negative-control
// test (makeuef_arbiter_negative_test.js) can reuse them to inject faults.
if (require.main === module) run();

module.exports = {
  MAKEUEF_EXE, rate, playuef, pcmToCsw, loadUef, dataBlocks, flagsFor, testOne,
};
