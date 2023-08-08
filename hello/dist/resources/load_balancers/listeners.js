"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateLoadBalancerListener = exports.getLoadBalancerListeners = exports.getLoadBalancerListener = exports.deleteLoadBalancerListener = exports.createLoadBalancerListener = exports.addListener = void 0;
var utils = _interopRequireWildcard(require("../../utils"));
var _common = require("./common");
var _policies = require("./policies");
var _certificates = _interopRequireDefault(require("./certificates"));
var _server = require("../../server");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var lodash = require('lodash');
var Listener = function Listener() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var pools = data.pools || [];
  var port = data.port || data.port_min || casual.integer(1, 29999);
  var listener = Object.assign({
    id: casual.uuid,
    name: "".concat(casual.color_name, "-Listener"),
    connection_limit: data.isNLB ? 0 : data.connection_limit || casual.integer(1, 15000),
    protocol: data.isNLB ? 'tcp' : data.protocol || casual.random_element(data.pools.map(function (pool) {
      return pool.protocol;
    })),
    port: port,
    port_min: port,
    port_max: data.port_max || data.port || data.port_min || casual.integer(30000, 65535),
    created_at: utils.generateCreateDate(),
    provisioning_status: casual.random_element(_common.provisioningStatuses),
    accept_proxy_protocol: !!data.accept_proxy_protocol
  }, data);
  if (data.isNLB) {
    delete listener.accept_proxy_protocol;
  }
  if (listener.protocol !== 'tcp') {
    listener.policies = data.policies ? data.policies.map(function (policy) {
      return (0, _policies.addPolicy)(policy, pools);
    }) : [];
  }
  if (data.default_pool) {
    var filter = {};
    if (data.default_pool.name) {
      filter.name = data.default_pool.name;
    } else {
      filter.id = data.default_pool.id;
    }
    var poolRef = lodash.find(pools, filter);
    listener.default_pool = poolRef;
  } else {
    var poolProtocol = listener.protocol === 'https' ? 'http' : listener.protocol;
    var filteredPools = pools.filter(function (pool) {
      return pool.protocol === poolProtocol;
    });
    listener.default_pool = casual.random_element(filteredPools);
  }
  if (listener.protocol === 'https' && !listener.certificate_instance) {
    listener.certificate_instance = {
      crn: casual.random_element(_certificates["default"]).crn
    };
  }
  delete listener.pools;
  return listener;
};

/**
 * formatLoadBalancerListenerForClient()
 *
 * Takes a load balancer/load balancer pool and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} lb - raw load balancer from DB entry
 * @param {*} lbl - load balancer listener
 */
var formatLoadBalancerListenerForClient = function formatLoadBalancerListenerForClient(req, res, lb, lbl) {
  var displayedLbl = lodash.cloneDeep(lbl);
  displayedLbl.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/listeners/").concat(lbl.id);
  var default_pool = displayedLbl.default_pool;
  if (default_pool) {
    var dbLb = (0, _common.getLoadBalancerFromDB)(lb.id, res);
    if (dbLb) {
      var dbLbp = dbLb.pools.find(function (lbPool) {
        return lbPool.id === default_pool.id;
      });
      displayedLbl.default_pool = lodash.pick(dbLbp, ['id', 'name']);
      displayedLbl.default_pool.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/pools/").concat(default_pool.id);
    }
  }
  if (displayedLbl.policies) {
    displayedLbl.policies.map(function (policy) {
      policy.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(lb.id, "/listeners/").concat(lbl.id, "/policies/").concat(policy.id);
      return lodash.pick(policy, ['id', 'href']);
    });
  }
  delete displayedLbl.isNLB;
  return displayedLbl;
};

/*
 * Get load balancer listeners
 */
var getLoadBalancerListeners = function getLoadBalancerListeners(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.id, res);
  if (!lb) {
    return;
  }
  var listenersForClient = lb.listeners.map(function (lbp) {
    return formatLoadBalancerListenerForClient(req, res, lb, lbp);
  });
  res.json({
    listeners: listenersForClient
  }).end();
};

/*
 * Get load balancer listener details
 */
exports.getLoadBalancerListeners = getLoadBalancerListeners;
var getLoadBalancerListener = function getLoadBalancerListener(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.load_balancer_id, res);
  if (!lb) {
    return;
  }
  var lbl = lb.listeners.find(function (lbListener) {
    return lbListener.id === req.params.id;
  });
  if (!lbl) {
    res.status(404).end();
    return;
  }
  res.json(formatLoadBalancerListenerForClient(req, res, lb, lbl)).end();
};
exports.getLoadBalancerListener = getLoadBalancerListener;
var createLoadBalancerListener = function createLoadBalancerListener(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  if (loadBalancer) {
    var isNLB = !!(loadBalancer.profile && loadBalancer.profile.name);
    var listener = Listener(_objectSpread(_objectSpread({}, input), {}, {
      pools: loadBalancer.pools,
      isNLB: isNLB
    }));
    // if no polices passed, no need to create polices
    if (!input.policies) delete listener.policies;
    // if no default_pool passed, no need to create default pool
    if (!input.default_pool) delete listener.default_pool;
    var lblID = listener.id;
    listener.provisioning_status = _common.createPending;
    if (loadBalancer.listeners) {
      loadBalancer.listeners.push(listener);
    } else {
      loadBalancer.listeners = [listener];
    }
    load_balancers.update(loadBalancer);
    setTimeout(function () {
      var lb = utils.findResource(_server.COLS.load_balancers, lbID, null, false);
      if (!lb) {
        return;
      }
      var lbl = lb.listeners.find(function (l) {
        return l.id === lblID;
      });
      if (!lbl) {
        return;
      }
      lbl.provisioning_status = _common.active;
      load_balancers.update(lb);
    }, 5000);
    return res.status(201).json(formatLoadBalancerListenerForClient(req, res, loadBalancer, listener)).end();
  }
  return res.status(404).end();
};
exports.createLoadBalancerListener = createLoadBalancerListener;
var updateLoadBalancerListener = function updateLoadBalancerListener(req, res) {
  var input = req.body;
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lblID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  if (loadBalancer) {
    var lbl = lodash.find(loadBalancer.listeners, {
      id: lblID
    });
    if (!lbl) {
      return res.status(404).end();
    }
    if (!input.port_min && input.port) {
      input.port_min = input.port;
    }
    if (!input.port && input.port_min) {
      input.port = input.port_min;
    }
    if (!input.port_max) {
      input.port_max = input.port_min || input.port;
    }
    Object.assign(lbl, input);
    load_balancers.update(loadBalancer);
    return res.status(200).json(formatLoadBalancerListenerForClient(req, res, loadBalancer, lbl)).end();
  }
  return res.status(404).end();
};
exports.updateLoadBalancerListener = updateLoadBalancerListener;
var deleteLoadBalancerListener = function deleteLoadBalancerListener(req, res) {
  var load_balancers = _server.db.getCollection(_server.COLS.load_balancers);
  var lbID = req.params.load_balancer_id;
  var lblID = req.params.id;
  var loadBalancers = load_balancers.find({
    id: lbID
  });
  var loadBalancer = loadBalancers && loadBalancers[0];
  if (loadBalancer) {
    var lblIndex = lodash.findIndex(loadBalancer.listeners, {
      id: lblID
    });
    if (lblIndex > -1) {
      loadBalancer.listeners.splice(lblIndex, 1);
      load_balancers.update(loadBalancer);
      return res.status(204).end();
    }
  }
  return res.status(404).end();
};
exports.deleteLoadBalancerListener = deleteLoadBalancerListener;
var addListener = function addListener(data) {
  var listener = Listener(data);
  return listener;
};
exports.addListener = addListener;