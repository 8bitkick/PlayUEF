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
  var pi = Math.PI;
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

  var tapeBody = "#282828";
  var tapeLight = "#5f5f5f";
  var tapeMedium = "#181818";
  var tapeDark = "#1a1a1a";
  // Tape body
  ctx.fillStyle = tapeLight;
  roundRect(ctx, 0, 0, 400, 260-2, 10, true, false);

  ctx.fillStyle = tapeBody;
  roundRect(ctx, 0, 3, 400-3, 260-5, 10, true, false);

  // Sprocket window
  ctx.fillStyle = "#333344";
  roundRect(ctx, 80, 80, 400-160, 155-80, 6, true, false);

  // Spools
  ctx.fillStyle = '#440800';

  // cheat a bit as radius of curature doesnt change
  //var leftspool = ((length - position)/900)*30;
  //var rightspool = (position/900)*30;
  function spoolDiameter(length){
    var h = 1.25;
    var D0 = 40.5;
    var top = ((D0-h)*(D0-h))+((4*h*length)/pi);
    var N = ((h-D0) + Math.sqrt(top))/ 2*h;
    return (2*N*h)+D0;

  }

  var leftspool = spoolDiameter(length - position);
  var rightspool = spoolDiameter(position);

  circle(ctx,280,120,rightspool);
  circle(ctx,120,120,leftspool);

  ctx.fillStyle = '#bbbbbb';
  circle(ctx,280,120,40);
  circle(ctx,120,120,40);

  ctx.fillStyle = '#eeeeee';
  circle(ctx,280,120,30);
  circle(ctx,120,120,30);

  ctx.fillStyle = '#ccccee';
  circle(ctx,280,120,26);
  circle(ctx,120,120,26);

  ctx.fillStyle = '#eeeeee';
  circle(ctx,280,121,25);
  circle(ctx,120,121,25);

  ctx.fillStyle = "#080808";
  circle(ctx,280,120,20);
  circle(ctx,120,120,20);

  // Spool teeth
  ctx.strokeStyle="#eeeeee";
  var rotation = position;
  for (var angle=0+rotation; angle <= (2*pi)+rotation; angle+=pi/3){
    ctx.beginPath();
    ctx.moveTo(280-(21*Math.cos(angle)), 120+(21*Math.sin(angle)));
    ctx.lineTo(280-(21*Math.cos((angle+pi))), 120+(21*Math.sin((angle+pi))));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(120+(21*Math.cos(angle)), 120-(21*Math.sin(angle)));
    ctx.lineTo(120+(21*Math.cos((angle+pi))), 120-(21*Math.sin((angle+pi))));
    ctx.stroke();
  }

  // Red bits
  ctx.strokeStyle="#880000";
  ctx.beginPath();
  ctx.arc(280, 120, 37, -rotation, -rotation+0.5, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(120, 120, 37, -rotation+1, -rotation+1.5, false);
  ctx.stroke();

  // Mask bottom of tape
  ctx.fillStyle = tapeBody;
  ctx.fillRect(25,190,350,60);
  ctx.fillRect(60,250,400-120,10);

  // shadow
  ctx.fillStyle = "rgba(33,33,33, 0.5)";
  ctx.fillRect(80,85,240,8);
  ctx.strokeStyle="rgba(33,33,33, 0.5)";
  ctx.beginPath();
  ctx.arc(273, 120, 38, pi/2, pi/2*3, true);
  ctx.stroke();

  // Overlay label again
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(25,25,350,63);
  ctx.fillRect(25,152,350,39);
  ctx.fillRect(25,25,55,165);
  ctx.fillRect(400-35-45,25,55,165);

  ctx.lineWidth = 25;
  ctx.strokeStyle="#eeeeee";
  ctx.beginPath();
  ctx.arc(120, 120, 45, pi/2, pi/2*3, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(280, 120, 45, pi/2, pi/2*3, true);
  ctx.stroke();

  // Label top corners
  ctx.fillStyle = tapeBody;
  ctx.beginPath();
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

  ctx.fillText("PlayUEF version "+version,200,72);
  ctx.fillText(baud,340,115);
  ctx.fillText("baud",340,130);


  function download(x,y) {
    ctx.fillStyle = tapeLight;
    ctx.fillRect(x,y,30,30);
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(x+2,y+2,26,26);
    ctx.fillStyle = tapeLight;

    ctx.beginPath();
    ctx.moveTo(x+8, y+15); //
    ctx.lineTo(x+22, y+15); //
    ctx.lineTo(x+15, y+22); //
    ctx.fill(); // connect and fill
    ctx.beginPath();

    ctx.lineWidth = 2;
    ctx.strokeStyle=tapeLight;
    ctx.moveTo(x+8, y+12); //
    ctx.lineTo(x+22, y+12); //
    ctx.stroke(); // connect and fill
    ctx.moveTo(x+15, y+12); //
    ctx.lineTo(x+15, y+15); //
    ctx.stroke(); // connect and fill

  }

  //download(43,102.5);

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
  ctx.fillText("8bitkick.cc",35,185);

  // markers
  ctx.strokeStyle="rgba(200,200,200, 0.2)";
  ctx.lineWidth=1;
  for (var x=0; x<10; x++){
    ctx.beginPath();
    ctx.moveTo(160+(x*10), 110);
    ctx.lineTo(160+(x*10), 130);

    ctx.stroke();
  }

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

};
