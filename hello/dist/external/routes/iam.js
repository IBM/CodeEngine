"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _iam = require("../resources/iam");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var iam = _express["default"].Router({
  mergeParams: true
});
iam.get('/v1/policies', _iam.listPolicies);
iam.get('/v1/profiles', _iam.listTrustedProfiles);
iam.get('/v1/profiles/:id', _iam.getTrustedProfile);
iam.post('/identity/token', _iam.genAuthToke);
var _default = iam;
exports["default"] = _default;