Text locator | Spencer Tipping
Licensed under the terms of the MIT source code license

# Introduction

This function takes an HTML canvas ImageData object and returns a an array of objects describing likely text coordinates. The return value looks like this:

    [{x: <integer>, y: <integer>, width: <integer>, height: <integer>, confidence: <float from 0 to 1>, color: [r, g, b]}, ...]

Text is identified in mostly-gapless lines. A gap wider than the line height is enough to separate two regions of text even if they are on the same line.

    caterwaul.offline('js_all', function () {
      recognize_text(image_data, options) = result

      -where [default_options() = {radius: 16, depth: 4},
              settings          = default_options() -se [options %k*![it[x] = options[x]] -seq],

              w = image_data.width,  h = image_data.height,

              pixel_offset(x, y) = y * h + x << 2,
              pixel_vector(x, y) = [d[o], d[o + 1], d[o + 2]] -where [d = image_data.data, o = pixel_offset(x, y)],

              luminosity_vector  = [0.2126, 0.7152, 0.0722],
              luminosity(v)      = v /-dot/ luminosity_vector,

              plus(v1, v2)       = v1    *[x + v2[xi]] -seq,
              times(v, f)        = v     *[x * f]      -seq,
              c_times(v1, v2)    = v1    *[x * v2[xi]] -seq,
              dot(v1, v2)        = v1 /[0][x * v2[xi]] -seq]});

# Recognition algorithm

The idea here is to use a few heuristics to pick out likely candidates for text. Text has the following characteristics:

    1. Density of text pixels is low, but text regions tend to be noisy.
    2. Text pixels are always the same color as one another.
    3. Text does not impact the color of the background beyond antialiasing artifacts.
    4. Noise level changes tend to have high locality.

We can identify text boundaries using a sweeping-line design. We are looking for local changes in the amount of noise. Longer lines will be able to detect larger fonts; this is a customizable
parameter called 'radius'. The default size of 16 should be able to detect text up to about 32px.

The sweeping line design involves using a 1xN-pixel window that slides perpendicularly to its axis. This window records the text-likelihood delta per pixel, which provides the data necessary
to identify text regions.

    Window moves this way ->    +---+
                             x11|x12|x13 x14 x15 x16 ...
                                |   |
                             x21|x22|x23 x24 x25 x26 ...
                                |   |
                             ...|...|
                                |   |
                             x81|x82|x83 x84 x85 x86 ...
                                +---+
                             x91 x92 x93 x94 x95 x96 ...
                             ...

The window provides several different kinds of values:

    1. Delta history for each pixel (history size is variable using the 'depth' option, which defaults to 4).
    2. Cross-pixel covariance of deltas.
    3. Average value of all pixels within the window.
    4. Variance of all pixels within the window.

All of these vectors are specified as color vectors that will later be unified under a luminosity function. We need to preserve color components to detect uniformity of color as well as of
luminosity. In particular, text has the property that the deltas are unlikely to be highly covariant, but most of the covariance should be in the same color direction. (This property can be
verified using the dot product.) The text likelihood is computed by this formula:

           L(V) + σ(d[0]) · σ(d[1])           V      = variance of pixels within window (color vector)
    text = ------------------------           A      = average of pixels within window (color vector)
            L(A) + cov[0] · cov[1]            L(x)   = luminosity of color vector x
                                              σ(v)   = average of values in array v
                                              d[n]   = nth-most-recent per-pixel delta array (each element is a color delta)
                                              cov[n] = nth-most-recent cross-pixel covariance factor, as a color vector