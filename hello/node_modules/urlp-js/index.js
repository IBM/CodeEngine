/* jshint node: true, esnext: true */
"use strict";

/**
 * Match object
 *
 * @param {Boolean} match
 * @param {Object} params
 * @constructor
 */

function Match(match, params) {
  this.match = match;
  this.params = params || {};
}

/**
 * expose
 */

module.exports = match;

/**
 * match matches a pattern to a path
 *
 * @param {String} pattern
 * @param {String} path
 * @return {Match}
 * @api public
 */

function match(pattern, path) {
  let x = 0;
  let n = pattern.length;

  let y = 0;
  let m = path.length;

  var params = {};

  let n_1 = n-1;
  let m_1 = m-1;

  while (true) {
    if (x === n && y === m) {
      break;
    }

    if (x > n_1 || y > m_1) {
      // look forward a spot for the wildcard this will help paths like
      // /posts/:id/comments/* vs. /posts/123/comments
      if (pattern[x+1] === "*") {
        break;
      }

      return new Match(false);
    }

    let p = pattern[x];

    if (p === "*") {
      break;
    }
    if (p === ":") {
      let k = dir(pattern.substr(x));
      let v = dir(path.substr(y));

      x = x + k.length;
      y = y + v.length;

      params[k.substr(1)] = v;
      continue;
    }

    if (p !== path[y]) {
      return new Match(false);
    }

    x++;
    y++;
  } 

  return new Match(true, params);
}

/**
 * dir returns the first directory in a path
 *
 * @param {String} path
 * @return {String} path up to / or the original path
 * @api private
 */

function dir(path) {
  let i = 0;
  let len = path.length;
  for(; i < len; i++) {
    if (path[i] === "\/") {
      return path.substring(0, i);
    }
  }

  return path;
}
