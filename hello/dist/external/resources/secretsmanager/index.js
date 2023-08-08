"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listV1 = exports.list = exports.init = exports.getSecretV1 = exports.getSecret = void 0;
var _server = require("../../../server");
var _utils = require("../../../utils");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var rawSecrets = require('./secrets.json');
var init = function init() {
  if (_server.db.getCollection(_server.COLS.secrets)) {
    return;
  }
  var secrets = _server.db.addCollection(_server.COLS.secrets);
  rawSecrets.resources.forEach(function (secret) {
    secrets.insert(_objectSpread({}, secret));
  });
};

// For SM API V1
// refer to https://cloud.ibm.com/apidocs/secrets-manager/secrets-manager-v1#list-secrets
exports.init = init;
var listV1 = function listV1(req, res) {
  var secrets = _server.db.getCollection(_server.COLS.secrets);
  /**
   * using includes is because caller calls
   * /rias-mock/external/secretsmanager-mock/bbbc94a6-64aa-4c55-b00f-f6cd70e4bbbb.private/api/v1/secrets
   */
  var matchedSecrets = secrets.chain().where(function (secret) {
    var _req$params$instance_;
    return (_req$params$instance_ = req.params.instance_id) === null || _req$params$instance_ === void 0 ? void 0 : _req$params$instance_.includes(secret.instance_id);
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    resources: matchedSecrets
  }).end();
};

// For SM API V1
// refer to https://cloud.ibm.com/apidocs/secrets-manager/secrets-manager-v1#get-secret
exports.listV1 = listV1;
var getSecretV1 = function getSecretV1(req, res) {
  var secrets = _server.db.getCollection(_server.COLS.secrets);
  var matchedSecrets = secrets.chain().where(function (secret) {
    return secret.instance_id === req.params.instance_id && secret.id === req.params.secret_id && req.params.secret_type === secret.secret_type;
  }).data({
    removeMeta: true
  });
  if (matchedSecrets.length === 0) {
    res.status(404).json((0, _utils.generateErrors)("Resource not found with id ".concat(req.params.secret_id), 'not_found', _server.COLS.secrets)).end();
  } else {
    res.status(200).json({
      resources: matchedSecrets
    }).end();
  }
};

// For SM API V2
// refer to https://cloud.ibm.com/apidocs/secrets-manager/secrets-manager-v2#list-secrets
exports.getSecretV1 = getSecretV1;
var list = function list(req, res) {
  var secrets = _server.db.getCollection(_server.COLS.secrets);
  /**
   * using includes is because caller calls
   * /rias-mock/external/secretsmanager-mock/bbbc94a6-64aa-4c55-b00f-f6cd70e4bbbb.private/api/v2/secrets
   */
  var matchedSecrets = secrets.chain().where(function (secret) {
    var _req$params$instance_2;
    return (_req$params$instance_2 = req.params.instance_id) === null || _req$params$instance_2 === void 0 ? void 0 : _req$params$instance_2.includes(secret.instance_id);
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    secrets: matchedSecrets
  }).end();
};

// For SM API V2
// refer to https://cloud.ibm.com/apidocs/secrets-manager/secrets-manager-v2#get-secret
exports.list = list;
var getSecret = function getSecret(req, res) {
  var secrets = _server.db.getCollection(_server.COLS.secrets);
  var matchedSecrets = secrets.chain().where(function (secret) {
    return secret.instance_id === req.params.instance_id && secret.id === req.params.secret_id;
  }).data({
    removeMeta: true
  });
  if (matchedSecrets.length === 0) {
    res.status(404).json((0, _utils.generateErrors)("Resource not found with id ".concat(req.params.secret_id), 'not_found', _server.COLS.secrets)).end();
  } else {
    res.status(200).json(matchedSecrets[0]).end();
  }
};
exports.getSecret = getSecret;