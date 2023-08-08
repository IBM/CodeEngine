"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateRoute = exports.init = exports.getRoutes = exports.getRoute = exports.deleteRoute = exports.createRoute = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _connections = require("./connections");
var _common = require("./common");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
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
var debug = false;
var SUPPORT_VPN_ROUTES = true;
var DEFAULT_NUMBER_OF_ROUTES = 15;
var getRandomVPCAndConnection = function getRandomVPCAndConnection(region) {
  var gwsInZone = _server.db.getCollection(_server.COLS.vpn_gateways).chain().where(function (gw) {
    return gw.zone.region_name === region && gw.mode === 'route';
  }).data({
    removeMeta: true
  });
  var connectionsInZone = [];
  gwsInZone.forEach(function (gw) {
    connectionsInZone.push.apply(connectionsInZone, _toConsumableArray((0, _connections.getConnectionsForVpnGateway)(gw.id)));
  });
  var selectedConnection = casual.random_element(connectionsInZone);
  var selectedVPNGW = gwsInZone.find(function (gw) {
    return gw.id === _lodash["default"].get(selectedConnection, '_vpn_gateway_id');
  });
  var selectedSubnetId = _lodash["default"].get(selectedVPNGW, 'subnet.id');
  var selectedVPC = _lodash["default"].get(utils.getResource(_server.COLS.subnets, selectedSubnetId), '[0].vpc');
  return [selectedVPC, selectedConnection];
};
var addRoute = function addRoute(routes, data) {
  var id = casual.uuid;
  var destinationSeed = casual.ip;
  var selectedRegion = data.regionID || utils.getRandomRegion().name;
  var vpc;
  var next_hop;
  if (SUPPORT_VPN_ROUTES && casual.coin_flip) {
    // Add route to VPN Connection
    var connectionAndVPC = getRandomVPCAndConnection(selectedRegion);
    var vpnConnectionId = connectionAndVPC[1].id;
    vpc = connectionAndVPC[0];
    next_hop = {
      id: vpnConnectionId
    };
  } else {
    // Add route to Gateway IP Address
    vpc = utils.getRandomResource(_server.COLS.vpcs);
    next_hop = {
      address: utils.getRandomIpAddress()
    };
  }
  var random_zone = utils.getRandomZoneInRegion(selectedRegion);
  var route = Object.assign({
    _vpc_id: vpc.id,
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    name: utils.generateName('route', {
      region_name: selectedRegion
    }),
    zone: {
      name: random_zone.name,
      href: '' // placeholder
    },

    destination: "".concat(destinationSeed.substring(0, destinationSeed.lastIndexOf('.')), ".0/24"),
    next_hop: next_hop,
    lifecycle_state: casual.random_element(Object.values(_common.LIFECYCLE_STATE)),
    // resource_group - Not using at this time.
    // resource_group: {
    //   id: utils.getRandomResourceGroup(),
    // },
    created_at: utils.generateCreateDate()
  }, data);

  //
  // resource_group - Not using at this time.
  //
  // const resourceGroup = utils.getResource(COLS.resourceGroups, route.resource_group.id)[0];
  // route.resource_group.name = resourceGroup && resourceGroup.name;

  routes.insert(route);
  return id;
};
var init = function init() {
  var routes = _server.db.addCollection(_server.COLS.routes);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Add fixed route
  addRoute(routes, {
    name: 'fixed-normal-vpc-route-1',
    _vpc_id: 'vpc1001',
    zone: {
      name: 'us-east-1'
    },
    destination: '100.0.0.0/24',
    next_hop: {
      address: '200.0.0.1'
    },
    id: 'fixed-normal-vpc-route-1-id'
  });

  // Add fixed route
  addRoute(routes, {
    name: 'fixed-normal-vpc-route-2',
    _vpc_id: 'vpc1001',
    zone: {
      name: 'us-east-1'
    },
    destination: '100.0.1.0/24',
    next_hop: {
      address: '200.0.1.1'
    },
    id: 'fixed-normal-vpc-route-2-id'
  });
  addRoute(routes, {
    name: 'aaa-default-vpn-route-1'
  });
  addRoute(routes, {
    name: 'aaa-default-vpn-route-2'
  });
  addRoute(routes, {
    name: 'aaa-default-vpn-route-3'
  });
  utils.repeat(function () {
    return addRoute(routes, {});
  }, DEFAULT_NUMBER_OF_ROUTES);
};
exports.init = init;
var formatRouteForClient = function formatRouteForClient(req, route) {
  // Figure out our next_hop
  var next_hop = {};
  if (route.next_hop) {
    if (route.next_hop.address) {
      // We have a Normal Route
      next_hop.address = route.next_hop.address;
    } else if (route.next_hop.id) {
      // We have a VPN Route
      next_hop.id = route.next_hop.id;
      var connection = utils.findResource(_server.COLS.connections, next_hop.id, null, true);
      if (connection) {
        next_hop.href = "".concat(utils.getBaseApiUrl(req), "vpn_gateways/").concat(connection._vpn_gateway_id, "/connections/").concat(connection.id);
        next_hop.name = connection.name;
      }
    }
  }

  // Figure out our zone
  var zone = {};
  if (route.zone && route.zone.name) {
    zone.name = route.zone.name;
    var region = utils.findZone(route.zone.name).region_name;
    zone.href = "".concat(utils.getBaseApiUrl(req), "regions/").concat(region, "/zones/").concat(route.zone.name);
  }

  // Build a new object from sratch so we never modify the original passed object
  // and we never include more fields than we expect.
  var routeForClient = {
    id: route.id,
    crn: route.crn,
    href: "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(route._vpc_id, "/routes/").concat(route.id),
    name: route.name,
    zone: zone,
    destination: route.destination,
    next_hop: next_hop,
    lifecycle_state: route.lifecycle_state,
    created_at: route.created_at
  };
  if (debug) {
    routeForClient._vpc_id = route._vpc_id;
  }
  return routeForClient;
};

/**
 * createRoute()
 *
 * Create a [vpcs/{vpc_id}/routes] route.
 *
 * Required/Expected Inputs:
 *   - req.params.vpc_id
 *   - req.body.name : String (Route name)
 *   - req.body.destination : String (IPv4_CIDR)
 *   - req.body.next_hop : (one of)
 *     - { address: String (IPv4_ADDRESS) } or
 *     - { id: String (VPN Connection id) } (if SUPPORT_VPN_ROUTES)
 *   - req.body.zone: { name: String (Zone name)}
 *
 * @param {*} req
 * @param {*} res
 */
var createRoute = function createRoute(req, res) {
  var vpc_id = req.params.vpc_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("POST vpcs/{vpc_id}/routes/{route_id} vpc_id = ".concat(vpc_id || 'none'));
  }
  var input = req.body;
  var routesCol = _server.db.getCollection(_server.COLS.routes);
  var duplicate = utils.duplicateNameCheck(routesCol, input, req, res, 'resource with that name already exists', 'route');
  if (duplicate) {
    return;
  }
  input.lifecycle_state = _common.LIFECYCLE_STATE.STABLE;

  // Verify the VPC
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;
  input._vpc_id = vpc_id;

  // Verify the destination
  if (utils.validIpV4CidrCheck(input.destination, req, res, 'destination')) {
    return;
  }

  // Verify the zone
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }
  if (input.next_hop && input.next_hop.address) {
    // We are using a Gateway IP Address
    // This is valid!
  } else if (SUPPORT_VPN_ROUTES && input.next_hop && input.next_hop.id) {
    // We are using a VPN Connection
    var connection = utils.findResource(_server.COLS.connections, input.next_hop.id, res, false);
    if (!connection) return;
  } else {
    // No valid next_hop
    if (res) {
      var message;
      if (SUPPORT_VPN_ROUTES) {
        message = 'Invalid next_hop must provide address or id';
      } else {
        message = 'Invalid next_hop must provide address';
      }
      res.status(400).json(utils.generateErrors(message, 'invalid', 'next_hop')).end();
    }
    return;
  }
  var id = addRoute(routesCol, input);
  var routes = routesCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var routeForClient = formatRouteForClient(req, routes[0]);
  res.status(201).json(routeForClient).end();
};
exports.createRoute = createRoute;
var deleteRoute = function deleteRoute(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var route_id = req.params.route_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("DEL /vpcs/{vpc_id}/routes/{route_id} vpc_id= ".concat(vpc_id || 'none') + "route_id = ".concat(route_id));
  }

  // First verify we have a valid VPC.
  var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
  var vpc = vpcCols.findOne({
    id: vpc_id
  });
  if (!vpc) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(vpc_id), 'not_found', _server.COLS.vpcs)).end();
    return;
  }

  // Now try to find the route
  var routesCol = _server.db.getCollection(_server.COLS.routes);
  var route = routesCol.findOne({
    _vpc_id: vpc_id,
    id: route_id
  });
  if (!route) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.routes)).end();
    return;
  }
  routesCol.remove(route);
  res.status(204).end();
};
exports.deleteRoute = deleteRoute;
var updateRoute = function updateRoute(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var route_id = req.params.route_id;

  // Get our new input
  var input = req.body;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("PATCH /vpcs/{vpc_id}/routes/{route_id} vpc_id = ".concat(vpc_id || 'none', " ") + "route_id = ".concat(route_id));
  }

  // First verify we have a valid VPC.
  var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
  var vpc = vpcCols.findOne({
    id: vpc_id
  });
  if (!vpc) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(vpc_id), 'not_found', _server.COLS.vpcs)).end();
    return;
  }

  // Now find the matching routes in this vpc_id and route_id.
  var routesCol = _server.db.getCollection(_server.COLS.routes);
  var routes = routesCol.find({
    _vpc_id: vpc_id,
    id: route_id
  });
  if (!routes || routes.length === 0) {
    // We didn't find any
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.routes)).end();
    return;
  }
  var route = routes[0];
  var updatedRoute = _objectSpread(_objectSpread({}, route), input);
  routesCol.update(updatedRoute);
  var resultRoute = utils.findResource(_server.COLS.routes, updatedRoute.id, res, true);
  if (!resultRoute) return;
  var routeForClient = formatRouteForClient(req, resultRoute);
  res.status(200).json(routeForClient).end();
};
exports.updateRoute = updateRoute;
var getRoutes = function getRoutes(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("GET /vpcs/{vpc_id} vpc_id = ".concat(vpc_id || 'none'));
  }

  // First verify we have a valid VPC.
  if (vpc_id !== '*' || !debug) {
    var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
    var vpc = vpcCols.findOne({
      id: vpc_id
    });
    if (!vpc) {
      res.status(404).json(utils.generateErrors("Resource not found with id ".concat(vpc_id), 'not_found', _server.COLS.vpcs)).end();
      return;
    }
  }

  // Now find the routes in this VPC
  var routesCol = _server.db.getCollection(_server.COLS.routes);
  var routes;
  if (vpc_id !== '*') {
    routes = routesCol.chain().find({
      _vpc_id: vpc_id
    }).simplesort('name').data({
      removeMeta: true
    });
  } else if (debug === true) {
    // Wild card useful for viewing/finding all routes.
    routes = routesCol.chain().simplesort('name').data({
      removeMeta: true
    });
  }
  var routesForClient = routes.map(function (route) {
    return formatRouteForClient(req, route);
  });
  var allRoutesForClient = {
    routes: routesForClient
  };
  res.json(allRoutesForClient).end();
};
exports.getRoutes = getRoutes;
var getRoute = function getRoute(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var route_id = req.params.route_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("GET /vpcs/{vpc_id}/routes/{route_id} = ".concat(vpc_id || 'none', " route_id = ").concat(route_id));
  }

  // First verify we have a valid VPC.
  var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
  var vpc = vpcCols.findOne({
    id: vpc_id
  });
  if (!vpc) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(vpc_id), 'not_found', _server.COLS.vpcs)).end();
    return;
  }

  // Now find the routes in this VPC
  var routesCol = _server.db.getCollection(_server.COLS.routes);
  var routes = routesCol.chain().find({
    _vpc_id: vpc_id,
    id: route_id
  }).simplesort('name').data({
    removeMeta: true
  });
  if (!routes || routes.length === 0) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.routes)).end();
    return;
  }
  var routeForClient = formatRouteForClient(req, routes[0]);
  res.status(200).json(routeForClient).end();
};
exports.getRoute = getRoute;