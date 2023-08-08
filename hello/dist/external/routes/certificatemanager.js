"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _certificatemanager = require("../resources/certificatemanager");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var cm = _express["default"].Router({
  mergeParams: true
});
cm.get('/api/v3/:crn/certificates', _certificatemanager.list);
cm.get('/api/v2/certificate/:crn', _certificatemanager.getCertificate);
var _default = cm;
exports["default"] = _default;