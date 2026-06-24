// Test: carrier tone duration and output hash for example UEF file
// Reference WAV: raw tape recording at 44100Hz 8-bit
// Golden hash: SHA-256 of the PlayUEF WAV sample data (post carrier-fix, 2025-06)

const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');
const crypto = require('crypto');

// Shims for browser globals used by uef2wave.js
global.handleError = function(msg, e) { throw new Error('UEF error: ' + msg); };
global.Zlib = {
  Gunzip: function(data) {
    this._data = data;
    this.decompress = () => new Uint8Array(zlib.gunzipSync(Buffer.from(this._data)));
  }
};

// Load browser scripts into this context
eval(fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '..', 'uef2wave.js'), 'utf8'));

const SAMPLE_RATE = 48000;
const BAUD        = 1200;
const STOP_PULSES = 4;
const PHASE       = 180 * (Math.PI / 180);
const CARRIER     = 1;   // carrierFactor (app does CARRIER/2, we pass post-division value)
const HIGH        = BAUD * 2;

const GAME = path.join(__dirname, 'data', '3DGrandPrix (SoftwareInvasion)');
const uefRaw = fs.readFileSync(path.join(GAME, '3DGrandPrix(SoftwareInvasion)[SideA].uef'));
const result = uef2wave(new Uint8Array(uefRaw), BAUD, SAMPLE_RATE, STOP_PULSES, PHASE, CARRIER, HIGH);

// Read actual sample data from WAV (Subchunk2Size at byte 40)
const wavView  = new DataView(result.wav.buffer);
const dataSize = wavView.getUint32(40, true);
const samples  = dataSize / 2;
const duration = samples / SAMPLE_RATE;

// SHA-256 of the sample data only (not the header, which contains the size)
const sampleBytes = Buffer.from(result.wav.buffer, 44, dataSize);
const hash        = crypto.createHash('sha256').update(sampleBytes).digest('hex');

// Reference WAV: read duration from its actual header (44.1kHz 8-bit mono)
const refBuf      = fs.readFileSync(path.join(GAME, '3DGrandPrix(SoftwareInvasion)[SideA].wav'));
const refView     = new DataView(refBuf.buffer, refBuf.byteOffset);
const refRate     = refView.getUint32(24, true);
const refBits     = refView.getUint16(34, true);
const refCh       = refView.getUint16(22, true);
const refData     = refView.getUint32(40, true);
const refDuration = refData / (refBits / 8) / refCh / refRate;

// Golden hash file — written on first run, checked on subsequent runs
const hashFile = path.join(__dirname, 'golden_hash.txt');
let pass = true;

console.log('\nReference WAV:  ' + refDuration.toFixed(1) + 's  (' + refRate + 'Hz ' + refBits + '-bit)');
console.log('PlayUEF output: ' + duration.toFixed(1) + 's  (48000Hz 16-bit)');
console.log('SHA-256:        ' + hash);

// Duration check
const diff = Math.abs(duration - refDuration);
if (diff <= 60) {
  console.log('PASS duration  (diff ' + diff.toFixed(1) + 's, tolerance 60s)');
} else {
  console.log('FAIL duration  (diff ' + diff.toFixed(1) + 's — pre-fix carrier bug was ~227s over)');
  pass = false;
}

// Hash check
if (!fs.existsSync(hashFile)) {
  fs.writeFileSync(hashFile, hash + '\n');
  console.log('PASS hash      (golden hash written — rerun to verify)');
} else {
  const golden = fs.readFileSync(hashFile, 'utf8').trim();
  if (hash === golden) {
    console.log('PASS hash      (matches golden)');
  } else {
    console.log('FAIL hash      (expected ' + golden + ')');
    pass = false;
  }
}

process.exit(pass ? 0 : 1);
