"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateVpnServer = exports.init = exports.getVpnServers = exports.getVpnServerClientConfig = exports.getVpnServer = exports.deleteVpnServer = exports.createVpnServer = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _vpn_server_clients = require("./vpn_server_clients");
var _vpn_server_routes = require("./vpn_server_routes");
var _reserved_private_ips = require("./reserved_private_ips");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var lodash = require('lodash');
var VPN_SERVERS_NUM = 20;
var VPN_SERVER_LIFECYCLE_STATE = {
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending',
  STABLE: 'stable',
  SUSPENDED: 'suspended',
  UPDATING: 'updating',
  WAITING: 'waiting'
};

// Random lifecycle state values
var VPN_SERVER_RANDOM_LIFECYCLE_STATES = [VPN_SERVER_LIFECYCLE_STATE.DELETING, VPN_SERVER_LIFECYCLE_STATE.FAILED, VPN_SERVER_LIFECYCLE_STATE.PENDING, VPN_SERVER_LIFECYCLE_STATE.STABLE, VPN_SERVER_LIFECYCLE_STATE.STABLE, VPN_SERVER_LIFECYCLE_STATE.SUSPENDED, VPN_SERVER_LIFECYCLE_STATE.SUSPENDED, VPN_SERVER_LIFECYCLE_STATE.SUSPENDED, VPN_SERVER_LIFECYCLE_STATE.UPDATING, VPN_SERVER_LIFECYCLE_STATE.WAITING];
var VPN_SERVER_LIFECYCLE_REASONS = {
  resource_suspended_by_provider: 'Resource has been suspended. Contact IBM Support.'
};
var VPN_SERVER_HEALTH_STATE = {
  OK: 'ok',
  DEGRADED: 'degraded',
  FAULTED: 'faulted',
  INAPPLICABLE: 'inapplicable'
};

// Random health state values
var VPN_SERVER_RANDOM_HEALTH_STATES = [VPN_SERVER_HEALTH_STATE.OK, VPN_SERVER_HEALTH_STATE.DEGRADED, VPN_SERVER_HEALTH_STATE.FAULTED, VPN_SERVER_HEALTH_STATE.FAULTED, VPN_SERVER_HEALTH_STATE.FAULTED, VPN_SERVER_HEALTH_STATE.INAPPLICABLE];
var VPN_SERVER_HEALTH_REASONS = {
  // eslint-disable-next-line max-len
  cannot_access_client_certificate: "VPN server's client certificate is inaccessible. Verify that the certificate exists and that IAM policies grant the VPN server access to Secrets Manager.",
  // eslint-disable-next-line max-len
  cannot_access_server_certificate: "VPN server's server certificate is inaccessible. Verify that the certificate exists and that IAM policies grant the VPN server access to Secrets Manager.",
  cannot_create_vpc_route: 'VPN server cannot create the route. Check for any conflicts.',
  // eslint-disable-next-line max-len
  cannot_reserve_ip_address: "There are no IP addresses available in the subnet to allocate. Release addresses on the VPN server's subnet by deleting associated resources, such as servers, load balancers, or endpoint gateways.",
  internal_error: 'Internal error. Contact IBM Support.'
};
var VPN_SERVER_AUTHENTICATION_METHOD = {
  USERNAME: 'username',
  CERTIFICATE: 'certificate'
};
var VPN_SERVER_PROTOCOL = {
  TCP: 'tcp',
  UDP: 'udp'
};

// // Random Connection counts favoring smaller numbers
var VPN_SERVER_RANDOM_CLIENT_COUNT = [1, 2, 3, 5, 8, 13, 21];
var VPN_SERVER_RANDOM_ROUTE_COUNT = [1, 2, 3, 5, 8, 13, 21];

/**
 * addVpnServer()
 *
 * Creates a new VpnServer with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the
 * new item is added to the collection.
 *
 * @param {*} vpnServers - reference to the vpnServers collection
 * @param {*} data - override data to use for vpn server creation.
 * @return - ID of the new VPN Server
 */
var addVpnServer = function addVpnServer(vpnServers, data) {
  var _data$security_groups, _randomSecurityGroup;
  var addMockClients = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var addMockRoutes = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  // All of our REST API fields should be included here in correct field order.
  var random_client_ip_pool = "172.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".0/16");
  var address1 = "170.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 254));
  var address2 = "170.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 254));
  var authenticationMethod = _casual["default"].random_element(Object.values(VPN_SERVER_AUTHENTICATION_METHOD));
  var randomResourceGroup = utils.getRandomResource(_server.COLS.resourceGroups);
  var vpnServerSubnet;
  var randomSecurityGroup;
  if ((_data$security_groups = data.security_groups) !== null && _data$security_groups !== void 0 && _data$security_groups.length && data.security_groups[0].id) {
    var _db$getCollection$cha;
    var securityGroup = utils.getResource(_server.COLS.security_groups, data.security_groups[0].id)[0];
    vpnServerSubnet = (_db$getCollection$cha = _server.db.getCollection(_server.COLS.subnets).chain().where(function (subnet) {
      var _securityGroup$vpc;
      return subnet.vpc.id === (securityGroup === null || securityGroup === void 0 ? void 0 : (_securityGroup$vpc = securityGroup.vpc) === null || _securityGroup$vpc === void 0 ? void 0 : _securityGroup$vpc.id);
    }).data({
      removeMeta: true
    })) === null || _db$getCollection$cha === void 0 ? void 0 : _db$getCollection$cha[0];
  } else {
    vpnServerSubnet = utils.getRandomResource(_server.COLS.subnets);
    if (data.zone && !data.subnet) {
      vpnServerSubnet = utils.getRandomResourceInZone(_server.COLS.subnets, data.zone.region_name);
    }
    var sgsInVPC = _server.db.getCollection(_server.COLS.security_groups).chain().where(function (sg) {
      var _vpnServerSubnet$vpc;
      return sg.vpc.id === ((_vpnServerSubnet$vpc = vpnServerSubnet.vpc) === null || _vpnServerSubnet$vpc === void 0 ? void 0 : _vpnServerSubnet$vpc.id);
    }).data({
      removeMeta: true
    });
    if (sgsInVPC.length === 0) {
      throw new Error('The VPC has no security group');
    }
    randomSecurityGroup = utils.getRandomResourceFromArray(sgsInVPC);
  }
  var baseData = {
    id: _casual["default"].uuid,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    created_at: utils.generateCreateDate(),
    clients: [],
    // placeholder
    routes: [],
    // placeholder
    certificate: {
      // eslint-disable-next-line max-len
      crn: 'crn:v1:staging:public:secrets-manager:us-south:a/a5ebf2570dcaedf18d7ed78e216c263a:f1bc94a6-64aa-4c55-b00f-f6cd70e4b2ce:secret:24ec2c34-38ee-4038-9f1d-9a629423158d'
    },
    client_authentication: [],
    // placeholder
    client_auto_delete: _casual["default"].random_element([true, false]),
    client_auto_delete_timeout: _casual["default"].integer(1, 24),
    // 24 hours
    client_dns_server_ips: [{
      address: address1
    }, {
      address: address2
    }],
    client_idle_timeout: _casual["default"].integer(0, 28800),
    // seconds
    client_ip_pool: random_client_ip_pool,
    enable_split_tunneling: _casual["default"].random_element([true, false]),
    health_state: _casual["default"].random_element(VPN_SERVER_RANDOM_HEALTH_STATES),
    health_reasons: [],
    // placeholder
    lifecycle_state: _casual["default"].random_element(VPN_SERVER_RANDOM_LIFECYCLE_STATES),
    lifecycle_reasons: [],
    // placeholder
    hostname: "my-vpn-server-".concat(_casual["default"].integer(1, 65535), ".client-vpn.cloud.ibm.com"),
    name: "vpn-server-".concat(_casual["default"].integer(1, 65535)),
    port: 1194,
    protocol: _casual["default"].random_element(Object.values(VPN_SERVER_PROTOCOL)),
    resource_group: {
      id: randomResourceGroup.id,
      name: randomResourceGroup.name,
      crn: randomResourceGroup.crn,
      href: randomResourceGroup.href
    },
    resource_type: 'vpn_server',
    security_groups: [{
      id: (_randomSecurityGroup = randomSecurityGroup) === null || _randomSecurityGroup === void 0 ? void 0 : _randomSecurityGroup.id
    }],
    subnets: [{
      id: vpnServerSubnet.id
    }]
  };
  if (!data.client_authentication || data.client_authentication.length === 0) {
    if (authenticationMethod === VPN_SERVER_AUTHENTICATION_METHOD.USERNAME) {
      baseData.client_authentication = [{
        method: VPN_SERVER_AUTHENTICATION_METHOD.USERNAME,
        identity_provider: {
          provider_type: 'iam'
        }
      }];
    } else {
      baseData.client_authentication = [{
        crl: 'The certificate revocation list (CRL) contents in PEM format.',
        // eslint-disable-next-line max-len
        client_ca: {
          crn: 'crn:v1:staging:public:secrets-manager:us-south:a/a5ebf2570dcaedf18d7ed78e216c263a:f1bc94a6-64aa-4c55-b00f-f6cd70e4b2ce:secret:111c2c34-38ee-4038-9f1d-9a6294231111'
        },
        method: VPN_SERVER_AUTHENTICATION_METHOD.CERTIFICATE
      }];
    }
  }

  // Merge the user data
  var newVpnServer = _objectSpread(_objectSpread({}, baseData), data);

  // Set health status reasons for negative status
  var healthReasonCode = '';
  if (newVpnServer.health_state !== VPN_SERVER_HEALTH_STATE.OK) {
    healthReasonCode = _casual["default"].random_element(Object.keys(VPN_SERVER_HEALTH_REASONS));
  }
  if (healthReasonCode) {
    newVpnServer.health_reasons = [{
      code: healthReasonCode,
      message: VPN_SERVER_HEALTH_REASONS[healthReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_server/health_reasons/".concat(healthReasonCode)
    }];
  }

  // Set lifecycle status reasons for suspended status
  var lifecycleReasonCode = '';
  if (newVpnServer.lifecycle_state === VPN_SERVER_LIFECYCLE_STATE.SUSPENDED) {
    lifecycleReasonCode = 'resource_suspended_by_provider';
  }
  if (lifecycleReasonCode) {
    newVpnServer.lifecycle_reasons = [{
      code: lifecycleReasonCode,
      message: VPN_SERVER_LIFECYCLE_REASONS[lifecycleReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_server/lifecycle_reasons/".concat(lifecycleReasonCode)
    }];
  }

  // update security groups targets field.
  (newVpnServer.security_groups || []).forEach(function (sg) {
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id);
    if (securityGroup.targets_c2svpn) {
      if (!securityGroup.targets_c2svpn.find(function (item) {
        return item.id === newVpnServer.id;
      })) {
        securityGroup.targets_c2svpn.push({
          id: newVpnServer.id
        });
      }
    } else {
      securityGroup.targets_c2svpn = [{
        id: newVpnServer.id
      }];
    }
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });

  // Add zone if not existing
  if (!newVpnServer.zone) {
    var _newVpnServer$subnets;
    var subnet = utils.findResource(_server.COLS.subnets, (_newVpnServer$subnets = newVpnServer.subnets[0]) === null || _newVpnServer$subnets === void 0 ? void 0 : _newVpnServer$subnets.id);
    newVpnServer.zone = utils.findZone(subnet.zone.name);
  }
  newVpnServer.private_ips = newVpnServer.subnets.map(function (subnet) {
    var subnetInDB = utils.findResource(_server.COLS.subnets, subnet.id);
    return (0, _reserved_private_ips.generateReservedIpInSubnet)(subnetInDB)[0];
  });
  newVpnServer.private_ips.forEach(function (private_ip) {
    (0, _reserved_private_ips.setReservedIPTarget)(private_ip.id, {
      id: newVpnServer.id,
      name: newVpnServer.name
    }, 'vpn_server');
  });

  // Push the vpn server to the DB
  vpnServers.insert(newVpnServer);

  // Add more mock clients if they are desired.
  if (addMockClients) {
    var count = _casual["default"].random_element(VPN_SERVER_RANDOM_CLIENT_COUNT);

    // Add default client for default vpn server
    if (data.id === 'vpn-server-1') {
      (0, _vpn_server_clients.addClient)(_server.db.addCollection(_server.COLS.vpn_server_clients), {
        username: 'aaa-default-vpn-server-client-1',
        common_name: 'www.my-default-certificate.com',
        id: 'vpn-server-client-1',
        status: 'connected'
      }, 'vpn-server-1');
      count -= 1;
    }
    utils.repeat(function () {
      (0, _vpn_server_clients.addClient)(_server.db.addCollection(_server.COLS.vpn_server_clients), {}, newVpnServer.id);
    }, count);
  }

  // Add more mock routes if they are desired.
  if (addMockRoutes) {
    var _count = _casual["default"].random_element(VPN_SERVER_RANDOM_ROUTE_COUNT);

    // Add default route for default vpn server
    if (data.id === 'vpn-server-1') {
      (0, _vpn_server_routes.addRoute)(_server.db.addCollection(_server.COLS.vpn_server_rouets), {
        name: 'aaa-default-vpn-server-route-1',
        id: 'vpn-server-route-1'
      }, 'vpn-server-1');
      _count -= 1;
    }
    utils.repeat(function () {
      (0, _vpn_server_routes.addRoute)(_server.db.addCollection(_server.COLS.vpn_server_routes), {}, newVpnServer.id);
    }, _count);
  }
  return newVpnServer.id;
};

/**
 * init()
 *
 * Initialize the VPN Server collection.
 */
var init = function init() {
  // Create the vpn servers collection
  var vpnServers = _server.db.addCollection(_server.COLS.vpn_servers);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var initClientAuth = [{
    crl: 'The certificate revocation list (CRL) contents in PEM format.',
    // eslint-disable-next-line max-len
    client_ca: {
      crn: 'crn:v1:staging:public:secrets-manager:us-south:a/a5ebf2570dcaedf18d7ed78e216c263a:f1bc94a6-64aa-4c55-b00f-f6cd70e4b2ce:secret:111c2c34-38ee-4038-9f1d-9a6294231111'
    },
    method: VPN_SERVER_AUTHENTICATION_METHOD.CERTIFICATE
  }, {
    method: VPN_SERVER_AUTHENTICATION_METHOD.USERNAME,
    identity_provider: {
      provider_type: 'iam'
    }
  }];
  // Add a couple vpn servers with known IDs.
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-1',
    id: 'vpn-server-1',
    security_groups: [{
      id: '58fd2383-acb8-11e8-94ce-3e338a9fcdfb'
    }],
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.OK,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.STABLE
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-2',
    id: 'vpn-server-2',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.OK,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.STABLE
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-11',
    id: 'vpn-server-3',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.OK,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.UPDATING
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-12',
    id: 'vpn-server-4',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.OK,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.SUSPENDED
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-13',
    id: 'vpn-server-5',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.DEGRADED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.DELETING
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-14',
    id: 'vpn-server-6',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.INAPPLICABLE,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.PENDING
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-15',
    id: 'vpn-server-7',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.FAULTED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.FAILED
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-16',
    id: 'vpn-server-8',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.FAULTED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.WAITING
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-17',
    id: 'vpn-server-9',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.FAULTED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.UPDATING
  }, true, true);
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-18',
    id: 'vpn-server-10',
    client_authentication: initClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.FAULTED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.SUSPENDED
  }, true, true);
  var expiredClientAuth = [{
    crl: 'The certificate revocation list (CRL) contents in PEM format.',
    // eslint-disable-next-line max-len
    client_ca: {
      crn: 'crn:v1:staging:public:secrets-manager:us-east:a/a5ebf2570dcaedf18d7ed78e216c263a:bbbc94a6-64aa-4c55-b00f-f6cd70e4bbbb:secret:eeec2c34-38ee-4038-9f1d-9a62-expired'
    },
    method: VPN_SERVER_AUTHENTICATION_METHOD.CERTIFICATE
  }];
  addVpnServer(vpnServers, {
    name: 'aaa-default-vpn-server-cert-expired',
    id: 'vpn-server-cert-expired',
    client_authentication: expiredClientAuth,
    zone: utils.findZone(utils.getDefaultZone()),
    health_state: VPN_SERVER_HEALTH_STATE.FAULTED,
    lifecycle_state: VPN_SERVER_LIFECYCLE_STATE.SUSPENDED
  }, true, true);

  // Ensure sure we have vpn servers for every region.
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (_ref) {
    var name = _ref.name;
    addVpnServer(vpnServers, {
      name: "vpnServer_per_region_".concat(name),
      zone: utils.findZoneInRegion(name)
    }, true, true);
  });

  // Create the remaining additional VPN Servers - we subtract the ones from above
  var remainingCount = Math.max(VPN_SERVERS_NUM - 10, 0);
  utils.repeat(function () {
    addVpnServer(vpnServers, {}, true, true);
  }, remainingCount);
};

/**
 * formatVpnServerForClient()
 *
 * Make changes to make VPN Server from db collection suitable for client display.
 *
 * @param {*} req
 * @param {*} VpnServer
 */
exports.init = init;
var formatVpnServerForClient = function formatVpnServerForClient(req, _vpnServer) {
  var vpnServer = lodash.cloneDeep(_vpnServer);
  // VPN Server href
  vpnServer.href = "".concat(utils.getBaseApiUrl(req), "vpn_servers/").concat(vpnServer.id);
  vpnServer.crn = utils.updateResourceCrnRegion(vpnServer, req);

  // Private IP Ref
  vpnServer.private_ips.forEach(function (private_ip) {
    return (0, _reserved_private_ips.formatReservedIPForClient)(req, private_ip);
  });

  // Security Group Ref
  var allSGs = _server.db.getCollection(_server.COLS.security_groups).chain().data();
  var securityGroups = allSGs.filter(function (sg) {
    var _sg$targets_c2svpn;
    return (_sg$targets_c2svpn = sg.targets_c2svpn) === null || _sg$targets_c2svpn === void 0 ? void 0 : _sg$targets_c2svpn.some(function (vpnServer2) {
      return vpnServer2.id === vpnServer.id;
    });
  });
  if (securityGroups && securityGroups.length > 0) {
    vpnServer.security_groups = securityGroups.map(function (securityGroup) {
      return utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, securityGroup.id);
    });
  } else {
    delete vpnServer.security_groups;
  }

  // Subnet Ref
  var subnets = vpnServer.subnets;
  vpnServer.subnets = subnets.map(function (subnet) {
    return utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet.id);
  });

  // VPC Ref
  var firstSubnet = utils.getResource(_server.COLS.subnets, vpnServer.subnets[0].id)[0];
  var vpc_id = lodash.get(firstSubnet, 'vpc.id', '');
  if (vpc_id) {
    vpnServer.vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, vpc_id);
  }
  vpnServer.client_dns_server_ips = vpnServer.client_dns_server_ips.filter(function (item) {
    return item.address;
  });

  // VPN Server Clients
  // Get all the clients that are for this vpn server
  var clients = (0, _vpn_server_clients.getClientsForVpnServer)(vpnServer.id);
  vpnServer.clients = clients.map(function (client) {
    return utils.formatResourceLinkForClient(req, _server.COLS.vpn_server_clients, client);
  });
  vpnServer.clients.forEach(function (client) {
    // We may want to enhance util function to support this.
    client.href = "".concat(vpnServer.href, "/clients/").concat(client.id);
    client.crn = utils.updateResourceCrnRegion(client, req);
  });

  // VPN Server Routes
  // Get all the routes that are for this vpn server
  var routes = (0, _vpn_server_routes.getRoutesForVpnServer)(vpnServer.id);
  vpnServer.routes = routes.map(function (route) {
    return utils.formatResourceLinkForClient(req, _server.COLS.vpn_server_routes, route);
  });
  vpnServer.routes.forEach(function (route) {
    // We may want to enhance util function to support this.
    route.href = "".concat(vpnServer.href, "/routes/").concat(route.id);
    route.crn = utils.updateResourceCrnRegion(route, req);
  });
  return vpnServer;
};

/**
 * getVpnServers()
 *
 * Get a list of all the VPN Servers.
 *
 * @param {*} req
 * @param {*} res
 */
var getVpnServers = function getVpnServers(req, res) {
  var vpnServers = utils.getResources(req, _server.COLS.vpn_servers);
  var displayedVpnServers = lodash.cloneDeep(vpnServers);
  displayedVpnServers.vpn_servers = displayedVpnServers.vpn_servers.map(function (vpnServer) {
    return formatVpnServerForClient(req, vpnServer);
  });
  res.json(displayedVpnServers).end();
};

/**
 * getVpnServer()
 *
 * Get a specific VPN Server.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getVpnServers = getVpnServers;
var getVpnServer = function getVpnServer(req, res) {
  var vpnServer = utils.findResource(_server.COLS.vpn_servers, req.params.vpn_server_id, res, true);
  if (!vpnServer) return;
  res.status(200).json(formatVpnServerForClient(req, vpnServer)).end();
};

/**
 * deleteVpnServer()
 *
 * Delete a specific VPN Server.
 * @param {*} req
 * @param {*} res
 */
exports.getVpnServer = getVpnServer;
var deleteVpnServer = function deleteVpnServer(req, res) {
  var _vpnServer$security_g;
  var vpnServersCol = _server.db.getCollection(_server.COLS.vpn_servers);
  var vpnServer = vpnServersCol.findOne({
    id: req.params.vpn_server_id
  });
  if (!vpnServer) {
    res.status(404).end();
    return;
  }

  /* detach vpn server from sg */
  (_vpnServer$security_g = vpnServer.security_groups) === null || _vpnServer$security_g === void 0 ? void 0 : _vpnServer$security_g.forEach(function (sg) {
    var _securityGroup$target;
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    securityGroup.targets_c2svpn = (_securityGroup$target = securityGroup.targets_c2svpn) === null || _securityGroup$target === void 0 ? void 0 : _securityGroup$target.filter(function (item) {
      return item.id !== req.params.vpn_server_id;
    });
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  vpnServersCol.remove(vpnServer);
  res.status(202).end();
};

/**
 * createVpnServer()
 *
 * Create a new VPN Server.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteVpnServer = deleteVpnServer;
var createVpnServer = function createVpnServer(req, res) {
  var input = req.body;
  var vpnServersCol = _server.db.getCollection(_server.COLS.vpn_servers);
  var duplicate = utils.duplicateNameCheck(vpnServersCol, input, req, res, 'resource with that name already exists', 'vpn_server');
  if (duplicate) {
    return;
  }
  var id = addVpnServer(vpnServersCol, input);
  var vpnServers = vpnServersCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var vpnServer = vpnServers[0];
  res.status(201).json(formatVpnServerForClient(req, vpnServer)).end();
};

/**
 * updateVpnServer()
 *
 * Update the data in an existing VPN Server.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createVpnServer = createVpnServer;
var updateVpnServer = function updateVpnServer(req, res) {
  var newVpnServerData = req.body;
  var vpnServerCols = _server.db.getCollection(_server.COLS.vpn_servers);
  var vpnServers = vpnServerCols.find({
    id: req.params.vpn_server_id
  });
  if (!vpnServers || vpnServers.length === 0) {
    res.status(404).end();
    return;
  }
  var originVpnServer = vpnServers[0];
  var updatedVpnServer = _objectSpread(_objectSpread({}, originVpnServer), newVpnServerData);

  // Now update the server in the DB.
  vpnServerCols.update(updatedVpnServer);

  // Get the updated entry
  var resultServer = utils.findResource(_server.COLS.vpn_servers, updatedVpnServer.id, res, true);
  if (!resultServer) return;

  // Provide updated result to client.
  res.status(200).json(formatVpnServerForClient(req, resultServer)).end();
};
exports.updateVpnServer = updateVpnServer;
var getVpnServerClientConfig = function getVpnServerClientConfig(req, res) {
  var vpnServerCols = _server.db.getCollection(_server.COLS.vpn_servers);
  var vpnServers = vpnServerCols.find({
    id: req.params.vpn_server_id
  });
  if (!vpnServers || vpnServers.length === 0) {
    res.status(404).end();
    return;
  }
  res.status(200).json('Mock data of vpn server client configuration...').end();
};
exports.getVpnServerClientConfig = getVpnServerClientConfig;