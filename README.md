# PlayUEF
PlayUEF is a javascript player for UEF format Acorn Electron and BBC Micro cassette games. Conversion from UEF to 44.1KHz WAV is done in the web browser.

Just connect your computer's cassette port to the headphone socket on a laptop or smartphone and you're ready to load games!

You can try a demo version of it, connected to over 1000 games in the STH archive at http://www.8bitkick.cc/playuef.html


![Cassette player](/docs/tape.gif?raw=true)

Running locally
---------------

Set up a local web server as below and navigate to http://localhost:8000/PlayUEF.html in your web browser

    $ cd PlayUEF
    $ python -m SimpleHTTPServer 8000
    Serving HTTP on 0.0.0.0 port 8000 ...

For testing purposes http://localhost:8000/test.html fetches links to the STH UEF archive.

URL parameters
--------------

* No parameters defaults to loading Electron Arcadians in PlayUEF/tapes

* `FILE=<string>` URL to UEF file or zip containing UEF

* `LOCAL=true` Prompt user to select local file

* `BAUD=<int>` Change base frequency. Defaults to Acorn standard 1200 Hz.

* `PHASE=<int>` Change sine phase. Defaults to Acorn standard 180 degrees.

* `TURBO=1` Reduce tape load time by minimizing inter-block carrier tones and reducing stop bit to 1/2 cycle.

Need for speed
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

Approximated

* `0x0116` - floating point gap is approximated to nearest 2 cycles

Ignored
* `0x0113` Change of base frequency
* `0x0115` Phase change

These seem to usually reflect mechanical variance of original cassette player behavior. As we just want to load game data rather than recreate archival quality audio, these are ignored.

To-do list
* `0x0104` defined data block (for Acorn Atom and BBC titles like AndroidAttack & Joust)
* `0x0114` security cycles

Thanks
------
Thanks for Thomas Harte for the original UEF spec, Wouter Hobers for the python uef2wave which this project is a continuation of, DavidB, Vanekp, BigEd of the [stardot forum](http://stardot.org.uk) for suggestions and Matt Godbolt for setting the standard with the awesome [JSbeeb](https://github.com/mattgodbolt/jsbeeb). Not forgetting Arcadian and the archive of over 1000 games at the [STH archive](http://www.stairwaytohell.com/electron/uefarchive/) which make this project come to life.
