// PlayUEF
// Copyright (c) 2018 8bitkick
//
// www.8bitkick.cc
//
// Converts Acorn Atom ATM format to UEF
// https://github.com/hoglet67/AtomSoftwareArchive

// https://stardot.org.uk/forums/viewtopic.php?f=12&t=14844&p=198899&hilit=Atom+atm#p198899
// FILE=https%3A%2F%2Fraw.githubusercontent.com%2Fhoglet67%2FAtomSoftwareArchive%2Fmaster%2Farchive%2Fdave%2FAF%2FFROGGER


function atm2uef (atmFile){
  "use strict";
  var filePos = 0;
  var uefData = [];
  var blockSize = 0x100;
  var sourceData = Array.from(atmFile);
  var size = 0;

  function addDouble(double){
    for (var i = 0 ; i < 4; i++) {
      var byte = double & 0xFF;
      uefData.push(byte);
      double = double >>> 8;
    }
  }

  function addWord(word){
    uefData.push(word >>> 8);
    uefData.push(word & 0xFF);

  }

  function addByte(byte){
      uefData.push(byte);
  }

  function addData(data){
    var data = data;
    var byte;
    while (data.length>0) {
      byte = data.shift();
      uefData.push(byte);
    }
  }

  function addString(data){
    var i = 0;
    while (data.length>i && data[i] != 0 && data[i] != 13) {
      uefData.push(data[i]);
      i++
    }
  }

  // Atom checksum
  // The checksum is a simple sum (modulo 256) of all bytes from the start of the block to the end of the data.*/
  function sum(data,start){
  var checksum = start;
      for (var i=0; i<data.length; i++){
        checksum = (checksum + data[i]) & 0xFF;
      }
      return (checksum);
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

    // Atom ATM files contain a 22 byte header:
    //00-15 Filename
    //16-17 Load address (lb-hb)
    //18-19 Execute address (lb-hb)
    //20-21 Filelength (lb-hb)
    //22- File data

// ATM test file
/*
    sourceData = [73,78,83,0,82,85,67,84,73,79,78,83,0,0,0,0, // LOAD "INS"
                  0,41,                                   // LOAD address
                  178,194,                                // Execute address
                  0,0,                                    // Filelength dont care
                  13,0,1,80,46,36,49,50,59,68,79,80,46,36,35,68,70,59,85,46,67,46,61,52,50,13,0,2,80,46,34,97,116,111,109,34,36,35,56,68,34,98,114,101,97,107,111,117,116,34,59,68,79,80,46,36,35,68,70,59,85,46,67,46,61,55,52,13,0,3,80,46,34,105,110,115,116,114,117,99,116,105,111,110,115,34,36,35,56,48,59,68,79,80,46,36,35,68,70,59,85,46,67,46,61,35,56,49,13,0,4,80,46,34,85,83,73,78,71,32,84,72,69,32,83,72,73,70,84,32,65,78,68,32,82,69,80,84,32,75,69,89,83,32,84,79,34,13,0,5,80,46,34,67,79,78,84,82,79,76,32,89,79,85,82,32,66,65,84,44,32,84,82,89,32,84,79,32,82,69,77,79,86,69,32,34,13,0,6,80,46,34,65,83,32,77,65,78,89,32,66,82,73,67,75,83,32,65,83,32,80,79,83,83,73,66,76,69,34,39,39,13,0,7,80,46,34,53,48,48,32,80,79,73,78,84,83,32,87,73,78,83,32,65,78,32,69,88,84,82,65,32,66,65,76,76, 34,39,39,13,0,8,80,46,34,84,79,80,32,83,67,79,82,69,32,84,79,32,68,65,84,69,44,32,78,85,77,66,69,82,32,79,70,34,39,13,0,9,80,46,34,66,65,76,76,83,32,76,69,70,84,32,65,78,68,32,89,79,85,82,32,67,85,82,82,69,78,84,34,39,13,0,10,80,46,34,83,67,79,82,69,32,65,82,69,32,68,73,83,80,76,65,89,69,68,34,39,39,13,0,11,80,46,34,65,70,84,69,82,32,65,32,71,65,77,69,44,32,72,73,84,32,82,69,84,85,82,78,32,84,79,32,80,76,65,89,65,71,65,73,78,34,13,0,12,69,46,13,255];
*/

    var filename          = sourceData.slice(0,15);
    var loadAddress       = sourceData[16] | sourceData[17]<<8;
    var executionAddress  = sourceData[18] | sourceData[19]<<8 ;
    var fileLength        = sourceData[20] | sourceData[21]<<8;
    // Remove header from source data
    sourceData        = sourceData.slice(22);
    // UEF identifier
    addData (charArray("UEF File!"));
    addData ([0,0,0]);
    // Info
    addChunk (0x0000, charArray("PlayUEF from ATM v0.1"+String.fromCharCode(0)));

    // data encoding format change 300 baud
    addChunk (0x1701, [0x2C,0x01]);

    // Carrier tone
    addChunk (0x1001, [0x60,0x09]);

    // Atom data blocks
    var blockFlag = 5<<2;
    var blockNumber = 0;
    var checksum = 0;
    var checkStart = 0;

    while (filePos < sourceData.length) {

      var chunkLength = sourceData.length - filePos;
      if (chunkLength > blockSize) {chunkLength=blockSize;}
      size += chunkLength;

      var dataC = sourceData.slice(filePos,filePos+chunkLength);

      // The block flag is set as follows:
      //Bits 4 to 0 are undefined. Normally their contents are:
      //in the first block, bits 15 to 11 of the end address (=1 + the last address saved in the file);
      blockFlag = (blockFlag >> 2) & 0x7F;  //in subsequent blocks, bits 6 to 2 of the previous block flag.

      blockFlag = (blockNumber>0) ? (blockFlag | (1<<5)) : blockFlag;    // Bit 5 is set if this block is not the first block of a file.
      blockFlag = (chunkLength>3) ? (blockFlag | (1<<6)) : blockFlag;    // Bit 6 is set if the block contains data. If clear then the 'data block length' field is invalid.
      blockFlag = ((sourceData.length - filePos) > chunkLength) ? (blockFlag | (1<<7)) : blockFlag; // Bit 7 is set if this block is not the last block of a file.

      // Add UEF chunk: Defined data containing filesystem header
      addWord(0x0401);                                         // definedDataBlock
      addDouble(17+filename.indexOf(0)+dataC.length);          // UEF chunk length
      addByte(8);addByte(78);addByte(255);                     // 8N-1 - Acorn Atom format
        // Cassette Filing System header
        checkStart = uefData.length;
        addDouble ([0x2A2A2A2A]);       // 4 synchronisation bytes (&2A).
        addString (filename);           // N File name (one to ten characters).
        addByte (0x0D);                 // One end of file name marker byte (&0D).
        addByte(blockFlag);             //Block flag, one byte.
        addWord(blockNumber);           //Block number, two bytes, high byte first.
        addByte(dataC.length-1);        //Data block length − 1, one byte.
        addWord (executionAddress);     //Execution address, two bytes, high byte first.
        addWord (loadAddress);          //Load address, two bytes, high byte first.
        addData (dataC);
        checksum = sum(uefData.slice(checkStart,uefData.length),0);
        addByte(checksum);

      addChunk (0x1001, [0x00,0x08]); // carrier tone

      filePos = filePos + chunkLength;
      loadAddress = loadAddress + chunkLength;
      blockNumber++;
    }
    // Add UEF chunk: Interblock carrier tone chunk

    console.log("Encode UEF: from "+sourceData.length+" bytes ATM data");
    return {file:new Uint8Array(uefData), name:String.fromCharCode.apply(null, filename)};
  };
