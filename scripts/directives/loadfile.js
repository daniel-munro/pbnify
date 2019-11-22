/**
 * @license
 * Copyright Dan Munro
 * Released under Expat license <https://directory.fsf.org/wiki/License:Expat>
 */

'use strict';

/**
 * @ngdoc directive
 * @name pbnApp.directive:loadFile
 * @description
 * # loadFile
 */
angular.module('pbnApp')
    .directive('loadFile', function () {
	return {
	    restrict: 'A',
	    scope: {
		imageLoaded: '&'
	    },
	    link: function(scope, elem, attr) {
		elem = elem[0];
		elem.ondragover = function() {
		    elem.style.border = "4px dashed black";
		    
		    return false;
		};
		elem.ondragleave = function() {
		    elem.style.border = "4px dashed #777777";
		    
		    return false;
		};
		elem.ondrop = function (e) {
		    e.preventDefault();
		    
		    var file = e.dataTransfer.files[0];
		    var reader = new FileReader();
		    reader.onloadend = function (event) {
			scope.imageLoaded({img: event.target.result});
			scope.$apply();
		    };
		    reader.readAsDataURL(file);
		    elem.style.border = "4px dashed gray";
		    
		    return false;
		};
		
		var fileInput = document.getElementById('fileBrowser');
		fileInput.addEventListener('change', function(e) {
		    var file = fileInput.files[0];
		    if (file.type.match(/image.*/)) {
			var reader = new FileReader();
			reader.onloadend = function(event) {
			    scope.imageLoaded({img: event.target.result});
			    scope.$apply();
			};
			reader.readAsDataURL(file);
		    } else {
			alert("wrong file format");
		    }
		});
	    }
	};
    });
