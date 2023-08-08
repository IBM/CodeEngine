"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _dnsZone = require("../resources/dns-zone");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var dnsSvc = _express["default"].Router({
  mergeParams: true
});
dnsSvc.get('/v1/instances/:dnsInstanceGuid/dnszones', _dnsZone.list);
var _default = dnsSvc;
exports["default"] = _default;