"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updatePublicGateway = exports.init = exports.getPublicGateways = exports.getPublicGateway = exports.formatPublicGatewayForClient = exports.deletePublicGateway = exports.createPublicGateway = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _floating_ips = require("./floating_ips");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
var addPG = function addPG(gateways, data) {
  var id = data.id ? data.id : casual.uuid;
  var fip;
  if (data.floating_ip && (data.floating_ip.id || data.floating_ip.address)) {
    if (data.floating_ip && data.floating_ip.id) {
      fip = utils.getResource(_server.COLS.floating_ips, data.floating_ip.id)[0];
    } else if (data.floating_ip && data.floating_ip.address) {
      fip = _server.db.getCollection(_server.COLS.floating_ips).chain().find({
        address: data.floating_ip.address
      });
    }
  } else {
    var _data$zone;
    if (data.vpc) {
      fip = (0, _floating_ips.generateFipInZone)(utils.findZone(data.vpc.zone.name));
    } else if ((_data$zone = data.zone) !== null && _data$zone !== void 0 && _data$zone.name) {
      fip = (0, _floating_ips.generateFipInZone)(utils.findZone(data.zone.name));
    } else {
      fip = utils.getRandomUniqueResource(_server.COLS.floating_ips);
    }
    data.floating_ip = fip;
  }
  var vpc = data.vpc ? data.vpc : utils.getRandomUniqueResource(_server.COLS.vpcs);
  var pg = Object.assign({
    id: id,
    created_at: utils.generateCreateDate(),
    status: 'available',
    vpc: vpc,
    zone: utils.findZone(vpc.zone.name),
    resource_group: {
      id: utils.getRandomResourceGroup()
    }
  }, data);
  if (!data.name) {
    pg.name = utils.generateName('public-gateway', pg.zone);
  }
  gateways.insert(pg);
  var thisPGW = utils.getResource(_server.COLS.public_gateways, id)[0];
  (0, _floating_ips.setFloatingIPTarget)(fip.id, {
    id: thisPGW.id,
    name: thisPGW.name,
    resource_type: 'public_gateway'
  });
  return id;
};
var init = function init() {
  var gateways = _server.db.addCollection(_server.COLS.public_gateways);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var fip = _server.db.getCollection(_server.COLS.floating_ips).find({
    address: '168.61.5.8'
  })[0];
  addPG(gateways, {
    name: 'aaa-default-public-gateway-1',
    id: 'a56cf208-d9ed-40bf-93bf-044000104547',
    zone: utils.findZone(utils.getDefaultZone()),
    floating_ip: fip,
    vpc: {
      name: 'aaa-default-vpc-1',
      classic_access: true,
      id: 'vpc1001',
      resource_group: {
        id: '5018a8564e8120570150b0764d39ebcc'
      },
      created_at: utils.generateCreateDate(),
      zone: utils.findZone(utils.getDefaultZone())
    }
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-2',
    id: 'cb0c0923-fe82-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone()),
    vpc: {
      name: 'aaa-default-vpc-2',
      classic_access: true,
      id: 'vpc1002',
      created_at: utils.generateCreateDate(),
      zone: utils.findZone(utils.getDefaultZone())
    }
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-3',
    id: 'cb0c0923-dr43-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-4',
    id: 'cb0c0923-dr43-4adc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-5',
    id: 'cb0c0923-dr43-4bac-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-6',
    id: 'cb0c0923-dr43-4bda-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-7',
    id: 'cb0c0923-ds43-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-8',
    id: 'cb0c0923-dt43-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-9',
    id: 'cb0c0923-du43-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-10',
    id: 'cb0c0923-dv43-4bdc-87ba-8795522735cc',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addPG(gateways, {
    name: 'aaa-default-public-gateway-delete',
    zone: utils.findZone(utils.getDefaultZone())
  });
  utils.repeat(function () {
    addPG(gateways, {
      zone: utils.findZone(utils.getDefaultZone())
    });
  }, 1);
};

/*
 * This function formats the public gateway for the client.  It sets up the
 * hrefs and fills in the details of the zone, vpc, and floating IP.
 */
exports.init = init;
var formatPublicGatewayForClient = function formatPublicGatewayForClient(req, gateway) {
  gateway.href = "".concat(utils.getBaseApiUrl(req), "public_gateways/").concat(gateway.id);
  gateway.zone = utils.buildZoneReturnObject(req, gateway.zone);
  gateway.vpc = {
    crn: utils.generateCRN(),
    href: "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(gateway.vpc.id),
    id: gateway.vpc.id,
    name: gateway.vpc.name
  };
  gateway.floating_ip = (0, _floating_ips.formatFloatingIPTargetForClient)(req, gateway.id);
};
exports.formatPublicGatewayForClient = formatPublicGatewayForClient;
var getPublicGateways = function getPublicGateways(req, res) {
  var gateways = utils.getResources(req, _server.COLS.public_gateways);
  gateways.public_gateways.forEach(function (gateway) {
    return formatPublicGatewayForClient(req, gateway);
  });
  res.json(gateways).end();
};
exports.getPublicGateways = getPublicGateways;
var getPublicGateway = function getPublicGateway(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.public_gateways).chain().find({
    id: req.params.gateway_id
  }).data({
    removeMeta: true
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }
  formatPublicGatewayForClient(req, gateway[0]);
  res.json(gateway[0]).end();
};
exports.getPublicGateway = getPublicGateway;
var deletePublicGateway = function deletePublicGateway(req, res) {
  var gateway = _server.db.getCollection(_server.COLS.public_gateways).find({
    id: req.params.gateway_id
  });
  if (gateway.length === 0) {
    res.status(404).end();
    return;
  }

  /*
   * We need to call the floating IP to remove the reference to this floating
   * IP so it can get associated with a different target.
   */
  (0, _floating_ips.removeFloatingIPTarget)(gateway[0].floating_ip.id, res);
  _server.db.getCollection(_server.COLS.public_gateways).findAndRemove({
    id: req.params.gateway_id
  });
  res.status(204).end();
};
exports.deletePublicGateway = deletePublicGateway;
var updatePublicGateway = function updatePublicGateway(req, res) {
  var input = req.body;
  var gateway = utils.findResource(_server.COLS.public_gateways, req.params.gateway_id, res, false);
  if (!gateway) return;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.public_gateways), input, req, res, 'public gateway already exists', 'public_gateway')) {
    return;
  }

  // Update the public gateway name
  gateway.name = input.name || gateway.name;
  _server.db.getCollection(_server.COLS.public_gateways).update(gateway);

  // Get the updated PGW and output it to the client.
  var resultPGW = utils.findResource(_server.COLS.public_gateways, req.params.gateway_id, res, true);
  res.status(200).json(resultPGW).end();
};
exports.updatePublicGateway = updatePublicGateway;
var createPublicGateway = function createPublicGateway(req, res) {
  var input = req.body;

  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  // RIAS allows blank on this field
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.public_gateways), input, req, res, 'public gateway is already existed', 'public_gateway')) {
    return;
  }
  if (utils.objectRefCheck(_server.COLS.vpcs, input.vpc.id, res)) {
    return;
  }
  if (input.floating_ip && input.floating_ip.address && utils.floatingIPRefCheck(input.floating_ip.address, res)) {
    return;
  }
  input.created_at = utils.generateNowDate();
  if (input.floating_ip && input.floating_ip.address) {
    input.floating_ip = _server.db.getCollection(_server.COLS.floating_ips).find({
      address: input.floating_ip.address
    })[0];
  }
  input.vpc = _server.db.getCollection(_server.COLS.vpcs).find({
    id: input.vpc.id
  })[0];
  input.zone = utils.findZone(input.zone.name);
  var id = addPG(_server.db.getCollection(_server.COLS.public_gateways), input);
  var gateways = _server.db.getCollection(_server.COLS.public_gateways).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  formatPublicGatewayForClient(req, gateways[0]);
  res.status(201).json(gateways[0]).end();
};
exports.createPublicGateway = createPublicGateway;