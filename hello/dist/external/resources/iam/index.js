"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listTrustedProfiles = exports.listPolicies = exports.init = exports.getTrustedProfile = exports.genAuthToke = void 0;
var _server = require("../../../server");
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var rawPolicies = require('./policies.json');
var rawTrustedProfiles = require('./trustedProfiles.json');
var jwt = require('jsonwebtoken');
var casual = require('casual');
var init = function init() {
  if (_server.db.getCollection(_server.COLS.authPolicies)) {
    return;
  }
  var policies = _server.db.addCollection(_server.COLS.authPolicies);
  rawPolicies.policies.forEach(function (policy) {
    policies.insert(_objectSpread({}, policy));
  });
  if (_server.db.getCollection(_server.COLS.trustedProfiles)) {
    return;
  }
  var trustedProfiles = _server.db.addCollection(_server.COLS.trustedProfiles);
  rawTrustedProfiles.trustedProfiles.forEach(function (profile) {
    trustedProfiles.insert(_objectSpread({}, profile));
  });
};
exports.init = init;
var listPolicies = function listPolicies(req, res) {
  var policies = _server.db.getCollection(_server.COLS.authPolicies);
  var authPolicies = policies.chain().data({
    removeMeta: true
  });
  res.status(200).json({
    policies: authPolicies
  }).end();
};
exports.listPolicies = listPolicies;
var listTrustedProfiles = function listTrustedProfiles(req, res) {
  var profiles = _server.db.getCollection(_server.COLS.trustedProfiles);
  var trustedProfiles = profiles.chain().data({
    removeMeta: true
  });
  res.status(200).json({
    trustedProfiles: {
      offset: 0,
      limit: 5,
      first: 'https://dummy-url',
      previous: null,
      next: null,
      nodes: _toConsumableArray(trustedProfiles)
    }
  }).end();
};
exports.listTrustedProfiles = listTrustedProfiles;
var getTrustedProfile = function getTrustedProfile(req, res) {
  var profiles = _server.db.getCollection(_server.COLS.trustedProfiles);
  var trustedProfile = profiles.chain().find({
    id: req.params.id
  }).data({
    removeMeta: true
  });
  if (trustedProfile.length === 0) {
    res.status(404).end();
    return;
  }
  res.status(200).json(trustedProfile[0]).end();
};
exports.getTrustedProfile = getTrustedProfile;
var genAuthToke = function genAuthToke(req, res) {
  res.status(200).json({
    access_token: jwt.sign({
      bss_account: casual.uuid
    }, 'rias-mock', {
      expiresIn: '1h',
      notBefore: 60
    }),
    refresh_token: jwt.sign({
      iam_id: casual.uuid
    }, 'rias-mock', {
      expiresIn: '1d',
      notBefore: 60
    }),
    expires_in: 3600
  }).end();
};
exports.genAuthToke = genAuthToke;