"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = require("express");
var _index = require("../resources/alerts/index");
var alerts = (0, _express.Router)({
  mergeParams: true
});
var alertHistoryEndpoint = 'history';
var alertNotificationsEndpoint = 'notifications';
var alertRulesEndpoint = 'rules';
alerts.get("/".concat(alertHistoryEndpoint), _index.getAlertHistory);
alerts.get("/".concat(alertNotificationsEndpoint), _index.getAlertNotifications);
alerts.get("/".concat(alertRulesEndpoint), _index.getAlertRules);
var _default = alerts;
exports["default"] = _default;