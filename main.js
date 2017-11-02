// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//


updateStatus = function(status) { document.getElementById("status").innerHTML = status; };
handleError = function(error) { document.getElementById("spinner").style.borderLeft = "1.1em solid #FF0000";updateStatus(error);throw new Error();};

PlayUEF = function() {

  // Get parameterts and set defaults
  function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  };

  var BAUD = getParameterByName('BAUD') || 1200;
  var FILE= getParameterByName('FILE') || "tapes/Arcadians_E.zip"; // Loads Electron Arcadians locally by default
  var TURBO = getParameterByName('TURBO') || 0;
  var PHASE = getParameterByName('PHASE') || 180;
  var LOCAL = getParameterByName('LOCAL') || "false";
  var PHASE = PHASE*(Math.PI/180);
  if (TURBO==1) {console.log('TURBO ON');};
  var SAMPLE_RATE  = 44100;
  var CONSOLE = document.getElementById('console');
  var WIDTH = window.innerWidth;
  var TITLE;
  var TEXTFILE = "";
  var WARNINGLOG ="";


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
        filedata = new Uint8Array(oReq.response);
        handleZip(filedata, FILE);}
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
            FILENAME = file.name;
            handleZip(filedata, FILENAME);
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
            for (i = 0, il = filenames.length; i < il; ++i) {
              console.log("Decompressing... ",filenames[i]);
              files[filenames[i]] = unzip.decompress(filenames[i]);
              extension = filenames[i].split('.').pop().toLowerCase();
              if (extension=="uef") {var fileToPlay = i;FILENAME = filenames[i]} // Only one Uef per zip handled for now
              if (extension=="txt") {TEXTFILE = String.fromCharCode.apply(null, files[filenames[i]]).replace(/\n/g, "<br />");};
              UEFfiledata = files[filenames[fileToPlay]];
            }
          }
          catch(err) {handleError("INVALID ZIP FILE");}
        } else {UEFfiledata = filedata;};

        convertUEF(UEFfiledata);
      };

      // Convert UEF to WAV and set up player
      function convertUEF(UEFfiledata) {
        document.getElementById("status").innerHTML = "CONVERTING";
        try {
          // Do the actual conversion
          var UEFobject = new uef2wave(UEFfiledata, BAUD, SAMPLE_RATE, TURBO, PHASE);
          var wavfile = UEFobject.convert();

          wavname = FILE.split('.').shift().toLowerCase();
          if (BAUD!=1200) {wavname+=BAUD};
          const blob = new Blob([wavfile], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);

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
        }
        catch(err) {handleError("INVALID UEF<BR>"+FILENAME);}

        animationInit(UEFobject);
      }


      // Initialize animation
      // --------------------
      function animationInit(UEFobject) {
        var chunks = UEFobject.uefChunks;
        var warning = UEFobject.warning;
        var player = document.getElementById('audio');
        var fps = 30; // polling audio player status at 30fps... better to catch event
        var thischunk = 0;

        // resize cassette on browser resize
        function resize(){
          var c	= document.getElementById("cassette");
          newwidth = window.innerWidth-10;
          if (newwidth>480){newwidth=480};
          c.width=newwidth;
          c.height=260*newwidth/400;
          var ctx = c.getContext("2d");
          var scalefactor = newwidth / 400;
          ctx.scale(scalefactor,scalefactor);}
          window.addEventListener('resize', function(event){
            resize();
          });

          // set up animation of cassette
          function draw() {
            setTimeout(function() {
              requestAnimationFrame(draw);
              // Get position of audio player
              var duration = player.duration;
              var currentTime = player.currentTime;
              // Render cassette frame
              Cassette(duration,currentTime,FILENAME, BAUD);
              // That took a little time
              var currentTime = player.currentTime;

              // If playing, convert audio time to sample position and get associated UEF chunk
              if (currentTime!=0){
                var samplepos = currentTime * 44100;
                for (i=chunks.length-1; i>0; i--)
                {if (chunks[i].pos < samplepos) {break;}}

                // For UEF data chunks display contents in the console in 'real time'
                thischunk = i;
                if (chunks[thischunk].op == "writeData") {
                  var delta = Math.floor((samplepos-chunks[i].pos)*(BAUD/441000));
                  var str = String.fromCharCode.apply(null,chunks[thischunk].data.slice(0,delta));
                  document.getElementById("console").innerHTML  = str+"|";
                  document.getElementById("header").innerHTML = chunks[thischunk].header;}

                // Clear console for integerGap
                if (chunks[thischunk].op == "integerGap") {
                  document.getElementById("console").innerHTML ="";
                  document.getElementById("header").innerHTML = "";}

                // Bright green for carrierTone, it just looks cooler
                if (chunks[thischunk].op == "carrierTone") {
                  document.getElementById("console").style.color = "#00ff22";
                } else {document.getElementById("console").style.color = "#00aa00";}

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
