// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//

var VERSION = "1.1";

var updateStatus = function(status) { document.getElementById("status").innerHTML = status; };
var handleError = function(message, exception) { document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus("ERROR: "+message);throw exception;};

var PlayUEF = function() {
  "use strict";

  // Get URL parameters
  var url = new URL(location.href);
  var LOW  = url.searchParams.get("LOW") || 1200; // frequency for zeros
  var FILE  = url.searchParams.get("FILE") || "tapes/Arcadians_E.zip"; // Loads Electron Arcadians locally by default
  var TURBO = url.searchParams.get("TURBO") || 0;
  var PHASE = url.searchParams.get("PHASE") || 180;
  var LOCAL = url.searchParams.get("LOCAL") || false;
  var CARRIER = url.searchParams.get("CARRIER") || 2; // Carrier tone length factor * 2
  var STOPBIT = url.searchParams.get("STOPBIT") || 4; // Stop bit cycles * 2
  var HIGH = url.searchParams.get("HIGH") || LOW*2; // frequency for ones
  var DATA     = url.searchParams.get("DATA") || false;
  var SAMPLE_RATE  = 48000;
  var WIDTH = window.innerWidth;
  var TITLE;
  var TEXTFILE = "";
  var UEFNAME = "";
  var BAUD = Math.floor((parseInt(LOW)+parseInt(HIGH))/2);

  console.log("Phase: "+PHASE, "High: "+HIGH)

  PHASE = PHASE*(Math.PI/180);
  CARRIER=CARRIER/2;
  if (TURBO==1) {STOPBIT=1; CARRIER=0; LOW = 1280}

  // Downlooad UEF
  function download(FILE, cb){
    updateStatus("DOWNLOADING<BR>"+FILE.split("/").pop());
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", FILE, true);
    xhttp.responseType = "arraybuffer";
    xhttp.onerror = function (err) {return null};
    xhttp.onload = function (e) {
      if (xhttp.status == 200) {
        cb({file: new Uint8Array(xhttp.response), name: FILE});
      }
      else{handleError(xhttp.status+"<br>"+FILE,0);}
    }
    xhttp.send(null);
  }

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

  // Handle zipped files (containing one UEF and TXT notes, as standard on STH)
  function handleZip(input){
    var filedata = input.file;
    var filename = input.name;
    console.log(filename);
    if (filename.split(".").pop().toLowerCase() == "zip"){
      try{
      var files = {};
      var unzip = new Zlib.Unzip(filedata);
      var filenames = unzip.getFilenames();
      // iterate through files in the zip
      for (var i = 0; i < filenames.length; i++) {
        document.getElementById("status").innerHTML = "UNZIPPING";
        console.log("Decompressing... ",filenames[i]);
        files[filenames[i]] = unzip.decompress(filenames[i]);
        var extension = filenames[i].split(".").pop().toLowerCase();
        if (extension=="uef") {var fileToPlay = i;filename = filenames[i]} // Only one Uef per zip handled for now
        if (extension=="txt") {TEXTFILE = String.fromCharCode.apply(null, files[filenames[i]]).replace(/\n/g, "<br />");};
        filedata = files[filenames[fileToPlay]];
      }
    }catch(e){handleError("trying to unzip<br>"+filename,e);}
    }
    return {file:filedata, name:filename};
  }

  function startPlayer(uef){
    var uef = handleZip(uef);
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

window.onload=function(){
  PlayUEF();
};
