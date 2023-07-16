import React, { useEffect, useRef, useState } from 'react';
import ThreeComponent from './ThreeComponent';
import { chunkAtTime } from './utils.js';

const Player = ({ src, uef, baud, sampleRate }) => {
  const audioRef = useRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [currentHeader, setCurrentHeader] = useState("");
  const [totalLength, setTotalLength] = useState(0);
  const [playerState, setPlayerState] = useState("");

  const checkPlayerState = () => {
    if (audioRef.current.paused) {
      setPlayerState('paused');
    } else if (audioRef.current.paused && currentTime === 0) {
      setPlayerState('stopped');
    } else if (!audioRef.current.paused) {
      setPlayerState('playing');
    }
  };

  useEffect(() => {
    const audio = audioRef.current;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      checkPlayerState();
      const relevantText = chunkAtTime(audio.currentTime, uef, baud, sampleRate);
    console.log(relevantText)
      if(relevantText){
        setCurrentText(relevantText.str);
        setCurrentHeader(relevantText.header);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('pause', checkPlayerState);
    audio.addEventListener('ended', checkPlayerState);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('pause', checkPlayerState);
      audio.removeEventListener('ended', checkPlayerState);
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
      <h4>{currentHeader}</h4>
      <pre style={{ overflowWrap: 'break-word' ,whiteSpace: 'pre-wrap',width: '100%', height: '320px' }}>{currentText} </pre>
    </>
  );
};

export default Player;
