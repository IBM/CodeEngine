"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateDynamicRouteServerPeer = exports.updateDynamicRouteServer = exports.unbindDynamicRouteServerIp = exports.init = exports.getDynamicRouteServers = exports.getDynamicRouteServerRoutes = exports.getDynamicRouteServerRoute = exports.getDynamicRouteServerPeers = exports.getDynamicRouteServerPeer = exports.getDynamicRouteServerIps = exports.getDynamicRouteServerIp = exports.getDynamicRouteServer = exports.formatDynamicRouteServerForClient = exports.deleteDynamicRouteServerPeer = exports.deleteDynamicRouteServer = exports.createDynamicRouteServerPeer = exports.createDynamicRouteServer = exports.bindDynamicRouteServerIp = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _lodash = require("lodash");
var _reserved_private_ips = require("./reserved_private_ips");
var _casual = require("casual");
var _endpoint_gateways = require("./endpoint_gateways");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var healthStates = ['ok', 'degraded', 'faulted', 'inapplicable'];
var sourceIpState = ['admin_down', 'down', 'init', 'up'];
var lifecycleStates = ['deleting', 'failed', 'pending', 'stable', 'suspended', 'updating', 'waiting'];
var peerStatus = ['active', 'connect', 'established', 'idle', 'initializing', 'open_confirm', 'open_sent'];
var advertisedRouteTypes = ['redistributed_service_routes', 'redistributed_subnets', 'redistributed_user_routes'];

/*
 * This function formats the dynamic route server the client.  It sets up the
 * hrefs and fills in the details of related resources.
 */
var formatDynamicRouteServerForClient = function formatDynamicRouteServerForClient(req, server) {
  var _server$vpc;
  server.href = "".concat(utils.getBaseApiUrl(req), "/dynamic_route_servers/").concat(server.id);
  server.security_groups = server.security_groups.map(function (securityGroup) {
    return utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, securityGroup.id);
  });
  if ((_server$vpc = server.vpc) !== null && _server$vpc !== void 0 && _server$vpc.id) {
    var _server$vpc2;
    server.vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, (_server$vpc2 = server.vpc) === null || _server$vpc2 === void 0 ? void 0 : _server$vpc2.id);
  }
  var reservedIpTarget = (0, _reserved_private_ips.formatReservedIpTargetForClient)(req, server.id);
  if (reservedIpTarget) {
    server.ips = reservedIpTarget;
  } else {
    server.ips = [];
  }
  delete server.peers;
  delete server.routes;
  return server;
};
exports.formatDynamicRouteServerForClient = formatDynamicRouteServerForClient;
var getDynamicRouteServers = function getDynamicRouteServers(req, res) {
  var _servers$dynamic_rout;
  var servers = utils.getResources(req, _server.COLS.dynamic_route_servers);
  (_servers$dynamic_rout = servers.dynamic_route_servers) === null || _servers$dynamic_rout === void 0 ? void 0 : _servers$dynamic_rout.forEach(function (server) {
    return formatDynamicRouteServerForClient(req, server);
  });
  res.json(servers).end();
};
exports.getDynamicRouteServers = getDynamicRouteServers;
var getDynamicRouteServer = function getDynamicRouteServer(req, res) {
  var server = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find({
    id: req.params.server_id
  }).data({
    removeMeta: true
  });
  if (server.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(formatDynamicRouteServerForClient(req, server[0])).end();
};
exports.getDynamicRouteServer = getDynamicRouteServer;
var deleteDynamicRouteServer = function deleteDynamicRouteServer(req, res) {
  var _server$, _server$$peers, _server$0$security_gr;
  var server = _server.db.getCollection(_server.COLS.dynamic_route_servers).find({
    id: req.params.server_id
  });
  if (server.length === 0) {
    res.status(404).end();
    return;
  }
  if (((_server$ = server[0]) === null || _server$ === void 0 ? void 0 : (_server$$peers = _server$.peers) === null || _server$$peers === void 0 ? void 0 : _server$$peers.length) > 0) {
    res.status(400).json((0, utils.generateErrors)('Dynamic route server has 1 or more peers and cannot be deleted. Delete peers first.', 400, 'drs_in_use')).end();
    return;
  }
  /* detach server from sg */
  (_server$0$security_gr = server[0].security_groups) === null || _server$0$security_gr === void 0 ? void 0 : _server$0$security_gr.forEach(function (sg) {
    var _securityGroup$target;
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id, res);
    securityGroup.targets_drs = (_securityGroup$target = securityGroup.targets_drs) === null || _securityGroup$target === void 0 ? void 0 : _securityGroup$target.filter(function (item) {
      return item.id !== req.params.server_id;
    });
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  _server.db.getCollection(_server.COLS.dynamic_route_servers).findAndRemove({
    id: req.params.server_id
  });
  res.status(204).end();
};
exports.deleteDynamicRouteServer = deleteDynamicRouteServer;
var updateDynamicRouteServer = function updateDynamicRouteServer(req, res) {
  var input = req.body;
  var server = utils.findResource(_server.COLS.dynamic_route_servers, req.params.server_id, res, false);
  if (!server) return;
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.dynamic_route_servers), input, req, res, 'dynamic route server already exists', 'dynamic_route_server')) {
    return;
  }
  var updateableFields = ['name'];
  var inputFields = Object.keys(input);
  inputFields.forEach(function (oneField) {
    if (updateableFields.includes(oneField)) {
      server[oneField] = input[oneField];
    }
  });
  _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);

  // Get the updated resource and output it to the client.
  var result = utils.findResource(_server.COLS.dynamic_route_servers, req.params.server_id, res, true);
  res.status(200).json(result).end();
};
exports.updateDynamicRouteServer = updateDynamicRouteServer;
var createPeer = function createPeer(server) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var bfd = data.bfd || {
    role: casual.random_element(['active', 'disable', 'passive'])
  };
  bfd.sessions = server.ips.map(function (ip) {
    return {
      source_ip: {
        address: ip.address
      },
      state: casual.random_element(sourceIpState)
    };
  });
  var peer = _objectSpread(_objectSpread({
    name: utils.generateName('drs-peer'),
    ip: {
      address: utils.getRandomIpAddress()
    },
    asn: _casual.coin_flip ? casual.integer(64512, 65534) : casual.integer(23457, 64495)
  }, data), {}, {
    resource_type: 'dynamic_route_server_peer',
    password: '********',
    // pragma: allowlist secret
    created_at: utils.generateNowDate(),
    id: casual.uuid,
    href: '',
    lifecycle_state: casual.random_element(lifecycleStates),
    sessions: server.ips.map(function (ip) {
      return {
        source_ip: {
          address: ip.address
        },
        state: casual.random_element(peerStatus),
        time_since_established: casual.integer(1000, 99999999)
      };
    }),
    bfd: bfd
  });
  // Add routes that will be learned by the peer we just added

  utils.repeat(function () {
    var route = {
      as_path: [],
      created_at: utils.generateNowDate(),
      destination: utils.getRandomIpAddress(true),
      href: '',
      id: casual.uuid,
      peer: {
        href: '',
        id: peer.id,
        name: peer.name,
        resource_type: peer.resource_type
      },
      source_ip: {
        address: utils.getRandomIpAddress()
      },
      next_hop: {
        address: utils.getRandomIpAddress()
      },
      type: _casual.coin_flip ? 'learned' : casual.random_element(advertisedRouteTypes),
      resource_type: 'dynamic_route_server_route'
    };
    server.routes = server.routes.concat(route);
  }, casual.integer(4, 47));
  server.peers = server.peers.concat(peer);
  _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);
  return peer;
};
var createDynamicRouteServerPeer = function createDynamicRouteServerPeer(req, res) {
  var input = req.body;
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  if (!server) {
    res.status(404).end();
    return;
  }
  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  if (input.name && server.peers.some(function (peer) {
    return peer.name === input.name;
  })) {
    res.status(400).json((0, utils.generateErrors)('Dynamic Route Server peer already exists', 'conflict_field')).end();
    return;
  }
  if (input.asn && +input.asn === +server.asn) {
    res.status(400).json((0, utils.generateErrors)('Asn cannot be the same between peer and dynamic route server', 'conflict_field')).end();
    return;
  }
  var peer = createPeer(server, input);
  res.status(201).json(peer).end();
};
exports.createDynamicRouteServerPeer = createDynamicRouteServerPeer;
var deleteDynamicRouteServerPeer = function deleteDynamicRouteServerPeer(req, res) {
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  if (!server || !server.peers.some(function (peer) {
    return peer.id === req.params.peer_id;
  })) {
    res.status(404).end();
    return;
  }
  server.peers = server.peers.filter(function (peer) {
    return peer.id !== req.params.peer_id;
  });
  _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);
  res.status(204).end();
};
exports.deleteDynamicRouteServerPeer = deleteDynamicRouteServerPeer;
var updateDynamicRouteServerPeer = function updateDynamicRouteServerPeer(req, res) {
  var input = req.body;
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  if (!server || !server.peers.some(function (peer) {
    return peer.id === req.params.peer_id;
  })) {
    res.status(404).end();
    return;
  }
  server.peers = server.peers.map(function (peer) {
    if (peer.id === req.params.peer_id) {
      return _objectSpread(_objectSpread({}, peer), input);
    }
    return peer;
  });
  if (input.asn && +input.asn === +server.asn) {
    res.status(400).json((0, utils.generateErrors)('Asn cannot be the same between peer and dynamic route server', 'conflict_field')).end();
    return;
  }
  _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);
  res.status(200).end();
};
exports.updateDynamicRouteServerPeer = updateDynamicRouteServerPeer;
var addDynamicRouteServer = function addDynamicRouteServer(servers) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var fromInit = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var id = data.id || casual.uuid;
  var region = data.regionID || utils.getRandomRegion().name;
  var sub = utils.getRandomResourceInZone(_server.COLS.subnets, region);
  var name = data.name || utils.generateName('drs');
  var vpc = _server.db.getCollection(_server.COLS.vpcs).chain().where(function (v) {
    return v.id === sub.vpc.id;
  }).data({
    removeMeta: true
  })[0];
  var sgArray = _server.db.getCollection(_server.COLS.security_groups).chain().where(function (sg) {
    return sg.vpc.id === vpc.id;
  }).data({
    removeMeta: true
  });
  var sgs = data.security_groups || [casual.random_element(sgArray)];
  if ((0, _lodash.isEmpty)(data.ips)) {
    var subnetsInVPC = _server.db.getCollection(_server.COLS.subnets).chain().where(function (subnet) {
      return subnet.vpc.id === vpc.id;
    }).data({
      removeMeta: true
    });
    var randSubnet = casual.random_element(subnetsInVPC);
    // data.ips = isGeneratingIP ? generateReservedIpInSubnet(randSubnet) : [];
    data.ips = (0, _reserved_private_ips.generateReservedIpInSubnet)(randSubnet);
  }
  data.ips.forEach(function (oneReservedIp, index) {
    var reservedIP;
    if (oneReservedIp && oneReservedIp.id) {
      reservedIP = utils.getResource(_server.COLS.reserved_private_ips, oneReservedIp.id)[0];
      if (reservedIP) {
        data.ips[index] = reservedIP;
      }
    } else if (oneReservedIp.subnet) {
      var _reservedIP;
      var subnet = utils.getResource(_server.COLS.subnets, oneReservedIp.subnet.id)[0];
      reservedIP = (0, _reserved_private_ips.generateReservedIpInSubnet)(subnet, oneReservedIp)[0];
      data.ips[index].id = (_reservedIP = reservedIP) === null || _reservedIP === void 0 ? void 0 : _reservedIP.id;
    }
    if (reservedIP) {
      (0, _reserved_private_ips.setReservedIPTarget)(reservedIP.id, {
        id: id,
        name: name
      }, 'dynamic_route_server');
    }
  });
  var baseData = {
    created_at: utils.generateCreateDate(),
    crn: utils.generateCRN({
      region: region,
      'resource-type': 'dynamic-route-server',
      id: id
    }),
    href: '',
    // Placholder
    id: id,
    name: name,
    health_state: casual.random_element(healthStates),
    lifecycle_state: casual.random_element(lifecycleStates),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'dynamic_route_server',
    asn: casual.coin_flip ? casual.integer(64512, 65534) : casual.integer(4200000000, 4294967294),
    redistribute_service_routes: casual.coin_flip,
    redistribute_subnets: casual.coin_flip,
    redistribute_user_routes: casual.coin_flip,
    vpc: vpc,
    region: region,
    routes: [],
    peers: [],
    security_groups: sgs
  };
  var server = _objectSpread(_objectSpread({}, baseData), data);
  servers.insert(server);
  // update security groups targets field.
  (server.security_groups || []).forEach(function (sg) {
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id);
    if (securityGroup.targets_drs) {
      if (!securityGroup.targets_drs.find(function (item) {
        return item.id === id;
      })) {
        securityGroup.targets_drs.push({
          id: id
        });
      }
    } else {
      securityGroup.targets_drs = [{
        id: id
      }];
    }
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  if (fromInit) {
    if (casual.coin_flip) {
      utils.repeat(function () {
        createPeer(server, undefined, fromInit);
      }, casual.integer(1, 4));
    }
  }
  return id;
};
var init = function init() {
  var servers = _server.db.addCollection(_server.COLS.dynamic_route_servers);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addDynamicRouteServer(servers, {
    name: 'aaa-default-drs-1',
    id: 'aaaaaaaa-aaaa-aaaa-drs1-aaaaaaaaaaaa',
    health_state: healthStates[0],
    vpc: {
      id: 'vpc1001'
    },
    lifecycle_state: 'stable',
    region: 'us-east'
  }, true);
  addDynamicRouteServer(servers, {
    name: 'aaa-default-drs-2',
    id: 'aaaaaaaa-aaaa-aaaa-drs2-aaaaaaaaaaaa',
    health_state: healthStates[0],
    vpc: {
      id: 'vpc1002'
    },
    lifecycle_state: 'stable',
    region: 'us-east'
  }, true);
  utils.repeat(function () {
    addDynamicRouteServer(servers, undefined, true);
  }, _features.shouldGenerateLotsOfResources ? 60 : 15);
};
exports.init = init;
var createDynamicRouteServer = function createDynamicRouteServer(req, res) {
  var input = req.body;

  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  // RIAS allows blank on this field
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.dynamic_route_servers), input, req, res, 'Dynamic Route Server already exists', 'dynamic_route_server')) {
    return;
  }
  input.created_at = utils.generateNowDate();
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  var id = addDynamicRouteServer(_server.db.getCollection(_server.COLS.dynamic_route_servers), input);
  var servers = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  res.status(201).json(servers[0]).end();
};
exports.createDynamicRouteServer = createDynamicRouteServer;
var getDynamicRouteServerPeers = function getDynamicRouteServerPeers(req, res) {
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  if (!server) {
    res.status(404).end();
    return;
  }
  res.status(200).json({
    peers: server.peers
  }).end();
};
exports.getDynamicRouteServerPeers = getDynamicRouteServerPeers;
var getDynamicRouteServerPeer = function getDynamicRouteServerPeer(req, res) {
  var server = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find({
    id: req.params.server_id
  }).data({
    removeMeta: true
  });
  if (server.length === 0 || server.peers.some(function (peer) {
    return peer.id === req.params.peer_id;
  })) {
    res.status(404).end();
    return;
  }
  res.json(server.peers.find(function (peer) {
    return peer.id === req.params.peer_id;
  })).end();
};
exports.getDynamicRouteServerPeer = getDynamicRouteServerPeer;
var getDynamicRouteServerIps = function getDynamicRouteServerIps(req, res) {
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  if (!server) {
    res.status(404).end();
    return;
  }
  var reserved_ips = (0, _reserved_private_ips.formatReservedIpTargetForClient)(req, req.params.server_id);
  res.json({
    ips: reserved_ips
  }).end();
};
exports.getDynamicRouteServerIps = getDynamicRouteServerIps;
var getDynamicRouteServerIp = function getDynamicRouteServerIp(req, res) {
  var server = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find({
    id: req.params.server_id
  }).data({
    removeMeta: true
  });
  if (server.length === 0 || server.ips.some(function (ip) {
    return ip.id === req.params.ip_id;
  })) {
    res.status(404).end();
    return;
  }
  res.json({}).end();
};
exports.getDynamicRouteServerIp = getDynamicRouteServerIp;
var bindDynamicRouteServerIp = function bindDynamicRouteServerIp(req, res) {
  var server = utils.findResource(_server.COLS.dynamic_route_servers, req.params.server_id, res, false);
  var reservedIPId = req.params.ip_id;
  var reservedIp = utils.findResource(_server.COLS.reserved_private_ips, reservedIPId, res, false);
  if (!server || !server.id) return;
  if (!(0, _endpoint_gateways.isValidForIPInVPC)(server.vpc.id, [reservedIp])) {
    res.status(400).json(utils.generateErrors('The reserved ip is not in the vpc of the dynamic route server', 'invalid_reserved_ip', 'id', 'parameter')).end();
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
    if (server.ips) {
      server.ips.push(reservedIpWithSubnet);
    } else {
      server.ips = [reservedIpWithSubnet];
    }
    _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);
    (0, _reserved_private_ips.setReservedIPTarget)(reservedIp.id, {
      id: server.id,
      name: server.name
    }, 'dynamic_route_server');
  }

  // Get the updated reserved ip and output it to the client.

  var updatedReservedIP = utils.findResource(_server.COLS.reserved_private_ips, reservedIPId, res, true);
  res.status(201).json((0, _reserved_private_ips.formatReservedIPWithSubnet)(req, updatedReservedIP)).end();
};
exports.bindDynamicRouteServerIp = bindDynamicRouteServerIp;
var unbindDynamicRouteServerIp = function unbindDynamicRouteServerIp(req, res) {
  var server = utils.findResource(_server.COLS.dynamic_route_servers, req.params.server_id, res, false);
  if (!server || !server.id) return;
  var reservedIPId = req.params.ip_id;
  if (server.ips) {
    server.ips = server.ips.filter(function (oneReservedIp) {
      return oneReservedIp.id !== reservedIPId;
    });
    _server.db.getCollection(_server.COLS.dynamic_route_servers).update(server);
    (0, _reserved_private_ips.removeReservedIpTarget)(reservedIPId);
  }
  res.status(204).end();
};
exports.unbindDynamicRouteServerIp = unbindDynamicRouteServerIp;
var getDynamicRouteServerRoutes = function getDynamicRouteServerRoutes(req, res) {
  var server = (utils.getResource(_server.COLS.dynamic_route_servers, req.params.server_id) || [])[0];
  var routes = server.routes;
  if (req.query['peer.id']) {
    routes = routes.filter(function (route) {
      var _route$peer;
      return ((_route$peer = route.peer) === null || _route$peer === void 0 ? void 0 : _route$peer.id) === req.query['peer.id'];
    });
  }
  if (req.query.type) {
    routes = routes.filter(function (route) {
      return route.type === req.query.type;
    });
  }
  if (!server) {
    res.status(404).end();
    return;
  }
  res.status(200).json({
    total_count: routes.length,
    routes: routes
  }).end();
};
exports.getDynamicRouteServerRoutes = getDynamicRouteServerRoutes;
var getDynamicRouteServerRoute = function getDynamicRouteServerRoute(req, res) {
  var server = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find({
    id: req.params.server_id
  }).data({
    removeMeta: true
  });
  if (server.length === 0 || server.routes.some(function (route) {
    return route.id === req.params.route_id;
  })) {
    res.status(404).end();
    return;
  }
  res.json({}).end();
};
exports.getDynamicRouteServerRoute = getDynamicRouteServerRoute;