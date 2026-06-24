# PlayUEF
PlayUEF is a javascript player for UEF format Acorn Electron and BBC Micro cassette games. Conversion from UEF to 48KHz WAV is done in the web browser.

Just connect your computer's cassette port to the headphone socket on a laptop or smartphone and you're ready to load games!


Usage
-----

PlayUEF is ready to use immediately, for free, linked to over 1000 games, at http://playuef.8bitkick.cc



![Cassette player](/docs/tape.gif?raw=true)





Local UEF conversion & WAV download
-----------------------------------
Press play on the media player in the web page to play the cassette audio from the browser.

Clicking the cassette player causes PlayUEF to download the converted audio as a WAV.

Adding the `LOCAL=true` parameter to the URL causes PlayUEF to request user to select a file to convert on their local machine.

Browser compatibility
---------------------

Tested on Chrome, Safari, Firefox and Microsoft Edge browser

Known issues on some versions of IE and Android browsers (e.g. UC browser), to be fixed...


URL parameters
--------------

* No parameters defaults to loading Acorn Electron Arcadians.

* `FILE=<string>` URL to UEF file or zip containing UEF

* `LOCAL=true` Prompt user to select local file

* `BAUD=<int>` Change base frequency (not really baud...). Defaults to Acorn standard 1200 Hz.
  * e.g. `BAUD=1400` works comfortably on my Acorn Electron and BBC Micro issue 7

* `PHASE=<int>` Change sine phase. Defaults to Acorn standard 180 degrees.

* `CARRIER=<int>` Carrier tone length factor * 2
  * `CARRIER=0` Minimal inter-block carrier tones, works on Acorn Electron
  * `CARRIER=1` Works on BBC Micro issue 7
  * `CARRIER=2` Default

* `STOPBIT=<int>` Equal to number of cycles per stop bit * 2. Effects 0x0100 chunks only.
  * `STOPBIT=1` Works on Acorn Electron Issue 2 & 4
  * `STOPBIT=3` Works on BBC Micro Issue 7
  * `STOPBIT=4` Works on BBC Micro Issue 3. (Default)

* `ONEBIT=<int>` Frequency of 1 bits = base frequency * ONEBIT / 100. Effects 0x0100 chunks only.
  * `ONEBIT=100` 100% = 2400Hz default at 1200 base frequency
  * `ONEBIT=200` 200% = 4800Hz at 1200 base frequency

* `TURBO=1` Equivalent to CARRIER=0&STOPBIT=1


Faster Loading
--------------
Converting to digital audio means loading can be faster than tape (due to hardware limits on the Electron's cassette interface only about 35% faster so far).

Loading times for Acorn Electron Arcadians (YMMV)

* 245 secs - 1200 baud default
* 190 secs - &TURBO=1
* 166 secs - &TURBO=1&BAUD=1400
* 150 secs - &TURBO=1&BAUD=1550&PHASE=220

Supported UEF chunks
--------------------
See the [UEF specification draft](/docs/UEFspecification.html) for more details.

PlayUEF reproduces every chunk MakeUEF V2.4 emits for BBC/Electron cassettes:

* `0x0000` Origin / information (metadata)
* `0x0100` Implicit start/stop bit tape data block (8N1)
* `0x0104` Defined-format data block — any bit count, parity (`N`/`E`/`O`) and
  stop bits, e.g. 8E1 / 8O1 (Firebird titles like AndroidAttack & Joust)
* `0x0110` Carrier tone
* `0x0111` Carrier tone with dummy byte
* `0x0112` Integer gap
* `0x0113` Change of base frequency — the tone set is rebuilt per section, so
  PlayUEF tracks the original tape's per-file baud rather than a fixed 1200 Hz
* `0x0114` Security cycles — rendered as the recorded high/low frequency wave
  pattern (not substituted with carrier tone)
* `0x0115` Phase change
* `0x0116` Floating-point gap — exact `round(seconds × rate)` silence

Honouring `0x0113`/`0x0115` (per-section baud and phase) pulled converted
durations from ~7% off the original tape to within ~2.5%.

To-do list
* 300-baud format (Acorn Atom) — currently only the 1200-baud scheme is supported

Running locally
---------------

For development purposes you can up a local web server as below and navigate to http://localhost:8000/PlayUEF.html in your web browser

    $ cd PlayUEF
    $ python -m SimpleHTTPServer 8000
    Serving HTTP on 0.0.0.0 port 8000 ...

http://localhost:8000/test.html generates links to the STH UEF archive.

Testing
-------

The conversion code is covered by a Node test suite that validates output against
real-tape **CSW** captures held under `test/data/`:

    $ npm test

* **csw_test.js** — round-trip against the original cassette. Both the real-tape
  CSW and the PlayUEF-generated WAV are decoded down to Acorn Cassette Filing
  System blocks; every block recoverable from the tape with a valid CRC must be
  reproduced byte-for-byte. A duration guard (5%) catches timing regressions.
* **encode_test.js** — decodes every data block back out of the generated WAV
  using its own serial format, covering 8N1 and all parity formats (8E1/8O1/…) —
  ~3270 blocks across 19 tapes.
* **test_carrier.js** — duration + pinned output-hash smoke test.

See [test/README.md](/test/README.md) for details.

Thanks
------
Thanks to Thomas Harte for the UEF spec and Wouter Hobers for uef2wave.py, BigEd, Commie_User, DavidB, Vanekp of the [stardot forum](http://stardot.org.uk) for suggestions and Matt Godbolt for the awesome [JSbeeb](https://github.com/mattgodbolt/jsbeeb). Thanks to Chris Evans for the idea off ONEBIT. Not forgetting Arcadian and the archive of over 1000 games at the [STH archive](http://www.stairwaytohell.com/electron/uefarchive/) which make this project come to life.
