import React, { useEffect, useRef, useState } from 'react';
import ThreeComponent from './ThreeComponent';

const Player = ({ src, uef, baud, sampleRate }) => {
  const audioRef = useRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [currentHeader, setCurrentHeader] = useState("");
  const [totalLength, setTotalLength] = useState(0);
  const [playerState, setPlayerState] = useState("");
  const samplesPerCycle = sampleRate / baud;



  useEffect(() => {
    const audio = audioRef.current;

    const checkPlayerState = () => {
      if (audio.paused && currentTime > 0 && currentTime < totalLength) {
        setPlayerState('paused');
      } else if (audio.paused && currentTime === 0) {
        setPlayerState('stopped');
      } else if (!audio.paused) {
        setPlayerState('playing');
      }
      console.log(playerState)
    };

    const updateTime = () => {
    setCurrentTime(audio.currentTime);
    checkPlayerState();

    const relevantText = chunkAtTime(audio.currentTime, uef, baud, sampleRate);// uef.find(({timestamp}) => Math.floor(audio.currentTime) === Math.floor(timestamp));
    if(relevantText){
      setCurrentText(relevantText.str);
      setCurrentHeader(relevantText.header);
    }
  };

  function binarySearch(array, key) {

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

  function chunkAtTime(currentTime, chunks, baud, sampleRate){
  var bytesPerSample = (baud/sampleRate)/8; // # tape bytes transmitted per WAV sample, assuming 10 bit packets

    var samplepos = currentTime * sampleRate;
    let thischunk = binarySearch(chunks,samplepos);

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

    audio.addEventListener('timeupdate', updateTime);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
    };
  }, []);

  return (

    <>
    <ThreeComponent
      currentTime={currentTime}
      totalLength={totalLength}
      playerState={playerState}
    />
      <audio ref={audioRef} src={src} controls style={{ width: '100%', height: '64px' }}/>
      <h2>{currentHeader}</h2>
      <pre>{currentText}</pre>

    </>
  );
};

export default Player;
