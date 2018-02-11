// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//

var VERSION = "1.0 beta 3";

var updateStatus = function(status) { document.getElementById("status").innerHTML = status; };
var handleError = function(message, exception) { document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus("ERROR: "+message);throw exception;};

var PlayUEF = function() {
  "use strict";

  // Get URL parameters
  var url = new URL(location.href);
  var BAUD  = url.searchParams.get("BAUD") || 1200;
  var FILE  = url.searchParams.get("FILE") || "tapes/Arcadians_E.zip"; // Loads Electron Arcadians locally by default
  var TURBO = url.searchParams.get("TURBO") || 0;
  var PHASE = url.searchParams.get("PHASE") || 180;
  var LOCAL = url.searchParams.get("LOCAL") || false;
  var CARRIER = url.searchParams.get("CARRIER") || 2; // Carrier tone length factor * 2
  var STOPBIT = url.searchParams.get("STOPBIT") || 4; // Stop bit cycles * 2
  var SAMPLE_RATE  = 44100;
  var WIDTH = window.innerWidth;
  var TEXTFILE = "";
  var UEFNAME = "";

  var RAW = url.searchParams.get("RAW") || false;
  var LOAD = url.searchParams.get("LOAD") || 0x0e00;
  var EXEC = url.searchParams.get("EXEC") || 0x0e00;
  var TITLE = url.searchParams.get("TITLE") || "PROGRAM";

  if (RAW) {
    FILE = TITLE;
  }


  PHASE = PHASE*(Math.PI/180);
  CARRIER=CARRIER/2;
  if (TURBO==1) {STOPBIT=1; CARRIER=0;}

  // Downlooad UEF
  function download(FILE, cb){
    updateStatus("DOWNLOADING<BR>"+FILE.split("/").pop());
    var xhttp = new XMLHttpRequest();
    xhttp.open("GET", FILE, true);
    xhttp.responseType = "arraybuffer";
    xhttp.onerror = function (err) {return null};
    xhttp.onload = function (e) {
      if (xhttp.status == 200) {
        cb(handleZip({file: new Uint8Array(xhttp.response), name: FILE}));
      }
      else{handleError(xhttp.status+"<br>"+FILE,0);}
    }
    xhttp.send(null);
  }

  // Get local UEF
  function loadLocalUEF(cb){
    updateStatus("<input type='file' id='files' class='btn'>");
    function fileLoadEvent(event){
      var file = event.target.files[0];
      updateStatus("LOADING<BR>"+file.name);
      var reader = new FileReader();
      reader.addEventListener("load", fileRead, false);
      function fileRead(event){
        cb(handleZip({file: new Uint8Array(event.target.result), name: file.name}));}
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
      var isValidUEF = function() {return ((String.fromCharCode.apply(null,filedata.slice(0, 9)) == "UEF File!"));}
      // check if the UEF inside the zip is in fact itself zipped
      if (isValidUEF()==false) {
        try{
          var gunzip = new Zlib.Gunzip(filedata);
          filedata = gunzip.decompress();
        }
        catch(e) {handleError("Invalid UEF/ZIP file<BR>",e);}
      }
      if (isValidUEF()==false) {handleError("Invalid UEF file",0);}
      return {file:filedata, name:filename};
    }


    /*
    // Get local UEF
    function loadLocalRaw(cb){
    updateStatus("<p>Create UEF from data</p><input class='btn' type='file' id='files'>");
    function fileLoadEvent(event){
    document.getElementById('console').innerHTML = '<canvas id="screendata></canvas>';
    var file = event.target.files[0];
    updateStatus("LOADING<BR>"+file.name);
    var reader = new FileReader();
    reader.addEventListener("load", fileRead, false);
    function fileRead(event){
    var data = event.target.result;
    var uef = data2uef(new Uint8Array (data), LOAD, EXEC);
    document.getElementById("footer").innerHTML = "<button id='downloadUEF' class='btn'>Download UEF</button>";
    const blobT = new Blob([uef],{ type: 'text/plain' });

    document.getElementById("footer").addEventListener('click',function ()
    {saveAs(blobT, TITLE+'.uef')});

    cb({file: uef, name: file.name});}

    reader.readAsArrayBuffer(file);
  }
  document.addEventListener("change", fileLoadEvent, false);
}
*/




// Get local UEF
function loadLocalRaw(cb){
  updateStatus("<p>Create UEF from data</p><input class='btn' type='file' id='files'>");
  document.getElementById('console').innerHTML = '<canvas id="screendata"></canvas>';
  function fileLoadEvent(event){

    var file = event.target.files[0];
    updateStatus("LOADING<BR>"+file.name);
    var reader = new FileReader();
    reader.addEventListener("load", fileRead, false);
    function fileRead(event){
      var data = [];
      var img = new Image();
      var canvas = document.getElementById("screendata");
      var ctx = canvas.getContext("2d");
      var height = 256; // BBC Micro Mode 0
      var width = 640;

      img.onload = function(){

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img,0,0,width,height);
        var myImageData = ctx.createImageData(width, height);
        // This needs some optimization
        updateStatus("CONVERTING");
        for (var y = 0; y<height; y+=8){
           document.getElementById("status").innerHTML="<p>CONVERTING "+(y/2.56)+"%<p>";
          for (var x = 0; x<width; x+=8){
            for (var yy = 0; yy<8; yy+=1){
              var pixelSource = ctx.getImageData(x, y+yy, 8, 1).data;
              //console.log(pixelSource);
              var pixelDest = 0;
              for (var p = 0; p<8; p++){
                if (pixelSource[p*4] > 127) {pixelDest = pixelDest | (1<<(7-p));}
              }
              data.push(pixelDest);
            }
          }
        }
        var uef = data2uef(new Uint8Array (data), LOAD, EXEC, TITLE);
        document.getElementById("footer").innerHTML = "<button id='downloadUEF' class='btn'>Download UEF</button>";
        const blobT = new Blob([uef],{ type: 'text/plain' });

        document.getElementById("footer").addEventListener('click',function ()
        {saveAs(blobT, TITLE+'.uef')});

        cb({file: uef, name: file.name})
      }
      img.src = event.target.result;


      ;}

      reader.readAsDataURL(file);
    }
    document.addEventListener("change", fileLoadEvent, false);
  }





  /*   document.getElementById('container').innerHTML = '<canvas id="cassette" height="260px" width="400px"></canvas>';
  var wavname = UEFNAME.split('.').shift();
  if (BAUD!=1200) {wavname+=BAUD};
  const blob = new Blob([wavfile], { type: 'audio/wav' });
  const url = window.URL.createObjectURL(blob);

  // Connect WAV to the audio player
  const audio = document.getElementById('audio');
  const source = document.getElementById('source');
  // Insert blob object URL into audio element & play.
  source.src = url;
  audio.load();

  // Swap loader for cassette in web page
  document.getElementById('container').innerHTML = '<canvas id="cassette" height="260px" width="400px"></canvas>';

  // Set up listener for WAV save on clicking casssette
  document.getElementById("cassette").addEventListener('click',function ()
  {saveAs(blob, wavname+'.wav')});
  */

  function startPlayer(uef){
    document.getElementById("status").innerHTML = "CONVERTING";
    var converted = uef2wave(uef.file, BAUD, SAMPLE_RATE, STOPBIT, PHASE, CARRIER);
    player(converted.wav, converted.uef, uef.name, BAUD, SAMPLE_RATE, TEXTFILE);
  }

  // Kick-off player with local or downloaded UEF file
  if (LOCAL=="true") {loadLocalUEF(startPlayer);} else {
    if (RAW=="true") {loadLocalRaw(startPlayer);} else {
      download(FILE,startPlayer);
    }
  }
}

window.onload=function(){
  PlayUEF();
};
