
import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect } from "react";
//import "./PlayUEF.css";

function PlayUEFwrap() {
  useEffect(() => {
    const scripts = [
      "lib/jsunzip.js",
      "lib/jszip.min.js",
      "lib/filesave.min.js",
      "lib/utils.js",
      "uef2wave.js",
      "cassette.js",
      "player.js",
      "main.js",
    ];

    const scriptElements = scripts.map((src) => {
      const script = document.createElement("script");
      script.src = "./"+src;
      script.async = true;
      document.body.appendChild(script);
      return script;
    });

    return () => {
      scriptElements.forEach((scriptElement) => {
        document.body.removeChild(scriptElement);
      });
    };
  }, []);

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
