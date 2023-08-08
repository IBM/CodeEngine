"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLoadBalancer = exports.formatLoadBalancerForClient = exports.deleteLoadBalancer = exports.createLoadBalancer = void 0;
Object.defineProperty(exports, "getLoadBalancerFromDB", {
  enumerable: true,
  get: function get() {
    return _common.getLoadBalancerFromDB;
  }
});
exports.updateLoadBalancer = exports.init = exports.getLoadBalancers = void 0;
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _pools = require("./pools");
var _listeners = require("./listeners");
var _statistics = require("./statistics");
var _reserved_private_ips = require("../reserved_private_ips");
var _features = require("../features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var lodash = require('lodash');
var operatingStatuses = ['online', 'offline'];
var getZone = function getZone(zone) {
  if (typeof zone === 'string') {
    return utils.findZone(zone);
  }
  if (zone) {
    return zone;
  }
  return utils.getRandomZone();
};

/*
 * We want to make it look like most of the load balacners are running so
 * we'll only use the other provisioning states 25% of the time.
 */
var getProvisioningStatus = function getProvisioningStatus() {
  if (casual.integer(0, 4) % 4 === 0) {
    return casual.random_element(_common.provisioningStatuses);
  }
  return 'active';
};

// eslint-disable-next-line default-param-last
var LoadBalancer = function LoadBalancer() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var isInit = arguments.length > 1 ? arguments[1] : undefined;
  var loadbalancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbs = loadbalancers.find({
    id: data.id
  });
  var lb = lbs && lbs[0];
  var isNLB = false;
  if (!lb) {
    var zone = getZone(data.zone);
    var subnets = [];
    var poolsData = data.pools || [{
      members: [{}]
    }];
    isNLB = data.family === 'network';
    poolsData.forEach(function (pool) {
      var randomInst = utils.getRandomResourceInZone(_server.COLS.instances, zone.region_name);
      var targetIPId = lodash.get(randomInst, 'primary_network_interface.id');
      var targetNIC = utils.getResource(_server.COLS.network_interfaces, targetIPId);
      var targetIP = lodash.get(targetNIC, '[0].primary_ipv4_address');
      var subnetId = lodash.get(targetNIC, '[0].subnet.id');
      if (subnetId) {
        subnets.push({
          id: subnetId
        });
      }
      if (pool.members && targetIP) {
        pool.members.forEach(function (member) {
          if (!member.target) {
            if (isNLB) {
              member.target = {
                id: lodash.get(randomInst, 'id'),
                name: pool.name || lodash.get(randomInst, 'name')
              };
            } else {
              member.target = {
                address: targetIP
              };
            }
          }
        });
      }
    });
    var lbPools = poolsData.map(function (pool) {
      return (0, _pools.addPool)(_objectSpread(_objectSpread({}, pool), {}, {
        isNLB: isNLB
      }), isInit);
    });
    delete data.pools;
    var lbListeners = (data.listeners || []).map(function (listener) {
      listener.pools = lbPools;
      listener.isNLB = isNLB;
      return (0, _listeners.addListener)(listener);
    });
    delete data.listeners;
    delete data.zone;
    var resourceGroupId = data && data.resource_group && data.resource_group.id || utils.getRandomResourceGroup();
    var resourceGroupName = utils.getResource(_server.COLS.resourceGroups, resourceGroupId)[0] && utils.getResource(_server.COLS.resourceGroups, resourceGroupId)[0].name;
    lb = Object.assign({
      zone: zone,
      id: casual.uuid,
      href: '',
      // Placeholder, will be formatted per request
      crn: '',
      is_public: true,
      created_at: utils.generateCreateDate(),
      hostname: utils.generateHostname(),
      listeners: lbListeners,
      operating_status: casual.random_element(operatingStatuses),
      pools: lbPools,
      statistics: (0, _statistics.addStatistics)(data.statistics),
      profile: data.profile,
      provisioning_status: getProvisioningStatus(),
      public_ips: utils.repeat(function () {
        return {
          address: casual.ip
        };
      }, subnets.length),
      subnets: subnets,
      resource_group: {
        id: resourceGroupId,
        name: resourceGroupName
      },
      is_private_path: typeof data.is_private_path !== 'undefined' ? data.is_private_path : false
    }, data);
    lb.private_ips = lb.subnets.map(function (subnet) {
      var subnetInDB = utils.findResource(_server.COLS.subnets, subnet.id);
      return (0, _reserved_private_ips.generateReservedIpInSubnet)(subnetInDB, data === null || data === void 0 ? void 0 : data.reservedIPData)[0];
    });
    if (!data.name) {
      lb.name = utils.generateName('lb', lb.zone);
    }
    lb.private_ips.forEach(function (private_ip) {
      (0, _reserved_private_ips.setReservedIPTarget)(private_ip.id, {
        id: lb.id,
        name: lb.name
      }, 'load_balancer');
    });
    loadbalancers.insert(lb);
    return lb;
  }
  return undefined;
};
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * formatLoadBalancerForClient()
 *
 * Takes a load balancer and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} load balancer - raw load balancer from DB entry
 */
var formatLoadBalancerForClient = function formatLoadBalancerForClient(req, lb) {
  var zone = lb.zone;
  var location = !lb.profile ? zone.region_name : zone.name;
  var displayLB = lodash.cloneDeep(lb);
  displayLB.crn = utils.generateCRN({
    region: location
  });
  displayLB.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id);
  displayLB.pools = lb.pools.map(function (pool) {
    pool.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/pools/").concat(pool.id);
    return lodash.pick(pool, ['id', 'name', 'href']);
  });
  displayLB.listeners = lb.listeners.map(function (listener) {
    listener.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/listeners/").concat(listener.id);
    return lodash.pick(listener, ['id', 'href']);
  });

  // Subnets - Add array of {id, crn, href, name} or if none delete subnets.
  var subnets = displayLB.subnets;
  if (subnets && subnets.length > 0) {
    displayLB.subnets = subnets.map(function (subnet) {
      return utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet.id);
    });
  } else {
    delete displayLB.subnets;
  }
  var allSGs = _server.db.getCollection(_server.COLS.security_groups).chain().data();
  var securityGroups = allSGs.filter(function (sg) {
    return sg.targets_lb && sg.targets_lb.some(function (lb2) {
      return lb2.id === lb.id;
    });
  });
  if (securityGroups && securityGroups.length > 0) {
    displayLB.security_groups = securityGroups.map(function (securityGroup) {
      return utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, securityGroup.id);
    });
  } else {
    delete displayLB.security_groups;
  }

  // trim the profile to just name/family/href
  displayLB.profile = !lb.profile ? null : {
    name: lb.profile.name,
    family: capitalizeFirstLetter(lb.profile.family || ''),
    href: "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/profiles/").concat(lb.profile.name),
    route_mode: lb === null || lb === void 0 ? void 0 : lb.route_mode
  };
  displayLB.family = !lb.profile ? 'application' : lb.profile.family;
  delete displayLB.zone;
  displayLB.private_ips.forEach(function (private_ip) {
    return (0, _reserved_private_ips.formatReservedIPForClient)(req, private_ip);
  });
  return displayLB;
};

/*
 * Our init function creates two well known ACLs and a set of
 * random ACLs.
 */
exports.formatLoadBalancerForClient = formatLoadBalancerForClient;
var init = function init() {
  var loadbalancers = _server.db.getCollection(_server.COLS.load_balancers);
  if (!loadbalancers) {
    loadbalancers = _server.db.addCollection(_server.COLS.load_balancers);
  }
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  _common.initialData.forEach(function (initialLBData) {
    LoadBalancer(_objectSpread(_objectSpread({}, initialLBData), {}, {
      provisioning_status: 'active',
      operating_status: 'online'
    }), true);
  });
  LoadBalancer({
    id: 'LB009',
    name: 'lb009-cy-mock-test',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    pools: [{
      id: 'Pool012-ab',
      protocol: 'tcp',
      provisioning_status: 'active',
      proxy_protocol: 'v2',
      members: []
    }],
    subnets: [{
      id: 'subnet-1'
    }]
  });
  LoadBalancer({
    id: 'LB008',
    name: 'lb008-cy-mock-test',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    subnets: [{
      id: 'reserved-subnet-1'
    }],
    reservedIPData: {
      address: (0, _reserved_private_ips.createCustomReservedIpAddress)('reserved-subnet-1'),
      name: 'aaa-reservedIp-lb-custom-ip'
    }
  });
  LoadBalancer({
    id: 'LB111',
    name: 'lb111-mock-test',
    operating_status: 'online',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    pools: [],
    subnets: [{
      id: 'subnet-1'
    }]
  });
  LoadBalancer({
    id: 'LB00010',
    name: 'lb00010-mock-test',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    pools: [{
      id: 'Pool012-ab',
      name: 'a-pool-default',
      protocol: 'tcp',
      provisioning_status: 'active',
      proxy_protocol: 'v2',
      members: [{
        id: 'Member011',
        health: 'ok',
        target: {}
      }]
    }],
    subnets: [{
      id: 'subnet-1'
    }]
  });
  LoadBalancer({
    id: 'LB113',
    name: 'lb113-mock-test',
    operating_status: 'online',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    pools: [{
      id: 'Pool113-ab',
      name: 'test-pool',
      protocol: 'tcp',
      provisioning_status: 'active',
      proxy_protocol: 'v2',
      algorithm: 'round_robin',
      timeout: 10,
      delay: 12,
      members: [{
        id: 'Member112',
        health: 'ok',
        target: {}
      }]
    }],
    subnets: [{
      id: 'subnet-1'
    }]
  });
  LoadBalancer({
    id: 'LB005',
    name: 'lb005-mock-test',
    operating_status: 'online',
    provisioning_status: 'active',
    zone: 'us-east-1',
    family: 'application',
    pools: [{
      id: 'Pool005-ab',
      name: 'aaa-default-test-pool',
      protocol: 'tcp',
      provisioning_status: 'active',
      proxy_protocol: 'v2',
      algorithm: 'weighted_round_robin',
      members: [{
        id: 'Member005',
        health: 'ok',
        target: {}
      }]
    }],
    subnets: [{
      id: 'subnet-1'
    }]
  });
  utils.repeat(function () {
    LoadBalancer();
  }, 25);
};

/*
 * Get a list of load balancers
 */
exports.init = init;
var getLoadBalancers = function getLoadBalancers(req, res) {
  if (!req.query.limit) {
    req.query.limit = 65535;
  }
  var lbs = utils.getResources(req, _server.COLS.load_balancers);
  var displayedLBS = lodash.cloneDeep(lbs);
  displayedLBS.load_balancers = displayedLBS.load_balancers.map(function (lb) {
    return formatLoadBalancerForClient(req, lb);
  });
  res.json(displayedLBS).end();
};

/*
 * Get load balancer details
 */
exports.getLoadBalancers = getLoadBalancers;
var getLoadBalancer = function getLoadBalancer(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.id, res);
  if (!lb) {
    return;
  }
  res.json(formatLoadBalancerForClient(req, lb)).end();
};

/*
 * create load balancer
 */
exports.getLoadBalancer = getLoadBalancer;
var createLoadBalancer = function createLoadBalancer(req, res) {
  var input = req.body;
  if (!input.zone) {
    // create the load balancer based on the input region.
    input.zone = utils.findZoneInRegion(utils.getQueryRegion(req));
  }
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.load_balancers), input, req, res, 'resource with that name already exists', 'load_balancer')) {
    return;
  }
  input.provisioning_status = 'active';
  input.operating_status = 'online';
  if (input.pools !== undefined) {
    input.pools.forEach(function (pool) {
      if (!pool.provisioning_status) {
        pool.provisioning_status = 'active';
      }
    });
  }
  if (input.listeners !== undefined) {
    input.listeners.forEach(function (listener) {
      if (!listener.provisioning_status) {
        listener.provisioning_status = 'active';
      }
    });
  }
  var profiles = _server.db.getCollection(_server.COLS.LB_profiles).find({
    name: input.profile ? input.profile.name : ''
  });
  var profile = profiles && profiles.length > 0 ? profiles[0] : null;
  if (input.profile) {
    if (input.profile.name === 'network-private-path') {
      input.profile.family = 'network';
    }
    Object.assign(input.profile, profile);
  }
  var route_mode = input === null || input === void 0 ? void 0 : input.route_mode;
  if (typeof route_mode !== 'undefined') {
    Object.assign(input, {
      route_mode: route_mode
    });
  }
  /* validation for is_private_path */
  if (input.is_private_path && input.is_public) {
    res.status(400).end();
    return;
  }
  // insert lb
  var lb = LoadBalancer(input);
  if (!lb) {
    res.status(400).end();
    return;
  }
  (input.security_groups || []).forEach(function (sg) {
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    if (securityGroup.targets_lb) {
      securityGroup.targets_lb.push({
        id: lb.id
      });
    } else {
      securityGroup.targets_lb = [{
        id: lb.id
      }];
    }
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  res.status(201).json(formatLoadBalancerForClient(req, lb)).end();
};

/*
 * update load balancer
 */
exports.createLoadBalancer = createLoadBalancer;
var updateLoadBalancer = function updateLoadBalancer(req, res) {
  var _input$logging, _input$logging$datapa, _input$logging2, _input$logging2$datap, _lb$logging, _lb$logging$datapath, _input$logging3, _input$logging3$datap;
  var input = req.body;
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.load_balancers), input, req, res, 'resource with that name already exists', 'load_balancer')) {
    return;
  }
  var loadbalancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbs = loadbalancers.find({
    id: req.params.id
  });
  var lb = lbs && lbs[0];
  if (!lb) {
    res.status(404).end();
  }
  var lbID = lb.id;
  if (((_input$logging = input.logging) === null || _input$logging === void 0 ? void 0 : (_input$logging$datapa = _input$logging.datapath) === null || _input$logging$datapa === void 0 ? void 0 : _input$logging$datapa.active) !== undefined && !!((_input$logging2 = input.logging) !== null && _input$logging2 !== void 0 && (_input$logging2$datap = _input$logging2.datapath) !== null && _input$logging2$datap !== void 0 && _input$logging2$datap.active) === !!((_lb$logging = lb.logging) !== null && _lb$logging !== void 0 && (_lb$logging$datapath = _lb$logging.datapath) !== null && _lb$logging$datapath !== void 0 && _lb$logging$datapath.active)) {
    var msg = "There is nothing to update the load balancer with ID '".concat(lb.id, "'.");
    res.status(400).json(utils.generateErrors(msg, 'load_balancer_unchanged_update', 'logging.datapath.active')).end();
    return;
  }
  if (((_input$logging3 = input.logging) === null || _input$logging3 === void 0 ? void 0 : (_input$logging3$datap = _input$logging3.datapath) === null || _input$logging3$datap === void 0 ? void 0 : _input$logging3$datap.active) !== undefined) {
    lb.provisioning_status = _common.updatePending;
    setTimeout(function () {
      var lbu = utils.findResource(_server.COLS.load_balancers, lbID, null, false);
      if (!lbu) {
        return;
      }
      lbu.provisioning_status = _common.active;
      loadbalancers.update(lbu);
    }, 5000);
  }
  Object.assign(lb, input);
  loadbalancers.update(lb);
  res.status(200).json(formatLoadBalancerForClient(req, lb)).end();
};

/*
 * update load balancer
 */
exports.updateLoadBalancer = updateLoadBalancer;
var deleteLoadBalancer = function deleteLoadBalancer(req, res) {
  var _lb$security_groups;
  var lbID = req.params.id;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbs = load_balancers.find({
    id: lbID
  });
  var lb = lbs && lbs[0];
  if (!lb) {
    res.status(404).end();
    return;
  }
  if (_features.shouldGenerateLotsOfResources) {
    // not ready to fail this yet. using it for cascade delete testing.
    if (lb.provisioning_status === 'maintenance_pending') {
      res.status(400).json(utils.generateErrors('Cannot delete a load balancer in maintenance status', 'cannot_delete')).end();
      return;
    }
  }
  /* detach lb from sg */
  (_lb$security_groups = lb.security_groups) === null || _lb$security_groups === void 0 ? void 0 : _lb$security_groups.forEach(function (sg) {
    var _securityGroup$target;
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    securityGroup.targets_lb = (_securityGroup$target = securityGroup.targets_lb) === null || _securityGroup$target === void 0 ? void 0 : _securityGroup$target.filter(function (item) {
      return item.id !== lbID;
    });
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  load_balancers.remove(lb);
  res.status(204).end();
};
exports.deleteLoadBalancer = deleteLoadBalancer;