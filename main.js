// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//
import uef2wave from './uef2wave';
import player from './player';
import { handleError, updateStatus } from './utils.js';
import JSZip from 'jszip';

export function main(LOW, FILE, TURBO, PHASE, LOCAL, CARRIER, STOPBIT, HIGH, DATA, SAMPLE_RATE = 48000, WIDTH = window.innerWidth, TITLE, TEXTFILE, UEFNAME, BAUD) {
  LOW = LOW || 1200;
  FILE = FILE || "./tapes/Arcadians_E.zip";
  TURBO = TURBO || 0;
  PHASE = (PHASE || 180) *(Math.PI/180);
  LOCAL = LOCAL || false;
  CARRIER = (CARRIER || 2)/2;
  STOPBIT = STOPBIT || 4;
  HIGH = HIGH || LOW * 2;
  DATA = DATA || false;
  BAUD = BAUD || Math.floor((parseInt(LOW) + parseInt(HIGH) / 2) / 2);

  console.log("Phase: "+PHASE, "High: "+HIGH)

  //if (TURBO==1) {STOPBIT=1; CARRIER=0; LOW = 1280}

  // Download UEF
  async function download(FILE, cb) {
    updateStatus("DOWNLOADING<BR>" + FILE.split("/").pop());

    try {
      const response = await fetch(FILE);
      const blobData = await response.blob();

      const reader = new FileReader();
      reader.onload = (event) => {
        const binaryData = event.target.result;
        console.log('Binary data:', binaryData);
        cb({ file: new Uint8Array(binaryData), name: FILE });
      };
      reader.readAsArrayBuffer(blobData);
    } catch (error) {
      console.error(error);
      // Handle error case
    }
  }

    // var xhttp = new XMLHttpRequest();
    // xhttp.open("GET", FILE, true);
    // xhttp.responseType = "arraybuffer";
    // xhttp.onerror = function (err) {return null};
    // xhttp.onload = function (e) {
    //   if (xhttp.status == 200) {
    //     cb({file: new Uint8Array(xhttp.response), name: FILE});
    //   }
    //   else{handleError(xhttp.status+"<br>"+FILE,0);}
    // }
    // xhttp.send(null);
  // }

  // Get local UEF
  function loadLocal(cb){
    updateStatus("<input type='file' id='files'>");
    function fileLoadEvent(event){
      var file = event.target.files[0];
      updateStatus("LOADING<BR>"+file.name);
      var reader = new FileReader();
      reader.addEventListener("load", fileRead, false);
      function fileRead(event){
        cb({file: new Uint8Array(event.target.result), name: file.name});
      }
      reader.readAsArrayBuffer(file);
    }
    document.addEventListener("change", fileLoadEvent, false);
  }




  async function startPlayer(uef){
    var uef = await handleZip(uef);
    document.getElementById("status").innerHTML = "CONVERTING";
    var converted = uef2wave(uef.file, LOW, SAMPLE_RATE, STOPBIT, PHASE, CARRIER, HIGH);
    player(converted.wav, converted.uef, uef.name, BAUD, SAMPLE_RATE, TEXTFILE);
  }

   if (DATA) {
     let uef = DATA.replace(/-/g, '+').replace(/_/g, '/');
     uef = new Uint8Array(atob(uef).split("").map(l => l.charCodeAt()));
     document.getElementById("status").innerHTML = "CONVERTING";
     var converted = uef2wave(uef, LOW, SAMPLE_RATE, STOPBIT, PHASE, CARRIER, HIGH);
     player(converted.wav, converted.uef, "TWEET",BAUD, SAMPLE_RATE, TEXTFILE);

   } else {
    // Kick-off player with local or downloaded UEF file
    (LOCAL=="true") ? loadLocal(startPlayer) : download(FILE,startPlayer);
  }
}

// window.onload=function(){
//   PlayUEF();
// };


export default main;
