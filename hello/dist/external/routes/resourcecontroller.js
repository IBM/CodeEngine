"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _resourcecontroller = require("../resources/resourcecontroller");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var rc = _express["default"].Router({
  mergeParams: true
});
rc.get('/v2/resource_instances', _resourcecontroller.list);
rc.get('/v2/resource_instances/:id', _resourcecontroller.get);
var _default = rc;
exports["default"] = _default;