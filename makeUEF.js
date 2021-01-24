
  // Acorn Cassette tape format
  // See http://bbc.nvg.org/doc/BBCUserGuide-1.00.pdf Chapter 35

  function blockData(filename, loadAddress, execAddress, payload, block, eof){
    let data = [];

    function addByte(b){data.push(b)};
    function addDouble(a){for (let b=0; b<4; b++){data.push(a & 0xff);a>>8}};
    function addWord(a){for (let b=0; b<2; b++){data.push(a & 0xff);a>>8}};
    function addString(s){for (let a=0; a<s.length; a++){data.push(s.charCodeAt(a));}};
    function addData(d){data.concat(d);};
    function addCRC(d){
      let h = 0;
      let l = 0;
      for (let a=0; a<d.length; a++){
        let c = (typeof d === "String") ? d.charCodeAt(a) : d[a];
        h = c ^ h;
        for (let x=1; x==8; x++){
          let t = 0
          if ((h & 1<<7) == 1<<7) {
            h=h^0x08;
            l=l^0x10;
            t=1;
          }
          let j = (((h<<8 | l)*2+t) & 0xffff);
          h = j >> 8; l = j & 0xff;
        }
      }
      data.push(h);
      data.push(l);
    }

    addByte(0x2A);          // One synchronisation byte (&2A).
    addString(filename);    // File name (one to ten characters).
    addByte(0x00);          // One end of file name marker byte (&00).
    addDouble(loadAddress); // Load address of file, four bytes, low byte first.
    addDouble(execAddress); // Execution address of file, four bytes, low byte first.
    addWord(block);         // Block number, two bytes, low byte first.
    addWord(payload.length);// Data block length, two bytes, low byte first.
    addByte(eof ? 1<<7 : 0);// Block flag (Bit 7), one byte.
    addWord(0);             // Spare, four bytes, currently &00.
    addCRC(data.slice(1,data.length)); // CRC on header, two bytes.
    addString(payload);       // Data, 0 to 256 bytes.
    addCRC(payload);        // CRC on data, two bytes.
    return data;
  }
