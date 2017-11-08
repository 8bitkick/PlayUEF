// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//

var VERSION = "1.0 beta 2";

updateStatus = function(status) { document.getElementById("status").innerHTML = status; };
handleError = function(error) { document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus(error);throw new Error();};

PlayUEF = function() {
  "use strict";

  var URL = window.location.href;

  // Get parameterts and set defaults
  function getParameterByName(name) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    var results = regex.exec(URL);
    if (!results) {return null;}
    if (!results[2]) {return "";}
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  };

  var BAUD = getParameterByName("BAUD") || 1200;
  var FILE= getParameterByName("FILE") || "tapes/Arcadians_E.zip"; // Loads Electron Arcadians locally by default
  var TURBO = getParameterByName("TURBO") || 0;
  var PHASE = getParameterByName("PHASE") || 180;
  var LOCAL = getParameterByName("LOCAL") || "false";
  var CARRIER = getParameterByName("CARRIER") || 1; // Carrier tone length factor
  var STOPBIT = getParameterByName("STOPBIT") || 4; // Stop bit cycles / 2
  var PHASE = PHASE*(Math.PI/180);

  if (TURBO==1) {STOPBIT=1; CARRIER=0;};

  var SAMPLE_RATE  = 44100;
  var CONSOLE = document.getElementById('console');
  var WIDTH = window.innerWidth;
  var TITLE;
  var TEXTFILE = "";
  var WARNINGLOG ="";
  var UEFNAME = "";


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
        try {
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
        }
        catch(err) {handleError("INVALID ZIP FILE");}
      } else {UEFfiledata = filedata;};

      convertUEF(UEFfiledata);
    };

    // Convert UEF to WAV and set up player
    function convertUEF(UEFfiledata) {
      document.getElementById("status").innerHTML = "CONVERTING";
      //try {
      // Do the actual conversion
      var UEFobject = new uef2wave(UEFfiledata, BAUD, SAMPLE_RATE, STOPBIT, PHASE, CARRIER);
      var wavfile = UEFobject.convert();

      var wavname = UEFNAME.split('.').shift().toLowerCase();
      if (BAUD!=1200) {wavname+=BAUD};
      const blob = new Blob([wavfile], { type: 'audio/wav' });
      const url = window.URL.createObjectURL(blob);

      // Swap loader for cassette in web page
      document.getElementById('container').innerHTML = '<canvas id="cassette" height="260px" width="400px"></canvas>';

      // Set up listener for WAV save on clicking casssette
      document.getElementById("cassette").addEventListener('click',function ()
      {saveAs(blob, wavname+'.wav')});

      // Connect WAV to the audio player
      const audio = document.getElementById('audio');
      const source = document.getElementById('source');
      // Insert blob object URL into audio element & play.
      source.src = url;
      audio.load();
      //audio.play(); auto playing not possible in safari anyhow
      //}
      //catch(err) {handleError("INVALID UEF<BR>"+UEFNAME);}

      animationInit(UEFobject);
    }


    // Initialize animation
    // --------------------
    function animationInit(UEFobject) {
      var chunks = UEFobject.uefChunks;
      var warning = "";
      if (UEFobject.fails != 0) {warning = "WARNING: "+UEFobject.fails+" unsupported UEF chunks! See JS console<br>";};
      var player = document.getElementById('audio');
      var fps = 30; // polling audio player status at 30fps... better to catch event
      var thischunk = 0;

      // resize cassette on browser resize
      function resize(){
        var c  = document.getElementById("cassette");
        var newwidth = window.innerWidth-10;
        if (newwidth>480){newwidth=480};
        c.width=newwidth;
        c.height=260*newwidth/400;
        var ctx = c.getContext("2d");
        var scalefactor = newwidth / 400;
        ctx.scale(scalefactor,scalefactor);}
        window.addEventListener('resize', function(event){
          resize();
        });

        function binarySearch(array, key) {
          var samplesPerCycle = SAMPLE_RATE / BAUD;
          var lo = 0, hi = array.length - 1, mid, element;
          while (lo <= hi) {
            mid = ((lo + hi) >> 1);
            element = array[mid];
            if ((element.pos+(element.cycles*samplesPerCycle)) < key) {
              lo = mid + 1;
            } else if (element.pos > key) {
              hi = mid - 1;
            } else {
              return mid;
            }
          }
          return -1;
        }

        // set up animation of cassette
        function draw() {
          setTimeout(function() {
            requestAnimationFrame(draw);
            // Get position of audio player
            var duration = player.duration;
            var currentTime = player.currentTime;
            // Render cassette frame
            Cassette(duration,currentTime,UEFNAME,BAUD,VERSION);

            // Console animation

            // If playing
            if (currentTime!=0){
              
              // convert audio time to sample position and get associated UEF chunk
              var samplepos = currentTime * SAMPLE_RATE;
              thischunk = binarySearch(chunks,samplepos);

              // For UEF data chunks display contents in the console in 'real time'
              switch (chunks[thischunk].op){

                case "writeData":
                var delta = Math.floor((samplepos-chunks[thischunk].pos)*(BAUD/SAMPLE_RATE)/10);
                var str = String.fromCharCode.apply(null,chunks[thischunk].data.slice(0,delta));
                document.getElementById("console").innerHTML  = str+"|";
                document.getElementById("header").innerHTML = chunks[thischunk].header;
                document.getElementById("console").style.color = "#00aa00";
                break;

                // Clear console for integerGap
                case "integerGap":
                document.getElementById("console").innerHTML ="";
                document.getElementById("header").innerHTML = "";
                break;

                // Bright green for carrierTone, it just looks cooler
                case "carrierTone":
                document.getElementById("console").style.color = "#00ff22";
                break;
              }

              // Otherwise stick in text file and warnings if you're at the beginning
            } else {document.getElementById("console").innerHTML  = TEXTFILE;document.getElementById("header").innerHTML = warning;}
          }, 1000 / fps);
        }
        resize();
        draw();
      }
    }

    window.onload=function(){
      PlayUEF();
    };
