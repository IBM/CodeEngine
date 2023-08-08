"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _pricing = require("../resources/pricing");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var pricing = _express["default"].Router({
  mergeParams: true
});
pricing.post('/v4/calculator/meter', _pricing.calculatePricing);
var _default = pricing;
exports["default"] = _default;