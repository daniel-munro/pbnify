angular.module('pbn').controller('PbnCtrl', function($scope) {
	// $scope.getFile = function() {
	// 	$s
	// }
	// $scope.loaded = false;
	$scope.step = "load";
	$scope.view = "";
	$scope.status = "";
	$scope.loaderStyle = {
		border: "4px dashed gray"
	};
	$scope.palette = [];

	$scope.imageLoaded = function(imgSrc) {
		var img = new Image();
		img.src = imgSrc;
  	img.onload = function() {
			var c = document.getElementById("img-canvas");
	    c.width = 800;
	    var scale = c.width / img.naturalWidth;
	    c.height = img.naturalHeight * scale;
	    document.getElementById("canvases").style.height = c.height + "px";
	    $scope.c = c;
	    $scope.ctx = c.getContext("2d");
	    $scope.ctx.drawImage(img, 0, 0, c.width, c.height);
	    $scope.step = "select";
	    $scope.$apply();
  	};
	};

	$scope.addColor = function(color) {
		$scope.palette.push(color);
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

	$scope.pbnify = function() {
		$scope.step = "process";
		var width = $scope.c.width;
		var height = $scope.c.height
    var imgData = $scope.ctx.getImageData(0, 0, width, height);
    var mat = imageDataToSimpMat(imgData, $scope.palette);

    var worker = new Worker('app/processImage.js');
    worker.addEventListener('message', function(e) {
    	if (e.data.cmd == "status") {
    		$scope.status = e.data.status;
		 		$scope.$apply();
    	} else {
	    	var matSimp = e.data.matSimp;
	    	var labelLocs = e.data.labelLocs;
	    	var matLine = e.data.matLine;
	    	worker.terminate();

	    	var c2 = document.getElementById("filled-canvas");
		    c2.width = width;
		    c2.height = height;

	    	// draw filled
		    // $scope.c2 = c2;
		    var ctx2 = c2.getContext("2d");
		    var imgData = matToImageData(matSimp, $scope.palette, ctx2);
		    ctx2.putImageData(imgData, 0, 0);

		    var c3 = document.getElementById("outline-canvas");
				c3.width = c2.width;
				c3.height = c2.height;

				// draw outlines
		    var bw = [{ r: 255, g: 255, b: 255 }, { r: 191, g: 191, b: 191 }];
		    // $scope.c3 = c3;
		    ctx3 = c3.getContext("2d");
		    var imgData = matToImageData(matLine, bw, ctx3);
		    ctx3.putImageData(imgData, 0, 0);

		    // draw numbers
		    ctx3.font = "12px Georgia";
		    ctx3.fillStyle = "rgb(191, 191, 191)";
		    for (i = 0; i < labelLocs.length; i++) {
		    	ctx3.fillText(labelLocs[i].value + 1, labelLocs[i].x - 3, labelLocs[i].y + 4);
		    }

		    $scope.c2 = c2;
		    $scope.c3 = c3;
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

	$scope.recolor = function() {
		$scope.step = "select";
	};

	$scope.clearPalette = function() {
		$scope.palette = [];
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

		var win=window.open();
		win.document.write('<html><head><title>PBN filled</title></head><body><img src="' + $scope.c2.toDataURL() + '"></body></html>');
		win.print();
		// win.location.reload();
	};

	$scope.saveOutline = function() {
		// var button = document.getElementById("save-outline");
		// button.href = $scope.c3.toDataURL();
		// button.download = "myPBN.png";

		var win=window.open();
		win.document.write('<html><head><title>PBN outline</title></head><body><img src="' + $scope.c3.toDataURL() + '"></body></html>');
		win.print();
		// win.location.reload();
	};

	$scope.savePalette = function() {
		var canvas = document.createElement('canvas');
		canvas.width = 80 * Math.min($scope.palette.length, 10);
		canvas.height = 80 * (Math.floor(($scope.palette.length - 1) / 10) + 1);
		ctx = canvas.getContext("2d");
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
		var win=window.open();
		win.document.write('<html><head><title>PBN palette</title></head><body><img src="' + canvas.toDataURL() + '"></body></html>');
		win.print();
		// win.location.reload();
		// button.download = "palette.png";
	};

});
