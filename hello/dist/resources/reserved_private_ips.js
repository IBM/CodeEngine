"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateReservedIP = exports.setReservedIPTarget = exports.removeReservedIpTarget = exports.init = exports.getReservedIPs = exports.getReservedIP = exports.generateReservedIpInSubnet = exports.formatReservedIpTargetForClient = exports.formatReservedIPWithSubnet = exports.formatReservedIPForClient = exports.deleteReservedIP = exports.createReserveIP = exports.createCustomReservedIpAddress = exports.addSystemReservedIps = exports.addReservedIp = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
var casual = require('casual');
var IPCIDR = require('ip-cidr');
var BigInteger = require('jsbn').BigInteger;
var lodash = require('lodash');
var RESERVED_IP_COLUMN_KEY = 'reserved_private_ips';
function getNextIP(cidrStr, existingIPs) {
  var cidr = new IPCIDR(cidrStr);
  var start = cidr.start({
    type: 'bigInteger'
  });
  var end = cidr.end({
    type: 'bigInteger'
  });
  // start over system reserved ips;
  start = start.add(new BigInteger('4'));
  // eslint-disable-next-line no-constant-condition
  var _loop = function _loop() {
    var nextIP = start;
    if (nextIP.compareTo(end) > 0) {
      return {
        v: undefined
      };
    }
    var nextIPStr = IPCIDR.formatIP(cidr.ipAddressType.fromBigInteger(nextIP));
    if (existingIPs.find(function (ip) {
      return ip.address === nextIPStr;
    })) {
      start = start.add(new BigInteger('1'));
    } else {
      return {
        v: nextIPStr
      };
    }
  };
  while (true) {
    var _ret = _loop();
    if (_typeof(_ret) === "object") return _ret.v;
  }
}
function getSystemReservedIps(subnet) {
  var cidr = new IPCIDR(subnet.ipv4_cidr_block);
  var cidrStart = cidr.start({
    type: 'bigInteger'
  });
  var defaultGateway = cidrStart.add(new BigInteger('1'));
  var dnsAddress = cidrStart.add(new BigInteger('2'));
  var reservedAddress = cidrStart.add(new BigInteger('3'));
  return {
    'ibm-network-address': cidr.start(),
    'ibm-default-gateway': IPCIDR.formatIP(cidr.ipAddressType.fromBigInteger(defaultGateway)),
    'ibm-dns-address': IPCIDR.formatIP(cidr.ipAddressType.fromBigInteger(dnsAddress)),
    'ibm-reserved-address': IPCIDR.formatIP(cidr.ipAddressType.fromBigInteger(reservedAddress)),
    'ibm-broadcast-address': cidr.end()
  };
}

/*
 * Generate a Reserved IP address based on subnet iprange randomly.
 */
var generateReservedIps = function generateReservedIps(subnet, data) {
  var reservedIPCol = _server.db.addCollection(_server.COLS.reserved_private_ips);
  var subnetCIDR = subnet.ipv4_cidr_block;
  var reservedIPsInSub = reservedIPCol.chain().where(function (obj) {
    return obj.subnetId === subnet.id;
  }).data();
  var systermReservedIps = getSystemReservedIps(subnet);
  if (data && systermReservedIps[data.name]) {
    return systermReservedIps[data.name];
  }
  return getNextIP(subnetCIDR, reservedIPsInSub);
};
var setIPOwner = function setIPOwner(address, subnet) {
  var systermReservedIps = getSystemReservedIps(subnet);
  var systermReservedIpAddresses = Object.values(systermReservedIps);
  if (systermReservedIpAddresses.includes(address)) {
    return 'provider';
  }
  return 'user';
};

/*
 * This is a helper function that can set the target of a reserved IP.
 *
 * @param {string} fipId - the ID of the reserved IP to add the target to
 * @param {string} targetId - the ID of the target to add
 * @param {string} targetType - the type of the target to add
 */
var setReservedIPTarget = function setReservedIPTarget(reserved_ip_id, target, targetType) {
  // filter on owner with user
  var ip = utils.getResource(_server.COLS[RESERVED_IP_COLUMN_KEY], reserved_ip_id)[0];
  var reserved_ip = _server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  if (ip) {
    utils.reserveResourceID(ip.id);
    reserved_ip.update(_objectSpread(_objectSpread({}, ip), {}, {
      target: _objectSpread({
        resource_type: targetType
      }, target)
    }));
  }
};
exports.setReservedIPTarget = setReservedIPTarget;
var addReservedIp = function addReservedIp(reserved_ips, subnet, data) {
  var id = casual.uuid;
  var ip = data && data.address ? data.address : generateReservedIps(subnet, data);
  if (!ip) {
    return undefined;
  }
  var reserved_ip = Object.assign(_objectSpread({
    id: id,
    subnetId: subnet.id,
    name: data && data.name || utils.generateName('reservedIp', subnet.zone),
    crn: utils.generateCRN(),
    created_at: utils.generateCreateDate(),
    address: ip,
    status: 'available',
    zone: utils.findZone(subnet.zone.name),
    auto_delete: true
  }, data));
  reserved_ip.owner = setIPOwner(reserved_ip.address, subnet);
  if (reserved_ip.name === 'aaa-reserved-ip') {
    reserved_ip.owner = 'user';
  }
  reserved_ips.insert(reserved_ip);
  if (data && data.target) {
    var targetId = data.target.id;
    // find endpoint_gateways, network_interfaces
    var targetType = _server.COLS.endpoint_gateways;
    var target = utils.getResource(targetType, targetId);
    var targetReourceType = 'endpoint_gateway';
    if (target.length === 0) {
      targetType = _server.COLS.dynamic_route_servers;
      targetReourceType = 'dynamic_route_server';
      target = utils.getResource(targetType, targetId);
    }
    if (target.length === 0) {
      targetType = _server.COLS.network_interfaces;
      targetReourceType = 'network_interface';
      target = utils.getResource(targetType, targetId);
    }
    if (target.length === 0) {
      targetType = _server.COLS.virtual_network_interfaces;
      targetReourceType = 'virtual_network_interface';
      target = utils.getResource(targetType, targetId);
    }
    if (target.length > 0) {
      setReservedIPTarget(id, target[0], targetReourceType);
    }
    if (targetReourceType === 'virtual_network_interface') {
      var vniCols = _server.db.getCollection(_server.COLS.virtual_network_interfaces);
      var updatedVni = _objectSpread(_objectSpread({}, target[0]), {}, {
        ips: target[0].ips.concat([reserved_ip])
      });
      vniCols.update(updatedVni);
    }
  } else if (reserved_ip.owner !== 'provider') {
    // add one cloud resource for one subnet
    var reservedIpsWithCloudResource = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
      var _resource$target;
      return (resource === null || resource === void 0 ? void 0 : (_resource$target = resource.target) === null || _resource$target === void 0 ? void 0 : _resource$target.crn) && resource.subnetId === subnet.id;
    }).data({
      removeMeta: true
    });
    if (reservedIpsWithCloudResource.length === 0 && reserved_ip.name !== 'aaa-reserved-ip') {
      setReservedIPTarget(id, {
        // eslint-disable-next-line max-len
        crn: 'crn:v1:staging:public:cloud-object-storage:global:a/4fb75f5f291f4266a40399c529aad632:e56cef34-7771-428f-b988-c86421e575ec::'
      }, 'cloud_resource');
    }
  }
  return id;
};

/*
 * This is  helper function to remove the target from a reserved IP and remove the
 * reserved IP. and when reserved IP have auto_delete property true, we also remove this
 * reserved IP
 *
 * @param {string} reservedIp - the ID of the reserved IP to remove the target from
 * @param {Object} res - the requests's response object
 */
exports.addReservedIp = addReservedIp;
var removeReservedIpTarget = function removeReservedIpTarget(reservedIp) {
  var reservedIpCollection = _server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  var thisReservedIp = reservedIpCollection.findOne({
    id: reservedIp
  });
  if (thisReservedIp) {
    if (thisReservedIp.auto_delete) {
      reservedIpCollection.remove(thisReservedIp);
    } else {
      reservedIpCollection.update(_objectSpread(_objectSpread({}, thisReservedIp), {}, {
        target: null
      }));
    }
  }
};

/*
 * Generate a new reserved IP in the specified subnet
 */
exports.removeReservedIpTarget = removeReservedIpTarget;
var generateReservedIpInSubnet = function generateReservedIpInSubnet(subnet, data) {
  var reservedIps = _server.db.addCollection(_server.COLS.reserved_private_ips);
  var id = addReservedIp(reservedIps, subnet, data);
  return utils.getResource(_server.COLS[RESERVED_IP_COLUMN_KEY], id);
};
exports.generateReservedIpInSubnet = generateReservedIpInSubnet;
var formatReservedIPWithSubnet = function formatReservedIPWithSubnet(req, ip) {
  return {
    address: ip.address,
    auto_delete: ip.auto_delete,
    href: "".concat(utils.getBaseApiUrl(req), "subnets/").concat(ip.subnetId, "/reserved_ips/").concat(ip.id),
    subnet: _objectSpread(_objectSpread({}, utils.formatResourceLinkForClient(req, _server.COLS.subnets, utils.getResource(_server.COLS.subnets, ip.subnetId)[0])), {}, {
      resource_type: 'subnet'
    }),
    id: ip.id,
    name: ip.name
  };
};

/*
 * This is a helper function to for the reserved IP as a target for use in a client reponse.
 *
 * @param {string} req - the request object
 * @param {string} targetId - the ID of the target object associated with the reserved IP to format
 */
exports.formatReservedIPWithSubnet = formatReservedIPWithSubnet;
var formatReservedIpTargetForClient = function formatReservedIpTargetForClient(req, targetId) {
  var reservedIps = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
    return resource.target && resource.target.id === targetId;
  }).data({
    removeMeta: true
  });
  if (reservedIps.length === 0) {
    return [];
  }
  return reservedIps.map(function (ip) {
    return formatReservedIPWithSubnet(req, ip);
  });
};

// add default IBM reserved ips
// here we have 5 static reserved ips are IBM owne https://github.ibm.com/cloudlab/srb/tree/master/proposals/960
// Provider address | Name | Example for a /24 subnet
// The network address | ibm-network-address | x.x.x.0
// The default gateway address | ibm-default-gateway | x.x.x.1
// Reserved for the DNS server address | ibm-dns-address | x.x.x.2
// Reserved | ibm-reserved-address | x.x.x.3
// The broadcast address | ibm-broadcast-address | x.x.x.255 (lastest ip of one subnet)
exports.formatReservedIpTargetForClient = formatReservedIpTargetForClient;
var addSystemReservedIps = function addSystemReservedIps(subnet) {
  var reserved_ips = _server.db.addCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  addReservedIp(reserved_ips, subnet, {
    name: 'ibm-network-address'
  });
  addReservedIp(reserved_ips, subnet, {
    name: 'ibm-default-gateway'
  });
  addReservedIp(reserved_ips, subnet, {
    name: 'ibm-dns-address'
  });
  addReservedIp(reserved_ips, subnet, {
    name: 'ibm-reserved-address'
  });
  addReservedIp(reserved_ips, subnet, {
    name: 'ibm-broadcast-address'
  });
  return subnet;
};
exports.addSystemReservedIps = addSystemReservedIps;
var init = function init() {
  var reserved_ips = _server.db.addCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // get the first subnet
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().data({
    removeMeta: true
  });
  subnets.map(function (subnet) {
    var maxCount = lodash.min([subnet.total_ipv4_address_count - 5, 10]);
    var randomIpCount = casual.integer(5, maxCount);
    // For aaa-default-subnet-1, fixing the IpCount to have available IPs in the select dropdown
    if (subnet.id === 'subnet-1' || subnet.id === 'subnet-3') {
      randomIpCount = 25;
    }
    utils.repeat(function () {
      addReservedIp(reserved_ips, subnet, {});
    }, randomIpCount);
    return subnet;
  });
};
exports.init = init;
var filterBySubnet = function filterBySubnet(subnetId, resource) {
  if (resource.subnetId === subnetId) {
    return true;
  }
  return false;
};

/**
 * get reserved ips for a subnet
 * GET /subnet/{subnet_id}/reserved_ips
 * @param {*} req
 * @param {*} res
 */
var getReservedIPs = function getReservedIPs(req, res) {
  var subnet = utils.findResource(_server.COLS.subnets, req.params.subnet_id, res, false);
  if (!subnet) {
    return;
  }
  var reservedIPS = utils.getResources(req, _server.COLS[RESERVED_IP_COLUMN_KEY], function (resource) {
    return filterBySubnet(subnet.id, resource);
  });
  res.json(reservedIPS).end();
};

/**
 *  reserve an ip for a subnet
 * GET /subnet/{subnet_id}/reserved_ips
 * @param {*} req
 * @param {*} res
 */
exports.getReservedIPs = getReservedIPs;
var createReserveIP = function createReserveIP(req, res) {
  var input = req.body;
  var subnet = utils.findResource(_server.COLS.subnets, req.params.subnet_id, res, false);
  // check dup name only if name is provided
  if (input.name) {
    if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]), input, req, res, 'reserved ip is already existed', 'reserve_ip')) {
      return;
    }
  }
  var id = addReservedIp(_server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]), subnet, input);
  if (!id) {
    res.status(400).json(utils.generateErrors('Can not allocate reserved ip', 'over_limit', 'reserved_ip')).end();
  }
  var ip = utils.findResource(_server.COLS[RESERVED_IP_COLUMN_KEY], id, res, true);
  ip.href = "".concat(utils.getBaseUrl(req), "/subnet/").concat(req.params.subnet_id, "/reserved_ips/{").concat(id);
  res.status(201).json(ip).end();
};
exports.createReserveIP = createReserveIP;
var deleteReservedIP = function deleteReservedIP(req, res) {
  var reserved_ip = utils.findResource(_server.COLS[RESERVED_IP_COLUMN_KEY], req.params.id, res);
  // reserved ip can't be deleted if it is associated with a target
  if (reserved_ip.target) {
    /*
    * You aren't allowed to remove a reserved ip associated with a target
    */
    var errors = [{
      code: 'reserved_ip_in_use',
      message: 'The reserved  IP is in use.',
      more_info: 'https://cloud.ibm.com/docs/infrastructure/vpc/errors.html#reserved_ip_in_use',
      target: {
        name: reserved_ip.target.id,
        type: ''
      }
    }];
    res.status(409).json(errors).end();
    return;
  }
  var ips = _server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  ips.remove(reserved_ip);
  res.status(204).end();
};
exports.deleteReservedIP = deleteReservedIP;
var formatReservedIPForClient = function formatReservedIPForClient(req, reservedIp) {
  var _reservedIp$target;
  reservedIp.href = "".concat(utils.getBaseApiUrl(req), "subnets/").concat(reservedIp.subnetId, "/reserved_ips/").concat(reservedIp.id);
  reservedIp.crn = utils.updateResourceCrnRegion(reservedIp, req);
  reservedIp.resource_type = 'subnet_reserved_ip';
  if ((_reservedIp$target = reservedIp.target) !== null && _reservedIp$target !== void 0 && _reservedIp$target.hrefBase) {
    reservedIp.target.href = "".concat(utils.getBaseApiUrl(req)).concat(reservedIp.target.hrefBase);
  }
};
exports.formatReservedIPForClient = formatReservedIPForClient;
var getReservedIP = function getReservedIP(req, res) {
  var reserved_ip = utils.findResource(_server.COLS[RESERVED_IP_COLUMN_KEY], req.params.id, res);
  if (!reserved_ip) {
    return;
  }
  formatReservedIPForClient(req, reserved_ip);
  res.json(reserved_ip).end();
};
exports.getReservedIP = getReservedIP;
var updateReservedIP = function updateReservedIP(req, res) {
  var reserved_ips = _server.db.getCollection(_server.COLS[RESERVED_IP_COLUMN_KEY]);
  var reserved_ip = utils.findResource(_server.COLS[RESERVED_IP_COLUMN_KEY], req.params.id, res);
  if (!reserved_ip) {
    return;
  }
  var newIPData = req.body;
  var updatedIP = _objectSpread(_objectSpread({}, reserved_ip), newIPData);
  reserved_ips.update(updatedIP);
  formatReservedIPForClient(req, updatedIP);
  res.json(updatedIP).end();
};

/*
  Generate a new reserved IP address in the specified subnet for custom reservedIps
*/
exports.updateReservedIP = updateReservedIP;
var createCustomReservedIpAddress = function createCustomReservedIpAddress(subnetId) {
  var _utils$findResource;
  var currentSubnetIpv4Address = (_utils$findResource = utils.findResource(_server.COLS.subnets, subnetId)) === null || _utils$findResource === void 0 ? void 0 : _utils$findResource.ipv4_cidr_block;
  var address = currentSubnetIpv4Address.split('/')[0].split('.');
  address[address.length - 1] = casual.integer(1, 200);
  return address.join('.');
};
exports.createCustomReservedIpAddress = createCustomReservedIpAddress;