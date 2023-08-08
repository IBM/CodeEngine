"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateVpnGateway = exports.init = exports.getVpnGateways = exports.getVpnGateway = exports.getAdvertisedCidrs = exports.getAdvertisedCidr = exports.findSubnetsUsingAcl = exports.deleteVpnGateway = exports.deleteAdvertisedCidr = exports.createVpnGateway = exports.addAdvertisedCidr = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _connections = require("./connections");
var _reserved_private_ips = require("./reserved_private_ips");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var VPN_GATEWAYS_NUM = 20;
var VPN_GW_STATUS = {
  ACTIVE: 'available',
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending'
};

// Random status values
var VPN_GW_RANDOM_STATUSES = [VPN_GW_STATUS.ACTIVE, VPN_GW_STATUS.DELETING, VPN_GW_STATUS.FAILED, VPN_GW_STATUS.FAILED, VPN_GW_STATUS.PENDING];
var VPN_GW_HEALTH_STATE = {
  OK: 'ok',
  DEGRADED: 'degraded',
  FAULTED: 'faulted',
  INAPPLICABLE: 'inapplicable'
};

// Random health state values - favoring OK
var VPN_GW_RANDOM_HEALTH_STATES = [VPN_GW_HEALTH_STATE.OK, VPN_GW_HEALTH_STATE.DEGRADED, VPN_GW_HEALTH_STATE.FAULTED, VPN_GW_HEALTH_STATE.INAPPLICABLE];
var VPN_GW_HEALTH_REASONS = {
  cannot_create_vpc_route: 'VPN gateway cannot create the route. Check for any conflicts.',
  // eslint-disable-next-line max-len
  cannot_reserve_ip_address: "There are no IP addresses available in the subnet to allocate. Release addresses on the VPN gateway's subnet by deleting associated resources, such as servers, load balancers, or endpoint gateways.",
  internal_error: 'Internal error. Contact IBM Support.'
};
var VPN_GW_LIFECYCLE_STATE = {
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending',
  STABLE: 'stable',
  SUSPENDED: 'suspended',
  UPDATING: 'updating',
  WAITING: 'waiting'
};

// Random lifecycle state values
var VPN_GW_RANDOM_LIFECYCLE_STATES = [VPN_GW_LIFECYCLE_STATE.DELETING, VPN_GW_LIFECYCLE_STATE.FAILED, VPN_GW_LIFECYCLE_STATE.PENDING, VPN_GW_LIFECYCLE_STATE.STABLE, VPN_GW_LIFECYCLE_STATE.STABLE, VPN_GW_LIFECYCLE_STATE.SUSPENDED, VPN_GW_LIFECYCLE_STATE.SUSPENDED, VPN_GW_LIFECYCLE_STATE.SUSPENDED, VPN_GW_LIFECYCLE_STATE.UPDATING, VPN_GW_LIFECYCLE_STATE.WAITING];
var VPN_GW_LIFECYCLE_REASONS = {
  resource_suspended_by_provider: 'Resource has been suspended. Contact IBM Support.'
};
var VPN_GW_HA_MODE = {
  ACTIVE_STANDBY: 'active_standby',
  ACTIVE_ACTIVE: 'active_active'
};
var VPN_ROUTE_MODE = {
  POLICY: 'policy',
  ROUTE: 'route'
};
var VPN_GW_MEMBER_ROLE = {
  ACTIVE: 'active',
  STANDBY: 'standby'
};
var VPN_GW_MEMBER_STATUS = {
  ACTIVE: 'available',
  FAILED: 'failed',
  PENDING: 'pending',
  DELETING: 'deleting'
};
var VPN_GW_MEMBER_HEALTH_STATE = {
  OK: 'ok',
  DEGRADED: 'degraded',
  FAULTED: 'faulted',
  INAPPLICABLE: 'inapplicable'
};

// Random health state values - favoring OK
var VPN_GW_MEMBER_RANDOM_HEALTH_STATES = [VPN_GW_MEMBER_HEALTH_STATE.OK, VPN_GW_MEMBER_HEALTH_STATE.DEGRADED, VPN_GW_MEMBER_HEALTH_STATE.FAULTED, VPN_GW_MEMBER_HEALTH_STATE.INAPPLICABLE];
var VPN_GW_MEMBER_HEALTH_REASONS = {
  // eslint-disable-next-line max-len
  cannot_reserve_ip_address: "There are no IP addresses available in the subnet to allocate. Release addresses on the VPN gateway's subnet by deleting associated resources, such as servers, load balancers, or endpoint gateways.",
  internal_error: 'Internal error. Contact IBM Support.'
};
var VPN_GW_MEMBER_LIFECYCLE_STATE = {
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending',
  STABLE: 'stable',
  SUSPENDED: 'suspended',
  UPDATING: 'updating',
  WAITING: 'waiting'
};

// Random lifecycle state values
var VPN_GW_MEMBER_RANDOM_LIFECYCLE_STATES = [VPN_GW_MEMBER_LIFECYCLE_STATE.DELETED, VPN_GW_MEMBER_LIFECYCLE_STATE.DELETING, VPN_GW_MEMBER_LIFECYCLE_STATE.FAILED, VPN_GW_MEMBER_LIFECYCLE_STATE.PENDING, VPN_GW_MEMBER_LIFECYCLE_STATE.STABLE, VPN_GW_MEMBER_LIFECYCLE_STATE.STABLE, VPN_GW_MEMBER_LIFECYCLE_STATE.SUSPENDED, VPN_GW_MEMBER_LIFECYCLE_STATE.SUSPENDED, VPN_GW_MEMBER_LIFECYCLE_STATE.SUSPENDED, VPN_GW_MEMBER_LIFECYCLE_STATE.UPDATING, VPN_GW_MEMBER_LIFECYCLE_STATE.WAITING];
var VPN_GW_MEMBER_LIFECYCLE_REASONS = {
  resource_suspended_by_provider: 'Resource has been suspended. Contact IBM Support.'
};

// Random Connection counts favoring smaller numbers
var VPN_GATEWAY_RANDOM_CONN_COUNT = [1, 1, 1, 1, 1, 2, 2, 3, 4, 5];

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
 * addVpnGateway()
 *
 * Creates a new VpnGateway with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the
 * new item is added to the collection.
 *
 * @param {*} vpnGateways - reference to the vpnGateways collection
 * @param {*} data - override data to use for vpn gateway creation.
 * @return - ID of the new VPN Gateway
 */
exports.findSubnetsUsingAcl = findSubnetsUsingAcl;
var addVpnGateway = function addVpnGateway(vpnGateways, data) {
  var addMockConnections = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // All of our REST API fields should be included here in correct field order.
  var address = "170.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 254));
  var address2 = "170.".concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 255), ".").concat(_casual["default"].integer(1, 254));
  var subnet = utils.getRandomResource(_server.COLS.subnets);
  if (data.zone && !data.subnet) {
    subnet = utils.getRandomResourceInZone(_server.COLS.subnets, data.zone.region_name);
  }
  // if (data.id === 'vpn-gateway-1' && !data.subnet) subnet = utils.getRandomResourceInZone(COLS.subnets, 'us-east');
  // if (data.id === 'vpn-gateway-1' && !data.subnet) subnet = { id: 'subnet-1' };

  var routeMode = data.mode || _casual["default"].random_element(Object.values(VPN_ROUTE_MODE));
  var haMode = routeMode === VPN_ROUTE_MODE.ROUTE ? VPN_GW_HA_MODE.ACTIVE_ACTIVE : VPN_GW_HA_MODE.ACTIVE_STANDBY;
  var baseData = {
    id: _casual["default"].uuid,
    crn: utils.generateCRN(),
    href: '',
    // placeholder
    created_at: utils.generateCreateDate(),
    status: data.status || _casual["default"].random_element(VPN_GW_RANDOM_STATUSES),
    public_ip: {
      address: address
    },
    subnet: {
      id: subnet.id
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    connections: [],
    // placeholder
    ha_mode: haMode,
    mode: routeMode,
    health_state: _casual["default"].random_element(VPN_GW_RANDOM_HEALTH_STATES),
    health_reasons: [],
    // placeholder
    lifecycle_state: data.lifecycle_state || _casual["default"].random_element(VPN_GW_RANDOM_LIFECYCLE_STATES),
    lifecycle_reasons: [] // placeholder
  };

  var subnetInfo;
  if (data.subnet) {
    subnetInfo = utils.findResource(_server.COLS.subnets, data.subnet.id);
  } else {
    subnetInfo = subnet;
  }
  var privateAddress = (0, _reserved_private_ips.generateReservedIpInSubnet)(subnetInfo)[0];
  var privateAddress2 = (0, _reserved_private_ips.generateReservedIpInSubnet)(subnetInfo)[0];

  // Generate VPN GW member helath state and reason
  var memberHealthState = _casual["default"].random_element(VPN_GW_MEMBER_RANDOM_HEALTH_STATES);
  var memberHealthReasonCode;
  var memberHealthReasons = [];
  if (memberHealthState !== VPN_GW_MEMBER_HEALTH_STATE.OK) {
    memberHealthReasonCode = _casual["default"].random_element(Object.keys(VPN_GW_MEMBER_HEALTH_REASONS));
    memberHealthReasons = [{
      code: memberHealthReasonCode,
      message: VPN_GW_MEMBER_HEALTH_REASONS[memberHealthReasonCode],
      more_info: "/docs/vpn_gw_member/health_reasons/".concat(memberHealthReasonCode)
    }];
  }

  // Generate VPN GW member lifecycle state and reason
  var memberLifecycleState = _casual["default"].random_element(VPN_GW_MEMBER_RANDOM_LIFECYCLE_STATES);
  var memberLifecycleReasonCode;
  var memberLifecycleReasons = [];
  if (memberLifecycleState === VPN_GW_MEMBER_LIFECYCLE_STATE.SUSPENDED) {
    memberLifecycleReasonCode = 'resource_suspended_by_provider';
    memberLifecycleReasons = [{
      code: memberLifecycleReasonCode,
      message: VPN_GW_MEMBER_LIFECYCLE_REASONS[memberLifecycleReasonCode],
      more_info: "/docs/vpn_gw_member/lifecycle_reasons/".concat(memberLifecycleReasonCode)
    }];
  }
  if (routeMode === VPN_ROUTE_MODE.ROUTE) {
    baseData.local_asn = '123456';
    baseData.advertised_cidrs = ['192.168.3.0/24, 192.168.4.0/24, 192.168.5.0/24'];
    baseData.members = [{
      public_ip: {
        address: address
      },
      private_ip: privateAddress,
      role: VPN_GW_MEMBER_ROLE.ACTIVE,
      status: VPN_GW_MEMBER_STATUS.ACTIVE,
      health_state: VPN_GW_MEMBER_HEALTH_STATE.OK,
      health_reasons: [],
      lifecycle_state: VPN_GW_LIFECYCLE_STATE.STABLE,
      lifecycle_reasons: []
    }, {
      public_ip: {
        address: address2
      },
      private_ip: privateAddress2,
      role: VPN_GW_MEMBER_ROLE.STANDBY,
      status: VPN_GW_MEMBER_STATUS.FAILED,
      health_state: memberHealthState,
      health_reasons: memberHealthReasons,
      lifecycle_state: memberLifecycleState,
      lifecycle_reasons: memberLifecycleReasons
    }];
  } else {
    baseData.members = [{
      name: utils.generateName('vpn-gateway-member'),
      public_ip: {
        address: address
      },
      private_ip: privateAddress,
      role: VPN_GW_MEMBER_ROLE.ACTIVE,
      status: VPN_GW_MEMBER_STATUS.ACTIVE,
      health_state: VPN_GW_MEMBER_HEALTH_STATE.OK,
      health_reasons: [],
      lifecycle_state: VPN_GW_LIFECYCLE_STATE.STABLE,
      lifecycle_reasons: []
    }, {
      name: utils.generateName('vpn-gateway-member'),
      public_ip: {
        address: address
      },
      private_ip: privateAddress2,
      role: VPN_GW_MEMBER_ROLE.STANDBY,
      status: VPN_GW_MEMBER_STATUS.PENDING,
      health_state: memberHealthState,
      health_reasons: memberHealthReasons,
      lifecycle_state: memberLifecycleState,
      lifecycle_reasons: memberLifecycleReasons
    }];
  }

  // Merge the user data
  var newVpnGateway = _objectSpread(_objectSpread({}, baseData), data);

  // Set health status reasons for negative status
  var healthReasonCode = '';
  if (newVpnGateway.health_state !== VPN_GW_HEALTH_STATE.OK) {
    healthReasonCode = _casual["default"].random_element(Object.keys(VPN_GW_HEALTH_REASONS));
  }
  if (healthReasonCode) {
    newVpnGateway.health_reasons = [{
      code: healthReasonCode,
      message: VPN_GW_HEALTH_REASONS[healthReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_gateway/health_reasons/".concat(healthReasonCode)
    }];
  }

  // Set lifecycle status reasons for suspended status
  var lifecycleReasonCode = '';
  if (newVpnGateway.lifecycle_state === VPN_GW_LIFECYCLE_STATE.SUSPENDED) {
    lifecycleReasonCode = 'resource_suspended_by_provider';
  }
  if (lifecycleReasonCode) {
    newVpnGateway.lifecycle_reasons = [{
      code: lifecycleReasonCode,
      message: VPN_GW_LIFECYCLE_REASONS[lifecycleReasonCode] || 'Unknown error.',
      more_info: "/docs/vpn_gateway/lifecycle_reasons/".concat(lifecycleReasonCode)
    }];
  }
  if (!newVpnGateway.zone) {
    subnet = utils.findResource(_server.COLS.subnets, newVpnGateway.subnet.id);
    newVpnGateway.zone = utils.findZone(subnet.zone.name);
    if (!newVpnGateway.name) {
      newVpnGateway.name = utils.generateName('vpn-gateway', newVpnGateway.zone);
    }
  }
  (0, _reserved_private_ips.setReservedIPTarget)(privateAddress.id, {
    id: newVpnGateway.id,
    name: newVpnGateway.name
  }, 'vpn_gateway');
  (0, _reserved_private_ips.setReservedIPTarget)(privateAddress2.id, {
    id: newVpnGateway.id,
    name: newVpnGateway.name
  }, 'vpn_gateway');
  // Push the gateway to the DB
  vpnGateways.insert(newVpnGateway);

  // Add some automatic mock connections if they are desired.
  if (addMockConnections) {
    var count = _casual["default"].random_element(VPN_GATEWAY_RANDOM_CONN_COUNT);
    // console.log('Count ='+ count);

    // Add default connection for default vpn gateway
    if (data.id === 'vpn-gateway-1') {
      // Ensure the default route-based vpn gateway has at least one static route and one dynamic (bgp) route
      count = 3;
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {
        name: 'aaa-default-vpn-connection-1',
        id: 'vpn-connection-1',
        routing_protocol: 'none',
        ike_policy: {
          id: 'ike-policy-1'
        },
        ipsec_policy: {
          id: 'ipsec-policy-1'
        }
      }, 'vpn-gateway-1');
      count -= 1;
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {
        name: 'aaa-default-vpn-connection-2',
        id: 'vpn-connection-2',
        routing_protocol: 'bgp'
      }, 'vpn-gateway-1');
      count -= 1;
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {
        name: 'aaa-default-vpn-connection-6',
        id: 'vpn-connection-6',
        routing_protocol: 'none',
        ike_policy: {
          id: 'ike-policy-1'
        },
        ipsec_policy: {
          id: 'ipsec-policy-1'
        }
      }, 'vpn-gateway-1');
      count -= 1;
    }
    if (data.id === 'vpn-gateway-2') {
      // Ensure the default policy-based vpn gateway has at least one connection
      count = 4;
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {
        name: 'aaa-default-vpn-connection-3',
        id: 'vpn-connection-3'
      }, 'vpn-gateway-2');
      count -= 1;
    }
    if (data.id === 'vpn-gateway-3') {
      count = 4;
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {
        name: 'aaa-default-vpn-connection-4-delete',
        id: 'vpn-connection-4'
      }, 'vpn-gateway-3');
      count -= 1;
    }
    utils.repeat(function () {
      (0, _connections.addConnection)(_server.db.addCollection(_server.COLS.connections), {}, newVpnGateway.id, true, newVpnGateway.zone);
    }, count);
  }
  return newVpnGateway.id;
};

/**
 * init()
 *
 * Initialize the VPN Gateway collection.
 */
var init = function init() {
  // Create the subnets collection
  var vpnGateways = _server.db.addCollection(_server.COLS.vpn_gateways);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Add a couple subnets with known IDs.
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-1',
    id: 'vpn-gateway-1',
    subnet: {
      id: 'subnet-1'
    },
    mode: 'route',
    local_asn: '123456',
    advertised_cidrs: ['192.168.1.0/24', '192.168.2.0/24', '192.168.3.0/24']
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-2',
    id: 'vpn-gateway-2',
    subnet: {
      id: 'subnet-2'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-3',
    id: 'vpn-gateway-3',
    subnet: {
      id: 'subnet-3'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-4',
    id: 'vpn-gateway-4',
    subnet: {
      id: 'subnet-4'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-5',
    id: 'vpn-gateway-5',
    subnet: {
      id: 'subnet-3'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-6',
    id: 'vpn-gateway-6',
    subnet: {
      id: 'subnet-4'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-7',
    id: 'vpn-gateway-7',
    subnet: {
      id: 'subnet-2'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-8',
    id: 'vpn-gateway-8',
    subnet: {
      id: 'subnet-1'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-9',
    id: 'vpn-gateway-9',
    subnet: {
      id: 'subnet-2'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-10',
    id: 'vpn-gateway-10',
    subnet: {
      id: 'subnet-5'
    },
    mode: 'policy'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-aaa-default-vpn-gateway',
    id: 'aaa-aaa-default-vpn-gateway',
    subnet: {
      id: 'subnet-5'
    },
    mode: 'policy',
    status: 'available',
    lifecycle_state: 'stable'
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'aaa-default-vpn-gateway-11',
    id: 'vpn-gateway-12',
    mode: 'route',
    zone: utils.findZoneInRegion('us-east')
  }, true);
  addVpnGateway(vpnGateways, {
    name: 'vpngateway_1_route_per_region_us-east',
    id: 'vpn-gateway-11',
    mode: 'route',
    zone: utils.findZoneInRegion('us-east')
  }, true);

  // Ensure sure we have vpn gateways for every region.
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (_ref) {
    var name = _ref.name;
    // Ensure sure we have one policy based gateway and one route based gateway for every region.
    Object.values(VPN_ROUTE_MODE).forEach(function (routeMode) {
      addVpnGateway(vpnGateways, {
        name: "vpngateway_".concat(routeMode, "_per_region_").concat(name),
        zone: utils.findZoneInRegion(name),
        mode: routeMode
      }, true);
    });
  });

  // Create the remaining additional VPN Gateways - we subtract the ones from above
  var remainingCount = Math.max(VPN_GATEWAYS_NUM - 10, 0);
  utils.repeat(function () {
    addVpnGateway(vpnGateways, {}, true);
  }, remainingCount);
};

/**
 * formatVpnGatewayForClient()
 *
 * Make changes to make VPN Gateway from db collection suitable for
 * client display.
 *
 * @param {*} req
 * @param {*} VpnGateway
 */
exports.init = init;
var formatVpnGatewayForClient = function formatVpnGatewayForClient(req, vpnGateway) {
  // VPN Gateway href
  vpnGateway.href = "".concat(utils.getBaseApiUrl(req), "vpn_gateways/").concat(vpnGateway.id);
  vpnGateway.crn = utils.updateResourceCrnRegion(vpnGateway, req);

  // Subnet Ref
  var subnet_id = _lodash["default"].get(vpnGateway, 'subnet.id', '');
  if (subnet_id) {
    vpnGateway.subnet = utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet_id);
  }

  // VPC Ref
  if (subnet_id) {
    var subnet = utils.getResource(_server.COLS.subnets, subnet_id)[0];
    var vpc_id = _lodash["default"].get(subnet, 'vpc.id', '');
    if (vpc_id) {
      vpnGateway.vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, vpc_id);
    }
  }
  vpnGateway.members.forEach(function (member) {
    return (0, _reserved_private_ips.formatReservedIPForClient)(req, member.private_ip);
  });

  // Connection Ref
  var connections = (0, _connections.getConnectionsForVpnGateway)(vpnGateway.id);
  vpnGateway.connections = connections.map(function (connection) {
    return utils.formatResourceLinkForClient(req, _server.COLS.connections, connection);
  });
  vpnGateway.connections.forEach(function (conn) {
    // We may want to enhance util function to support this.
    conn.href = "".concat(vpnGateway.href, "/connections/").concat(conn.id);
  });
};

/**
 * getVpnGateways()
 *
 * Get a list of all the VPN Gateways.
 *
 * @param {*} req
 * @param {*} res
 */
var getVpnGateways = function getVpnGateways(req, res) {
  var vpnGateways = utils.getResources(req, _server.COLS.vpn_gateways);
  vpnGateways.vpn_gateways.forEach(function (vpnGateway) {
    return formatVpnGatewayForClient(req, vpnGateway);
  });
  res.json(vpnGateways).end();
};

/**
 * getVpnGateway()
 *
 * Get a specific VPN Gateway.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getVpnGateways = getVpnGateways;
var getVpnGateway = function getVpnGateway(req, res) {
  var vpnGateway = utils.findResource(_server.COLS.vpn_gateways, req.params.vpn_gateway_id, res, true);
  if (!vpnGateway) return;
  formatVpnGatewayForClient(req, vpnGateway);
  res.status(200).json(vpnGateway).end();
};

/**
 * deleteVpnGateway()
 *
 * Delete a specific VPN Gateway.
 * @param {*} req
 * @param {*} res
 */
exports.getVpnGateway = getVpnGateway;
var deleteVpnGateway = function deleteVpnGateway(req, res) {
  var vpnGatewaysCol = _server.db.getCollection(_server.COLS.vpn_gateways);
  var vpnGateway = vpnGatewaysCol.findOne({
    id: req.params.vpn_gateway_id
  });
  if (!vpnGateway) {
    res.status(404).end();
    return;
  }
  vpnGatewaysCol.remove(vpnGateway);
  res.status(202).end();
};

/**
 * createVpnGateway()
 *
 * Create a new VPN Gateway.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteVpnGateway = deleteVpnGateway;
var createVpnGateway = function createVpnGateway(req, res) {
  var input = req.body;
  var vpnGatewaysCol = _server.db.getCollection(_server.COLS.vpn_gateways);
  var duplicate = utils.duplicateNameCheck(vpnGatewaysCol, input, req, res, 'resource with that name already exists', 'vpn_gateway');
  if (duplicate) {
    return;
  }
  var id = addVpnGateway(vpnGatewaysCol, input);
  var vpnGateways = vpnGatewaysCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var vpnGateway = vpnGateways[0];
  formatVpnGatewayForClient(req, vpnGateway);
  res.status(201).json(vpnGateway).end();
};

/**
 * updateVpnGateway()
 *
 * Update the data in an existing VPN Gateway.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createVpnGateway = createVpnGateway;
var updateVpnGateway = function updateVpnGateway(req, res) {
  var newVpnGatewayData = req.body;
  var vpnGatewayCols = _server.db.getCollection(_server.COLS.vpn_gateways);
  var vpnGateways = vpnGatewayCols.find({
    id: req.params.vpn_gateway_id
  });
  if (!vpnGateways || vpnGateways.length === 0) {
    res.status(404).end();
    return;
  }
  var origVpnGatewayData = vpnGateways[0];
  var updatedVpnGateway = _objectSpread(_objectSpread({}, origVpnGatewayData), newVpnGatewayData);

  // Now update the gateway in the DB.
  vpnGatewayCols.update(updatedVpnGateway);

  // Get the updated entry
  var resultGateway = utils.findResource(_server.COLS.vpn_gateways, updatedVpnGateway.id, res, true);
  if (!resultGateway) return;

  // Provide updated result to client.
  formatVpnGatewayForClient(req, resultGateway);
  res.status(200).json(resultGateway).end();
};

/**
 * getAdvertisedCidrs()
 *
 * Get the advertised_cidrs for a VPN Gateway
 *
 * @param {*} req
 * @param {*} res
 */
exports.updateVpnGateway = updateVpnGateway;
var getAdvertisedCidrs = function getAdvertisedCidrs(req, res) {
  // Get VPN Gateway
  var vpnGateway = utils.findResource(_server.COLS.vpn_gateways, req.params.vpn_gateway_id, res, true);
  if (!vpnGateway) {
    res.status(404).end();
    return;
  }

  // Now get the advertised_cidrs.
  var result = {
    advertised_cidrs: vpnGateway.advertised_cidrs
  };

  // RIAS returns empty array here if no advertised cidrs are present.
  res.status(200).json(result).end();
};

/**
 * getAdvertisedCidr()
 *
 * Check if advertised_cidr exists
 *
 * @param {*} req
 * @param {*} res
 */
exports.getAdvertisedCidrs = getAdvertisedCidrs;
var getAdvertisedCidr = function getAdvertisedCidr(req, res) {
  // Get VPN Gateway
  var vpnGateway = utils.findResource(_server.COLS.vpn_gateways, req.params.vpn_gateway_id, res, true);
  if (!vpnGateway) {
    res.status(404).end();
    return;
  }

  // Now find the advertised_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = vpnGateway.advertised_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }
  res.status(204).end();
};

/**
 * deleteAdvertisedCidr()
 *
 * Delete advertised_cidr from VPN gateway
 *
 * @param {*} req
 * @param {*} res
 */
exports.getAdvertisedCidr = getAdvertisedCidr;
var deleteAdvertisedCidr = function deleteAdvertisedCidr(req, res) {
  // Get VPN Gateway
  var vpnGateway = utils.findResource(_server.COLS.vpn_gateways, req.params.vpn_gateway_id, res, true);
  if (!vpnGateway) {
    res.status(404).end();
    return;
  }

  // Now find the advertised_cidr.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = vpnGateway.advertised_cidrs.includes(cidrStr);
  if (!result) {
    res.status(404).end();
    return;
  }

  // Update our VPN gateway
  vpnGateway.advertised_cidrs = vpnGateway.advertised_cidrs.filter(function (cidr) {
    return cidr !== cidrStr;
  });
  _server.db.getCollection(_server.COLS.vpn_gateways).update(vpnGateway);
  res.status(204).end();
};

/**
 * addAdvertisedCidr()
 *
 * Add advertised_cidr to VPN gateway
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteAdvertisedCidr = deleteAdvertisedCidr;
var addAdvertisedCidr = function addAdvertisedCidr(req, res) {
  // Get VPN Gateway
  var vpnGateway = utils.findResource(_server.COLS.vpn_gateways, req.params.vpn_gateway_id, res, true);
  if (!vpnGateway) {
    res.status(404).end();
    return;
  }

  // Now find the advertised_cid.
  // In RIAS, if the CIDR is not valid we return 400.
  var cidrStr = "".concat(req.params.prefix_address, "/").concat(req.params.prefix_length);
  var result = vpnGateway.advertised_cidrs.includes(cidrStr);

  // If we don't find it - add it
  if (!result) {
    // Update our VPN Gateway
    vpnGateway.advertised_cidrs.push(cidrStr);
    _server.db.getCollection(_server.COLS.vpn_gateways).update(vpnGateway);
  }
  res.status(204).end();
};
exports.addAdvertisedCidr = addAdvertisedCidr;