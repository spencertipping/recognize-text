(function() {
  recognize_text = function(image_data, options) {;
    return (function() {
      var default_options = function() {;
          return {
            radius: 16
          }
        },
        settings = (function(it) {
          return options && (function(xs) {
            var x, x0, xi, xl, xr;
            for (var x in xs) if (Object.prototype.hasOwnProperty.call(xs, x)) it[x] = options[x];
            return xs
          }).call(this, options), it
        }).call(this, (default_options())),
        w = image_data.width,
        h = image_data.height,
        pixel_offset = function(x, y) {;
          return y * w + x << 2
        },
        pixel_vector = function(x, y) {;
          return (function() {
            var d = image_data.data,
              o = pixel_offset(x, y);
            return [d[o], d[o + 1], d[o + 2]]
          }).call(this)
        },
        luminosity_vector = [0.2126, 0.7152, 0.0722],
        luminosity = function(v) {;
          return dot(v, luminosity_vector)
        },
        squared = function(x) {;
          return x * x
        },
        zero = [0, 0, 0],
        plus = function(v1, v2) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((x + v2[xi]));
            return xr
          }).call(this, v1)
        },
        minus = function(v1, v2) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((x - v2[xi]));
            return xr
          }).call(this, v1)
        },
        times = function(v, f) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((x * f));
            return xr
          }).call(this, v)
        },
        c_times = function(v1, v2) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((x * v2[xi]));
            return xr
          }).call(this, v1)
        },
        dot = function(v1, v2) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var x0 = (0), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (x0 + x * v2[xi]);
            return x0
          }).call(this, v1)
        },
        likelihood = function(w1, w2, w3) {;
          return (function() {
            var d1 = d_window(w2, w1),
              d2 = d_window(w3, w2),
              variance_numerator = Math.abs(dot(d1.d_variance, d2.d_variance)),
              variance_denominator = 1 + Math.abs(luminosity(d1.d_variance) * luminosity(d2.d_variance)),
              variance_fraction = variance_numerator / variance_denominator,
              average_numerator = Math.abs(luminosity(d1.d_average) - luminosity(d2.d_average)),
              average_denominator = 1 + squared(dot(d1.d_average, d2.d_average)),
              average_fraction = average_numerator / average_denominator;
            return variance_fraction * average_fraction
          }).call(this)
        },
        window = function(x, y, w, h) {;
          return (function() {
            var pixels = pixels_in(x, y, w, h),
              average = (function(it) {
                return times(it, (1 / pixels.length))
              }).call(this, ((function(xs) {
                var x, x0, xi, xl, xr;
                for (var x0 = (zero), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (plus(x0, x));
                return x0
              }).call(this, pixels))),
              variance = minus((function(xs) {
                var x, x0, xi, xl, xr;
                for (var x0 = (zero), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (plus(x0, c_times(x, x)));
                return x0
              }).call(this, pixels), c_times(average, average));
            return {
              pixels: pixels,
              average: average,
              variance: variance
            }
          }).call(this)
        },
        d_window = function(w1, w2) {;
          return (function() {
            var d_average = minus(w1.average, w2.average),
              d_variance = minus(w1.variance, w2.variance);
            return {
              d_average: d_average,
              d_variance: d_variance
            }
          }).call(this)
        },
        pixels_in = function(x, y, w, h) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push.apply(xr, Array.prototype.slice.call(((function(ys) {
              var y, y0, yi, yl, yr;
              for (var yr = new ys.constructor(), yi = 0, yl = ys.length; yi < yl; ++yi) y = ys[yi], yr.push((pixel_vector(x, y)));
              return yr
            }).call(this, (function(i, u, s) {
              if ((u - i) * s <= 0) return [];
              for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
              return r
            })((y), (y + h), (1))))));
            return xr
          }).call(this, (function(i, u, s) {
            if ((u - i) * s <= 0) return [];
            for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
            return r
          })((x), (x + w), (1)))
        },
        clip_confidences = function(xs) {;
          return ((function(xs) {
            var x, x0, xi, xl, xr;
            for (var xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], (x.confidence = Math.log(Math.max(x.confidence, 1)));
            return xs
          }).call(this, xs), (function() {
            var maximum = (function(xs) {
              var x, x0, xi, xl, xr;
              for (var x0 = (0), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (Math.max(x0, x.confidence));
              return x0
            }).call(this, xs);
            return (function(xs) {
              var x, x0, xi, xl, xr;
              for (var xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], (x.confidence /= maximum);
              return xs
            }).call(this, xs)
          }).call(this))
        },
        result = clip_confidences((function(xs) {
          var x, x0, xi, xl, xr;
          for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push.apply(xr, Array.prototype.slice.call(((function(ys) {
            var y, y0, yi, yl, yr;
            for (var yr = new ys.constructor(), yi = 0, yl = ys.length; yi < yl; ++yi) y = ys[yi], yr.push(({
              x: x,
              y: y,
              w: 1,
              h: 1,
              confidence: likelihood(window(x - 5, y, 5, 5), window(x, y, 5, 5), window(x + 5, y, 5, 5))
            }));
            return yr
          }).call(this, (function(i, u, s) {
            if ((u - i) * s <= 0) return [];
            for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
            return r
          })((10), (h - settings.radius), (2))))));
          return xr
        }).call(this, (function(i, u, s) {
          if ((u - i) * s <= 0) return [];
          for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
          return r
        })((15), (w - settings.radius), (2))));
      return result
    }).call(this)
  }
})();
