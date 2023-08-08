"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getClientsForVpnServer = exports.getClients = exports.getClient = exports.formatVpnServerClientForClient = exports.disconnectClient = exports.deleteClient = exports.addClient = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var VPN_SERVER_AUTHENTICATION_METHOD = {
  USERNAME: 'username',
  CERTIFICATE: 'certificate'
};
var CLIENT_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected'
};

// Random Status values favoring CONNECTED
var CLIENT_STATUSES = [CLIENT_STATUS.CONNECTED, CLIENT_STATUS.CONNECTED, CLIENT_STATUS.CONNECTED, CLIENT_STATUS.DISCONNECTED];

/**
 * getAndVerifyClient()
 *
 * This a common utility for verifying and obtaining a VPN Server Client. This
 * pattern is frequently used in the vpn_server_clients.js resource file.
 *
 * clients are part of a VPN Server. This function first obtains the VPN Server
 * and makes sure that it exists. If it does not exist then 404 status is returned.
 * If it does exist then we attempt to obtain the VPN Server Client. Depending on the
 * passed parameter we either strip the meta infomation or not.
 *
 * @param {*} req - the original request
 * @param {*} res - the original response
 * @param {*} removeMeta - boolean indicating whether to strip meta from the VPN Server Client.
 */
var getAndVerifyClient = function getAndVerifyClient(req, res) {
  var removeMeta = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // Get our ids
  var vpnServerId = req.params.vpn_server_id;
  var clientId = req.params.client_id;

  // Check for VPN Server existence
  var vpnServer = utils.findResource(_server.COLS.vpn_servers, vpnServerId, res, false);
  if (!vpnServer) return null;

  // Now lets find our client
  var clients = _server.db.getCollection(_server.COLS.vpn_server_clients).chain().find({
    id: clientId,
    _vpn_server_id: vpnServerId
  }).data({
    removeMeta: removeMeta
  });

  // Check that the clients exists
  if (!clients || clients.length === 0) {
    res.status(404).json(utils.generateErrors("Client not found with id ".concat(clientId, " attached to VPN Server id ").concat(vpnServerId), 'not_found', _server.COLS.vpn_server_clients)).end();
    return null;
  }
  return clients[0];
};

/**
 * getClientsForVpnServer()
 *
 * Retrieves the clients that are attached to this VPN Server.
 *
 * @param {*} vpnServerId
 */
var getClientsForVpnServer = function getClientsForVpnServer(vpnServerId) {
  return (
    // Get all the clients that are for this VPN Servers
    _server.db.getCollection(_server.COLS.vpn_server_clients).chain().find({
      _vpn_server_id: vpnServerId
    }).data({
      removeMeta: true
    })
  );
};

/**
 * addClient()
 *
 * Creates a new Client with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the
 * new item is added to the collection.
 *
 * @param {*} clients - reference to the client collection
 * @param {*} data - override data to use for client creation.
 * @param {string} - vpnServerId
 * @return - ID of the new resource
 */
exports.getClientsForVpnServer = getClientsForVpnServer;
var addClient = function addClient(clients, data, vpnServerId) {
  // All of our REST API fields should be included here in correct field order.
  var random_client_ip_address = "192.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 254));
  var randomStatus = _casual["default"].random_element(CLIENT_STATUSES);
  var baseData = {
    _vpn_server_id: vpnServerId,
    id: _casual["default"].uuid,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    username: "vpn-server-client-user-name-".concat(_casual["default"].integer(1, 65535)),
    common_name: "www.mock-certificate".concat(_casual["default"].integer(1, 65535), ".com"),
    client_ip: {
      address: random_client_ip_address
    },
    data_received: _casual["default"].integer(1, 65535),
    data_sent: _casual["default"].integer(1, 65535),
    disconnected_at: randomStatus === CLIENT_STATUS.DISCONNECTED ? utils.generateNowDate() : '',
    created_at: utils.generateNowDate(),
    remote_ip: {
      address: '9.111.1.1'
    },
    remote_port: _casual["default"].integer(1, 65535),
    resource_type: 'vpn_server_client',
    status: randomStatus
  };
  var newClient = _objectSpread(_objectSpread({}, baseData), data);
  clients.insert(newClient);
  return newClient.id;
};

/**
 * init()
 *
 * Initialize the VPN Server collection.
 */
exports.addClient = addClient;
var init = function init() {
  // Create the client collection
  _server.db.addCollection(_server.COLS.vpn_server_clients);

  // Client only exist as part of a VPN Server so their creation will
  // be part of the VPN Server creation.
};

/**
 * formatVpnServerClientForClient()
 *
 * Make changes to make VPN Server Client from db collection suitable for
 * client display.
 *
 * @param {*} req
 * @param {*} client
 */
exports.init = init;
var formatVpnServerClientForClient = function formatVpnServerClientForClient(req, vpnServerClient) {
  var clientAuth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  // VPN Server Client href
  var vpnServerClientForClient = _objectSpread({}, vpnServerClient);
  vpnServerClientForClient.href = "".concat(utils.getBaseApiUrl(req), "vpn_servers/").concat(vpnServerClient._vpn_server_id, "/clients/").concat(vpnServerClient.id);
  vpnServerClientForClient.crn = utils.updateResourceCrnRegion(vpnServerClientForClient, req);
  var isClientAuthUserName = clientAuth.filter(function (auth) {
    return auth.method === VPN_SERVER_AUTHENTICATION_METHOD.USERNAME;
  }).length !== 0;
  var isClientAuthCertificate = clientAuth.filter(function (auth) {
    return auth.method === VPN_SERVER_AUTHENTICATION_METHOD.CERTIFICATE;
  }).length !== 0;

  // Remove user name if it's not using the method 'User ID and password'
  if (!isClientAuthUserName) delete vpnServerClientForClient.username;
  // Remove common name if it's not using the method 'Certificate'
  if (!isClientAuthCertificate) delete vpnServerClientForClient.common_name;
  // Remove stuff not intended for client
  delete vpnServerClientForClient._vpn_server_id;
  return vpnServerClientForClient;
};

/**
 * getClients()
 *
 * Get a list of all the Clients.
 *
 * @param {*} req
 * @param {*} res
 */
exports.formatVpnServerClientForClient = formatVpnServerClientForClient;
var getClients = function getClients(req, res) {
  // const clients = utils.getResources(req, COLS.vpn_server_clients);

  // First lets check to make sure the vpn server exists.
  var vpn_server_id = req.params.vpn_server_id;
  var vpnServer = _server.db.getCollection(_server.COLS.vpn_servers).findOne({
    id: vpn_server_id
  });
  if (!vpnServer) {
    res.status(404).end();
    return;
  }
  var limit = Number.parseInt(utils.getQueryParam(req.query, 'limit', 10), 10);
  var offset = Number.parseInt(utils.getQueryParam(req.query, 'start', 0), 10);
  var next = offset + limit;

  // Now lets find our clients
  var vpnServerClients = _server.db.getCollection(_server.COLS.vpn_server_clients).chain().find({
    _vpn_server_id: req.params.vpn_server_id
  }).data({
    removeMeta: true
  });

  // Format the clients for output.
  var vpnServerClientsForClient = vpnServerClients.map(function (vpnServerClient) {
    return formatVpnServerClientForClient(req, vpnServerClient, vpnServer.client_authentication);
  });
  var paginationVpnServerClientsForClient = {
    clients: vpnServerClientsForClient.slice(offset, limit + offset),
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };
  if (next > vpnServerClientsForClient.length) {
    delete paginationVpnServerClientsForClient.next;
  }
  res.json(paginationVpnServerClientsForClient).end();
};

/**
 * getClient()
 *
 * Get a specific VPN Server Client.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getClients = getClients;
var getClient = function getClient(req, res) {
  // First lets check to make sure the vpn server exists.
  var vpn_server_id = req.params.vpn_server_id;
  var vpnServer = _server.db.getCollection(_server.COLS.vpn_servers).findOne({
    id: vpn_server_id
  });
  if (!vpnServer) {
    res.status(404).end();
    return;
  }

  // Get and Verify Client
  var vpnServerClient = getAndVerifyClient(req, res, true);
  if (!vpnServerClient) return;
  var vpnServerClientForClient = formatVpnServerClientForClient(req, vpnServerClient, vpnServer.client_authentication);
  res.json(vpnServerClientForClient).end();
};

/**
 * deleteClient()
 *
 * Delete/ Terminate a specific VPN Server Client.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getClient = getClient;
var deleteClient = function deleteClient(req, res) {
  // Get and Verify client
  var client = getAndVerifyClient(req, res, false);
  if (!client) return;

  // Delete the clie t
  _server.db.getCollection(_server.COLS.vpn_server_clients).remove(client);
  res.status(202).end();
};

/**
 * disconnectClient()
 *
 * Disconnect / Terminate a specific VPN Server Client.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteClient = deleteClient;
var disconnectClient = function disconnectClient(req, res) {
  // Get and Verify client
  var client = getAndVerifyClient(req, res, false);
  if (!client) return;
  client.disconnected_at = utils.generateNowDate();
  client.status = CLIENT_STATUS.DISCONNECTED;

  // update the cleint
  _server.db.getCollection(_server.COLS.vpn_server_clients).update(client);
  res.status(202).end();
};
exports.disconnectClient = disconnectClient;