"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateRoutingTable = exports.isIngressRoutingTable = exports.init = exports.getRoutingTablesForVpc = exports.getRoutingTables = exports.getRoutingTable = exports.formatRoutingTableForClient = exports.deleteRoutingTablesInVpc = exports.deleteRoutingTable = exports.createRoutingTable = exports.addRoutingTable = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _common = require("./common");
var _subnets = require("./subnets");
var _croutes = require("./croutes");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var debug = false;

/**
 * generateIngressError()
 *
 * Utility to generate ingress routing errors for case when another
 * routing_table already has ingress of that type enabled.
 *
 * @param {*} res
 * @param {*} ingress_type - the ingress field name
 */
var generateIngressError = function generateIngressError(res, ingress_type) {
  var message = "Another routing table already has ".concat(ingress_type, " enabled.");
  res.status(400).json(utils.generateErrors(message, 'invalid', ingress_type)).end();
};

/**
 * isIngressRoutingTable()
 *
 * Given a routingTable, checks each of the ingress options and returns
 * true if any of them are enabled.
 *
 * @param {*} routingTable
 */
var isIngressRoutingTable = function isIngressRoutingTable(routing_table) {
  var route_direct_link_ingress = routing_table.route_direct_link_ingress,
    route_transit_gateway_ingress = routing_table.route_transit_gateway_ingress,
    route_vpc_zone_ingress = routing_table.route_vpc_zone_ingress,
    route_internet_ingress = routing_table.route_internet_ingress;
  return !!(route_direct_link_ingress || route_transit_gateway_ingress || route_vpc_zone_ingress || route_internet_ingress);
};

/**
 * getRoutingTablesForVpc()
 *
 * Given a vpcId, returns an array of the routingTables for the referenced VPC.
 *
 * @param {*} vpcId - vpcId of the routing_tables
 * @returns [routing_tables]
 */
exports.isIngressRoutingTable = isIngressRoutingTable;
var getRoutingTablesForVpc = function getRoutingTablesForVpc(vpc_id) {
  var routingTablesCol = _server.db.getCollection(_server.COLS.routing_tables);
  var routingTables = routingTablesCol.chain().find({
    vpcId: vpc_id
  }).data();
  return routingTables;
};

/**
 * getRoutingTableIngressOptionsUsedForVpc()
 *
 * Given a vpcId, scans all of the referenced VPC's routing_tables and returns a
 * boolean summation for all of the routing table ingress options.
 *
 * @param {*} vpcId
 * @returns {route_direct_link_ingress, route_transit_gateway_ingress, route_vpc_zone_ingress, route_internet_ingress}
 */
exports.getRoutingTablesForVpc = getRoutingTablesForVpc;
var getRoutingTableIngressOptionsUsedForVpc = function getRoutingTableIngressOptionsUsedForVpc(vpcId) {
  var routingTables = getRoutingTablesForVpc(vpcId);
  var ingressOpts = {
    route_direct_link_ingress: false,
    route_transit_gateway_ingress: false,
    route_vpc_zone_ingress: false,
    route_internet_ingress: false
  };
  routingTables.forEach(function (rt) {
    ingressOpts.route_direct_link_ingress || (ingressOpts.route_direct_link_ingress = rt.route_direct_link_ingress);
    ingressOpts.route_transit_gateway_ingress || (ingressOpts.route_transit_gateway_ingress = rt.route_transit_gateway_ingress);
    ingressOpts.route_vpc_zone_ingress || (ingressOpts.route_vpc_zone_ingress = rt.route_vpc_zone_ingress);
    ingressOpts.route_internet_ingress || (ingressOpts.route_internet_ingress = rt.route_internet_ingress);
  });
  return ingressOpts;
};

/**
 * deleteRoutesInRoutingTable()
 *
 * Delete all the routes in this routing table.
 *
 * @param {} routing_table_id
 */
var deleteRoutesInRoutingTable = function deleteRoutesInRoutingTable(routing_table_id) {
  // With no attached resource check
  _server.db.getCollection(_server.COLS.croutes).findAndRemove({
    _routing_table_id: routing_table_id
  });
};

/**
 * deleteRoutingTablesInVpc()
 *
 * Delete all of the routing tables in a VPC.
 *
 * First we find all of the routing_tables attached to the specified VPC.
 * Next we check all of the routing tables for attached subnets. If it has
 * any then we report and error and do not delete anything. If the no
 * attached subnets are found then we iteratively delete all routes in each
 * routing table and the routing table itself.
 *
 * @param {String} vpc_id - ID of the VPC to delete routing_tables for
 * @param {*} res - response object
 */
var deleteRoutingTablesInVpc = function deleteRoutingTablesInVpc(vpc_id, res) {
  // With attached resource check
  var foundSubnets = [];
  var routingTablesCol = _server.db.getCollection(_server.COLS.routing_tables);
  var routingTables = routingTablesCol.chain().find({
    vpcId: vpc_id
  }).data();
  var badTable = routingTables.find(function (table) {
    foundSubnets = (0, _subnets.findSubnetsUsingRoutingTable)(table.id);
    return foundSubnets.length > 0;
  });
  if (badTable) {
    // We found a routing_table that has one or more subnets
    if (res) {
      res.status(403).json(utils.generateErrors("VPC [".concat(vpc_id, "] has routing_table [").concat(badTable.id, "] with attached subnet ").concat(foundSubnets[0].id), 'has_children', _server.COLS.routing_tables));
    }
    return false;
  }

  // Our tables are free of children so we can delete everything
  routingTables.forEach(function (table) {
    // Delete the routes in the routing table
    deleteRoutesInRoutingTable(table.id);

    // Delete the Routing Table itself
    routingTablesCol.remove(table);
  });

  // Success
  return true;
};

/**
 * addRoutingTable()
 *
 * Add a Routing Table
 *
 * @param {*} routing_tables: List of routing tables
 * @param {*} data: details of the new routing_table to be added to the list
 */
// eslint-disable-next-line no-unused-vars
exports.deleteRoutingTablesInVpc = deleteRoutingTablesInVpc;
var addRoutingTable = function addRoutingTable(routing_tables, data, res) {
  // First find our VPC
  var vpc;
  if (data.vpcId) {
    // A vpcId was supplied so retrieve it.
    vpc = utils.findResource(_server.COLS.vpcs, data.vpcId);

    // We need a valid VPC to get the zone, so if a valid VPC was not provided
    // then we better at least have a valid zone.
    if (!vpc && !data.zone) {
      // We need a zone!
      throw new Error('addRoutingTable - supplied VPC does not (yet) exist need zone.');
    }
  }
  if (!data.vpcId) {
    // A vpcId was not supplied so lets use a random one.
    vpc = utils.getRandomResource(_server.COLS.vpcs);
    if (!vpc) {
      // eslint-disable-next-line no-console
      throw new Error('addRoutingTable - No VPC available to attach to Routing Table');
    }
    data.vpcId = vpc.id;
  }

  // If we have a VPC, we must use the zone from that.
  if (vpc) {
    // Override the zone passed in as data if one was passed.
    data.zone = vpc.zone;
  }
  var baseData = {
    vpcId: data.vpcId,
    accept_routes_from: data.accept_routes_from || [],
    advertise_routes_to: data.advertise_routes_to || [],
    created_at: data.created_at || utils.generateCreateDate(),
    href: '',
    // Placeholder
    id: data.id || _casual["default"].uuid,
    is_default: false,
    lifecycle_state: data.lifecycle_state || _casual["default"].random_element(Object.values(_common.LIFECYCLE_STATE)),
    name: data.name || utils.generateName('routing-table', null),
    resource_type: 'routing_table',
    subnets: data.subnets || [],
    route_direct_link_ingress: !!data.route_direct_link_ingress,
    route_transit_gateway_ingress: !!data.route_transit_gateway_ingress,
    route_vpc_zone_ingress: !!data.route_vpc_zone_ingress,
    route_internet_ingress: !!data.route_internet_ingress,
    zone: data.zone
  };

  // Why are we doing this double-overlay init?
  var newRoutingTable = _objectSpread(_objectSpread({}, baseData), data);
  routing_tables.insert(newRoutingTable);
  var routes = data.routes;
  if (routes !== null && routes !== void 0 && routes.length) {
    routes.forEach(function (route) {
      (0, _croutes.addRoute)(_server.db.addCollection(_server.COLS.croutes), _objectSpread(_objectSpread({}, route), {}, {
        _vpc_id: newRoutingTable.vpcId,
        _routing_table_id: newRoutingTable.id
      }));
    });
  }
  return newRoutingTable.id;
};

/**
 * init()
 *
 * Initialize Routing Tables
 *
 */
exports.addRoutingTable = addRoutingTable;
var init = function init() {
  var routing_tables = _server.db.addCollection(_server.COLS.routing_tables);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // THIS ONE IS SPECIAL FOR THE A11Y TEST WE NEED ID 1.
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-1',
    name: 'routing-table-vpc1001-1-name',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }, {
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable001-id',
    name: 'routing-table-vpc1001-rtable001-name',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }, {
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable002-id',
    name: 'routing-table-vpc1001-rtable002-name',
    route_direct_link_ingress: true
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable003-id',
    name: 'routing-table-vpc1001-rtable003-name',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable004-id',
    name: 'routing-table-vpc1001-rtable004-name',
    accept_routes_from: [{
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable005-id',
    name: 'routing-table-vpc1001-rtable005-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable006-id',
    name: 'routing-table-vpc1001-rtable006-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable007-id',
    name: 'routing-table-vpc1001-rtable007-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable008-id',
    name: 'routing-table-vpc1001-rtable008-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable009-id',
    name: 'routing-table-vpc1001-rtable009-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable010-id',
    name: 'routing-table-vpc1001-rtable010-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable011-id',
    name: 'routing-table-vpc1001-rtable011-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'routing-table-vpc1001-rtable012-id',
    name: 'routing-table-vpc1001-rtable012-name'
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1002',
    id: 'routing-table-vpc1002-rtable001-id',
    name: 'routing-table-vpc1002-rtable001-name',
    route_direct_link_ingress: true,
    route_transit_gateway_ingress: false,
    route_vpc_zone_ingress: true,
    route_internet_ingress: false
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1002',
    id: 'routing-table-vpc-1002-rtable002-id',
    name: 'routing-table-vpc1002-rtable002-name',
    accept_routes_from: [{
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1002',
    id: 'routing-table-vpc1002-rtable003-id',
    name: 'routing-table-vpc1002-rtable003-name',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }, {
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'aa-routing-table-vpc1001-1-id',
    name: 'aa-routing-table-vpc1001-1',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }, {
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'aaa-routing-table-vpc1001-2-id',
    name: 'aaa-routing-table-vpc1001-2',
    accept_routes_from: [{
      resource_type: 'vpn_gateway'
    }, {
      resource_type: 'vpn_server'
    }]
  });
  addRoutingTable(routing_tables, {
    vpcId: 'vpc1001',
    id: 'aaa-routing-table-vpc1001-3-id-drs',
    name: 'aaa-routing-table-vpc1001-id-drs',
    accept_routes_from: [{
      resource_type: 'dynamic_route_server'
    }]
  });

  // Add some random routing tables
  utils.repeat(function () {
    addRoutingTable(routing_tables, {});
  }, 6);
};

/**
 * formatRoutingTableForClient()
 *
 * Format the Routing Table for output to client.
 *
 * @param {*} req
 * @param {*} routing_table
 */
// eslint-disable-next-line no-unused-vars
exports.init = init;
var formatRoutingTableForClient = function formatRoutingTableForClient(routing_table, req, res) {
  var accept_routes_from = routing_table.accept_routes_from,
    advertise_routes_to = routing_table.advertise_routes_to,
    created_at = routing_table.created_at,
    id = routing_table.id,
    is_default = routing_table.is_default,
    lifecycle_state = routing_table.lifecycle_state,
    name = routing_table.name,
    resource_type = routing_table.resource_type,
    vpcId = routing_table.vpcId,
    route_direct_link_ingress = routing_table.route_direct_link_ingress,
    route_transit_gateway_ingress = routing_table.route_transit_gateway_ingress,
    route_vpc_zone_ingress = routing_table.route_vpc_zone_ingress,
    route_internet_ingress = routing_table.route_internet_ingress,
    zone = routing_table.zone;

  // Get the href for this routing_table
  var href = "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(vpcId, "/routing_tables/").concat(id);

  // Setup Route references - routes are a required field so always return at least an empty array.
  var routes = _server.db.getCollection(_server.COLS.croutes).chain().find({
    _vpc_id: vpcId,
    _routing_table_id: id
  }).data({
    removeMeta: true
  });
  routes = routes.map(function (route) {
    return utils.formatResourceLinkForClient(req, _server.COLS.croutes, route);
  });
  routes.forEach(function (route) {
    route.href = "".concat(href, "/routes/").concat(route.id);
  });

  // Setup Subnet references - subnets are a required field so always return at least an empty array.
  var subnets = (0, _subnets.findSubnetsUsingRoutingTable)(id);
  subnets = subnets.map(function (subnet) {
    return utils.formatResourceLinkForClient(req, _server.COLS.subnets, subnet);
  });
  var result = {
    advertise_routes_to: advertise_routes_to,
    accept_routes_from: accept_routes_from,
    created_at: created_at,
    href: href,
    id: id,
    is_default: is_default,
    lifecycle_state: lifecycle_state,
    name: name,
    resource_type: resource_type,
    routes: routes,
    subnets: subnets,
    route_direct_link_ingress: !!route_direct_link_ingress,
    route_transit_gateway_ingress: !!route_transit_gateway_ingress,
    route_vpc_zone_ingress: !!route_vpc_zone_ingress,
    route_internet_ingress: route_internet_ingress
  };
  if (debug) {
    // In debug show our internal fields
    result.vpcId = vpcId; // vpcId is a hidden field only for rias-mock
    result.zone = zone;
    result.totalRouteTablesSystem = _server.db.getCollection(_server.COLS.routing_tables).chain().data().length;
    result.totalRoutesSystem = _server.db.getCollection(_server.COLS.croutes).chain().data().length;
    result.totalRoutesVpc = _server.db.getCollection(_server.COLS.croutes).chain().find({
      _vpc_id: vpcId
    }).data().length;
  }
  return result;
};

/**
 * getRoutingTables()
 *
 * Get a list of routing tables for a VPC.
 *
 * GET /vpcs/{vpc_id}/routing_tables
 *
 * @param {*} req
 * @param {*} res
 */
exports.formatRoutingTableForClient = formatRoutingTableForClient;
var getRoutingTables = function getRoutingTables(req, res) {
  // Validate that the VPC exists
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) {
    // Not found report a 404 error.
    return;
  }
  var vpcFilter = function vpcFilter(routing_table) {
    return routing_table.vpcId === req.params.vpc_id;
  };
  var routing_tables = utils.getResources(req, _server.COLS.routing_tables, vpcFilter);
  routing_tables.routing_tables = routing_tables.routing_tables.map(function (routing_table) {
    return formatRoutingTableForClient(routing_table, req, res);
  });
  res.json(routing_tables).end();
};

/**
 * getRoutingTable()
 *
 * Get a specific routing table.
 *
 * GET /vpcs/{vpc_id}/routing_tables/{routing_table_id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getRoutingTables = getRoutingTables;
var getRoutingTable = function getRoutingTable(req, res) {
  // Validate that the VPC exists
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) {
    // Not found report a 404 error.
    return;
  }

  // Now try to find our resource
  var routing_table = utils.findResource(_server.COLS.routing_tables, req.params.routing_table_id, res, false);
  if (!routing_table) {
    // Not found report a 404 error.
    return;
  }

  // Respond with our formatted resource.
  res.json(formatRoutingTableForClient(routing_table, req, res)).end();
};

/**
 * createRoutingTable()
 *
 * Create a routing table.
 *
 * POST /vpcs/{vpc_id}/routing_tables
 *
 * Routing tables have one required input.
 * - vpc_id - from the path
 *
 * @param {*} req
 * @param {*} res
 */
exports.getRoutingTable = getRoutingTable;
var createRoutingTable = function createRoutingTable(req, res) {
  var input = req.body;
  var vpc_id = req.params.vpc_id;

  // Validate the name
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.routing_tables), input, req, res, 'resource with that name already exists', 'routing_table')) {
    return;
  }

  // Validate that the VPC exists
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;

  // Add the VPC to our input.
  input.vpcId = vpc_id;

  // We don't allow anyone to create a default_routing_table via the API.
  input.is_default = false;

  // Set the created_at time to the current time.
  input.created_at = utils.generateNowDate();

  // Check if they are attempting to create an ingress routing table
  if (isIngressRoutingTable(input)) {
    // At least one of the ingress options is selected
    var ingressVpcOpts = getRoutingTableIngressOptionsUsedForVpc(vpc_id);
    if (input.route_direct_link_ingress && ingressVpcOpts.route_direct_link_ingress) {
      generateIngressError(res, 'route_route_direct_link_ingress');
      return;
    }
    if (input.route_transit_gateway_ingress && ingressVpcOpts.route_transit_gateway_ingress) {
      generateIngressError(res, 'route_transit_gateway_ingress');
      return;
    }
    if (input.route_vpc_zone_ingress && ingressVpcOpts.route_vpc_zone_ingress) {
      generateIngressError(res, 'route_vpc_zone_ingress');
      return;
    }
    if (input.route_internet_ingress && ingressVpcOpts.route_internet_ingress) {
      generateIngressError(res, 'route_internet_ingress');
      return;
    }
  }
  // Finish creating the routing_table and add it to the DB.
  var id = addRoutingTable(_server.db.getCollection(_server.COLS.routing_tables), input);

  // Now retreive the newly created resource and send it back in the response.
  var routing_table = utils.findResource(_server.COLS.routing_tables, id, res, false);
  res.status(201).json(formatRoutingTableForClient(routing_table, req, res)).end();
};

/**
 * deleteRoutingTable()
 *
 * Delete a specific routing table
 *
 * DELETE /vpcs/{vpc_id}/routing_table/{routing_table_id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.createRoutingTable = createRoutingTable;
var deleteRoutingTable = function deleteRoutingTable(req, res) {
  // Attempt to find our resource.
  var routing_table = utils.findResource(_server.COLS.routing_tables, req.params.routing_table_id, res, false);
  if (!routing_table) {
    // Not found report a 404 error.
    return;
  }
  if (routing_table.is_default) {
    if (res) {
      res.status(403).json(utils.generateErrors('Not permitted to delete default routing_table.', 'is_default', _server.COLS.routing_tables));
    }
    return;
  }
  var foundSubnets = (0, _subnets.findSubnetsUsingRoutingTable)(routing_table.id);
  if (foundSubnets.length > 0) {
    if (res) {
      res.status(403).json(utils.generateErrors("Routing_table [".concat(routing_table.id, "] with attached subnet ").concat(foundSubnets[0].id), 'has_children', _server.COLS.routing_tables));
    }
    return;
  }

  // Now delete the routes in this routing table.
  deleteRoutesInRoutingTable(routing_table.id);

  // Now remove the resource from the database.
  var routing_tables = _server.db.getCollection(_server.COLS.routing_tables);
  routing_tables.remove(routing_table);

  // Respond with successful status.
  res.status(204).end();
};

/**
 * updateRoutingTable()
 *
 * Update details in an existing routing table.
 *
 * PATCH /vpcs/{vpc_id}/routing_table/{routing_table_id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteRoutingTable = deleteRoutingTable;
var updateRoutingTable = function updateRoutingTable(req, res) {
  var input = req.body;
  var routing_tables = _server.db.getCollection(_server.COLS.routing_tables);
  var originalRoutingTable = utils.findResource(_server.COLS.routing_tables, req.params.routing_table_id, res, false);
  if (!originalRoutingTable) {
    // Not found report a 404 error.
    return;
  }

  // Check if they are attempting to set an ingress routing option
  if (isIngressRoutingTable(input)) {
    // At least one of the ingress options is selected
    var ingressVpcOpts = getRoutingTableIngressOptionsUsedForVpc(originalRoutingTable.vpcId);

    // Check Route Direct Ingress
    if (!originalRoutingTable.route_direct_link_ingress && input.route_direct_link_ingress && ingressVpcOpts.route_direct_link_ingress) {
      generateIngressError(res, 'route_direct_link_ingress');
      return;
    }

    // Check Transit Gateway Ingress
    if (!originalRoutingTable.route_transit_gateway_ingress && input.route_transit_gateway_ingress && ingressVpcOpts.route_transit_gateway_ingress) {
      generateIngressError(res, 'route_transit_gateway_ingress');
      return;
    }

    // Check VPC Zone Ingress
    if (!originalRoutingTable.route_vpc_zone_ingress && input.route_vpc_zone_ingress && ingressVpcOpts.route_vpc_zone_ingress) {
      generateIngressError(res, 'route_vpc_zone_ingress');
      return;
    }

    // Check Public Internet Ingress
    if (!originalRoutingTable.route_internet_ingress && input.route_internet_ingress && ingressVpcOpts.route_internet_ingress) {
      generateIngressError(res, 'route_internet_ingress');
      return;
    }
  }
  var updatedRoutingTable = _objectSpread(_objectSpread({}, originalRoutingTable), input);
  if (input.accept_routes_from !== undefined) {
    updatedRoutingTable.accept_routes_from = input.accept_routes_from;
  }
  routing_tables.update(updatedRoutingTable);
  res.status(200).json(formatRoutingTableForClient(updatedRoutingTable, req, res)).end();
};
exports.updateRoutingTable = updateRoutingTable;