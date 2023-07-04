
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useParams,  useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import uef2wave from './uef2wave';
import { handleZip } from './utils.js';

function PlayUEFwrap() {

  const [wavFile, setWavFile] = useState('');
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);

  useEffect(() => {
    const FILE      = urlParams.get("FILE") || require('./tapes/Arcadians_E.zip');
    if (FILE) {
      downloadUEF(FILE);
    }
    }, []);


    const downloadUEF = async (FILE) => {
      try {
        const SAMPLE_RATE = urlParams.get("SAMPLE_RATE") || 48000
        const LOW       = urlParams.get("LOW") || 1200;
        const TURBO     = urlParams.get("TURBO") || 0;
        const PHASE     = (urlParams.get("PHASE") || 180)*(Math.PI/180);
        const LOCAL     = urlParams.get("LOCAL") || false;
        const CARRIER   = (urlParams.get("CARRIER") || 2)/2;
        const STOPBIT   = urlParams.get("STOPBIT") || 4;
        const HIGH      = urlParams.get("HIGH") || LOW * 2;
        const DATA      = urlParams.get("DATA") || false;
        const BAUD      = urlParams.get("BAUD") || Math.floor((parseInt(LOW) + parseInt(HIGH)) / 2 / 2);

        if (TURBO==1) {STOPBIT=1; CARRIER=0; LOW = 1280}
        // Use appropriate method (e.g., fetch) to download the UEF file
        const fileData = await fetch(FILE).then((response) => response.arrayBuffer());

        let uef = await handleZip(fileData, FILE);

        // Call the `uef2wave` function to convert UEF to WAV
        const output = await uef2wave(Array.from(uef.data), LOW, SAMPLE_RATE, STOPBIT, PHASE, CARRIER, HIGH);
        const blob = new Blob([output.wav], { type: 'audio/wav' });
        const url = window.URL.createObjectURL(blob);
setWavFile(url);

      } catch (error) {
        console.error('Error converting UEF to WAV:', error);
      }
    };

  return (
    <div>
      {wavFile && <audio src={wavFile} controls />}
    </div>
  );
}


// <div>
//  <AudioPlayer wavFile={audioFileUrl} />
// </div>
//   // Rest of your component code...
//
//   // Call the main function with the URL parameters
//   useEffect(() => {
//     main(LOW, FILE, TURBO, PHASE, LOCAL, CARRIER, STOPBIT, HIGH, DATA);
//   }, [LOW, FILE, TURBO, PHASE, LOCAL, CARRIER, STOPBIT, HIGH, DATA]);
//
//
//
//   return (
//     <div>
//       <div id="container">
//         <div className="loader" id="spinner"></div>
//         <div id="status"></div>
//       </div>
//       <audio controls id="audio" autoPlay={false}>
//         Your browser does not support the &lt;audio&gt; tag.
//         <source id="source" src="" type="audio/wav" />
//       </audio>
//       <div id="header"></div>
//       <div id="console"></div>
//       <div id="footer">
//         <span
//           className="btn"
//           id="more"
//           onClick={() => window.location.href = 'http://www.8bitkick.cc/playuef.html'}
//         >
//           More cassettes
//         </span>
//       </div>
//     </div>
//   );
// }

export default PlayUEFwrap;
