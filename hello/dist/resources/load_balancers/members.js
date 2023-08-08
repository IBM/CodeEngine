"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateLoadBalancerPoolMembers = exports.updateLoadBalancerPoolMember = exports.getLoadBalancerPoolMembers = exports.getLoadBalancerPoolMember = exports.deleteLoadBalancerPoolMember = exports.createLoadBalancerPoolMember = exports.addMember = void 0;
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _server = require("../../server");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var lodash = require('lodash');
var healths = ['ok', 'faulted', 'unknown'];
var LBPoolMember = function LBPoolMember() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var member = Object.assign({
    id: casual.uuid,
    href: '',
    target: {
      address: casual.ip
    },
    port: casual.integer(1, 65535),
    weight: casual.integer(0, 100),
    health: data.health || casual.random_element(healths),
    created_at: utils.generateCreateDate(),
    provisioning_status: casual.random_element(_common.provisioningStatuses.filter(function (item) {
      return item !== 'delete_pending';
    }))
  }, data);
  return member;
};

/**
 * getNetworkInterfaceForInstances()
 */
var getNetworkInterfaceForInstances = function getNetworkInterfaceForInstances(vnicId, req, res) {
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnicId, res);
  var href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(vnic.instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic.id);
  var subnet = vnic.subnet,
    id = vnic.id,
    name = vnic.name,
    primary_ipv4_address = vnic.primary_ipv4_address;
  var formattedSubnet = utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet.id);
  return {
    id: id,
    name: name,
    href: href,
    primary_ipv4_address: primary_ipv4_address,
    subnet: _objectSpread({}, formattedSubnet)
  };
};

/*
 * This function does the actual filtering and filters by a specific field and parameter.
 * This is just a way to reuse code for the different parameters.
 */
var filterBySubnetWithQuery = function filterBySubnetWithQuery(req, res, resource, queryParam, fieldName) {
  var primaryVnic = getNetworkInterfaceForInstances(lodash.get(resource, 'primary_network_interface').id, req, res);
  if (lodash.get(primaryVnic, fieldName) === queryParam) {
    return true;
  }
  var vnics = lodash.get(resource, 'network_interfaces');
  if (vnics.find(function (vnic) {
    var fullVnic = getNetworkInterfaceForInstances(vnic.id, req, res);
    return lodash.get(fullVnic, fieldName) === queryParam;
  })) {
    return true;
  }
  return false;
};

/**
 * formatLoadBalancerMemberForClient()
 *
 * Takes a load balancer/load balancer pool/member and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} lb - raw load balancer from DB entry
 * @param {*} lbp - load balancer pool
 * @param {*} lbpm - load balancer pool member
 */
var formatLoadBalancerMemberForClient = function formatLoadBalancerMemberForClient(req, res, lb, lbp, lbpm) {
  lbpm.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/pools/").concat(lbp.id, "/members/").concat(lbpm.id);
  var instances = utils.getResources(req, _server.COLS.instances, function (resource) {
    return filterBySubnetWithQuery(req, res, resource, lodash.get(lb, 'subnets[0].id'), 'subnet.id');
  });
  var pvns = instances.instances.map(function (resource) {
    var primaryVnic = getNetworkInterfaceForInstances(lodash.get(resource, 'primary_network_interface').id, req, res);
    return primaryVnic;
  });
  if (lb.family === 'application' && pvns[0]) {
    lodash.set(lbpm, 'target.address', pvns[0].primary_ipv4_address);
  }
  return lbpm;
};

/*
 * Get load balancer pool members
 */
var getLoadBalancerPoolMembers = function getLoadBalancerPoolMembers(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    return;
  }
  var lbp = lodash.find(lb.pools, {
    id: req.params.pool_id
  });
  if (!lbp) {
    res.status(404).end();
    return;
  }
  var lbpms = lbp.members || [];
  var membersForClient = lbpms.map(function (member) {
    return formatLoadBalancerMemberForClient(req, res, lb, lbp, member);
  });
  res.json({
    members: membersForClient
  }).end();
};

/*
 * Get load balancer pool member details
 */
exports.getLoadBalancerPoolMembers = getLoadBalancerPoolMembers;
var getLoadBalancerPoolMember = function getLoadBalancerPoolMember(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    return;
  }
  var lbp = lodash.find(lb.pools, {
    id: req.params.pool_id
  });
  if (!lbp) {
    res.status(404).end();
    return;
  }
  var lbpm = lodash.find(lbp.members, {
    id: req.params.id
  });
  if (!lbpm) {
    res.status(404).end();
    return;
  }
  res.json(formatLoadBalancerMemberForClient(req, res, lb, lbp, lbpm)).end();
};
exports.getLoadBalancerPoolMember = getLoadBalancerPoolMember;
var addMember = function addMember(data) {
  var member = LBPoolMember(data);
  return member;
};
exports.addMember = addMember;
var createLoadBalancerPoolMember = function createLoadBalancerPoolMember(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var lb = loadBalancers && loadBalancers[0];
  if (!lb) {
    res.status(404).end();
    return;
  }
  var lbp = lodash.find(lb.pools, {
    id: req.params.pool_id
  });
  if (!lbp) {
    res.status(404).end();
    return;
  }
  var member = LBPoolMember(input);
  if (lbp.members) {
    lbp.members.push(member);
  } else {
    lbp.members = [member];
  }
  load_balancers.update(lb);
  res.status(201).json(formatLoadBalancerMemberForClient(req, res, lb, lbp, member)).end();
};
exports.createLoadBalancerPoolMember = createLoadBalancerPoolMember;
var deleteLoadBalancerPoolMember = function deleteLoadBalancerPoolMember(req, res) {
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lbpID = req.params.pool_id;
  var lbpmID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var lb = loadBalancers && loadBalancers[0];
  if (lb) {
    var lbp = lodash.find(lb.pools, {
      id: lbpID
    });
    if (lbp) {
      var lbpmIndex = lodash.findIndex(lbp.members, {
        id: lbpmID
      });
      if (lbpmIndex > -1) {
        lbp.members.splice(lbpmIndex, 1);
        load_balancers.update(lb);
        return res.status(204).end();
      }
    }
  }
  return res.status(404).end();
};
exports.deleteLoadBalancerPoolMember = deleteLoadBalancerPoolMember;
var updateLoadBalancerPoolMember = function updateLoadBalancerPoolMember(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lbpID = req.params.pool_id;
  var lbpmID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var lb = loadBalancers && loadBalancers[0];
  if (lb) {
    var lbpool = lodash.find(lb.pools, {
      id: lbpID
    });
    if (lbpool) {
      var lbpm = lodash.find(lbpool.members, {
        id: lbpmID
      });
      if (!lbpm) {
        return res.status(404).end();
      }
      Object.assign(lbpm, input);
      load_balancers.update(lb);
      return res.status(200).json(formatLoadBalancerMemberForClient(req, res, lb, lbpool, lbpm)).end();
    }
  }
  return res.status(404).end();
};
exports.updateLoadBalancerPoolMember = updateLoadBalancerPoolMember;
var updateLoadBalancerPoolMembers = function updateLoadBalancerPoolMembers(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lbpID = req.params.pool_id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var lb = loadBalancers && loadBalancers[0];
  if (lb) {
    var lbpool = lodash.find(lb.pools, {
      id: lbpID
    });
    if (lbpool) {
      lbpool.members = [];
      input.members.forEach(function (member) {
        var lbpm = LBPoolMember(member);
        lbpool.members.push(lbpm);
      });
      load_balancers.update(lb);
      var membersForClient = lbpool.members.map(function (member) {
        return formatLoadBalancerMemberForClient(req, res, lb, lbpool, member);
      });
      res.status(202).json({
        members: membersForClient
      }).end();
    }
  }
  return res.status(404).end();
};
exports.updateLoadBalancerPoolMembers = updateLoadBalancerPoolMembers;