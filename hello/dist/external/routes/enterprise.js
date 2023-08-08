"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _enterprise = require("../resources/enterprise");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var enterprise = _express["default"].Router({
  mergeParams: true
});
enterprise.get('/accounts/:accountId', _enterprise.getAccountDetails);
var _default = enterprise;
exports["default"] = _default;