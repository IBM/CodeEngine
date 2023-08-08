"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.list = exports.init = void 0;
var _server = require("../../../server");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var data = require('./resources.json');
var init = function init() {
  if (_server.db.getCollection(_server.COLS.dnszones)) {
    return;
  }
  var resources = _server.db.addCollection(_server.COLS.dnszones);
  data.dnszones.forEach(function (item) {
    resources.insert(_objectSpread({}, item));
  });
};
exports.init = init;
var list = function list(req, res) {
  var resources = _server.db.getCollection(_server.COLS.dnszones);
  var foundResources = resources.chain().find({
    instance_id: req.params.dnsInstanceGuid
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    dnszones: foundResources
  }).end();
};
exports.list = list;