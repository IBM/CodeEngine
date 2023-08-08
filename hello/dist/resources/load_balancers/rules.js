"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateListenerPolicyRule = exports.getLoadBalancerListenerPolicyRules = exports.getListenerPolicyRule = exports.deleteLoadBalancerListenerPolicyRule = exports.createListenerPolicyRule = exports.addPolicyRule = void 0;
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _server = require("../../server");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var ruleType = ['path', 'hostname', 'header', 'query', 'body'];
var ruleCondition = ['contains', 'equals', 'matches_regex'];
var PolicyRule = function PolicyRule() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var rule = {
    id: casual.uuid,
    created_at: utils.generateCreateDate(),
    provisioning_status: data.provisioning_status || casual.random_element(_common.provisioningStatuses),
    condition: data.condition || casual.random_element(ruleCondition),
    type: data.type || casual.random_element(ruleType),
    value: data.value || "".concat(casual.word, "-rule-value")
  };
  if (rule.type === 'header') {
    rule.field = data.field || "".concat(casual.word, "-rule-field");
  }
  if (rule.type === 'query' || rule.type === 'body') {
    if (data.field) rule.field = data.field;
  }
  return rule;
};

/**
 * addRuleHref()
 *
 * @param {*} req
 * @param {*} rule - load balancer listener policy rule
 */
var addRuleHref = function addRuleHref(baseApiUrl, lbId, listenerId, policyId, rule) {
  rule.href = "".concat(baseApiUrl, "load_balancers/").concat(lbId, "/listeners/").concat(listenerId, "/policies/").concat(policyId, "/rules/").concat(rule.id);
  return rule;
};
var getLBpolicy = function getLBpolicy(req, res) {
  var lbId = req.params.load_balancer_id;
  var lb = (0, _common.getLoadBalancerFromDB)(lbId, res);
  if (!lb) {
    res.status(404).end();
    return null;
  }
  var listenerId = req.params.listener_id;
  var lbl = (lb.listeners || []).find(function (lbListener) {
    return lbListener.id === listenerId;
  });
  if (!lbl) {
    res.status(404).end();
    return null;
  }
  var policyId = req.params.policy_id;
  var lbp = (lbl.policies || []).find(function (lbPolicy) {
    return lbPolicy.id === policyId;
  });
  if (!lbp) {
    res.status(404).end();
    return null;
  }
  return lbp;
};

/*
 * Get rules for specific load balancer listener policy
 */
var getLoadBalancerListenerPolicyRules = function getLoadBalancerListenerPolicyRules(req, res) {
  var lbp = getLBpolicy(req, res);
  if (lbp) {
    var lbRules = (lbp.rules || []).map(function (rule) {
      return addRuleHref(utils.getBaseApiUrl(req), req.params.load_balancer_id, req.params.listener_id, req.params.policy_id, rule);
    });
    res.json({
      rules: lbRules
    }).end();
  }
};
exports.getLoadBalancerListenerPolicyRules = getLoadBalancerListenerPolicyRules;
var addPolicyRule = function addPolicyRule(data) {
  return new PolicyRule(data);
};

// eslint-disable-next-line default-param-last
exports.addPolicyRule = addPolicyRule;
var hasMissingInputFields = function hasMissingInputFields() {
  var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var res = arguments.length > 1 ? arguments[1] : undefined;
  var hasMissedFields = false;
  if (!('type' in input)) {
    res.status(400).json(utils.generateErrors('required field missing ', 'rule_missing_type', 'field')).end();
    hasMissedFields = true;
  }
  if (!('condition' in input)) {
    res.status(400).json(utils.generateErrors('required field missing ', 'rule_missing_condition', 'field')).end();
    hasMissedFields = true;
  }
  if (!('value' in input)) {
    res.status(400).json(utils.generateErrors('required field missing ', 'rule_missing_value', 'field')).end();
    hasMissedFields = true;
  }
  if (input.type === 'header' && !('field' in input)) {
    res.status(400).json(utils.generateErrors('required field missing ', 'rule_missing_field', 'field')).end();
    hasMissedFields = true;
  }
  return hasMissedFields;
};
var createListenerPolicyRule = function createListenerPolicyRule(req, res) {
  var input = req.body;
  var lbp = getLBpolicy(req, res);
  if (lbp && !hasMissingInputFields(input, res)) {
    var rule = PolicyRule(_objectSpread(_objectSpread({}, input), {}, {
      provisioning_status: 'create_pending'
    }));
    if (lbp.rules) {
      lbp.rules.push(rule);
    } else {
      lbp.rules = [rule];
    }
    var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
    var loadBalancers = load_balancers.find({
      id: req.params.load_balancer_id
    });
    var lb = loadBalancers && loadBalancers[0];
    load_balancers.update(lb);
    return res.status(201).json(rule).end();
  }
  return null;
};
exports.createListenerPolicyRule = createListenerPolicyRule;
var updateListenerPolicyRule = function updateListenerPolicyRule(req, res) {
  var lbp = getLBpolicy(req, res);
  var input = req.body;
  if (lbp && !hasMissingInputFields(input, res, lbp.rules.map(function (r) {
    return r.id;
  }))) {
    var _req$params = req.params,
      load_balancer_id = _req$params.load_balancer_id,
      id = _req$params.id;
    var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
    var loadBalancers = load_balancers.find({
      id: load_balancer_id
    });
    var loadBalancer = loadBalancers && loadBalancers[0];
    var lbpr = lbp.rules.find(function (rule) {
      return rule.id === id;
    });
    if (!lbpr) {
      return res.status(404).end();
    }
    Object.assign(lbpr, input);
    load_balancers.update(loadBalancer);
    return res.status(200).json(lbpr).end();
  }
  return res.status(404).end();
};
exports.updateListenerPolicyRule = updateListenerPolicyRule;
var deleteLoadBalancerListenerPolicyRule = function deleteLoadBalancerListenerPolicyRule(req, res) {
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var _req$params2 = req.params,
    load_balancer_id = _req$params2.load_balancer_id,
    listener_id = _req$params2.listener_id,
    policy_id = _req$params2.policy_id,
    id = _req$params2.id;
  var loadBalancers = load_balancers.find({
    id: load_balancer_id
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  if (loadBalancer) {
    var lbl = loadBalancer.listeners.find(function (listener) {
      return listener.id === listener_id;
    });
    if (lbl) {
      var lbp = lbl.policies.find(function (policy) {
        return policy.id === policy_id;
      });
      if (lbp) {
        var lbprIndex = lbp.rules.findIndex(function (rule) {
          return rule.id === id;
        });
        if (lbprIndex > -1) {
          lbp.rules.splice(lbprIndex, 1);
          load_balancers.update(loadBalancer);
          return res.status(204).end();
        }
      }
    }
  }
  return res.status(404).end();
};
exports.deleteLoadBalancerListenerPolicyRule = deleteLoadBalancerListenerPolicyRule;
var getListenerPolicyRule = function getListenerPolicyRule(req, res) {
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
  var policyRule = lblpolicy.rules.find(function (rule) {
    return rule.id === req.params.id;
  });
  if (!policyRule) {
    res.status(404).end();
    return null;
  }
  return res.json(_objectSpread({}, policyRule)).end();
};
exports.getListenerPolicyRule = getListenerPolicyRule;