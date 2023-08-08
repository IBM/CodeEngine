"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _secretsmanager = require("../resources/secretsmanager");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var sm = _express["default"].Router({
  mergeParams: true
});

// For SM API V1
sm.get('/:instance_id/api/v1/secrets', _secretsmanager.listV1);
sm.get('/:instance_id/api/v1/secrets/:secret_type/:secret_id', _secretsmanager.getSecretV1);

// For SM API V2
sm.get('/:instance_id/api/v2/secrets', _secretsmanager.list);
sm.get('/:instance_id/api/v2/secrets/:secret_id', _secretsmanager.getSecret);
var _default = sm;
exports["default"] = _default;