"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateListenerPolicy = exports.getLoadBalancerListenerPolicy = exports.getLoadBalancerListenerPolicies = exports.deleteLoadBalancerListenerPolicy = exports.createListenerPolicy = exports.addPolicy = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _rules = require("./rules");
var _server = require("../../server");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var policyActions = ['forward', 'redirect', 'reject'];
var statusCodes = [301, 302, 303, 307, 308];
var Policy = function Policy() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var pools = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var policy = {
    id: data.id || casual.uuid,
    name: data.name || "".concat(casual.color_name, "-Policy"),
    created_at: utils.generateCreateDate(),
    provisioning_status: data.provisioning_status || casual.random_element(_common.provisioningStatuses),
    action: data.action || casual.random_element(policyActions),
    priority: data.priority || casual.integer(1, 10),
    rules: data.rules || utils.repeat(function () {
      return (0, _rules.addPolicyRule)();
    }, casual.integer(1, 4))
  };
  if (policy.action === 'forward') {
    var poolId = _lodash["default"].get(data, 'target.id');
    var pool = poolId ? pools.find(function (p) {
      return p.id === poolId;
    }) : casual.random_element(pools);
    policy.target = {
      id: pool.id,
      name: pool.name
    };
  } else if (policy.action === 'redirect') {
    var redirectInfo = _lodash["default"].get(data, 'target', {});
    policy.target = {
      http_status_code: redirectInfo.http_status_code || casual.random_element(statusCodes),
      url: redirectInfo.url || casual.url
    };
  } else if (policy.action === 'https_redirect') {
    var _redirectInfo = _lodash["default"].get(data, 'target', {});
    policy.target = {
      http_status_code: _redirectInfo.http_status_code || casual.random_element(statusCodes)
    };
    var listener = _lodash["default"].get(data, 'target.listener', {});
    if (listener.id) {
      policy.target.listener = listener;
      policy.target.uri = _redirectInfo.uri || casual.url;
    }
  }
  return policy;
};

/**
 * addPolicyHref()
 *
 * @param {*} req
 * @param {*} p - load balancer listener policy
 */
var addPolicyHref = function addPolicyHref(req, p) {
  // eslint-disable-next-line max-len
  p.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(req.params.load_balancer_id, "/listeners/").concat(req.params.listener_id, "/policies/").concat(p.id);
  return p;
};
var getLBListener = function getLBListener(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    res.status(404).end();
    return null;
  }
  var lbl = lb.listeners.find(function (lbListener) {
    return lbListener.id === req.params.listener_id;
  });
  if (!lbl) {
    res.status(404).end();
    return null;
  }
  return {
    lbl: lbl,
    pools: lb.pools
  };
};

/*
 * Get load balancer listener policies
 */
var getLoadBalancerListenerPolicies = function getLoadBalancerListenerPolicies(req, res) {
  var listener = getLBListener(req, res);
  if (listener && listener.lbl) {
    var lbPolicies = (listener.lbl.policies || []).map(function (policy) {
      return addPolicyHref(req, policy);
    });
    res.json({
      policies: lbPolicies
    }).end();
  }
};
exports.getLoadBalancerListenerPolicies = getLoadBalancerListenerPolicies;
var deleteLoadBalancerListenerPolicy = function deleteLoadBalancerListenerPolicy(req, res) {
  var _getLBListener = getLBListener(req, res),
    lbl = _getLBListener.lbl;
  if (lbl) {
    var _req$params = req.params,
      load_balancer_id = _req$params.load_balancer_id,
      id = _req$params.id;
    var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
    var loadBalancers = load_balancers.find({
      id: load_balancer_id
    });
    var loadBalancer = loadBalancers && loadBalancers[0];
    var lbpIndex = lbl.policies.findIndex(function (policy) {
      return policy.id === id;
    });
    if (lbpIndex > -1) {
      lbl.policies.splice(lbpIndex, 1);
      load_balancers.update(loadBalancer);
      return res.status(204).end();
    }
  }
  return res.status(404).end();
};
exports.deleteLoadBalancerListenerPolicy = deleteLoadBalancerListenerPolicy;
var addPolicy = function addPolicy(initialData, pools) {
  return new Policy(initialData, pools);
};

// eslint-disable-next-line default-param-last
exports.addPolicy = addPolicy;
var validateInputFields = function validateInputFields(call) {
  var input = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var res = arguments.length > 2 ? arguments[2] : undefined;
  var poolIds = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var hasInvalidFields = false;
  if (!input.priority) {
    res.status(400).json(utils.generateErrors('required field missing ', 'policy_missing_priority', 'field')).end();
    hasInvalidFields = true;
  }
  if (!input.action && call === 'create') {
    res.status(400).json(utils.generateErrors('required field missing ', 'policy_missing_action', 'field')).end();
    hasInvalidFields = true;
  }
  if (input.action === 'redirect' && !_lodash["default"].get(input, 'target.http_status_code')) {
    res.status(400).json(utils.generateErrors('required field missing ', 'policy_missing_redirect_status_code', 'field')).end();
    hasInvalidFields = true;
  }
  if (input.action === 'redirect' && !_lodash["default"].get(input, 'target.listener') && !_lodash["default"].get(input, 'target.url')) {
    res.status(400).json(utils.generateErrors('required field missing ', 'policy_missing_redirect_url', 'field')).end();
    hasInvalidFields = true;
  }
  if (input.action === 'forward' && _lodash["default"].get(input, 'target.id') && poolIds.indexOf(input.target.id) === -1) {
    res.status(400).json(utils.generateErrors('required field missing ', 'policy_invalid_forward_pool_id', 'field')).end();
    hasInvalidFields = true;
  }
  return hasInvalidFields;
};
var createListenerPolicy = function createListenerPolicy(req, res) {
  var input = req.body;
  var _getLBListener2 = getLBListener(req, res),
    lbl = _getLBListener2.lbl,
    pools = _getLBListener2.pools;
  if (lbl && !validateInputFields('create', input, res, pools.map(function (p) {
    return p.id;
  }))) {
    var policy = Policy(_objectSpread(_objectSpread({}, input), {}, {
      provisioning_status: 'create_pending',
      rules: []
    }), pools);
    if (lbl.policies) {
      lbl.policies.push(policy);
    } else {
      lbl.policies = [policy];
    }
    if (input.rules) {
      policy.rules = input.rules.map(function (rule) {
        return (0, _rules.addPolicyRule)(rule);
      });
    }
    var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
    var loadBalancers = load_balancers.find({
      id: req.params.load_balancer_id
    });
    var lb = loadBalancers && loadBalancers[0];
    load_balancers.update(lb);
    return res.status(201).json(policy).end();
  }
  return null;
};
exports.createListenerPolicy = createListenerPolicy;
var updateListenerPolicy = function updateListenerPolicy(req, res) {
  var _getLBListener3 = getLBListener(req, res),
    lbl = _getLBListener3.lbl,
    pools = _getLBListener3.pools;
  var input = req.body;
  delete input.action;
  if (lbl && !validateInputFields('update', input, res, pools.map(function (p) {
    return p.policy_id;
  }))) {
    var _req$params2 = req.params,
      load_balancer_id = _req$params2.load_balancer_id,
      policy_id = _req$params2.policy_id;
    var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
    var loadBalancers = load_balancers.find({
      id: load_balancer_id
    });
    var loadBalancer = loadBalancers && loadBalancers[0];
    var lbp = lbl.policies.find(function (policy) {
      return policy.id === policy_id;
    });
    if (!lbp) {
      return res.status(404).end();
    }
    Object.assign(lbp, input);
    load_balancers.update(loadBalancer);
    return res.status(200).json(lbp).end();
  }
  return res.status(404).end();
};
exports.updateListenerPolicy = updateListenerPolicy;
var getLoadBalancerListenerPolicy = function getLoadBalancerListenerPolicy(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    res.status(404).end();
    return null;
  }
  var lbl = lb.listeners.find(function (lbListener) {
    return lbListener.id === req.params.listener_id;
  });
  if (!lbl) {
    res.status(404).end();
    return null;
  }
  var lblpolicy = lbl.policies.find(function (policy) {
    return policy.id === req.params.policy_id;
  });
  if (!lblpolicy) {
    res.status(404).end();
    return null;
  }
  return res.json(_objectSpread({}, lblpolicy)).end();
};
exports.getLoadBalancerListenerPolicy = getLoadBalancerListenerPolicy;