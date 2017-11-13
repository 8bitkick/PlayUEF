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
// http://electrem.emuunlim.com/UEFSpecs.htm
//

function uef2wave (uefData, baud, sampleRate, stopPulses, phase, carrier){
  "use strict";

  var isValidUEF = function() {return ((String.fromCharCode.apply(null,uefData.slice(0, 9)) == "UEF File!"));}

  // check if the UEF is in fact zipped
  if (isValidUEF()==false) {
    var gunzip = new Zlib.Gunzip(uefData);
    uefData = gunzip.decompress();
  }

  if (isValidUEF()==false) {alert("ERROR: Invalid UEF file :(");}

  var uefChunks      = [];
  var samplesPerCycle= Math.floor(sampleRate / baud); // Audio samples per base cycle
  var uefPos         = 12; // skip over "UEF File!"
  var uefDataLength  = uefData.length;
  var carrier        = carrier / 2; // 1 = half.
  var firstBlock     = true; // track to reduce firstBlock carrier tones if carrier=0
  var parityInvert   = false;
  var cycleArray     = []; // this is what we are building

  function decodeUEF(uefData){
    // Cassette Filing System header http://beebwiki.mdfs.net/Acorn_cassette_format
    function acornBlockInfo (data){
      function isZero(element) {return element == 0;}
      var strend = data.findIndex(isZero);
      var filename = String.fromCharCode.apply(null,data.slice(0,strend));
      var loadAddress = doubleAt(data,strend+1);
      var executionAddress = doubleAt(data,strend+5);
      var blockNumber = wordAt(data,strend+9);
      return filename+" "+(("00"+blockNumber.toString(16)).substr(-2))+" "+hex(loadAddress)+" "+hex(executionAddress);
    }

    function readChunk(uefData, pos) {
      var UEFchunk = {
        id:     "x"+hex4(wordAt(uefData,pos)),
        data:   uefData.slice(pos+6, doubleAt(uefData,pos+2)+pos+6)
      };
      return UEFchunk;
    }

    function decodeChunk(UEFchunk) {
      var chunkFunc = {
        x0000: originInformation,
        x0100: dataBlock,
        x0104: definedDataBlock,
        x0110: carrierTone,
        x0112: integerGap,
        x0111: carrierToneByte,
        x0116: floatingPointGap,
        x0114: securityCycles
      };
      if (chunkFunc[UEFchunk.id]) {
        return chunkFunc[UEFchunk.id].apply(this, [UEFchunk]);
      }
      else console.log("UNKNOWN "+UEFchunk.id);
    }

    // 0x0000
    function originInformation(UEFchunk){
      var info = String.fromCharCode.apply(null,UEFchunk.data);
      console.log("UEF info: "+info);
      var match = info.match(/MakeUEF\D+(\d+)\.(\d+)/i);
      if (match) {
        var version = match[1];
        if (version < 3) {parityInvert = true;}
        console.log("PlayUEF : MakeUEF v2.x or below - 0x0104 parity will be inverted");
      }
      return null;
    }

    // 0xx0100
    function dataBlock(UEFchunk){
      return {
        type:   "dataBlock",
        format: {
          bits:     8,
          parity:   "N",
          stopBits: 1
        },
        header: ((UEFchunk.data[0]==0x2A && UEFchunk.data.length>24) ? acornBlockInfo(UEFchunk.data.slice(1)) : ""),
        data:   UEFchunk.data
      };
    }

    // 0x0104
    function definedDataBlock(UEFchunk){
      return {
        type:   "dataBlock",
        format: {
          bits:     UEFchunk.data[0],
          parity:   ((chr(UEFchunk.data[1])=="E" || (chr(UEFchunk.data[1])=="O" && parityInvert)) ? "E" : "O"),
          stopBits: UEFchunk.data[2]
        },
        header: "",
        data:   UEFchunk.data
      };
    }

    // 0x0110
    function carrierTone(UEFchunk){
      return {
        type:   "carrierTone",
        cycles: wordAt(UEFchunk.data,0)*carrier
      };
    }

    // 0x0114
    function securityCycles(UEFchunk){
      return {
        type:   "carrierTone",
        cycles: (doubleAt(UEFchunk.data,0) & 0x00ffffff)*carrier
      };
    }

    // 0x0111
    function carrierToneByte(UEFchunk){
      return [
        {
          type:   "carrierTone",
          cycles: wordAt(UEFchunk.data,0)*carrier
        },
        {
          type:   "dataBlock",
          data: [0xAA]
        },
        {
          type:   "carrierTone",
          cycles: wordAt(UEFchunk.data,2)*carrier // after byte
        }
      ]
    }

    // 0x0112
    function integerGap(UEFchunk){
      return {
        type:   "integerGap",
        cycles: wordAt(UEFchunk.data,0)*2
      };
    }

    // 0x0116
    function floatingPointGap(UEFchunk){
      return {
        type:   "integerGap",
        cycles: Math.ceil(floatAt(UEFchunk.data,0) * baud)
      };
    }

    function cyclesPerPacket(format){
      return 1+format.bits+(format.parity=="N" ? 0 : 1)+format.stopBits;
    }

    while (uefPos < uefDataLength) {
      var UEFchunk = readChunk(uefData, uefPos);
      var currentChunk = decodeChunk(UEFchunk);
      if (currentChunk != null) {
      currentChunk.cycles = (currentChunk.cycles != null) ? currentChunk.cycles : cyclesPerPacket(currentChunk.format)*currentChunk.data.length;
        uefChunks.push(currentChunk)
      }
      uefPos += UEFchunk.data.length + 6;
    }
    return uefChunks;
  }


  function createWAV (uefChunks) {
    var sampleLength = sampleRate * 60 * 10; // DELETE
    var waveBuffer = new ArrayBuffer(44 + (sampleLength*2)); // Header is 44 bytes, sample is 16-bit * sampleLength
    var sampleData  = new Int16Array(waveBuffer, 44,sampleLength);
    var samplePos = 0;
    var numChunks = uefChunks.length;

    // Creates 16-bit array of a sine wave for given frequency, cycles and phase
    function generateTone (frequency, cycles, phase, sampleRate) {
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
    var writeSample = function(array) {
      var length = array.length;
      for (var i = 0 ; i < length; i++) {
        sampleData[samplePos+i] = array[i];
      } samplePos+=length;
    };

    // Write bit to audio buffer
    var writeBit = function (bit) {
      (bit==0) ? writeSample(bit0) : writeSample(bit1);
    };

    // Write data range in UEF file to audio buffer
    var writeData = function(chunk) {
      var length = chunk.data.length;
      var format = chunk.format;
      for (var i = 0; i < length; i++) {
        writeFormByte(chunk.data[i],format);
      }
    };

    // Write formatted data byte to audio buffer
    var writeFormByte = function(byte,format){
      var parity = 0;
      writeSample(bit0); // Start bit 0
      for (var b = 0; b < format.bits; b++) { // Data packet
        var bit = byte & 1;
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

    // Write carrier tone using cycles/2 '1' bits
    var writeTone = function(chunk) {
      for (var i = 0; i < (chunk.cycles); i++) {writeSample(bit1);}
    };

    // Gap advances sample position pointer, assumes array is zero filled
    var writeGap = function(chunk) {
      samplePos+= samplesPerCycle * chunk.cycles;
    };

    // Define functions to apply to uefChunk tokens
    var functions = {
      integerGap:         writeGap,
      carrierTone:        writeTone,
      dataBlock:          writeData
    }

    // Parse all UEF chunk tokens
    for (var i = 0; i < numChunks; i++) {
      var chunk = uefChunks[i];
      uefChunks[i].pos = samplePos;
      functions[chunk.type].apply(this, [chunk]);
    }

    console.log(Math.floor(samplePos/sampleRate)+"s WAV audio at "+baud+" baud");
    return new Uint8Array(buildWAVheader(waveBuffer, samplePos, sampleRate));
  };

  console.time('Decode UEF');
  var uefChunks = decodeUEF(uefData);
  console.timeEnd('Decode UEF');
  console.time('Create WAV');
  var wavfile = createWAV(uefChunks);
  console.timeEnd('Create WAV');
  return {wav:wavfile, uef:uefChunks};
};
