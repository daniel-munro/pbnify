/**
 * @license
 * Copyright Dan Munro
 * Released under Expat license <https://directory.fsf.org/wiki/License:Expat>
 */

'use strict';

/**
 * @ngdoc function
 * @name pbnApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the pbnApp
 */
angular.module('pbnApp')
  .controller('MainCtrl', function ($scope) {

      $scope.step = "load";
      $scope.view = "";
      $scope.status = "";
      $scope.loaderStyle = {
  	  border: "4px dashed #777777"
      };
      $scope.palette = [];
      $scope.colorInfoVisible = false;

      $scope.imageLoaded = function(imgSrc) {
  	  var img = new Image();
  	  img.src = imgSrc;
  	  img.onload = function() {
  	      var c = document.getElementById("img-canvas");
  	      // c.width = 800;
	      c.width = document.getElementById("widthSlider").value;
  	      var cb = document.getElementById("resizeCheckbox");
              if (cb.checked) {
  	          var scale = c.width / img.naturalWidth;
  	          c.height = img.naturalHeight * scale;
              } else {
                  c.width = img.naturalWidth;
                  c.height = img.naturalHeight;
              }
  	      document.getElementById("canvases").style.height = (c.height + 20) + "px";
  	      $scope.c = c;
  	      $scope.ctx = c.getContext("2d");
  	      $scope.ctx.drawImage(img, 0, 0, c.width, c.height);
  	      $scope.step = "select";
  	      $scope.$apply();
  	  };
      };

      $scope.colorDistance = function(c1, c2) {
	// See https://stackoverflow.com/a/9085524
	var r = c1.r - c2.r;
	var g = c1.g - c2.g;
	var b = c2.b - c2.b;
	var rmean = r / 2;
	var dist = Math.sqrt((((512+rmean)*r*r)>>8) + 4*g*g + (((767-rmean)*b*b)>>8));
	return dist;
      };

      $scope.addColor = function(color, threshold) {
	  addColorInfo(color);
	  var mindist = -1;
  	  for (var i = 0; i < $scope.palette.length; i++) {
               var pcol = $scope.palette[i];
               if ((color.r == pcol.r) && (color.g == pcol.g) && (color.b = pcol.b)) {
                   return;
               }
               var dist = $scope.colorDistance(color, pcol);
	       if ((mindist == -1) || (dist < mindist)) {
                   mindist = dist;
               }
          }
	  if ((mindist == -1) || (mindist >= threshold)) {
		$scope.palette.push(color);
	  }
     };

      $scope.removeColor = function(color) {
  	  _.pull($scope.palette, color);
      };

      var getNearest = function(palette, col) {
  	  var nearest;
  	  var nearestDistsq = 1000000;
  	  for (var i = 0; i < palette.length; i++) {
  	      var pcol = palette[i];
  	      var distsq = Math.pow(pcol.r - col.r, 2) +
  		  Math.pow(pcol.g - col.g, 2) +
  		  Math.pow(pcol.b - col.b, 2);
  	      if (distsq < nearestDistsq) {
  		  nearest = i;
  		  nearestDistsq = distsq;
  	      }
  	  }
  	  return nearest;
      };

      var imageDataToSimpMat = function(imgData, palette) {
  	  var mat = [];
  	  for (var i = 0; i < imgData.height; i++) {
  	      mat[i] = new Array(imgData.width);
  	  }
  	  for (var i = 0; i < imgData.data.length; i += 4) {
  	      var nearestI = getNearest(palette, {
  		  r: imgData.data[i],
  		  g: imgData.data[i + 1],
  		  b: imgData.data[i + 2]
  	      });
  	      var x = (i / 4) % imgData.width;
  	      var y = Math.floor((i / 4) / imgData.width);
  	      mat[y][x] = nearestI;
  	  }
  	  return mat;
      };

      var matToImageData = function(mat, palette, context) {
  	  var imgData = context.createImageData(mat[0].length, mat.length);
  	  for (var y = 0; y < mat.length; y++) {
  	      for (var x = 0; x < mat[0].length; x++) {
  		  var i = (y * mat[0].length + x) * 4;
  		  var col = palette[mat[y][x]];
  		  imgData.data[i] = col.r;
  		  imgData.data[i + 1] = col.g;
  		  imgData.data[i + 2] = col.b;
  		  imgData.data[i + 3] = 255;
  	      }
  	  }
  	  return imgData;
      };
      
      
      var displayResults = function(matSmooth, matLine, labelLocs) {
  	  var c2 = document.getElementById("filled-canvas");
  	  c2.width = $scope.c.width;
  	  c2.height = $scope.c.height;

  	  // draw filled
  	  var ctx2 = c2.getContext("2d");
  	  var imgData = matToImageData(matSmooth, $scope.palette, ctx2);
  	  ctx2.putImageData(imgData, 0, 0);

  	  var c3 = document.getElementById("outline-canvas");
  	  c3.width = c2.width;
  	  c3.height = c2.height;

  	  // draw outlines
	  // gray value was 191, changed to 150.
  	  var bw = [{ r: 255, g: 255, b: 255 },
		    { r: 150, g: 150, b: 150 }];
  	  var ctx3 = c3.getContext("2d");
  	  var imgData = matToImageData(matLine, bw, ctx3);
  	  ctx3.putImageData(imgData, 0, 0);

  	  // draw numbers
  	  ctx3.font = "12px Georgia";
  	  ctx3.fillStyle = "rgb(150, 150, 150)";
  	  for (var i = 0; i < labelLocs.length; i++) {
  	      ctx3.fillText(labelLocs[i].value + 1,
			    labelLocs[i].x - 3,
			    labelLocs[i].y + 4);
  	  }

  	  $scope.c2 = c2;
  	  $scope.c3 = c3;
      };


      var rgbToHex = function(r, g, b) {
	  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      };
      
      var rgbToCmyk = function(r, g, b) {
	  var k = 1 - Math.max(r / 255, g / 255, b / 255);
	  if (k == 1) {
	      var c = 0;
	      var m = 0;
	      var y = 0;
	  } else {
	      var c = (1 - r / 255 - k) / (1 - k);
	      var m = (1 - g / 255 - k) / (1 - k);
	      var y = (1 - b / 255 - k) / (1 - k);
	  }
	  
	  return {
	      c: Math.round(c * 100),
	      m: Math.round(m * 100),
	      y: Math.round(y * 100),
	      k: Math.round(k * 100)
	  };
      };
      
      var rgbToHsl = function(r, g, b) {
	  r = r / 255;
	  g = g / 255;
	  b = b / 255;
	  
	  var M = Math.max(r, g, b);
	  var m = Math.min(r, g, b);
	  
	  if (M == m) {
	      var h = 0;
	  } else if (M == r) {
	      var h = 60 * (g - b) / (M - m);
	  } else if (M == g) {
	      var h = 60 * (b - r) / (M - m) + 120;
	  } else {
	      var h = 60 * (r - g) / (M - m) + 240;
	  }
	  
	  var l = (M + m) / 2;
	  if (l == 0 || l == 1) {
	      var s = 0;	// So it isn't NaN for black or white.
	  } else {
	      var s = (M - m) / (1 - Math.abs(2 * l - 1));
	  }
	  
	  return {
	      h: ((Math.round(h) % 360) + 360) % 360,  // js modulo isn't always positive
	      s: Math.round(s * 100),
	      l: Math.round(l * 100)
	  };
      };
      
      var rgbToHsv = function(r, g, b) {
	  r = r / 255;
	  g = g / 255;
	  b = b / 255;
	  
	  var M = Math.max(r, g, b);
	  var m = Math.min(r, g, b);
	  
	  if (M == m) {
	      var h = 0;
	  } else if (M == r) {
	      var h = 60 * (g - b) / (M - m);
	  } else if (M == g) {
	      var h = 60 * (b - r) / (M - m) + 120;
	  } else {
	      var h = 60 * (r - g) / (M - m) + 240;
	  }

	  if (M == 0) {
	      var s = 0;	// So it isn't NaN for black.
	  } else {
	      var s = (M - m) / M;
	  }
	  
	  return {
	      h: ((Math.round(h) % 360) + 360) % 360,
	      s: Math.round(s * 100),
	      v: Math.round(M * 100)
	  };
      };
      
      var getColorInfo = function(palette) {
	  for (var i = 0; i < palette.length; i++) {
	      var col = palette[i];
              addColorInfo(col);
	  }
      };

      var addColorInfo = function(col) {
	      col.hex = rgbToHex(col.r, col.g, col.b);
	      col.cmyk = rgbToCmyk(col.r, col.g, col.b);
	      col.hsl = rgbToHsl(col.r, col.g, col.b);
	      col.hsv = rgbToHsv(col.r, col.g, col.b);
      }

      $scope.pbnify = function() {
  	  $scope.step = "process";
  	  var width = $scope.c.width;
  	  var height = $scope.c.height;
  	  var imgData = $scope.ctx.getImageData(0, 0, width, height);
  	  var mat = imageDataToSimpMat(imgData, $scope.palette);

  	  var worker = new Worker('scripts/processImage.js');
  	  worker.addEventListener('message', function(e) {
  	      if (e.data.cmd == "status") {
  		  $scope.status = e.data.status;
  		  $scope.$apply();
  	      } else {
  		  var matSmooth = e.data.matSmooth;
  		  var labelLocs = e.data.labelLocs;
  		  var matLine = e.data.matLine;
  		  worker.terminate();

  		  displayResults(matSmooth, matLine, labelLocs);
  		  $scope.step = "result";
  		  $scope.view = "filled";
  		  $scope.$apply();
  	      }
  	  }, false);
  	  worker.postMessage({ mat: mat });
      };

      $scope.newImage = function() {
  	  $scope.palette = [];
  	  document.getElementById("canvases").style.height = "0px";
  	  $scope.step = "load";
      };

      $scope.sampleArea = function(x, y, size) {
	var pixels = { r: [], g: [], b: [] };
	for (var xNear = x - size; xNear <= x + size; xNear ++) {
		for (var yNear = y - size; yNear <= y + size; yNear ++) {
			var pixel = $scope.ctx.getImageData(xNear, yNear, 1, 1).data;
			pixels.r.push(pixel[0]);
			pixels.g.push(pixel[1]);
			pixels.b.push(pixel[2]);
		}
	}
	var mean = function(array) {
		return array.reduce(function(a, b) {return a + b;}, 0) / array.length;
	};
	var color = {
		x: x,
		y: y,
		r: Math.round(mean(pixels.r)),
		g: Math.round(mean(pixels.g)),
		b: Math.round(mean(pixels.b))
	};
	return color;
      };

      $scope.autoPalette = function() {
  	 var width = $scope.c.width;
  	 var height = $scope.c.height;
	 var maxpalettesize = document.getElementById("palettesizeSlider").value;
	 var threshold = document.getElementById("similaritySlider").value;
	 var sampler = document.getElementById("samplerSlider").value;

	 var count = Math.sqrt(width * height);
	 for (var i = 0; i < count; i++) {
		if ($scope.palette.length >= maxpalettesize) {
			return;
		}
		var x = Math.random() * width;
		var y = Math.random() * height;
		var color = $scope.sampleArea(x, y, sampler);
		$scope.addColor(color, threshold);
	  }
/*
	  for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			if ($scope.palette.length >= maxpalettesize) {
				return;
			}
			var pixel = $scope.ctx.getImageData(x, y, 1, 1).data;
			var color = {
			    x: x,
			    y: y,
			    r: Math.round(pixel[0]),
			    g: Math.round(pixel[1]),
			    b: Math.round(pixel[2])
			};
			$scope.addColor(color);
		}
	}
*/
      };

      $scope.recolor = function() {
  	  $scope.step = "select";
      };

      $scope.clearPalette = function() {
  	  $scope.palette = [];
      };
      
      $scope.showColorInfo = function() {
	  $scope.colorInfoVisible = true;
      };
      
      $scope.hideColorInfo = function() {
	  $scope.colorInfoVisible = false;
      };

      $scope.viewFilled = function() {
  	  $scope.view = "filled";
      };

      $scope.viewOutline = function() {
  	  $scope.view = "outline";
      };

      $scope.saveFilled = function() {
  	  // var button = document.getElementById("save-filled");
  	  // button.href = $scope.c2.toDataURL();
  	  // button.download = "myPBN.png";

  	  var win = window.open();
  	  win.document.write('<html><head><title>PBN filled</title></head><body><img src="' + $scope.c2.toDataURL() + '"></body></html>');
  	  win.print();
  	  // win.location.reload();
      };

      $scope.saveOutline = function() {
  	  // var button = document.getElementById("save-outline");
  	  // button.href = $scope.c3.toDataURL();
  	  // button.download = "myPBN.png";

  	  var win = window.open();
  	  win.document.write('<html><head><title>PBN outline</title></head><body><img src="' + $scope.c3.toDataURL() + '"></body></html>');
  	  win.print();
  	  // win.location.reload();
      };

      $scope.savePalette = function() {
  	  var canvas = document.createElement('canvas');
  	  canvas.width = 80 * Math.min($scope.palette.length, 10);
  	  canvas.height = 80 * (Math.floor(($scope.palette.length - 1) / 10) + 1);
  	  var ctx = canvas.getContext("2d");
  	  ctx.fillStyle = "#ffffff";
  	  ctx.fillRect(0, 0, canvas.width, canvas.height);
  	  ctx.strokeStyle = "#000000";
  	  for (var i = 0; i < $scope.palette.length; i++) {
  	      var col = $scope.palette[i];
  	      ctx.fillStyle = "rgba(" + col.r + ", " + col.g + ", " + col.b + ", 255)";
  	      var x = 80 * (i % 10);
  	      var y = 80 * Math.floor(i / 10);
  	      ctx.fillRect(x + 10, y + 10, 60, 60);
  	      ctx.fillStyle = "#ffffff";
  	      ctx.fillRect(x + 10, y + 10, 20, 20);
  	      ctx.font = '16px sans-serif';
  	      ctx.fillStyle = "#000000";
  	      ctx.textAlign = "center";
  	      ctx.fillText(i + 1, x + 20, y + 26);
  	      ctx.strokeRect(x + 10, y + 10, 60, 60);
  	  }

  	  // var button = document.getElementById("save-palette");
  	  // button.href = canvas.toDataURL();
  	  // button.href = '<html><head><title>PBN palette</title></head><body><img src="' + canvas.toDataURL() + '"></body></html>';
  	  var win = window.open();
  	  win.document.write('<html><head><title>PBN palette</title></head><body><img src="' + canvas.toDataURL() + '"></body></html>');
  	  win.print();
  	  // win.location.reload();
  	  // button.download = "palette.png";
      };


  });
