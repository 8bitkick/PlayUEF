// Loads the browser-side PlayUEF conversion code (uef2wave.js) into Node and
// exposes it as a callable, so tests can generate WAV audio from a UEF buffer.

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = path.join(__dirname, '..', '..');

// Shims for the browser globals uef2wave.js expects.
global.handleError = function (msg) { throw new Error('UEF error: ' + msg); };
global.Zlib = {
  Gunzip: function (data) {
    this.decompress = () => new Uint8Array(zlib.gunzipSync(Buffer.from(data)));
  }
};

eval(fs.readFileSync(path.join(REPO, 'utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(REPO, 'uef2wave.js'), 'utf8'));

// App defaults (see interface.js / player.js).
const DEFAULTS = {
  baud:       1200,
  sampleRate: 48000,
  stopPulses: 4,
  phase:      Math.PI,   // 180 degrees
  carrier:    1,         // post carrier/2 division value
  highFreq:   2400       // baud * 2
};

// Generate WAV from a UEF buffer; returns { pcm: Int16Array, sampleRate }.
function generateWav(uefBuffer, opts = {}) {
  const o = Object.assign({}, DEFAULTS, opts);
  const result = uef2wave(new Uint8Array(uefBuffer), o.baud, o.sampleRate,
                          o.stopPulses, o.phase, o.carrier, o.highFreq);
  const view     = new DataView(result.wav.buffer);
  const dataSize = view.getUint32(40, true);            // Subchunk2Size
  const pcm      = new Int16Array(result.wav.buffer, 44, dataSize / 2);
  return { pcm, sampleRate: o.sampleRate, chunks: result.uef };
}

module.exports = { generateWav, DEFAULTS };
