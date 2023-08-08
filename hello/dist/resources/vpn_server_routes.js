"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateRoute = exports.init = exports.getRoutesForVpnServer = exports.getRoutes = exports.getRoute = exports.formatRoutesForClient = exports.deleteRoute = exports.createRoute = exports.addRoute = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var VPN_SERVER_ROUTE_HEALTH_STATE = {
  OK: 'ok',
  DEGRADED: 'degraded',
  FAULTED: 'faulted',
  INAPPLICABLE: 'inapplicable'
};
var VPN_SERVER_ROUTE_HEALTH_REASONS = {
  internal_error: 'Internal error. Contact IBM Support.'
};

// Random health state values
var VPN_SERVER_ROUTE_RANDOM_HEALTH_STATES = [VPN_SERVER_ROUTE_HEALTH_STATE.OK, VPN_SERVER_ROUTE_HEALTH_STATE.DEGRADED, VPN_SERVER_ROUTE_HEALTH_STATE.FAULTED, VPN_SERVER_ROUTE_HEALTH_STATE.FAULTED, VPN_SERVER_ROUTE_HEALTH_STATE.INAPPLICABLE];
var VPN_SERVER_ROUTE_LIFECYCLE_STATE = {
  DELETED: 'deleted',
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending',
  STABLE: 'stable',
  UPDATING: 'updating',
  WAITING: 'waiting',
  SUSPENDED: 'suspended'
};
var VPN_SERVER_ROUTE_LIFECYCLE_REASONS = {
  resource_suspended_by_provider: 'Resource has been suspended. Contact IBM Support.'
};

// Random lifecycle state values
var VPN_SERVER_ROUTE_RANDOM_LIFECYCLE_STATES = [VPN_SERVER_ROUTE_LIFECYCLE_STATE.DELETED, VPN_SERVER_ROUTE_LIFECYCLE_STATE.DELETING, VPN_SERVER_ROUTE_LIFECYCLE_STATE.FAILED, VPN_SERVER_ROUTE_LIFECYCLE_STATE.FAILED, VPN_SERVER_ROUTE_LIFECYCLE_STATE.FAILED, VPN_SERVER_ROUTE_LIFECYCLE_STATE.PENDING, VPN_SERVER_ROUTE_LIFECYCLE_STATE.STABLE, VPN_SERVER_ROUTE_LIFECYCLE_STATE.UPDATING, VPN_SERVER_ROUTE_LIFECYCLE_STATE.WAITING, VPN_SERVER_ROUTE_LIFECYCLE_STATE.SUSPENDED];
var ROUTE_ACTION = {
  TRANSLATE: 'translate',
  DELIVER: 'deliver',
  DROP: 'drop'
};

/**
 * getAndVerifyRoute()
 *
 * This a common utility for verifying and obtaining a VPN Server Route. This
 * pattern is frequently used in the vpn_server_routes.js resource file.
 *
 * routes are part of a VPN Server. This function first obtains the VPN Server
 * and makes sure that it exists. If it does not exist then 404 status is returned.
 * If it does exist then we attempt to obtain the VPN Server Route. Depending on the
 * passed parameter we either strip the meta infomation or not.
 *
 * @param {*} req - the original request
 * @param {*} res - the original response
 * @param {*} removeMeta - boolean indicating whether to strip meta from the VPN Server Route.
 */
var getAndVerifyRoute = function getAndVerifyRoute(req, res) {
  var removeMeta = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // Get our ids
  var vpnServerId = req.params.vpn_server_id;
  var routeId = req.params.route_id;

  // Check for VPN Server existence
  var vpnServer = utils.findResource(_server.COLS.vpn_servers, vpnServerId, res, false);
  if (!vpnServer) return null;

  // Now lets find our route
  var routes = _server.db.getCollection(_server.COLS.vpn_server_routes).chain().find({
    id: routeId,
    _vpn_server_id: vpnServerId
  }).data({
    removeMeta: removeMeta
  });

  // Check that the routes exists
  if (!routes || routes.length === 0) {
    res.status(404).json(utils.generateErrors("Route not found with id ".concat(routeId, " attached to VPN Server id ").concat(vpnServerId), 'not_found', _server.COLS.vpn_server_routes)).end();
    return null;
  }
  return routes[0];
};

/**
 * getRoutesForVpnServer()
 *
 * Retrieves the routes that are attached to this VPN Server.
 *
 * @param {*} vpnServerId
 */
var getRoutesForVpnServer = function getRoutesForVpnServer(vpnServerId) {
  return (
    // Get all the routes that are for this VPN Servers
    _server.db.getCollection(_server.COLS.vpn_server_routes).chain().find({
      _vpn_server_id: vpnServerId
    }).data({
      removeMeta: true
    })
  );
};

/**
 * addRoute()
 *
 * Creates a new Route with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the
 * new item is added to the collection.
 *
 * @param {*} routes - reference to the route collection
 * @param {*} data - override data to use for route creation.
 * @param {string} - vpnServerId
 * @return - ID of the new resource
 */
exports.getRoutesForVpnServer = getRoutesForVpnServer;
var addRoute = function addRoute(routes, data, vpnServerId) {
  // All of our REST API fields should be included here in correct field order.
  var random_destination = "192.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".0/24");
  var baseData = {
    _vpn_server_id: vpnServerId,
    id: _casual["default"].uuid,
    name: "vpn-server-route-".concat(_casual["default"].integer(1, 65535)),
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    action: _casual["default"].random_element(Object.values(ROUTE_ACTION)),
    create_at: utils.generateCreateDate(),
    destination: random_destination,
    health_state: _casual["default"].random_element(VPN_SERVER_ROUTE_RANDOM_HEALTH_STATES),
    lifecycle_state: _casual["default"].random_element(VPN_SERVER_ROUTE_RANDOM_LIFECYCLE_STATES),
    resource_type: 'vpn_server_route'
  };
  var newRoute = _objectSpread(_objectSpread({}, baseData), data);

  // Set health status reasons for negative status
  var healthReasonCode = '';
  if (newRoute.health_state !== VPN_SERVER_ROUTE_HEALTH_STATE.OK) {
    healthReasonCode = _casual["default"].random_element(Object.keys(VPN_SERVER_ROUTE_HEALTH_REASONS));
  }
  if (healthReasonCode) {
    newRoute.health_reasons = [{
      code: healthReasonCode,
      message: VPN_SERVER_ROUTE_LIFECYCLE_STATE[healthReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_server_route/lifecycle_reasons/".concat(healthReasonCode)
    }];
  }

  // Set lifecycle status reasons for negative status
  var lifecycleReasonCode = '';
  if (newRoute.lifecycle_state === VPN_SERVER_ROUTE_LIFECYCLE_STATE.SUSPENDED) {
    lifecycleReasonCode = 'resource_suspended_by_provider';
  }
  if (lifecycleReasonCode) {
    newRoute.lifecycle_reasons = [{
      code: lifecycleReasonCode,
      message: VPN_SERVER_ROUTE_LIFECYCLE_REASONS[lifecycleReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_server_route/lifecycle_reasons/".concat(lifecycleReasonCode)
    }];
  }
  routes.insert(newRoute);
  return newRoute.id;
};

/**
 * init()
 *
 * Initialize the VPN Server collection.
 */
exports.addRoute = addRoute;
var init = function init() {
  // Create the route collection
  _server.db.addCollection(_server.COLS.vpn_server_routes);

  // Route only exist as part of a VPN Server so their creation will
  // be part of the VPN Server creation.
};

/**
 * formatRouteForClient()
 *
 * Make changes to make VPN Server Route from db collection suitable for client display.
 *
 * @param {*} req
 * @param {*} route
 */
exports.init = init;
var formatRoutesForClient = function formatRoutesForClient(req, route) {
  // VPN Server Route href
  var routeForClient = _objectSpread({}, route);
  routeForClient.href = "".concat(utils.getBaseApiUrl(req), "vpn_servers/").concat(routeForClient._vpn_server_id, "/routes/").concat(routeForClient.id);
  routeForClient.crn = utils.updateResourceCrnRegion(routeForClient, req);

  // Remove stuff not intended for route
  delete routeForClient._vpn_server_id;
  return routeForClient;
};

/**
 * getRoutes()
 *
 * Get a list of all the Routes.
 *
 * @param {*} req
 * @param {*} res
 */
exports.formatRoutesForClient = formatRoutesForClient;
var getRoutes = function getRoutes(req, res) {
  // const routes = utils.getResources(req, COLS.vpn_server_routes);

  // First lets check to make sure the VPN Server exists.
  var vpn_server_id = req.params.vpn_server_id;
  var vpnServer = _server.db.getCollection(_server.COLS.vpn_servers).findOne({
    id: vpn_server_id
  });
  if (!vpnServer) {
    res.status(404).end();
    return;
  }

  // Now lets find our route
  var routes = _server.db.getCollection(_server.COLS.vpn_server_routes).chain().find({
    _vpn_server_id: req.params.vpn_server_id
  }).data({
    removeMeta: true
  });

  // Format the routes for output.
  var routesForClient = routes.map(function (route) {
    return formatRoutesForClient(req, route);
  });

  // RIAS returns empty array here if no routes are present.
  res.json({
    routes: routesForClient
  }).end();
};

/**
 * getRoute()
 *
 * Get a specific VPN Server Route.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getRoutes = getRoutes;
var getRoute = function getRoute(req, res) {
  // Get and Verify route
  var route = getAndVerifyRoute(req, res, true);
  if (!route) return;
  var routeForClient = formatRoutesForClient(req, route);
  res.json(routeForClient).end();
};

/**
 * deleteRoute()
 *
 * Delete a specific VPN Server Route.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getRoute = getRoute;
var deleteRoute = function deleteRoute(req, res) {
  // Get and Verify route
  var route = getAndVerifyRoute(req, res, false);
  if (!route) return;

  // Delete the route
  _server.db.getCollection(_server.COLS.vpn_server_routes).remove(route);
  res.status(202).end();
};

/**
 * createRoute()
 *
 * Create a new VPN Server Route.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteRoute = deleteRoute;
var createRoute = function createRoute(req, res) {
  var input = req.body;
  var _vpn_server_id = req.params.vpn_server_id;

  // Verify the VPN Server
  var vpnServer = utils.findResource(_server.COLS.vpn_servers, _vpn_server_id, res, false);
  if (!vpnServer) return;
  var routesCol = _server.db.getCollection(_server.COLS.vpn_server_routes);

  // Check for duplicates
  var duplicate = utils.duplicateNameCheck(routesCol, input, req, res, 'resource with that name already exists', 'vpn_server_route');
  if (duplicate) {
    return;
  }

  // Add the route and get it again.
  var id = addRoute(routesCol, input, _vpn_server_id, false, vpnServer.zone);
  req.params.route_id = id;
  var route = getAndVerifyRoute(req, res, true);
  var routeForClient = formatRoutesForClient(req, route);
  res.status(201).json(routeForClient).end();
};

/**
 * updateRoute()
 *
 * Update the data in an existing VPN Server Route.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createRoute = createRoute;
var updateRoute = function updateRoute(req, res) {
  var routesCol = _server.db.getCollection(_server.COLS.vpn_server_routes);

  // Get and Verify Route
  var route = getAndVerifyRoute(req, res, false);
  if (!route) return;

  // Now update our entry
  var updatedRoute = _objectSpread(_objectSpread({}, route), req.body);
  routesCol.update(updatedRoute);

  // Now retrieve our entry again
  req.params.route_id = updatedRoute.id;
  req.params.vpn_server_id = updatedRoute._vpn_server_id;
  var resultClient = getAndVerifyRoute(req, res, true);
  var routeForClient = getAndVerifyRoute(req, resultClient);
  // Now provide the result
  res.status(200).json(routeForClient).end();
};
exports.updateRoute = updateRoute;