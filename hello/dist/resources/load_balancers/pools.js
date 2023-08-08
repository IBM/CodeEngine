"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateLoadBalancerPool = exports.getLoadBalancerPools = exports.getLoadBalancerPool = exports.deleteLoadBalancerPool = exports.createLoadBalancerPool = exports.addPool = void 0;
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _server = require("../../server");
var _members = require("./members");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
var lodash = require('lodash');
var algorithms = ['round_robin', 'weighted_round_robin', 'least_connections'];
var protocols = ['http', 'tcp'];
var sessionPersistentTypes = ['source_ip', 'http_cookie', 'app_cookie'];
var LBPoolHealthMonitor = function LBPoolHealthMonitor(data) {
  var poolHealthMonitor = {
    max_retries: casual.integer(1, 10),
    timeout: data.timeout || casual.integer(1, 60),
    type: casual.random_element(protocols),
    url_path: '/'
  };
  poolHealthMonitor.delay = data.delay || casual.integer(poolHealthMonitor.timeout + 1, 60);
  return poolHealthMonitor;
};
var LBPoolSessionPersistence = function LBPoolSessionPersistence(isInit) {
  return isInit ? {
    type: casual.random_element(sessionPersistentTypes),
    cookie_name: "".concat(casual.color_name, "-session-cookie")
  } : null;
};

/**
 * formatLoadBalancerPoolForClient()
 *
 * Takes a load balancer/load balancer pool and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} lb - raw load balancer from DB entry
 * * @param {*} lbp - load balancer pool
 */
var formatLoadBalancerPoolForClient = function formatLoadBalancerPoolForClient(req, lb, lbp) {
  var displayedLbp = lodash.cloneDeep(lbp);
  displayedLbp.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/pools/").concat(lbp.id);
  displayedLbp.members = lbp.members.map(function (member) {
    member.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/pools/").concat(lbp.id, "/members/").concat(member.id);
    return lodash.pick(member, ['id', 'href']);
  });
  if (displayedLbp.session_persistence && displayedLbp.session_persistence.type !== 'app_cookie') {
    delete displayedLbp.session_persistence.cookie_name;
  }
  delete displayedLbp.isNLB;
  return displayedLbp;
};

// eslint-disable-next-line default-param-last
var LBPool = function LBPool() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var isInit = arguments.length > 1 ? arguments[1] : undefined;
  var lbpMembers = (data.members || []).map(function (member) {
    return (0, _members.addMember)(member);
  });
  delete data.members;
  var pool = Object.assign({
    id: casual.uuid,
    name: data.name || "".concat(casual.color_name, "-Pool"),
    algorithm: casual.random_element(algorithms),
    health_monitor: LBPoolHealthMonitor(data),
    protocol: data.isNLB ? 'tcp' : casual.random_element(protocols),
    proxy_protocol: data.proxy_protocol || casual.random_element(_common.version),
    created_at: utils.generateCreateDate(),
    provisioning_status: casual.random_element(_common.provisioningStatuses),
    session_persistence: LBPoolSessionPersistence(isInit),
    members: lbpMembers
  }, data);
  if (data.isNLB) {
    delete pool.proxy_protocol;
  }
  return pool;
};

/*
 * Get load balancer pools
 */
var getLoadBalancerPools = function getLoadBalancerPools(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.id, res);
  if (!lb) {
    return;
  }
  var poolsForClient = lb.pools.map(function (lbp) {
    return formatLoadBalancerPoolForClient(req, lb, lbp);
  });
  res.json({
    pools: poolsForClient
  }).end();
};

/*
 * Get load balancer pool details
 */
exports.getLoadBalancerPools = getLoadBalancerPools;
var getLoadBalancerPool = function getLoadBalancerPool(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    return;
  }
  var lbp = lb.pools.find(function (lbPool) {
    return lbPool.id === req.params.id;
  });
  if (!lbp) {
    res.status(404).end();
    return;
  }
  res.json(formatLoadBalancerPoolForClient(req, lb, lbp)).end();
};
exports.getLoadBalancerPool = getLoadBalancerPool;
var addPool = function addPool(data, isInit) {
  var pool = LBPool(data, isInit);
  return pool;
};
exports.addPool = addPool;
var checkPoolNameExist = function checkPoolNameExist(res, existingPools, newName) {
  var results = lodash.find(existingPools, {
    name: newName
  });
  if (results) {
    res.status(400).json(utils.generateErrors('resource with that name already exists', 'conflict_field', 'load_balancer_pools')).end();
    return true;
  }
  return false;
};
var createLoadBalancerPool = function createLoadBalancerPool(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var pool = LBPool(input);
  pool.provisioning_status = _common.createPending;
  var lbID = req.params.load_balancer_id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  var lbpID = pool.id;
  if (loadBalancer) {
    if (loadBalancer.pools) {
      if (checkPoolNameExist(res, loadBalancer.pools, pool.name)) {
        return undefined;
      }
      loadBalancer.pools.push(pool);
    } else {
      loadBalancer.pools = [pool];
    }
    load_balancers.update(loadBalancer);
    setTimeout(function () {
      var lb = utils.findResource(_server.COLS.load_balancers, lbID, null, false);
      if (!lb) {
        return;
      }
      var lbp = lb.pools.find(function (p) {
        return p.id === lbpID;
      });
      if (!lbp) {
        return;
      }
      lbp.provisioning_status = _common.active;
      load_balancers.update(lb);
    }, 5000);
    return res.status(201).json(formatLoadBalancerPoolForClient(req, loadBalancer, pool)).end();
  }
  return res.status(404).end();
};
exports.createLoadBalancerPool = createLoadBalancerPool;
var deleteLoadBalancerPool = function deleteLoadBalancerPool(req, res) {
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lbpID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  if (loadBalancer) {
    var lbpIndex = lodash.findIndex(loadBalancer.pools, {
      id: lbpID
    });
    if (lbpIndex > -1) {
      loadBalancer.pools.splice(lbpIndex, 1);
      load_balancers.update(loadBalancer);
      return res.status(204).end();
    }
  }
  return res.status(404).end();
};
exports.deleteLoadBalancerPool = deleteLoadBalancerPool;
var updateLoadBalancerPool = function updateLoadBalancerPool(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lbpID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var lb = loadBalancers && loadBalancers[0];
  if (lb) {
    var lbp = lodash.find(lb.pools, {
      id: lbpID
    });
    if (!lbp) {
      return res.status(404).end();
    }
    if (lb.pools.find(function (pool) {
      return pool.id !== lbpID && pool.name === input.name;
    })) {
      res.status(400).json(utils.generateErrors('resource with that name already exists', 'conflict_field', 'load_balancer_pools')).end();
      return undefined;
    }
    Object.assign(lbp, input);
    load_balancers.update(lb);
    return res.status(200).json(formatLoadBalancerPoolForClient(req, lb, lbp)).end();
  }
  return res.status(404).end();
};
exports.updateLoadBalancerPool = updateLoadBalancerPool;