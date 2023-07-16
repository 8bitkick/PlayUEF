
import JSZip from 'jszip';

export function updateStatus (status) { document.getElementById("status").innerHTML = status; };
export function handleError (message, exception) {
  console.error(message,exception)
  //document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus("ERROR: "+message);throw exception;}
};

// Handle zipped files (containing one UEF and TXT notes, as standard on STH)
export async function handleZip(filedata, filename) {
    let textfile;
    console.log(filedata);
    if (filename.split(".").pop().toLowerCase() == "zip") {
        // try {
            var files = {};
            var zip = new JSZip();
            var contents = await zip.loadAsync(filedata);
            var filenames = Object.keys(contents.files);
            // iterate through files in the zip
            for (var i = 0; i < filenames.length; i++) {
                console.log("Decompressing... ",filenames[i]);
                files[filenames[i]] = await zip.file(filenames[i]).async('uint8array');
                var extension = filenames[i].split(".").pop().toLowerCase();
                if (extension=="uef") {var fileToPlay = i;filename = filenames[i]} // Only one Uef per zip handled for now
                if (extension=="txt") {textfile = String.fromCharCode.apply(null, files[filenames[i]]).replace(/\n/g, "<br />");};
                filedata = files[filenames[fileToPlay]];
        //     }
        // } catch(e) {
        //     handleError("trying to unzip<br>"+filename,e,filedata);
       }
    }
    return {data:filedata, name:filename};
}


export function wordAt (array,position){
  var bytes = array.slice(position, position+2);
  return new Uint16Array(bytes.buffer)[0];
}

export function doubleAt (array,position){
  var bytes = array.slice(position, position+4);
  return new Uint32Array(bytes.buffer)[0];
}

export function floatAt (array,position){
  var bytes = array.slice(position, position+4);
  return new Float32Array(bytes.buffer)[0];
}

export function hex (value) {return ("00000000" + value.toString(16)).substr(-8);}
export function hex4(value) {return ("0000" + value.toString(16)).substr(-4);}
export function chr (value) {return (String.fromCharCode(value));}

// Create WAV header for audio buffer
export function buildWAVheader(waveBuffer, sampleLength, sampleRate) {
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

export function binarySearch(array, key, samplesPerCycle) {
  var lo = 0, hi = array.length - 1, mid, element;
  while (lo <= hi) {
    mid = ((lo + hi) >> 1);
    element = array[mid];
    if ((element.timestamp+(element.cycles*samplesPerCycle)) < key) {
      lo = mid + 1;
    } else if (element.timestamp > key) {
      hi = mid - 1;
    } else {
      return mid;
    }
  }
  return -1;
}

export function chunkAtTime(currentTime, chunks, baud, sampleRate){

var bytesPerSample = (baud/sampleRate)/8; // # tape bytes transmitted per WAV sample, assuming 10 bit packets
  const samplesPerCycle = sampleRate / baud;
  var samplepos = currentTime * sampleRate;
  let thischunk = binarySearch(chunks,samplepos,samplesPerCycle);
  console.log(currentTime, thischunk, baud, sampleRate)
  // For UEF data chunks display contents in the console in 'real time'
  switch (chunks[thischunk].type){
    case "dataBlock":
    var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
    var str = chunks[thischunk].datastr.slice(delta & 0xfe00,delta)+"◼";
    return {'str': str, 'header': chunks[thischunk].header, 'color':  "#00aa00"}

    case "definedDataBlock":
    var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
    var str = chunks[thischunk].datastr.slice(delta & 0xfe00,delta)+"◼";
    return {'str': str, 'header': chunks[thischunk].header, 'color':  "#00aaaa"}

    // Clear console for integerGap
    case "integerGap":
    return {'str': "", 'header': "", 'color':  "#000000"}

    // Bright green for carrierTone, it just looks cooler
    case "carrierTone":
    return {'str': "", 'header': "", 'color':  "#00ff22"}
  }
}
