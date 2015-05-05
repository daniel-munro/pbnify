var fs     = require("fs"),
    stream = require("stream"),
    zlib   = require("zlib"),
    HEADER = new Buffer("89504e470d0a1a0a", "hex")

function ImageData(width, height, data, trailer) {
  this.width   = width
  this.height  = height
  this.data    = data
  this.trailer = trailer
}

ImageData.prototype.getPixel = function(x, y) {
  x = Math.round(x)
  y = Math.round(y)

  if(x < 0 || y < 0 || x >= this.width || y >= this.height)
    return 0

  return this.data.readUInt32BE((y * this.width + x) * 4)
}

function paeth(a, b, c) {
  var p  = a + b - c,
      pa = Math.abs(p - a),
      pb = Math.abs(p - b),
      pc = Math.abs(p - c)

  if((pa <= pb) && (pa <= pc))
    return a

  if(pb <= pc)
    return b

  return c
}

exports.parseStream = function(stream, callback) {
  var inflate           = zlib.createInflate(),
      state             = 0,
      off               = 0,
      buf               = new Buffer(13),
      waiting           = 2,
      b                 = -1,
      p                 = 0,
      pngPaletteEntries = 0,
      pngAlphaEntries   = 0,
      chunkLength, pngWidth, pngHeight, pngBitDepth, pngDepthMult,
      pngColorType, pngPixels, pngSamplesPerPixel, pngBytesPerPixel,
      pngBytesPerScanline, pngSamples, currentScanline, priorScanline,
      scanlineFilter, pngTrailer, pngPalette, pngAlpha

  function error(err) {
    /* FIXME: stream.destroy no longer exists in node 0.10. I can't actually
     * find what the right way to say "hey stream, I am no longer going to read
     * from you ever" or "hey stream, I am never going to write to you ever
     * again", so I'm really not sure what the right way to handle this is.
     *
     * I would appreciate pull requests from somebody who actually understands
     * how node streams are supposed to function. */
    if(stream.destroy)
      stream.destroy()

    if(inflate.destroy)
      inflate.destroy()

    return callback(err)
  }

  function end() {
    if(!--waiting)
      return callback(
        undefined,
        new ImageData(pngWidth, pngHeight, pngPixels, pngTrailer)
      )
  }

  stream.on("error", error)
  inflate.on("error", error)

  stream.on("end", function() {
    stream.destroy()

    if(!pngPixels)
      return error(new Error("Missing IHDR chunk. (Corrupt PNG?)"))

    if(!pngTrailer)
      return error(new Error("Missing IEND chunk. (Corrupt PNG?)"))

    return end()
  })

  inflate.on("end", function() {
    if(inflate.destroy)
      inflate.destroy()

    if(p !== pngPixels.length)
      return error(new Error("Too little pixel data! (Corrupt PNG?)"))

    return end()
  })

  stream.on("data", function(data) {
    /* If an error occurred, bail. */
    if(!stream.readable)
      return

    var len = data.length,
        i   = 0,
        tmp

    while(i !== len)
      switch(state) {
        case 0: /* PNG header */
          if(data[i++] !== HEADER[off++])
            return error(new Error("Invalid PNG header."))

          if(off === HEADER.length) {
            state = 1
            off   = 0
          }
          break

        case 1: /* PNG chunk length and type */
          if(len - i < 8 - off) {
            data.copy(buf, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(buf, off, i, i + 8 - off)

            i          += 8 - off
            off         = 0
            chunkLength = buf.readUInt32BE(0)

            switch(buf.toString("ascii", 4, 8)) {
              case "IHDR":
                state = 2
                break

              case "PLTE":
                /* The PNG spec states that PLTE is only required for type 3.
                 * It may appear in other types, but is only useful if the
                 * display does not support true color. Since we're just a data
                 * storage format, we don't have to worry about it. */
                if(pngColorType !== 3)
                  state = 7

                else {
                  if(chunkLength % 3 !== 0)
                    return error(new Error("Invalid PLTE size."))

                  pngPaletteEntries = chunkLength / 3
                  pngPalette        = new Buffer(chunkLength)
                  state             = 3
                }
                break

              case "tRNS":
                if(pngColorType !== 3)
                  return error(new Error("tRNS for non-paletted images not yet supported."))

                pngAlphaEntries = chunkLength
                pngAlpha        = new Buffer(chunkLength)
                state           = 4
                break

              case "IDAT":
                state = 5
                break

              case "IEND":
                state = 6
                break

              default:
                state = 7
                break
            }
          }
          break

        case 2: /* IHDR */
          if(chunkLength !== 13)
            return error(new Error("Invalid IHDR chunk."))

          else if(len - i < chunkLength - off) {
            data.copy(buf, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(buf, off, i, i + chunkLength - off)

            if(buf.readUInt8(10) !== 0)
              return error(new Error("Unsupported compression method."))

            if(buf.readUInt8(11) !== 0)
              return error(new Error("Unsupported filter method."))

            if(buf.readUInt8(12) !== 0)
              return error(new Error("Unsupported interlace method."))

            i           += chunkLength - off
            state        = 8
            off          = 0
            pngWidth     = buf.readUInt32BE(0)
            pngHeight    = buf.readUInt32BE(4)
            pngBitDepth  = buf.readUInt8(8)
            pngDepthMult = 255 / ((1 << pngBitDepth) - 1)
            pngColorType = buf.readUInt8(9)
            pngPixels    = new Buffer(pngWidth * pngHeight * 4)

            switch(pngColorType) {
              case 0:
                pngSamplesPerPixel = 1
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.125)
                break

              case 2:
                pngSamplesPerPixel = 3
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.375)
                break

              case 3:
                pngSamplesPerPixel = 1
                pngBytesPerPixel   = 1
                break

              case 4:
                pngSamplesPerPixel = 2
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.250)
                break

              case 6:
                pngSamplesPerPixel = 4
                pngBytesPerPixel   = Math.ceil(pngBitDepth * 0.5)
                break

              default:
                return error(
                  new Error("Unsupported color type: " + pngColorType)
                )
            }

            pngBytesPerScanline = Math.ceil(
              pngWidth * pngBitDepth * pngSamplesPerPixel * 0.125
            )
            pngSamples          = new Buffer(pngSamplesPerPixel)
            currentScanline     = new Buffer(pngBytesPerScanline)
            priorScanline       = new Buffer(pngBytesPerScanline)
            currentScanline.fill(0)
          }
          break

        case 3: /* PLTE */
          if(len - i < chunkLength - off) {
            data.copy(pngPalette, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(pngPalette, off, i, i + chunkLength - off)
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 4: /* tRNS */
          if(len - i < chunkLength - off) {
            data.copy(pngAlpha, off, i)
            off += len - i
            i    = len
          }

          else {
            data.copy(pngAlpha, off, i, i + chunkLength - off)
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 5: /* IDAT */
          /* If the amount available is less than the amount remaining, then
           * feed as much as we can to the inflator. */
          if(len - i < chunkLength - off) {
            /* FIXME: Do I need to be smart and check the return value? */
            inflate.write(data.slice(i))
            off += len - i
            i    = len
          }

          /* Otherwise, write the last bit of the data to the inflator, and
           * finish processing the chunk. */
          else {
            /* FIXME: Do I need to be smart and check the return value? */
            inflate.write(data.slice(i, i + chunkLength - off))
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 6: /* IEND */
          if(chunkLength !== 0)
            return error(new Error("Invalid IEND chunk."))

          else if(len - i < 4 - off) {
            off += len - i
            i    = len
          }

          else {
            pngTrailer = new Buffer(0)
            i         += 4 - off
            state      = 9
            off        = 0

            inflate.end()
          }
          break

        case 7: /* unrecognized chunk */
          if(len - i < chunkLength - off) {
            off += len - i
            i    = len
          }

          else {
            i    += chunkLength - off
            state = 8
            off   = 0
          }
          break

        case 8: /* chunk crc */
          /* FIXME: CRC is blatantly ignored */
          if(len - i < 4 - off) {
            off += len - i
            i    = len
          }

          else {
            i    += 4 - off
            state = 1
            off   = 0
          }
          break

        case 9: /* trailing data */
          /* FIXME: It is inefficient to create a trailer buffer of length zero
           * and keep reallocating it every time we want to add more data. */
          tmp = new Buffer(off + len - i)
          pngTrailer.copy(tmp)
          data.copy(tmp, off, i, len)
          pngTrailer = tmp
          off       += len - i
          i          = len
          break
      }
  })

  inflate.on("data", function(data) {
    /* If an error occurred, bail. */
    if(!inflate.readable)
      return

    var len = data.length,
        i, tmp, x, j, k

    for(i = 0; i !== len; ++i) {
      if(b === -1) {
        scanlineFilter  = data[i]
        tmp             = currentScanline
        currentScanline = priorScanline
        priorScanline   = tmp
      }

      else
        switch(scanlineFilter) {
          case 0:
            currentScanline[b] = data[i]
            break

          case 1:
            currentScanline[b] =
              b < pngBytesPerPixel ?
                data[i] :
                (data[i] + currentScanline[b - pngBytesPerPixel]) & 255
            break

          case 2:
            currentScanline[b] = (data[i] + priorScanline[b]) & 255
            break

          case 3:
            currentScanline[b] = (data[i] + ((
              b < pngBytesPerPixel ?
                priorScanline[b] :
                currentScanline[b - pngBytesPerPixel] + priorScanline[b]
            ) >>> 1)) & 255
            break

          case 4:
            currentScanline[b] = (data[i] + (
              b < pngBytesPerPixel ?
                priorScanline[b] :
                paeth(
                  currentScanline[b - pngBytesPerPixel],
                  priorScanline[b],
                  priorScanline[b - pngBytesPerPixel]
                )
            )) & 255
            break

          default:
            return error(
              new Error("Unsupported scanline filter: " + scanlineFilter)
            )
        }

      if(++b === pngBytesPerScanline) {
        /* One scanline too many? */
        if(p === pngPixels.length)
          return error(new Error("Too much pixel data! (Corrupt PNG?)"))

        /* We have now read a complete scanline, so unfilter it and write it
         * into the pixel array. */
        for(j = 0, x = 0; x !== pngWidth; ++x) {
          /* Read all of the samples into the sample buffer. */
          for(k = 0; k !== pngSamplesPerPixel; ++j, ++k)
            switch(pngBitDepth) {
              case 1:
                pngSamples[k] =
                  (currentScanline[(j >>> 3)] >> (7 - (j & 7))) & 1
                break

              case 2:
                pngSamples[k] =
                  (currentScanline[(j >>> 2)] >> ((3 - (j & 3)) << 1)) & 3
                break

              case 4:
                pngSamples[k] =
                  (currentScanline[(j >>> 1)] >> ((1 - (j & 1)) << 2)) & 15
                break

              case 8:
                pngSamples[k] = currentScanline[j]
                break

              default:
                return error(new Error("Unsupported bit depth: " + pngBitDepth))
            }

          /* Write the pixel based off of the samples so collected. */
          switch(pngColorType) {
            case 0:
              pngPixels[p++] =
              pngPixels[p++] =
              pngPixels[p++] = pngSamples[0] * pngDepthMult
              pngPixels[p++] = 255
              break

            case 2:
              pngPixels[p++] = pngSamples[0] * pngDepthMult
              pngPixels[p++] = pngSamples[1] * pngDepthMult
              pngPixels[p++] = pngSamples[2] * pngDepthMult
              pngPixels[p++] = 255
              break

            case 3:
              if(pngSamples[0] >= pngPaletteEntries)
                return error(new Error("Invalid palette index."))

              pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 0]
              pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 1]
              pngPixels[p++] = pngPalette[pngSamples[0] * 3 + 2]
              pngPixels[p++] =
                pngSamples[0] < pngAlphaEntries ?
                  pngAlpha[pngSamples[0]] :
                  255
              break

            case 4:
              pngPixels[p++] =
              pngPixels[p++] =
              pngPixels[p++] = pngSamples[0] * pngDepthMult
              pngPixels[p++] = pngSamples[1] * pngDepthMult
              break

            case 6:
              pngPixels[p++] = pngSamples[0] * pngDepthMult
              pngPixels[p++] = pngSamples[1] * pngDepthMult
              pngPixels[p++] = pngSamples[2] * pngDepthMult
              pngPixels[p++] = pngSamples[3] * pngDepthMult
              break
          }
        }

        b = -1
      }
    }
  })
}

exports.parseFile = function(pathname, callback) {
  return exports.parseStream(fs.createReadStream(pathname), callback)
}

exports.parseBuffer = function(buf, callback) {
  /* Create a mock stream. */
  var s = new stream.Stream()

  /* Set up the destroy functionality. */
  s.readable = true
  s.destroy  = function() { s.readable = false }

  /* Set up the PNG parsing hooks. */
  exports.parseStream(s, callback)

  /* Send the data down the stream. */
  s.emit("data", buf)

  /* If no errors occurred in the data, close the stream. */
  if(s.readable)
    s.emit("end")
}

/* FIXME: This is deprecated. Remove it in 2.0. */
exports.parse = exports.parseBuffer
