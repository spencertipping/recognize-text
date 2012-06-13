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
          return y * h + x << 2
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
            for (var x0 = (0), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (x * v2[xi]);
            return x0
          }).call(this, v1)
        },
        likelihood = function(w1, w2) {;
          return (function() {
            var top_term = squared(luminosity(d.d_variance)) + dot(vector_mean(w1.deltas), vector_mean(w2.deltas)),
              bottom_term = squared(luminosity(d.d_average)) + 1;
            return top_term / bottom_term
          }).call(this)
        },
        window = function(x, y, w, h) {;
          return (function() {
            var x = x,
              y = y,
              w = w,
              h = h,
              pixels = pixels_in(x, y, w, h),
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
              x: x,
              y: y,
              w: w,
              h: h,
              pixels: pixels,
              average: average,
              variance: variance
            }
          }).call(this)
        },
        d_window = function(w1, w2) {;
          return (function() {
            var deltas = (function(xs) {
              var x, x0, xi, xl, xr;
              for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((minus(x, w2.pixels[xi])));
              return xr
            }).call(this, w1.pixels),
              d_average = minus(w1.average, w2.average),
              d_variance = minus(w1.variance, w2.variance);
            return {
              deltas: deltas,
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
        vector_mean = function(xs) {;
          return (function(it) {
            return times(it, (1 / xs.length))
          }).call(this, ((function(xs) {
            var x, x0, xi, xl, xr;
            for (var x0 = (zero), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], x0 = (plus(x0, x));
            return x0
          }).call(this, xs)))
        },
        result = (function(xs) {
          var x, x0, xi, xl, xr;
          for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push.apply(xr, Array.prototype.slice.call(((function(ys) {
            var y, y0, yi, yl, yr;
            for (var yr = new ys.constructor(), yi = 0, yl = ys.length; yi < yl; ++yi) y = ys[yi], yr.push(({
              x: x,
              y: y,
              w: 1,
              h: 1,
              confidence: likelihood(window(x - 1, y, 1, settings.radius), window(x, y, 1, settings.radius))
            }));
            return yr
          }).call(this, (function(i, u, s) {
            if ((u - i) * s <= 0) return [];
            for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
            return r
          })((0), (h - settings.radius), (1))))));
          return xr
        }).call(this, (function(i, u, s) {
          if ((u - i) * s <= 0) return [];
          for (var r = [], d = u - i; d > 0 ? i < u : i > u; i += s) r.push(i);
          return r
        })((1), (w), (1)));
      return result
    }).call(this)
  }
})();
