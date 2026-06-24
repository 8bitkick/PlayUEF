// Square-wave tape decoder for PlayUEF tests.
//
// Decodes Acorn/BBC 1200-baud cassette audio (300-baud not handled) from
// either a CSW pulse stream or 16-bit PCM, then recovers the Acorn Cassette
// Filing System (CFS) block catalogue with CRC validation. This lets a test
// prove that two independent recordings of the same tape (e.g. a real-tape
// CSW capture and a PlayUEF-generated WAV) carry identical file data.
//
// References:
//   CSW format:  http://ramsoft.bbk.org.omegahg.com/csw.html
//   CFS blocks:  http://beebwiki.mdfs.net/Acorn_cassette_format

const zlib = require('zlib');

// Parse a CSW v1/v2 file into a stream of pulse half-period lengths (samples).
function readCSW(buf) {
  if (buf.toString('latin1', 0, 22) !== 'Compressed Square Wave') {
    throw new Error('not a CSW file');
  }
  const major = buf[0x17];
  let sampleRate, compression, hdrExt, flags, dataStart;
  if (major === 2) {
    sampleRate  = buf.readUInt32LE(0x19);
    compression = buf[0x21];            // 1 = RLE, 2 = Z-RLE (zlib)
    flags       = buf[0x22];
    hdrExt      = buf[0x23];
    dataStart   = 0x34 + hdrExt;
  } else {
    // CSW v1: 0x16..0x17 sample rate (16-bit), 0x18 compression, 0x19 flags,
    // header is 0x20 bytes, RLE only.
    sampleRate  = buf.readUInt16LE(0x19);
    compression = buf[0x1b];
    flags       = buf[0x1c];
    dataStart   = 0x20;
  }

  let data = buf.subarray(dataStart);
  if (compression === 2) data = zlib.inflateSync(data);

  // RLE: each byte is a pulse length in samples; 0 escapes to a 32-bit LE count.
  const pulses = [];
  let i = 0;
  while (i < data.length) {
    let n = data[i++];
    if (n === 0) { n = data.readUInt32LE(i); i += 4; }
    pulses.push(n);
  }
  return { sampleRate, flags, pulses };
}

// Convert 16-bit PCM to pulse half-period lengths via zero-crossing detection.
function pcmToPulses(pcm) {
  const pulses = [];
  let sign = pcm[0] >= 0, run = 0;
  for (let i = 0; i < pcm.length; i++) {
    const s = pcm[i] >= 0;
    if (s === sign) { run++; }
    else { pulses.push(run); run = 1; sign = s; }
  }
  if (run) pulses.push(run);
  return pulses;
}

// Classify each pulse as a 1200Hz half-cycle (long, "1") or 2400Hz half-cycle
// (short, "0"). The bit/byte encoding is built on these:
//   data '0' bit = one  1200Hz cycle  = 2 long  half-pulses
//   data '1' bit = two  2400Hz cycles = 4 short half-pulses
function classify(pulses, sampleRate) {
  const thresh = (sampleRate / 2400 / 2 + sampleRate / 1200 / 2) / 2;
  const cls = new Uint8Array(pulses.length);          // 0 = short(2400), 1 = long(1200)
  for (let i = 0; i < pulses.length; i++) cls[i] = pulses[i] > thresh ? 1 : 0;
  return cls;
}

const FORMAT_8N1 = { bits: 8, parity: 'N', stopBits: 1 };

// Read one framed byte (LSB first) from classified pulses starting at index p,
// for an arbitrary serial format { bits, parity:'N'|'E'|'O', stopBits }. The
// frame is start bit (0) + data bits + optional parity bit + stop bit(s) (1).
// Returns { byte, next } or null if p isn't a valid start bit / framing breaks.
function readFrame(cls, p, format) {
  const N = cls.length;
  const readBit = (q) => (cls[q] === 1 ? { bit: 0, next: q + 2 } : { bit: 1, next: q + 4 });
  if (p >= N || cls[p] !== 1) return null;            // start bit must be a long pulse
  let q = readBit(p).next, byte = 0;
  for (let b = 0; b < format.bits; b++) {
    if (q >= N) return null;
    const r = readBit(q); byte |= (r.bit << b); q = r.next;
  }
  if (format.parity !== 'N') { if (q >= N) return null; q = readBit(q).next; }  // skip parity bit
  for (let s = 0; s < format.stopBits; s++) {
    if (q >= N) return null;
    const r = readBit(q); if (r.bit !== 1) return null; q = r.next;
  }
  return { byte, next: q };
}

// Decode an 8N1 pulse stream into its framed byte stream. The lead/carrier tone
// is continuous 2400Hz (short pulses); a byte frame begins at the first long
// pulse (start bit) following carrier, so we slide forward until one frames.
function decodeBytes(pulses, sampleRate) {
  const cls = classify(pulses, sampleRate);
  const N = cls.length;
  const bytes = [];
  let p = 0;
  while (p < N - 40) {
    const r = readFrame(cls, p, FORMAT_8N1);
    if (!r) { p++; continue; }
    bytes.push(r.byte);
    p = r.next;
  }
  return bytes;
}

// Build a lookup from absolute sample position to the pulse index that starts
// at or after it (for decoding a block at a known timestamp).
function sampleLocator(pulses) {
  const cum = new Float64Array(pulses.length + 1);
  for (let i = 0; i < pulses.length; i++) cum[i + 1] = cum[i] + pulses[i];
  return (sample) => {
    let lo = 0, hi = pulses.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < sample) lo = m + 1; else hi = m; }
    return lo;
  };
}

// CRC-CCITT (XModem) as used by the Acorn CFS.
function crc16(bytes, start, len) {
  let crc = 0;
  for (let i = 0; i < len; i++) {
    crc ^= bytes[start + i] << 8;
    for (let k = 0; k < 8; k++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
}

// Recover CFS blocks from a decoded byte stream. A block starts with a 0x2A
// sync byte; spurious 0x2A bytes inside data are rejected by the header CRC.
function decodeBlocks(bytes) {
  const blocks = [];
  for (let i = 0; i < bytes.length - 24; i++) {
    if (bytes[i] !== 0x2A) continue;

    let j = i + 1, name = '';
    while (j < i + 12 && bytes[j] !== 0) { name += String.fromCharCode(bytes[j]); j++; }
    if (bytes[j] !== 0) continue;                     // filename must be null-terminated
    j++;                                              // j -> load address

    const hdrStart = i + 1;                           // CRC covers filename..spare
    const load   = bytes[j] | (bytes[j+1] << 8) | (bytes[j+2] << 16) | (bytes[j+3] << 24);
    const exec   = bytes[j+4] | (bytes[j+5] << 8) | (bytes[j+6] << 16) | (bytes[j+7] << 24);
    const blkNum = bytes[j + 8]  | (bytes[j + 9]  << 8);
    const blkLen = bytes[j + 10] | (bytes[j + 11] << 8);
    const flag   = bytes[j + 12];
    const hdrLen = (j + 17) - hdrStart;
    const hcrc   = (bytes[j + 17] << 8) | bytes[j + 18];   // stored big-endian
    const hcrcOK = hcrc === crc16(bytes, hdrStart, hdrLen);

    let data = null, dcrcOK = false;
    const dataStart = j + 19;
    if (hcrcOK && dataStart + blkLen + 2 <= bytes.length) {
      data = bytes.slice(dataStart, dataStart + blkLen);
      const dcrc = (bytes[dataStart + blkLen] << 8) | bytes[dataStart + blkLen + 1];
      dcrcOK = dcrc === crc16(bytes, dataStart, blkLen);
    }
    blocks.push({ off: i, name, load, exec, blkNum, blkLen, flag, hcrcOK, dcrcOK, data });
  }
  return blocks;
}

// Convenience: pulses -> validated (header-CRC-OK) CFS blocks.
function decodeTape(pulses, sampleRate) {
  return decodeBlocks(decodeBytes(pulses, sampleRate)).filter(b => b.hcrcOK);
}

module.exports = {
  readCSW, pcmToPulses, classify, readFrame, decodeBytes, sampleLocator,
  crc16, decodeBlocks, decodeTape, FORMAT_8N1
};
