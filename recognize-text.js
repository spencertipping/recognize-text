(function() {
  recognize_text = function(image_data, options) {;
    return (function() {
      var default_options = function() {;
          return {
            radius: 16,
            depth: 4
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
        plus = function(v1, v2) {;
          return (function(xs) {
            var x, x0, xi, xl, xr;
            for (var xr = new xs.constructor(), xi = 0, xl = xs.length; xi < xl; ++xi) x = xs[xi], xr.push((x + v2[xi]));
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
        };
      return result
    }).call(this)
  }
})();
