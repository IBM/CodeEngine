"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rejectBinding = exports.listBindings = exports.init = exports.getBinding = exports.formatBindingsForClient = exports.createBinding = exports.approveBinding = exports.addBindings = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _common = require("./common");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
// private_path_service_gateways

var addBindings = function addBindings(gateways, data) {
  var id = data.id || casual.uuid;
  var vpc = data.vpc || utils.getRandomUniqueResource(_server.COLS.vpcs);
  var endpoint_gateway = utils.getResourceReference(utils.getRandomResourceInRegion(_server.COLS.endpoint_gateways, vpc.zone.region_name));
  var oneBinding = Object.assign({
    account: {
      id: casual.uuid
    },
    created_at: utils.generateCreateDate(),
    expires_at: utils.generateLaterDate(),
    href: casual.href,
    id: endpoint_gateway.id,
    resource_type: 'private_path_service_gateway_endpoint_gateway_binding',
    status: casual.random_element(['permitted', 'denied', 'expired', 'pending']),
    updated_at: utils.generateNowDate()
  }, data);
  gateways.insert(oneBinding);
  return id;
};
exports.addBindings = addBindings;
var init = function init() {
  var accounts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var gateways = _server.db.getCollection(_server.COLS.ppsgs).chain().data().map(function (ppsg) {
    return ppsg.id;
  });
  var gateways_bindibgs = _server.db.addCollection(_server.COLS.ppsgs_bindings);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  gateways.forEach(function (ppsg) {
    utils.repeat(function () {
      addBindings(gateways_bindibgs, {
        ppsg: ppsg,
        account: {
          id: casual.random_element(accounts)
        }
      });
    }, 1);
  });
};

/*
 * This function formats the public gateway for the client.  It sets up the
 * hrefs and fills in the details of the zone, vpc, and floating IP.
 */
exports.init = init;
var formatBindingsForClient = function formatBindingsForClient(req, gateway) {
  gateway.href = "".concat(utils.getBaseApiUrl(req), "private_path_service_gateways/").concat(gateway.id);
  gateway.vpc = {
    crn: utils.generateCRN(),
    href: "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(gateway.vpc.id),
    id: gateway.vpc.id,
    name: gateway.vpc.name
  };
};
exports.formatBindingsForClient = formatBindingsForClient;
var listBindings = function listBindings(req, res) {
  var extraFilter = function extraFilter(one) {
    return one.ppsg === req.params.gateway_id;
  };
  var bindings = utils.getResources(req, _server.COLS.ppsgs_bindings, extraFilter);
  res.json(bindings).end();
};
exports.listBindings = listBindings;
var createBinding = function createBinding(req, res) {
  var input = req.body;
  input.created_at = utils.generateNowDate();
  input.ppsg = req.params.gateway_id;
  var id = addBindings(_server.db.getCollection(_server.COLS.ppsgs_bindings), input);
  var bindings = _server.db.getCollection(_server.COLS.ppsgs_bindings).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  res.status(201).json(bindings[0]).end();
};
exports.createBinding = createBinding;
var updateBinding = function updateBinding(req, res) {
  var input = req.body;
  var binding = utils.findResource(_server.COLS.ppsgs_bindings, req.params.binding_id, res, false);
  if (!binding) return;

  // Update the private path service gateway status
  var updateableFields = ['status'];
  updateableFields.forEach(function (oneField) {
    binding[oneField] = input[oneField];
  });
  if (input.update_account_policy) {
    var ppsg = utils.findResource(_server.COLS.ppsgs, req.params.gateway_id, res, false);
    var accountPolices = ppsg.accountPolices;
    accountPolices === null || accountPolices === void 0 ? void 0 : accountPolices.map(function (one) {
      if (one.account === binding.account) {
        if (binding.status === 'permitted') one.access_policy = 'permit';
        if (binding.status === 'denied') one.access_policy = 'deny';
      }
      return one;
    });
    _server.db.getCollection(_server.COLS.ppsgs).update(ppsg);
  }
  // find ppsg to update account policy

  _server.db.getCollection(_server.COLS.ppsgs_bindings).update(binding);
  res.status(202).end();
};
var getBinding = function getBinding(req, res) {
  var bindings = _server.db.getCollection(_server.COLS.ppsgs_bindings).chain().find({
    ppsg: req.params.gateway_id,
    id: req.params.binding_id
  }).data({
    removeMeta: true
  });
  if (bindings.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(bindings[0]).end();
};
exports.getBinding = getBinding;
var updateEndpointGatewayStatus = function updateEndpointGatewayStatus(req) {
  var endpointGatewayId = req.params.binding_id;
  var status = req.body.status;
  var gateway = utils.findResource(_server.COLS.endpoint_gateways, endpointGatewayId);
  if (!gateway) return;

  // Update the endpoint gateway status
  if (status === 'denied') {
    gateway.lifecycle_state = _common.LIFECYCLE_STATE.FAILED;
    gateway.lifecycle_reason = _common.VPE_LIFECYCLE_REASON.ACCESS_DENIED;
  } else {
    gateway.lifecycle_state = _common.LIFECYCLE_STATE.STABLE;
    gateway.lifecycle_reason = '';
  }
  _server.db.getCollection(_server.COLS.endpoint_gateways).update(gateway);
};
var rejectBinding = function rejectBinding(req, res) {
  req.body.status = 'denied';
  updateBinding(req, res);
  updateEndpointGatewayStatus(req);
};
exports.rejectBinding = rejectBinding;
var approveBinding = function approveBinding(req, res) {
  // find ppsg to update account policy
  req.body.status = 'permitted';
  updateBinding(req, res);
  updateEndpointGatewayStatus(req);
};
exports.approveBinding = approveBinding;