# PlayUEF tests

Run everything with:

```sh
npm test
```

## `csw_test.js` — real-tape round-trip (primary)

For every game under `test/data/` that ships both a real-tape **CSW** capture
and a **UEF**, this proves that the WAV PlayUEF generates from the UEF carries
the same files as the original cassette:

```
real tape CSW ---------------decode--------------> CFS blocks  (reference)
UEF --PlayUEF--> WAV --zero-crossing + decode-----> CFS blocks  (under test)
```

Both signals are decoded by the same Acorn 1200-baud square-wave decoder
(`lib/tape.js`) down to the Cassette Filing System block catalogue, then
compared at the **data level** — so the check is immune to differences in
carrier-tone length, gap timing and sample rate between a real recording and
PlayUEF's synthetic output.

**Assertion:** every CFS block that decodes from the real tape *with certainty*
(valid header CRC **and** valid data CRC) must be reproduced byte-for-byte by
PlayUEF. Notes:

- Blocks where the CSW decode itself fails its data CRC are dropped from the
  reference — those are real-tape read errors / decode noise, not something
  PlayUEF should be judged against.
- PlayUEF is allowed to produce *extra* blocks: its synthetic audio is cleaner
  than a worn cassette, so it often recovers blocks the original recording
  could not (reported as `+N extra recovered`).
- A secondary guard checks PlayUEF's audio duration against the real tape
  (5% tolerance) to catch carrier-tone and base-frequency regressions.

Currently exercises 19 tapes / ~860 trusted blocks.

**Coverage note:** this round-trip only sees standard 8N1 CFS blocks. It is
blind to defined-format / parity data blocks (UEF chunk `0x0104`, e.g. 8E1 and
8O1), which make up the bulk of several tapes (StarQuake is 283 × 8O1; Estra,
TheHacker and Video Classics mix 8E1/8O1). Those are covered by `encode_test.js`.

## `encode_test.js` — encoder coverage, all formats (parity)

Verifies PlayUEF's WAV faithfully encodes **every** data block, including the
parity formats `csw_test.js` can't see. PlayUEF reports each chunk it emits with
its serial format and the sample position it was written at, so each block is
decoded out of the generated WAV *at that position using that block's own
format* and compared byte-for-byte to the source:

```
UEF chunk {data, format, timestamp} --> WAV --decode(format)--> data
```

Covers `0x0100` (implicit 8N1) and `0x0104` (8N1 / 8E1 / 8O1 / …) — ~3270 blocks
across 19 tapes, i.e. 100% of data-bearing blocks. This is what exercises
PlayUEF's `writeDefinedByte` parity rendering (and the MakeUEF-<2.4
`parityInvert` workaround).

### Format coverage

PlayUEF reproduces the per-section timing recorded by MakeUEF:

- `0x0104` defined-format data blocks (8N1 / 8E1 / 8O1 / …) — verified by
  `encode_test.js`.
- `0x0113` base-frequency / baud change (≈3000 across the set) — the tone set is
  rebuilt at each change, so PlayUEF tracks the real tape's per-section baud
  instead of a fixed 1200. This pulled output durations from ~7% off the tape to
  ~2.5%, which the `csw_test.js` duration guard now enforces.
- `0x0115` phase change (13 instances) — tones are rebuilt at the new phase.
- `0x0114` security cycles — rendered as the recorded high/low frequency wave
  pattern (with 'P' half-pulse start/end), not flat carrier tone. Every chunk in
  the corpus mixes 1200/2400 Hz cycles, so the old carrier substitution was both
  wrong in shape and ~1.7× too short.
- `0x0116` floating-point gap — rendered as the exact `round(seconds × rate)`
  silence rather than rounded up to whole bit-cells.

## `test_carrier.js` — single-file duration + golden hash

Older, narrower check on `3DGrandPrix [SideA]`: verifies output duration against
the reference WAV and a pinned SHA-256 of the generated samples. Largely
subsumed by `csw_test.js`; kept as a fast smoke test and exact-output pin.

## `lib/`

- `tape.js`    — CSW reader, PCM→pulse zero-crossing, format-aware byte framing
  (`readFrame` handles arbitrary bits/parity/stops), 8N1 stream decode, sample→pulse
  locator, and CFS block + CRC recovery.
- `playuef.js` — loads the browser `uef2wave.js` into Node and exposes
  `generateWav(uefBuffer)`, returning the PCM plus the parsed chunk list (with
  per-block format and sample timestamps).
