// PlayUEF
// Copyright (c) 2018 8bitkick
//
// www.8bitkick.cc
//
// UEF encodes given file to acorn cassette format chunks (BBC / Electron)


function data2uef (fileData,loadAddress,executionAddress,title){
  "use strict";
  var filePos = 0;
  var uefData = [];
  var blockSize = 0x100;
  var fileData = Array.from(fileData);

  function addDouble(double){
    for (var i = 0 ; i < 4; i++) {
      var byte = double & 0xFF;
      uefData.push(byte);
      double = double >>> 8;
    }
  }

  function addWord(word){
    uefData.push(word & 0xFF);
    uefData.push(word >>> 8);
  }

  function addData(data){
    var data = data;
    var byte;
    while (data.length>0) {
      byte = data.shift();
      uefData.push(byte);
    }
  }

  // CRC16 XMODEM - Ref. BBC Micro user guide chapter 35
  function crc16(data){
    var hl = 0x0000;
    for (var i=0; i<data.length; i++){
      var c = data[i];
      hl = ((c<<8) ^ (hl & 0xff00)) | (hl & 0xFF);
      for (var x = 0; x<8; x++) {
        var t = 0
        if ((hl & 0x8000) == 0x8000) {
          hl = hl ^ 0x0810;
          t = 1;
        }
        hl = ((hl*2)+t) & 0xffff;
      }
    }
    return ((hl >>> 8) | ((hl & 0xff) <<8))
  }

  function addChunk(id, data) {
    // UEF chunk header
    addWord(id);
    addDouble(data.length);
    // data
    addData(data);
  }

  function charArray(line){
    var cc = [];
    for(var i = 0; i < line.length; ++i){
      cc.push(line.charCodeAt(i));}
      return cc;
    }

    // UEF identifier
    addData (charArray("UEF File!"));
    addData ([0,0,0]);
    // Info
    addChunk (0x0000, charArray("PlayUEF make v0.1"+String.fromCharCode(0)));
    // Carrier tone
    addChunk (0x0110, [0x00,0x04]);

    // Data blocks
    var block = 0;
    var flag = 0;

    while (filePos < fileData.length) {
      var chunkLength = fileData.length - filePos;
      if (chunkLength > blockSize) {chunkLength=blockSize;} else {flag = 128;};

      var dataC = fileData.slice(filePos,filePos+chunkLength);
      var crcD = crc16(dataC);

      // UEF check header
      addWord(0x100);
      addDouble(dataC.length+23+title.length); // add header **** TODO

      // Cassette Filing System block
      addData ([0x2A]);               // 1 One synchronisation byte (&2A).
      addData (charArray(title));     // N File name (one to ten characters).
      addData ([0x00]);               // 1 One end of file name marker byte (&00).
      addDouble (loadAddress);        // 4 Load address of file, four bytes, low byte first.
      addDouble (executionAddress);   // 4 Execution address of file, four bytes, low byte first.
      addWord (block);                // 2 Block number, two bytes, low byte first.
      addWord (dataC.length);         // 2 Data block length, two bytes, low byte first.
      addData ([flag]);               // 1 Block flag, one byte.
      addDouble (0x00000000);         // 4 Address of next file, four bytes. See Data layer above.
      var crcH = crc16(uefData.slice(uefData.length-18-title.length,uefData.length));
      addWord (crcH);                 // 2 CRC on header, two bytes.

      addData (dataC);                // D Data, number of bytes as stated in the data block length field.
      addWord (crcD);                 // 2 CRC on data, two bytes. Omitted if data block length = 0.

      // interblock carrier tone
      addChunk (0x0110, [0x00,0x04]);

      filePos = filePos + chunkLength;
      block++;
    }

    return new Uint8Array(uefData);
  };
