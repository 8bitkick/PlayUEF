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


var uef2wave = function(uefData, baud, sampleRate, stopCycles, phase, carrier){
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
  this.stopCycles = stopCycles;
  this.phase =  phase;
  this.uefChunks = [];
  this.warning = "";
  this.carrier = carrier;
};

uef2wave.prototype.isValidUEF = function() {
  return ((String.fromCharCode.apply(null,this.uefData.slice(0, 9)) == "UEF File!"));
};

uef2wave.prototype.decode = function() {
  var samplesPerBit  = Math.floor(this.sampleRate / this.baud);
  var sampleLength   = 0;
  var nextChunk      = 12; // skip over "UEF File!"
  var uefDataLength  = this.uefData.length;
  var firstBlock     = true; // track to reduce firstBlock carrier tones if carrier=0
  var carrier        = this.carrier;

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

  var warningLog = function (message) {console.log("WARNING! Unsupported chunk: "+message); return "WARNING: Unsupported UEF chunks! See JS console<br>";}

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
        //----------------------------------------------------------
        var info = String.fromCharCode.apply(null,(this.uefData.slice(chunkStart, nextChunk)));
        console.log("UEF info: "+info);
        break;


        case 0x0100: // 0x0100 implicit start/stop bit tape data block
        //----------------------------------------------------------
        var data = new Uint8Array(this.uefData.slice(chunkStart, nextChunk));
        if (data[0]==0x2A && data.length>24) {header = CFSheader(data.slice(1, 24));} else {header=""}; // Request BBC micro block header summary
        this.uefChunks.push({op:"writeData", args:[chunkStart,nextChunk], data:data, header:header});

        sampleLength += (samplesPerBit*(chunkLength)*10);  // acorn have 1 start 1 stop bit per 8 bit byte = 10
        firstBlock = false;
        break;


        case 0x0110: // 0x0110 carrier tone
        //----------------------------------------------------------
        var cycles = wordAt(this.uefData,chunkStart);
        // CARRIER=0 reduces interblock carrier tone section to 120 cycles
        if (carrier==0 && firstBlock==false) {cycles = 120;}
        // length of preamble carrier tone relative to 1200Hz
        else {cycles = Math.ceil((this.baud/1200)*cycles);};
        if (carrier > 0) {cycles*=carrier;}; // Carrier length factor
        this.uefChunks.push({op:"carrierTone", args:[cycles]});

        sampleLength += (samplesPerBit * cycles);
        break;


        case 0x0111: // 0x0111 carrier tone (previously high tone) with dummy byte at byte
        //----------------------------------------------------------
        var beforeCycles = wordAt(this.uefData,chunkStart);
        var afterCycles  = wordAt(this.uefData,chunkStart+2);
        if (carrier > 0) {beforeCycles*=carrier; afterCycles*=carrier;}; // Carrier length factor
        this.uefChunks.push({op:"carrierTone", args:[beforeCycles]});
        this.uefChunks.push({op:"writeByte", args:[0xAA], header:""});
        this.uefChunks.push({op:"carrierTone", args:[afterCycles]});

        sampleLength += (samplesPerBit * (beforeCycles+afterCycles+10));
        break;


        case 0x0112: // 0x0112 Integer gap
        //----------------------------------------------------------
        var n = wordAt(this.uefData,chunkStart);
        var cycles = Math.ceil((this.baud/1000)*2*n); // Conservative gaps as we dont support MOTOR OFF
        this.uefChunks.push({op:"integerGap", args:[cycles]});

        sampleLength += samplesPerBit * cycles;
        firstBlock = true;
        break;


        case 0x0116: // 0x0116 floating point gap
        //----------------------------------------------------------
        var floatGap = floatAt(this.uefData,chunkStart);
        var cycles = Math.ceil(floatGap * this.baud); // We're cheating and converting to an integerGap
        this.uefChunks.push({op:"integerGap", args:[cycles]});

        sampleLength += samplesPerBit * cycles;
        firstBlock = true;
        break;


        // Ignored
        // --------
        // Capturing mechanical variance in cassette deck can usually be ignored?
        case 0x0113: // 0x0113 change of base frequency at byte
        break;

        case 0x0115: // 0x0115 phase change
        break;


        // Still to implement
        // ------------------
        case 0x0101:
        this.warning = warningLog('0x0101 multiplexed data block at byte '+uefPos);
        break;

        case 0x0102:
        this.warning = warningLog('0x0102 explicit tape data block at byte '+uefPos);
        break;

        case 0x0103:
        this.warning = warningLog('0x0103 multiplexed data block at byte '+uefPos);
        break;

        case 0x0104:
        this.warning = warningLog('0x0104 defined tape format data block at byte '+uefPos);
        break;

        case 0x0114:
        this.warning = warningLog('0x0114 security cycles at byte '+uefPos);
        break;

        case 0x0117:
        this.warning = warningLog('0x0117 data encoding format change at byte '+uefPos);
        break;

        case 0x0120:
        this.warning = warningLog('0x0120 position marker at byte '+uefPos);
        break;

        case 0x0130:
        this.warning = warningLog('0x0130 tape set info at byte '+uefPos);
        break;

        case 0x0131:
        this.warning = warningLog('0x0131 start of tape side at byte '+uefPos);
        break;

        default:
        this.warning = warningLog("0x"+hex(chunkID).substring(4,8)+" at byte "+uefPos);
      }
  }
  console.log(this.uefChunks.length+" UEF chunks read");
  return sampleLength;
};


// Convert UEF tokens to audio sample
uef2wave.prototype.convert = function() {
  // Scan UEF data array for ChunkIDs and parse, writing audio to buffer
  console.time('UEF to audio conversion');
  var sampleLength = this.decode(); // Calculates this.uefChunks as side effect
  var numChunks  = this.uefChunks.length;
  var sampleRate = this.sampleRate;
  var baud = this.baud;
  var phase = this.phase;
  var stopCycles = this.stopCycles;

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
  var stopbit = generateTone(baud*2,stopCycles/2,phase, sampleRate);

  var samplesPerBit = bit0.length;

  // Write array to sample buffer
  writeBit = function(bitArray) {
    var length = bitArray.length;
    for (var i = 0 ; i < length; i++) {
      sampleData[samplePos+i] = bitArray[i];
    } samplePos+=length;
  };

  // Write individual data byte to audio sample
  writeByte = function(byte) {
    writeBit(bit0); // Start bit 0
    for (var b = 0; b < 8; b++) {
      bit = byte & 1;
      if (bit==1) {writeBit(bit1);} else {writeBit(bit0);}
      byte = byte >>1;
    }
    writeBit(stopbit); // Stop bit 1
  };

  // Convert data range in UEF buffer to audio sample
  writeData = function(start, end) {
    for (var i = start; i < end; i++) {
      writeByte(this.uefData[i]);
    }
  };

  // Write carrier tone using cycles/2 '1' bits
  carrierTone = function(cycles) {
    var cycles = cycles >> 1; // divide by two as a bit1 contains two cycles
    for (var i = 0; i < (cycles); i++) {writeBit(bit1);}
  };

  // Gap advances sample position pointer, assumes array is zero filled
  writeGap = function(cycles) {
    samplePos+= samplesPerBit * cycles;
  };

  // Define functions to apply to uefChunk tokens
  var functions = {
    integerGap: writeGap,
    carrierTone: carrierTone,
    writeByte: writeByte,
    writeData: writeData}

    // Parse all UEF chunk tokens
    for (var i = 0; i < numChunks; i++) {
      chunk = this.uefChunks[i];
      this.uefChunks[i].pos = samplePos;
      functions[chunk.op].apply(this, chunk.args);
    }

    console.log(Math.floor(samplePos/sampleRate)+"s WAV audio at "+baud+" baud");
    console.timeEnd('UEF to audio conversion');
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
