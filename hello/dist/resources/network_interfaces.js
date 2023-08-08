"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateNetworkInterface = exports.updateFipForVnic = exports.removeFipForVnic = exports.putFloatingIpForVnic = exports.init = exports.getReservedIpsForVnic = exports.getReservedIpForVnic = exports.getNetworkInterfaces = exports.getNetworkInterfaceForInstances = exports.getNetworkInterface = exports.getFloatingIpsForVnic = exports.getFloatingIpForVnic = exports.formatNetworkInterfaceForSgClient = exports.deleteNetworkInterfaceFn = exports.deleteNetworkInterface = exports.deleteFloatingIpForVnic = exports.createNetworkInterfaces = exports.createNetworkInterface = exports.addNetworkInterface = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _reserved_private_ips = require("./reserved_private_ips");
var _features = require("./features");
var _excluded = ["instance_id", "floating_ips", "subnet", "security_groups"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
/**
 * findVnicWithInstance()
 * Util to find a vnic for instance
 * @param {*} instance
 * @param {*} vnicId
 */
var findVnicWithInstance = function findVnicWithInstance(instance, vnicId) {
  var network_interfaces = instance.network_interfaces,
    primary_network_interface = instance.primary_network_interface;
  var vnics = [].concat(_toConsumableArray(network_interfaces), [primary_network_interface]);
  return vnics.find(function (item) {
    return item.id === vnicId;
  });
};
/**
 * getNetworkInterfaceForInstances()
 */
var getNetworkInterfaceForInstances = function getNetworkInterfaceForInstances(vnicId, req, res) {
  var isBareMetal = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnicId, res);
  var instances = isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances;
  if (!vnic) return undefined;
  var href = "".concat(utils.getBaseApiUrl(req)).concat(instances, "/").concat(vnic.instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic.id);
  var subnet = vnic.subnet,
    id = vnic.id,
    name = vnic.name,
    primary_ipv4_address = vnic.primary_ipv4_address,
    primary_ip = vnic.primary_ip;
  var formattedSubnet = utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet.id);
  return {
    id: id,
    name: name,
    href: href,
    primary_ipv4_address: primary_ipv4_address,
    primary_ip: primary_ip,
    subnet: _objectSpread({}, formattedSubnet)
  };
};

/**
 * updateNetworkInterface()
 * Util to update a vnic for instance
 * @param {*} vnicId
 * @param {*} vnicInput
 * @param {*} res
 */
exports.getNetworkInterfaceForInstances = getNetworkInterfaceForInstances;
var updateNetworkInterface = function updateNetworkInterface(req, res) {
  var input = req.body;
  var vnic = utils.findResource(_server.COLS.network_interfaces, req.params.vnic_id, res);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
  if (!vnic) {
    return res.status(404).end();
  }
  var newVnics = _objectSpread(_objectSpread({}, vnic), input);
  vnics.update(newVnics);
  return res.json(newVnics).end();
};
exports.updateNetworkInterface = updateNetworkInterface;
var deleteNetworkInterfaceFn = function deleteNetworkInterfaceFn(vnic_id, bm_id, res) {
  var _vnic$primary_ip;
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnic_id, res);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
  if (!vnic) {
    return;
  }
  if ((_vnic$primary_ip = vnic.primary_ip) !== null && _vnic$primary_ip !== void 0 && _vnic$primary_ip.id) {
    var _vnic$primary_ip2;
    (0, _reserved_private_ips.removeReservedIpTarget)((_vnic$primary_ip2 = vnic.primary_ip) === null || _vnic$primary_ip2 === void 0 ? void 0 : _vnic$primary_ip2.id);
  }
  if (vnic) vnics.remove(vnic);
  var isBareMetal = !!bm_id;
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, vnic.instance_id, res);
  if (!instance) {
    res.status(404).end();
    return;
  }
  var network_interfaces = instance.network_interfaces;
  var updatedNetIntf = network_interfaces.filter(function (nic) {
    return nic.id !== vnic.id;
  });
  var instances = _server.db.getCollection(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances);
  instances.update(_objectSpread(_objectSpread({}, instance), {}, {
    network_interfaces: updatedNetIntf
  }));
  res.status(204).end();
};
/**
 * deleteNetworkInterface()
 * Util to update a vnic for instance
 * @param {*} vnicId
 * @param {*} vnicInput
 * @param {*} res
 */
exports.deleteNetworkInterfaceFn = deleteNetworkInterfaceFn;
var deleteNetworkInterface = function deleteNetworkInterface(req, res) {
  deleteNetworkInterfaceFn(req.params.vnic_id, req.params.bare_metal_server_id, utils.fakeResponse);
  res.status(204).end();
};

/**
 * updateFipForVnic()
 * Util to find a vnic for instance
 * @param {*} vnicId
 * @param {*} fip
 * @param {*} res
 */
exports.deleteNetworkInterface = deleteNetworkInterface;
var updateFipForVnic = function updateFipForVnic(vnicId, fip, res) {
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnicId, res);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
  vnics.update(_objectSpread(_objectSpread({}, vnic), {}, {
    floating_ips: [{
      id: fip.id,
      address: fip.address,
      name: fip.name,
      crn: fip.crn
    }]
  }));
};

/**
 * removeFipForVnic()
 * Util to find a vnic for instance
 */
exports.updateFipForVnic = updateFipForVnic;
var removeFipForVnic = function removeFipForVnic(vnicId, res) {
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnicId, res);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
  vnics.update(_objectSpread(_objectSpread({}, vnic), {}, {
    floating_ips: []
  }));
};
exports.removeFipForVnic = removeFipForVnic;
var formatVNICForClient = function formatVNICForClient(req, vnic, isBareMetal) {
  var instId = vnic.instance_id;
  var href = "".concat(utils.getBaseApiUrl(req)).concat(isBareMetal ? 'bare_metal_servers' : _server.COLS.instances, "/").concat(instId, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic.id);
  var instance_id = vnic.instance_id,
    floating_ips = vnic.floating_ips,
    subnet = vnic.subnet,
    security_groups = vnic.security_groups,
    rest = _objectWithoutProperties(vnic, _excluded);
  var formattedSGs = security_groups && security_groups.map(function (sg) {
    return utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, sg.id);
  });
  var formattedSubnet = utils.getAndFormatResourceLinkForClient(req, _server.COLS.subnets, subnet.id);
  var formattedFIPs = floating_ips && floating_ips.map(function (fip) {
    return Object.assign({
      address: fip.address
    }, utils.getAndFormatResourceLinkForClient(req, _server.COLS.floating_ips, fip.id));
  });
  return _objectSpread(_objectSpread({}, rest), {}, {
    floating_ips: formattedFIPs,
    subnet: formattedSubnet,
    security_groups: formattedSGs,
    href: href
  });
};

/**
 * getNetworkInterfaceForSg()
 */
var formatNetworkInterfaceForSgClient = function formatNetworkInterfaceForSgClient(vnicId, req) {
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnicId);
  if (!vnic) return undefined;
  var instId = vnic.instance_id;
  var href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(instId, "/").concat(_server.COLS.network_interfaces, "/").concat(vnic.id);
  var id = vnic.id,
    name = vnic.name,
    primary_ipv4_address = vnic.primary_ipv4_address;
  return {
    id: id,
    name: name,
    href: href,
    primary_ipv4_address: primary_ipv4_address,
    resource_type: 'network_interface'
  };
};

/**
 * addNetworkInterface()
 * Util to create a network interface type object.
 * For autoscale templates, the interface is of type network_interface_template, which is slightly different
 * @param {*} data - data: { subnet: {}, security_groups: {}, name: '', prot_speed: 100 }
 */
exports.formatNetworkInterfaceForSgClient = formatNetworkInterfaceForSgClient;
var addNetworkInterface = function addNetworkInterface(data, instance_id, res, primary) {
  var type = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'vsi';
  var isTemplate = type === 'template';
  var isBaremetal = type === 'bm';
  var network_interfaces = _server.db.getCollection(isTemplate ? _server.COLS.network_interface_templates : _server.COLS.network_interfaces);
  var _data$security_groups = data.security_groups,
    security_groups = _data$security_groups === void 0 ? [] : _data$security_groups,
    _data$floating_ips = data.floating_ips,
    floating_ips = _data$floating_ips === void 0 ? [] : _data$floating_ips;
  var sg = security_groups.map(function (item) {
    return {
      id: item.id
    };
  });
  var fip = floating_ips.length !== 0 && floating_ips.map(function (item) {
    var fIp;
    if (item.id) {
      fIp = utils.findResource(_server.COLS.floating_ips, item.id, res);
    } else if (item.address) {
      fIp = utils.findResource(_server.COLS.floating_ips, item.address, res);
    }
    return {
      id: fIp.id
    };
  });
  var subnet = {
    id: data.subnet.id || ''
  };
  var subnetInDB = utils.findResource(_server.COLS.subnets, subnet.id, res);
  var primary_ipv4_address = data.primary_ipv4_address;
  var reserved_ip;
  if (data.primary_ip && data.primary_ip.id) {
    var reservedIps = _server.db.addCollection(_server.COLS.reserved_private_ips);
    var reserved_ips = reservedIps.find({
      id: data.primary_ip.id
    });
    if (reserved_ips.length === 0) {
      res.status(404).json(utils.generateErrors("Resource not found with id ".concat(data.primary_ip.id), 'not_found', 'reserved_ip')).end();
      return undefined;
    }
    reserved_ip = reserved_ips[0];
    primary_ipv4_address = reserved_ip.address;
  } else if (data.primary_ip && !data.primary_ip.id && subnetInDB) {
    // create a new reserved ip
    var _reservedIps = _server.db.addCollection(_server.COLS.reserved_private_ips);
    var newIPID = (0, _reserved_private_ips.addReservedIp)(_reservedIps, subnetInDB, data.primary_ip);
    reserved_ip = utils.findResource(_server.COLS.reserved_private_ips, newIPID, res);
    primary_ipv4_address = reserved_ip.address;
  }
  if (!primary_ipv4_address && subnet.id) {
    if (subnetInDB) {
      var _reserved_ips = (0, _reserved_private_ips.generateReservedIpInSubnet)(subnetInDB, data === null || data === void 0 ? void 0 : data.reservedIPData);
      reserved_ip = _reserved_ips[0];
      primary_ipv4_address = reserved_ip.address;
    }
  }
  if (!primary_ipv4_address) {
    primary_ipv4_address = "".concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".0");
  }
  var id = !data.id ? _casual["default"].uuid : data.id;
  var baseData = {
    id: id,
    instance_id: instance_id,
    name: data.name || utils.generateName('vnic'),
    primary_ipv4_address: isTemplate ? null : primary_ipv4_address,
    created_at: utils.generateNowDate(),
    floating_ips: isTemplate && fip || [],
    security_groups: sg,
    status: 'available',
    // we want status to me `available` most of the times, [available, failed, pending]
    subnet: subnet,
    type: primary ? 'primary' : 'secondary',
    allow_ip_spoofing: data.allow_ip_spoofing ? data.allow_ip_spoofing : false
  };
  if (reserved_ip) {
    baseData.primary_ip = {
      id: reserved_ip.id,
      name: reserved_ip.name,
      href: reserved_ip.href,
      address: reserved_ip.address,
      resource_type: 'subnet_reserved_ip'
    };
  }
  network_interfaces.insert(baseData);
  if (!isTemplate) {
    security_groups.forEach(function (item) {
      var existingSG = utils.findResource(_server.COLS.security_groups, item.id, res);
      var existingVnics = existingSG.network_interfaces || [];
      existingVnics.push({
        id: baseData.id
      });
      existingSG.network_interfaces = existingVnics;
      _server.db.getCollection(_server.COLS.security_groups).update(existingSG);
    });
  }
  if (isBaremetal) {
    baseData.enable_infrastructure_nat = data.enable_infrastructure_nat || _casual["default"].integer(0, 6) % 6 !== 5;
    baseData.mac_address = utils.generateMacAddress();
    baseData.interface_type = data.interface_type || (primary ? 'pci' : 'vlan');
    if (baseData.interface_type === 'pci') {
      baseData.allowed_vlans = data.allowed_vlans || [1];
    } else {
      baseData.allow_interface_to_float = data.allow_interface_to_float || _casual["default"].integer(0, 6) % 6 === 5;
      baseData.vlan = data.vlan || 1;
    }
  }
  if (reserved_ip) {
    var hrefBase = "".concat(isBaremetal ? 'bare_metal_servers' : _server.COLS.instances, "/").concat(instance_id, "/").concat(_server.COLS.network_interfaces, "/").concat(id);
    var region = data.zone ? data.zone.region_name : 'us-east';
    var baseUrl = "/rias-mock/".concat(region, "/v1/");
    (0, _reserved_private_ips.setReservedIPTarget)(reserved_ip.id, {
      id: id,
      name: baseData.name,
      href: "".concat(baseUrl).concat(hrefBase)
    }, 'network_interface');
  }
  return {
    id: baseData.id
  };
};

/**
 * init()
 * Initialize network interfaces
 */
exports.addNetworkInterface = addNetworkInterface;
var init = function init(res) {
  _server.db.addCollection(_server.COLS.network_interfaces);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addNetworkInterface({
    id: 'vnic-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: utils.generateName('primary'),
    subnet: {
      id: 'subnet-1',
      name: 'aaa-default-subnet-1'
    }
  }, 'instance-aaaa-aaaa-aaaa-aaaaaaaaaaaa', res, true);
  addNetworkInterface({
    id: 'vnic-baaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: utils.generateName('primary'),
    subnet: {
      id: 'subnet-1',
      name: 'aaa-default-subnet-1'
    }
  }, 'baremetal-aaaa-aaaa-aaaa-aaaaaaaaaaaa', res, true, 'bm');
  addNetworkInterface({
    id: 'vnic-aaaa-aaaa-aaaa-bbbbbbbbbbbb',
    name: utils.generateName('secondary'),
    subnet: {
      id: 'subnet-3',
      name: 'aaa-default-subnet-3'
    }
  }, 'aaa-multi-zone-nics-vsi-id', res);
};

/**
 * getNetworkInterface()
 * GET /instances/{instance_id}/network_interfaces/{vnic_id}
 * @param {*} req
 * @param {*} res
 */
exports.init = init;
var getNetworkInterface = function getNetworkInterface(req, res) {
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id, res);
  var _instance$network_int = instance.network_interfaces,
    network_interfaces = _instance$network_int === void 0 ? [] : _instance$network_int,
    primary_network_interface = instance.primary_network_interface;
  var vnic = [primary_network_interface].concat(_toConsumableArray(network_interfaces)).find(function (item) {
    return item.id === req.params.vnic_id;
  });
  if (!vnic) {
    return res.status(404).end();
  }
  var expectedVnic = utils.findResource(_server.COLS.network_interfaces, vnic.id, res, true);
  var vnicClient = formatVNICForClient(req, expectedVnic, isBareMetal);
  return res.json(vnicClient).end();
};

/**
 * getNetworkInterfaces
 * GET /instances/{instance_id}/network_interfaces
 * @param {*} req
 * @param {*} res
 */
exports.getNetworkInterface = getNetworkInterface;
var getNetworkInterfaces = function getNetworkInterfaces(req, res) {
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id, res);
  var _instance$network_int2 = instance.network_interfaces,
    network_interfaces = _instance$network_int2 === void 0 ? [] : _instance$network_int2,
    primary_network_interface = instance.primary_network_interface;
  var vnicsFromVSI = [primary_network_interface].concat(_toConsumableArray(network_interfaces));
  var vnics = vnicsFromVSI.map(function (item) {
    var vnic = utils.findResource(_server.COLS.network_interfaces, item.id, res, true);
    return formatVNICForClient(req, vnic, isBareMetal);
  });
  res.json({
    network_interfaces: vnics
  }).end();
};

/**
 * createNetworkInterfaces()
 * Util to create network interface for Instance
 * @param {*} req
 * @param {*} res
 */
exports.getNetworkInterfaces = getNetworkInterfaces;
var createNetworkInterfaces = function createNetworkInterfaces(input, instance_id, res) {
  var type = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'vsi';
  var primary = addNetworkInterface(input.primary_network_interface, instance_id, res, true, type);
  var network_interfaces = input.network_interfaces;
  var secondary = [];
  if (network_interfaces) {
    secondary = network_interfaces.map(function (item) {
      return addNetworkInterface(item, instance_id, res, false, type);
    });
  }
  return {
    primary_network_interface: primary,
    network_interfaces: secondary
  };
};

/**
 * createNetworkInterface()
 * POST /instances/{instance_id}/network_interfaces
 * @param {*} req
 * @param {*} res
 */
exports.createNetworkInterfaces = createNetworkInterfaces;
var createNetworkInterface = function createNetworkInterface(req, res) {
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var input = req.body;
  var networkInterface = addNetworkInterface(input, instance_id, res, false, isBareMetal ? 'bm' : 'vsi');

  // Update network interfaces for instance
  var instances = _server.db.getCollection(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances);
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id);
  var network_interfaces = instance.network_interfaces;
  network_interfaces.push(networkInterface);
  var updatedInstance = _objectSpread(_objectSpread({}, instance), network_interfaces);
  // update instance with new network interfaces and fetch updated instance
  instances.update(updatedInstance);

  // Return new vnic
  var newVnic = utils.findResource(_server.COLS.network_interfaces, networkInterface.id, res, true);
  res.status(201).json(newVnic).end();
};

/**
 * putFloatingIpForVnic()
 * PUT /instances/{instance_id}/network_interfaces/{network_interface_id}/floating_ips/{id}
 * @param {*} req
 * @param {*} res
 */
exports.createNetworkInterface = createNetworkInterface;
var putFloatingIpForVnic = function putFloatingIpForVnic(req, res) {
  var _req$params = req.params,
    vnic_id = _req$params.vnic_id,
    ip_id = _req$params.ip_id;
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var fip = utils.findResource(_server.COLS.floating_ips, ip_id, res);
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id, res, true);
  var foundVnic = findVnicWithInstance(instance, vnic_id);
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnic_id, res);
  if (foundVnic.id === vnic.id) {
    var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
    vnics.update(_objectSpread(_objectSpread({}, vnic), {}, {
      floating_ips: [{
        id: fip.id,
        address: fip.address
      }]
    }));
    var fips = _server.db.getCollection(_server.COLS.floating_ips);
    fip.target = {
      id: vnic.id,
      name: vnic.name,
      resource_type: 'network_interface'
    };
    fips.update(fip);
    res.status(201).json(fip).end();
  }
};

/**
 * deleteFloatingIpForVnic()
 * DELETE /instances/{instance_id}/network_interfaces/{network_interface_id}/floating_ips/{id}
 * @param {*} req
 * @param {*} res
 */
exports.putFloatingIpForVnic = putFloatingIpForVnic;
var deleteFloatingIpForVnic = function deleteFloatingIpForVnic(req, res) {
  var _req$params2 = req.params,
    vnic_id = _req$params2.vnic_id,
    ip_id = _req$params2.ip_id;
  var instance_id = req.params.instance_id || req.params.bare_metal_server_id;
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnic_id, res);
  var vnics = _server.db.getCollection(_server.COLS.network_interfaces);
  var floating_ips = vnic.floating_ips;
  if (floating_ips[0].id !== ip_id || vnic.instance_id !== instance_id) {
    res.status(404).end();
  }
  // asuming there will be only one floating ip associated to a vnic
  vnics.update(_objectSpread(_objectSpread({}, vnic), {}, {
    floating_ips: []
  }));
  // do the same for FIP
  var fip = utils.findResource(_server.COLS.floating_ips, ip_id, res);
  delete fip.target;
  var fips = _server.db.getCollection(_server.COLS.floating_ips);
  fips.update(fip);
  res.status(204).end();
};

/**
 * getFloatingIpForVnic()
 * GAT /instances/{instance_id}/network_interfaces/{network_interface_id}/floating_ips/{id}
 * @param {*} req
 * @param {*} res
 */
exports.deleteFloatingIpForVnic = deleteFloatingIpForVnic;
var getFloatingIpForVnic = function getFloatingIpForVnic(req, res) {
  var _req$params3 = req.params,
    vnic_id = _req$params3.vnic_id,
    ip_id = _req$params3.ip_id;
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var fip = utils.findResource(_server.COLS.floating_ips, ip_id, res, true);
  var id = fip.id,
    crn = fip.crn,
    href = fip.href,
    address = fip.address,
    name = fip.name,
    created_at = fip.created_at,
    resource_group = fip.resource_group,
    target = fip.target,
    zone = fip.zone,
    tags = fip.tags;
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id, res);
  if (!instance) {
    return;
  }
  var foundVnic = findVnicWithInstance(instance, vnic_id);
  if (!foundVnic) {
    res.status(404).end();
    return;
  }
  var vnic = utils.findResource(_server.COLS.network_interfaces, vnic_id, res);
  var floating_ips = vnic.floating_ips;
  if (foundVnic.id === vnic.id && floating_ips.length > 0 && floating_ips[0].id === ip_id) {
    res.json({
      id: id,
      crn: crn,
      href: href,
      address: address,
      name: name,
      created_at: created_at,
      resource_group: resource_group,
      target: target,
      zone: zone,
      tags: tags
    }).end();
  } else {
    res.status(404).end();
  }
};

/**
 * getFloatingIpsForVnic()
 * GAT /instances/{instance_id}/network_interfaces/{network_interface_id}/floating_ips
 * @param {*} req
 * @param {*} res
 */
exports.getFloatingIpForVnic = getFloatingIpForVnic;
var getFloatingIpsForVnic = function getFloatingIpsForVnic(req, res) {
  var vnic_id = req.params.vnic_id;
  var isBareMetal = !!req.params.bare_metal_server_id;
  var id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var instances = isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances;
  var instance = utils.findResource(instances, id, res);
  if (!instance) {
    return;
  }
  var requiredVnicId = findVnicWithInstance(instance, vnic_id);
  if (!requiredVnicId) {
    res.status(404).end();
    return;
  }
  var vnic = utils.findResource(_server.COLS.network_interfaces, requiredVnicId.id, res);
  var floating_ips = vnic.floating_ips;
  var returnObject = floating_ips.map(function (item) {
    return utils.findResource(_server.COLS.floating_ips, item.id, res, true);
  });
  returnObject.forEach(function (fip) {
    fip.href = "".concat(utils.getBaseUrl(req), "/").concat(fip.id);
  });
  res.json({
    floating_ips: _toConsumableArray(returnObject)
  }).end();
};
exports.getFloatingIpsForVnic = getFloatingIpsForVnic;
var filterByTarget = function filterByTarget(vnicID, resource) {
  var _resource$target;
  if ((resource === null || resource === void 0 ? void 0 : (_resource$target = resource.target) === null || _resource$target === void 0 ? void 0 : _resource$target.id) === vnicID) {
    return true;
  }
  return false;
};

/**
 * getReservedIpsForVnic()
 * GAT /instances/{instance_id}/network_interfaces/{network_interface_id}/ips
 * @param {*} req
 * @param {*} res
 */
var getReservedIpsForVnic = function getReservedIpsForVnic(req, res) {
  var vnic_id = req.params.vnic_id;
  var isBareMetal = !!req.params.bare_metal_server_id;
  var id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var instances = isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances;
  var instance = utils.findResource(instances, id, res);
  if (!instance) {
    res.status(404).end();
    return;
  }
  var requiredVnicId = findVnicWithInstance(instance, vnic_id);
  if (!requiredVnicId) {
    res.status(404).end();
    return;
  }
  var reservedIPS = utils.getResources(req, _server.COLS.reserved_private_ips, function (resource) {
    return filterByTarget(vnic_id, resource);
  });
  reservedIPS.ips = reservedIPS.reserved_ips;
  delete reservedIPS.reserved_ips;
  res.json(reservedIPS).end();
};

/**
 * getReservedIpForVnic()
 * GAT /instances/{instance_id}/network_interfaces/{network_interface_id}/ips/{id}
 * @param {*} req
 * @param {*} res
 */
exports.getReservedIpsForVnic = getReservedIpsForVnic;
var getReservedIpForVnic = function getReservedIpForVnic(req, res) {
  var _req$params4 = req.params,
    vnic_id = _req$params4.vnic_id,
    ip_id = _req$params4.ip_id;
  var isBareMetal = !!req.params.bare_metal_server_id;
  var instance_id = isBareMetal ? req.params.bare_metal_server_id : req.params.instance_id;
  var instance = utils.findResource(isBareMetal ? _server.COLS.bm_instances : _server.COLS.instances, instance_id, res);
  if (!instance) {
    res.status(404).end();
    return;
  }
  var foundVnic = findVnicWithInstance(instance, vnic_id);
  if (!foundVnic) {
    res.status(404).end();
    return;
  }
  var ip = utils.findResource(_server.COLS.reserved_private_ips, ip_id, res, true);
  if (!ip) {
    return;
  }
  (0, _reserved_private_ips.formatReservedIPForClient)(req, ip);
  res.json(ip).end();
};
exports.getReservedIpForVnic = getReservedIpForVnic;