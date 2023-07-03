
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useParams, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import main from './main.js';

function PlayUEFwrap() {
  const { search } = useLocation();
  const urlParams = new URLSearchParams(search);
  const LOW = urlParams.get("LOW");
  const FILE = urlParams.get("FILE");
  const TURBO = urlParams.get("TURBO");
  const PHASE = urlParams.get("PHASE");
  const LOCAL = urlParams.get("LOCAL");
  const CARRIER = urlParams.get("CARRIER");
  const STOPBIT = urlParams.get("STOPBIT");
  const HIGH = urlParams.get("HIGH");
  const DATA = urlParams.get("DATA");

  // Rest of your component code...

  // Call the main function with the URL parameters
  useEffect(() => {
    main(LOW, FILE, TURBO, PHASE, LOCAL, CARRIER, STOPBIT, HIGH, DATA);
  }, [LOW, FILE, TURBO, PHASE, LOCAL, CARRIER, STOPBIT, HIGH, DATA]);



  return (
    <div>
      <div id="container">
        <div className="loader" id="spinner"></div>
        <div id="status"></div>
      </div>
      <audio controls id="audio" autoPlay={false}>
        Your browser does not support the &lt;audio&gt; tag.
        <source id="source" src="" type="audio/wav" />
      </audio>
      <div id="header"></div>
      <div id="console"></div>
      <div id="footer">
        <span
          className="btn"
          id="more"
          onClick={() => window.location.href = 'http://www.8bitkick.cc/playuef.html'}
        >
          More cassettes
        </span>
      </div>
    </div>
  );
}

export default PlayUEFwrap;
