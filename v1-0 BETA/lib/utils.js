function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
  results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

var saveByteArray = (function () {
  console.log("saveByteArray");
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  return function (data, name) {
    var blob = new Blob(data, {type: "octet/stream"}),
    url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  };
}());


  function resize(){
    var c	= document.getElementById("cassette");
    newwidth = window.innerWidth-10;
    if (newwidth>480){newwidth=480};
    c.width=newwidth;
    c.height=260*newwidth/400;
    var ctx = c.getContext("2d");
    var scalefactor = newwidth / 400;
    ctx.scale(scalefactor,scalefactor);}

    window.addEventListener('resize', function(event){
      resize();
    });
