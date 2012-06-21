Text locator | Spencer Tipping
Licensed under the terms of the MIT source code license

# Introduction

This file implements a text recognition algorithm. The goal is to identify
rectangular lines of text within an image, provided a few assumptions are met:

    1. The background color is generally consistent.
    2. The text is a solid color and contains little noise.
    3. The text is arranged into lines and is not tilted.

The algorithm is based on identifying lines of consistent widths, which should
work well for most fonts. This is done by choosing evenly-spaced points
throughout the image and scanning horizontal and vertical rays emanating from
those points. Each ray is then categorized with a 'text representation vector'
array -- this describes the color, distance, and cross-sectional length of each
variant segment encountered.

Here's where it gets interesting. We then collect the variant-segment colors and
try to identify convex regions of the image this way. These convex regions can
be bounded by rectangles, at which point the problem is solved.

# Point selection and rays

We don't want the algorithm to take too long or consume too much memory, so not
every pixel is sampled. It's more important to cover a fine grid vertically than
horizontally since we're looking for lines of text rather than words.

Each point has a total of eight rays: two vertical, two horizontal, and four
diagonal. These rays give hints about where text is located. For example, empty
text representation vectors on the horizontal rays with dense representation
vectors on the vertical rays indicates that the point is probably between lines.
Samples on the diagonal vectors only could indicate the corner of a rectangle.

    var tracer = catastrophe({
      patterns: ['_x + _y', '_x * _y', '_x - _y', '_x / _y']});

    var recognize_text = tracer(function (image_data, options) {
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
      var vertical_spacing   = options && options.vertical_spacing   || 3;
      var horizontal_limit   = w / horizontal_spacing >>> 0;

      var ray_length         = options && options.ray_length   || 8;
      var ray_interval       = options && options.ray_interval || 2;

      var interior_bias      = options && options.interior_bias    || 1;
      var corner_threshold   = options && options.corner_threshold || 0.5;

      // Create the array of points and begin adding variance data to each one.
      var points = [];
      for (var x = ray_length; x < w - ray_length; x += horizontal_spacing)
        for (var y = ray_length; y < h - ray_length; y += vertical_spacing)
          points.push({x: x, y: y, index: points.length, rays: [[], [], [], [],
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
        for (var j = 0, lj = ray_directions.length; j < lj; ++j) {
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
              p.rays[d].push({value:    Math.abs(subtotal),
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
      // This involves classifying each pixel as a probable top or bottom edge,
      // corner, or left/right edge. We then take these classifications and choose
      // the smallest set of rectangles that covers all of the pixels.
      //
      // Here are the classification rules:
      //
      // 1. We observe horizontal collisions but no verticals.
      //    This usually means we're in between letters or words, and we mark the
      //    pixel as being a probable rectangle interior.
      //
      // 2. Vertical collisions but no horizontals.
      //    We're probably between lines of text, so the pixel is marked as a
      //    probable top/bottom edge. These two quantities (top vs bottom) differ;
      //    if we see ray collisions upwards, then it's likely to be the bottom of a
      //    rectangle; if we see downwards collisions, it's likely to be the top. It
      //    can also be both, but it doesn't have to be.
      //
      // 3. Diagonal collisions but neither vertical nor horizontal.
      //    Likely to be a corner. These are used to signal start/end of rectangles;
      //    as such, we look for pixels with diagonal collisions going southeast or
      //    northwest.
      //
      // The classifier tries to be continuous, since we don't yet have enough
      // information to be fully discrete. To do this, we turn the above cases into
      // ratio detectors; that is, we take each ray's magnitude and bias the
      // relevant events by that factor. So, for instance, if we observe a faint
      // collision horizontally and a strong one diagonally, we report a start/end
      // marker more strongly than we do an interior marker.

      for (var i = 0, l = points.length, p; i < l; ++i) {
        p = points[i];
        p.ray_summaries = [];

        // First calculate ray magnitudes for the point. We also calculate the
        // weighted-average distance of events along this ray so that we have the
        // option to correct for minor distances later on.
        for (var j = 0, lj = p.rays.length, r; j < lj; ++j) {
          var magnitude = 0;
          var distance  = 0;
          p.ray_summaries[j] = {};

          for (var k = 0, lk = (r = p.rays[j]).length, moment; k < lk; ++k)
            moment     = r[k].value / r[k].length,
            magnitude += moment,
            distance  += moment * r[k].position;

          p.ray_summaries[j].magnitude = magnitude;
          p.ray_summaries[j].distance  = distance / magnitude;
        }

        // Now that we have the summary data, calculate the relative likelihood of
        // each case above. We do this by using a horizontal bias (directional
        // average of horizontal ray magnitudes), horizontal total (total of
        // horizontal ray magnitudes), and doing the same for vertical and NW/SE
        // diagonal rays.
        var h_bias = 0, h_total = 0;
        var v_bias = 0, v_total = 0;
        var d_bias = 0, d_total = 0;

        for (var j = 0, lj = p.ray_summaries.length, r; j < lj; ++j) {
          r = p.ray_summaries[j];

          // First add up horizontal stuff. We can just use the ray_directions array
          // to get the direction.
          if (ray_directions[j][1] === 0)
            h_bias  += r.magnitude * ray_directions[j][0],
            h_total += r.magnitude * Math.abs(ray_directions[j][0]);

          if (ray_directions[j][0] === 0)
            v_bias  += r.magnitude * ray_directions[j][1],
            v_total += r.magnitude * Math.abs(ray_directions[j][1]);

          // Diagonals are identified by using the dot product against the vector
          // [1, 1]. This happens to just be the sum of the two components.
          var is_diagonal = ray_directions[j][0] && ray_directions[j][1];
          var dot         = ray_directions[j][0] + ray_directions[j][1];
          if (is_diagonal && dot)
            d_bias  += r.magnitude * dot,
            d_total += r.magnitude * Math.abs(dot);
        }

        // Classify the pixel in terms of ratios and store the result back onto the
        // pixel. Horizontal biasing is different from the other cases because we
        // want to join adjacent rectangles rather than separating them.
        var v_factor =     v_total / (1 + h_total);
        var d_factor = 2 * d_total / (2 + h_total + v_total);

        // The vertical and diagonal biases will be somewhere between -magnitude and
        // magnitude. We need to figure out how much they lean to each side and use
        // that as an adjustment factor.
        var normalized_v_bias = v_bias / v_total + 0.5;
        var normalized_d_bias = d_bias / d_total + 0.5;

        p.classification = {
          interior:    interior_bias * h_total,
          left_edge:   h_bias < 0 && -h_bias / (1 + v_total),
          right_edge:  h_bias > 0 &&  h_bias / (1 + v_total),
          top_edge:    (1 - normalized_v_bias) * v_factor,
          bottom_edge: normalized_v_bias       * v_factor,
          nw_corner:   (1 - normalized_d_bias) * d_factor,
          se_corner:   normalized_d_bias       * d_factor};
      }

      // Identify rectangles within the image. To do this, we locate all points
      // whose nw_corner or se_corner factors are significant. We then match these
      // up by distance and begin joining adjacent rectangles. This is where the
      // algorithm begins to become discrete.

      var nw_corners = [], se_corners = [];
      var rows = [], columns = [];

      for (var i = 0, l = points.length, p; i < l; ++i) {
        p = points[i];
        (columns[p.x] || (columns[p.x] = [])).push(p);
        (rows[p.y]    || (rows[p.y]    = [])).push(p);

        // Mark start points in case we need to search for the nearest se corner at
        // some point.
        p.se_corner_index = se_corners.length;
        p.nw_corner_index = nw_corners.length;

        // Use double linking; p.right is the next-rightwards point, and p.left is
        // the next-leftwards...
        if (rows[p.y].length > 1) {
          var leftward = rows[p.y][rows[p.y].length - 2];
          leftward.right = p;
          p.left = leftward;
        }

        // ... and do the same vertically.
        if (columns[p.x].length > 1) {
          var upward = columns[p.x][columns[p.x].length - 2];
          upward.down = p;
          p.up = upward;
        }

        if (p.classification.nw_corner > corner_threshold)
          nw_corners.push(p);

        if (p.classification.se_corner > corner_threshold)
          se_corners.push(p);
      }

      // For each northwest corner, identify the closest southeast corner if there
      // is one. Discard any northwest corners that have no closest southeast
      // corner. We're looking for a corner that is down and to the right.
      for (var i = 0, l = nw_corners.length, p; i < l; ++i) {
        p = nw_corners[i];
        var se_corner = null;
        for (var j = p.se_corner_index, lj = se_corners.length; j < lj; ++j)
          if (se_corners[j].x > p.x && se_corners[j].y > p.y) {
            se_corner = se_corners[j];
            break;
          }

        // At this point we may or may not have a southeast corner. If we don't,
        // p.se_corner will be null and that will indicate that p is not a real
        // rectangle corner.
        p.se_corner = se_corner;
      }

      // Last step: take each northwest corner and fold it up into a rectangle.
      // TODO temporary implementation:
      var result = [];
      for (var i = 0, l = nw_corners.length, p, c; i < l; ++i) {
        p = nw_corners[i],
        c = p.se_corner;
        if (c) result.push({x: p.x, y: p.y, w: c.x - p.x, h: c.y - p.y});
      }
      return result;
    });