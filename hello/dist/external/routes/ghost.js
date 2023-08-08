"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _ghost = _interopRequireDefault(require("../resources/ghost"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var ghost = _express["default"].Router({
  mergeParams: true
});
ghost.post('/resources/search', _ghost["default"]);
var _default = ghost;
exports["default"] = _default;