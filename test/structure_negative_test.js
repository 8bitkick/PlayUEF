// Negative controls for structure_test.js.
//
// structure_test.js passing only means something if it can fail. This renders a
// tape, corrupts the audio in four targeted ways — fill a gap with tone, silence
// a carrier, flatten a security-cycle region to plain carrier, and flip the
// waveform phase — and asserts the matching structural check catches each. A
// healthy render is checked too, so we know we're not failing for free.

const fs   = require('fs');
const path = require('path');
const S    = require('./structure_test.js');

const UEF = path.join(S.DATA, 'Frak! (Aardvark)', 'Frak!(Aardvark)[SideLabel].uef');

// Re-render a fresh wav each time (pcm gets mutated in place by the faults).
function render() {
  return S.quiet(() => S.playuef.generateWav(fs.readFileSync(UEF)));
}
const firstChunk = (wav, pred) => wav.chunks.find(pred);

// Does the failure list contain a failure of the given kind?
const has = (fails, kind) => fails.some(f => f.startsWith(kind));

function run() {
  if (!fs.existsSync(UEF)) {
    console.log(`SKIP  structure_negative_test — UEF not found: ${UEF}`);
    process.exit(0);
  }

  const checks = [];

  // 0. Control — a healthy render must pass cleanly.
  {
    const fails = S.checkWav(render()).fails;
    checks.push({ name: 'control: healthy render is clean', pass: fails.length === 0,
                  got: fails.length ? fails[0] : 'no failures' });
  }

  // 1. Gap filled with tone -> the silence check must fire.
  {
    const wav = render();
    const g = firstChunk(wav, c => c.type === 'integerGap' && (c.samples ?? 0) > 200);
    const at = g.timestamp;
    for (let k = at + 10; k < at + 200; k++) wav.pcm[k] = 0x4000;   // inject audio into the gap
    const fails = S.checkWav(wav).fails;
    checks.push({ name: 'fault: tone injected into a gap is caught', pass: has(fails, 'gap'),
                  got: fails.find(f => f.startsWith('gap')) || '(no gap failure)' });
  }

  // 2. Carrier silenced -> the carrier tone check must fire.
  {
    const wav = render();
    const c = firstChunk(wav, ch => ch.type === 'carrierTone' && ch.cycles > 20);
    const idx = wav.chunks.indexOf(c);
    const end = wav.chunks[idx + 1].timestamp;
    for (let k = c.timestamp; k < end; k++) wav.pcm[k] = 0;         // wipe the carrier
    const fails = S.checkWav(wav).fails;
    checks.push({ name: 'fault: silenced carrier tone is caught', pass: has(fails, 'carrier'),
                  got: fails.find(f => f.startsWith('carrier')) || '(no carrier failure)' });
  }

  // 3. Security cycles flattened to plain carrier -> the pattern check must fire.
  {
    const wav = render();
    const sec = firstChunk(wav, ch => ch.type === 'securityCycles' && ch.bits.includes(0));
    const car = firstChunk(wav, ch => ch.type === 'carrierTone' && ch.cycles > 20);
    const idx = wav.chunks.indexOf(sec);
    const end = wav.chunks[idx + 1].timestamp;
    for (let k = sec.timestamp; k < end; k++)                       // overwrite with pure high carrier
      wav.pcm[k] = wav.pcm[car.timestamp + ((k - sec.timestamp) % 1000)];
    const fails = S.checkWav(wav).fails;
    checks.push({ name: 'fault: security cycles flattened to carrier is caught', pass: has(fails, 'security'),
                  got: fails.find(f => f.startsWith('security')) || '(no security failure)' });
  }

  // 4. Phase flipped (negate the whole waveform) -> the phase-change check must fire.
  {
    const wav = render();
    for (let k = 0; k < wav.pcm.length; k++) wav.pcm[k] = -wav.pcm[k];
    const fails = S.checkWav(wav).fails;
    checks.push({ name: 'fault: inverted phase is caught', pass: has(fails, 'phase'),
                  got: fails.find(f => f.startsWith('phase')) || '(no phase failure)' });
  }

  console.log('\nstructure_test negative controls — Frak!(Aardvark)[SideLabel]\n');
  let bad = 0;
  for (const c of checks) {
    console.log(`  ${c.pass ? 'OK  ' : 'BAD '} ${c.name}\n        ${c.got}`);
    if (!c.pass) bad++;
  }
  if (bad === 0) console.log(`\nPASS  every structural check fires when it should (${checks.length}/${checks.length})`);
  else           console.log(`\nFAIL  ${bad} structural check(s) did not fire — structure_test is not trustworthy`);
  process.exit(bad ? 1 : 0);
}

run();
