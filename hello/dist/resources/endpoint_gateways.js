"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateEndpointGateway = exports.unbindReservedIP = exports.isValidForIPInVPC = exports.init = exports.getEndpointGateways = exports.getEndpointGatewayIPs = exports.getEndpointGatewayIP = exports.getEndpointGateway = exports.formatEndpointGatewayForClient = exports.deleteEndpointGateway = exports.createEndpointGateway = exports.bindReservedIP = void 0;
var _lodash = require("lodash");
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _reserved_private_ips = require("./reserved_private_ips");
var _common = require("./common");
var _service_endpoints = require("../utils/service_endpoints");
var _private_path_service_gateways_endpoint_gateway_bindings = require("./private_path_service_gateways_endpoint_gateway_bindings");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
var addEndpointGateway = function addEndpointGateway(gateways, data, isGeneratingIP) {
  var id = data.id || casual.uuid;
  var vpc = data.vpc;
  var resourceGroup = data.resource_group || utils.getRandomUniqueResource(_server.COLS.resourceGroups);
  var name = data.name || utils.generateName('endpoint-gateway');
  if ((0, _lodash.isEmpty)(data.ips)) {
    if (vpc && !vpc.zone) {
      vpc = utils.getResource(_server.COLS.vpcs, vpc.id)[0];
    }
    if (!vpc) {
      vpc = utils.getRandomUniqueResource(_server.COLS.vpcs);
    }
    var subnetsInVPC = _server.db.getCollection(_server.COLS.subnets).chain().where(function (subnet) {
      return subnet.vpc.id === vpc.id;
    }).data({
      removeMeta: true
    });
    if (subnetsInVPC.length === 0) {
      throw new Error('The VPC has no subnet');
    }
    var randSubnet = utils.getRandomResourceFromArray(subnetsInVPC);
    data.ips = isGeneratingIP ? (0, _reserved_private_ips.generateReservedIpInSubnet)(randSubnet) : [];
  }
  data.ips.forEach(function (oneReservedIp, index) {
    var reservedIP;
    if (oneReservedIp && oneReservedIp.id) {
      reservedIP = utils.getResource(_server.COLS.reserved_private_ips, oneReservedIp.id)[0];
    } else if (oneReservedIp.subnet) {
      var _reservedIP;
      var subnet = utils.getResource(_server.COLS.subnets, oneReservedIp.subnet.id)[0];
      reservedIP = (0, _reserved_private_ips.generateReservedIpInSubnet)(subnet, oneReservedIp)[0];
      data.ips[index].id = (_reservedIP = reservedIP) === null || _reservedIP === void 0 ? void 0 : _reservedIP.id;
    }
    if (reservedIP) {
      if (!vpc) {
        var subnetID = reservedIP.subnetId;
        if (subnetID) {
          var _subnet = utils.getResource(_server.COLS.subnets, subnetID)[0];
          vpc = _subnet.vpc;
        }
      }
      (0, _reserved_private_ips.setReservedIPTarget)(reservedIP.id, {
        id: id,
        name: name
      }, 'endpoint_gateway');
    }
  });
  if (!vpc) {
    vpc = utils.getRandomUniqueResource(_server.COLS.vpcs);
  }
  var region_name;
  if (vpc.zone && vpc.zone.region_name) {
    region_name = vpc.zone.region_name;
  }
  if (!region_name) {
    vpc = utils.getResource(_server.COLS.vpcs, vpc.id)[0];
    region_name = vpc.zone.region_name;
  }
  var targetService = _server.db.getCollection(_server.COLS.ghost).chain().find({
    name: _service_endpoints.targetServiceName
  }).data();
  var endpointGateway = Object.assign({
    id: id,
    name: name,
    crn: utils.generateCRN({
      region: region_name,
      'endpoint-gateway': id
    }),
    resource_type: 'endpoint_gateway',
    created_at: utils.generateCreateDate(),
    lifecycle_state: casual.random_element(Object.values(_common.LIFECYCLE_STATE)),
    health_state: casual.random_element(Object.values(_common.HEALTH_STATE)),
    vpc: vpc,
    service_endpoints: casual.random_element([[_service_endpoints.targetEndpoint1, _service_endpoints.targetEndpoint2], [_service_endpoints.targetEndpoint1], [_service_endpoints.targetEndpoint1, _service_endpoints.targetEndpoint2]]),
    target: {
      name: _service_endpoints.targetServiceName,
      crn: targetService[0].crn,
      resource_type: 'provider_cloud_service'
    },
    allow_dns_resolution_binding: data.allow_dns_resolution_binding || true,
    resource_group: {
      id: resourceGroup.id,
      name: resourceGroup.name
    },
    region: region_name
  }, data);
  // update PPS binding
  var target = endpointGateway.target;
  if (target.resource_type === 'private_path_service_gateway') {
    var ppsg = _server.db.getCollection(_server.COLS.ppsgs).findOne({
      crn: target.crn
    });
    var accountId = utils.getCrnField(target.crn, 'scope').split('/')[1];
    var newBinding = {
      created_at: utils.generateNowDate(),
      id: endpointGateway.id,
      ppsg: ppsg.id,
      account: {
        id: accountId
      },
      status: _common.LIFECYCLE_STATE.PENDING,
      lifecycle_state: _common.LIFECYCLE_STATE.STABLE
    };
    endpointGateway.lifecycle_state = _common.LIFECYCLE_STATE.PENDING;
    endpointGateway.lifecycle_reason = _common.VPE_LIFECYCLE_REASON.PENDING_ACCESS;
    endpointGateway.target.name = ppsg.name;
    (0, _private_path_service_gateways_endpoint_gateway_bindings.addBindings)(_server.db.getCollection(_server.COLS.ppsgs_bindings), newBinding);
  }
  gateways.insert(endpointGateway);
  return id;
};
var init = function init() {
  var gateways = _server.db.addCollection(_server.COLS.endpoint_gateways);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var systemReservedIps = ['ibm-network-address', 'ibm-default-gateway', 'ibm-dns-address', 'ibm-reserved-address', 'ibm-broadcast-address'];
  var filteredEntries = Object.values(_server.db.getCollection(_server.COLS.reserved_private_ips).data).filter(function (item) {
    return !systemReservedIps.includes(item.name) && item.zone.region_name === utils.DEFAULT_REGION;
  });
  var filteredReservedIp = filteredEntries[Math.floor(Math.random() * filteredEntries.length)];
  var reservedIp = utils.getRandomResourceInZone(_server.COLS.reserved_private_ips, utils.DEFAULT_REGION);
  addEndpointGateway(gateways, {
    name: 'aaa-default-endpoint-gateway-1',
    id: 'a56cf208-d9ed-40bf-93bf-044000104547',
    ips: [reservedIp],
    security_groups: [{
      id: 'aaa-default-sg-2'
    }],
    vpc: {
      id: 'vpc1002'
    }
  }, true);
  addEndpointGateway(gateways, {
    name: 'aaa-default-endpoint-gateway-2',
    id: 'cb0c0923-fe82-4bdc-87ba-8795522735cc',
    security_groups: [{
      id: 'aaa-default-sg-2'
    }],
    vpc: {
      id: 'vpc1002'
    }
  }, false);
  addEndpointGateway(gateways, {
    name: 'aaa-default-endpoint-gateway-3',
    id: '7e0f657e-05f2-4021-95e5-fa71df11d421',
    allow_dns_resolution_binding: true,
    ips: [filteredReservedIp],
    security_groups: [{
      id: 'aaa-default-sg-2'
    }],
    vpc: {
      id: 'vpc1002'
    }
  }, true);
  addEndpointGateway(gateways, {
    name: 'aaa-default-endpoint-gateway-delete',
    id: 'a56cft45-ft45-ft45-ft45-454500104547',
    allow_dns_resolution_binding: false,
    vpc: {
      id: 'vpc1002'
    }
  }, true);
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    var vpc = utils.getRandomResourceInZone(_server.COLS.vpcs, region.name);
    var id = addEndpointGateway(gateways, {
      name: "egw_per_region_".concat(region.name),
      vpc: vpc
    }, true);
    utils.updateEndpointGatewayIdInSecurityGroup(id, vpc.default_security_group.id);
  });
  utils.repeat(function () {
    var zone = utils.getRandomZone();
    var vpc = utils.getRandomResourceInZone(_server.COLS.vpcs, zone.region_name);
    var id = addEndpointGateway(gateways, {
      vpc: vpc
    });
    utils.updateEndpointGatewayIdInSecurityGroup(id, vpc.default_security_group.id);
  }, 5);
};

/*
 * This function formats the public gateway for the client.  It sets up the
 * hrefs and fills in the details of, vpc, and reserved IP.
 */
exports.init = init;
var formatEndpointGatewayForClient = function formatEndpointGatewayForClient(req, gateway) {
  var _req$query;
  gateway.href = "".concat(utils.getBaseApiUrl(req), "endpoint_gateways/").concat(gateway.id);
  gateway.vpc = {
    crn: utils.generateCRN({
      region: (_req$query = req.query) === null || _req$query === void 0 ? void 0 : _req$query.region
    }),
    href: "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(gateway.vpc.id),
    resource_type: 'vpc',
    id: gateway.vpc.id,
    name: gateway.vpc.name || gateway.vpc.id
  };
  var reservedIpTarget = (0, _reserved_private_ips.formatReservedIpTargetForClient)(req, gateway.id);
  if (reservedIpTarget) {
    gateway.ips = reservedIpTarget;
  } else {
    gateway.ips = [];
  }
  var allSGs = _server.db.getCollection(_server.COLS.security_groups).chain().data();
  var securityGroups = allSGs.filter(function (sg) {
    return sg.targets_peg && sg.targets_peg.some(function (lb2) {
      return lb2.id === gateway.id;
    });
  });
  if (securityGroups && securityGroups.length > 0) {
    gateway.security_groups = securityGroups.map(function (securityGroup) {
      return utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, securityGroup.id);
    });
  } else {
    delete gateway.security_groups;
  }
};
exports.formatEndpointGatewayForClient = formatEndpointGatewayForClient;
var getEndpointGateways = function getEndpointGateways(req, res) {
  var filter;
  if (req.query['vpc.id']) {
    filter = function filter(one) {
      return one.vpc.id === req.query['vpc.id'];
    };
  }
  var gateways = utils.getResources(req, _server.COLS.endpoint_gateways, filter);
  gateways.endpoint_gateways.map(function (gateway) {
    formatEndpointGatewayForClient(req, gateway);
    return gateway;
  });
  res.json(gateways).end();
};
exports.getEndpointGateways = getEndpointGateways;
var getEndpointGateway = function getEndpointGateway(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.endpoint_gateways).chain().find({
    id: req.params.gateway_id
  }).data({
    removeMeta: true
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  formatEndpointGatewayForClient(req, gateway[0]);
  delete gateway[0].href;
  res.json(gateway[0]).end();
};
exports.getEndpointGateway = getEndpointGateway;
var getEndpointGatewayIPs = function getEndpointGatewayIPs(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.endpoint_gateways).chain().find({
    id: req.params.gateway_id
  }).data({
    removeMeta: true
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  var reserved_ips = (0, _reserved_private_ips.formatReservedIpTargetForClient)(req, req.params.gateway_id);
  res.json({
    ips: reserved_ips
  }).end();
};
exports.getEndpointGatewayIPs = getEndpointGatewayIPs;
var getEndpointGatewayIP = function getEndpointGatewayIP(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.endpoint_gateways).chain().find({
    id: req.params.gateway_id
  }).data({
    removeMeta: true
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  var reserved_ips = (0, _reserved_private_ips.formatReservedIpTargetForClient)(req, req.params.gateway_id);
  var reserved_ip = reserved_ips.find(function (ip) {
    return ip.id === req.params.reserved_ip_id;
  });
  if (!reserved_ip) {
    res.status(404).end();
    return;
  }
  res.json(reserved_ip).end();
};
exports.getEndpointGatewayIP = getEndpointGatewayIP;
var deleteEndpointGateway = function deleteEndpointGateway(req, res) {
  var _gateway$security_gro;
  var gatewayId = req.params.gateway_id;
  var endpointGatewaysCollections = _server.db.getCollection(_server.COLS.endpoint_gateways);
  if (!gatewayId) {
    return;
  }
  var gateway = endpointGatewaysCollections.findOne({
    id: gatewayId
  });
  if (!gateway) {
    res.status(404).end();
    return;
  }
  /* detach gateway from sg */
  (_gateway$security_gro = gateway.security_groups) === null || _gateway$security_gro === void 0 ? void 0 : _gateway$security_gro.forEach(function (sg) {
    var _securityGroup$target;
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    securityGroup.targets_peg = (_securityGroup$target = securityGroup.targets_peg) === null || _securityGroup$target === void 0 ? void 0 : _securityGroup$target.filter(function (item) {
      return item.id !== gatewayId;
    });
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  endpointGatewaysCollections.remove(gateway);
  res.status(204).end();

  /*
   * We need to call the reserved IP to remove the reference to this reserved
   * IP so it can get associated with a different target.
   */
  var reservedIps = gateway.ips;
  if (reservedIps.length > 0) {
    reservedIps.map(function (oneReservedIp) {
      (0, _reserved_private_ips.removeReservedIpTarget)(oneReservedIp.id);
      return oneReservedIp;
    });
  }
  endpointGatewaysCollections.findAndRemove({
    id: gatewayId
  });
  res.status(204).end();
};
exports.deleteEndpointGateway = deleteEndpointGateway;
var isValidForIPInVPC = function isValidForIPInVPC(vpcId, ips) {
  var isValid = true;
  if (!ips) {
    return true;
  }
  isValid = !ips.find(function (ip) {
    var subnetId = ip.subnetId || ip.subnet.id;
    var subnet = utils.getResource(_server.COLS.subnets, subnetId)[0];
    return subnet.vpc.id !== vpcId;
  });
  return isValid;
};
exports.isValidForIPInVPC = isValidForIPInVPC;
var updateEndpointGateway = function updateEndpointGateway(req, res) {
  var input = req.body;
  var gateway = utils.findResource(_server.COLS.endpoint_gateways, req.params.gateway_id, res, false);
  if (!gateway) return;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.endpoint_gateways), input, req, res, 'public gateway already exists', 'endpoint_gateway', true)) {
    return;
  }

  // Update the public gateway name
  gateway.name = input.name || gateway.name;
  if (input.allow_dns_resolution_binding !== undefined) {
    gateway.allow_dns_resolution_binding = input.allow_dns_resolution_binding;
  }
  _server.db.getCollection(_server.COLS.endpoint_gateways).update(gateway);

  // Get the updated PGW and output it to the client.
  var resultSGW = utils.findResource(_server.COLS.endpoint_gateways, req.params.gateway_id, res, true);
  formatEndpointGatewayForClient(req, resultSGW);
  res.status(200).json(resultSGW).end();
};
exports.updateEndpointGateway = updateEndpointGateway;
var bindReservedIP = function bindReservedIP(req, res) {
  var gateway = utils.findResource(_server.COLS.endpoint_gateways, req.params.gateway_id, res, false);
  var reservedIPId = req.params.reserved_ip_id;
  var reservedIp = utils.findResource(_server.COLS.reserved_private_ips, reservedIPId, res, false);
  if (!gateway || !gateway.id) return;
  if (!isValidForIPInVPC(gateway.vpc.id, [reservedIp])) {
    res.status(400).json(utils.generateErrors('The reserved ip is not in the vpc of the endpoint gateway', 'invalid_reserved_ip', 'id', 'parameter')).end();
    return;
  }
  if (reservedIp) {
    var href = reservedIp.href,
      id = reservedIp.id,
      resource_type = reservedIp.resource_type,
      address = reservedIp.address,
      auto_delete = reservedIp.auto_delete;
    var subnet = utils.findResource(_server.COLS.subnets, reservedIp.subnetId, res, false);
    var subnetName = subnet.name,
      subnetId = subnet.id;
    var reservedIpWithSubnet = {
      href: href,
      id: id,
      address: address,
      auto_delete: auto_delete,
      resource_type: resource_type,
      subnet: {
        name: subnetName,
        id: subnetId
      }
    };
    if (gateway.ips) {
      gateway.ips.push(reservedIpWithSubnet);
    } else {
      gateway.ips = [reservedIpWithSubnet];
    }
    _server.db.getCollection(_server.COLS.endpoint_gateways).update(gateway);
    (0, _reserved_private_ips.setReservedIPTarget)(reservedIp.id, {
      id: gateway.id,
      name: gateway.name
    }, 'endpoint_gateway');
  }

  // Get the updated reserved ip and output it to the client.

  var updatedReservedIP = utils.findResource(_server.COLS.reserved_private_ips, reservedIPId, res, true);
  res.status(201).json((0, _reserved_private_ips.formatReservedIPWithSubnet)(req, updatedReservedIP)).end();
};
exports.bindReservedIP = bindReservedIP;
var unbindReservedIP = function unbindReservedIP(req, res) {
  var gateway = utils.findResource(_server.COLS.endpoint_gateways, req.params.gateway_id, res, false);
  if (!gateway || !gateway.id) return;
  var reservedIPId = req.params.reserved_ip_id;
  if (gateway.ips) {
    gateway.ips = gateway.ips.filter(function (oneReservedIp) {
      return oneReservedIp.id !== reservedIPId;
    });
    _server.db.getCollection(_server.COLS.endpoint_gateways).update(gateway);
    (0, _reserved_private_ips.removeReservedIpTarget)(reservedIPId);
  }
  res.status(204).end();
};
exports.unbindReservedIP = unbindReservedIP;
var createEndpointGateway = function createEndpointGateway(req, res) {
  var input = req.body;
  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  // RIAS allows blank on this field
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.endpoint_gateways), input, req, res, 'endpoint gateway is already existed', 'endpoint_gateway')) {
    return;
  }
  if (utils.objectRefCheck(_server.COLS.vpcs, input.vpc.id, res)) {
    return;
  }
  input.created_at = utils.generateNowDate();
  if (input.ips) {
    var isValid = true;
    input.ips.forEach(function (oneReservedIp, index) {
      if (!isValid || oneReservedIp.id && utils.objectRefCheck(_server.COLS.reserved_private_ips, oneReservedIp.id, res)) {
        isValid = false;
        return;
      }
      if (oneReservedIp.id) {
        // this is to create reserved ip with subnet id but the subnet id is not there
        input.ips[index] = _server.db.getCollection(_server.COLS.reserved_private_ips).find({
          id: oneReservedIp.id
        })[0];
      }
    });
    if (!isValid) {
      return;
    }
  }
  if (input.resource_group) {
    input.resource_group = _server.db.getCollection(_server.COLS.resourceGroups).find({
      id: input.resource_group.id
    })[0];
  }
  if (!input.target || !input.target.crn && !input.target.name) {
    var msg = 'To create new endpoint gateway, Its target crn or name must be provided';
    res.status(400).json(utils.generateErrors(msg, 'invalid_target', 'endpoint_gateway', 'parameter')).end();
    return;
  }
  input.vpc = _server.db.getCollection(_server.COLS.vpcs).find({
    id: input.vpc.id
  })[0];
  if (!isValidForIPInVPC(input.vpc.id, input.ips)) {
    var _msg = 'The reserved ip is not in the vpc of the endpoint gateway or the subnet of the new reserved ip does not exist';
    res.status(400).json(utils.generateErrors(_msg, 'invalid_reserved_ips', 'reserved_ips', 'parameter')).end();
    return;
  }
  var id = addEndpointGateway(_server.db.getCollection(_server.COLS.endpoint_gateways), input, false);
  (input.security_groups || []).forEach(function (sg) {
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    if (securityGroup.targets_peg) {
      securityGroup.targets_peg.push({
        id: id
      });
    } else {
      securityGroup.targets_peg = [{
        id: id
      }];
    }
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  var gateways = _server.db.getCollection(_server.COLS.endpoint_gateways).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  formatEndpointGatewayForClient(req, gateways[0]);
  res.status(201).json(gateways[0]).end();
};
exports.createEndpointGateway = createEndpointGateway;