Text locator | Spencer Tipping
Licensed under the terms of the MIT source code license

# Introduction

This function takes an HTML canvas ImageData object and returns a an array of objects describing likely text coordinates. The return value looks like this:

    [{x: <integer>, y: <integer>, width: <integer>, height: <integer>, confidence: <float from 0 to 1>, color: [r, g, b]}, ...]

Text is identified in mostly-gapless lines. A gap wider than the line height is enough to separate two regions of text even if they are on the same line.

    caterwaul.offline('js_all', function () {
      recognize_text(image_data, options) = result

      -where [default_options() = {radius: 4},
              settings          = default_options() -se [options %k*![it[x] = options[x]] -seq -when.options],

              w = image_data.width,
              h = image_data.height,

              pixel_offset(x, y) = y * w + x << 2,
              pixel_vector(x, y) = [d[o], d[o + 1], d[o + 2]] -where [d = image_data.data, o = pixel_offset(x, y)],

              luminosity_vector  = [0.2126, 0.7152, 0.0722],
              luminosity(v)      = v /-dot/ luminosity_vector,

              squared(x)         = x * x,

              zero               = [0, 0, 0],
              plus(v1, v2)       = v1         *[x + v2[xi]] -seq,
              minus(v1, v2)      = v1         *[x - v2[xi]] -seq,
              times(v, f)        = v          *[x * f]      -seq,
              c_times(v1, v2)    = v1         *[x * v2[xi]] -seq,
              dot(v1, v2)        = v1 /[0][x0 + x * v2[xi]] -seq,

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

Windows provide two color-vector aggregates:

    1. Average value of all pixels within the window.
    2. Variance of all pixels within the window.

All of these vectors are specified as color vectors that will later be unified under a luminosity function. We need to preserve color components to detect uniformity of color as well as of
luminosity. Given three adjacent windows w1, w2, and w3, this is the likelihood that the region is made up of text:

             |dv1 · dv2|        |L(da1) - L(da2)|     dv1 = variance(window 2) - variance(window 1)   [vector]
    l = --------------------- * -----------------     dv2 = variance(window 3) - variance(window 2)   [vector]
        1 + |L(dv1) * L(dv2)|   1 + (da1 · da2)^2     da1 = average(window 2)  - average(window 1)    [vector]
                                                      da2 = average(window 3)  - average(window 2)    [vector]
                                                      L(v) = luminosity of vector                     [scalar]

The first fraction is variance-bound and the second is average-bound. We're looking for places where the average color luminosity does not change much, but the variance does. Text is highly
nonrepetitive from one pixel to another, but often preserves the absolute brightness.

              likelihood(w1, w2, w3) = variance_fraction * average_fraction
                                       -where [d1                   = w2 /-d_window/ w1,
                                               d2                   = w3 /-d_window/ w2,

                                               variance_numerator   = d1.d_variance /-dot/ d2.d_variance /!Math.abs,
                                               variance_denominator = 1 + luminosity(d1.d_variance) * luminosity(d2.d_variance) /!Math.abs,
                                               variance_fraction    = variance_numerator / variance_denominator,

                                               average_numerator    = Math.abs(luminosity(d1.d_average) - luminosity(d2.d_average)),
                                               average_denominator  = 1 + d1.d_average /-dot/ d2.d_average /!squared,
                                               average_fraction     = average_numerator / average_denominator],

              // Easy optimization: memoize this function
              window(x, y, w, h)     = wcapture [pixels   = pixels_in(x, y, w, h),
                                                 average  = pixels /[zero][x0 /-plus/ x] -seq -re- it /-times/ (1 / pixels.length),
                                                 variance = pixels /[zero][x0 |-plus| x /-c_times/ x] -seq |-minus| average /-c_times/ average],

              d_window(w1, w2)       = wcapture [d_average  = w1.average  /-minus/ w2.average,
                                                 d_variance = w1.variance /-minus/ w2.variance],

              pixels_in(x, y, w, h)  = n[x, x + w] *~![n[y, y + h] *y[pixel_vector(x, y)] -seq] -seq,
              clip_confidences(xs)   = xs *![x.confidence = Math.max(x.confidence, 1) /!Math.log] -seq -then-
                                       xs *![x.confidence /= maximum] /seq /where [maximum = xs /[0][x0 /-Math.max/ x.confidence] -seq],
              // Test result:
              result                 = clip_confidences(n[4, w] *~![n[0, h - settings.radius]
                                                        *y[{x: x, y: y, w: 1, h: 1, confidence: likelihood(window(x - 4, y, 3, settings.radius),
                                                                                                           window(x - 2, y, 3, settings.radius),
                                                                                                           window(x,     y, 3, settings.radius))}] -seq] -seq)]});