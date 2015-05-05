pngparse
========

`pngparse` is a pure-JavaScript library for [Node.JS](http://nodejs.org/) for
converting a PNG file into an array of pixel values. It came out of a need for
reading PNG images in Node.JS for the [Dark Sky
API](http://developer.darkskyapp.com/), but all existing libraries either had
compilation issues or did not support enough of the PNG standard to be
practical.

There's a reason nobody writes PNG-parsing libraries. This stuff is complicated
and reinventing the wheel is dumb. But, if you're wondering whether you can
trust it, it has a full unit test suite and we've been using it in production
since Sep 2012, so there you go.

It's reasonably complete, covering most PNG color types, depths, and filters;
notable omissions are lack of support for 16-bit images and interlacing.

Comments, bug fixes, feature improvements, etc. are all welcome. If you do
write code, please ensure that you write tests for it!

Usage
-----

To install:

    npm install pngparse

To use:

    var pngparse = require("pngparse")

    ...

    pngparse.parse(buffer, function(err, data) {
      if(err)
        throw err

      /* do things! */
    })

    ...

    pngparse.parseFile("path/to/file.png", function(err, data) {
      if(err)
        throw err

      /* do things! */
    })

The `data` object returned from the callback bears a striking resemblance to
the [HTML5 Canvas ImageData
object](https://developer.mozilla.org/en-US/docs/DOM/ImageData). The returned
image is *always* four-channel, even when the PNG under consideration is not.
