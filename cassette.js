// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro
//
// Reference:
//
// http://electrem.emuunlim.com/UEFSpecs.htm
// https://www.stairwaytohell.com/essentials/uef2wave.py


function Cassette(length, position, title, baud, version) {

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    //x+=radius;y+=radius;
    if (typeof stroke == "undefined" ) {
      stroke = true;
    }
    if (typeof radius === "undefined") {
      radius = 5;
    }
    ctx.lineWidth=radius;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (stroke) {
      ctx.stroke();
    }
    if (fill) {
      ctx.fill();
    }
  }

  function circle (ctx, x,y, radius) {
    ctx.beginPath();
    ctx.arc(x,y,radius,0,2*Math.PI);
    ctx.closePath();
    ctx.fill();
  }

  var c	= document.getElementById("cassette");
  var ctx = c.getContext("2d");

  tapeBody = "#444444";
  tapeLight = "#555555";
  tapeDark = "#222222";
  // Tape body
  ctx.fillStyle = tapeBody;
  roundRect(ctx, 0, 0, 400, 260, 10, true, false);

  // Tape screws
  ctx.fillStyle = tapeLight;
  circle(ctx,14,14,8);
  circle(ctx,400-14,14,8);
  circle(ctx,14,260-14,8);
  circle(ctx,400-14,260-14,8);

  // Nubbin
  ctx.strokeStyle = tapeDark;
  ctx.beginPath();
  ctx.moveTo(60, 260);
  ctx.lineTo(80, 200);
  ctx.lineTo(400-80, 200);
  ctx.lineTo(400-60, 260);
  //ctx.closePath();
  ctx.stroke();

  // nubbin holes
  ctx.fillStyle = tapeDark;
  circle(ctx,105,245,10);
  circle(ctx,400-105,245,10);
  circle(ctx,145,235,7);
  circle(ctx,400-145,235,7);
  circle(ctx,145,238,7);
  circle(ctx,400-145,238,7);

  // Sprocket window
  ctx.fillStyle = tapeBody;
  roundRect(ctx, 80, 80, 400-160, 155-80, 6, true, false);

  // Spools
  ctx.fillStyle = '#440800';
  // cheat a bit as radius of curature doesnt change

  leftspool = ((length - position)/900)*30;
  rightspool = (position/900)*30;
  circle(ctx,280,120,40+rightspool);
  circle(ctx,120,120,40+leftspool);

  ctx.fillStyle = '#cccccc';
  circle(ctx,280,120,40);
  circle(ctx,120,120,40);

  ctx.fillStyle = '#eeeeee';
  circle(ctx,280,120,30);
  circle(ctx,120,120,30);

  ctx.fillStyle = '#000000';
  circle(ctx,280,120,20);
  circle(ctx,120,120,20);

  // Spool teeth
  ctx.strokeStyle="#eeeeee";
  rotation = (position-(Math.floor(position)))*60;
  for (var angle=0+rotation; angle <= 360+rotation; angle+=60){
    ctx.beginPath();
    ctx.moveTo(280+(30*Math.cos((Math.PI/180)*angle)), 120-(30*Math.sin((Math.PI/180)*angle)));
    ctx.lineTo(280+(30*Math.cos((Math.PI/180)*(angle+180))), 120-(30*Math.sin((Math.PI/180)*(angle+180))));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(120+(30*Math.cos((Math.PI/180)*angle)), 120-(30*Math.sin((Math.PI/180)*angle)));
    ctx.lineTo(120+(30*Math.cos((Math.PI/180)*(angle+180))), 120-(30*Math.sin((Math.PI/180)*(angle+180))));
    ctx.stroke();}

    // Overlay label again
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(25,25,350,55);
    ctx.fillRect(25,155,350,35);
    ctx.fillRect(25,25,55,165);
    ctx.fillRect(400-35-45,25,55,165);

    // Label top corners
    ctx.fillStyle = tapeBody;
    ctx.moveTo(40, 25); //
    ctx.lineTo(25, 40); //
    ctx.lineTo(25, 25); //
    ctx.fill(); // connect and fill
    ctx.moveTo(400-40, 25); //
    ctx.lineTo(400-25, 40); //
    ctx.lineTo(400-25, 25); //
    ctx.fill(); // connect and fill

    ctx.fillStyle = '#000000';
    circle(ctx,280,120,16);
    circle(ctx,120,120,16);


    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.font="16px Arial";

    ctx.fillText(title,200,52);

    ctx.font="10px Arial";

    ctx.fillText("Acorn Electron & BBC Micro UEF player",200,72);
    ctx.fillText(baud,347,110);
    ctx.fillText("baud",347,124);

    ctx.fillText("version",400-347,110);
    ctx.fillText(version,400-347,124);

    // sticker stripes
    darkColors = ["#0ba5e8","#ad1a93", "#eb2529","#f57819", "#fdd70b", "#66c536"];
    size = 4;
    for(var i = 0; i < 6; i++) {
      ctx.fillStyle = darkColors[5-i];
      ctx.fillRect(25,190-((i+1)*size),350,size*.8);
    }

    ctx.font="20px Arial";
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.fillText("8bitkick",35,185);

    // Smokey window
    ctx.fillStyle = "rgba(33,33,33, 0.5)";
    ctx.fillRect(35+45,80,330-90,10);


    // DELETE
    var dataURL = c.toDataURL();
    document.getElementById('cassette').src = dataURL;

  };
