"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = require("express");
var _index = _interopRequireDefault(require("../resources/metrics/index"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var metrics = (0, _express.Router)({});
metrics.post('/', _index["default"]);
var _default = metrics;
exports["default"] = _default;