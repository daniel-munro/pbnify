/**
 * @license
 * Copyright Dan Munro
 * Released under Expat license <https://directory.fsf.org/wiki/License:Expat>
 */

'use strict';

/**
 * @ngdoc directive
 * @name pbnApp.directive:stage
 * @description
 * # stage
 */
angular.module('pbnApp')
    .directive('stage', function () {
	return {
	    restrict: 'A',
	    link: function(scope, elem, attr) {
		var canvas = elem[0];
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
