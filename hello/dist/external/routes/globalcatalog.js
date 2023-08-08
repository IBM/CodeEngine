"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _globalcatalog = require("../resources/globalcatalog");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var gc = _express["default"].Router({
  mergeParams: true
});
gc.get('/api/v1', _globalcatalog.query);
gc.get('/api/v1/:id', _globalcatalog.getResource);
gc.get('/api/v1/:id/plan', _globalcatalog.getResourcePlans);
gc.get('/api/v1/:profileID/pricing', _globalcatalog.getProfilePricingPlan);
gc.get('/api/v1/:id/deployment', _globalcatalog.getPlanDeployments);
var _default = gc;
exports["default"] = _default;