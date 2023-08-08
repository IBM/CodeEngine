"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateFloatingIp = exports.setFloatingIPTarget = exports.removeFloatingIPTarget = exports.init = exports.getFloatingIps = exports.getFloatingIp = exports.generateFipInZone = exports.formatFloatingIPTargetForClient = exports.deleteFloating = exports.createFloatingIp = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _network_interfaces = require("./network_interfaces");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var pools = [{
  octet: 244,
  idx: 0
}, {
  octet: 188,
  idx: 0
}, {
  octet: 10,
  idx: 0
}];

/*
 * Generate a floating IP from one of our floating IP pools randomly.
 */
var generateFip = function generateFip() {
  var pool = pools[casual.integer(0, pools.length - 1)];
  pool.idx += 1;
  if (pool.idx === 256) {
    pool.octet += 1;
    pool.idx = 1;
  }
  return "169.62.".concat(pool.octet, ".").concat(pool.idx);
};
var addFip = function addFip(fips, data) {
  var id = casual.uuid;
  var fip = Object.assign({
    id: id,
    crn: utils.generateCRN(),
    created_at: utils.generateCreateDate(),
    address: generateFip(),
    status: 'available',
    zone: utils.getRandomZone(),
    resource_group: {
      id: utils.getRandomResourceGroup()
    }
  }, data);
  if (!data.name) {
    fip.name = utils.generateName('fip', fip.zone);
  }
  fips.insert(fip);
  return id;
};

/*
 * Generate a new floating IP in the specified zone
 */
var generateFipInZone = function generateFipInZone(zone) {
  var fips = _server.db.addCollection(_server.COLS.floating_ips);
  var id = addFip(fips, {
    zone: zone
  });
  return fips.findOne({
    id: id
  });
};

/*
 * This is a helper function that can set the target of a floating IP.
 *
 * @param {string} fipId - the ID of the floating IP to add the target to
 * @param {string} target - the targer resource
 */
exports.generateFipInZone = generateFipInZone;
var setFloatingIPTarget = function setFloatingIPTarget(fipId, target) {
  var ip = utils.getResource(_server.COLS.floating_ips, fipId)[0];
  var fips = _server.db.getCollection(_server.COLS.floating_ips);
  utils.reserveResourceID(ip.id);
  fips.update(_objectSpread(_objectSpread({}, ip), {}, {
    target: target
  }));
};

/*
 * This is  helper function to remove the target from a floating IP and remove the
 * floating IP.
 *
 * @param {string} fipId - the ID of the floating IP to remove the target from
 * @param {Object} res - the requests's response object
 */
exports.setFloatingIPTarget = setFloatingIPTarget;
var removeFloatingIPTarget = function removeFloatingIPTarget(fipId, res) {
  var thisFip = utils.findResource(_server.COLS.floating_ips, fipId, res);
  var fips = _server.db.getCollection(_server.COLS.floating_ips);
  fips.remove(thisFip);
};

/*
 * This is a helper function to for the floating IP as a target for use in a client reponse.
 *
 * @param {string} req - the request object
 * @param {string} targetId - the ID of the target object associated with the floating IP to format
 */
exports.removeFloatingIPTarget = removeFloatingIPTarget;
var formatFloatingIPTargetForClient = function formatFloatingIPTargetForClient(req, targetId) {
  var fips = _server.db.getCollection(_server.COLS.floating_ips).chain().where(function (resource) {
    return resource.target && resource.target.id === targetId;
  }).data({
    removeMeta: true
  });
  if (fips.length === 0) {
    return null;
  }
  return {
    address: fips[0].address,
    href: "".concat(utils.getBaseApiUrl(req), "floating_ips/").concat(fips[0].id),
    id: fips[0].id,
    name: fips[0].name
  };
};
exports.formatFloatingIPTargetForClient = formatFloatingIPTargetForClient;
var init = function init() {
  var fips = _server.db.addCollection(_server.COLS.floating_ips);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addFip(fips, {
    id: '32d03a81-c292-434e-bf38-49dcf3ac242c',
    address: '168.61.5.8',
    name: 'default_test_fip_1'
  });
  addFip(fips, {
    id: '46128390-324a-43ab-9266-4deb3c15f51a',
    address: '168.61.5.9',
    name: 'default_test_fip_2'
  });
  utils.repeat(function () {
    addFip(fips, {});
  }, 50);
};
exports.init = init;
var formatTargetForClient = function formatTargetForClient(req, target) {
  var _nic, _nic2;
  // Adding guard condition around this so we don't query Lokijs with
  // invalid target type.
  if (!target) {
    return target;
  }
  var formatedTarget = _objectSpread({}, target);
  var nic;
  var basePath;
  switch (target.resource_type) {
    case 'network_interface':
      nic = utils.getResource(_server.COLS.network_interfaces, target.id)[0];
      basePath = _server.COLS.instances;
      if ((_nic = nic) !== null && _nic !== void 0 && _nic.interface_type) {
        basePath = 'bare_metal_servers';
      }
      formatedTarget.href = "".concat(utils.getBaseApiUrl(req)).concat(basePath, "/").concat((_nic2 = nic) === null || _nic2 === void 0 ? void 0 : _nic2.instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(target.id);
      break;
    case 'virtual_network_interface':
      formatedTarget.href = "".concat(utils.getBaseApiUrl(req), "virtual_network_interfaces/").concat(target.id);
      break;
    case 'public_gateway':
      formatedTarget.href = "".concat(utils.getBaseApiUrl(req), "public_gateways/").concat(target.id);
      break;
    default:
      formatedTarget.href = "".concat(utils.getBaseApiUrl(req)).concat(target.resource_type, "s/").concat(target.id);
  }
  return formatedTarget;
};
var getFloatingIps = function getFloatingIps(req, res) {
  var fips = utils.getResources(req, _server.COLS.floating_ips);
  fips.floating_ips.forEach(function (fip) {
    fip.href = "".concat(utils.getBaseUrl(req), "/floating_ips/").concat(fip.id);
    fip.crn = utils.updateResourceCrnRegion(fip, req);
    fip.target = formatTargetForClient(req, fip.target);
    fip.zone = utils.buildZoneReturnObject(req, fip.zone);
  });
  res.json(fips).end();
};
exports.getFloatingIps = getFloatingIps;
var createFloatingIp = function createFloatingIp(req, res) {
  var input = req.body;

  // We need to make sure a name was passed in if we run duplicateNameCheck since name is optional.
  // RIAS allows blank on this field
  if (input.name && utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.floating_ips), input, req, res, 'floating ip is already existed', 'floating_ip')) {
    return;
  }
  input.created_at = utils.generateNowDate();
  var vnic;
  var isNetworkInterfaceTarget = false;
  if (input.target && !input.target.id) {
    utils.validationFailure(res);
    return;
  }
  if (input.target && input.target.id) {
    var vnis = utils.getResource(_server.COLS.virtual_network_interfaces, input.target.id);
    var vnics = utils.getResource(_server.COLS.network_interfaces, input.target.id);
    if (vnis.length === 0 && vnics.length === 0) {
      res.status(404).json(utils.generateNotFoundError(input.target.id, 'floating_ip_target')).end();
      return;
    }
    if (vnis.length) {
      input.zone = vnis[0].zone;
      input.target = {
        id: vnis[0].id,
        name: vnis[0].name,
        primary_ip: vnis[0].primary_ip,
        href: "".concat(utils.getBaseApiUrl(req), "virtual_network_interfaces/").concat(vnis[0].id),
        crn: utils.generateCRN({
          region: req.query.region,
          'service-instance': vnis[0].id
        }),
        resource_type: 'virtual_network_interface'
      };
    } else {
      isNetworkInterfaceTarget = true;
      vnic = vnics[0];
      var vs = utils.findResource(_server.COLS.instances, vnic.instance_id);
      var bm = utils.findResource(_server.COLS.bm_instances, vnic.instance_id);
      var vnicHref = "".concat(utils.getBaseApiUrl(req)).concat(vs ? _server.COLS.instances : _server.COLS.bm_instances, "/").concat(vnic.instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic.id);
      input.zone = (vs || bm).zone;
      input.target = {
        // add the VNIC to floating IP
        href: vnicHref,
        id: vnic.id,
        name: vnic.name,
        primary_ipv4_address: vnic.primary_ipv4_address,
        subnet: vnic.subnet,
        resource_type: 'network_interface'
      };
    }
  } else if (!input.zone || !input.zone.name) {
    utils.validationFailure(res);
    return;
  }
  var id = addFip(_server.db.getCollection(_server.COLS.floating_ips), input);
  var fips = utils.findResource(_server.COLS.floating_ips, id, res, true);
  fips.href = "".concat(utils.getBaseUrl(req), "/").concat(fips.id);
  if (input.target && input.target.id && isNetworkInterfaceTarget) {
    (0, _network_interfaces.updateFipForVnic)(vnic.id, fips);
  }
  res.status(201).json(fips).end();
};
exports.createFloatingIp = createFloatingIp;
var getFloatingIp = function getFloatingIp(req, res) {
  var fip = _server.db.getCollection(_server.COLS.floating_ips).chain().where(function (resource) {
    return resource.id === req.params.fip_id || resource.address === req.params.fip_id;
  }).data({
    removeMeta: true
  });
  if (fip.length === 0) {
    res.status(404).end();
    return;
  }
  if (fip[0].target) {
    fip[0].target = formatTargetForClient(req, fip[0].target);
  }
  fip[0].zone = utils.buildZoneReturnObject(req, fip[0].zone);
  res.json(fip[0]).end();
};
exports.getFloatingIp = getFloatingIp;
var deleteFloating = function deleteFloating(req, res) {
  var thisFip = utils.findResource(_server.COLS.floating_ips, req.params.fip_id, res);
  // remove the floating ip from VNIC
  if (thisFip.target) {
    if (thisFip.target.resource_type === 'public_gateway') {
      /*
       * You aren't allowed to remove a floating IP associated with a public gateway.
       * UI-6093
       */
      var errors = [{
        code: 'floating_ip_in_use',
        message: 'The floating IP is in use.',
        more_info: 'https://cloud.ibm.com/docs/infrastructure/vpc/errors.html#floating_ip_in_use',
        target: {
          name: thisFip.target.id,
          type: 'Public Gateway'
        }
      }];
      res.status(409).json(errors).end();
      return;
    }
    if (thisFip.target.resource_type === 'network_interface') {
      (0, _network_interfaces.removeFipForVnic)(thisFip.target.id, res);
    }
  }
  var fips = _server.db.getCollection(_server.COLS.floating_ips);
  fips.remove(thisFip);
  res.status(204).end();
};
exports.deleteFloating = deleteFloating;
var updateFloatingIp = function updateFloatingIp(req, res) {
  var input = req.body;
  if (input.name) {
    if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.floating_ips), input, req, res, 'floating IP is already existed', 'floating IP')) {
      return;
    }
    _server.db.getCollection(_server.COLS.floating_ips).findAndUpdate({
      id: req.params.fip_id
    }, function (k) {
      k.name = input.name;
    });
  }
  var fip = utils.findResource(_server.COLS.floating_ips, req.params.fip_id, res);
  if (input.target) {
    var futurePGW = utils.getResource(_server.COLS.public_gateways, input.target.id);
    var futureVnic = utils.getResource(_server.COLS.network_interfaces, input.target.id);
    var futureVNI = utils.getResource(_server.COLS.virtual_network_interfaces, input.target.id);
    var currentFip = utils.getResource(_server.COLS.floating_ips, req.params.fip_id)[0];
    var existingPGW = currentFip.target && utils.getResource(_server.COLS.public_gateways, currentFip.target.id);
    var existingvnic = currentFip.target && utils.getResource(_server.COLS.network_interfaces, currentFip.target.id);
    if (futurePGW.length) {
      input.target = _objectSpread(_objectSpread({}, futurePGW.target), input.target);
      input.target = formatTargetForClient(req, input.target);
      // This code removes the fip from previous pgw before it is patched to new pgw
      if (existingPGW && existingPGW.length) {
        var gateways = _server.db.getCollection(_server.COLS.public_gateways);
        gateways.update(_objectSpread(_objectSpread({}, existingPGW[0]), {}, {
          floating_ip: {}
        }));
      }
      setFloatingIPTarget(fip.id, _objectSpread(_objectSpread({}, input.target), {}, {
        resource_type: 'public_gateway'
      }));
    } else if (futureVNI.length) {
      var href = "".concat(utils.getBaseApiUrl(req), "virtual_network_interfaces/").concat(futureVNI[0].id);
      input.target = _objectSpread(_objectSpread({}, input.target), {}, {
        name: futureVNI[0].name,
        href: href
      });
      setFloatingIPTarget(fip.id, _objectSpread(_objectSpread({}, input.target), {}, {
        resource_type: 'virtual_network_interface'
      }));
      // This code removes the fip from previous vnic before it is patched to new VNI
      if (existingvnic !== null && existingvnic !== void 0 && existingvnic.length) {
        var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
        vnics.update(_objectSpread(_objectSpread({}, existingvnic[0]), {}, {
          floating_ips: []
        }));
      }
    } else if (futureVnic.length > 0) {
      var basePath = _server.COLS.instances;
      if (futureVnic[0].interface_type) {
        basePath = 'bare_metal_servers';
      }
      var _href = "".concat(utils.getBaseApiUrl(req)).concat(basePath) + "/".concat(futureVnic[0].instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(futureVnic[0].id);
      input.target = _objectSpread(_objectSpread({}, input.target), {}, {
        name: futureVnic[0].name,
        href: _href
      });
      setFloatingIPTarget(fip.id, _objectSpread(_objectSpread({}, input.target), {}, {
        resource_type: 'network_interface'
      }));
      // This code removes the fip from previous vnic before it is patched to new vnic
      if (existingvnic && existingvnic.length) {
        var _vnics = _server.db.getCollection(_server.COLS.network_interfaces);
        _vnics.update(_objectSpread(_objectSpread({}, existingvnic[0]), {}, {
          floating_ips: []
        }));
      }
      (0, _network_interfaces.updateFipForVnic)(futureVnic[0].id, fip, res);
    }
  }
  var updatedFip = utils.findResource(_server.COLS.floating_ips, req.params.fip_id, res, true);
  updatedFip.href = "".concat(utils.getBaseUrl(req), "/").concat(updatedFip.id);
  updatedFip.zone = utils.buildZoneReturnObject(req, updatedFip.zone);
  res.status(200).json(updatedFip).end();
};
exports.updateFloatingIp = updateFloatingIp;