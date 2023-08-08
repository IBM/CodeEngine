"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var load_balancer_resources = _interopRequireWildcard(require("../resources/load_balancers/load_balancers"));
var pools = _interopRequireWildcard(require("../resources/load_balancers/pools"));
var listeners = _interopRequireWildcard(require("../resources/load_balancers/listeners"));
var members = _interopRequireWildcard(require("../resources/load_balancers/members"));
var statistics = _interopRequireWildcard(require("../resources/load_balancers/statistics"));
var policies = _interopRequireWildcard(require("../resources/load_balancers/policies"));
var rules = _interopRequireWildcard(require("../resources/load_balancers/rules"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var loadbalancers = _express["default"].Router({
  mergeParams: true
});

// load balancer api
loadbalancers.get('/', load_balancer_resources.getLoadBalancers);
loadbalancers.get('/:id', load_balancer_resources.getLoadBalancer);
loadbalancers.post('/', load_balancer_resources.createLoadBalancer);
loadbalancers.patch('/:id', load_balancer_resources.updateLoadBalancer);
loadbalancers["delete"]('/:id', load_balancer_resources.deleteLoadBalancer);

// load balancer pools api
loadbalancers.get('/:id/pools', pools.getLoadBalancerPools);
loadbalancers.get('/:load_balancer_id/pools/:id', pools.getLoadBalancerPool);
loadbalancers.patch('/:load_balancer_id/pools/:id', pools.updateLoadBalancerPool);
loadbalancers.post('/:load_balancer_id/pools', pools.createLoadBalancerPool);
loadbalancers["delete"]('/:load_balancer_id/pools/:id', pools.deleteLoadBalancerPool);

// load balancer listener api
loadbalancers.get('/:id/listeners', listeners.getLoadBalancerListeners);
loadbalancers.get('/:load_balancer_id/listeners/:id', listeners.getLoadBalancerListener);
loadbalancers.patch('/:load_balancer_id/listeners/:id', listeners.updateLoadBalancerListener);
loadbalancers.post('/:load_balancer_id/listeners', listeners.createLoadBalancerListener);
loadbalancers.post('/:load_balancer_id/listenersLayer7', listeners.createLoadBalancerListener);
loadbalancers["delete"]('/:load_balancer_id/listeners/:id', listeners.deleteLoadBalancerListener);

// load balancer listener policies api
loadbalancers.post('/:load_balancer_id/listeners/:listener_id/policies', policies.createListenerPolicy);
loadbalancers.get('/:load_balancer_id/listeners/:listener_id/policies', policies.getLoadBalancerListenerPolicies);
loadbalancers.get('/:load_balancer_id/listeners/:listener_id/policies/:policy_id', policies.getLoadBalancerListenerPolicy);
loadbalancers.patch('/:load_balancer_id/listeners/:listener_id/policies/:policy_id', policies.updateListenerPolicy);
loadbalancers["delete"]('/:load_balancer_id/listeners/:listener_id/policies/:id', policies.deleteLoadBalancerListenerPolicy);
loadbalancers.get('/:load_balancer_id/listeners/:listener_id/policies/:policy_id/rules', rules.getLoadBalancerListenerPolicyRules);
loadbalancers.post('/:load_balancer_id/listeners/:listener_id/policies/:policy_id/rules', rules.createListenerPolicyRule);
loadbalancers.get('/:load_balancer_id/listeners/:listener_id/policies/:policy_id/rules/:id', rules.getListenerPolicyRule);
loadbalancers.patch('/:load_balancer_id/listeners/:listener_id/policies/:policy_id/rules/:id', rules.updateListenerPolicyRule);
loadbalancers["delete"]('/:load_balancer_id/listeners/:listener_id/policies/:policy_id/rules/:id', rules.deleteLoadBalancerListenerPolicyRule);

// load balancer pool members api
loadbalancers.get('/:load_balancer_id/pools/:pool_id/members', members.getLoadBalancerPoolMembers);
loadbalancers.post('/:load_balancer_id/pools/:pool_id/members', members.createLoadBalancerPoolMember);
loadbalancers.put('/:load_balancer_id/pools/:pool_id/members', members.updateLoadBalancerPoolMembers);
loadbalancers.get('/:load_balancer_id/pools/:pool_id/members/:id', members.getLoadBalancerPoolMember);
loadbalancers.patch('/:load_balancer_id/pools/:pool_id/members/:id', members.updateLoadBalancerPoolMember);
loadbalancers["delete"]('/:load_balancer_id/pools/:pool_id/members/:id', members.deleteLoadBalancerPoolMember);

// load balancer statistics api
loadbalancers.get('/:id/statistics', statistics.getLoadBalancerStatistics);
var _default = loadbalancers;
exports["default"] = _default;