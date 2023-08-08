"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateIpsecPolicy = exports.init = exports.getIpsecPolicyConnections = exports.getIpsecPolicy = exports.getIpsecPolicies = exports.deleteIpsecPolicy = exports.createIpsecPolicy = void 0;
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
var authenticationEnums = ['disabled', 'md5', 'sha1', 'sha256', 'sha384', 'sha512'];
var encryptionEnumsWithAuthEnabled = ['triple_des', 'aes128', 'aes192', 'aes256'];
var encryptionEnumsWithAuthDisabled = ['aes128gcm16', 'aes192gcm16', 'aes256gcm16'];
var pfs = ['disabled', 'group_2', 'group_5', 'group_14', 'group_15', 'group_16', 'group_17', 'group_18', 'group_19', 'group_20', 'group_21', 'group_22', 'group_23', 'group_24', 'group_31'];
var authenticationEnumsDeprecated = ['md5', 'sha1'];
var encryptionEnumsWithAuthDeprecated = ['triple_des'];
var pfsDeprecated = ['group_2', 'group_5'];
var DEFAULT_NUMBER_OF_IPSEC_POLICIES = 25;
var KEY_LIFETIME_MIN = 1800;
var KEY_LIFETIME_MAX = 86400;
var addIpsecPolicy = function addIpsecPolicy(ipsec_policies, data) {
  var id = casual.uuid;
  var authentication = casual.random_element(authenticationEnums);
  var encryption = casual.random_element(authentication === 'disabled' ? encryptionEnumsWithAuthDisabled : encryptionEnumsWithAuthEnabled);
  var ipSecPolicy = Object.assign({
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    authentication_algorithm: authentication,
    encryption_algorithm: encryption,
    key_lifetime: casual.integer(KEY_LIFETIME_MIN, KEY_LIFETIME_MAX),
    pfs: casual.random_element(pfs),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    connections: [],
    encapsulation_mode: 'tunnel',
    transform_protocol: 'esp',
    region: data.regionID || utils.getRandomRegion().name
  }, data);
  if (!data.name) {
    ipSecPolicy.name = utils.generateName('ipsec_policy', {
      region_name: ipSecPolicy.region
    });
  }
  ipsec_policies.insert(ipSecPolicy);
  return id;
};
var init = function init() {
  var ipsecPolicies = _server.db.addCollection(_server.COLS.ipsec_policies);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addIpsecPolicy(ipsecPolicies, {
    name: 'aaa-default-ipsec-policy-1',
    id: 'ipsec-policy-1',
    region: 'us-east',
    authentication_algorithm: 'sha256',
    encryption_algorithm: 'aes128',
    pfs: 'group_14'
  });
  addIpsecPolicy(ipsecPolicies, {
    name: 'aaa-default-ipsec-policy-2',
    id: 'ipsec-policy-2'
  });
  addIpsecPolicy(ipsecPolicies, {
    name: 'aaa-default-ipsec-policy-3',
    id: 'ipsec-policy-3'
  });
  addIpsecPolicy(ipsecPolicies, {
    name: 'aaa-default-ipsec-policy-4',
    id: 'ipsec-policy-4',
    region: 'us-east',
    authentication_algorithm: 'md5',
    encryption_algorithm: 'triple_des',
    pfs: 'group_2'
  });
  utils.repeat(function () {
    return addIpsecPolicy(ipsecPolicies, {});
  }, DEFAULT_NUMBER_OF_IPSEC_POLICIES);
};
exports.init = init;
var formatIpsecPolicyForClient = function formatIpsecPolicyForClient(req, ipsecPolicy) {
  ipsecPolicy.href = "".concat(utils.getBaseApiUrl(req), "ipsec_policies/").concat(ipsecPolicy.id);
  ipsecPolicy.crn = utils.updateResourceCrnRegion(ipsecPolicy, req);
  ipsecPolicy.connections = utils.getConnectionsByPolicy(ipsecPolicy.id, 'ipsec_policy');
};
var formatIpsecPolicyConnectionsForClient = function formatIpsecPolicyConnectionsForClient(req, ipsecPolicy) {
  var conns = _server.db.getCollection(_server.COLS.connections).where(function (connection) {
    return _lodash["default"].get(connection, 'ipsec_policy.id') === ipsecPolicy.id;
  });
  var connections = conns.map(function (conn) {
    return (0, _connections.formatConnectionForClient)(req, conn);
  });
  return {
    connections: connections
  };
};
var createIpsecPolicy = function createIpsecPolicy(req, res) {
  var input = req.body;
  var ipsecPoliciesCol = _server.db.getCollection(_server.COLS.ipsec_policies);
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  var duplicate = utils.duplicateNameCheck(ipsecPoliciesCol, input, req, res, 'resource with that name already exists', 'ipsec_policy');
  if (duplicate) {
    return;
  }

  // Check if it's using deprecated cipher option like triple_des, md1, sha1 and etc.
  if (input.authentication_algorithm && authenticationEnumsDeprecated.indexOf(input.authentication_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The authentication algorithm ".concat(input.authentication_algorithm, " is not supported."), 'authentication_algorithm_not_supported')).end();
    return;
  }
  if (input.pfs && pfsDeprecated.indexOf(input.pfs) !== -1) {
    res.status(400).json(utils.generateErrors("The DH group ".concat(input.pfs, " is not supported."), 'dh_group_not_supported')).end();
    return;
  }
  if (input.encryption_algorithm && encryptionEnumsWithAuthDeprecated.indexOf(input.encryption_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The encryption algorithm ".concat(input.encryption_algorithm, " is not supported."), 'encryption_algorithm_not_supported')).end();
    return;
  }
  var id = addIpsecPolicy(ipsecPoliciesCol, input);
  var ipsecPolicies = ipsecPoliciesCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var ipsecPolicy = ipsecPolicies[0];
  formatIpsecPolicyForClient(req, ipsecPolicy);
  res.status(201).json(ipsecPolicy).end();
};
exports.createIpsecPolicy = createIpsecPolicy;
var deleteIpsecPolicy = function deleteIpsecPolicy(req, res) {
  var ipsecPoliciesCol = _server.db.getCollection(_server.COLS.ipsec_policies);
  var ipsecPolicy = ipsecPoliciesCol.findOne({
    id: req.params.ipsec_policy_id
  });
  if (!ipsecPolicy) {
    res.status(404).end();
    return;
  }
  ipsecPoliciesCol.remove(ipsecPolicy);
  res.status(204).end();
};
exports.deleteIpsecPolicy = deleteIpsecPolicy;
var updateIpsecPolicy = function updateIpsecPolicy(req, res) {
  var input = req.body;
  var ipsecPoliciesCol = _server.db.getCollection(_server.COLS.ipsec_policies);
  var ipsecPolicy = ipsecPoliciesCol.findOne({
    id: req.params.ipsec_policy_id
  });
  if (!ipsecPolicy) {
    res.status(404).end();
    return;
  }

  // Check if it's using deprecated cipher option like triple_des, md1, sha1 and etc.
  if (input.authentication_algorithm && authenticationEnumsDeprecated.indexOf(input.authentication_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The authentication algorithm ".concat(input.authentication_algorithm, " is not supported."), 'authentication_algorithm_not_supported')).end();
    return;
  }
  if (input.pfs && pfsDeprecated.indexOf(input.pfs) !== -1) {
    res.status(400).json(utils.generateErrors("The DH group ".concat(input.pfs, " is not supported."), 'dh_group_not_supported')).end();
    return;
  }
  if (input.encryption_algorithm && encryptionEnumsWithAuthDeprecated.indexOf(input.encryption_algorithm) !== -1) {
    res.status(400).json(utils.generateErrors("The encryption algorithm ".concat(input.encryption_algorithm, " is not supported."), 'encryption_algorithm_not_supported')).end();
    return;
  }
  var updatedIpsecPolicy = _objectSpread(_objectSpread({}, ipsecPolicy), input);
  ipsecPoliciesCol.update(updatedIpsecPolicy);
  var resultIpsecPolicy = utils.findResource(_server.COLS.ipsec_policies, updatedIpsecPolicy.id, res);
  if (!resultIpsecPolicy) return;
  formatIpsecPolicyForClient(req, resultIpsecPolicy);
  res.status(200).json(resultIpsecPolicy).end();
};
exports.updateIpsecPolicy = updateIpsecPolicy;
var getIpsecPolicies = function getIpsecPolicies(req, res) {
  var ipsecPolicies = utils.getResources(req, _server.COLS.ipsec_policies);
  ipsecPolicies.ipsec_policies.forEach(function (ipsecPolicy) {
    return formatIpsecPolicyForClient(req, ipsecPolicy);
  });
  res.json(ipsecPolicies).end();
};
exports.getIpsecPolicies = getIpsecPolicies;
var getIpsecPolicy = function getIpsecPolicy(req, res) {
  var ipsecPolicy = utils.findResource(_server.COLS.ipsec_policies, req.params.ipsec_policy_id, res);
  if (!ipsecPolicy) return;
  formatIpsecPolicyForClient(req, ipsecPolicy);
  res.status(200).json(ipsecPolicy).end();
};
exports.getIpsecPolicy = getIpsecPolicy;
var getIpsecPolicyConnections = function getIpsecPolicyConnections(req, res) {
  var ipsecPolicy = utils.findResource(_server.COLS.ipsec_policies, req.params.ipsec_policy_id, res);
  if (!ipsecPolicy) return;
  res.status(200).json(formatIpsecPolicyConnectionsForClient(req, ipsecPolicy)).end();
};
exports.getIpsecPolicyConnections = getIpsecPolicyConnections;