"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getAlertRules = exports.getAlertNotifications = exports.getAlertHistory = void 0;
var _server = require("../../../server");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var rawAlerts = require('./alerts.json');
var rawNotifications = require('./notifications.json');
var rawRules = require('./rules.json');
var addAlerts = function addAlerts() {
  var alerts = _server.db.addCollection(_server.COLS.alerts);
  rawAlerts.alerts.forEach(function (a) {
    var alert = _objectSpread({
      kind: 'alert'
    }, a);
    alerts.insert(alert);
  });
};
var addNotifications = function addNotifications() {
  var notifications = _server.db.addCollection(_server.COLS.alerts);
  rawNotifications.notifications.forEach(function (n) {
    var notification = _objectSpread({
      kind: 'notification'
    }, n);
    notifications.insert(notification);
  });
};
var addRules = function addRules() {
  var rules = _server.db.addCollection(_server.COLS.rules);
  rawRules.rules.forEach(function (r) {
    var rule = _objectSpread({
      kind: 'rule'
    }, r);
    rules.insert(rule);
  });
};
var init = function init() {
  addAlerts();
  addNotifications();
  addRules();
};
exports.init = init;
var getAlertHistory = function getAlertHistory(req, res) {
  var data = _server.db.getCollection(_server.COLS.alerts).chain().find().where(function (obj) {
    return obj.kind === 'alert';
  }).data({
    removeMeta: true
  });
  res.status(200).json(data).end();
};
exports.getAlertHistory = getAlertHistory;
var getAlertNotifications = function getAlertNotifications(req, res) {
  var data = _server.db.getCollection(_server.COLS.alerts).chain().find().where(function (obj) {
    return obj.kind === 'notification';
  }).data({
    removeMeta: true
  });
  res.status(200).json(data).end();
};
exports.getAlertNotifications = getAlertNotifications;
var getAlertRules = function getAlertRules(req, res) {
  var data = _server.db.getCollection(_server.COLS.rules).chain().find().where(function (obj) {
    return obj.kind === 'rule';
  }).data({
    removeMeta: true
  });
  res.status(200).json(data).end();
};
exports.getAlertRules = getAlertRules;