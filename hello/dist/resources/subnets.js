"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateSubnet = exports.setRoutingTable = exports.setPublicGateway = exports.setNetworkAcl = exports.init = exports.getSubnetsForVpc = exports.getSubnets = exports.getSubnet = exports.getRoutingTable = exports.getPublicGateway = exports.getNetworkAcl = exports.findSubnetsUsingRoutingTable = exports.findSubnetsUsingAcl = exports.deleteSubnet = exports.deletePublicGateway = exports.createSubnet = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _acls = require("./acls");
var _vpcs = require("./vpcs");
var _public_gateways = require("./public_gateways");
var _routing_tables = require("./routing_tables");
var _reserved_private_ips = require("./reserved_private_ips");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var SubnetStatuses = ['available'];

/**
 * TODO:
 * - Prevent delete of subnet if it has resources.
 * - Prevent delete of VPC if it has Subnets
 */

/**
 * validateRoutingTableInSubnetVpc()
 *
 * Validate that the provided raw subnet and raw routing_table objects reference
 * the same VPC. If not the response object is udpated with an error so the client
 * can return it.
 *
 * @param {*} res
 * @param {*} subnet
 * @param {*} routing_table
 */
var validateRoutingTableInSubnetVpc = function validateRoutingTableInSubnetVpc(res, subnet, routing_table) {
  var result = true;
  if (_lodash["default"].get(subnet, 'vpc.id') !== _lodash["default"].get(routing_table, 'vpcId')) {
    var message = 'Provided routing_table does not belong to this subnets VPC';
    res.status(400).json(utils.generateErrors(message, 'invalid', 'routing_table.id')).end();
    result = false;
  }
  return result;
};

/**
 * validateRoutingTableIsEgress()
 *
 * Validates that the provided raw routing table object is an egress routing table. Returns
 * boolean true if it is.
 *
 * @param {*} res
 * @param {*} routing_table
 * @returns boolean
 */
var validateRoutingTableIsEgress = function validateRoutingTableIsEgress(res, routing_table) {
  var result = true;
  if ((0, _routing_tables.isIngressRoutingTable)(routing_table)) {
    var message = 'Ingress routing_table may not be attached to subnet.';
    res.status(400).json(utils.generateErrors(message, 'invalid', 'routing_table.id')).end();
    result = false;
  }
  return result;
};

/**
 * findSubnetsUsingAcl()
 *
 * Finds the subnets that have been assigned with a particular Network Acl.
 *
 * @param {string} acl_id - Network ACL ID of the ACL
 */
var findSubnetsUsingAcl = function findSubnetsUsingAcl(acl_id) {
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().where(function (subnet) {
    return _lodash["default"].get(subnet, 'network_acl.id', '') === acl_id;
  }).data({
    removeMeta: true
  });
  return subnets;
};

/**
 * findSubnetsUsingRoutingTable()
 *
 * Finds the subnets that have been assigned with a a particular Routing Table.
 *
 * @param {string} routing_table_id
 */
exports.findSubnetsUsingAcl = findSubnetsUsingAcl;
var findSubnetsUsingRoutingTable = function findSubnetsUsingRoutingTable(routing_table_id) {
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().where(function (subnet) {
    return _lodash["default"].get(subnet, 'routing_table.id', '') === routing_table_id;
  }).data({
    removeMeta: true
  });
  return subnets;
};

/**
 * addSubnet()
 * Creates a new Subnet with random data. The random fields are then overridden
 * with the values provided in the data object. Finally the new item is added
 * to the collection.
 *
 * @param {*} subnets - reference to the subnets collection
 * @param {*} data - override data to use for subnet creation.
 */
exports.findSubnetsUsingRoutingTable = findSubnetsUsingRoutingTable;
var addSubnet = function addSubnet(subnets, data, randomZone) {
  var _zone;
  // All of our REST API fields should be included here in correct field order.
  var randVpc = data.zone ? utils.getRandomResourceInZone(_server.COLS.vpcs, data.zone.region_name) : utils.getRandomResource(_server.COLS.vpcs);
  var availableIPs = data.available_ipv4_address_count ? data.available_ipv4_address_count : _casual["default"].integer(1, 254);
  var subnetVPC = data.vpc ? utils.getResource(_server.COLS.vpcs, data.vpc.id)[0] : randVpc;
  var networkAclId = (0, _vpcs.getDefaultNetworkAclIdFromVpc)(subnetVPC);
  var routingTableId = (0, _vpcs.getDefaultRoutingTableIdFromVpc)(subnetVPC);
  var zone;
  if (data.zone) {
    zone = data.zone;
  } else if (randomZone) {
    zone = utils.getRandomZoneInRegion(subnetVPC.zone.region_name);
  } else {
    zone = utils.findZone(subnetVPC.zone.name);
  }
  var baseData = {
    id: _casual["default"].uuid,
    // For zone resource like subnet, should include zone id in crn
    // For example:
    // "crn:v1:staging:public:is:us-east-1:a/823bd195e9fd4f0db40ac2e1bffef3e0:5486be4a-5a3d-4d52-b546-c9f62be9b1e9::"
    crn: utils.generateCRN({
      zone: (_zone = zone) === null || _zone === void 0 ? void 0 : _zone.name
    }, true),
    href: '',
    // placeholder
    ipv4_cidr_block: "".concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".0/24"),
    ip_version: 'ipv4',
    zone: zone,
    vpc: data.vpc ? data.vpc : {
      id: subnetVPC.id,
      crn: subnetVPC.crn,
      name: subnetVPC.name,
      href: ''
    },
    resource_group: subnetVPC.resource_group,
    status: _casual["default"].random_element(SubnetStatuses),
    created_at: utils.generateCreateDate(),
    network_acl: {
      id: networkAclId
    },
    routing_table: {
      id: routingTableId
    },
    public_gateway: {
      id: ''
    },
    available_ipv4_address_count: availableIPs,
    total_ipv4_address_count: 256 // Assume the ip range is x.x.x.0/24
  };

  var newSubnet = _objectSpread(_objectSpread({}, baseData), data);
  if (!data.name) {
    newSubnet.name = utils.generateName('subnet', newSubnet.zone);
  }
  // add system reserved ip
  (0, _reserved_private_ips.addSystemReservedIps)(newSubnet);
  subnets.insert(newSubnet);
  return newSubnet.id;
};

/**
 * init()
 *
 * Initialize the Subnets collection.
 */
var init = function init() {
  // Create the subnets collection
  var subnets = _server.db.addCollection(_server.COLS.subnets);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Add a couple subnets with known IDs.
  addSubnet(subnets, {
    name: 'aaa-default-subnet-1',
    id: 'subnet-1',
    zone: utils.findZone(utils.getDefaultZone()),
    vpc: {
      id: 'vpc1001'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: 'aaa-default-subnet-2',
    id: 'subnet-2',
    zone: utils.findZone(utils.getDefaultZone()),
    vpc: {
      id: 'vpc1002'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: 'aaa-default-subnet-3',
    id: 'subnet-3',
    zone: utils.findZone(utils.getSecondDefaultZone()),
    vpc: {
      id: 'vpc1001'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: ' aaa-default-subnet-4',
    id: 'subnet-4',
    zone: utils.findZone(utils.getDefaultZone()),
    vpc: {
      id: 'vpc1001'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: 'aaa-default-subnet-5',
    id: 'subnet-5',
    zone: utils.findZone(utils.getSecondDefaultZone()),
    vpc: {
      id: 'vpc1001'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: 'aaa-subnet-1',
    id: 'aaa-subnet-1',
    vpc: {
      id: '1111-11111111-1111-1111-1111-111111111111'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  addSubnet(subnets, {
    name: 'aaa-default-reserved-subnet-1',
    id: 'reserved-subnet-1',
    zone: utils.findZone(utils.getSecondDefaultZone()),
    vpc: {
      id: 'vpc1001'
    },
    available_ipv4_address_count: _casual["default"].integer(1, 254)
  });
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    addSubnet(subnets, {
      name: "subnet_per_region_".concat(region.name),
      zone: utils.findZoneInRegion(region.name)
    });
  });
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().simplesort('name').data({
    removeMeta: true
  });
  vpcs.forEach(function (vpc) {
    addSubnet(subnets, {
      vpc: vpc
    });
  });

  // Create some additional VPCs
  utils.repeat(function () {
    addSubnet(subnets, {}, _features.shouldCreateSubnetsInRandomZones);
  }, _features.shouldGenerateLotsOfResources ? 300 : 50);
};

/**
 * formatSubnetForClient()
 *
 * Make changes to make subnet from db collection suitable for
 * client display.
 *
 * @param {*} req
 * @param {*} subnet
 */
exports.init = init;
var formatSubnetForClient = function formatSubnetForClient(req, subnet) {
  // Subnet href
  subnet.href = "".concat(utils.getBaseApiUrl(req), "subnets/").concat(subnet.id);
  subnet.crn = utils.updateResourceCrnRegion(subnet, req);

  // VPC href
  var vpc_id = _lodash["default"].get(subnet, 'vpc.id', '');
  if (vpc_id) {
    subnet.vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, vpc_id);
  }

  // ACL ref
  var acl_id = _lodash["default"].get(subnet, 'network_acl.id', '');
  if (acl_id) {
    subnet.network_acl = utils.getAndFormatResourceLinkForClient(req, _server.COLS.acls, acl_id);
  }

  // routing_table ref
  var routing_table_id = _lodash["default"].get(subnet, 'routing_table.id', '');
  if (routing_table_id) {
    subnet.routing_table = utils.getAndFormatResourceLinkForClient(req, _server.COLS.routing_tables, routing_table_id);
  }

  // Zone href & region_name pruning
  if (_lodash["default"].get(subnet, 'zone', '')) {
    var zone = _lodash["default"].get(subnet, 'zone.name', 'zonenotavail');
    var region = utils.findZone(zone).region_name;
    subnet.zone.href = "".concat(utils.getBaseApiUrl(req), "regions/").concat(region, "/zones/").concat(zone);
    delete subnet.zone.region_name;
  }

  // Public Gateway
  var gateway_id = _lodash["default"].get(subnet, 'public_gateway.id', '');
  delete subnet.public_gateway;
  if (gateway_id) {
    var public_gateway = utils.getAndFormatResourceLinkForClient(req, _server.COLS.public_gateways, gateway_id);
    if (public_gateway) {
      subnet.public_gateway = public_gateway;
    }
  }
};
var filterByVpcId = function filterByVpcId(req, res, resource, vpcId) {
  var _resource$vpc;
  return (resource === null || resource === void 0 ? void 0 : (_resource$vpc = resource.vpc) === null || _resource$vpc === void 0 ? void 0 : _resource$vpc.id) === vpcId;
};
var filterByRoutingTableWithQuery = function filterByRoutingTableWithQuery(req, res, resource, queryParam, fieldName) {
  // For filtering by Routing Table ID we can short circuit the query because the subnet
  // already has the Routing Table ID.
  if (fieldName === 'id') {
    var routing_table_id = _lodash["default"].get(resource, 'routing_table.id', undefined);
    if (routing_table_id === queryParam) {
      return true;
    }
    return false;
  }

  // Get the dedicatd host the provided instance uses.
  var routingTableId = _lodash["default"].get(resource, 'routing_table.id');
  if (routingTableId) {
    // This instance belongs to a dedicated host, now we need to get the decicated_host.
    var routing_table = utils.findResource(_server.COLS.routing_tables, routingTableId);
    if (routing_table && routing_table[fieldName] === queryParam) {
      return true;
    }
    return false;
  }
  return false;
};

/*
 * The subnets call supports extra query parameters.  These parameters filter the subnets list
 * We need to add these as extra filters on the where clause when getting the list of subnets.
 */
var filter = function filter(req, res, resource) {
  // We need to filter by types here, so that eventually we can support multiple filters.

  // Filter by Routing Table
  if (req.query['routing_table.id']) {
    return filterByRoutingTableWithQuery(req, res, resource, req.query['routing_table.id'], 'id');
  }
  if (req.query['routing_table.name']) {
    return filterByRoutingTableWithQuery(req, res, resource, req.query['routing_table.name'], 'name');
  }
  if (req.query['vpc.id']) {
    return filterByVpcId(req, res, resource, req.query['vpc.id']);
  }

  // Filter other types

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};

/**
 * getSubnets()
 *
 * Get a list of all the Subnets.
 *
 * @param {*} req
 * @param {*} res
 */
var getSubnets = function getSubnets(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var subnets = utils.getResources(req, _server.COLS.subnets, extraFilter);
  subnets.subnets.forEach(function (subnet) {
    return formatSubnetForClient(req, subnet);
  });
  res.json(subnets).end();
};
exports.getSubnets = getSubnets;
var getSubnetsForVpc = function getSubnetsForVpc(vpcId) {
  var allSubnets = _server.db.getCollection(_server.COLS.subnets).chain().data({
    removeMeta: true
  });
  var subnetsForVPC = allSubnets.filter(function (subnet) {
    return subnet.vpc.id === vpcId;
  });
  return subnetsForVPC;
};

/**
 * getSubnet()
 *
 * Get a specific Subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getSubnetsForVpc = getSubnetsForVpc;
var getSubnet = function getSubnet(req, res) {
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().find({
    id: req.params.subnet_id
  }).data({
    removeMeta: true
  });
  if (!subnets || subnets.length === 0) {
    res.status(404).json(utils.generateNotFoundError(req.params.subnet_id, 'subnet')).end();
    return;
  }
  var subnet = subnets[0];
  formatSubnetForClient(req, subnet);
  res.json(subnet).end();
};

/**
 * deleteSubnet()
 * Delete a specific Subnet.
 * @param {*} req
 * @param {*} res
 */
exports.getSubnet = getSubnet;
var deleteSubnet = function deleteSubnet(req, res) {
  var subnet = utils.findResource(_server.COLS.subnets, req.params.subnet_id, res, false);
  var groups = _server.db.getCollection(_server.COLS.instance_groups).chain().find().where(function (obj) {
    var _obj$subnets;
    return ((_obj$subnets = obj.subnets) === null || _obj$subnets === void 0 ? void 0 : _obj$subnets.some(function (a) {
      return a.id;
    })) === req.params.subnet_id;
  }).data({
    removeMeta: true
  });
  if ((groups === null || groups === void 0 ? void 0 : groups.length) > 0) {
    res.status(400).json((0, utils.generateErrors)('subnet is being used by 1 or more instance groups', 409, 'template_in_use')).end();
    return;
  }
  var templates = _server.db.getCollection(_server.COLS.instance_templates).chain().find().where(function (obj) {
    var _obj$primary_network_, _obj$primary_network_2;
    return ((_obj$primary_network_ = obj.primary_network_interface) === null || _obj$primary_network_ === void 0 ? void 0 : (_obj$primary_network_2 = _obj$primary_network_.subnet) === null || _obj$primary_network_2 === void 0 ? void 0 : _obj$primary_network_2.id) === req.params.subnet_id;
  }).data({
    removeMeta: true
  });
  if ((templates === null || templates === void 0 ? void 0 : templates.length) > 0) {
    res.status(400).json((0, utils.generateErrors)('subnet is being used by 1 or more instance templates', 409, 'template_in_use')).end();
    return;
  }
  var subnetsCol = _server.db.getCollection(_server.COLS.subnets);
  subnetsCol.remove(subnet);
  res.status(204).end();
};

/**
 * createSubnet()
 *
 * Create a new Subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteSubnet = deleteSubnet;
var createSubnet = function createSubnet(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.subnets), input, req, res, 'resource with that name already exists', 'subnet')) {
    return;
  }

  // Verify the VPC exists
  if (utils.objectRefCheck(_server.COLS.vpcs, input.vpc.id, res)) {
    return;
  }

  // Validate the zone
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }

  // Validate the ipv4_cidr_block only if total_ipv4_address_count does not exist
  if (!input.total_ipv4_address_count && utils.validIpV4CidrCheck(input.ipv4_cidr_block, req, res, 'ip4v_cidr_block')) {
    return;
  }

  // Validate the network_acl
  var acl_id = _lodash["default"].get(input, 'network_acl.id', '');
  if (acl_id) {
    var acl = utils.findResource(_server.COLS.acls, acl_id, res, false);
    if (!acl) {
      // return a 404 error
      return;
    }
  }

  // Validate the routing_table
  var routing_table_id = _lodash["default"].get(input, 'routing_table.id', '');
  if (routing_table_id) {
    var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);

    // Verify the routing_table exists
    if (!routing_table) {
      // return a 404 error
      return;
    }

    // Verify routing_table is in same VPC as subnet
    if (!validateRoutingTableInSubnetVpc(res, input, routing_table)) {
      return;
    }

    // Verify that this is an egress routing_table
    if (!validateRoutingTableIsEgress(res, routing_table)) {
      return;
    }
  }
  var id = addSubnet(_server.db.getCollection(_server.COLS.subnets), input, false);
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var subnet = subnets[0];
  formatSubnetForClient(req, subnet);
  res.status(201).json(subnet).end();
};

/**
 * updateSubnet()
 *
 * Update the data in an existing Subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createSubnet = createSubnet;
var updateSubnet = function updateSubnet(req, res) {
  var input = req.body;
  var subnetCols = _server.db.getCollection(_server.COLS.subnets);
  var origSubnet = subnetCols.findOne({
    id: req.params.subnet_id
  }); //    .data({ removeMeta: true });

  // Check if it exists
  if (!origSubnet) {
    res.status(404).json(utils.generateNotFoundError(req.params.subnet_id, 'subnet')).end();
    return;
  }

  // Validate the network_acl
  var acl_id = _lodash["default"].get(input, 'network_acl.id', '');
  if (acl_id) {
    var acl = utils.findResource(_server.COLS.acls, acl_id, res, false);
    if (!acl) {
      // return a 404 error
      return;
    }
  }

  // Validate the routing_table
  var routing_table_id = _lodash["default"].get(input, 'routing_table.id', '');
  if (routing_table_id) {
    // Verify the routing_table exists
    var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
    if (!routing_table) {
      // return a 404 error
      return;
    }

    // Verify routing_table is in same VPC as subnet
    if (!validateRoutingTableInSubnetVpc(res, origSubnet, routing_table)) {
      return;
    }

    // Verify that this is an egress routing_table
    if (!validateRoutingTableIsEgress(res, routing_table)) {
      return;
    }
  }

  // Update our DB entry
  var updatedSubnet = _objectSpread(_objectSpread({}, origSubnet), input);
  subnetCols.update(updatedSubnet);

  // Retrieve the updated subnet from the DB
  var resultSubnets = subnetCols.chain().find({
    id: req.params.subnet_id
  }).data({
    removeMeta: true
  });
  formatSubnetForClient(req, resultSubnets[0]);
  res.status(200).json(resultSubnets[0]).end();
};

/**
 * setPublicGateway()
 *
 * Set a public gateway on a subnet. Returns the public gateway that was set
 * onto the subnet.
 *
 * Possible Precondition checks:
 * - Subnet ID exists (#404)
 * - Public Gateway exists. (#400)
 * - Public Gateway is in our VPC. (#400)
 * - Public Gateway is in our Zone. (#400)
 *
 * For now we just do it blindly without checking.
 *
 * @param {*} req
 * @param {*} res
 */
exports.updateSubnet = updateSubnet;
var setPublicGateway = function setPublicGateway(req, res) {
  var gateway_id = req.body.id;
  var subnet_id = req.params.subnet_id;

  // Find the subnet
  var subnetCols = _server.db.getCollection(_server.COLS.subnets);
  var subnets = subnetCols.find({
    id: subnet_id
  });
  if (!subnets || subnets.length === 0) {
    res.status(404).json(utils.generateNotFoundError(subnet_id, 'subnet')).end();
    return;
  }
  var subnet = subnets[0];

  // Find the public gateway
  var gateways = _server.db.getCollection(_server.COLS.public_gateways).chain().find({
    id: gateway_id
  }).data({
    removeMeta: true
  });
  if (!gateways || gateways.length === 0) {
    res.status(404).json(utils.generateNotFoundError(gateway_id, 'public_gateway')).end();
    return;
  }
  var gateway = gateways[0];

  // Update the subnet
  subnet.public_gateway = {
    id: gateway_id
  };
  subnetCols.update(subnet);

  // Format the gateway for client output
  (0, _public_gateways.formatPublicGatewayForClient)(req, gateway);
  res.status(201).json(gateway).end();
};

/**
 * getPublicGateway()
 *
 * Get the public gateway for a subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.setPublicGateway = setPublicGateway;
var getPublicGateway = function getPublicGateway(req, res) {
  var subnet_id = req.params.subnet_id;

  // Get our subnet
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().find({
    id: subnet_id
  }).data({
    removeMeta: true
  });
  if (!subnets || subnets.length === 0) {
    res.status(404).json(utils.generateNotFoundError(subnet_id, 'subnet')).end();
    return;
  }
  var subnet = subnets[0];

  // Now try to get the gateway
  var gateway_id = _lodash["default"].get(subnet, 'public_gateway.id', '');
  if (gateway_id) {
    // We have its id so lets try to find it.
    var gateways = _server.db.getCollection(_server.COLS.public_gateways).chain().find({
      id: gateway_id
    }).data({
      removeMeta: true
    });
    if (gateways && gateways.length > 0) {
      // We got it now format it and send it out.
      var gateway = gateways[0];
      (0, _public_gateways.formatPublicGatewayForClient)(req, gateway);
      res.status(200).json(gateway).end();
    } else {
      // Couldn't find the gateway.
      res.status(404).json(utils.generateNotFoundError(gateway_id, 'public_gateway')).end();
    }
  } else {
    res.status(404).json(utils.generateNotFoundError(gateway_id, 'public_gateway')).end();
  }
};

/**
 * deletePublicGateway()
 *
 * Delete the Subnet's Public Gateway.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getPublicGateway = getPublicGateway;
var deletePublicGateway = function deletePublicGateway(req, res) {
  var subnetsCol = _server.db.getCollection(_server.COLS.subnets);

  // Find our subnet
  var subnets = subnetsCol.find({
    id: req.params.subnet_id
  });
  if (!subnets || subnets.length === 0) {
    res.status(404).json(utils.generateNotFoundError(req.params.subnet_id, 'subnet')).end();
    return;
  }
  var subnet = subnets[0];

  // Now update our subnet
  // We don't care what the old Gateway was.
  subnet.public_gateway = {
    id: ''
  };
  subnetsCol.update(subnet);
  res.status(204).end();
};

/**
 * setNetworkAcl()
 *
 * Set a Network Acl on a subnet. Returns the Network Acl that was set
 * onto the Subnet.
 *
 * Possible Precondition checks:
 * - Subnet ID exists (#404)
 * - Network Acl exists. (#404) (Verified 404)
 * - Network Acl is in our VPC? (#400)
 *
 * @param {*} req
 * @param {*} res
 */
exports.deletePublicGateway = deletePublicGateway;
var setNetworkAcl = function setNetworkAcl(req, res) {
  var subnetsCol = _server.db.getCollection(_server.COLS.subnets);
  var subnet_id = req.params.subnet_id;
  var network_acl_id = req.body.id;

  // Find the subnet
  var subnets = subnetsCol.find({
    id: subnet_id
  });

  // Couldn't find the subnet!
  if (!subnets || subnets.length === 0) {
    res.status(404).json(utils.generateNotFoundError(subnet_id, 'subnet')).end();
    return;
  }

  // Find the Network Acl
  var network_acls = _server.db.getCollection(_server.COLS.acls).chain().find({
    id: network_acl_id
  }).data({
    removeMeta: true
  });

  // Couldn't find the Network Acl
  if (!network_acls || network_acls.length === 0) {
    res.status(404).json(utils.generateNotFoundError(network_acl_id, 'network_acls')).end();
    return;
  }

  // Update the Subnet with the new Network Acl
  var subnet = subnets[0];
  var network_acl = network_acls[0];
  subnet.network_acl = {
    id: network_acl_id
  };
  subnetsCol.update(subnet);
  (0, _acls.formatNetworkAclForClient)(req, network_acl);
  res.status(201).json(network_acl).end();
};

/**
 * getNetworkAcl()
 *
 * Get the Network Acl for a Subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.setNetworkAcl = setNetworkAcl;
var getNetworkAcl = function getNetworkAcl(req, res) {
  var subnet_id = req.params.subnet_id;
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().find({
    id: subnet_id
  }).data({
    removeMeta: true
  });
  if (!subnets || subnets.length === 0) {
    res.status(400).end();
    return;
  }

  // Get the id of our Network Acl
  var network_acl_id = _lodash["default"].get(subnets[0], 'network_acl.id', '');
  if (!network_acl_id) {
    res.status(400).end();
    return;
  }

  // Find the Network Acl with this id
  var network_acls = _server.db.getCollection(_server.COLS.acls).chain().find({
    id: network_acl_id
  }).data({
    removeMeta: true
  });
  if (!network_acls || network_acls.length === 0) {
    res.status(400).end();
    return;
  }
  var network_acl = network_acls[0];
  (0, _acls.formatNetworkAclForClient)(req, network_acl);
  res.status(200).json(network_acl).end();
};

/**
 * setRoutingTable()
 *
 * Set Routing Table on a subnet. Returns the Routing Table that was set
 * onto the Subnet.
 *
 * Possible Precondition checks:
 * - Subnet ID exists (#404)
 * - Routing Table exists. (#404) (Verified 404)
 * - Routing Table is in our VPC? (#400)
 *
 * @param {*} req
 * @param {*} res
 */
exports.getNetworkAcl = getNetworkAcl;
var setRoutingTable = function setRoutingTable(req, res) {
  var subnetsCol = _server.db.getCollection(_server.COLS.subnets);
  var subnet_id = req.params.subnet_id;
  var routing_table_id = req.body.id;

  // Find the subnet
  var subnet = utils.findResource(_server.COLS.subnets, subnet_id, res, false);
  if (!subnet) {
    // Return a 404 error
    return;
  }

  // Find the Routing Table
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, true);
  if (!routing_table) {
    // Return 404 error
    return;
  }

  // Verify routing_table is in same VPC as subnet
  if (!validateRoutingTableInSubnetVpc(res, subnet, routing_table)) {
    return;
  }

  // Verify that this is an egress routing_table
  if (!validateRoutingTableIsEgress(res, routing_table)) {
    return;
  }

  // Update the Subnet with the new Routing table
  subnet.routing_table = {
    id: routing_table_id
  };
  subnetsCol.update(subnet);

  // Format the routing_table for client output
  var routing_table_for_client = (0, _routing_tables.formatRoutingTableForClient)(routing_table, req);
  res.status(201).json(routing_table_for_client).end();
};

/**
 * getRoutingTable()
 *
 * Get the Routing Table for a Subnet.
 *
 * @param {*} req
 * @param {*} res
 */
exports.setRoutingTable = setRoutingTable;
var getRoutingTable = function getRoutingTable(req, res) {
  var subnet_id = req.params.subnet_id;

  // Verify that the subnet ID is valid
  var subnet = utils.findResource(_server.COLS.subnets, subnet_id, res, false);
  if (!subnet) {
    // Return 404 error
    return;
  }

  // Get the id of our Routing Table
  var routing_table_id = _lodash["default"].get(subnet, 'routing_table.id', 'NO_VALUE_FOUND');
  if (!routing_table_id) {
    // This is not an official error
    res.status(500).json(utils.generateNotFoundError(routing_table_id, 'routing_table')).end();
    return;
  }

  // Now find the routing_table.
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, true);
  if (!routing_table) {
    // Return 404 error
    return;
  }

  // Format routing_table for client
  var formatted_routing_table = (0, _routing_tables.formatRoutingTableForClient)(routing_table, req);
  res.status(200).json(formatted_routing_table).end();
};
exports.getRoutingTable = getRoutingTable;