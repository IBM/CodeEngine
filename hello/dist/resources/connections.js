"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateConnection = exports.init = exports.getPeerCidrs = exports.getPeerCidr = exports.getLocalCidrs = exports.getLocalCidr = exports.getConnectionsForVpnGateway = exports.getConnections = exports.getConnection = exports.formatConnectionForClient = exports.deletePeerCidr = exports.deleteLocalCidr = exports.deleteConnection = exports.createConnection = exports.addPeerCidr = exports.addLocalCidr = exports.addConnection = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var VPN_CONN_STATUS = {
  UP: 'up',
  DOWN: 'down'
};
var VPN_CONN_STATUS_REASONS = {
  // eslint-disable-next-line max-len
  cannot_authenticate_connection: 'Failed to authenticate a connection because the IKE ID and pre-shared key are mismatched. Verify the IKE ID and pre-shared key in the peer VPN configuration.',
  internal_error: 'Internal error. Contact IBM Support.',
  ike_policy_mismatch: 'Proposed IKE crypto suites were not acceptable. Check the IKE policies on both sides of the VPN.',
  // eslint-disable-next-line max-len
  ike_v1_id_local_remote_cidr_mismatch: 'Invalid IKE ID, or the local and remote CIDRs in IKE V1 are mismatched. Check the IKE ID, or verify the local and remote CIDRs in the IKE V1 configuration.',
  // eslint-disable-next-line max-len
  ike_v2_local_remote_cidr_mismatch: 'Local CIDRs and remote CIDRs in IKE V2 are mismatched. Check the local and remote CIDRs in the IKE V2 configuration.',
  // eslint-disable-next-line max-len
  ipsec_policy_mismatch: 'Proposed IPsec crypto suites were not acceptable. Check the IPsec policies on both sides of the VPN.',
  peer_not_responding: 'There is no response from the peer. Check the network ACL and on-premises firewall configurations.'
};
var VPN_CONN_TUNNELS_STATUS = {
  UP: 'up',
  DOWN: 'down'
};
var VPN_CONN_TUNNELS_STATUS_REASONS = {
  // eslint-disable-next-line max-len
  cannot_authenticate_connection: 'Failed to authenticate a connection because the IKE ID and pre-shared key are mismatched. Verify the IKE ID and pre-shared key in the peer VPN configuration.',
  internal_error: 'Internal error. Contact IBM Support.',
  ike_policy_mismatch: 'Proposed IKE crypto suites were not acceptable. Check the IKE policies on both sides of the VPN.',
  // eslint-disable-next-line max-len
  ike_v1_id_local_remote_cidr_mismatch: 'Invalid IKE ID, or the local and remote CIDRs in IKE V1 are mismatched. Check the IKE ID, or verify the local and remote CIDRs in the IKE V1 configuration.',
  // eslint-disable-next-line max-len
  ike_v2_local_remote_cidr_mismatch: 'Local CIDRs and remote CIDRs in IKE V2 are mismatched. Check the local and remote CIDRs in the IKE V2 configuration.',
  // eslint-disable-next-line max-len
  ipsec_policy_mismatch: 'Proposed IPsec crypto suites were not acceptable. Check the IPsec policies on both sides of the VPN.',
  peer_not_responding: 'There is no response from the peer. Check the network ACL and on-premises firewall configurations.'
};
var VPN_CONN_ADMIN_UP_STATUS = {
  UP: true,
  DOWN: false
};

// Random Status values favoring DOWN
var VPN_CONN_STATUSES = [VPN_CONN_STATUS.UP, VPN_CONN_STATUS.DOWN, VPN_CONN_STATUS.DOWN];

// Random status values - favoring ACTIVE
var VPN_CONN_UP_STATUSES = [VPN_CONN_ADMIN_UP_STATUS.UP, VPN_CONN_ADMIN_UP_STATUS.UP, VPN_CONN_ADMIN_UP_STATUS.UP, VPN_CONN_ADMIN_UP_STATUS.DOWN];

// Random routing protocol
var ROUTING_PROTOCOL = ['none', 'bgp'];

// Random dynamic routing protocol state
var DYNAMIC_ROUTE_PROTOCOL_STATE = ['idle', 'connect', 'active', 'open_sent', 'open_confirm', 'established'];

/**
 * getAndVerifyConnection()
 *
 * This a common utility for verifying and obtaining a VPN Connection. This
 * pattern is frequently used in the connections.js resource file.
 *
 * Connections are part of a gateway. This function first obtains the gateway
 * and makes sure that it exists. If it does not exist then 404 status is returned.
 * If it does exist then we attempt to obtain the VPN Connection. Depending on the
 * passed parameter we either strip the meta infomation or not.
 *
 * @param {*} req - the original request
 * @param {*} res - the original response
 * @param {*} removeMeta - boolean indicating whether to strip meta from the connection.
 */
var getAndVerifyConnection = function getAndVerifyConnection(req, res) {
  var removeMeta = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // Get our ids
  var vpnGatewayId = req.params.vpn_gateway_id;
  var connectionId = req.params.connection_id;

  // Check for Gateway existence
  var gateway = utils.findResource(_server.COLS.vpn_gateways, vpnGatewayId, res, false);
  if (!gateway) return null;

  // Now lets find our connection
  var connections = _server.db.getCollection(_server.COLS.connections).chain().find({
    id: connectionId,
    _vpn_gateway_id: vpnGatewayId
  }).data({
    removeMeta: removeMeta
  });

  // Check that the connection exists
  if (!connections || connections.length === 0) {
    res.status(404).json(utils.generateErrors("Connection not found with id ".concat(connectionId, " attached to VPN Gateway id ").concat(vpnGatewayId), 'not_found', _server.COLS.connections)).end();
    return null;
  }
  return connections[0];
};

/**
 * getConnectionsForVpnGateway()
 *
 * Retrieves the connections that are attached to this gateway.
 *
 * @param {*} vpnGatewayId
 */
var getConnectionsForVpnGateway = function getConnectionsForVpnGateway(vpnGatewayId) {
  return (
    // Get all the connections that are for this gateway
    _server.db.getCollection(_server.COLS.connections).chain().find({
      _vpn_gateway_id: vpnGatewayId
    }).data({
      removeMeta: true
    })
  );
};

/**
 * addConnection()
 *
 * Creates a new Connection with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the
 * new item is added to the collection.
 *
 * @param {*} connections - reference to the connections collection
 * @param {*} data - override data to use for connection creation.
 * @param {string} - vpnGatewayId
 * @param {boolean} - addMockPolicies
 * @return - ID of the new resource
 */
exports.getConnectionsForVpnGateway = getConnectionsForVpnGateway;
var addConnection = function addConnection(connections, data, vpnGatewayId, addMockPolicies, zone) {
  // All of our REST API fields should be included here in correct field order.
  var vpnGW = utils.getResource(_server.COLS.vpn_gateways, vpnGatewayId)[0];
  var local_cidrs = ['10.0.0.0/24', '10.0.1.0/24'];
  var peer_cidrs = ['20.0.0.0/24', '20.0.1.0/24'];
  // Use route_mode per current prod spec
  var route_mode = vpnGW.mode;
  if (route_mode === 'route') {
    local_cidrs = ['0.0.0.0/0'];
    peer_cidrs = ['0.0.0.0/0'];
  }
  var routing_protocol;
  if (route_mode === 'route') {
    routing_protocol = data.routing_protocol || _casual["default"].random_element(ROUTING_PROTOCOL);
  }
  var baseData = {
    _vpn_gateway_id: vpnGatewayId,
    id: _casual["default"].uuid,
    name: utils.generateName('vpn-connection', zone),
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    local_cidrs: local_cidrs,
    peer_cidrs: peer_cidrs,
    peer_address: '169.61.45.44',
    admin_state_up: _casual["default"].random_element(VPN_CONN_UP_STATUSES),
    psk: 'secret',
    dead_peer_detection: {
      action: 'restart',
      interval: 30,
      timeout: 150
    },
    created_at: utils.generateCreateDate(),
    route_mode: route_mode,
    routing_protocol: routing_protocol,
    authentication: 'psk',
    status: _casual["default"].random_element(VPN_CONN_STATUSES),
    ike_policy: {
      id: ''
    },
    ipsec_policy: {
      id: ''
    },
    status_reasons: [] // placeholder
  };

  if (route_mode === 'route') {
    var randomTunnelStatusReasonCode = _casual["default"].random_element(Object.keys(VPN_CONN_TUNNELS_STATUS_REASONS));
    if (baseData.routing_protocol === 'bgp') {
      baseData.peer_asn = '234567';
      baseData.tunnels = [{
        protocol_state: _casual["default"].random_element(DYNAMIC_ROUTE_PROTOCOL_STATE),
        neighbor_ip: {
          address: '9.1.1.1'
        },
        tunnel_interface_ip: {
          address: '10.1.1.1'
        },
        public_ip: vpnGW.members[0].public_ip,
        status: VPN_CONN_TUNNELS_STATUS.UP,
        status_reasons: []
      }, {
        protocol_state: _casual["default"].random_element(DYNAMIC_ROUTE_PROTOCOL_STATE),
        neighbor_ip: {
          address: '9.1.1.2'
        },
        tunnel_interface_ip: {
          address: '10.1.1.2'
        },
        public_ip: vpnGW.members[0].public_ip,
        status: VPN_CONN_TUNNELS_STATUS.DOWN,
        status_reasons: [{
          code: randomTunnelStatusReasonCode,
          message: VPN_CONN_TUNNELS_STATUS_REASONS[randomTunnelStatusReasonCode] || 'Unknown error.',
          more_info: "/docs/vpn_conn_tunnels/status_reasons/".concat(randomTunnelStatusReasonCode)
        }]
      }];
    } else if (baseData.routing_protocol === 'none') {
      baseData.tunnels = [{
        name: utils.generateName('vpn-connection-tunnel'),
        public_ip: vpnGW.members[0].public_ip,
        status: VPN_CONN_TUNNELS_STATUS.UP,
        status_reasons: []
      }, {
        name: utils.generateName('vpn-connection-tunnel'),
        public_ip: vpnGW.members[1].public_ip,
        status: VPN_CONN_TUNNELS_STATUS.DOWN,
        status_reasons: [{
          code: randomTunnelStatusReasonCode,
          message: VPN_CONN_TUNNELS_STATUS_REASONS[randomTunnelStatusReasonCode] || 'Unknown error.',
          more_info: "/docs/vpn_conn_tunnels/status_reasons/".concat(randomTunnelStatusReasonCode)
        }]
      }];
    }
  }
  var newConnection = _objectSpread(_objectSpread({}, baseData), data);

  // Set status reasons for negative status
  if (newConnection.status === VPN_CONN_STATUS.DOWN) {
    var code = _casual["default"].random_element(Object.keys(VPN_CONN_STATUS_REASONS));
    newConnection.status_reasons = [{
      code: code,
      message: VPN_CONN_STATUS_REASONS[code] || 'Unknown error.',
      more_info: "/docs/vpn_conn/status_reasons/".concat(code)
    }];
  }

  // Add mock policies if requested
  if (addMockPolicies) {
    // Add a random ipsec_policy
    var ipsec_policy = utils.getRandomResourceInRegion(_server.COLS.ipsec_policies, zone.region_name);
    newConnection.ipsec_policy.id = ipsec_policy && ipsec_policy.id;

    // Add a random ike_policy
    var ike_policy = utils.getRandomResourceInRegion(_server.COLS.ike_policies, zone.region_name);
    newConnection.ike_policy.id = ike_policy && ike_policy.id;
  }
  connections.insert(newConnection);
  return newConnection.id;
};

/**
 * init()
 *
 * Initialize the VPN Gateway collection.
 */
exports.addConnection = addConnection;
var init = function init() {
  // Create the connections collection
  _server.db.addCollection(_server.COLS.connections);

  // Connections only exist as part of a VPN Gateway so their creation will
  // be part of the VPN Gateway creation.

  // Do a fake init for debug/test.
  // utils.repeat(() => {
  //   addConnection(connections, { id: 'vpn-connection-1' }, 'vpn-gateway-1');
  // }, 10);
};

/**
 * formatConnectionForClient()
 *
 * Make changes to make Connection from db collection suitable for
 * client display.
 *
 * @param {*} req
 * @param {*} subnet
 */
exports.init = init;
var formatConnectionForClient = function formatConnectionForClient(req, connection) {
  // VPN Connection href
  var connectionForClient = _objectSpread({}, connection);
  connectionForClient.href = "".concat(utils.getBaseApiUrl(req), "vpn_gateways/").concat(connection._vpn_gateway_id, "/connections/").concat(connection.id);

  // IPSEC Policy
  var ipsecPolicyId = _lodash["default"].get(connection, 'ipsec_policy.id', '');
  if (ipsecPolicyId) {
    var ipsec_policy = utils.getAndFormatResourceLinkForClient(req, _server.COLS.ipsec_policies, ipsecPolicyId);
    connectionForClient.ipsec_policy = ipsec_policy;
  } else {
    delete connectionForClient.ipsec_policy;
  }

  // IKE Policy
  var ikePolicyId = _lodash["default"].get(connection, 'ike_policy.id', '');
  if (ikePolicyId) {
    var ike_policy = utils.getAndFormatResourceLinkForClient(req, _server.COLS.ike_policies, ikePolicyId);
    connectionForClient.ike_policy = ike_policy;
  } else {
    delete connectionForClient.ike_policy;
  }

  // Remove stuff not intended for client
  delete connectionForClient._vpn_gateway_id;
  return connectionForClient;
};

/**
 * getConnections()
 *
 * Get a list of all the Subnets.
 *
 * @param {*} req
 * @param {*} res
 */
exports.formatConnectionForClient = formatConnectionForClient;
var getConnections = function getConnections(req, res) {
  // const connections = utils.getResources(req, COLS.connections);

  // First lets check to make sure the gateway exists.
  var vpn_gateway_id = req.params.vpn_gateway_id;
  var gateway = _server.db.getCollection(_server.COLS.vpn_gateways).findOne({
    id: vpn_gateway_id
  });
  if (!gateway) {
    res.status(404).end();
    return;
  }

  // Now lets find our connections
  var connections = _server.db.getCollection(_server.COLS.connections).chain().find({
    _vpn_gateway_id: req.params.vpn_gateway_id
  }).data({
    removeMeta: true
  });

  // Format the connections for output.
  // Consider the API compatibility, we are using future version for dynamic route for developing
  // 1. return all connections if the version is newer than 2021-03-24 (for static route),
  // 2. otherwise, only returns the connection which is NOT 'bgp' route type
  var version = req.query.version;
  var connectionsFiltered = connections.filter(function (conn) {
    return version > '2021-03-24' || conn.routing_protocol !== 'bgp';
  });
  var connectionsForClient = connectionsFiltered.map(function (conn) {
    return formatConnectionForClient(req, conn);
  });

  // RIAS returns empty array here if no connections are present.
  res.json({
    connections: connectionsForClient
  }).end();
};

/**
 * getConnection()
 *
 * Get a specific VPN Connection.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getConnections = getConnections;
var getConnection = function getConnection(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res, true);
  if (!connection) return;
  var connectionForClient = formatConnectionForClient(req, connection);
  res.json(connectionForClient).end();
};

/**
 * deleteConnection()
 *
 * Delete a specific VPN Connection.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getConnection = getConnection;
var deleteConnection = function deleteConnection(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res, false);
  if (!connection) return;

  // Delete the connection
  _server.db.getCollection(_server.COLS.connections).remove(connection);
  res.status(204).end();
};

/**
 * createConnection()
 *
 * Create a new Connection.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteConnection = deleteConnection;
var createConnection = function createConnection(req, res) {
  var input = req.body;
  var _vpn_gateway_id = req.params.vpn_gateway_id;

  // Verify the gateway
  var gateway = utils.findResource(_server.COLS.vpn_gateways, _vpn_gateway_id, res, false);
  if (!gateway) return;

  // Check for duplicates
  var connectionsCol = _server.db.getCollection(_server.COLS.connections);
  var duplicate = utils.duplicateNameCheck(connectionsCol, input, req, res, 'resource with that name already exists', 'vpn_connection');
  if (duplicate) {
    return;
  }

  // Get the connection again.
  var id = addConnection(connectionsCol, input, _vpn_gateway_id, false, gateway.zone);
  req.params.connection_id = id;
  var connection = getAndVerifyConnection(req, res, true);
  var connectionForClient = formatConnectionForClient(req, connection);
  res.status(201).json(connectionForClient).end();
};

/**
 * updateConnection()
 *
 * Update the data in an existing VPN Connection.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createConnection = createConnection;
var updateConnection = function updateConnection(req, res) {
  var connectionsCol = _server.db.getCollection(_server.COLS.connections);

  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res, false);
  if (!connection) return;

  // Now update our entry
  var updatedConnection = _objectSpread(_objectSpread({}, connection), req.body);
  connectionsCol.update(updatedConnection);

  // Now retrieve our entry again
  req.params.connection_id = updatedConnection.id;
  req.params.vpn_gateway_id = updatedConnection._vpn_gateway_id;
  var resultConnection = getAndVerifyConnection(req, res, true);
  var connectionForClient = formatConnectionForClient(req, resultConnection);
  // Now provide the result
  res.status(200).json(connectionForClient).end();
};

/**
 * getLocalCidrs()
 *
 * Get the local_cidrs for a VPN Connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.updateConnection = updateConnection;
var getLocalCidrs = function getLocalCidrs(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now get the local_cidrs.
  var result = {
    local_cidrs: connection.local_cidrs
  };

  // RIAS returns empty array here if no connections are present.
  res.status(200).json(result).end();
};

/**
 * getPeerCidrs()
 *
 * Get the peer_cidrs for a VPN Connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.getLocalCidrs = getLocalCidrs;
var getPeerCidrs = function getPeerCidrs(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now get the local_cidrs.
  var result = {
    peer_cidrs: connection.peer_cidrs
  };

  // RIAS returns empty array here if no connections are present.
  res.status(200).json(result).end();
};

/**
 * getLocalCidr()
 *
 * Check if local_cidr exists
 *
 * @param {*} req
 * @param {*} res
 */
exports.getPeerCidrs = getPeerCidrs;
var getLocalCidr = function getLocalCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the local_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.local_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }
  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};

/**
 * getPeerCidr()
 *
 * Check if a specific peer_cidr exists.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getLocalCidr = getLocalCidr;
var getPeerCidr = function getPeerCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the peer_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.peer_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }
  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};

/**
 * deleteLocalCidr()
 *
 * Delete local_cidr from connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.getPeerCidr = getPeerCidr;
var deleteLocalCidr = function deleteLocalCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the local_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.local_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }

  // Update our connection
  connection.local_cidrs = connection.local_cidrs.filter(function (cidr) {
    return cidr !== cidrStr;
  });
  _server.db.getCollection(_server.COLS.connections).update(connection);

  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};

/**
 * deletePeerCidr()
 *
 * Delete peer_cidr from connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteLocalCidr = deleteLocalCidr;
var deletePeerCidr = function deletePeerCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the peer_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.peer_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }

  // Update our connection
  connection.peer_cidrs = connection.peer_cidrs.filter(function (cidr) {
    return cidr !== cidrStr;
  });
  _server.db.getCollection(_server.COLS.connections).update(connection);

  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};

/**
 * addLocalCidr()
 *
 * Add local_cidr to connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.deletePeerCidr = deletePeerCidr;
var addLocalCidr = function addLocalCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the local_cidr.
  // In RIAS, if the CIDR is not valid we return 400.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.local_cidrs.includes(cidrStr);

  // If we don't find it - add it
  if (!result) {
    // Update our connection
    connection.local_cidrs.push(cidrStr);
    _server.db.getCollection(_server.COLS.connections).update(connection);
  }

  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};

/**
 * addPeerCidr()
 *
 * Add peer_cidr to connection
 *
 * @param {*} req
 * @param {*} res
 */
exports.addLocalCidr = addLocalCidr;
var addPeerCidr = function addPeerCidr(req, res) {
  // Get and Verify Connection
  var connection = getAndVerifyConnection(req, res);
  if (!connection) return;

  // Now find the local_cidr.
  // In RIAS, if the CIDR is not valid we return 400.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = connection.peer_cidrs.includes(cidrStr);

  // If we don't find it - add it
  if (!result) {
    // Update our connection
    connection.peer_cidrs.push(cidrStr);
    _server.db.getCollection(_server.COLS.connections).update(connection);
  }

  // RIAS returns empty array here if no connections are present.
  res.status(204).end();
};
exports.addPeerCidr = addPeerCidr;