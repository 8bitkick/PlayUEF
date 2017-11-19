// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro


// Cassette & console interface
// -----------------------------

function player(wavfile, chunks, UEFNAME, BAUD, SAMPLE_RATE, TEXTFILE) {
  var warning = "";
  var player = document.getElementById('audio');
  var fps = 30;
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

    // set up animation of cassette
    function draw() {
      setTimeout(function() {
        requestAnimationFrame(draw);
        // Get position of audio player
        var duration = player.duration;
        var currentTime = player.currentTime;
        var bytesPerSample = (BAUD/SAMPLE_RATE)/10; // # tape bytes transmitted per WAV sample, assuming 10 bit packets

        // Render cassette frame
        cassette(duration,currentTime,UEFNAME,BAUD,VERSION);

        // Console animation

        // If playing
        if (currentTime!=0){

          // convert audio time to sample position and get associated UEF chunk
          var samplepos = currentTime * SAMPLE_RATE;
          thischunk = binarySearch(chunks,samplepos);

          // For UEF data chunks display contents in the console in 'real time'
          switch (chunks[thischunk].type){
            case "dataBlock":
            document.getElementById("console").style.color = "#00aa00";
            var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
            var str = chunks[thischunk].datastr.slice(delta & 0xfe00,delta);
            document.getElementById("console").innerHTML  = str+"|";
            document.getElementById("header").innerHTML = chunks[thischunk].header;
            break;

            case "definedDataBlock":
            document.getElementById("console").style.color = "#00aaaa";
            var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
            var str = chunks[thischunk].datastr.slice(delta & 0xfe00,delta);
            document.getElementById("console").innerHTML  = str+"|";
            document.getElementById("header").innerHTML = chunks[thischunk].header;
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

    // Set up audio player
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
    {
      if (confirm("Want to download WAV of "+wavname+"?")) {
        saveAs(blob, wavname+'.wav')
      } else {
        // Do nothing
      }
    });

    // Start animations
    resize();
    draw();
  }
