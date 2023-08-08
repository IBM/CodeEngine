"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _cos = require("../resources/cos");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var cos = _express["default"].Router({
  mergeParams: true
});
cos.get('/endpoints', _cos.endpoints);
cos.get('/buckets', _cos.buckets);
cos.get('/buckets/:bucket', _cos.bucket);
cos.get('/b/:bucketName', _cos.bucketConfig);
var _default = cos;
exports["default"] = _default;