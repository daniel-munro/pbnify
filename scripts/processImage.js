/**
 * @license
 * Copyright Dan Munro
 * Released under Expat license <https://directory.fsf.org/wiki/License:Expat>
 */

'use strict';

importScripts('lodash.js');

var getVicinVals = function(mat, x, y, range) {	// range is how many pixels on each side to get
    var width = mat[0].length;
    var height = mat.length;
    var vicinVals = [];
    for (var xx = x - range; xx <= x + range; xx++) {
	for (var yy = y - range; yy <= y + range; yy++) {
	    if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
		vicinVals.push(mat[yy][xx]);
	    }
	}
    }
    return vicinVals;
};

var smooth = function(mat) {
    var width = mat[0].length;
    var height = mat.length;
    var simp = [];
    for (var i = 0; i < height; i++) {
	simp[i] = new Array(width);
    }
    for (var y = 0; y < height; y++) {
	for (var x = 0; x < width; x++) {
	    var vicinVals = getVicinVals(mat, x, y, 4);
	    simp[y][x] = Number(_.chain(vicinVals).countBy().toPairs().maxBy(_.last).head().value());
	}
    }
    return simp;
};

var neighborsSame = function(mat, x, y) {
    var width = mat[0].length;
    var height = mat.length;
    var val = mat[y][x];
    // var xRel = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
    // var yRel = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
    // var xRel = [0, -1, 1, 0];
    // var yRel = [-1, 0, 0, 1];
    var xRel = [1, 0];
    var yRel = [0, 1];
    for (var i = 0; i < xRel.length; i++) {
	var xx = x + xRel[i];
	var yy = y + yRel[i];
	if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
	    if (mat[yy][xx] != val) {
		return false;
	    }
	}
    }
    return true;
};

var outline = function(mat) {
    var width = mat[0].length;
    var height = mat.length;
    var line = [];
    for (var i = 0; i < height; i++) {
	line[i] = new Array(width);
    }
    for (var y = 0; y < height; y++) {
	for (var x = 0; x < width; x++) {
	    line[y][x] = neighborsSame(mat, x, y) ? 0 : 1;
	}
    }
    return line;
};

var getRegion = function(mat, cov, x, y) {
    var covered = _.cloneDeep(cov);
    var region = { value: mat[y][x], x: [], y: [] };
    // var covered = [];
    //	 for (var i = 0; i < height; i++) { // where does height come from?
    //	 	covered[i] = new Array(width);
    //	 	_.fill(covered[i], false);
    //	 }
    var value = mat[y][x];

    // var check = function(x, y) {
    // 	if (mat[y][x] == value && covered[y][x] == false) {
    // 		covered[y][x] = true;
    // 		region.x.push(x);
    // 		region.y.push(y);
    // 		if (x > 0) { check(x - 1, y); }
    // 		if (x < mat[0].length - 1) { check(x + 1, y); }
    // 		if (y > 0) { check(x, y - 1); }
    // 		if (y < mat.length - 1) { check(x, y + 1); }
    // 	}
    // };
    // check(x, y);

    var queue = [[x, y]];
    while (queue.length > 0) {
	var coord = queue.shift();
	if (covered[coord[1]][coord[0]] == false && mat[coord[1]][coord[0]] == value) {
	    region.x.push(coord[0]);
	    region.y.push(coord[1]);
	    covered[coord[1]][coord[0]] = true;
	    if (coord[0] > 0) { queue.push([coord[0] - 1, coord[1]]); }
	    if (coord[0] < mat[0].length - 1) { queue.push([coord[0] + 1, coord[1]]); }
	    if (coord[1] > 0) { queue.push([coord[0], coord[1] - 1]); }
	    if (coord[1] < mat.length - 1) { queue.push([coord[0], coord[1] + 1]); }
	}
    }

    return region;
};

var coverRegion = function(covered, region) {
    for (var i = 0; i < region.x.length; i++) {
	covered[region.y[i]][region.x[i]] = true;
    }
};

var sameCount = function(mat, x, y, incX, incY) {
    var value = mat[y][x];
    var count = -1;
    while (x >= 0 && x < mat[0].length && y >= 0 && y < mat.length && mat[y][x] == value) {
	count++;
	x += incX;
	y += incY;
    }
    return count;
};

var getLabelLoc = function(mat, region) {
    var bestI = 0;
    var best = 0;
    for (var i = 0; i < region.x.length; i++) {
	var goodness = sameCount(mat, region.x[i], region.y[i], -1, 0) * 
	    sameCount(mat, region.x[i], region.y[i], 1, 0) *
	    sameCount(mat, region.x[i], region.y[i], 0, -1) *
	    sameCount(mat, region.x[i], region.y[i], 0, 1);
	if (goodness > best) {
	    best = goodness;
	    bestI = i;
	}
    }
    return {
	value: region.value,
	x: region.x[bestI],
	y: region.y[bestI]
    };
};

var getBelowValue = function(mat, region) {
    var x = region.x[0];
    var y = region.y[0];
    while (mat[y][x] == region.value) {
	y++;
    }
    return mat[y][x];
};

var removeRegion = function(mat, region) {
    if (region.y[0] > 0) {
	var newValue = mat[region.y[0] - 1][region.x[0]];	// assumes first pixel in list is topmost then leftmost of region.
    } else {
	var newValue = getBelowValue(mat, region);
    }
    for (var i = 0; i < region.x.length; i++) {
	mat[region.y[i]][region.x[i]] = newValue;
    }
};

var getLabelLocs = function(mat) {
    var width = mat[0].length;
    var height = mat.length;
    var covered = [];
    for (var i = 0; i < height; i++) {
	covered[i] = new Array(width);
	_.fill(covered[i], false);
    }
    var labelLocs = [];
    for (var y = 0; y < height; y++) {
	for (var x = 0; x < width; x++) {
	    if (covered[y][x] == false) {
		var region = getRegion(mat, covered, x, y);
		coverRegion(covered, region);
		if (region.x.length > 100) {
		    labelLocs.push(getLabelLoc(mat, region));
		} else {
		    removeRegion(mat, region);
		}
	    }
	}
    }
    return labelLocs;
};

self.addEventListener('message', function(e) {
    self.postMessage({
	cmd: "status",
	status: "smoothing edges..."
    });
    var matSmooth = smooth(e.data.mat);
    self.postMessage({
	cmd: "status",
	status: "identifying color regions..."
    });
    var labelLocs = getLabelLocs(matSmooth);
    self.postMessage({
	cmd: "status",
	status: "drawing outline..."
    });
    var matLine = outline(matSmooth);
    self.postMessage({
	cmd: "result",
	matSmooth: matSmooth,
	labelLocs: labelLocs,
	matLine: matLine
    });
}, false);
