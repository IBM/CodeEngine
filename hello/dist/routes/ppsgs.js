"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var ppsgs = _interopRequireWildcard(require("../resources/private_path_service_gateways"));
var bindings = _interopRequireWildcard(require("../resources/private_path_service_gateways_endpoint_gateway_bindings"));
var accountPolices = _interopRequireWildcard(require("../resources/private_path_service_gateways_account_policies"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var ppsgsRouter = _express["default"].Router({
  mergeParams: true
});

// load balancer api
ppsgsRouter.post('/', ppsgs.createPPSG);
ppsgsRouter.get('/', ppsgs.getPPSGs);
ppsgsRouter.get('/:gateway_id', ppsgs.getPPSG);
ppsgsRouter.patch('/:gateway_id', ppsgs.updatePPSG);
ppsgsRouter["delete"]('/:gateway_id', ppsgs.deletePPSG);
ppsgsRouter.post('/:gateway_id/revoke_account', ppsgs.revokeAccount);
ppsgsRouter.get('/:gateway_id/endpoint_gateway_bindings', bindings.listBindings);
ppsgsRouter.post('/:gateway_id/endpoint_gateway_bindings', bindings.createBinding);
ppsgsRouter.get('/:gateway_id/endpoint_gateway_bindings/:binding_id', bindings.getBinding);
ppsgsRouter.post('/:gateway_id/endpoint_gateway_bindings/:binding_id/approve', bindings.approveBinding);
ppsgsRouter.post('/:gateway_id/endpoint_gateway_bindings/:binding_id/reject', bindings.rejectBinding);
ppsgsRouter.get('/:gateway_id/account_policies', accountPolices.listAccountPolicies);
ppsgsRouter.post('/:gateway_id/account_policies', accountPolices.createAccountPolicy);
ppsgsRouter.get('/:gateway_id/account_policies/:policy_id', accountPolices.getAccountPolicy);
ppsgsRouter.patch('/:gateway_id/account_policies/:policy_id', accountPolices.updateAccountPolicy);
ppsgsRouter["delete"]('/:gateway_id/account_policies/:policy_id', accountPolices.deleteAccountPolicy);
var _default = ppsgsRouter;
exports["default"] = _default;