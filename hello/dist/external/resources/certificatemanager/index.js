"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.list = exports.init = exports.getCertificate = void 0;
var _server = require("../../../server");
var _utils = require("../../../utils");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var rawCerts = require('./certificates.json');
var init = function init() {
  if (_server.db.getCollection(_server.COLS.certificates)) {
    return;
  }
  var certs = _server.db.addCollection(_server.COLS.certificates);
  rawCerts.certificates.forEach(function (cert) {
    certs.insert(_objectSpread({}, cert));
  });
};
exports.init = init;
var list = function list(req, res) {
  var certs = _server.db.getCollection(_server.COLS.certificates);
  var matchedCerts = certs.chain().where(function (cert) {
    return cert.resource_id === req.params.crn;
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    certificates: matchedCerts
  }).end();
};
exports.list = list;
var getCertificate = function getCertificate(req, res) {
  var certs = _server.db.getCollection(_server.COLS.certificates);
  var matchedCerts = certs.chain().where(function (cert) {
    return cert._id === req.params.crn;
  }).data({
    removeMeta: true
  });
  if (matchedCerts.length === 0) {
    res.status(404).json((0, _utils.generateErrors)("Resource not found with crn ".concat(req.params.crn), 'not_found', _server.COLS.certificates)).end();
  } else {
    res.status(200).json(matchedCerts[0]).end();
  }
};
exports.getCertificate = getCertificate;