angular.module('pbn', [])
	.controller('pbnCtrl', function($scope) {
		// $scope.getFile = function() {
		// 	$s
		// }
		// $scope.loaded = false;
		$scope.step = "load";
		$scope.view = "";
		$scope.status = "";
		$scope.holderStyle = {
			border: "4px dashed gray"
		};
		$scope.palette = [];

		$scope.imageLoaded = function(imgSrc) {
			// $scope.loaded = true;
			// alert('loaded');
			var img = new Image();
			img.src = imgSrc;
			var c = document.getElementById("img-canvas");
	    // c.width = img.width;
	    // c.height = img.height;
	    c.width = 800;
	    var scale = c.width / img.naturalWidth;
	    c.height = img.naturalHeight * scale;

	    document.getElementById("canvases").style.height = c.height + "px";

	    $scope.c = c;
	    $scope.ctx = c.getContext("2d");
	    $scope.ctx.drawImage(img, 0, 0, c.width, c.height);
	    $scope.step = "select";
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

		var matToImageData = function(mat, palette, context) {
			var imgData = context.createImageData(mat[0].length, mat.length);
			// console.log(imgData);
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
	    var mat = [];
	    for (var i = 0; i < height; i++) {
	    	mat[i] = new Array(width);
	    }
	    for (var i = 0; i < imgData.data.length; i += 4) {
	    	var nearestI = getNearest($scope.palette, {
	    		r: imgData.data[i],
	    		g: imgData.data[i + 1],
	    		b: imgData.data[i + 2]
	    	});
	    	var nearest = $scope.palette[nearestI];
	    	imgData.data[i] = nearest.r;
	    	imgData.data[i + 1] = nearest.g;
	    	imgData.data[i + 2] = nearest.b;
	    	var x = (i / 4) % width;
				var y = Math.floor((i / 4) / width);
				mat[y][x] = nearestI;
	    }

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


			    $scope.c2 = c2;
			    $scope.ctx2 = c2.getContext("2d");
			    imgData = matToImageData(matSimp, $scope.palette, $scope.ctx2);
			    // console.log(imgData);

			    $scope.ctx2.putImageData(imgData, 0, 0);
			    $scope.mat = mat;
			    $scope.matSimp = matSimp;
			    $scope.step = "result";
			    $scope.view = "filled";

			    var c3 = document.getElementById("outline-canvas");
					c3.width = $scope.c2.width;
					c3.height = $scope.c2.height;

			    var bw = [{ r: 255, g: 255, b: 255 }, { r: 191, g: 191, b: 191 }];
			    $scope.c3 = c3;
			    $scope.ctx3 = c3.getContext("2d");
			    var imgData = matToImageData(matLine, bw, $scope.ctx3);
			    $scope.ctx3.putImageData(imgData, 0, 0);
			    $scope.matLine = matLine;
			    // $scope.step = "result";

			    $scope.ctx3.font = "12px Georgia";
			    $scope.ctx3.fillStyle = "rgb(191, 191, 191)";
			    for (i = 0; i < labelLocs.length; i++) {
			    	$scope.ctx3.fillText(labelLocs[i].value + 1, labelLocs[i].x - 3, labelLocs[i].y + 4);
			    }

			 		$scope.$apply();
			 	}
	    }, false);
	    worker.postMessage({ mat: mat });
		};

		$scope.viewFilled = function() {
			$scope.view = "filled";
		};

		$scope.viewOutline = function() {
			$scope.view = "outline";
		};

		$scope.saveFilled = function() {
			var button = document.getElementById("save-filled");
			button.href = $scope.c2.toDataURL();
			button.download = "myPBN.png";
		};

		$scope.saveOutline = function() {
			var button = document.getElementById("save-outline");
			button.href = $scope.c3.toDataURL();
			button.download = "myPBN.png";
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
				ctx.fillText(i + 1, x + 20, y + 25);
				ctx.strokeRect(x + 10, y + 10, 60, 60);
			}

			var button = document.getElementById("save-palette");
			button.href = canvas.toDataURL();
			button.download = "palette.png";
		};

		$scope.recolor = function() {
			$scope.step = "select";
		};

		$scope.newImage = function() {
			$scope.palette = [];
			$scope.step = "load";
		};

		$scope.clearPalette = function() {
			$scope.palette = [];
		};

		$scope.loadChosenFile = function() {
			var file = document.getElementById('file').files[0];
			var reader = new FileReader();
			reader.onload = function(event) {
				$scope.imageLoaded({img: event.target.result});
				$scope.$apply();
			};
			console.log(file);
			reader.readAsDataURL(file);
		};

		var fileInput = document.getElementById('file');
		fileInput.addEventListener('change', function(e) {
			var file = fileInput.files[0];
			if (file.type.match(/image.*/)) {
				var reader = new FileReader();
				reader.onload = function(e) {
					$scope.imageLoaded({img: reader.result});
					$scope.$apply();
				};
				reader.readAsDataURL(file);
			} else {
				alert("wrong file format");
			}
		});

	})
	.directive('loadFile', function() {
		return {
			restrict: 'A',
			scope: {
				imageLoaded: '&'//,
				// holderStyle: '=',
				// loaded: '='
			},
			link: function(scope, elem, attr) {
				// var holder = document.getElementById('holder');
				elem = elem[0];
				elem.ondragover = function() {
					// this.className = 'hover';
					// scope.holderStyle = {
					// 	border: "4px dashed black"
					// };
					// scope.$apply();
					elem.style.border = "4px dashed black";

					return false;
				};
				elem.ondragleave = function() {
					// scope.holderStyle = {
					// 	border: "4px dashed gray"
					// }
					// scope.$apply();
					elem.style.border = "4px dashed gray";

					return false;
				};
				elem.ondrop = function (e) {
				  // this.className = '';
				  e.preventDefault();

				  var file = e.dataTransfer.files[0];
				  var reader = new FileReader();
				  reader.onload = function (event) {
				    // console.log(event.target);
				    // scope.loaded = true;
				    // holder.style.background = 'url(' + event.target.result + ') no-repeat center';
				    // var img = new Image();
				    // img.src = event.target.result;
				    scope.imageLoaded({img: event.target.result});
				    scope.$apply();
				  };
				  console.log(file);
				  reader.readAsDataURL(file);
					elem.style.border = "4px dashed gray";

				  return false;
				};
			}
		};
	})
	.directive('stage', function() {
		return {
			restrict: 'A',
			link: function(scope, elem, attr) {
				// var holder = document.getElementById('holder');
				canvas = elem[0];
				canvas.addEventListener('click', function(event) {
					if (scope.step == 'select') {
						var rect = canvas.getBoundingClientRect();
						var x = event.clientX - rect.left;
						var y = event.clientY - rect.top;

						var pixels = { r: [], g: [], b: [] };
						for (var xNear = x - 3; xNear <= x + 3; xNear ++) {
							for (var yNear = y - 3; yNear <= y + 3; yNear ++) {
								var pixel = scope.ctx.getImageData(xNear, yNear, 1, 1).data;
								pixels.r.push(pixel[0]);
								pixels.g.push(pixel[1]);
								pixels.b.push(pixel[2]);
							}
						}
						// var pixel = scope.ctx.getImageData(x, y, 1, 1).data;
						// var color = {
						// 	r: pixel[0],
						// 	g: pixel[1],
						// 	b: pixel[2]
						// };
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
						scope.addColor(color);
						scope.$apply();
					}
				});
			}
		};
	});
	// .directive("ngFileSelect", function() {
	// 	return {
	// 		link: function($scope, el) {
	// 			el.bind("change", function(e) {
	// 				$scope.file = (e.srcElement || e.target).files[0];
	// 				$scope.getFile();
	// 			});
	// 		}
	// 	}
	// });