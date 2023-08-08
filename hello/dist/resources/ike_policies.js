"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateIkePolicy = exports.init = exports.getIkePolicyConnections = exports.getIkePolicy = exports.getIkePolicies = exports.deleteIkePolicy = exports.createIkePolicy = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _connections = require("./connections");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var authentication_algorithms = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
var dh_groups = [2, 5, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 31];
var encryption_algorithms = ['triple_des', 'aes128', 'aes192', 'aes256'];
var authentication_algorithms_deprecated = ['md5', 'sha1'];
var dh_groups_deprecated = [2, 5];
var encryption_algorithms_deprecated = ['triple_des'];
var ike_versions = [1, 2];
var DEFAULT_NUMBER_OF_IKE_POLICIES = 25;
var KEY_LIFETIME_MIN = 1800;
var KEY_LIFETIME_MAX = 86400;
var addIkePolicy = function addIkePolicy(ike_policies, data) {
  var id = casual.uuid;
  var ikePolicy = Object.assign({
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    authentication_algorithm: casual.random_element(authentication_algorithms),
    dh_group: casual.random_element(dh_groups),
    encryption_algorithm: casual.random_element(encryption_algorithms),
    ike_version: casual.random_element(ike_versions),
    key_lifetime: casual.integer(KEY_LIFETIME_MIN, KEY_LIFETIME_MAX),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    connections: [],
    negotiation_mode: 'main',
    region: data.regionID || utils.getRandomRegion().name
  }, data);
  if (!data.name) {
    ikePolicy.name = utils.generateName('ike_policy', {
      region_name: ikePolicy.region
    });
  }
  ike_policies.insert(ikePolicy);
  return id;
};
var init = function init() {
  var ikePolicies = _server.db.addCollection(_server.COLS.ike_policies);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addIkePolicy(ikePolicies, {
    name: 'aaa-default-ike-policy-1',
    id: 'ike-policy-1',
    region: 'us-east',
    authentication_algorithm: 'sha256',
    encryption_algorithm: 'aes128',
    dh_group: 14
  });
  addIkePolicy(ikePolicies, {
    name: 'aaa-default-ike-policy-2',
    id: 'ike-policy-2'
  });
  addIkePolicy(ikePolicies, {
    name: 'aaa-default-ike-policy-3',
    id: 'ike-policy-3'
  });
  addIkePolicy(ikePolicies, {
    name: 'aaa-default-ike-policy-4',
    id: 'ike-policy-4',
    region: 'us-east',
    authentication_algorithm: 'md5',
    encryption_algorithm: 'triple_des',
    dh_group: 2
  });
  utils.repeat(function () {
    return addIkePolicy(ikePolicies, {});
  }, DEFAULT_NUMBER_OF_IKE_POLICIES);
};
exports.init = init;
var formatIkePolicyForClient = function formatIkePolicyForClient(req, ikePolicy) {
  ikePolicy.href = "".concat(utils.getBaseApiUrl(req), "ike_policies/").concat(ikePolicy.id);
  ikePolicy.crn = utils.updateResourceCrnRegion(ikePolicy, req);
  ikePolicy.connections = utils.getConnectionsByPolicy(ikePolicy.id, 'ike_policy');
};
var formatIkePolicyConnectionForClient = function formatIkePolicyConnectionForClient(req, ikePolicy) {
  var conns = _server.db.getCollection(_server.COLS.connections).where(function (connection) {
    return _lodash["default"].get(connection, 'ike_policy.id') === ikePolicy.id;
  });
  var connections = conns.map(function (conn) {
    return (0, _connections.formatConnectionForClient)(req, conn);
  });
  return {
    connections: connections
  };
};
var createIkePolicy = function createIkePolicy(req, res) {
  var input = req.body;
  var ikePoliciesCol = _server.db.getCollection(_server.COLS.ike_policies);
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  var duplicate = utils.duplicateNameCheck(ikePoliciesCol, input, req, res, 'resource with that name already exists', 'ike_policy');
  if (duplicate) {
    return;
  }

  // Check if it's using deprecated cipher option like triple_des, md1, sha1 and etc.
  if (input.authentication_algorithm && authentication_algorithms_deprecated.indexOf(input.authentication_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The authentication algorithm ".concat(input.authentication_algorithm, " is not supported."), 'authentication_algorithm_not_supported')).end();
    return;
  }
  if (input.dh_group && dh_groups_deprecated.indexOf(input.dh_group) !== -1) {
    res.status(400).json(utils.generateErrors("The DH group ".concat(input.dh_group, " is not supported."), 'dh_group_not_supported')).end();
    return;
  }
  if (input.encryption_algorithm && encryption_algorithms_deprecated.indexOf(input.encryption_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The encryption algorithm ".concat(input.encryption_algorithm, " is not supported."), 'encryption_algorithm_not_supported')).end();
    return;
  }
  var id = addIkePolicy(ikePoliciesCol, input);
  var ikePolicies = ikePoliciesCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var ikePolicy = ikePolicies[0];
  formatIkePolicyForClient(req, ikePolicy);
  res.status(201).json(ikePolicy).end();
};
exports.createIkePolicy = createIkePolicy;
var deleteIkePolicy = function deleteIkePolicy(req, res) {
  var ikePoliciesCol = _server.db.getCollection(_server.COLS.ike_policies);
  var ikePolicy = ikePoliciesCol.findOne({
    id: req.params.ike_policy_id
  });
  if (!ikePolicy) {
    res.status(404).end();
    return;
  }
  ikePoliciesCol.remove(ikePolicy);
  res.status(204).end();
};
exports.deleteIkePolicy = deleteIkePolicy;
var updateIkePolicy = function updateIkePolicy(req, res) {
  var input = req.body;
  var ikePoliciesCol = _server.db.getCollection(_server.COLS.ike_policies);
  var ikePolicy = ikePoliciesCol.findOne({
    id: req.params.ike_policy_id
  });
  if (!ikePolicy) {
    res.status(404).end();
    return;
  }

  // Check if it's using deprecated cipher option like triple_des, md1, sha1 and etc.
  if (input.authentication_algorithm && authentication_algorithms_deprecated.indexOf(input.authentication_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The authentication algorithm ".concat(input.authentication_algorithm, " is not supported."), 'authentication_algorithm_not_supported')).end();
    return;
  }
  if (input.dh_group && dh_groups_deprecated.indexOf(input.dh_group) !== -1) {
    res.status(400).json(utils.generateErrors("The DH group ".concat(input.dh_group, " is not supported."), 'dh_group_not_supported')).end();
    return;
  }
  if (input.encryption_algorithm && encryption_algorithms_deprecated.indexOf(input.encryption_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The encryption algorithm ".concat(input.encryption_algorithm, " is not supported."), 'encryption_algorithm_not_supported')).end();
    return;
  }
  var updatedIkePolicy = _objectSpread(_objectSpread({}, ikePolicy), input);
  ikePoliciesCol.update(updatedIkePolicy);
  var resultIkePolicy = utils.findResource(_server.COLS.ike_policies, updatedIkePolicy.id, res);
  if (!resultIkePolicy) return;
  formatIkePolicyForClient(req, resultIkePolicy);
  res.status(200).json(resultIkePolicy).end();
};
exports.updateIkePolicy = updateIkePolicy;
var getIkePolicies = function getIkePolicies(req, res) {
  var ikePolicies = utils.getResources(req, _server.COLS.ike_policies);
  ikePolicies.ike_policies.forEach(function (ikePolicy) {
    return formatIkePolicyForClient(req, ikePolicy);
  });
  res.json(ikePolicies).end();
};
exports.getIkePolicies = getIkePolicies;
var getIkePolicy = function getIkePolicy(req, res) {
  var ikePolicy = utils.findResource(_server.COLS.ike_policies, req.params.ike_policy_id, res);
  if (!ikePolicy) return;
  formatIkePolicyForClient(req, ikePolicy);
  res.status(200).json(ikePolicy).end();
};
exports.getIkePolicy = getIkePolicy;
var getIkePolicyConnections = function getIkePolicyConnections(req, res) {
  var ikePolicy = utils.findResource(_server.COLS.ike_policies, req.params.ike_policy_id, res);
  if (!ikePolicy) return;
  res.status(200).json(formatIkePolicyConnectionForClient(req, ikePolicy)).end();
};
exports.getIkePolicyConnections = getIkePolicyConnections;