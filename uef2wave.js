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

function uef2wave (uefData, baud, sampleRate, stopPulses, phase, carrierFactor, highBitFreq){
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

  // Mini-samples of the audio bit encoding. These are rebuilt whenever a base
  // frequency (0x0113) or phase (0x0115) change chunk is reached, so per-section
  // baud rates and phase recorded from the original tape are reproduced.
  const highRatio = highBitFreq / baud;   // '1' frequency relative to base (normally 2)
  function buildTones (baseFreq, phaseVal, log) {
    return {
      carrier:  generateTone(log ? "carrier" : null, baseFreq * highRatio, 1, phaseVal, sampleRate),
      bit0:     generateTone(log ? "bit0   " : null, baseFreq,             1, phaseVal, sampleRate),
      bit1:     generateTone(log ? "bit1   " : null, baseFreq * highRatio, 2, phaseVal, sampleRate),
      highwave: generateTone(null,                   baseFreq * highRatio, 1, phaseVal, sampleRate)
    };
  }
  var tones       = buildTones(baud, phase, true);
  var curBaseFreq = baud;
  var curPhase    = phase;

  var isValidUEF = function() {return ((String.fromCharCode.apply(null,uefData.slice(0, 9)) == "UEF File!"));}

  // check if the UEF is in fact zipped
  if (isValidUEF()==false) {
    try{
      var gunzip = new Zlib.Gunzip(uefData);
      uefData = gunzip.decompress();
    }
    catch(e) {handleError("Invalid UEF/ZIP file<BR>",e);}
  }

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
          var major = parseInt(match[1]);
          var minor = parseInt(match[2]);
          if (major < 2 || (major === 2 && minor < 4)) {parityInvert = 1;
            console.log("PlayUEF : MakeUEF v" + major + "." + minor + " - 0x0104 parity will be inverted");
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

        case 0x0113: // changeOfBaseFrequency - per-section baud rate from the tape
        uefChunks.push({type:"baseFreq", cycles:0, freq:floatAt(UEFchunk.data,0)});
        break;

        case 0x0115: // phaseChange - waveform phase in degrees
        uefChunks.push({type:"phaseChange", cycles:0, phase:wordAt(UEFchunk.data,0)*(Math.PI/180)});
        break;

        case 0x0111: // carrierToneWithDummyByte
        uefChunks.push({type:"carrierTone", cycles:wordAt(UEFchunk.data,0)}); // before cycles
        uefChunks.push({type:"dataBlock",   data:[0xAA], cycles:10, header:""}); // Dummy Byte
        uefChunks.push({type:"carrierTone", cycles:wordAt(UEFchunk.data,2)}); // after byte
        break;

        case 0x0114: // securityCycles - high/low frequency wave pattern
        var secCycles = UEFchunk.data[0] | (UEFchunk.data[1]<<8) | (UEFchunk.data[2]<<16);
        var secBits = [];                       // 1 = high (2400Hz) cycle, 0 = low (1200Hz) cycle
        for (var sc = 0; sc < secCycles; sc++) {
          var secByte = UEFchunk.data[5+(sc>>3)];
          secBits.push((secByte >> (7-(sc&7))) & 1);
        }
        // first/last pulse: 'P' = leading/trailing half-cycle (single pulse), 'W' = whole cycle
        uefChunks.push({type:"securityCycles", cycles:secCycles, bits:secBits,
                        first:chr(UEFchunk.data[3]), last:chr(UEFchunk.data[4])});
        break;

        case 0x0116: // floatingPointGap - silence of the given duration in seconds
        blockNumber = 0;
        var gapSeconds = floatAt(UEFchunk.data,0);
        uefChunks.push({type:"integerGap",
                        samples: Math.round(gapSeconds * sampleRate),   // exact gap length
                        cycles:  Math.ceil(gapSeconds * baud)});        // upper bound for buffer estimate
        break;
      }
    }

    function cyclesPerPacket(format){
      return 1+format.bits+(format.parity=="N" ? 0 : 1)+format.stopBits;
    }

    // Adjust carrier tone accoring to parameter
    function carrierAdjust(cycles){
      if (carrierFactor==0) {
        return (blockNumber>0) ? (12000 / tones.carrier.length) : cycles; // minimal interblock
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
      (bit==0) ? writeSample(tones.bit0) : writeSample(tones.bit1);
    }

    // Standard BBC Micro / Acorn Electron 8N1 format data
    var writeStandardBlock = function(chunk){
      var length = chunk.data.length;
      for (var i = 0; i < length; i++) {
        var byte = chunk.data[i];
        writeSample(tones.bit0);
        for (var b = 0; b < 8; b++) {var bit = byte & 1; writeBit(bit); byte = byte >>1;}
        writeSample(tones.bit1);
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
      writeSample(tones.bit0); // Write start bit 0
      for (var b = 0; b < format.bits; b++) {
        var bit = byte & 1;
        writeBit(bit);
        byte = byte >>1;
      }
      if (format.parity !="N") {writeBit(paritybit);};
      for (var i = 0; i < format.stopBits; i++) {
        writeSample(tones.bit1);
      }
      if (format.extraWave==1) {writeSample(tones.highwave);};
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
      for (var i = 0; i < (chunk.cycles); i++) {writeSample(tones.carrier);}
    }

    // Write security cycles: the recorded high/low frequency wave pattern. A '1'
    // bit is one cycle at the high frequency, a '0' bit one cycle at the base
    // frequency; a 'P' first/last marker makes that end a half cycle. A half
    // cycle is a 180 deg phase step, so within the region we track a running
    // phase and advance every following wave by it — otherwise the half-pulse
    // shares the next cycle's polarity and fuses with it, distorting the pattern.
    //
    // NB: the shift is deliberately *not* propagated past the region into the
    // following carrier/data. Doing so (inverting the rest of the tape) is what a
    // continuous analogue tape does, but MakeUEF's decoder is polarity-sensitive
    // and fails to read inverted data — so the real reference tool round-trips
    // this (region-local) form, not the globally-propagated one.
    var writeSecurity = function(chunk) {
      var n = chunk.bits.length;
      var ph = curPhase;
      for (var i = 0; i < n; i++) {
        var high = chunk.bits[i] === 1;
        var freq = high ? curBaseFreq*highRatio : curBaseFreq;
        var halfPulse = (i === 0 && chunk.first === "P") || (i === n-1 && chunk.last === "P");
        var cycles = halfPulse ? 0.5 : 1;
        writeSample(generateTone(null, freq, cycles, ph, sampleRate));
        ph += cycles * 2 * Math.PI;
      }
    }

    // Gap advances sample position pointer, assumes array is zero filled.
    // Floating-point gaps (0x0116) carry an exact sample count; integer gaps
    // (0x0112) are measured in base cycles.
    //
    // The preceding tone's final half-cycle has no closing edge before the
    // zero-filled silence, so a square-wave reader (and MakeUEF) sees that last
    // half-pulse run straight into the gap as one over-long pulse — an odd
    // half-pulse count that MakeUEF misreads as a spurious 1-cycle security wave
    // (0x0114) at every carrier->gap boundary. A real tape never does this: its
    // recording carries a transition at the boundary. So we terminate the last
    // half-pulse with a single opposite-polarity sample (the gap keeps its exact
    // total length), giving the reader a clean cycle count and an isolated gap.
    var writeGap = function(chunk) {
      var n = (chunk.samples != null) ? chunk.samples : samplesPerCycle * chunk.cycles;
      if (n > 0) {
        var k = samplePos - 1;
        while (k >= 0 && sampleData[k] === 0) k--;          // last non-silent sample
        if (k >= 0) { sampleData[samplePos++] = (sampleData[k] > 0) ? -0x4000 : 0x4000; n--; }
      }
      samplePos += n;
    }

    // Base frequency / phase change: rebuild the tone set for following waves
    var setBaseFreq = function(chunk) { curBaseFreq = chunk.freq;  tones = buildTones(curBaseFreq, curPhase); }
    var setPhase    = function(chunk) { curPhase    = chunk.phase; tones = buildTones(curBaseFreq, curPhase); }

    // Define functions to apply to uefChunk tokens
    var functions = {
      integerGap:         writeGap,
      carrierTone:        writeTone,
      dataBlock:          writeStandardBlock,
      definedDataBlock:   writeDefinedBlock,
      securityCycles:     writeSecurity,
      baseFreq:           setBaseFreq,
      phaseChange:        setPhase
    }

    var uefCycles   = 0
    var numChunks   = uefChunks.length;
    var minBaseFreq = baud;          // lowest base frequency => most samples per cycle

    for (var i = 0; i < numChunks; i++) {
      uefCycles += uefChunks[i].cycles;
      if (uefChunks[i].type === "baseFreq" && uefChunks[i].freq < minBaseFreq) minBaseFreq = uefChunks[i].freq;
    }

    // Size the buffer for the worst case (lowest frequency); the WAV header is
    // written from the actual samplePos, so over-allocation only costs memory.
    var maxSamplesPerCycle = Math.ceil(sampleRate / minBaseFreq) + 2;
    var estLength     = uefCycles * maxSamplesPerCycle; // Estimate WAV length from UEF decode
    var waveBuffer    = new ArrayBuffer(44 + (estLength*2)); // Header is 44 bytes, sample is 16-bit * sampleLength
    var sampleData    = new Int16Array(waveBuffer, 44, estLength);
    var samplePos     = 0;
    var re = /[^\x20-\xff]/g;
    // Parse all chunk objects and write WAV
    for (var i = 0; i < numChunks; i++) {
      var chunk = uefChunks[i];
      uefChunks[i].timestamp = samplePos; // Record start position in audio WAV, given in samples
      functions[chunk.type].apply(this, [chunk]);

      // Array to string for console display
      if (uefChunks[i].data != null){

        var str = String.fromCharCode.apply(null,uefChunks[i].data);//
          uefChunks[i].datastr = str.replace(re, ".");
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
