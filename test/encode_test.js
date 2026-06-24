// PlayUEF encoder coverage test.
//
// The CSW round-trip (csw_test.js) only sees standard 8N1 CFS blocks, so it is
// blind to the defined-format / parity data blocks (UEF chunk 0x0104, e.g. 8E1
// and 8O1) that make up the bulk of several tapes — and therefore never
// exercises PlayUEF's parity rendering (writeDefinedByte / parityInvert).
//
// This test closes that gap. PlayUEF reports every chunk it emits together with
// the sample position it was written at, so for each data block we decode the
// generated WAV *at that position, using that block's own serial format* and
// assert the bytes come back exactly equal to the source:
//
//   UEF chunk {data, format, timestamp} --> WAV --decode(format)--> data
//
// Covers 0x0100 (implicit 8N1) and 0x0104 (8N1 / 8E1 / 8O1 / 8N2 / ...) across
// every tape, i.e. 100% of data-bearing blocks, including parity.

const fs   = require('fs');
const path = require('path');
const tape = require('./lib/tape.js');

function quiet(fn) {
  const log = console.log, time = console.time, timeEnd = console.timeEnd;
  console.log = console.time = console.timeEnd = () => {};
  try { return fn(); } finally { console.log = log; console.time = time; console.timeEnd = timeEnd; }
}
const playuef = quiet(() => require('./lib/playuef.js'));

const DATA = path.join(__dirname, 'data');

function findUEFs() {
  const out = [];
  for (const dir of fs.readdirSync(DATA)) {
    const full = path.join(DATA, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.toLowerCase().endsWith('.uef')) out.push({ name: dir + '/' + f, file: path.join(full, f) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function checkUEF(file) {
  const wav     = quiet(() => playuef.generateWav(fs.readFileSync(file)));
  const pulses  = tape.pcmToPulses(wav.pcm);
  const cls     = tape.classify(pulses, wav.sampleRate);
  const locate  = tape.sampleLocator(pulses);

  const stats = { std: 0, defined: 0, fmts: {}, badBlocks: [], blocks: 0 };
  for (const ch of wav.chunks) {
    let fmt;
    if (ch.type === 'dataBlock')             { fmt = tape.FORMAT_8N1; stats.std++; }
    else if (ch.type === 'definedDataBlock') { fmt = ch.format;       stats.defined++; }
    else continue;
    if (!ch.data || ch.data.length === 0) continue;

    const tag = `${fmt.bits}${fmt.parity}${fmt.stopBits}`;
    stats.fmts[tag] = (stats.fmts[tag] || 0) + 1;
    stats.blocks++;

    // Land on the block's start bit (first long pulse at/after its timestamp).
    let p = locate(ch.timestamp), guard = 0;
    while (cls[p] !== 1 && guard < 8) { p++; guard++; }

    let okBytes = 0;
    for (let i = 0; i < ch.data.length; i++) {
      const r = tape.readFrame(cls, p, fmt);
      if (!r || r.byte !== ch.data[i]) break;
      okBytes++; p = r.next;
    }
    if (okBytes !== ch.data.length) {
      stats.badBlocks.push(`${ch.type}[${tag}] @${ch.timestamp} (${okBytes}/${ch.data.length} bytes)`);
    }
  }
  return stats;
}

function main() {
  const uefs = findUEFs();
  console.log(`\nPlayUEF encoder coverage test — ${uefs.length} UEF(s)\n`);
  let failures = 0;
  for (const u of uefs) {
    let s;
    try { s = checkUEF(u.file); }
    catch (e) { console.log(`FAIL  ${u.name}\n        error: ${e.message}`); failures++; continue; }

    const fmtList = Object.entries(s.fmts).sort().map(([k, v]) => `${k}x${v}`).join(' ');
    if (s.badBlocks.length === 0) {
      console.log(`PASS  ${u.name}  (${s.blocks} blocks: ${fmtList})`);
    } else {
      failures++;
      console.log(`FAIL  ${u.name}  (${s.blocks} blocks: ${fmtList})`);
      for (const b of s.badBlocks.slice(0, 5)) console.log(`        ${b}`);
      if (s.badBlocks.length > 5) console.log(`        ...and ${s.badBlocks.length - 5} more`);
    }
  }
  console.log(`\n${uefs.length - failures}/${uefs.length} passed\n`);
  process.exit(failures ? 1 : 0);
}

main();
