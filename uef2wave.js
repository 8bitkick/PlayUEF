// PlayUEF
// 2017 8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//
// Reference:
//
// http://electrem.emuunlim.com/UEFSpecs.htm
//
import { chr,hex,wordAt,doubleAt,floatAt,hex4,buildWAVheader } from './utils.js';
import { handleError, updateStatus } from './utils.js';
import pako from 'pako';


async function uef2wave (uefData, baud, sampleRate, stopPulses, phase, carrierFactor, highBitFreq){
  "use strict";
  // Create 16-bit array of a sine wave for given frequency, cycles and phase
  function generateTone (label, frequency, cycles, phase, sampleRate) {
    var samples = Math.floor((sampleRate / frequency)*cycles);
    var array = new Int16Array(samples);
    for (var i = 0 ; i < samples ; i++) {
      array[i] = Math.floor(Math.sin(phase+((i / sampleRate) * (frequency * 2 * Math.PI))) * 0x7fff);
    }
    let info = label+": "+Math.floor(1000000*array.length/sampleRate)+"us ("+cycles+" pulses at "+frequency+"Hz)";
    if (label !==null) console.log(info);
    return array;
  }

  // Create mini-samples of audio bit encoding
  const carrier = generateTone("carrier", baud*2,2,phase, sampleRate);
  const bit0    = generateTone("bit0   ", baud,1,phase, sampleRate);
  const bit1    = generateTone("bit1   ", highBitFreq,2,phase, sampleRate);
  //const stopbit = generateTone("stopbit", baud*2,stopPulses/2,phase, sampleRate);
  const highwave= generateTone(null, baud*2,1,phase, sampleRate);

  var isValidUEF = function() {return ((String.fromCharCode.apply(null,uefData.slice(0, 9)) == "UEF File!"));}

  // check if the UEF is in fact zipped
  if (isValidUEF() == false) {
    try {
      uefData = pako.inflate(uefData, { to: 'Array' });
    } catch (e) {
      handleError("Invalid UEF/ZIP file<BR>", e);
    }
  };

  if (isValidUEF()==false) {handleError("Invalid UEF file",0);}

  // TODO - Variables passed to decode and WAV creation
  var uefChunks      = [];
  var samplesPerCycle= Math.floor(sampleRate / baud); // Audio samples per base cycle
  var uefPos         = 12; // skip over "UEF File!"
  var uefDataLength  = uefData.length;
  var parityInvert   = 0;
  var uefCycles      = 0;

  function decodeUEF(uefData){
    function decodeChunk(UEFchunk) {
      switch (UEFchunk.id){

        case 0x0000: // originInformation
        var info = String.fromCharCode.apply(null,UEFchunk.data);
        console.log("UEF info: "+info);
        var match = info.match(/MakeUEF\D+(\d+)\.(\d+)/i);
        if (match) {
          var version = match[1];
          if (version < 3) {parityInvert = 1;
            console.log("PlayUEF : MakeUEF v2.x or below - 0x0104 parity will be inverted");
          }
        }
        break;
        case 0x0100: // dataBlock
        var header = acornBlockInfo(UEFchunk.data);
        uefChunks.push({type:"dataBlock", header:header, data:UEFchunk.data, cycles:10*UEFchunk.data.length});
        blockNumber++;
        break;

        case 0x0104: // definedDataBlock
        var data = UEFchunk.data.slice(3);
        var format = {bits:UEFchunk.data[0], parity:chr(UEFchunk.data[1]), stopBits:UEFchunk.data[2]};
        var cycles = cyclesPerPacket(format)*data.length;
        uefChunks.push({type:"definedDataBlock", format:format, header:"Defined format data chunk "+hex(blockNumber), data:data, cycles:cycles});
        blockNumber++;
        break;

        case 0x0110: // carrierTone
        uefChunks.push({type:"carrierTone", cycles:carrierAdjust(wordAt(UEFchunk.data,0))});
        break;

        case 0x0112: // integerGap
        blockNumber = 0;
        uefChunks.push({type:"integerGap", cycles:wordAt(UEFchunk.data,0)*2});
        break;

        case 0x0111: // carrierToneWithDummyByte
        uefChunks.push({type:"carrierTone", cycles:wordAt(UEFchunk.data,0)}); // before cycles
        uefChunks.push({type:"dataBlock",   data:[0xAA], cycles:10, header:""}); // Dummy Byte
        uefChunks.push({type:"carrierTone", cycles:wordAt(UEFchunk.data,2)}); // after byte
        break;

        case 0x0114: // securityCycles - REPLACED WITH CARRIER TONE
        uefChunks.push({type:"carrierTone", cycles:(doubleAt(UEFchunk.data,0) & 0x00ffffff)});
        break;

        case 0x0116: // floatingPointGap - APPROXIMATED
        blockNumber = 0;
        uefChunks.push({type:"integerGap", cycles: carrierAdjust(Math.ceil(floatAt(UEFchunk.data,0) * baud))});
        break;
      }
    }

    function cyclesPerPacket(format){
      return 1+format.bits+(format.parity=="N" ? 0 : 1)+format.stopBits;
    }

    // Adjust carrier tone accoring to parameter
    function carrierAdjust(cycles){
      if (carrierFactor==0) {
        return (blockNumber>0) ? (12000 / carrier.length) : cycles; // minimal interblock
      }
      else {
        return cycles * carrierFactor;
      }
    }

    // Cassette Filing System header http://beebwiki.mdfs.net/Acorn_cassette_format
    function acornBlockInfo (data){
      if (data[0]==0x2A && data.length>24) {
        function isZero(element) {return element == 0;}
        var strend = data.findIndex(isZero);
        var filename = String.fromCharCode.apply(null,data.slice(1,strend));
        var loadAddress = doubleAt(data,strend+1);
        var executionAddress = doubleAt(data,strend+5);
        var blockNumber = wordAt(data,strend+9);
        return filename+" "+(("00"+blockNumber.toString(16)).substr(-2))+" "+hex4(loadAddress)+" "+hex4(executionAddress);
      }
      else {
        return ""
      }
    }

    function readChunk(uefData, pos) {
      var UEFchunk = {
        id:     wordAt(uefData,pos),
        data:   uefData.slice(pos+6, doubleAt(uefData,pos+2)+pos+6)
      };
      return UEFchunk;
    }

    // Decode all UEF chunks
    var blockNumber = 0;
    while (uefPos < uefDataLength) {
      var UEFchunk = readChunk(uefData, uefPos);
      decodeChunk(UEFchunk);
      uefPos += UEFchunk.data.length + 6;
    }
    return uefChunks;
  }


  function createWAV (uefChunks) {

    // Write array to audio buffer
    var writeSample = function(array) {
      var length = array.length;
      for (var i = 0 ; i < length; i++) {
        sampleData[samplePos+i] = array[i];
      } samplePos+=length;
    }

    // Write bit to audio buffer
    var writeBit = function (bit) {
      (bit==0) ? writeSample(bit0) : writeSample(bit1);
    }

    // Standard BBC Micro / Acorn Electron 8N1 format data
    var writeStandardBlock = function(chunk){
      var length = chunk.data.length;
      for (var i = 0; i < length; i++) {
        var byte = chunk.data[i];
        writeSample(bit0);
        for (var b = 0; b < 8; b++) {var bit = byte & 1; writeBit(bit); byte = byte >>1;}
        writeSample(bit1);
      }
    }

    // Custom block data format and Acorn Atom
    var writeDefinedByte = function(byte,format){
      if (format.parity != "N"){
        var paritybit = byte;
        paritybit ^= (paritybit >> 4);
        paritybit ^= (paritybit >> 2);
        paritybit ^= (paritybit >> 1);
        paritybit = (format.parity == "O") ? (paritybit&1)^1 : paritybit&1;
        paritybit ^= parityInvert;
      }
      writeSample(bit0); // Write start bit 0
      for (var b = 0; b < format.bits; b++) {
        var bit = byte & 1;
        writeBit(bit);
        byte = byte >>1;
      }
      if (format.parity !="N") {writeBit(paritybit);};
      for (var i = 0; i < format.stopBits; i++) {
        writeSample(bit1);
      }
      if (format.extraWave==1) {writeSample(highwave);};
    }

    // Write defined format data byte
    var writeDefinedBlock = function(chunk) {
      var length = chunk.data.length;
      for (var i = 0; i < length; i++) {
        writeDefinedByte(chunk.data[i], chunk.format);
      }
    }

    // Write carrier tone
    var writeTone = function(chunk) {
      for (var i = 0; i < (chunk.cycles); i++) {writeSample(carrier);}
    }

    // Gap advances sample position pointer, assumes array is zero filled
    var writeGap = function(chunk) {
      samplePos+= samplesPerCycle * chunk.cycles;
    }

    // Define functions to apply to uefChunk tokens
    var functions = {
      integerGap:         writeGap,
      carrierTone:        writeTone,
      dataBlock:          writeStandardBlock,
      definedDataBlock:   writeDefinedBlock
    }

    var uefCycles = 0
    var numChunks = uefChunks.length;

    for (var i = 0; i < numChunks; i++) {
      uefCycles += uefChunks[i].cycles;
    }

    var estLength     = uefCycles * samplesPerCycle; // Estimate WAV length from UEF decode
    var waveBuffer    = new ArrayBuffer(44 + (estLength*2)); // Header is 44 bytes, sample is 16-bit * sampleLength
    var sampleData    = new Int16Array(waveBuffer, 44, estLength);
    var samplePos     = 0;

    // Parse all chunk objects and write WAV
    for (var i = 0; i < numChunks; i++) {
      var chunk = uefChunks[i];
      uefChunks[i].timestamp = samplePos; // Record start position in audio WAV, given in samples
      functions[chunk.type].apply(this, [chunk]);

      // Array to string for console display
      if (uefChunks[i].data != null){
        uefChunks[i].datastr= ""
        for (let n=0; n<uefChunks[i].data.length;n++){
          if (uefChunks[i].data[n]<32 || uefChunks[i].data[n]>126) {
            uefChunks[i].datastr+=String.fromCharCode(uefChunks[i].data[n] | 0x100);
          } else {
            uefChunks[i].datastr+=String.fromCharCode(uefChunks[i].data[n]);
          }
        }
        console.log(uefChunks[i].datastr)
      }

    }

    console.log((Math.floor(10*samplePos/sampleRate)/10)+"s WAV audio at "+baud+" baud");
    return new Uint8Array(buildWAVheader(waveBuffer, samplePos, sampleRate));
  }

  console.time('Decode UEF');
  var uefChunks = decodeUEF(uefData);

  console.timeEnd('Decode UEF');
  console.time('Create WAV');
  var wavfile = createWAV(uefChunks);
  console.timeEnd('Create WAV');
  return {wav:wavfile, uef:uefChunks};
};

export default uef2wave;
