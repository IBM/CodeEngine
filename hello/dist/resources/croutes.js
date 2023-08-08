"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateRoute = exports.init = exports.getRoutes = exports.getRoute = exports.deleteRoute = exports.createRoute = exports.addRoute = void 0;
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
var ROUTE_ACTIONS = {
  DELEGATE: 'delegate',
  DELEGATE_VPC: 'delegate_vpc',
  DELIVER: 'deliver',
  // default
  DROP: 'drop'
};
var ROUTE_ORIGIN = {
  USER: 'user',
  // route was directly created by a user
  LEARNED: 'learned',
  // route was learned via a dynamic routing protocol
  SERVICE: 'service' // route was learned via a service, e.g. vpn_server
};

var debug = false;
var DEFAULT_NUMBER_OF_ROUTES = 50;

/**
 * isVpnGatewayInVpc()
 *
 * Checks to see if a VPN Gateway is a VPC.
 *
 * @param {*} gw - the gateway resource to check
 * @param {*} vpc - the vpc we are checking for
 * @return - true if gateway is in the vpc
 */
var isVpnGatewayInVpc = function isVpnGatewayInVpc(gw, vpc) {
  var vpc_id = _lodash["default"].get(vpc, 'id', undefined);
  var subnet_id = _lodash["default"].get(gw, 'subnet.id');
  var subnet = utils.findResource(_server.COLS.subnets, subnet_id);
  if (subnet) {
    var gw_vpc_id = _lodash["default"].get(subnet, 'vpc.id', 'no-match');
    return vpc_id === gw_vpc_id;
  }
  return false;
};

/**
 * getRandomVpnConnectionInVpc()
 *
 * Find all the VPN Connections in this VPC and return a random
 * one or undefined.
 *
 * @param {*} vpc
 * @return {*} A random connection in this VPC
 */
var getRandomVpnConnectionInVpc = function getRandomVpnConnectionInVpc(vpc) {
  var region = vpc.zone.region_name;
  var vpnGatewaysInSameVpc = _server.db.getCollection(_server.COLS.vpn_gateways).chain().where(function (gw) {
    return gw.zone.region_name === region && gw.mode === 'route' && isVpnGatewayInVpc(gw, vpc);
  }).data({
    removeMeta: true
  });
  var connectionsInZone = [];
  vpnGatewaysInSameVpc.forEach(function (gw) {
    connectionsInZone.push.apply(connectionsInZone, _toConsumableArray((0, _connections.getConnectionsForVpnGateway)(gw.id)));
  });
  var selectedConnection = casual.random_element(connectionsInZone);
  return selectedConnection;
};
var addRoute = function addRoute(routes, data) {
  var id = casual.uuid;
  var destinationSeed = casual.ip;
  var priority = data.priority || 2;
  var routing_table;
  var next_hop;
  var origin = data.origin || ROUTE_ORIGIN.USER; // Default to "user"

  // Get our routing table
  if (data._routing_table_id) {
    // A routing table was supplied so retreive it.
    routing_table = utils.findResource(_server.COLS.routing_tables, data._routing_table_id);
    if (!routing_table) {
      // We should onky get here from rias-mock init - since we have already verified params in create.
      throw new Error("addRoute - Supplied routing table [".concat(data._routing_table_id, "]does not exist"));
    }
  } else {
    // A routing table was not supplied so pick a random one.
    routing_table = utils.getRandomResource(_server.COLS.routing_tables);
    if (!routing_table) {
      // We should onky get here from rias-mock init - since we have already verified params in create.
      throw new Error('addRoute - No routing table available for route.');
    }
  }

  // Get our VPC from our routing able.
  var vpc = utils.findResource(_server.COLS.vpcs, routing_table.vpcId);

  // If we were provided an action lets use that else we get a random one.
  var action = data.action || casual.random_element(Object.values(ROUTE_ACTIONS));
  if (action === ROUTE_ACTIONS.DELIVER) {
    if (!data.next_hop) {
      if (casual.coin_flip && casual.coin_flip && casual.coin_flip) {
        // Add route to VPN Connection
        var vpnConnection = getRandomVpnConnectionInVpc(vpc);
        if (vpnConnection) {
          next_hop = {
            id: vpnConnection.id
          };
        } else {
          // If we couldn't find a connection in the same VPC use an IP.
          next_hop = {
            address: utils.getRandomIpAddress()
          };
        }
      } else {
        // Add route to Gateway IP Address
        next_hop = {
          address: utils.getRandomIpAddress()
        };
      }
    }
  } else {
    // This needs to always be included if action is not DELIVER
    next_hop = {
      address: '0.0.0.0'
    };
  }
  var selectedRegion = vpc.zone.region_name;
  var random_zone = utils.getRandomZoneInRegion(vpc.zone.region_name);
  var route = Object.assign({
    _vpc_id: vpc.id,
    _routing_table_id: routing_table.id,
    action: action,
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    name: utils.generateName('route', {
      region_name: selectedRegion
    }),
    zone: {
      name: random_zone.name
    },
    destination: "".concat(destinationSeed.substring(0, destinationSeed.lastIndexOf('.')), ".0/24"),
    priority: priority,
    next_hop: next_hop,
    origin: origin,
    advertise: data.advertise || false,
    lifecycle_state: casual.random_element(Object.values(_common.LIFECYCLE_STATE)),
    created_at: utils.generateCreateDate()
  }, data);
  routes.insert(route);
  return id;
};
exports.addRoute = addRoute;
var init = function init() {
  var routes = _server.db.addCollection(_server.COLS.croutes);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Add some routes (deliver action) under vpc1001 - 1
  addRoute(routes, {
    _routing_table_id: 'routing-table-1',
    id: 'fixed-custom-route-vpc1001-1-route1-id',
    name: 'fixed-custom-route-vpc1001-1-route1-name',
    destination: '10.0.0.0/24',
    priority: 1,
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '100.0.0.1'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-server-1',
      name: 'aaa-default-vpn-server-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_servers/vpn-server-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn-server:vpn-server-1',
      resource_type: 'vpn_server'
    }
  });

  // Add some routes (with deliver action) under vpc1001 - 1
  addRoute(routes, {
    _routing_table_id: 'routing-table-1',
    id: 'fixed-custom-route-vpc1001-1-route2-id',
    name: 'fixed-custom-route-vpc1001-1-route2-name',
    destination: '20.0.0.0/24',
    priority: 0,
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '10.0.0.2'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-gateway-1',
      name: 'aaa-default-vpn-gateway-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_gateways/vpn-gateway-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn:vpn-gateway-1',
      resource_type: 'vpn_gateway'
    }
  });

  // Add some routes (with deliver action) under vpc1001-rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    id: 'fixed-custom-route-vpc1003-rtable001-route1-id',
    name: 'fixed-custom-route-vpc1003-rtable001-route1-name',
    destination: '30.0.0.0/24',
    priority: 4,
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '10.0.0.3'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-server-1',
      name: 'aaa-default-vpn-server-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_servers/vpn-server-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn-server:vpn-server-1',
      resource_type: 'vpn_server'
    }
  });

  // Add some routes (with deliver action) under vpc1001-rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    id: 'fixed-custom-route-vpc1003-rtable001-route2-id',
    name: 'fixed-custom-route-vpc1003-rtable001-route2-name',
    destination: '40.0.0.0/24',
    priority: 3,
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      id: 'vpn-connection-1'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-gateway-1',
      name: 'aaa-default-vpn-gateway-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_gateways/vpn-gateway-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn:vpn-gateway-1',
      resource_type: 'vpn_gateway'
    }
  });

  // Add some routes (with non-deliver action) under vpc1001 - rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route001-name',
    action: ROUTE_ACTIONS.DELEGATE,
    destination: '100.0.1.0/24',
    id: 'fixed-custom-route-vpc1001-rtable001-route1-id'
  });

  // Add some routes (with non-deliver action) under vpc1001 - rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route002-name',
    action: ROUTE_ACTIONS.DELEGATE_VPC,
    destination: '100.0.2.0/24',
    id: 'fixed-custom-route-vpc1001-rtable001-route2-id'
  });

  // Add some routes (with non-deliver action) under vpc1001 - rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route003-name',
    action: ROUTE_ACTIONS.DROP,
    destination: '100.0.3.0/24',
    id: 'fixed-custom-route-vpc1001-rtable001-route3-id'
  });

  // Add two default VPC routes (next hop: IP) under vpc1001 - rtable001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route004-name',
    destination: '100.0.4.0/24',
    priority: 0,
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '200.0.0.1'
    },
    origin: ROUTE_ORIGIN.LEARNED,
    creator: {
      id: 'vpn-gateway-1',
      name: 'aaa-default-vpn-gateway-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_gateways/vpn-gateway-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn:vpn-gateway-1',
      resource_type: 'vpn_gateway'
    },
    id: 'fixed-custom-route-vpc1001-rtable001-route4-id'
  });
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route005-name',
    action: ROUTE_ACTIONS.DELIVER,
    destination: '100.0.5.0/24',
    next_hop: {
      address: '200.0.0.2'
    },
    origin: ROUTE_ORIGIN.USER,
    id: 'fixed-custom-route-vpc1001-rtable001-route5-id'
  });

  // Add two default VPN routes (next hop: VPN) under vpc1001
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route006-name',
    action: ROUTE_ACTIONS.DELIVER,
    destination: '100.0.6.0/24',
    next_hop: {
      id: 'vpn-connection-1'
    },
    origin: ROUTE_ORIGIN.USER,
    id: 'fixed-custom-route-vpc1001-rtable001-route6-id'
  });
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1001-rtable001-id',
    name: 'fixed-custom-route-vpc1001-rtable001-route007-name',
    destination: '100.0.7.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      id: 'vpn-connection-1'
    },
    origin: ROUTE_ORIGIN.USER,
    id: 'fixed-custom-route-vpc1001-rtable001-route7-id'
  });

  // Add two default VPC routes under vpc1002
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1002-rtable001-id',
    name: 'fixed-custom-route-vpc1002-rtable002-route001-name',
    destination: '101.0.0.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '201.0.0.1'
    },
    origin: ROUTE_ORIGIN.LEARNED,
    creator: {
      id: 'vpn-server-1',
      name: 'aaa-default-vpn-server-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_servers/vpn-server-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn-server:vpn-server-1',
      resource_type: 'vpn_server'
    },
    id: 'fixed-custom-route-vpc1002-rtable001-route1-id'
  });
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1002-rtable001-id',
    name: 'fixed-custom-route-vpc1002-rtable002-route002-name',
    destination: '101.0.1.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '201.0.0.2'
    },
    origin: ROUTE_ORIGIN.USER,
    id: 'fixed-custom-route-vpc1002-rtable001-route2-id'
  });

  // Add some routes (deliver action) under vpc1003-rtable003
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1002-rtable003-id',
    id: 'fixed-custom-route-vpc1002-rtable003-route1-id',
    name: 'fixed-custom-route-vpc1002-rtable003-route1-name',
    destination: '50.0.0.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      address: '10.0.0.5'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-server-1',
      name: 'aaa-default-vpn-server-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_servers/vpn-server-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn-server:vpn-server-1',
      resource_type: 'vpn_server'
    }
  });

  // Add some routes (with deliver action) under vpc1003-rtable003
  addRoute(routes, {
    _routing_table_id: 'routing-table-vpc1002-rtable003-id',
    id: 'fixed-custom-route-vpc1002-rtable003-route2-id',
    name: 'fixed-custom-route-vpc1002-rtable003-route2-name',
    destination: '60.0.0.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      id: 'vpn-connection-1'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-gateway-1',
      name: 'aaa-default-vpn-gateway-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_gateways/vpn-gateway-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn:vpn-gateway-1',
      resource_type: 'vpn_gateway'
    }
  });
  addRoute(routes, {
    _routing_table_id: 'aa-routing-table-vpc1001-1-id',
    id: 'fixed-custom-route-vpc1002-rtable0010-route2-id',
    name: 'fixed-custom-route-vpc1002-rtable010-route2-name',
    destination: '60.0.0.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      id: 'vpn-connection-6'
    },
    origin: ROUTE_ORIGIN.SERVICE,
    creator: {
      id: 'vpn-gateway-1',
      name: 'aaa-default-vpn-gateway-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/vpn_gateways/vpn-gateway-1',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::vpn:vpn-gateway-1',
      resource_type: 'vpn_gateway'
    }
  });
  addRoute(routes, {
    _routing_table_id: 'aaa-routing-table-vpc1001-3-id-drs',
    id: 'fixed-custom-route-vpc1001-3-id-drs',
    name: 'fixed-custom-route-vpc1001-3-id-drs-name',
    destination: '60.0.0.0/24',
    action: ROUTE_ACTIONS.DELIVER,
    next_hop: {
      id: 'vpn-connection-6'
    },
    origin: ROUTE_ORIGIN.LEARNED,
    creator: {
      id: 'aaaaaaaa-aaaa-aaaa-drs1-aaaaaaaaaaaa',
      name: 'aaa-default-drs-1',
      href: 'http://localhost:4000/rias-mock/us-east/v1/dynamic_route_servers/aaaaaaaa-aaaa-aaaa-drs1-aaaaaaaaaaaa',
      crn: 'crn:v1:bluemix:public:is:us-south:a/123456::dynamic-route-server:aaaaaaaa-aaaa-aaaa-drs1-aaaaaaaaaaaa',
      resource_type: 'dynamic_route_server'
    }
  });
  utils.repeat(function () {
    return addRoute(routes, {});
  }, DEFAULT_NUMBER_OF_ROUTES);
};
exports.init = init;
var formatRouteForClient = function formatRouteForClient(req, route) {
  var action = route.action,
    advertise = route.advertise,
    created_at = route.created_at,
    destination = route.destination,
    priority = route.priority,
    id = route.id,
    lifecycle_state = route.lifecycle_state,
    name = route.name,
    origin = route.origin,
    creator = route.creator;

  // Figure out our href
  var href = "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(route._vpc_id, "/routing_tables/").concat(route._routing_table_id, "/routes/").concat(route.id);

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
    id: id,
    name: name,
    href: href,
    action: action,
    advertise: advertise,
    created_at: created_at,
    destination: destination,
    priority: priority,
    lifecycle_state: lifecycle_state,
    next_hop: next_hop,
    origin: origin,
    creator: creator,
    zone: zone
  };
  if (debug) {
    // Show our internal fields
    routeForClient._vpc_id = route._vpc_id;
    routeForClient._routing_table_id = route._routing_table_id;
  }
  return routeForClient;
};
var getRoutes = function getRoutes(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var routing_table_id = req.params.routing_table_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("GET /vpcs/".concat(vpc_id, "/routing_tables/").concat(routing_table_id));
  }

  // Verify the VPC
  if (!debug) {
    var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
    if (!vpc) return;
  }

  // Verify the Routing Table
  if (!debug) {
    var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
    if (!routing_table) return;
  }
  var routeFilter = function routeFilter(route) {
    return route._vpc_id === vpc_id && route._routing_table_id === routing_table_id;
  };
  var routes = utils.getResources(req, _server.COLS.croutes, routeFilter);
  routes.routes = routes.croutes.map(function (route) {
    return formatRouteForClient(req, route);
  });
  delete routes.croutes;
  res.json(routes).end();
};
exports.getRoutes = getRoutes;
var getRoute = function getRoute(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var routing_table_id = req.params.routing_table_id;
  var route_id = req.params.route_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("GET /vpcs/{vpc_id}/routing_tables/".concat(routing_table_id, "/routes/").concat(route_id));
  }

  // Verify the VPC
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;

  // Verify the Routing Table
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
  if (!routing_table) return;

  // Now find the routes in this VPC
  var routesCol = _server.db.getCollection(_server.COLS.croutes);
  var routes = routesCol.chain().find({
    _vpc_id: vpc_id,
    _routing_table_id: routing_table_id,
    id: route_id
  }).simplesort('name').data({
    removeMeta: true
  });
  if (!routes || routes.length === 0) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.croutes)).end();
    return;
  }
  var routeForClient = formatRouteForClient(req, routes[0]);
  res.status(200).json(routeForClient).end();
};

/**
 * createRoute()
 *
 * Create a route.
 *   - POST vpcs/{vpc_id}/routing_table/{routing_table_id}/routes
 *
 * Required/Expected Inputs:
 *   - req.params.vpc_id
 *   - req.params.routing_table_id
 *   - req.body.destination : String (IPv4_CIDR)
 *   - req.body.next_hop : (one of)
 *     - { address: String (IPv4_ADDRESS) } or
 *     - { id: String (VPN Connection id) }
 *   - req.body.zone: { name: String (Zone name)}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getRoute = getRoute;
var createRoute = function createRoute(req, res) {
  var input = req.body;
  var vpc_id = req.params.vpc_id;
  var routing_table_id = req.params.routing_table_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("POST vpcs/".concat(vpc_id, "/routing_table/").concat(routing_table_id, "/routes"));
  }

  // Verify the name - name is optional
  var routesCol = _server.db.getCollection(_server.COLS.croutes);
  if (utils.duplicateNameCheck(routesCol, input, req, res, 'resource with that name already exists', 'route', true)) {
    return;
  }
  input.lifecycle_state = _common.LIFECYCLE_STATE.STABLE;

  // Verify the VPC
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;
  input._vpc_id = vpc_id;

  // Verify the Routing Table
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
  if (!routing_table) return;
  input._routing_table_id = routing_table_id;

  // Verify the destination
  if (utils.validIpV4CidrCheck(input.destination, req, res, 'destination')) {
    return;
  }

  // Verify the zone
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }

  // We should verify that the zone is the the same region as the VPC

  // Set default value for action.
  if (!input.action) input.action = ROUTE_ACTIONS.DELIVER;

  // Check constraint between action and next_hop.ip
  if (input.action !== ROUTE_ACTIONS.DELIVER) {
    if (!_lodash["default"].get(input, 'next_hop.ip') === '0.0.0.0') {
      if (res) {
        var message = 'Selected route action requires (next_hop.ip = 0.0.0.0)';
        res.status(400).json(utils.generateErrors(message, 'invalid', 'next_hop')).end();
      }
      return;
    }
  }
  if (input.next_hop && input.next_hop.address) {
    // We are using a Gateway IP Address
    // We could validate the CIDR here.
  } else if (input.next_hop && input.next_hop.id) {
    // We are using a VPN Connection
    // Validate the VPN Connection
    var connection = utils.findResource(_server.COLS.connections, input.next_hop.id, res, false);
    if (!connection) return;
  } else if (input.action === ROUTE_ACTIONS.DELIVER) {
    // No valid next_hop
    if (res) {
      var _message = 'Invalid next_hop must provide address or id';
      res.status(400).json(utils.generateErrors(_message, 'invalid', 'next_hop')).end();
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
  var routing_table_id = req.params.routing_table_id;
  var route_id = req.params.route_id;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("DEL /vpcs/{vpc_id}/routes/{route_id} vpc_id= ".concat(vpc_id || 'none') + "route_id = ".concat(route_id));
  }

  // Verify the VPC
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;

  // Verify the Routing Table
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
  if (!routing_table) return;

  // Now try to find the route
  var routesCol = _server.db.getCollection(_server.COLS.croutes);
  var route = routesCol.findOne({
    _vpc_id: vpc_id,
    _routing_table_id: routing_table_id,
    id: route_id
  });
  if (!route) {
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.croutes)).end();
    return;
  }
  routesCol.remove(route);
  res.status(204).end();
};
exports.deleteRoute = deleteRoute;
var updateRoute = function updateRoute(req, res) {
  // Get our url based params
  var vpc_id = req.params.vpc_id;
  var routing_table_id = req.params.routing_table_id;
  var route_id = req.params.route_id;

  // Get our new input
  var input = req.body;
  if (debug) {
    // eslint-disable-next-line no-console
    console.log("PATCH /vpcs/".concat(vpc_id, "/routing_tables/").concat(routing_table_id, "/routes/").concat(route_id));
  }

  // Verify the VPC
  var vpc = utils.findResource(_server.COLS.vpcs, vpc_id, res, false);
  if (!vpc) return;

  // Verify the Routing Table
  var routing_table = utils.findResource(_server.COLS.routing_tables, routing_table_id, res, false);
  if (!routing_table) return;

  // Now find the matching routes in this vpc_id and route_id.
  var routesCol = _server.db.getCollection(_server.COLS.croutes);
  var routes = routesCol.find({
    _vpc_id: vpc_id,
    _routing_table_id: routing_table_id,
    id: route_id
  });
  if (!routes || routes.length === 0) {
    // We didn't find any
    res.status(404).json(utils.generateErrors("Resource not found with id ".concat(route_id), 'not_found', _server.COLS.croutes)).end();
    return;
  }
  var route = routes[0];
  var updatedRoute = _objectSpread(_objectSpread({}, route), input);
  routesCol.update(updatedRoute);
  var resultRoute = utils.findResource(_server.COLS.croutes, updatedRoute.id, res, true);
  if (!resultRoute) return;
  var routeForClient = formatRouteForClient(req, resultRoute);
  res.status(200).json(routeForClient).end();
};
exports.updateRoute = updateRoute;