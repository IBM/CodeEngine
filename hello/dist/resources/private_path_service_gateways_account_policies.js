"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateAccountPolicy = exports.listAccountPolicies = exports.init = exports.getAccountPolicy = exports.formatAccountPoliciesForClient = exports.deleteAccountPolicy = exports.createAccountPolicy = exports.addAccountPolicies = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _pps = require("../utils/pps");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
// private_path_service_gateways

var addAccountPolicies = function addAccountPolicies(policies, data) {
  var id = data.id || casual.uuid;
  var oneAccountPolicy = Object.assign({
    account: {
      id: _pps.ACCOUNT_EXAMPLE
    },
    created_at: utils.generateCreateDate(),
    access_policy: casual.random_element(_pps.ACCESS_POLICIES),
    href: '',
    id: id,
    name: casual.name,
    resource_type: 'private_path_service_gateway_account_policy',
    updated_at: utils.generateNowDate()
  }, data);
  policies.insert(oneAccountPolicy);
  return id;
};
exports.addAccountPolicies = addAccountPolicies;
var init = function init() {
  var gateways = _server.db.getCollection(_server.COLS.ppsgs).chain().data().map(function (ppsg) {
    return ppsg.id;
  });
  var ppsgs_account_policies = _server.db.addCollection(_server.COLS.ppsgs_account_policies);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  gateways.forEach(function (ppsg) {
    utils.repeat(function () {
      addAccountPolicies(ppsgs_account_policies, {
        ppsg: ppsg
      });
    }, 1);
  });
};

/*
 * This function formats the public gateway for the client.  It sets up the
 * hrefs and fills in the details of the zone, vpc, and floating IP.
 */
exports.init = init;
var formatAccountPoliciesForClient = function formatAccountPoliciesForClient(req, policy) {
  policy.href = "".concat(utils.getBaseApiUrl(req), "private_path_service_gateways/").concat(policy.ppsg, "/account_policies/").concat(policy.id);
};
exports.formatAccountPoliciesForClient = formatAccountPoliciesForClient;
var listAccountPolicies = function listAccountPolicies(req, res) {
  var _accountPolicies$acco;
  var extraFilter = function extraFilter(one) {
    return one.ppsg === req.params.gateway_id;
  };
  var accountPolicies = utils.getResources(req, _server.COLS.ppsgs_account_policies, extraFilter);
  (_accountPolicies$acco = accountPolicies.account_policies) === null || _accountPolicies$acco === void 0 ? void 0 : _accountPolicies$acco.forEach(function (one) {
    formatAccountPoliciesForClient(req, one);
  });
  res.json(accountPolicies).end();
};
exports.listAccountPolicies = listAccountPolicies;
var createAccountPolicy = function createAccountPolicy(req, res) {
  var input = req.body;
  input.created_at = utils.generateNowDate();
  input.ppsg = req.params.gateway_id;
  var id = addAccountPolicies(_server.db.getCollection(_server.COLS.ppsgs_account_policies), input);
  var accountPolicies = _server.db.getCollection(_server.COLS.ppsgs_account_policies).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var result = accountPolicies[0];
  formatAccountPoliciesForClient(req, result);
  res.status(201).json(result).end();
};
exports.createAccountPolicy = createAccountPolicy;
var updateAccountPolicy = function updateAccountPolicy(req, res) {
  var input = req.body;
  var accountPolicy = utils.findResource(_server.COLS.ppsgs_account_policies, req.params.policy_id, res, false);
  if (!accountPolicy) return;

  // Update the private path service gateway status
  var updateableFields = ['access_policy', 'name'];
  updateableFields.forEach(function (oneField) {
    if (input[oneField]) {
      accountPolicy[oneField] = input[oneField];
    }
  });
  _server.db.getCollection(_server.COLS.ppsgs_account_policies).update(accountPolicy);
  res.status(202).json(accountPolicy).end();
};
exports.updateAccountPolicy = updateAccountPolicy;
var getAccountPolicy = function getAccountPolicy(req, res) {
  var accountPolicies = _server.db.getCollection(_server.COLS.ppsgs_account_policies).chain().find({
    ppsg: req.params.gateway_id,
    id: req.params.policy_id
  }).data({
    removeMeta: true
  });
  if (accountPolicies.length === 0) {
    res.status(404).end();
    return;
  }
  var result = accountPolicies[0];
  formatAccountPoliciesForClient(req, result);
  res.json(result).end();
};
exports.getAccountPolicy = getAccountPolicy;
var deleteAccountPolicy = function deleteAccountPolicy(req, res) {
  var policy = _server.db.getCollection(_server.COLS.ppsgs_account_policies).chain().find({
    ppsg: req.params.gateway_id,
    id: req.params.policy_id
  }).data({
    removeMeta: true
  });
  if (policy.length === 0) {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.ppsgs_account_policies).findAndRemove({
    id: req.params.policy_id
  });
  res.status(204).end();
};
exports.deleteAccountPolicy = deleteAccountPolicy;