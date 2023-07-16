
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useParams,  useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import uef2wave from './uef2wave';
import { handleZip } from './utils.js';
import Player from './Player';

function PlayUEFwrap() {

  const [wavFile, setWavFile] = useState('');
  const [UEF, setUEF] = useState('');
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const SAMPLE_RATE = urlParams.get("SAMPLE_RATE") || 44100
  const LOW       = urlParams.get("LOW") || 1200;
  const HIGH      = urlParams.get("HIGH") || LOW * 2;
  const BAUD      = urlParams.get("BAUD") || Math.floor((parseInt(LOW) + parseInt(HIGH)) / 2 / 2);
  const TURBO     = urlParams.get("TURBO") || 0;
  const PHASE     = (urlParams.get("PHASE") || 180)*(Math.PI/180);
  const LOCAL     = urlParams.get("LOCAL") || false;
  const CARRIER   = (urlParams.get("CARRIER") || 2)/2;
  const STOPBIT   = urlParams.get("STOPBIT") || 4;
  const DATA      = urlParams.get("DATA") || false;
  //    if (TURBO==1) {STOPBIT=1; CARRIER=0; LOW = 1280}

  useEffect(() => {
    const FILE      = urlParams.get("FILE") || require('./tapes/Arcadians_E.zip');
    if (FILE) {
      downloadUEF(FILE);
    }
  }, []);

  const downloadUEF = async (FILE) => {
    try {
      // Use appropriate method (e.g., fetch) to download the UEF file
      const fileData = await fetch(FILE).then((response) => response.arrayBuffer());

      let uef = await handleZip(fileData, FILE);

      // Call the `uef2wave` function to convert UEF to WAV
      const output = await uef2wave(Array.from(uef.data), LOW, SAMPLE_RATE, STOPBIT, PHASE, CARRIER, HIGH);
      const blob = new Blob([output.wav], { type: 'audio/wav' });
      const url = window.URL.createObjectURL(blob);
      setWavFile(url);
      setUEF(output.uef);

    } catch (error) {
      console.error('Error converting UEF to WAV:', error);
    }
  };

  return (
    <div>
    {wavFile && <Player src={wavFile} uef={UEF} baud={BAUD} sampleRate={SAMPLE_RATE}/>}
    </div>
  );
}
export default PlayUEFwrap;
