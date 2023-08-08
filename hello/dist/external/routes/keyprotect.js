"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _keyprotect = require("../resources/keyprotect");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var keyprotect = _express["default"].Router({
  mergeParams: true
});
keyprotect.get('/keys', _keyprotect.listKeys);
keyprotect.get('/keys/:id/metadata', _keyprotect.getKeyMetadata);
var _default = keyprotect;
exports["default"] = _default;