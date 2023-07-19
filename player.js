import React, { useEffect, useRef, useState } from 'react';
import ThreeComponent from './ThreeComponent';
import { chunkAtTime } from './utils.js';

const Player = ({ src, uef, baud, sampleRate }) => {
  const audioRef = useRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [currentHeader, setCurrentHeader] = useState(".");
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

    const stringToHexDump = (str) => {
        let hexDump = "";
        let lineLength = 0;
        let charSnippet = "";
        let hexLine = "";

        for (let i = 0; i < str.length; i++) {
            hexLine += (0xff & str.charCodeAt(i)).toString(16).padStart(2, '0').toUpperCase() + " ";
            charSnippet += str[i];

            lineLength++;
            if (lineLength === 16 || i === str.length - 1) {
                // Pad the hex line if it's less than 32 characters
                while (lineLength < 16) {
                    hexLine += "   "; // 2 spaces for the hex and 1 space as separator
                    charSnippet += " ";
                    lineLength++;
                }
                hexDump += hexLine + "  " + charSnippet + '\n';
                lineLength = 0;
                charSnippet = "";
                hexLine = "";
            }
        }
        return hexDump;
    };


    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      checkPlayerState();
     let relevantText = chunkAtTime(audio.currentTime, uef, baud, sampleRate);
    console.log(relevantText)
      if(relevantText){
        setCurrentText(stringToHexDump(relevantText.str));
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
