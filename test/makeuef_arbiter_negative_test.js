// Negative controls for makeuef_arbiter_test.js.
//
// A round-trip test that can only ever pass is worthless. This proves the
// arbiter has teeth: it renders a known-good tape three ways and asserts the
// comparison reacts correctly —
//
//   1. healthy render, correct flags        -> MUST match   (not vacuously failing)
//   2. one program byte corrupted at source  -> MUST differ  (catches bad data)
//   3. correct render, wrong MakeUEF flags    -> MUST differ  (catches the bug we
//      just fixed: forcing -w 0 180 on a tape that doesn't use it)
//
// If any of these does the wrong thing, the arbiter is not trustworthy and this
// test exits non-zero. SKIPs (exit 0) when MAKEUEF_EXE is unset, like the arbiter.

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');
const A = require('./makeuef_arbiter_test.js');   // exported pipeline pieces

// A fast, flag-free tape: Frak's build line is just "-i <csw> -g ...", so the
// only thing under test here is the render + decode, not the flag plumbing.
const UEF = path.join(__dirname, 'data', 'Frak! (Aardvark)', 'Frak!(Aardvark)[SideLabel].uef');

// Render a (possibly mutated) UEF buffer through PlayUEF -> CSW -> MakeUEF with
// the given flags, and return the ordered data-block payloads MakeUEF recovered.
function roundtrip(uefBuf, flags) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'playuef-neg-'));
  try {
    const log = console.log, time = console.time, timeEnd = console.timeEnd;
    console.log = console.time = console.timeEnd = () => {};
    let wav;
    try { wav = A.playuef.generateWav(new Uint8Array(uefBuf), { sampleRate: A.rate }); }
    finally { console.log = log; console.time = time; console.timeEnd = timeEnd; }
    const csw = path.join(work, 'r.csw');
    fs.writeFileSync(csw, A.pcmToCsw(wav.pcm, wav.sampleRate));
    const out = path.join(work, 'roundtrip');
    execFileSync(A.MAKEUEF_EXE, ['-i', csw, ...flags, '-c', '-o', out], { cwd: work, stdio: 'ignore' });
    const made = fs.readdirSync(work).filter(f => f.startsWith('roundtrip')).map(f => path.join(work, f))[0];
    return made ? A.dataBlocks(A.loadUef(made)).data : [];
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Compare two ordered block lists the same way the arbiter does.
function blocksMatch(ref, got) {
  if (ref.length !== got.length) return false;
  for (let i = 0; i < ref.length; i++) if (Buffer.compare(ref[i], got[i]) !== 0) return false;
  return true;
}

// Flip a byte in the middle of the first real &0100 data block, in place.
function corruptOneByte(buf) {
  let off = 12;
  while (off + 6 <= buf.length) {
    const id = buf.readUInt16LE(off), len = buf.readUInt32LE(off + 2);
    if (id === 0x0100 && len > 40) {
      const at = off + 6 + (len >> 1);
      buf[at] ^= 0xff;
      return at;
    }
    off += 6 + len;
  }
  throw new Error('no suitable &0100 block to corrupt');
}

function run() {
  if (!A.MAKEUEF_EXE || !fs.existsSync(A.MAKEUEF_EXE)) {
    console.log('SKIP  makeuef_arbiter_negative_test — set MAKEUEF_EXE to run it');
    process.exit(0);
  }
  if (!fs.existsSync(UEF)) {
    console.log(`SKIP  makeuef_arbiter_negative_test — UEF not found: ${UEF}`);
    process.exit(0);
  }

  const orig  = A.loadUef(UEF);
  const ref   = A.dataBlocks(orig).data;       // the reference program bytes
  const flags = A.flagsFor(UEF);               // Frak: none
  const checks = [];

  // 1. Positive control — healthy render with correct flags MUST match.
  {
    const got = roundtrip(orig, flags);
    const ok  = blocksMatch(ref, got);
    checks.push({ name: 'control: healthy render matches', want: 'MATCH', got: ok ? 'MATCH' : 'DIFFER', pass: ok });
  }

  // 2. Corrupted source byte MUST be detected as a difference.
  {
    const mutated = Buffer.from(orig);
    const at = corruptOneByte(mutated);
    const got = roundtrip(mutated, flags);
    const ok  = blocksMatch(ref, got);
    checks.push({ name: `fault: 1 program byte flipped @${at} is caught`, want: 'DIFFER', got: ok ? 'MATCH' : 'DIFFER', pass: !ok });
  }

  // 3. Wrong flags MUST be detected — forcing -w 0 180 on a no-w tape (the very
  //    bug the fix addressed) makes MakeUEF recover the wrong/zero blocks.
  {
    const got = roundtrip(orig, ['-w', '0', '180']);
    const ok  = blocksMatch(ref, got);
    checks.push({ name: 'fault: wrong flags (-w 0 180) is caught', want: 'DIFFER', got: ok ? 'MATCH' : 'DIFFER', pass: !ok });
  }

  console.log('\nMakeUEF arbiter negative controls — Frak!(Aardvark)[SideLabel]\n');
  let bad = 0;
  for (const c of checks) {
    console.log(`  ${c.pass ? 'OK  ' : 'BAD '} ${c.name}  (want ${c.want}, got ${c.got})`);
    if (!c.pass) bad++;
  }
  if (bad === 0) console.log(`\nPASS  arbiter correctly distinguishes good from bad (${checks.length}/${checks.length})`);
  else           console.log(`\nFAIL  ${bad} negative control(s) wrong — the arbiter is not trustworthy`);
  process.exit(bad ? 1 : 0);
}

run();
