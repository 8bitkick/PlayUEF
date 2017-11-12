// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//
// Reference:
//
// https://en.wikipedia.org/wiki/Kansas_City_standard#1200_baud
// http://electrem.emuunlim.com/UEFSpecs.htm
// https://www.stairwaytohell.com/essentials/uef2wave.py
//


var uef2wave = function(uefData, baud, sampleRate, stopPulses, phase, carrier){
  "use strict";
  this.uefData = uefData;

  // check if the UEF is in fact zipped
  if (this.isValidUEF()==false) {
    var gunzip = new Zlib.Gunzip(uefData);
    this.uefData = gunzip.decompress();
  };

  if (this.isValidUEF()==false) {alert("ERROR: Invalid UEF file :(");}
  this.baud = baud;
  this.sampleRate = sampleRate;
  this.stopPulses = stopPulses;  // Default stopbit length in 180° high-tone pulses
  this.phase =  phase;
  this.uefChunks = [];
  this.carrier = carrier; // Carrier tone length factor frequency cycles
  this.sampleLength = 0;
  this.fails = 0;
};

uef2wave.prototype.isValidUEF = function() {
  return ((String.fromCharCode.apply(null,this.uefData.slice(0, 9)) == "UEF File!"));
};

uef2wave.prototype.decodeUEF = function() {
  var samplesPerCycle  = Math.floor(this.sampleRate / this.baud); // Audio samples per base cycle
  var sampleLength   = 0;
  var nextChunk      = 12; // skip over "UEF File!"
  var uefDataLength  = this.uefData.length;
  var firstBlock     = true; // track to reduce firstBlock carrier tones if carrier=0
  var carrier        = this.carrier / 2; // 1 = half.
  var stopPulses     = this.stopPulses;
  var chunkNum       = 0;
  var parityInvert   = false;

  wordAt = function(array,position){
    var bytes = array.slice(position, position+2);
    return new Uint16Array(bytes.buffer)[0];
  };

  doubleAt = function(array,position){
    var bytes = array.slice(position, position+4);
    return new Uint32Array(bytes.buffer)[0];
  };

  floatAt = function(array,position){
    var bytes = array.slice(position, position+4);
    return new Float32Array(bytes.buffer)[0];
  };

  var hex = function (value) {return ("00000000" + value.toString(16)).substr(-8);}

  // Cassette Filing System header http://beebwiki.mdfs.net/Acorn_cassette_format
  CFSheader = function(data){
    function isZero(element) {return element == 0;}
    var strend = data.findIndex(isZero);
    var filename = String.fromCharCode.apply(null,data.slice(0,strend));
    var loadAddress = doubleAt(data,strend+1);
    var executionAddress = doubleAt(data,strend+5);
    var blockNumber = wordAt(data,strend+9);
    return filename+" "+(("00"+blockNumber.toString(16)).substr(-2))+" "+hex(loadAddress)+" "+hex(executionAddress);
  }


  // Scan UEF data array for ChunkIDs and parse length of final sample
  while (nextChunk < uefDataLength) {
    var uefPos = nextChunk;

    var chunkID     = wordAt(this.uefData,uefPos);
    var chunkLength = doubleAt(this.uefData,uefPos+2);
    var chunkStart  = uefPos + 6;
    var nextChunk   = chunkStart + chunkLength;

    switch (chunkID){

      case 0x0000: // 0x0000 origin information chunk
      var info = String.fromCharCode.apply(null,(this.uefData.slice(chunkStart, nextChunk)));
      console.log("UEF info: "+info);

      // If MakeUEF is v2.x or below, parity bit of 0x0104 chunks is inverted
      var search = info.match(/MakeUEF\D+(\d+)\.(\d+)/i);
      if (search) {
        var version = search[1];
        if (version < 3) {parityInvert = true;}
        console.log("PlayUEF : MakeUEF v2.x or below - 0x0104 parity will be inverted");
      }

      break;

      case 0x0100: // 0x0100 implicit start/stop bit tape data block
      var data = new Uint8Array(this.uefData.slice(chunkStart, nextChunk));
      if (data[0]==0x2A && data.length>24) {header = CFSheader(data.slice(1, 24));} else {header=""}; // Request BBC micro block header summary
      this.uefChunks.push({op:"writeData", start:chunkStart, end:nextChunk, data:data, header:header, cycles:chunkLength*(9+stopPulses/4)});
      firstBlock = false;
      break;

      case 0x0104: // 0x0104 defined tape format data block
      this.uefChunks.push(
        {
          op:             "writeFormData",
          start:          chunkStart+3,
          end:            nextChunk,
          data:           new Uint8Array(this.uefData.slice(chunkStart+3, nextChunk)),
          header:         ((data[0]==0x2A && data.length>24) ? CFSheader(data.slice(1, 24)) : ""),
          format: {
            bitsPerPacket: this.uefData[chunkStart],
            parity:        String.fromCharCode(this.uefData[chunkStart+1]),   // 'N', 'E' or 'O' = present, even or odd.
            stopBits:      Math.abs(this.uefData[chunkStart+2]),              // count of stop bits.
            extraWave:     (this.uefData[chunkStart+2]<0 ? 1 : 0) // negative stopBits = extra wave should be added.
          },
          get cycles() {
            cyclesPerPacket = 1 + this.format.bitsPerPacket + ((this.format.parity!="N") ? 1 : 0) + this.format.stopBits + this.format.extraWave/2;
            return cyclesPerPacket * (this.end - this.start);
          }
        }
      );

      // Check if parity of 0x0104 chunks need to be inverted
      if (parityInvert==true){
        temp = this.uefChunks[this.uefChunks.length-1].format.parity;
        if (temp=="E") {this.uefChunks[this.uefChunks.length-1].format.parity="O"}
        if (temp=="O") {this.uefChunks[this.uefChunks.length-1].format.parity="E"}
      }

      chunk=this.uefChunks[this.uefChunks.length-1].format;
      console.log("0x0104 - "+chunk.bitsPerPacket+""+chunk.parity+""+chunk.stopBits+" of "+(chunkLength-3)+" bytes");
      firstBlock = false;
      break;

      case 0x0110: // 0x0110 carrier tone
      var cycles = wordAt(this.uefData,chunkStart);
      if (carrier==0 && firstBlock==false) {cycles = 60;} // CARRIER=0 reduces interblock carrier tone section to 120 hightone cycles
      else {cycles = Math.ceil((this.baud/1200)*cycles);}; // length of preamble carrier tone relative to 1200Hz
      if (carrier > 0) {cycles = Math.ceil(cycles*carrier);}; // Carrier length factor
      this.uefChunks.push({op:"carrierTone", cycles:cycles});
      break;

      case 0x0111: // 0x0111 carrier tone (previously high tone) with dummy byte at byte
      var beforeCycles = wordAt(this.uefData,chunkStart);
      var afterCycles  = wordAt(this.uefData,chunkStart+2);
      if (carrier > 0) {beforeCycles = Math.ceil(beforeCycles*carrier); afterCycles = Math.ceil(afterCycles*carrier);}; // Carrier length factor
      this.uefChunks.push({op:"carrierTone", cycles:beforeCycles});
      this.uefChunks.push({op:"writeByte", byte:0xAA, cycles:10, header:""});
      this.uefChunks.push({op:"carrierTone", cycles:afterCycles});
      break;

      case 0x0112: // 0x0112 Integer gap
      var n = wordAt(this.uefData,chunkStart);
      var cycles = Math.ceil((this.baud/1000)*2*n); // Conservative gaps as we dont support MOTOR OFF
      this.uefChunks.push({op:"integerGap", cycles:cycles});
      firstBlock = true;
      break;


      // Approximated

      case 0x0116: // 0x0116 floating point gap
      var floatGap = floatAt(this.uefData,chunkStart);
      var cycles = Math.ceil(floatGap * this.baud); // We're cheating and converting to an integerGap
      this.uefChunks.push({op:"integerGap", cycles:cycles});
      firstBlock = true;
      break;

      case 0x0114: // 0x0114 security cycles
      var cycles = doubleAt(this.uefData,chunkStart) & 0x00ffffff;
      this.uefChunks.push({op:"carrierTone", cycles:cycles*2});
      var data = new Uint8Array(this.uefData.slice(chunkStart, nextChunk));
      console.log(data);
      break;

      /*
      // Ignored
      // --------
      // Capturing mechanical variance in cassette deck can usually be ignored?
      case 0x0113: this.uefChunks.push({op:"ignore", args:["0x0113 change of base frequency", uefPos]});
      break;

      case 0x0115: this.uefChunks.push({op:"ignore", args:["0x0115 phase change", uefPos]});
      break;


      // Still to implement
      // ------------------
      case 0x0101: this.uefChunks.push({op:"fail", args:["0x0101 multiplexed data block", uefPos]});
      break;

      case 0x0102: this.uefChunks.push({op:"fail", args:["0x0102 explicit tape data block", uefPos]});
      break;

      case 0x0103: this.uefChunks.push({op:"fail", args:["0x0103 multiplexed data block", uefPos]});
      break;

      case 0x0117: this.uefChunks.push({op:"fail", args:["0x0117 data encoding format change", uefPos]});
      break;

      case 0x0120: this.uefChunks.push({op:"fail", args:["0x0120 position marker", uefPos]});
      break;

      case 0x0130: this.uefChunks.push({op:"fail", args:["0x0130 tape set info", uefPos]});
      break;

      case 0x0131: this.uefChunks.push({op:"fail", args:["0x0131 start of tape side", uefPos]});
      break;*/

      //default: console.log("WARNING ignored chunk "+"0x"+hex(chunkID).substring(4,8)+" at "+uefPos);

    }
  }
  console.log(this.uefChunks.length+" UEF chunks read");

console.log("**** NASTY TEST FOR FORTRESS IN PLACE - DELETE ***");

  sampleLength = 0;
  for (var i = 0; i < this.uefChunks.length; i++) {
    sampleLength += this.uefChunks[i].cycles * samplesPerCycle || 0;

    /* DELETE
    if (i==196) {
      this.uefChunks[i].op = "writeFormData";
    this.uefChunks[i].format=
    {parity:"N",
    stopBits:2,
    bitsPerPacket:8,
    extraWave:0}
  }*/

//console.log(this.uefChunks[i],i);
  }
  this.sampleLength = sampleLength;
};


// Convert UEF tokens to audio sample
uef2wave.prototype.createWAV = function() {
  // Scan UEF data array for ChunkIDs and parse, writing audio to buffer
  var sampleLength = this.sampleLength;
  var numChunks  = this.uefChunks.length;
  var sampleRate = this.sampleRate;
  var baud = this.baud;
  var phase = this.phase;
  var stopPulses = this.stopPulses;

  // Set up WAV data views
  var waveBuffer = new ArrayBuffer(44 + (sampleLength*2)); // Header is 44 bytes, sample is 16-bit * sampleLength
  var sampleData  = new Int16Array(waveBuffer, 44,sampleLength);
  var samplePos = 0;

  // Creates 16-bit array of a sine wave for given frequency, cycles and phase
  generateTone = function(frequency, cycles, phase, sampleRate) {
    var samples = Math.floor((sampleRate / frequency)*cycles); // round down = just under full cycle
    var array = new Int16Array(samples);
    for (var i = 0 ; i < samples ; i++) {
      array[i] = Math.floor(Math.sin(phase+((i / sampleRate) * (frequency * 2 * Math.PI))) * 0x7fff);
    }
    return array;
  };

  // Create mini-samples of audio bit encoding
  var bit0    = generateTone(baud,1,phase, sampleRate);
  var bit1    = generateTone(baud*2,2,phase, sampleRate);
  var stopbit = generateTone(baud*2,stopPulses/2,phase, sampleRate); // normally 4 pulses = 2 cycles of high tone = 'bit 1'
  var highwave= generateTone(baud*2,1,phase, sampleRate);

  var samplesPerCycle = bit0.length;

  // Write array to audio buffer
  writeSample = function(array) {
    var length = array.length;
    for (var i = 0 ; i < length; i++) {
      sampleData[samplePos+i] = array[i];
    } samplePos+=length;
  };

  // Write bit to audio buffer
  writeBit = function (bit) {
    (bit==0) ? writeSample(bit0) : writeSample(bit1);
  };

  // Write byte to audio buffer in standard 8N1 format
  writeByte = function(byte) {
    writeSample(bit0); // Start bit 0
    for (var b = 0; b < 8; b++) {
      bit = byte & 1;
      writeBit(bit);
      byte = byte >>1;
    }
    writeSample(stopbit); // Stop bit 1
  };

  // Write data range in UEF file to audio buffer
  writeData = function(chunk) {
    for (var i = chunk.start; i < chunk.end; i++) {
      writeByte(this.uefData[i]);
    }
  };

  // Write formatted data byte to audio buffer
  writeFormByte = function(byte, format){
    var parity = 0;
    writeSample(bit0); // Start bit 0
    for (var b = 0; b < format.bitsPerPacket; b++) { // Data packet
      bit = byte & 1;
      parity += bit;
      writeBit(bit);
      byte = byte >>1;
    }
    parity = parity & 1; // Parity bit
    if (format.parity=="O") {parity ^= 1};
    if (format.parity!="N") {writeBit(parity);};
    for (var i = 0; i < format.stopBits; i++) {
      writeSample(bit1); // Stop bit(s) 1
    }
    if (format.extraWave==1) {writeSample(highwave);};
  };

  // Write data range in UEF to audio buffer
  writeFormData = function(chunk) {
    for (var i = chunk.start; i < chunk.end; i++) {
      writeFormByte(this.uefData[i], chunk.format);
    }
  };

  // Write carrier tone using cycles/2 '1' bits
  carrierTone = function(chunk) {
    for (var i = 0; i < (chunk.cycles); i++) {writeSample(bit1);}
  };

  // Gap advances sample position pointer, assumes array is zero filled
  writeGap = function(chunk) {
    samplePos+= samplesPerCycle * chunk.cycles;
  };

  fail = function(chunk){
    console.log("FAILED: "+chunk.args);
    this.fails += 1;
  }

  ignore = function(chunk){
    //console.log("IGNORED! "+warning+" at "+byte);
  }

  // Define functions to apply to uefChunk tokens
  var functions = {
    integerGap:         writeGap,
    carrierTone:        carrierTone,
    writeByte:          writeByte,
    writeData:          writeData,
    writeFormData:      writeFormData,
    fail:               fail,
    ignore:             ignore}

    // Parse all UEF chunk tokens
    for (var i = 0; i < numChunks; i++) {
      chunk = this.uefChunks[i];
      this.uefChunks[i].pos = samplePos;
      functions[chunk.op].apply(this, [chunk]);
      DELTA = this.uefChunks[i].cycles*samplesPerCycle  || 0;
      if (samplePos != this.uefChunks[i].pos + DELTA) {
        var dataLength = this.uefChunks[i].end - this.uefChunks[i].start;
        var sampleDelta = (samplePos-this.uefChunks[i].pos-DELTA);
        var perByte = sampleDelta / dataLength; // samplesPerCycles
        console.log ("ERROR: "+i, perByte, this.uefChunks[i], DELTA);

      }
    }

    console.log(Math.floor(samplePos/sampleRate)+"s WAV audio at "+baud+" baud");
    return new Uint8Array(this.BuildWaveHeader(waveBuffer, samplePos));
  };

  // Create WAV header for audio buffer
  uef2wave.prototype.BuildWaveHeader = function(waveBuffer, sampleLength) {
    var numFrames = sampleLength;
    var numChannels = 1;
    var sampleRate = this.sampleRate;
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

  uef2wave.prototype.convert = function() {
    console.time('Decode UEF');
    this.decodeUEF();
    console.timeEnd('Decode UEF');
    console.time('Create WAV');
    var wavfile = this.createWAV();
    console.timeEnd('Create WAV');
    return wavfile;
  };
