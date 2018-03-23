# PlayUEF
PlayUEF is a javascript player for UEF format Acorn Electron and BBC Micro cassette games. Conversion from UEF to 44.1KHz WAV is done in the web browser.

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

* `BAUD=<int>` Change base frequency. Defaults to Acorn standard 1200 Hz.
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


* `TURBO=1` Equivalent to CARRIER=0&STOPBIT=1


Faster Loading
--------------
Converting to 44.1KHz digital audio means loading can be faster than tape (due to hardware limits on the Electron's cassette interface only about 35% faster so far).

Loading times for Acorn Electron Arcadians (YMMV)

* 245 secs - 1200 baud default
* 190 secs - &TURBO=1
* 166 secs - &TURBO=1&BAUD=1400
* 150 secs - &TURBO=1&BAUD=1550&PHASE=220

Supported UEF chunks
--------------------
See the [UEF specification draft](/docs/UEFspecification.html) for more details.

Fully implemented UEF chunks
* `0x0100` Implicit start/stop bit tape data block
* `0x0110` Carrier tone
* `0x1111` Carrier tone with dummy byte at byte
* `0x0112` Integer gap
* `0x0104` defined data block (for Acorn Atom and BBC titles like AndroidAttack & Joust)

Approximated

* `0x0116` - floating point gap is approximated to interger gap
* `0x0114` - security cycles replaced with carrier tone

Ignored
* `0x0113` Change of base frequency
* `0x0115` Phase change

These seem to usually reflect mechanical variance of original cassette player behavior. As we just want to load game data rather than recreate archival quality audio, these are ignored.

To-do list
* Test on Acorn Atom

Running locally
---------------

For development purposes you can up a local web server as below and navigate to http://localhost:8000/PlayUEF.html in your web browser

    $ cd PlayUEF
    $ python -m SimpleHTTPServer 8000
    Serving HTTP on 0.0.0.0 port 8000 ...

http://localhost:8000/test.html generates links to the STH UEF archive.

Thanks
------
Thanks to Thomas Harte for the UEF spec and Wouter Hobers for uef2wave.py, BigEd, Commie_User, DavidB, Vanekp of the [stardot forum](http://stardot.org.uk) for suggestions and Matt Godbolt for the awesome [JSbeeb](https://github.com/mattgodbolt/jsbeeb). Not forgetting Arcadian and the archive of over 1000 games at the [STH archive](http://www.stairwaytohell.com/electron/uefarchive/) which make this project come to life.
