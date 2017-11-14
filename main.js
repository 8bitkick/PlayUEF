// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//

var VERSION = "1.0 beta 3";

updateStatus = function(status) { document.getElementById("status").innerHTML = status; };
handleError = function(error) { document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus(error);throw new Error();};

PlayUEF = function() {
  "use strict";

  // Get URL parameters
  var url = new URL(location.href);
  var BAUD  = url.searchParams.get("BAUD") || 1200;
  var FILE  = url.searchParams.get("FILE") || "tapes/Arcadians_E.zip"; // Loads Electron Arcadians locally by default
  var TURBO = url.searchParams.get("TURBO") || 0;
  var PHASE = url.searchParams.get("PHASE") || 180;
  var LOCAL = url.searchParams.get("LOCAL") || "false";
  var CARRIER = url.searchParams.get("CARRIER") || 2; // Carrier tone length factor * 2
  var STOPBIT = url.searchParams.get("STOPBIT") || 4; // Stop bit cycles * 2
  var SAMPLE_RATE  = 44100;
  var WIDTH = window.innerWidth;
  var TITLE;
  var TEXTFILE = "";
  var UEFNAME = "";

  PHASE = PHASE*(Math.PI/180);
  CARRIER=CARRIER/2
  if (TURBO==1) {STOPBIT=1; CARRIER=0;};

  // Downlooad UEF
  if (LOCAL=="false"){
    updateStatus("DOWNLOADING "+FILE.split("/").pop());
    var oReq = new XMLHttpRequest();
    oReq.open("GET", FILE, true);
    oReq.responseType = "arraybuffer";
    oReq.onerror = function (err) {handleError("ERROR DOWNLOADING<br>"+FILE);};
    oReq.onload = function (oEvent) {
      if (oReq.status == 200) {
        console.log("Loaded ",FILE);
        var filedata = new Uint8Array(oReq.response);
        handleZip(filedata, FILE);
      }
      else{handleError("ERROR "+oReq.status+" DOWNLOADING<br>"+FILE);}
    }.bind(this);
    oReq.send(null);}

    // Get local UEF
    if (LOCAL=="true") {
      updateStatus('<input type="file" id="files">');
      function fileLoadEvent(evt){
        updateStatus('LOADING');
        var file = evt.target.files[0];
        var reader = new FileReader();
        reader.addEventListener("load", fileRead, false);
        function fileRead(event){
          var filedata = new Uint8Array(event.target.result);
          UEFNAME = file.name;
          handleZip(filedata, UEFNAME);
        }
        reader.readAsArrayBuffer(file);
      }
      document.addEventListener("change", fileLoadEvent, false);
    }

    // Handle zipped files (containing one UEF and TXT notes, as standard on STH)
    function handleZip(filedata, filename){
      console.log(filename);
      if (filename.split('.').pop().toLowerCase() == 'zip'){
        var files = {};
        var unzip = new Zlib.Unzip(filedata);
        var filenames = unzip.getFilenames();
        // iterate through files in the zip
        for (var i = 0, il = filenames.length; i < il; ++i) {
          console.log("Decompressing... ",filenames[i]);
          files[filenames[i]] = unzip.decompress(filenames[i]);
          var extension = filenames[i].split('.').pop().toLowerCase();
          if (extension=="uef") {var fileToPlay = i;UEFNAME = filenames[i]} // Only one Uef per zip handled for now
          if (extension=="txt") {TEXTFILE = String.fromCharCode.apply(null, files[filenames[i]]).replace(/\n/g, "<br />");};
          var UEFfiledata = files[filenames[fileToPlay]];
        }
      } else {UEFfiledata = filedata;};

      document.getElementById("status").innerHTML = "CONVERTING";
      // Do the actual conversion
      var result  = uef2wave(UEFfiledata, BAUD, SAMPLE_RATE, STOPBIT, PHASE, CARRIER);

      var wavfile   = result.wav;
      var UEFobject = result.uef;

      userInterface(wavfile, UEFobject, UEFNAME, BAUD, SAMPLE_RATE, TEXTFILE);
    }
  }

  window.onload=function(){
    PlayUEF();
  };
