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
  var w = image_data.width, h = image_data.height, data = image_data.data;

  var r_bias = 0.2126 / 768.0,
      g_bias = 0.7152 / 768.0,
      b_bias = 0.0722 / 768.0;

  var luminosity = function (x, y) {
    var offset = y * w + x << 2;
    return data[offset]     * r_bias +
           data[offset + 1] * g_bias +
           data[offset + 2] * b_bias;
  };

  // Process options and cache as locals.
  var horizontal_spacing = options && options.horizontal_spacing || 3;
  var vertical_spacing   = options && options.vertical_spacing   || 3;

  var ray_interval       = options && options.ray_interval || 1;
  var ray_steps          = options && options.ray_steps    || 6;
  var ray_aspect         = options && options.ray_aspect   || 2;
  var ray_length_x       = ray_steps * ray_interval * ray_aspect;
  var ray_length_y       = ray_steps * ray_interval;

  var interior_bias      = options && options.interior_bias      || 1;
  var left_edge_bias     = options && options.left_edge_bias     || 0.0;
  var right_edge_bias    = options && options.right_edge_bias    || 0.0;
  var minimum_interior   = options && options.minimum_interior   || 0.5;
  var minimum_confidence = options && options.minimum_confidence || 0.1;

  // Create the array of points and begin adding variance data to each one.
  var points = [];
  for (var x = ray_length_y; x < w - ray_length_x; x += horizontal_spacing)
    for (var y = ray_length_y; y < h - ray_length_y; y += vertical_spacing)
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

  for (var i = 0, l = ray_directions.length; i < l; ++i)
    ray_directions[i][0] *= ray_aspect;

  var ray = [];
  for (var i = 0, l = points.length, p; i < l; ++i) {
    p = points[i];
    x = p.x;
    y = p.y;

    // Do a ray analysis in each direction and store the results into the
    // point's ray data.
    for (var j = 0, lj = ray_directions.length; j < lj; ++j) {
      var dx = ray_directions[j][0] * ray_interval;
      var dy = ray_directions[j][1] * ray_interval;

      // Gather the points along the ray. No bounds-checking is necessary
      // because all of the points are known to be at least ray_length away from
      // any edge.
      for (var d = 0, total = 0; d < ray_steps; ++d)
        total += ray[d] = luminosity(x + d * dx >>> 0, y + d * dy >>> 0);

      // Now find places where individual values cross the average. Sum until we
      // hit an edge, at which point we start over.
      var average     = total / ray_steps;
      var subtotal    = 0;
      var subdistance = 0;

      for (var d = 0; d < ray_steps; ++d)
        // Any sample that opposes the current direction of the subtotal marks
        // an edge. When we see this, we grab the current subtotal, divided by
        // the distance it represents, and start a new sample.
        if (d === 0 || subtotal - average >= 0 === ray[d] - average >= 0)
          subtotal += ray[d] - average,
          ++subdistance;
        else {
          subtotal = Math.abs(subtotal);
          if (subtotal > 0.025)
            p.rays[j].push({value:    Math.abs(subtotal),
                            position: d,
                            length:   subdistance});
          subtotal    = ray[d] - average;
          subdistance = 1;
        }

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

  all_magnitudes = [];
  for (var i = 0, l = points.length, p; i < l; ++i) {
    p = points[i];
    p.ray_summaries = [];

    // First calculate ray magnitudes for the point. We also calculate the
    // weighted-average distance of events along this ray so that we have the
    // option to correct for minor distances later on.
    for (var j = 0, lj = p.rays.length, r; j < lj; ++j) {
      var magnitude = 0;
      var distance  = 0;

      for (var k = 0, lk = (r = p.rays[j]).length, moment; k < lk; ++k)
        moment     = r[k].value / r[k].length,
        magnitude += moment,
        distance  += moment * r[k].position;

      p.ray_summaries[j] = {magnitude: magnitude,
                            distance:  distance / magnitude || 0};
      all_magnitudes.push({x: p.x, y: p.y, i: j, m: magnitude});
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
    //
    // The vertical and diagonal biases will be somewhere between -magnitude and
    // magnitude. We need to figure out how much they lean to each side and use
    // that as an adjustment factor.
    var normalized_v_bias = v_bias + (v_total * 0.5);
    var normalized_d_bias = d_bias + (d_total * 0.5);

    var interior_value    = interior_bias * h_total + d_total + v_total;
    var left_edge_value   = h_bias < 0 && -h_bias;
    var right_edge_value  = h_bias > 0 &&  h_bias;
    var top_edge_value    = normalized_v_bias;
    var bottom_edge_value = v_total - normalized_v_bias;
    var nw_corner_value   = normalized_d_bias;
    var se_corner_value   = d_total - normalized_d_bias;

    // Normalize the vector distance.
    var classification_distance = Math.max(1, Math.sqrt(
      interior_value    * interior_value +
      left_edge_value   * left_edge_value +
      right_edge_value  * right_edge_value +
      top_edge_value    * top_edge_value +
      bottom_edge_value * bottom_edge_value +
      nw_corner_value   * nw_corner_value +
      se_corner_value   * se_corner_value));

    p.classification_distance = classification_distance;
    p.interior    = interior_value    / classification_distance;
    p.left_edge   = left_edge_value   / classification_distance;
    p.right_edge  = right_edge_value  / classification_distance;
    p.top_edge    = top_edge_value    / classification_distance;
    p.bottom_edge = bottom_edge_value / classification_distance;
    p.nw_corner   = nw_corner_value   / classification_distance;
    p.se_corner   = se_corner_value   / classification_distance;
  }

  // Doubly link all points both vertically and horizontally.
  var rows = [], columns = [];
  for (var i = 0, l = points.length, p; i < l; ++i) {
    p = points[i];
    (columns[p.x] || (columns[p.x] = [])).push(p);
    (rows[p.y]    || (rows[p.y]    = [])).push(p);

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
  }

  // Now create the sorted array and sort by interior classification.
  var sorted_by_interior = points.slice().sort(function (x, y) {
    return y.interior - x.interior;
  });

  // Start with the strongest interior classification and proceed left, right,
  // up, and down until we start hitting edges. These become the extremities of
  // the rectangle.
  var rectangles         = [];
  var maximum_confidence = 0;
  for (var i = 0, l = sorted_by_interior.length, p;
       i < l && sorted_by_interior[i].interior > minimum_interior;
       ++i) {
    p = sorted_by_interior[i];

    if (!(p.up && p.down && p.left && p.right))
      continue;

    // Look for top/bottom edges first.
    var top_edge    = p.up;
    var bottom_edge = p.down;

    var top_moment   = 0;
    var top_total    = 0;
    var top_distance = 0;
    while (top_edge.up
        && (top_moment = top_edge.interior - top_edge.top_edge) > 0
        && (top_distance === 0 ||
            top_total + top_moment / (top_distance + 1) >
              top_total / top_distance))
      top_edge   = top_edge.up,
      top_total += top_moment,
      ++top_distance;

    var bottom_moment   = 0;
    var bottom_total    = 0;
    var bottom_distance = 0;
    while (bottom_edge.down
        && (bottom_moment = bottom_edge.interior - bottom_edge.bottom_edge) > 0
        && (bottom_distance === 0 ||
            bottom_total + bottom_moment / (bottom_distance + 1) >
              bottom_total / bottom_distance))
      bottom_edge   = bottom_edge.down,
      bottom_total += bottom_moment,
      ++bottom_distance;

    // Now go left and right until we hit corners and edges. Add up the
    // confidence as we go. Note that the points are in a grid, so p1.left.x ===
    // p2.left.x iff p1.x === p2.x.
    var left_edge = p;
    var nw_corner = top_edge;

    while (left_edge.left &&
           left_edge.interior + nw_corner.top_edge + left_edge_bias >
           left_edge.left_edge + nw_corner.nw_corner)
      left_edge = left_edge.left,
      nw_corner = nw_corner.left;

    // Do the same thing for the right side.
    var right_edge = p;
    var se_corner  = bottom_edge;

    while (right_edge.right &&
           right_edge.interior + se_corner.bottom_edge + right_edge_bias >
           right_edge.right_edge + se_corner.se_corner)
      right_edge = right_edge.right,
      se_corner  = se_corner.right;

    // Now add up the rectangle classification values to get the confidence.
    var confidence = 0;
    var area       = (se_corner.x - nw_corner.x) * (se_corner.y - nw_corner.y);

    for (var h_iterator = nw_corner.right;
         h_iterator.x < se_corner.x;
         h_iterator = h_iterator.right)
      for (var v_iterator = h_iterator.down;
           v_iterator.y < se_corner.y;
           v_iterator = v_iterator.down)
        confidence += v_iterator.interior;

    for (var top_iterator = nw_corner.right,
             bottom_iterator = se_corner.left;
         top_iterator.x < se_corner.x;
         top_iterator    = top_iterator.right,
         bottom_iterator = bottom_iterator.left)
      confidence += top_iterator.top_edge + bottom_iterator.bottom_edge;

    for (var left_iterator = nw_corner.down,
             right_iterator = se_corner.up;
         left_iterator.y < se_corner.y;
         left_iterator = left_iterator.down,
         right_iterator = right_iterator.up)
      confidence += left_iterator.left_edge + right_iterator.right_edge;

    confidence += nw_corner.nw_corner + se_corner.se_corner;
    confidence /= area * (se_corner.y - nw_corner.y);

    maximum_confidence = Math.max(confidence, maximum_confidence);

    rectangles.push({x: p.x, y: p.y,
                     w: horizontal_spacing, h: vertical_spacing,
                     confidence: p.ray_summaries[0].magnitude +
                                 p.ray_summaries[2].magnitude +
                                 p.ray_summaries[4].magnitude +
                                 p.ray_summaries[6].magnitude});


  }

  // Scale confidence values so that they span a unit interval, then remove
  // rectangles below the minimum confidence limit.
  var survivors = [];
  for (var i = 0, l = rectangles.length; i < l; ++i) {
    rectangles[i].confidence /= maximum_confidence;
    if (rectangles[i].confidence >= minimum_confidence)
      survivors.push(rectangles[i]);
  }

  return survivors;
};

// Generated by SDoc 
