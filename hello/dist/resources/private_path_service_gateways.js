"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updatePPSG = exports.revokeAccount = exports.init = exports.getPPSGs = exports.getPPSG = exports.formatPPSGForClient = exports.deletePPSG = exports.createPPSG = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _service_endpoints = require("../utils/service_endpoints");
var ppsgs_bindings = _interopRequireWildcard(require("./private_path_service_gateways_endpoint_gateway_bindings"));
var ppsgs_account_policies = _interopRequireWildcard(require("./private_path_service_gateways_account_policies"));
var _pps = require("../utils/pps");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
var casual = require('casual');
// const LIFECYCLE_STATE = ['deleting', 'failed', 'pending', 'stable', 'suspended', 'updating', 'waiting'];
var accounts = [].concat(_toConsumableArray(utils.arrayOf(casual._uuid, 5)), [_pps.ACCOUNT_EXAMPLE]);

// private_path_service_gateways
var addPPSG = function addPPSG(gateways, data) {
  var _theLB, _theLB$subnets$;
  var id = data.id || casual.uuid;
  var region = data.regionID || utils.getRandomRegion().name;
  var theLB;
  if (data.load_balancer) {
    theLB = _server.db.getCollection(_server.COLS.load_balancers).chain().findOne({
      id: data.load_balancer.id
    }).data({
      removeMeta: true
    });
  } else {
    theLB = utils.getRandomResourceInZone(_server.COLS.load_balancers, region);
  }
  // find vpc of the load_balancer
  var theSubnetId = (_theLB = theLB) === null || _theLB === void 0 ? void 0 : (_theLB$subnets$ = _theLB.subnets[0]) === null || _theLB$subnets$ === void 0 ? void 0 : _theLB$subnets$.id;
  if (theSubnetId) {
    var theSubnet = _server.db.getCollection(_server.COLS.subnets).findOne({
      id: theSubnetId
    });
    var theVPC = theSubnet.vpc;
    data.vpc = utils.getResourceReference(theVPC);
  }
  data.load_balancer = utils.getResourceReference(theLB);
  var baseData = {
    created_at: data.created_at || utils.generateCreateDate(),
    crn: utils.generateCRN({
      region: region,
      'resource-type': 'private-path-service-gateway',
      id: id
    }),
    default_access_policy: casual.random_element(_pps.ACCESS_POLICIES),
    service_endpoints: casual.random_element([[_service_endpoints.targetEndpoint3, _service_endpoints.targetEndpoint2], [_service_endpoints.targetEndpoint1]]),
    endpoint_gateways_count: 0,
    href: '',
    // Placholder
    id: id,
    name: casual.word,
    is_published: false,
    lifecycle_state: 'stable',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'private_path_service_gateway',
    region: region,
    zonal_affinity: casual["boolean"]
  };
  var ppsg = _objectSpread(_objectSpread({}, baseData), data);
  gateways.insert(ppsg);
  return id;
};
var init = function init() {
  var gateways = _server.db.addCollection(_server.COLS.ppsgs);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addPPSG(gateways, {
    name: 'aaa-default-ppsg-1',
    account_policies: [{
      account: _pps.ACCOUNT_EXAMPLE,
      access_policy: casual.random_element(_pps.ACCESS_POLICIES)
    }],
    id: 'a56cf208-d9ed-40bf-ppsg-044000104547',
    region: 'us-east'
  });
  addPPSG(gateways, {
    name: 'aaa-default-ppsg-2',
    account_policies: [{
      account: _pps.ACCOUNT_EXAMPLE,
      access_policy: casual.random_element(_pps.ACCESS_POLICIES)
    }],
    id: 'cb0c0923-fe82-4bdc-ppsg-8795522735cc',
    region: 'us-east'
  });
  utils.repeat(function () {
    addPPSG(gateways, {
      account_policies: [{
        account: _pps.ACCOUNT_EXAMPLE,
        access_policy: casual.random_element(_pps.ACCESS_POLICIES)
      }]
    });
  }, 5);

  // init bindings
  ppsgs_bindings.init(accounts);
  ppsgs_account_policies.init();
};

/*
 * This function formats the private path service gatewayfor the client.  It sets up the
 * hrefs and fills in the details of the zone, vpc, and floating IP.
 */
exports.init = init;
var formatPPSGForClient = function formatPPSGForClient(req, gateway) {
  gateway.href = "".concat(utils.getBaseApiUrl(req), "/private_path_service_gateways/").concat(gateway.id);
  gateway.vpc = utils.formatResourceLinkForClient(req, 'vpc', gateway.vpc);
  gateway.load_balancer = utils.formatResourceLinkForClient(req, 'load_balancer', gateway.load_balancer);
  return gateway;
};
exports.formatPPSGForClient = formatPPSGForClient;
var getPPSGs = function getPPSGs(req, res) {
  var _gateways$private_pat;
  var gateways = utils.getResources(req, _server.COLS.ppsgs);
  (_gateways$private_pat = gateways.private_path_service_gateways) === null || _gateways$private_pat === void 0 ? void 0 : _gateways$private_pat.forEach(function (gateway) {
    return formatPPSGForClient(req, gateway);
  });
  res.json(gateways).end();
};
exports.getPPSGs = getPPSGs;
var getPPSG = function getPPSG(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.ppsgs).chain().find({
    id: req.params.gateway_id
  }).data({
    removeMeta: true
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(formatPPSGForClient(req, gateway[0])).end();
};
exports.getPPSG = getPPSG;
var deletePPSG = function deletePPSG(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.ppsgs).find({
    id: req.params.gateway_id
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.ppsgs).findAndRemove({
    id: req.params.gateway_id
  });
  res.status(204).end();
};
exports.deletePPSG = deletePPSG;
var revokeAccount = function revokeAccount(req, res) {
  var gatewayId = req.params.gateway_id;
  var accountId = req.body.id;
  var gateway = _server.db.getCollection(_server.COLS.ppsgs).find({
    id: gatewayId
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  // remove all bindings and change account_policy reject for this account
  var bindings = _server.db.getCollection(_server.COLS.ppsgs_bindings).where(function (oneBinding) {
    return oneBinding.ppsg === gatewayId && oneBinding.account.id === accountId;
  });
  bindings.forEach(function (oneBind) {
    _server.db.getCollection(_server.COLS.ppsgs_bindings).findAndRemove({
      id: oneBind.id
    });
  });
  var account_policies = _server.db.addCollection(_server.COLS.ppsgs_account_policies);
  var theAccountPolicy = account_policies.where(function (item) {
    return item.ppsg === gatewayId && item.account.id === accountId;
  });
  if (theAccountPolicy.length > 0) {
    theAccountPolicy[0].access_policy = 'deny';
    account_policies.update(theAccountPolicy[0]);
  } else {
    ppsgs_account_policies.addAccountPolicies(account_policies, {
      ppsg: gatewayId,
      account: {
        id: accountId
      },
      access_policy: 'deny'
    });
  }
  res.status(202).end();
};
exports.revokeAccount = revokeAccount;
var updatePPSG = function updatePPSG(req, res) {
  var input = req.body;
  var gateway = utils.findResource(_server.COLS.ppsgs, req.params.gateway_id, res, false);
  if (!gateway) return;
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.ppsgs), input, req, res, 'private path service gatewayalready exists', 'private_path_service_gateway')) {
    return;
  }

  // Update the private path service gatewayname
  var updateableFields = ['name', 'is_published', 'zonal_affinity', 'default_access_policy', 'account_policies'];
  var inputFields = Object.keys(input);
  inputFields.forEach(function (oneField) {
    if (updateableFields.includes(oneField)) {
      gateway[oneField] = input[oneField];
    }
  });
  _server.db.getCollection(_server.COLS.ppsgs).update(gateway);

  // Get the updated PGW and output it to the client.
  var resultPGW = utils.findResource(_server.COLS.ppsgs, req.params.gateway_id, res, true);
  res.status(200).json(resultPGW).end();
};
exports.updatePPSG = updatePPSG;
var createPPSG = function createPPSG(req, res) {
  var input = req.body;

  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  // RIAS allows blank on this field
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.ppsgs), input, req, res, 'private path service gatewayis already existed', 'private_path_service_gateway')) {
    return;
  }
  input.created_at = utils.generateNowDate();
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  var id = addPPSG(_server.db.getCollection(_server.COLS.ppsgs), input);
  var gateways = _server.db.getCollection(_server.COLS.ppsgs).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  res.status(201).json(gateways[0]).end();
};
exports.createPPSG = createPPSG;