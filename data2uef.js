// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//


function data2uef (){
  "use strict";

  var fileData = charArray("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse velit sapien, consectetur non maximus rutrum, eleifend quis turpis. Cras sagittis ligula et justo fermentum faucibus. Suspendisse eget faucibus neque. Suspendisse non lorem eu enim aliquet laoreet sit amet et est. Pellentesque eu nunc semper ipsum pretium pretium interdum at eros. Vestibulum fermentum, leo quis cursus faucibus, mauris est euismod enim, a volutpat dolor metus non nunc. Curabitur viverra egestas arcu id convallis. Vivamus mauris est, dictum et malesuada sed, cursus id erat. Vestibulum sit amet eros luctus, accumsan odio porttitor, tristique ipsum. Praesent non est ut ligula sollicitudin ornare. Mauris eget euismod metus, in pellentesque quam. Curabitur nulla ante, porta at augue id, congue venenatis justo. Integer facilisis ullamcorper nunc in sodales. Aliquam a quam elementum, suscipit elit et, rutrum lacus. Donec nisl ex, efficitur at lectus eget, finibus rutrum nibh. Ut sit amet dui sit amet tellus ultrices congue a sit amet velit. Cras eu consequat elit. Quisque massa justo, lobortis non magna sit amet, placerat rutrum erat. Cras consectetur enim non metus volutpat tempor. Proin ornare turpis eu quam tempus, eu finibus nisi malesuada. Phasellus tincidunt lorem eu ultrices gravida. Ut ut imperdiet ligula, vel eleifend tellus. Duis nunc libero, ullamcorper ut sapien sit amet, scelerisque fringilla mi. Vestibulum rutrum pretium justo, id blandit leo euismod sit amet. Fusce finibus accumsan nulla vitae pretium. Etiam id nisl id purus viverra tincidunt. Ut vel tempus mi, non pretium augue. Donec euismod pharetra efficitur. Nulla at efficitur turpis. Integer ut tortor purus. Nullam in scelerisque tortor. Ut consequat dignissim ante. Sed nec ligula laoreet nisl finibus fringilla molestie quis sem. Suspendisse potenti. Ut sed turpis tincidunt ex varius venenatis. Curabitur commodo congue porttitor. Aenean vehicula lectus eu egestas euismod. Suspendisse ac dolor nibh. Nam lacinia, orci et porta tincidunt, dolor lectus fermentum metus, sed commodo tortor sapien a quam. Proin volutpat mauris id lorem tempus auctor. Etiam rutrum rhoncus turpis, ut interdum odio ornare nec. Etiam ultrices ac nibh quis lobortis. Aliquam condimentum quam ex, quis euismod ex euismod non. Nullam aliquet orci nec nisl ultrices, at faucibus dui euismod. Integer mollis nulla id urna dictum accumsan. Duis placerat hendrerit euismod. Proin sodales cursus ex quis egestas. Duis ac diam nisl. Vestibulum sem nulla, egestas sit amet enim eget, scelerisque laoreet turpis. Nam congue sapien et tortor tincidunt sodales. Sed pellentesque est interdum porta finibus. Maecenas accumsan, nunc at tempor congue, dolor magna auctor augue, vel suscipit diam odio a erat. Suspendisse non efficitur risus. Integer eleifend dictum nulla a maximus. Nulla ex urna, condimentum non ipsum vitae, gravida fermentum leo. Nam sem nisi, porta et leo sit amet, dapibus interdum lorem. Fusce egestas cursus risus. In at bibendum ante, et tempor sem. Pellentesque pellentesque ornare mollis. Etiam quis odio posuere, laoreet mauris mollis, sollicitudin ante. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Phasellus cursus ut nisl vitae interdum. Aliquam erat volutpat. Aliquam ipsum lorem, dictum ut augue sed, porttitor vulputate nulla. Phasellus vel nibh lectus.");

  var fileData = charArray("Lorem ipsum dolor sit amet");

  //var fileData = [42, 13, 0, 0, 14, 0, 0, 0, 95, 0, 0, 76, 0, 73, 0, 129, 0, 0, 0, 0, 186, 155, 169, 129, 162, 0, 160, 255, 32, 244, 255, 224, 0, 240, 12, 169, 200, 162, 2, 160, 0, 32, 244, 255, 202, 202, 202, 134, 112, 162, 21, 189, 48, 95, 157, 0, 1, 93, 134, 5, 5, 112, 133, 112, 202, 16, 240, 170, 240, 22, 169, 14, 133, 113, 160, 0, 132, 112, 145, 112, 200, 208, 251, 230, 113, 36, 113, 80, 245, 108, 252, 255, 76, 208, 90, 204, 155];
  //var fileData = [169, 129, 162, 0, 160, 255, 32, 244, 255, 224, 0, 240, 12, 169, 200, 162, 2, 160, 0, 32, 244, 255, 202, 202, 202, 134, 112, 162, 21, 189, 48, 95, 157, 0, 1, 93, 134, 5, 5, 112, 133, 112, 202, 16, 240, 170, 240, 22, 169, 14, 133, 113, 160, 0, 132, 112, 145, 112, 200, 208, 251, 230, 113, 36, 113, 80, 245, 108, 252, 255, 76, 208, 90];


  var filePos = 0;
  var uefData = [];

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
    addData (charArray("UEF File!   "));
    // Info
    addChunk (0x0000, charArray("PlayUEF make v0.1"+String.fromCharCode(0)));
    // Carrier tone
    addChunk (0x0110, [0x00,0x04]);

    // Data blocks
    var block = 76;
    var title = String.fromCharCode(13);
    var loadAddress = 0xe00;
    var executionAddress = 0x5f00;
    var flag = 0;

    while (filePos < fileData.length) {
      var chunkLength = fileData.length - filePos;
      if (chunkLength > 255) {chunkLength=255;} else {flag = 129;};

      var dataC = fileData.slice(filePos,filePos+chunkLength);
      var crcD = crc16(dataC);

      console.log(chunkLength, dataC.length);
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
      addData ([flag]);                 // 1 Block flag, one byte.
      addDouble (0x00000000);         // 4 Address of next file, four bytes. See Data layer above.
      var crcH = crc16(uefData.slice(uefData.length-18-title.length,uefData.length));
      console.log(uefData.slice(uefData.length-18-title.length,uefData.length));
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
