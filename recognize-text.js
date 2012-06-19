// Text locator | Spencer Tipping
// Licensed under the terms of the MIT source code license

// Introduction.
// This file implements a text recognition algorithm. The goal is to identify
// rectangular lines of text within an image, provided a few assumptions are met:

// | 1. The background color is generally consistent.
//   2. The text is a solid color and contains little noise.
//   3. The text is arranged into lines and is not tilted.

// The algorithm is based on identifying lines of consistent widths, which should
// work well for most fonts. This is done by choosing evenly-spaced points
// throughout the image and scanning horizontal and vertical rays emanating from
// those points. Each ray is then categorized with a 'text representation vector'
// array -- this describes the color, distance, and cross-sectional length of each
// variant segment encountered.

// Here's where it gets interesting. We then collect the variant-segment colors and
// try to identify convex regions of the image this way. These convex regions can
// be bounded by rectangles, at which point the problem is solved.

// Point selection and rays.
// We don't want the algorithm to take too long or consume too much memory, so not
// every pixel is sampled. It's more important to cover a fine grid vertically than
// horizontally since we're looking for lines of text rather than words.

// Each point has a total of eight rays: two vertical, two horizontal, and four
// diagonal. These rays give hints about where text is located. For example, empty
// text representation vectors on the horizontal rays with dense representation
// vectors on the vertical rays indicates that the point is probably between lines.
// Samples on the diagonal vectors only could indicate the corner of a rectangle.

var recognize_text = function (image_data, options) {
  // Pull out some invariant parts of the image data.
  var w = image_data.width, h = image_data.height, d = image_data.data;

  var r_bias = 0.2126 / 768.0,
      g_bias = 0.7152 / 768.0,
      b_bias = 0.0722 / 768.0;

  var luminosity = function (x, y) {
    var offset = y * w + x << 2;
    return d[offset]     * r_bias +
           d[offset + 1] * g_bias +
           d[offset + 2] * b_bias;
  };

  // Process options and cache as locals.
  var horizontal_spacing = options && options.horizontal_spacing || 8;
  var vertical_spacing   = options && options.vertical_spacing   || 4;
  var horizontal_limit   = w / horizontal_spacing >>> 0;

  var ray_length         = options && options.ray_length   || 8;
  var ray_interval       = options && options.ray_interval || 2;

  // Create the array of points and begin adding variance data to each one.
  var points = [];
  for (var x = ray_length; x < w - ray_length; x += horizontal_spacing)
    for (var y = ray_length; y < h - ray_length; y += vertical_spacing)
      points.push({x: x, y: y, rays: [[], [], [], [],
                                      [], [], [], []]});

  // Go through each point and sample the rays. We're looking for cases where
  // the colors momentarily deviate but then return. The moment strength is
  // defined as the degree of variance per pixel; that is, normalized per unit
  // distance. This amounts to taking a sort of integral with respect to the
  // average:
  //
  //     .......
  //    ..A BB ..
  // __.._______..____.........__________       <- average
  // ...         ......       ...........       <- signal
  //
  // | 1| 2| 3| 4| 5|                           <- pixel boundaries
  //
  // In this example, A is summed into pixel 1, B into pixel 2, etc. Pixels 1
  // and 2 are joined because they are equivalent relative to the average; but
  // when they are joined, their values are averaged over the area rather than
  // summed. They end up forming a discrete region that is then added into the
  // array of text representation segments.
  var hv_ratio = horizontal_spacing / vertical_spacing;
  var ray_directions = [[0,  1], [ 1,  1], [ 1, 0], [ 1, -1],
                        [0, -1], [-1, -1], [-1, 0], [-1,  1]];

  var ray_distances = [1, Math.sqrt(2)];

  var ray = [];
  for (var i = 0, l = points.length, p; i < l; ++i) {
    p = points[i];
    x = p.x;
    y = p.y;

    // Do a ray analysis in each direction and store the results into the
    // point's ray data.
    for (var j = 0, lj = ray_directions.length; ++j) {
      var ray_distance = ray_distances[j & 1];
      var dx = ray_directions[j][0] / ray_distance * ray_interval;
      var dy = ray_directions[j][1] / ray_distance * ray_interval;

      // Gather the points along the ray. No bounds-checking is necessary
      // because all of the points are known to be at least ray_length away from
      // any edge.
      for (var d = 0, total = 0; d < ray_length; ++d)
        total += ray[d] = luminosity(x + d * dx >>> 0, y + d * dy >>> 0);

      // Now find places where individual values cross the average. Sum until we
      // hit an edge, at which point we start over.
      var average     = total / ray_length;
      var subtotal    = 0;
      var subdistance = 0;

      for (var d = 0; d < ray_length; ++d)
        // Any sample that opposes the current direction of the subtotal marks
        // an edge. When we see this, we grab the current subtotal, divided by
        // the distance it represents, and start a new sample.
        if (d > 0 && subtotal - average >= 0 ^ ray[d] - average >= 0)
          subtotal += ray[d] - average,
          ++subdistance;
        else
          p.rays[d].push({value:    subtotal / subdistance,
                          position: d,
                          length:   subdistance}),
          subtotal    = ray[d] - average,
          subdistance = 1;

      // Note that we don't collect the last sample if it is incomplete. It
      // needs to cross the average both ways so we can determine its distance.
    }
  }

  // Now we have all of the ray data we need. At this point we should be able to
  // use some heuristics to identify line boundaries and horizontal text edges.

  // TODO: finish this
  return [];
};

// Generated by SDoc 
