// PlayUEF
// Copyright (c) 2017 8bitkick
//
// www.8bitkick.cc
//
// Web-based UEF to WAV conversion and player
// Loads cassette-based games to Acorn Electron and BBC micro


// Cassette
// --------

function cassette(length, position, title, baud, version) {
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

  var tapeBody = "#3a3a3a";
  var tapeLight = "#555555";
  var tapeMedium = "#222222";
  var tapeDark = "#1a1a1a";
  // Tape body
  ctx.fillStyle = tapeLight;
  roundRect(ctx, 0, 0, 400, 260, 10, true, false);

  ctx.fillStyle = tapeBody;
  roundRect(ctx, 3, 3, 400-3, 260-3, 10, true, false);


  // Tape screws


  function screw(x,y) {
    ctx.fillStyle = tapeDark;
    circle(ctx,x+1,y+1,5);
    ctx.fillStyle = tapeLight;
    circle(ctx,x,y,5);
    ctx.fillStyle = tapeMedium;
    ctx.textAlign = 'center';
    ctx.font="16px Arial";
    ctx.fillText("+",x,y+5);

  }

  screw(14,14);
  screw(400-14,14);
  screw(14,260-14);
  screw(400-14,260-14);

  // Nubbin
  ctx.lineWidth = 5;
  ctx.strokeStyle = tapeMedium;
  ctx.beginPath();
  ctx.moveTo(60, 260);
  ctx.lineTo(80, 200);
  ctx.lineTo(400-80, 200);
  ctx.stroke();
  ctx.strokeStyle = tapeLight;
  ctx.beginPath();
  ctx.moveTo(400-80, 200);
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
  ctx.fillStyle = "#080808";
  circle(ctx,105,245,8);
  circle(ctx,400-105,245,8);
  circle(ctx,145,235,5);
  circle(ctx,400-145,235,5);
  circle(ctx,145,238,7);
  circle(ctx,400-145,238,5);

  // Sprocket window
  ctx.fillStyle = tapeBody;
  roundRect(ctx, 80, 80, 400-160, 155-80, 6, true, false);

  // Spools
  ctx.fillStyle = '#440800';
  // cheat a bit as radius of curature doesnt change

  var leftspool = ((length - position)/900)*30;
  var rightspool = (position/900)*30;
  circle(ctx,280,120,40+rightspool);
  circle(ctx,120,120,40+leftspool);

  ctx.fillStyle = '#bbbbbb';
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
  var pi = Math.PI;
  var rotation = position;
  for (var angle=0+rotation; angle <= (2*pi)+rotation; angle+=pi/3){
    ctx.beginPath();
    ctx.moveTo(280-(30*Math.cos(angle)), 120+(30*Math.sin(angle)));
    ctx.lineTo(280-(30*Math.cos((angle+pi))), 120+(30*Math.sin((angle+pi))));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(120+(30*Math.cos(angle)), 120-(30*Math.sin(angle)));
    ctx.lineTo(120+(30*Math.cos((angle+pi))), 120-(30*Math.sin((angle+pi))));
    ctx.stroke();
  }

/*
  ctx.strokeStyle="#880000";
  ctx.beginPath();
  ctx.arc(280, 120, 37, -rotation, -rotation+0.5, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(120, 120, 37, -rotation+1, -rotation+1.5, false);
  ctx.stroke();*/


  // Overlay label again
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(25,25,350,55);
  ctx.fillRect(25,155,350,35);
  ctx.fillRect(25,25,55,165);
  ctx.fillRect(400-35-45,25,55,165);

  // Label top corners
  ctx.fillStyle = tapeBody;
  ctx.moveTo(39, 24); //
  ctx.lineTo(24, 39); //
  ctx.lineTo(24, 24); //
  ctx.fill(); // connect and fill
  ctx.moveTo(400-39, 24); //
  ctx.lineTo(400-24, 39); //
  ctx.lineTo(400-24, 24); //
  ctx.fill(); // connect and fill

  ctx.fillStyle = '#000000';
  circle(ctx,280,120,16);
  circle(ctx,120,120,16);


  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.font="16px Arial";
  if (title.length > 40) {ctx.font="10px Arial";};

  ctx.fillText(title,200,52);

  ctx.font="10px Arial";

  ctx.fillText("Acorn Electron & BBC Micro UEF player",200,72);
  ctx.fillText(baud,347,110);
  ctx.fillText("baud",347,124);


  ctx.fillText("PlayUEF",400-347,110);
  ctx.fillStyle = '#0ba5e8';
  ctx.font="9px Arial";
  ctx.fillText(version,400-347,124);

  // sticker stripes
  var darkColors = ["#0ba5e8","#ad1a93", "#eb2529","#f57819", "#fdd70b", "#66c536"];
  var size = 4;
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

};
