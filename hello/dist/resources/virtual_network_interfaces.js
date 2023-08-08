"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateVNI = exports.setVNIip = exports.setVNIFloatingIp = exports.init = exports.getVNIs = exports.getVNIips = exports.getVNIip = exports.getVNIFloatingIps = exports.getVNIFloatingIp = exports.getVNI = exports.deleteVNIip = exports.deleteVNIFloatingIp = exports.deleteVNI = exports.createVNI = exports.addVNI = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _reserved_private_ips = require("./reserved_private_ips");
var _floating_ips = require("./floating_ips");
var _features = require("./features");
var _excluded = ["id", "subnet", "name", "primary_ip", "ips", "target", "security_groups"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var lodash = require('lodash');
var VNIStatuses = ['failed', 'deleting', 'pending', 'stable', 'suspended', 'updating', 'waiting'];
var formatVNIForClient = function formatVNIForClient(req, vni) {
  if (vni) {
    var _vniData$target, _vni$subnet, _vniData$primary_ip, _vniData$ips, _vniData$zone, _vniData$zone2;
    var vniData = lodash.cloneDeep(vni);
    var region = req.query.region;
    vniData.crn = utils.generateCRN({
      region: region,
      'service-instance': vni.id
    });
    vniData.href = "".concat(utils.getBaseApiUrl(req), "virtual_network_interfaces/").concat(vni.id);
    if (((_vniData$target = vniData.target) === null || _vniData$target === void 0 ? void 0 : _vniData$target.resource_type) === 'share_mount_target') {
      var fileShare = _server.db.getCollection(_server.COLS.file_shares).chain().where(function (resource) {
        var _resource$mount_targe;
        return !!((_resource$mount_targe = resource.mount_targets) !== null && _resource$mount_targe !== void 0 && _resource$mount_targe.find(function (t) {
          return t.id === vniData.target.id;
        }));
      }).data({
        removeMeta: true
      });
      if (fileShare !== null && fileShare !== void 0 && fileShare.length) {
        var _fileShare$;
        vniData.target.href = "".concat(utils.getBaseApiUrl(req), "shares/").concat((_fileShare$ = fileShare[0]) === null || _fileShare$ === void 0 ? void 0 : _fileShare$.id, "/mount_targets/").concat(vniData.target.id);
      }
    }
    vniData.subnet = utils.formatResourceLinkForClient(req, 'subnets', vniData.subnet);
    vniData.primary_ip = {
      id: vniData.primary_ip.id,
      name: vniData.primary_ip.name,
      href: "".concat(utils.getBaseApiUrl(req), "subnets/").concat((_vni$subnet = vni.subnet) === null || _vni$subnet === void 0 ? void 0 : _vni$subnet.id, "/reserved_ips/").concat((_vniData$primary_ip = vniData.primary_ip) === null || _vniData$primary_ip === void 0 ? void 0 : _vniData$primary_ip.id),
      resource_type: 'subnet_reserved_ip',
      address: vniData.primary_ip.address
    };
    vniData.ips = (_vniData$ips = vniData.ips) === null || _vniData$ips === void 0 ? void 0 : _vniData$ips.map(function (ip) {
      var _vni$subnet2;
      return {
        id: ip.id,
        name: ip.name,
        href: "".concat(utils.getBaseApiUrl(req), "subnets/").concat((_vni$subnet2 = vni.subnet) === null || _vni$subnet2 === void 0 ? void 0 : _vni$subnet2.id, "/reserved_ips/").concat(ip === null || ip === void 0 ? void 0 : ip.id),
        resource_type: 'subnet_reserved_ip',
        address: ip.address
      };
    });
    vniData.zone = {
      href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(region, "/zones/").concat((_vniData$zone = vniData.zone) === null || _vniData$zone === void 0 ? void 0 : _vniData$zone.name),
      name: (_vniData$zone2 = vniData.zone) === null || _vniData$zone2 === void 0 ? void 0 : _vniData$zone2.name
    };

    // Security Group Ref
    var allSGs = _server.db.getCollection(_server.COLS.security_groups).chain().data();
    var securityGroups = allSGs.filter(function (sg) {
      var _sg$targets_vni;
      return (_sg$targets_vni = sg.targets_vni) === null || _sg$targets_vni === void 0 ? void 0 : _sg$targets_vni.some(function (vniData2) {
        return vniData2.id === vniData.id;
      });
    });
    if (securityGroups && securityGroups.length > 0) {
      vniData.security_groups = securityGroups.map(function (securityGroup) {
        return utils.formatResourceLinkForClient(req, _server.COLS.security_groups, securityGroup);
      });
    } else {
      delete vniData.security_groups;
    }
    // vniData.security_groups = vniData.security_groups.map(item =>
    //   utils.formatResourceLinkForClient(req, 'security-groups', item));
    vniData.vpc = utils.formatResourceLinkForClient(req, 'vpcs', vniData.vpc);
    return vniData;
  }
  return null;
};
var formatVNIipForClient = function formatVNIipForClient(req, ip) {
  if (ip) {
    return {
      id: ip.id,
      name: ip.name,
      href: "".concat(utils.getBaseApiUrl(req), "subnets/").concat(ip.subnetId, "/reserved_ips/").concat(ip === null || ip === void 0 ? void 0 : ip.id),
      resource_type: 'subnet_reserved_ip',
      address: ip.address
    };
  }
  return null;
};
var formatVNIFipForClient = function formatVNIFipForClient(req, fip) {
  if (fip) {
    return {
      id: fip.id,
      name: fip.name,
      href: "".concat(utils.getBaseUrl(req), "floating_ips/").concat(fip.id),
      address: fip.address,
      crn: utils.updateResourceCrnRegion(fip, req)
    };
  }
  return null;
};
var removeVNIfips = function removeVNIfips(vniId) {
  var floatingIPsCols = _server.db.getCollection(_server.COLS.floating_ips);
  var currentVNIFloatingIps = floatingIPsCols.chain().where(function (resource) {
    var _resource$target;
    return ((_resource$target = resource.target) === null || _resource$target === void 0 ? void 0 : _resource$target.id) === vniId;
  }).data({
    removeMeta: false
  });
  if (currentVNIFloatingIps.length) {
    currentVNIFloatingIps.forEach(function (fip) {
      delete fip.target;
      floatingIPsCols.update(fip);
    });
  }
};
var removeVNIsgs = function removeVNIsgs(vniId) {
  var sgsCols = _server.db.getCollection(_server.COLS.security_groups);
  var currentVNIsgs = sgsCols.chain().where(function (resource) {
    var _resource$targets_vni;
    return !!((_resource$targets_vni = resource.targets_vni) !== null && _resource$targets_vni !== void 0 && _resource$targets_vni.find(function (item) {
      return item.id === vniId;
    }));
  }).data({
    removeMeta: false
  });
  if (currentVNIsgs.length) {
    currentVNIsgs.forEach(function (sg) {
      var updatedVNIsg = _objectSpread(_objectSpread({}, sg), {}, {
        targets_vni: sg.targets_vni.filter(function (item) {
          return item.id !== vniId;
        })
      });
      sgsCols.update(updatedVNIsg);
    });
  }
};
var setReserverIpForVNI = function setReserverIpForVNI(input, subnet, vniId, vniName) {
  var _reservedIP;
  var reservedIP;
  if (input !== null && input !== void 0 && input.id) {
    var reservedIps = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
      return resource.id === input.id;
    }).data({
      removeMeta: true
    });
    if (reservedIps.length > 0) {
      reservedIP = reservedIps[0];
    } else {
      throw new Error("setReserverIpForVNI: Could not find the reserved IP with id: ".concat(input.id));
    }
  } else if (input !== null && input !== void 0 && input.address) {
    var _reservedIps = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
      return resource.address === input.address && !resource.target;
    }).data({
      removeMeta: true
    });
    if (_reservedIps.length > 0) {
      reservedIP = _reservedIps[0];
    } else {
      throw new Error("setReserverIpForVNI: ".concat(input.address, " is an unavailiable reserved ip in the subnet ").concat(subnet.name));
      // The provided primary IP was provided, but not found, so add it.
      // const reservedIpCollection = db.getCollection(COLS.reserved_private_ips);
      // addReservedIp(reservedIpCollection, subnet, input);
      // reservedIP = db.getCollection(COLS.reserved_private_ips).chain()
      //   .where(resource => resource.address === input.address).data({ removeMeta: true })[0];
    }
  } else {
    // If the reserver IP context or id is not provided, randomly choose one unbound reserved ip from the subnet
    var _reservedIps2 = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
      return resource.subnetId === subnet.id && resource.owner !== 'provider' && !resource.target;
    }).data({
      removeMeta: true
    });
    if (_reservedIps2.length) {
      reservedIP = _reservedIps2[casual.integer(0, _reservedIps2.length - 1)];
    } else {
      var reservedIp_id = (0, _reserved_private_ips.addReservedIp)(_server.db.getCollection(_server.COLS.reserved_private_ips), subnet, {});
      reservedIP = _server.db.getCollection(_server.COLS.reserved_private_ips).chain().where(function (resource) {
        return resource.id === reservedIp_id;
      }).data({
        removeMeta: true
      })[0];
    }
  }
  if ((_reservedIP = reservedIP) !== null && _reservedIP !== void 0 && _reservedIP.id) {
    (0, _reserved_private_ips.setReservedIPTarget)(reservedIP.id, {
      id: vniId,
      name: vniName
    }, 'virtual_network_interface');
  } else {
    throw new Error('setReserverIpForVNI: Could reserve one reserved IP.');
  }
  return reservedIP;
};
var addVNI = function addVNI(vni) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var inputId = data.id,
    inputSubnet = data.subnet,
    inputName = data.name,
    inputPrimaryIp = data.primary_ip,
    inputSecondaryIps = data.ips,
    target = data.target,
    inputSGs = data.security_groups,
    dataOverride = _objectWithoutProperties(data, _excluded);
  var id = inputId || casual.uuid;
  var name = inputName || utils.generateName('vni');
  var subnet = inputSubnet !== null && inputSubnet !== void 0 && inputSubnet.id ? utils.getResource(_server.COLS.subnets, inputSubnet.id)[0] : utils.getRandomResource(_server.COLS.subnets);
  var security_groups = inputSGs;
  var vpc = _server.db.addCollection(_server.COLS.vpcs).chain().where(function (resource) {
    return resource.id === subnet.vpc.id;
  }).data({
    removeMeta: true
  })[0];
  if (!security_groups || security_groups.length === 0) {
    security_groups = _server.db.addCollection(_server.COLS.security_groups).chain().where(function (resource) {
      return resource.id === vpc.default_security_group.id;
    }).data({
      removeMeta: true
    });
  }
  var primaryIp = setReserverIpForVNI(inputPrimaryIp, subnet, id, name);
  var secondaryIps = (inputSecondaryIps || []).map(function (ip) {
    return setReserverIpForVNI(ip, subnet, id, name);
  });
  var baseData = {
    auto_delete: false,
    allow_ip_spoofing: false,
    enable_infrastructure_nat: true,
    created_at: utils.generateCreateDate(),
    href: '',
    lifecycle_state: casual.random_element(VNIStatuses),
    resource_type: 'virtual_network_interface',
    crn: utils.generateCRN(),
    name: name,
    id: id,
    target: target,
    subnet: subnet,
    zone: subnet.zone,
    vpc: vpc,
    primary_ip: primaryIp,
    ips: [primaryIp].concat(secondaryIps),
    security_groups: security_groups,
    resource_group: {
      id: utils.getRandomResourceGroup()
    }
  };
  var newData = _objectSpread(_objectSpread({}, baseData), dataOverride);

  // update security groups targets field.
  (security_groups || []).forEach(function (sg) {
    var securityGroup = utils.findResource(_server.COLS.security_groups, sg.id);
    if (securityGroup !== null && securityGroup !== void 0 && securityGroup.targets_vni) {
      if (!securityGroup.targets_vni.find(function (item) {
        return item.id === id;
      })) {
        securityGroup.targets_vni.push({
          id: id
        });
      }
    } else {
      securityGroup.targets_vni = [{
        id: id
      }];
    }
    _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
  });
  vni.insert(newData);
  return newData;
};
exports.addVNI = addVNI;
var init = function init() {
  var vniCols = _server.db.addCollection(_server.COLS.virtual_network_interfaces);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addVNI(vniCols, {
    id: 'vni1001',
    name: 'aaa-default-vni-1',
    subnet: {
      id: 'subnet-1'
    },
    ips: [{}, {}]
  });
  addVNI(vniCols, {
    id: 'vni1002',
    name: 'aaa-default-vni-2',
    subnet: {
      id: 'subnet-2'
    },
    ips: [{}]
  });
  addVNI(vniCols, {
    id: 'vni1003',
    name: 'aaa-default-vni-3',
    enable_infrastructure_nat: false,
    allow_ip_spoofing: false,
    subnet: {
      id: 'subnet-3'
    }
  });
  var subnets = _server.db.getCollection(_server.COLS.subnets).chain().simplesort('name').data({
    removeMeta: true
  });
  subnets.forEach(function (subnet) {
    addVNI(vniCols, {
      subnet: subnet
    });
  });
  utils.repeat(function () {
    addVNI(vniCols);
  }, 15);
};
exports.init = init;
var getVNIs = function getVNIs(req, res) {
  var VNIs = utils.getResources(req, _server.COLS.virtual_network_interfaces);
  VNIs.virtual_network_interfaces = VNIs.virtual_network_interfaces.map(function (vni) {
    return formatVNIForClient(req, vni);
  });
  res.json(VNIs).end();
};
exports.getVNIs = getVNIs;
var getVNI = function getVNI(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, true);
  if (!vni) return;
  res.json(formatVNIForClient(req, vni)).end();
};
exports.getVNI = getVNI;
var createVNI = function createVNI(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.virtual_network_interfaces), input, req, res, 'resource with that name already exists', 'virtual_network_interfaces')) {
    return;
  }
  input.lifecycle_state = VNIStatuses[3]; // corresponds to 'stable'

  var newVNI = addVNI(_server.db.getCollection(_server.COLS.virtual_network_interfaces), input);
  var vnis = _server.db.getCollection(_server.COLS.virtual_network_interfaces).chain().find({
    id: newVNI.id
  }).data({
    removeMeta: true
  });
  var vni = formatVNIForClient(req, vnis[0]);
  res.status(201).json(vni).end();
};
exports.createVNI = createVNI;
var deleteVNI = function deleteVNI(req, res) {
  var _vni$target;
  var vnis = _server.db.getCollection(_server.COLS.virtual_network_interfaces).find({
    id: req.params.virtual_network_interface_id
  });
  if (vnis.length === 0) {
    res.status(404).json(utils.generateNotFoundError(req.params.virtual_network_interface_id, 'vitual_network_interface')).end();
    return;
  }
  var vni = vnis[0];
  var targetResourceType = (_vni$target = vni.target) === null || _vni$target === void 0 ? void 0 : _vni$target.resource_type;
  if (targetResourceType === 'share_mount_target') {
    res.status(400).json(utils.generateErrors('virtual network interface is being used by file share mount target', 409, 'vitual_network_interface_in_use')).end();
    return;
  }
  if (targetResourceType === 'instance_network_attachment' || targetResourceType === 'bare_metal_server_network_attachment') {
    var isBareMetal = targetResourceType === 'bare_metal_server_network_attachment';
    var servers = _server.db.addCollection(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances).chain().where(function (resource) {
      var _resource$primary_net;
      return ((_resource$primary_net = resource.primary_network_attachment) === null || _resource$primary_net === void 0 ? void 0 : _resource$primary_net.id) === vni.target.id;
    }).data({
      removeMeta: true
    });
    if (servers !== null && servers !== void 0 && servers.length) {
      res.status(400).json(utils.generateErrors("virtual network interface is being used by ".concat(isBareMetal ? 'bare mental' : 'instance', " as primary network interface"), 409, 'vitual_network_interface_in_use')).end();
      return;
    }
    // to do: delete the specific network attachment from the specific server
  }

  _server.db.getCollection(_server.COLS.virtual_network_interfaces).findAndRemove({
    id: req.params.virtual_network_interface_id
  });
  removeVNIfips(req.params.virtual_network_interface_id);
  removeVNIsgs(req.params.virtual_network_interface_id);
  res.status(204).end();
};
exports.deleteVNI = deleteVNI;
var updateVNI = function updateVNI(req, res) {
  if (!req.body) {
    return;
  }
  var input = _objectSpread({}, req.body);
  var vniCols = _server.db.getCollection(_server.COLS.virtual_network_interfaces);
  var origVNI = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!origVNI) {
    return;
  }
  Object.keys(input).forEach(function (item) {
    if (input[item] === undefined) {
      delete input[item];
    }
  });

  // Update our DB entry
  var updatedVNI = _objectSpread(_objectSpread({}, origVNI), input);
  vniCols.update(updatedVNI);

  // Retrieve the updated subnet from the DB
  var result = vniCols.chain().find({
    id: req.params.virtual_network_interface_id
  }).data({
    removeMeta: true
  });
  res.status(200).json(formatVNIForClient(req, result[0])).end();
};
exports.updateVNI = updateVNI;
var filterReserverIpsByVNI = function filterReserverIpsByVNI(subnetId, vniId, resource) {
  var _resource$target2, _resource$target3;
  if (resource.subnetId === subnetId && ((_resource$target2 = resource.target) === null || _resource$target2 === void 0 ? void 0 : _resource$target2.resource_type) === 'virtual_network_interface' && ((_resource$target3 = resource.target) === null || _resource$target3 === void 0 ? void 0 : _resource$target3.id) === vniId) {
    return true;
  }
  return false;
};
var getVNIips = function getVNIips(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) {
    return undefined;
  }
  var response = utils.getResources(req, _server.COLS.reserved_private_ips, function (resource) {
    return filterReserverIpsByVNI(vni.subnet.id, vni.id, resource);
  });
  response.ips = response[_server.COLS.reserved_private_ips].map(function (item) {
    return formatVNIipForClient(req, item);
  });
  delete response[_server.COLS.reserved_private_ips];
  return res.json(response).end();
};
exports.getVNIips = getVNIips;
var getVNIip = function getVNIip(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return undefined;
  var reservedIP = utils.findResource(_server.COLS.reserved_private_ips, req.params.reserved_ip_id, res, false);
  if (!reservedIP) return undefined;
  return res.json(formatVNIipForClient(req, reservedIP)).end();
};
exports.getVNIip = getVNIip;
var deleteVNIip = function deleteVNIip(req, res) {
  var _vni$primary_ip;
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return;
  var reservedIP = utils.findResource(_server.COLS.reserved_private_ips, req.params.reserved_ip_id, res, false);
  if (!reservedIP) return;
  if (((_vni$primary_ip = vni.primary_ip) === null || _vni$primary_ip === void 0 ? void 0 : _vni$primary_ip.id) === req.params.reserved_ip_id) {
    res.status(400).json(utils.generateErrors('the reserver ip is being used by virtual network interface as primary ip', 409, 'subnet_reserved_ip_in_use')).end();
    return;
  }
  var vniCols = _server.db.getCollection(_server.COLS.virtual_network_interfaces);
  var updatedVni = _objectSpread(_objectSpread({}, vni), {}, {
    ips: vni.ips.filter(function (ip) {
      return ip.id !== req.params.reserved_ip_id;
    })
  });
  vniCols.update(updatedVni);
  if (reservedIP.auto_delete) {
    var reservedIPCols = _server.db.getCollection(_server.COLS.reserved_private_ips);
    reservedIPCols.remove(reservedIP);
  } else {
    (0, _reserved_private_ips.removeReservedIpTarget)(reservedIP);
  }
  res.status(204).end();
};
exports.deleteVNIip = deleteVNIip;
var setVNIip = function setVNIip(req, res) {
  var _reservedIP$target;
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return;
  var reservedIP = utils.findResource(_server.COLS.reserved_private_ips, req.params.reserved_ip_id, res, false);
  if (!reservedIP) return;
  if ((_reservedIP$target = reservedIP.target) !== null && _reservedIP$target !== void 0 && _reservedIP$target.resource_type) {
    var _reservedIP$target2;
    res.status(400).json(utils.generateErrors("the reserver ip is being used by ".concat((_reservedIP$target2 = reservedIP.target) === null || _reservedIP$target2 === void 0 ? void 0 : _reservedIP$target2.resource_type), 409, 'subnet_reserved_ip_in_use')).end();
    return;
  }
  (0, _reserved_private_ips.setReservedIPTarget)(reservedIP.id, {
    id: vni.id,
    name: vni.name
  }, 'virtual_network_interface');
  var vniCols = _server.db.getCollection(_server.COLS.virtual_network_interfaces);
  var updatedVni = _objectSpread(_objectSpread({}, vni), {}, {
    ips: vni.ips.concat([reservedIP])
  });
  vniCols.update(updatedVni);
  res.json(formatVNIipForClient(req, reservedIP)).end();
};
exports.setVNIip = setVNIip;
var filterFloatingIpsByVNI = function filterFloatingIpsByVNI(vniId, resource) {
  var _resource$target4, _resource$target5;
  if (((_resource$target4 = resource.target) === null || _resource$target4 === void 0 ? void 0 : _resource$target4.resource_type) === 'virtual_network_interface' && ((_resource$target5 = resource.target) === null || _resource$target5 === void 0 ? void 0 : _resource$target5.id) === vniId) {
    return true;
  }
  return false;
};
var getVNIFloatingIps = function getVNIFloatingIps(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) {
    return undefined;
  }
  var response = utils.getResources(req, _server.COLS.floating_ips, function (resource) {
    return filterFloatingIpsByVNI(vni.id, resource);
  });
  response[_server.COLS.floating_ips] = response[_server.COLS.floating_ips].map(function (item) {
    return formatVNIFipForClient(req, item);
  });
  return res.json(response).end();
};
exports.getVNIFloatingIps = getVNIFloatingIps;
var getVNIFloatingIp = function getVNIFloatingIp(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return undefined;
  var floatingIP = utils.findResource(_server.COLS.floating_ips, req.params.floating_ip_id, res, false);
  if (!floatingIP) return undefined;
  return res.json(formatVNIFipForClient(req, floatingIP)).end();
};
exports.getVNIFloatingIp = getVNIFloatingIp;
var deleteVNIFloatingIp = function deleteVNIFloatingIp(req, res) {
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return;
  var floatingIP = utils.findResource(_server.COLS.floating_ips, req.params.floating_ip_id, res, false);
  if (!floatingIP) return;
  delete floatingIP.target;
  var floatingIPsCols = _server.db.getCollection(_server.COLS.floating_ips);
  floatingIPsCols.update(floatingIP);
  res.status(204).end();
};
exports.deleteVNIFloatingIp = deleteVNIFloatingIp;
var setVNIFloatingIp = function setVNIFloatingIp(req, res) {
  var _floatingIP$target;
  var vni = utils.findResource(_server.COLS.virtual_network_interfaces, req.params.virtual_network_interface_id, res, false);
  if (!vni) return;
  var floatingIP = utils.findResource(_server.COLS.floating_ips, req.params.floating_ip_id, res, false);
  if (!floatingIP) return;

  // The specified floating IP must not be required by another resource, such as a public gateway.
  if ((_floatingIP$target = floatingIP.target) !== null && _floatingIP$target !== void 0 && _floatingIP$target.resource_type) {
    res.status(400).json(utils.generateErrors('the floating ip is being used', 409, 'floating_ip_in_use')).end();
    return;
  }
  if (vni.enable_infrastructure_nat) {
    // If enable_infrastructure_nat is true, unbound VNI's existing association if have.
    removeVNIfips(vni.id);
  }
  (0, _floating_ips.setFloatingIPTarget)(req.params.floating_ip_id, {
    id: vni.id,
    name: vni.name,
    resource_type: 'virtual_network_interface'
  });
  var updatedFloatingIP = utils.findResource(_server.COLS.floating_ips, req.params.floating_ip_id, res, false);
  res.json(formatVNIFipForClient(req, updatedFloatingIP)).end();
};
exports.setVNIFloatingIp = setVNIFloatingIp;