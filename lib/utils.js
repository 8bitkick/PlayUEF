wordAt = function(array,position){
  var bytes = array.slice(position, position+2);
  return new Uint16Array(bytes.buffer)[0];
}

doubleAt = function(array,position){
  var bytes = array.slice(position, position+4);
  return new Uint32Array(bytes.buffer)[0];
}

floatAt = function(array,position){
  var bytes = array.slice(position, position+4);
  return new Float32Array(bytes.buffer)[0];
}

var hex = function (value) {return ("00000000" + value.toString(16)).substr(-4);}
var hex4 = function (value) {return ("0000" + value.toString(16)).substr(-4);}
var chr = function (value) {return (String.fromCharCode(value));}

// Create WAV header for audio buffer
buildWAVheader = function(waveBuffer, sampleLength, sampleRate) {
  var numFrames = sampleLength;
  var numChannels = 1;
  var bytesPerSample = 2;
  var blockAlign = numChannels * bytesPerSample;
  var byteRate = sampleRate * blockAlign;
  var dataSize = numFrames * blockAlign;

  var dv = new DataView(waveBuffer);
  var p = 0;

  function writeString(s) {for (var i = 0; i < s.length; i++) {dv.setUint8(p + i, s.charCodeAt(i));}p += s.length;}
  function writeUint32(d) {dv.setUint32(p, d, true);p += 4;}
  function writeUint16(d) {dv.setUint16(p, d, true);p += 2;}

  writeString('RIFF');              // ChunkID
  writeUint32(dataSize + 36);       // ChunkSize
  writeString('WAVE');              // Format
  writeString('fmt ');              // Subchunk1ID
  writeUint32(16);                  // Subchunk1Size
  writeUint16(1);                   // AudioFormat
  writeUint16(numChannels);         // NumChannels
  writeUint32(sampleRate);          // SampleRate
  writeUint32(byteRate);            // ByteRate
  writeUint16(blockAlign);          // BlockAlign
  writeUint16(bytesPerSample * 8);  // BitsPerSample
  writeString('data');              // Subchunk2ID
  writeUint32(dataSize);            // Subchunk2Size

  return waveBuffer;
}
