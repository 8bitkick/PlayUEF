import React, { useEffect, useRef, useState } from 'react';

const Player = ({ src, uef }) => {
  const audioRef = useRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    const audio = audioRef.current;

    const updateTime = () => {
    setCurrentTime(audio.currentTime);

    const relevantText = uef.find(({timestamp}) => Math.floor(audio.currentTime) === Math.floor(timestamp));
    if(relevantText){
      setCurrentText(relevantText.text);
    }
  };


//   function chunkAtTime(currentTime, uef){
//   var duration = player.duration;
//   var currentTime = player.currentTime;
//   var bytesPerSample = (BAUD/SAMPLE_RATE)/10; // # tape bytes transmitted per WAV sample, assuming 10 bit packets
//
//     var samplepos = currentTime * SAMPLE_RATE;
//     thischunk = binarySearch(chunks,samplepos);
//
//     // For UEF data chunks display contents in the console in 'real time'
//     switch (chunks[thischunk].type){
//       case "dataBlock":
//       var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
//       var str = String.fromCharCode.apply(null,chunks[thischunk].data.slice(delta & 0xfe00,delta));
//       return {'str': str, 'header': chunks[thischunk].header, 'color':  "#00aa00"}
//
//       case "definedDataBlock":
//       var delta = Math.floor((samplepos-chunks[thischunk].timestamp)*bytesPerSample); // how much data to display
//       var str = String.fromCharCode.apply(null,chunks[thischunk].data.slice(delta & 0xfe00,delta));
//       return {'str': str, 'header': chunks[thischunk].header, 'color':  "#00aaaa"}
//
//       // Clear console for integerGap
//       case "integerGap":
//       return {'str': "", 'header': "", 'color':  "#000000"}
//
//       // Bright green for carrierTone, it just looks cooler
//       case "carrierTone":
//       return {'str': "", 'header': "", 'color':  "#00ff22"}
//     }
// }

    audio.addEventListener('timeupdate', updateTime);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} src={src} controls style={{ width: '100%', height: '64px' }}/>
      <p>Current Time: {currentTime.toFixed(2)} seconds</p>
      <p>Relevant Text: {currentText}</p>
    </>
  );
};

export default Player;
