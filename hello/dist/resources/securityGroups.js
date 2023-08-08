"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateSecurityGroup = exports.updateRule = exports.setVNIC = exports.setTarget = exports.init = exports.getVNICs = exports.getVNIC = exports.getTargets = exports.getTarget = exports.getSecurityGroupsForVpc = exports.getSecurityGroups = exports.getSecurityGroup = exports.getRules = exports.getRule = exports.formatSecurityGroupForClient = exports.deleteVNIC = exports.deleteTarget = exports.deleteSecurityGroup = exports.deleteRule = exports.createSecurityGroup = exports.createRule = exports.addSecurityGroup = void 0;
var _compact = _interopRequireDefault(require("lodash/compact"));
var _get = _interopRequireDefault(require("lodash/get"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _network_interfaces = require("./network_interfaces");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');

// const SECURITY_GROUPS = 'security_groups';
var RULE_CONSTANTS = {
  directions: ['inbound', 'outbound'],
  ipVersion: 'ipv4'
};
var TARGET_TYPES = {
  network_interface: 'network_interface',
  load_balancer: 'load_balancer',
  endpoint_gateway: 'endpoint_gateway',
  vpn_server: 'vpn_server',
  virtual_network_interface: 'virtual_network_interface',
  dynamic_route_server: 'dynamic_route_server'
};

/*
 * TODO - We still need to support the list of vnics for each SG.
 */

/*
 * This function generates the default security group rules.  The security group rule type only support allow
 * if A security group doesn't have any rule, it means it denies everything
 */
var generateDefaultRules = function generateDefaultRules() {
  return [{
    id: casual.uuid,
    remote: {
      cidr_block: '0.0.0.0/0'
    },
    protocol: 'tcp',
    port_min: 1,
    port_max: 65535,
    direction: RULE_CONSTANTS.directions[0],
    ip_version: RULE_CONSTANTS.ipVersion
    // created_at: utils.generateCreateDate(),
  }, {
    id: casual.uuid,
    protocol: 'udp',
    port_min: 1,
    port_max: 65535,
    remote: {
      cidr_block: '0.0.0.0/0'
    },
    direction: RULE_CONSTANTS.directions[1],
    ip_version: RULE_CONSTANTS.ipVersion
  }];
};
var formatTargetForSgClient = function formatTargetForSgClient(targetResourceKey, targetType, targetId, req, res) {
  var resourceTarget = utils.findResource(targetResourceKey, targetId, res);
  var href = "".concat(utils.getBaseApiUrl(req)).concat(targetResourceKey, "/").concat(targetId);
  var _ref = resourceTarget || {},
    id = _ref.id,
    name = _ref.name;
  return {
    id: id,
    name: name,
    href: href,
    resource_type: targetType
  };
};
var getTargetsData = function getTargetsData(req, res, securityGroup) {
  // add href for network interfaces
  var vnics = (0, _get["default"])(securityGroup, 'network_interfaces', undefined);
  vnics = vnics && vnics.map(function (vnic) {
    return (0, _network_interfaces.formatNetworkInterfaceForSgClient)(vnic.id, req, res);
  });
  if (vnics) {
    securityGroup.targets = vnics;
  }
  // find and add loadbalances targets
  var lbs = (0, _get["default"])(securityGroup, 'targets_lb', undefined);
  lbs = lbs && lbs.map(function (lb) {
    return formatTargetForSgClient(_server.COLS.load_balancers, TARGET_TYPES.load_balancer, lb.id, req, res);
  });
  if (lbs) {
    securityGroup.targets = (securityGroup.targets || []).concat(lbs);
  }
  // find and add endpointGateway targets
  var endpointGatewaysTargets = (0, _get["default"])(securityGroup, 'targets_peg', undefined);
  endpointGatewaysTargets = endpointGatewaysTargets && endpointGatewaysTargets.map(function (oneTarget) {
    return formatTargetForSgClient(_server.COLS.endpoint_gateways, TARGET_TYPES.endpoint_gateway, oneTarget.id, req, res);
  });
  if (endpointGatewaysTargets) {
    securityGroup.targets = (securityGroup.targets || []).concat(endpointGatewaysTargets);
  }

  // find and add dynamic route server targets
  var dynamicRouteServerTargets = (0, _get["default"])(securityGroup, 'targets_drs', undefined);
  dynamicRouteServerTargets = dynamicRouteServerTargets && dynamicRouteServerTargets.map(function (oneTarget) {
    return formatTargetForSgClient(_server.COLS.dynamic_route_servers, TARGET_TYPES.dynamic_route_server, oneTarget.id, req, res);
  });
  if (dynamicRouteServerTargets) {
    securityGroup.targets = (securityGroup.targets || []).concat(dynamicRouteServerTargets);
  }
  var vpnServersTargets = (0, _get["default"])(securityGroup, 'targets_c2svpn', undefined);
  vpnServersTargets = vpnServersTargets && vpnServersTargets.map(function (oneTarget) {
    return formatTargetForSgClient(_server.COLS.vpn_servers, TARGET_TYPES.vpn_server, oneTarget.id, req, res);
  });
  if (vpnServersTargets) {
    securityGroup.targets = (securityGroup.targets || []).concat(vpnServersTargets);
  }
  var vniTargets = (0, _get["default"])(securityGroup, 'targets_vni', undefined);
  vniTargets = vniTargets && vniTargets.map(function (oneTarget) {
    return formatTargetForSgClient(_server.COLS.virtual_network_interfaces, TARGET_TYPES.virtual_network_interface, oneTarget.id, req, res);
  });
  if (vniTargets) {
    securityGroup.targets = (securityGroup.targets || []).concat(vniTargets);
  }
  return securityGroup.targets;
};
var formatSecurityGroupForClient = function formatSecurityGroupForClient(req, res, securityGroup) {
  securityGroup.href = "".concat(utils.getBaseApiUrl(req), "security_groups/").concat(securityGroup.id);
  securityGroup.rules.forEach(function (rule) {
    rule.href = "".concat(securityGroup.href, "/rules/").concat(rule.id);
    if (rule.remote && rule.remote.id) {
      var remoteSecurityGroup = utils.findResource(_server.COLS.security_groups, rule.remote.id, undefined, true);
      rule.remote.name = remoteSecurityGroup && remoteSecurityGroup.name;
      rule.remote.href = "".concat(utils.getBaseApiUrl(req), "security_groups/").concat(rule.remote.id);
    }
  });
  var vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, securityGroup.vpc.id);
  if (vpc) securityGroup.vpc = vpc;

  // add href for network interfaces
  var vnics = (0, _get["default"])(securityGroup, 'network_interfaces', undefined);
  vnics = vnics && vnics.map(function (vnic) {
    return (0, _network_interfaces.formatNetworkInterfaceForSgClient)(vnic.id, req, res);
  }).filter(function (a) {
    return a;
  });
  if (vnics) securityGroup.network_interfaces = vnics;
  securityGroup.targets = getTargetsData(req, res, _objectSpread({}, securityGroup));
  if (securityGroup.targets_lb) {
    delete securityGroup.targets_lb;
  }
  if (securityGroup.targets_peg) {
    delete securityGroup.targets_peg;
  }
  if (securityGroup.targets_drs) {
    delete securityGroup.targets_drs;
  }
  if (securityGroup.targets_c2svpn) {
    delete securityGroup.targets_c2svpn;
  }
  if (securityGroup.targets_vni) {
    delete securityGroup.targets_vni;
  }
};

/*
 * This is a data load function that can add a Security Group.  It will
 * give that Security Group a resource group, an id, a href and a generated create
 * date some time in the last 100 days along with data passed in from request body
 */
exports.formatSecurityGroupForClient = formatSecurityGroupForClient;
var addSecurityGroup = function addSecurityGroup(securityGroups, data) {
  var _utils$getResource$;
  var id = casual.uuid;
  var resourceGroupId = data && data.resource_group && data.resource_group.id || utils.getRandomResourceGroup();
  var resourceGroupName = (_utils$getResource$ = utils.getResource(_server.COLS.resourceGroups, resourceGroupId)[0]) === null || _utils$getResource$ === void 0 ? void 0 : _utils$getResource$.name;
  var sg = Object.assign({
    id: id,
    created_at: utils.generateCreateDate(),
    zone: utils.getRandomZone(),
    resource_group: {
      id: resourceGroupId,
      name: resourceGroupName
    },
    rules: generateDefaultRules()
  }, data);
  if (!data.name) {
    // Zone will be given by data
    sg.name = utils.generateName('sg', sg.zone);
  }
  securityGroups.insert(sg);
  return id;
};
exports.addSecurityGroup = addSecurityGroup;
var getRandomVPC = function getRandomVPC(vpcs, region) {
  return {
    vpc: {
      id: casual.random_element(vpcs.filter(function (vpc) {
        return vpc.zone.region_name === region;
      })).id
    }
  };
};

/*
 * Our init function creates two well known Security Groups and a set of
 * random Security Groups.
 */
var init = function init() {
  // security group init depends on vpc, in server.js vpcs.init() needs to be executed before this
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().data({
    removeMeta: true
  });
  var securityGroups = _server.db.addCollection(_server.COLS.security_groups);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var defaultZone = utils.findZone(utils.getDefaultZone());
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-1',
    id: '58fd2383-acb8-11e8-94ce-3e338a9fcdfb',
    zone: defaultZone,
    vpc: {
      id: 'vpc1001'
    },
    targets_lb: [{
      id: 'LB001'
    }],
    targets_c2svpn: [{
      id: 'vpn-server-1'
    }]
  });
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-3',
    id: '58fd2382-acb8-11e8-94ce-3e338a9fcdfb',
    zone: defaultZone,
    vpc: {
      id: 'vpc1001'
    },
    targets_lb: [{
      id: 'LB001'
    }],
    targets_c2svpn: [{
      id: 'vpn-server-1'
    }]
  });

  // Add more attached SGs under vpc1001
  // A maximum of 5 security groups can be attached for VPN Server and LB
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-4',
    id: '58fd2382-acb8-11e8-94ce-3e338a9fcdf4',
    zone: defaultZone,
    vpc: {
      id: 'vpc1001'
    },
    targets_lb: [{
      id: 'LB001'
    }],
    targets_c2svpn: [{
      id: 'vpn-server-1'
    }]
  });
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-5',
    id: '58fd2382-acb8-11e8-94ce-3e338a9fcdf5',
    zone: defaultZone,
    vpc: {
      id: 'vpc1001'
    },
    targets_lb: [{
      id: 'LB001'
    }],
    targets_c2svpn: [{
      id: 'vpn-server-1'
    }]
  });
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-6',
    id: '58fd2382-acb8-11e8-94ce-3e338a9fcdf6',
    zone: defaultZone,
    vpc: {
      id: 'vpc1001'
    }
  });
  addSecurityGroup(securityGroups, {
    name: 'aaa-default-sg-2',
    id: 'a81bb849-a194-11e8-94ce-3e338a9fcdfb',
    zone: defaultZone,
    vpc: {
      id: 'vpc1002'
    },
    targets_peg: [{
      id: 'a56cf208-d9ed-40bf-93bf-044000104547'
    }, {
      id: 'cb0c0923-fe82-4bdc-87ba-8795522735cc'
    }]
  });
  utils.repeat(function () {
    var zone = utils.getRandomZone();
    addSecurityGroup(securityGroups, _objectSpread({
      zone: zone
    }, getRandomVPC(vpcs, zone.region_name)));
  }, 25);
};

/*
 * Get a list of SecurityGroups and handle pagination.
 */
exports.init = init;
var getSecurityGroups = function getSecurityGroups(req, res) {
  if (!req.query.limit) {
    req.query.limit = 65535;
  }
  var securityGroups = utils.getResources(req, _server.COLS.security_groups);
  securityGroups.security_groups.forEach(function (sg) {
    return formatSecurityGroupForClient(req, res, sg);
  });
  res.json(securityGroups).end();
};

/*
 * Get a specific SecurityGroup.
 */
exports.getSecurityGroups = getSecurityGroups;
var getSecurityGroup = function getSecurityGroup(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, true);
  if (!securityGroup) return;
  formatSecurityGroupForClient(req, res, securityGroup);
  res.json(securityGroup).end();
};

/*
 * Create a new SecurityGroup.
 */
exports.getSecurityGroup = getSecurityGroup;
var createSecurityGroup = function createSecurityGroup(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.security_groups), input, req, res, 'security group is already existed', 'securityGroup')) {
    return;
  }

  /*
   * We need to set the zone so the SG shows up in the correct region.
   */
  input.zone = utils.findZoneInRegion(utils.getQueryRegion(req));
  if (input.rules) {
    input.rules.forEach(function (rule) {
      rule.id = casual.uuid;
      if (!rule.name) {
        rule.name = utils.generateName('sg-rule');
      }
    });
  }
  input.created_at = utils.generateNowDate();
  var id = addSecurityGroup(_server.db.getCollection(_server.COLS.security_groups), input, req);
  var sg = utils.findResource(_server.COLS.security_groups, id, res, true);
  if (!sg) return;
  formatSecurityGroupForClient(req, res, sg);
  res.status(201).json(sg).end();
};

/*
 * Update the data in an Security Group.  This only supports changing the Security Group name.
 */
exports.createSecurityGroup = createSecurityGroup;
var updateSecurityGroup = function updateSecurityGroup(req, res) {
  var input = req.body;
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) return;

  // Update the security group name
  securityGroup.name = input.name || securityGroup.name;
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);

  // Get the updated SG and output it to the client.
  var resultSg = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, true);
  formatSecurityGroupForClient(req, res, resultSg);
  res.status(200).json(resultSg).end();
};

/**
 * Retrieves a security group's targets with pagination.
 * GET /security_groups/{security_group_id}/targets/
 * @param {*} req
 * @param {*} res
 */
exports.updateSecurityGroup = updateSecurityGroup;
var getTargets = function getTargets(req, res) {
  var limit = Number.parseInt(utils.getQueryParam(req.query, 'limit', 10), 10);
  var offset = Number.parseInt(utils.getQueryParam(req.query, 'start', 0), 10);
  var next = offset + limit;
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  var allTargets = getTargetsData(req, res, _objectSpread({}, securityGroup)) || [];
  var targets = {
    targets: allTargets.slice(offset, limit + offset),
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };
  if (next > allTargets.length) {
    delete targets.next;
  }
  res.json(targets).end();
};

/*
 * Get the details of a specific target
 * GET /security_groups/{security_group_id}/targets/{id}
 */
exports.getTargets = getTargets;
var getTarget = function getTarget(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  var target = (getTargetsData(req, res, _objectSpread({}, securityGroup)) || []).find(function (r) {
    return r.id === req.params.target_id;
  });
  if (!target) {
    res.status(404).end();
    return;
  }
  res.json(target).end();
};

/**
 * Add an existing target (network_interface or load_balancer) to an existing security group
 * PUT /security_groups/{security_group_id}/target/{id}
 * @param {*} req
 * @param {*} res
 */
exports.getTarget = getTarget;
var setTarget = function setTarget(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res);
  var target;
  // const vnic = utils.findResource(COLS.network_interfaces, req.params.target_id, res);
  // const lb = utils.findResource(COLS.load_balancers, req.params.target_id, res);
  var vnic = utils.getResource(_server.COLS.network_interfaces, req.params.target_id);
  var lb = utils.getResource(_server.COLS.load_balancers, req.params.target_id);
  var endpointGateway = utils.getResource(_server.COLS.endpoint_gateways, req.params.target_id);
  var vpnServer = utils.getResource(_server.COLS.vpn_servers, req.params.target_id);
  var vni = utils.getResource(_server.COLS.virtual_network_interfaces, req.params.target_id);
  var dynamicRouteServer = utils.getResource(_server.COLS.dynamic_route_servers, req.params.target_id);
  if (vnic && vnic.length) {
    target = vnic[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(vnic[0].instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic[0].id);
    target.resource_type = TARGET_TYPES.network_interface;
  } else if (lb && lb.length) {
    target = lb[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.load_balancers, "/").concat(lb[0].id);
    target.resource_type = TARGET_TYPES.load_balancer;
  } else if (endpointGateway !== null && endpointGateway !== void 0 && endpointGateway.length) {
    target = endpointGateway[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.endpoint_gateways, "/").concat(target.id);
    target.resource_type = TARGET_TYPES.endpoint_gateway;
  } else if (dynamicRouteServer !== null && dynamicRouteServer !== void 0 && dynamicRouteServer.length) {
    target = dynamicRouteServer[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.dynamic_route_servers, "/").concat(target.id);
    target.resource_type = TARGET_TYPES.dynamic_route_server;
  } else if (vpnServer !== null && vpnServer !== void 0 && vpnServer.length) {
    target = vpnServer[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.vpn_servers, "/").concat(target.id);
    target.resource_type = TARGET_TYPES.vpn_server;
  } else if (vni !== null && vni !== void 0 && vni.length) {
    target = vni[0];
    target.href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.virtual_network_interfaces, "/").concat(target.id);
    target.resource_type = TARGET_TYPES.virtual_network_interface;
  }
  if (!securityGroup || !target) {
    return res.status(404).end();
  }
  var _target = target,
    href = _target.href,
    id = _target.id,
    name = _target.name,
    resource_type = _target.resource_type;
  if ((getTargetsData(req, res, _objectSpread({}, securityGroup)) || []).find(function (t) {
    return t.id === target.id;
  })) {
    return res.status(201).json({
      href: href,
      id: id,
      name: name,
      resource_type: resource_type
    }).end();
  }
  switch (target.resource_type) {
    case TARGET_TYPES.network_interface:
      {
        // Update VNIC reference in SG
        if (securityGroup.network_interfaces) {
          securityGroup.network_interfaces.push({
            id: target.id
          });
        } else {
          securityGroup.network_interfaces = [{
            id: target.id
          }];
        }
        _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
        var _target2 = target,
          _target2$security_gro = _target2.security_groups,
          securityGroups = _target2$security_gro === void 0 ? [] : _target2$security_gro;
        // Check to see if the vnic is already associated with the security group. If so, don't add it.
        var hasSecurityGroup = securityGroups.filter(function (item) {
          return item.id === securityGroup.id;
        }).length > 0;
        if (!hasSecurityGroup) {
          securityGroups.push({
            id: securityGroup.id
          });
        }
        // Update SG reference in VNIC
        var updatedVNIC = _objectSpread(_objectSpread({}, target), {}, {
          security_groups: securityGroups
        });
        _server.db.getCollection(_server.COLS.network_interfaces).update(updatedVNIC);
      }
      break;
    case TARGET_TYPES.load_balancer:
      if (securityGroup.targets_lb) {
        securityGroup.targets_lb.push({
          id: target.id
        });
      } else {
        securityGroup.targets_lb = [{
          id: target.id
        }];
      }
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.endpoint_gateway:
      if (securityGroup.targets_peg) {
        securityGroup.targets_peg.push({
          id: target.id
        });
      } else {
        securityGroup.targets_peg = [{
          id: target.id
        }];
      }
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.dynamic_route_server:
      {
        if (securityGroup.targets_drs) {
          securityGroup.targets_drs.push({
            id: target.id
          });
        } else {
          securityGroup.targets_drs = [{
            id: target.id
          }];
        }
        _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
        // Update SG reference in DRS
        var drs = utils.findResource(_server.COLS.dynamic_route_servers, target.id, res);
        var updatedDrs = _objectSpread(_objectSpread({}, drs), {}, {
          security_groups: [].concat(_toConsumableArray(drs.security_groups), [{
            id: securityGroup.id
          }])
        });
        _server.db.getCollection(_server.COLS.dynamic_route_servers).update(updatedDrs);
      }
      break;
    case TARGET_TYPES.vpn_server:
      if (securityGroup.targets_c2svpn) {
        securityGroup.targets_c2svpn.push({
          id: target.id
        });
      } else {
        securityGroup.targets_c2svpn = [{
          id: target.id
        }];
      }
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.virtual_network_interface:
      if (securityGroup.targets_vni) {
        securityGroup.targets_vni.push({
          id: target.id
        });
      } else {
        securityGroup.targets_vni = [{
          id: target.id
        }];
      }
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    default:
      break;
  }
  return res.status(201).json({
    href: href,
    id: id,
    name: name,
    resource_type: resource_type
  }).end();
};

/**
 * Removes a target from a security group.
 * DELETE /security_groups/{security_group_id}/targets/{id}
 * @param {*} req
 * @param {*} res
 */
exports.setTarget = setTarget;
var deleteTarget = function deleteTarget(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res);
  var target = (getTargetsData(req, res, _objectSpread({}, securityGroup)) || []).find(function (item) {
    return item.id === req.params.target_id;
  });
  if (!securityGroup || !target) return res.status(404).end();
  switch (target.resource_type) {
    case TARGET_TYPES.network_interface:
      {
        // Update VNIC reference in SG
        var vnics = securityGroup.network_interfaces;
        vnics = vnics.filter(function (item) {
          return item.id !== target.id;
        });
        var updatedSecurityGroup = _objectSpread(_objectSpread({}, securityGroup), {}, {
          network_interfaces: vnics
        });
        _server.db.getCollection(_server.COLS.security_groups).update(updatedSecurityGroup);

        // Update SG reference in VNIC
        var vnic = utils.findResource(_server.COLS.network_interfaces, target.id, res);
        var security_groups = vnic.security_groups;
        security_groups = security_groups.filter(function (item) {
          return item.id !== req.params.sg_id;
        });
        var updatedVNIC = _objectSpread(_objectSpread({}, vnic), {}, {
          security_groups: security_groups
        });
        _server.db.getCollection(_server.COLS.network_interfaces).update(updatedVNIC);
      }
      break;
    case TARGET_TYPES.load_balancer:
      securityGroup.targets_lb = securityGroup.targets_lb.filter(function (item) {
        return item.id !== target.id;
      });
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.endpoint_gateway:
      securityGroup.targets_peg = securityGroup.targets_peg.filter(function (item) {
        return item.id !== target.id;
      });
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.dynamic_route_server:
      {
        securityGroup.targets_drs = securityGroup.targets_drs.filter(function (item) {
          return item.id !== target.id;
        });
        _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
        // Update SG reference in DRS
        var drs = utils.findResource(_server.COLS.dynamic_route_servers, target.id, res);
        var updatedDrs = _objectSpread(_objectSpread({}, drs), {}, {
          security_groups: drs.security_groups.filter(function (item) {
            return item.id !== req.params.sg_id;
          })
        });
        _server.db.getCollection(_server.COLS.dynamic_route_servers).update(updatedDrs);
      }
      break;
    case TARGET_TYPES.vpn_server:
      securityGroup.targets_c2svpn = securityGroup.targets_c2svpn.filter(function (item) {
        return item.id !== target.id;
      });
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    case TARGET_TYPES.virtual_network_interface:
      securityGroup.targets_vni = securityGroup.targets_vni.filter(function (item) {
        return item.id !== target.id;
      });
      _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
      break;
    default:
      break;
  }
  return res.status(204).end();
};

/*
 * Get the rules for an Security Group with pagination.
 */
exports.deleteTarget = deleteTarget;
var getRules = function getRules(req, res) {
  var limit = Number.parseInt(utils.getQueryParam(req.query, 'limit', 10), 10);
  var offset = Number.parseInt(utils.getQueryParam(req.query, 'start', 0), 10);
  var next = offset + limit;
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  securityGroup.rules.forEach(function (rule) {
    rule.href = "".concat(utils.getBaseUrl(req), "/").concat(rule.id);
  });
  var rules = {
    rules: securityGroup.rules.slice(offset, limit + offset),
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };
  if (next > securityGroup.rules.length) {
    delete rules.next;
  }
  res.json(rules).end();
};

/*
 * Get the details of a specific rule
 */
exports.getRules = getRules;
var getRule = function getRule(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  var rule = securityGroup.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    res.status(404).end();
    return;
  }
  res.json(rule).end();
};

/*
 * Update a specified rule for an Security Group.
 */
exports.getRule = getRule;
var updateRule = function updateRule(req, res) {
  var input = req.body;
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) return;
  var rule = securityGroup.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    res.status(404).end();
    return;
  }
  var updatedRule = Object.assign(rule, input);

  // Update the rule
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);

  // Output the result
  res.status(200).json(updatedRule).end();
};

/*
 * Create a new security group rule.
 */
exports.updateRule = updateRule;
var createRule = function createRule(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  var input = req.body;
  var index = securityGroup.rules.length;
  input.id = casual.uuid;
  if (!input.name) {
    input.name = utils.generateName('sg-rule');
  }
  securityGroup.rules.splice(index, 0, input);
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  res.status(201).json(input).end();
};
exports.createRule = createRule;
var deleteSecurityGroup = function deleteSecurityGroup(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  _server.db.getCollection(_server.COLS.security_groups).remove(securityGroup);
  res.status(204).end();
};
exports.deleteSecurityGroup = deleteSecurityGroup;
var deleteRule = function deleteRule(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  if (!securityGroup) {
    return;
  }
  var rule = securityGroup.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    return;
  }
  securityGroup.rules.splice(securityGroup.rules.findIndex(function (r) {
    return r.id === req.params.rule_id;
  }), 1);
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  res.status(204).end();
};
exports.deleteRule = deleteRule;
var formatVnics = function formatVnics(vnic) {
  var id = vnic.id,
    name = vnic.name,
    primary_ipv4_address = vnic.primary_ipv4_address,
    created_at = vnic.created_at,
    floating_ips = vnic.floating_ips,
    security_groups = vnic.security_groups,
    status = vnic.status,
    subnet = vnic.subnet,
    type = vnic.type;
  return {
    id: id,
    name: name,
    primary_ipv4_address: primary_ipv4_address,
    created_at: created_at,
    floating_ips: floating_ips,
    security_groups: security_groups,
    status: status,
    subnet: subnet,
    type: type
  };
};

/**
 * Retrieves a security group's network interfaces
 * GET /security_groups/{security_group_id}/network_interfaces/
 * @param {*} req
 * @param {*} res
 */
var getVNICs = function getVNICs(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces).chain().where(function (vnic) {
    return (0, _compact["default"])(vnic.security_groups.filter(function (item) {
      return item.id === securityGroup.id;
    })).length > 0;
  }).data({
    removeMeta: true
  });
  if (!securityGroup || !vnics) {
    return;
  }
  var formattedVnics = vnics && vnics.map(function (item) {
    return formatVnics(item);
  });
  res.status(200).json({
    network_interfaces: formattedVnics
  }).end();
};

/**
 * Get a network interface in a security group
 * GET /security_groups/{security_group_id}/network_interfaces/{id}
 * @param {*} req
 * @param {*} res
 */
exports.getVNICs = getVNICs;
var getVNIC = function getVNIC(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res, false);
  var vnic = utils.findResource(_server.COLS.network_interfaces, req.params.vnic_id, res, true);
  if (!securityGroup || !vnic) {
    return;
  }
  res.status(200).json(vnic).end();
};

/**
 * Add an existing network interface to an existing security group
 * PUT /security_groups/{security_group_id}/network_interfaces/{id}
 * @param {*} req
 * @param {*} res
 */
exports.getVNIC = getVNIC;
var setVNIC = function setVNIC(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res);
  var vnic = utils.findResource(_server.COLS.network_interfaces, req.params.vnic_id, res);
  if (!securityGroup || !vnic) {
    return res.status(404).end();
  }

  // Update VNIC reference in SG
  if (securityGroup.network_interfaces) {
    securityGroup.network_interfaces.push({
      id: vnic.id
    });
  } else {
    securityGroup.network_interfaces = [{
      id: vnic.id
    }];
  }
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  var _vnic$security_groups = vnic.security_groups,
    securityGroups = _vnic$security_groups === void 0 ? [] : _vnic$security_groups;

  // Check to see if the vnic is already associated with the security group. If so, don't add it.
  var hasSecurityGroup = securityGroups.filter(function (item) {
    return item.id === securityGroup.id;
  }).length > 0;
  if (!hasSecurityGroup) {
    securityGroups.push({
      id: securityGroup.id
    });
  }

  // Update SG reference in VNIC
  var updatedVNIC = _objectSpread(_objectSpread({}, vnic), {}, {
    security_groups: securityGroups
  });
  _server.db.getCollection(_server.COLS.network_interfaces).update(updatedVNIC);
  var created_at = updatedVNIC.created_at,
    floating_ips = updatedVNIC.floating_ips,
    href = updatedVNIC.href,
    id = updatedVNIC.id,
    name = updatedVNIC.name,
    port_speed = updatedVNIC.port_speed,
    primary_ipv4_address = updatedVNIC.primary_ipv4_address,
    secondary_addresses = updatedVNIC.secondary_addresses,
    security_groups = updatedVNIC.security_groups,
    status = updatedVNIC.status,
    subnet = updatedVNIC.subnet,
    type = updatedVNIC.type;
  return res.status(201).json({
    created_at: created_at,
    floating_ips: floating_ips,
    href: href,
    id: id,
    name: name,
    port_speed: port_speed,
    primary_ipv4_address: primary_ipv4_address,
    secondary_addresses: secondary_addresses,
    security_groups: security_groups,
    status: status,
    subnet: subnet,
    type: type
  }).end();
};

/**
 * Removes a network interface from a security group.
 * DELETE /security_groups/{security_group_id}/network_interfaces/{id}
 * @param {*} req
 * @param {*} res
 */
exports.setVNIC = setVNIC;
var deleteVNIC = function deleteVNIC(req, res) {
  var securityGroup = utils.findResource(_server.COLS.security_groups, req.params.sg_id, res);
  var vnic = utils.findResource(_server.COLS.network_interfaces, req.params.vnic_id, res);
  if (!securityGroup || !vnic) return res.status(404).end();
  if (!securityGroup.network_interfaces || !vnic.security_groups) return res.status(200).end();

  // Update VNIC reference in SG
  var vnics = securityGroup.network_interfaces;
  vnics = vnics.filter(function (item) {
    return item.id !== vnic.id;
  });
  var updatedSecurityGroup = _objectSpread(_objectSpread({}, securityGroup), {}, {
    network_interfaces: vnics
  });
  _server.db.getCollection(_server.COLS.security_groups).update(updatedSecurityGroup);

  // Update SG reference in VNIC
  var security_groups = vnic.security_groups;
  security_groups = security_groups.filter(function (item) {
    return item.id !== req.params.sg_id;
  });
  var updatedVNIC = _objectSpread(_objectSpread({}, vnic), {}, {
    security_groups: security_groups
  });
  _server.db.getCollection(_server.COLS.network_interfaces).update(updatedVNIC);
  return res.status(204).end();
};
exports.deleteVNIC = deleteVNIC;
var getSecurityGroupsForVpc = function getSecurityGroupsForVpc(vpcId) {
  var allSGs = _server.db.getCollection(_server.COLS.security_groups).chain().data({
    removeMeta: true
  });
  var securityGroupsForVpc = allSGs.filter(function (sg) {
    return sg.vpc.id === vpcId;
  });
  return securityGroupsForVpc;
};
exports.getSecurityGroupsForVpc = getSecurityGroupsForVpc;