"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _resourcegroup = require("../resources/resourcegroup");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var rg = _express["default"].Router({
  mergeParams: true
});
rg.get('/v2/resource_groups', _resourcegroup.list);
rg.get('/v2/resource_groups/:id', _resourcegroup.get);

// CLI is still using the v1 resource group API
rg.get('/v1/resource_groups', _resourcegroup.list);
rg.get('/v1/resource_groups/:id', _resourcegroup.get);
var _default = rg;
exports["default"] = _default;