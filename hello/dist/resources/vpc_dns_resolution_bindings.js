"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateDnsResolutionBinding = exports.init = exports.getDnsResolutionBindings = exports.getDnsResolutionBinding = exports.formatDnsBindingsForClient = exports.deleteDnsResolutionBinding = exports.createDnsResolutionBinding = exports.addDnsResolutionBinding = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _common = require("./common");
var _features = require("./features");
var _vpcs = require("./vpcs");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var deleteDnsResolutionBinding = function deleteDnsResolutionBinding(req, res) {
  var dnsCol = _server.db.getCollection(_server.COLS.vpcsDnsBindings);
  var dnsBinding = dnsCol.findOne({
    id: req.params.id
  });
  if (!dnsBinding) {
    res.status(404).end();
    return;
  }
  dnsCol.remove(dnsBinding);
  var hubVpc = req.params.vpc_id;
  var spokeVpc = dnsBinding.vpc.id;
  // update spoke resolutionBindingCount
  (0, _vpcs.udpateVpcDnsResolutionBindingCount)(spokeVpc, -1);
  // update hub resolutionBindingCount
  (0, _vpcs.udpateVpcDnsResolutionBindingCount)(hubVpc, -1);
  res.status(204).end();
};

/**
 * addDnsResolutionBinding()
 *
 * @param {*} dns_resolution_bindings: List of dns resolution bindings
 * @param {*} data: details of the new dns_bindings to be added to the list
 */
// eslint-disable-next-line no-unused-vars
exports.deleteDnsResolutionBinding = deleteDnsResolutionBinding;
var addDnsResolutionBinding = function addDnsResolutionBinding(dns_resolution_bindings, data) {
  var _hub, _hub2, _hub3;
  // spokeVPC as id, but hubVpc as crn
  var hubVpc = data.hubVpc,
    name = data.name,
    spokeVpc = data.spokeVpc;
  if (hubVpc) {
    // A vpcId was supplied so retrieve it.
    var spoke = utils.findResource(_server.COLS.vpcs, spokeVpc);
    if (spoke !== null && spoke !== void 0 && spoke.enable_hub) {
      throw new Error('Current VPC is Hub VPC, and now it is not support to create dns_resolution_bindings from Hub VPC.');
    }
    data.zone = spoke.zone;
  }
  var hub;
  if (hubVpc !== null && hubVpc !== void 0 && hubVpc.crn) {
    hub = utils.findResourceByCrn(_server.COLS.vpcs, hubVpc.crn);
  } else {
    hub = utils.findResource(_server.COLS.vpcs, hubVpc);
  }
  var baseData = {
    _spoke_id: spokeVpc,
    created_at: data.created_at || utils.generateCreateDate(),
    href: '',
    // Placeholder
    id: data.id || _casual["default"].uuid,
    lifecycle_state: data.lifecycle_state || _casual["default"].random_element(Object.values(_common.LIFECYCLE_STATE)),
    name: name || utils.generateName('dns_resolution_bindings', null),
    resource_type: 'vpc_dns_resolution_binding',
    vpc: {
      id: (_hub = hub) === null || _hub === void 0 ? void 0 : _hub.id,
      crn: (_hub2 = hub) === null || _hub2 === void 0 ? void 0 : _hub2.crn,
      name: (_hub3 = hub) === null || _hub3 === void 0 ? void 0 : _hub3.name
    },
    zone: data.zone
  };
  // update spoke resolutionBindingCount
  (0, _vpcs.udpateVpcDnsResolutionBindingCount)(spokeVpc, +1);
  // update hub resolutionBindingCount
  (0, _vpcs.udpateVpcDnsResolutionBindingCount)(hub.id, +1);
  dns_resolution_bindings.insert(baseData);
  return baseData.id;
};

/**
 * init()
 *
 */
exports.addDnsResolutionBinding = addDnsResolutionBinding;
var init = function init() {
  var dns_resolution_bindings = _server.db.addCollection(_server.COLS.vpcsDnsBindings);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // THIS ONE IS SPECIAL FOR THE A11Y TEST WE NEED ID 1.
  addDnsResolutionBinding(dns_resolution_bindings, {
    spokeVpc: 'vpc1002-dns',
    hubVpc: 'vpc1001',
    name: 'bindings_vpc1002-dns_vpc1001'
  });
  addDnsResolutionBinding(dns_resolution_bindings, {
    spokeVpc: 'vpc1002',
    hubVpc: 'vpc1001',
    name: 'bindings_vpc1002_vpc1001'
  });
  addDnsResolutionBinding(dns_resolution_bindings, {
    spokeVpc: '1111-11111111-1111-1111-1111-111111111111',
    hubVpc: 'vpc1001',
    name: 'bindings_1111-11111111-1111-1111-1111-111111111111_vpc1001'
  });
  addDnsResolutionBinding(dns_resolution_bindings, {
    spokeVpc: '4444-4444444-4444-4444-4444-4444444444444',
    hubVpc: 'vpc1001',
    name: 'bindings_4444-4444444-4444-4444-4444-4444444444444_vpc1001'
  });
  addDnsResolutionBinding(dns_resolution_bindings, {
    spokeVpc: '4444-4444444-4444-4444-zonal-4444444444444',
    hubVpc: 'vpc1001',
    name: 'bindings_4444-4444444-4444-4444-zonal-4444444444444_vpc1001'
  });
};

/**
 * formatDnsBindingsForClient()
 *
 * @param {*} req
 * @param {*} dns_bindings
 */
// eslint-disable-next-line no-unused-vars
exports.init = init;
var formatDnsBindingsForClient = function formatDnsBindingsForClient(dns_bindings, req, res, callFromHubVpc) {
  var created_at = dns_bindings.created_at,
    id = dns_bindings.id,
    lifecycle_state = dns_bindings.lifecycle_state,
    name = dns_bindings.name,
    resource_type = dns_bindings.resource_type,
    hubVpc = dns_bindings.vpc,
    _spoke_id = dns_bindings._spoke_id;
  var spokeVpc = utils.findResource(_server.COLS.vpcs, _spoke_id);
  var connectHostId;
  var connectTargetId;
  var connectTarget;
  if (!callFromHubVpc) {
    connectHostId = id;
    connectTargetId = _spoke_id;
    connectTarget = spokeVpc;
  } else {
    connectHostId = _spoke_id;
    connectTargetId = id;
    connectTarget = hubVpc;
  }

  // Get the href for this dns_bindings
  var href = "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(connectHostId, "/dns_resolution_bindings/").concat(connectTargetId);
  var filter = function filter(oneVPE) {
    return oneVPE.vpc.id === connectHostId && oneVPE.allow_dns_resolution_binding === true;
  };
  var shareVPEs = utils.getResources(req, _server.COLS.endpoint_gateways, filter);
  var result = {
    created_at: created_at,
    href: href,
    id: id,
    lifecycle_state: lifecycle_state,
    name: name,
    vpc: {
      crn: connectTarget.crn,
      name: connectTarget.name,
      id: connectTarget.id
    },
    endpoint_gateways: shareVPEs.endpoint_gateways,
    resource_type: resource_type
  };
  return result;
};

/**
 * getDnsResolutionBindings()
 *
 * Get a list of dns resolution bindings for a VPC.
 *
 * GET /vpcs/{vpc_id}/dns_resolution_bindings
 *
 * @param {*} req
 * @param {*} res
 */
exports.formatDnsBindingsForClient = formatDnsBindingsForClient;
var getDnsResolutionBindings = function getDnsResolutionBindings(req, res) {
  var _dns_resolution_bindi, _dns_resolution_bindi2, _dns_resolution_bindi3, _dns_resolution_bindi4;
  var spokeId = req.params.vpc_id;
  // Validate that the VPC exists
  var spokeVpc = utils.findResource(_server.COLS.vpcs, spokeId, res, false);
  if (!spokeVpc) {
    // Not found report a 404 error.
    return;
  }
  var spokeVpcFilter = function spokeVpcFilter(dns_bindings) {
    return dns_bindings._spoke_id === spokeId;
  };
  var hubVpcFilter;
  var dns_resolution_bindings = utils.getResources(req, _server.COLS.vpcsDnsBindings, spokeVpcFilter);
  if (((_dns_resolution_bindi = dns_resolution_bindings) === null || _dns_resolution_bindi === void 0 ? void 0 : (_dns_resolution_bindi2 = _dns_resolution_bindi.dns_resolution_bindings) === null || _dns_resolution_bindi2 === void 0 ? void 0 : _dns_resolution_bindi2.length) === 0) {
    hubVpcFilter = function hubVpcFilter(dns_bindings) {
      return dns_bindings.vpc.id === spokeId;
    };
    dns_resolution_bindings = utils.getResources(req, _server.COLS.vpcsDnsBindings, hubVpcFilter);
  }
  var callFromHubVpc = !hubVpcFilter;
  dns_resolution_bindings.dns_resolution_bindings = (_dns_resolution_bindi3 = dns_resolution_bindings) === null || _dns_resolution_bindi3 === void 0 ? void 0 : (_dns_resolution_bindi4 = _dns_resolution_bindi3.dns_resolution_bindings) === null || _dns_resolution_bindi4 === void 0 ? void 0 : _dns_resolution_bindi4.map(function (dns_bindings) {
    return formatDnsBindingsForClient(dns_bindings, req, res, callFromHubVpc);
  });
  res.json(dns_resolution_bindings).end();
};

/**
 * getDnsResolutionBinding()
 *
 * GET /vpcs/{vpc_id}/dns_resolution_bindings/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDnsResolutionBindings = getDnsResolutionBindings;
var getDnsResolutionBinding = function getDnsResolutionBinding(req, res) {
  // Validate that the VPC exists
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) {
    // Not found report a 404 error.
    return;
  }

  // Now try to find our resource
  var dns_bindings = utils.findResource(_server.COLS.vpcsDnsBindings, req.params.id, res, false);
  if (!dns_bindings) {
    // Not found report a 404 error.
    return;
  }

  // Respond with our formatted resource.
  res.json(formatDnsBindingsForClient(dns_bindings, req, res)).end();
};

/**
 * createDnsResolutionBinding()
 *
 * Create a routing table.
 *
 * POST /vpcs/{vpc_id}/dns_resolution_bindings
 *
 * Routing tables have one required input.
 * - vpc_id - from the path
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDnsResolutionBinding = getDnsResolutionBinding;
var createDnsResolutionBinding = function createDnsResolutionBinding(req, res) {
  var input = req.body;
  var spokeVpcId = req.params.vpc_id; // spoke vpc
  var hubVpc = input.vpc;

  // Validate the name
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.vpcsDnsBindings), input, req, res, 'resource with that name already exists', 'dns_bindings')) {
    return;
  }

  // Validate that the VPC exists
  var vpc = utils.findResource(_server.COLS.vpcs, spokeVpcId, res, false);
  if (!vpc) return;

  // Add the VPC to our input.
  input.spokeVpc = spokeVpcId;
  input.hubVpc = hubVpc;

  // Set the created_at time to the current time.
  input.created_at = utils.generateNowDate();
  // Finish creating the dns_bindings and add it to the DB.
  var resultId = addDnsResolutionBinding(_server.db.getCollection(_server.COLS.vpcsDnsBindings), input);

  // Now retreive the newly created resource and send it back in the response.
  var dns_bindings = utils.findResource(_server.COLS.vpcsDnsBindings, resultId, res, false);
  res.status(201).json(formatDnsBindingsForClient(dns_bindings, req, res)).end();
};

/**
 * updateDnsResolutionBinding()
 *
 * PATCH /vpcs/{vpc_id}/dns_bindings/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.createDnsResolutionBinding = createDnsResolutionBinding;
var updateDnsResolutionBinding = function updateDnsResolutionBinding(req, res) {
  var input = req.body;
  var dns_resolution_bindings = _server.db.getCollection(_server.COLS.vpcsDnsBindings);
  var originalDnsResolutionBinding = utils.findResource(_server.COLS.vpcsDnsBindings, req.params.id, res, false);
  if (!originalDnsResolutionBinding) {
    // Not found report a 404 error.
    return;
  }
  var updatedDnsResolutionBinding = _objectSpread(_objectSpread({}, originalDnsResolutionBinding), input);
  dns_resolution_bindings.update(updatedDnsResolutionBinding);
  res.status(200).json(formatDnsBindingsForClient(updatedDnsResolutionBinding, req, res)).end();
};
exports.updateDnsResolutionBinding = updateDnsResolutionBinding;