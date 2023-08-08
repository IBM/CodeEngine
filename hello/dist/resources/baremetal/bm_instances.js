"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateInstance = exports.updateFirmware = exports.updateDisk = exports.stopInstance = exports.startInstance = exports.restartInstance = exports.osReload = exports.init = exports.getResponseObjectWithName = exports.getInstances = exports.getInstance = exports.getInitConfiguration = exports.getDisks = exports.getDisk = exports.deleteInstance = exports.createInstance = exports.addInstance = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _network_interfaces = require("../network_interfaces");
var _keys = require("../keys");
var _features = require("../features");
var _reserved_private_ips = require("../reserved_private_ips");
var _excluded = ["encryption_key"],
  _excluded2 = ["encryption_key"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var InstanceStatuses = ['pending', 'failed', 'running', 'starting', 'stopped', 'stopping', 'restarting', 'reloading'];
// const ActionCompletionStatuses = ['pending', 'running', 'failed', 'completed'];

/**
 * We want to make it look like most of the instances are running so
 * we'll only use the other instances state 25% of the time.
 */
var getRandomStatus = function getRandomStatus() {
  if (_casual["default"].integer(0, 5) % 5 === 1) {
    return _casual["default"].random_element(InstanceStatuses);
  }
  return 'running';
};
var InstancesCPUArchitectures = ['amd64'];

// Returns invalid href for profiles
var getResponseObjectWithName = function getResponseObjectWithName(type, resourceName, req) {
  var resource = _server.db.getCollection(type).chain().find({
    name: resourceName
  }).data({
    removeMeta: true
  });
  return _objectSpread(_objectSpread({}, resource[0]), {}, {
    crn: utils.updateResourceCrnRegion(resource, req),
    href: "".concat(utils.getBaseApiUrl(req)).concat(type, "/").concat(resource[0].id)
  });
};
exports.getResponseObjectWithName = getResponseObjectWithName;
var updateFirmware = function updateFirmware(req, res) {
  var _req$body;
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  if (!instance.firmware.some(function (fw) {
    return fw.priority !== 'none';
  })) {
    res.status(400).json(utils.generateErrors('Server is already up to date', 'invalid')).end();
    return;
  }
  if (instance.status !== 'stopped') {
    res.status(400).json(utils.generateErrors('Server must be in stopped status', 'invalid')).end();
    return;
  }
  var newFirmware = instance.firmware.map(function (firmware) {
    return _objectSpread(_objectSpread({}, firmware), {}, {
      priority: 'none',
      installed_version: firmware.available_version
    });
  });
  instances.update(_objectSpread(_objectSpread({}, instance), {}, {
    firmware: newFirmware,
    lifecycle_state: 'updating'
  }));
  var startWhenDone = ((_req$body = req.body) === null || _req$body === void 0 ? void 0 : _req$body.start_when_done) !== false;
  setTimeout(function () {
    instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
    instances = _server.db.getCollection(_server.COLS.bm_instances);
    var lifecycleState = _casual["default"].coin_flip ? 'stable' : 'failed';
    instances.update(_objectSpread(_objectSpread({}, instance), {}, {
      lifecycle_state: lifecycleState,
      status: startWhenDone ? 'running' : 'stopped'
    }));
  }, 30000);
  res.status(204).end();
};
exports.updateFirmware = updateFirmware;
var osReload = function osReload(req, res) {
  var newOsReloadData = req.body;
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  var reloadedInstance = _objectSpread({}, instance);
  if (instance.status !== 'stopped') {
    res.status(400).json(utils.generateErrors('Server must be in stopped status', 'invalid')).end();
    return;
  }
  var _instance = instance,
    _instance$initializat = _instance.initialization,
    keys = _instance$initializat.keys,
    image = _instance$initializat.image,
    user_data = _instance$initializat.user_data,
    user_accounts = _instance$initializat.user_accounts;
  var freshImage = image || utils.getRandomResource(_server.COLS.images);
  if (newOsReloadData.image) {
    freshImage = utils.findResource(_server.COLS.images, newOsReloadData.image.id, res, false);
  }
  freshImage = utils.getAndFormatResourceLinkForClient(req, _server.COLS.images, freshImage.id);
  var userData;
  if (newOsReloadData.userData || instance.initialization.user_data) {
    userData = newOsReloadData.userData || instance.initialization.user_data;
  }
  var updatedKeys = [];
  if (newOsReloadData.keys || keys) {
    updatedKeys = newOsReloadData.keys || keys;
  }
  var formattedKeys = [];
  updatedKeys.forEach(function (key) {
    return formattedKeys.push((0, _keys.formatKeyForClient)(key.id, req, res));
  });
  var initializationObj = {
    keys: formattedKeys,
    image: freshImage
  };
  if (userData) {
    initializationObj.user_data = user_data;
  }
  reloadedInstance.initialization = initializationObj;

  // need to update initialization object on bm with new image, sshkeys, user_data
  var updatedInstance = _objectSpread(_objectSpread({}, reloadedInstance), {}, {
    status: 'reloading'
  });
  instances.update(updatedInstance);
  setTimeout(function () {
    instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
    instances = _server.db.getCollection(_server.COLS.bm_instances);
    var state = _casual["default"].random_element(['running', 'running', 'running', 'failed']);
    instances.update(_objectSpread(_objectSpread({}, instance), {}, {
      status: state
    }));
  }, 30000);
  var formattedAccounts = (user_accounts || []).map(function (account) {
    var encryption_key = account.encryption_key,
      rest = _objectWithoutProperties(account, _excluded);
    return _objectSpread({
      resource_type: 'host_user_account',
      encryption_key: encryption_key && (0, _keys.formatKeyForClient)(encryption_key.id, req, res)
    }, rest);
  });
  // return the BareMetalServer Initialization
  res.status(200).json({
    keys: formattedKeys,
    image: freshImage,
    user_accounts: formattedAccounts
  }).end();
};
exports.osReload = osReload;
var stopInstance = function stopInstance(req, res) {
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  if (_features.shouldAddDelaysToStatusTransitions) {
    instances.update(_objectSpread(_objectSpread({}, instance), {}, {
      status: 'stopping'
    }));
    setTimeout(function () {
      return instances.update(_objectSpread(_objectSpread({}, instance), {}, {
        status: 'stopped'
      }));
    }, 5000);
  } else {
    instances.update(_objectSpread(_objectSpread({}, instance), {}, {
      status: 'stopped'
    }));
  }
  res.status(204).end();
};
exports.stopInstance = stopInstance;
var restartInstance = function restartInstance(req, res) {
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  instances.update(_objectSpread(_objectSpread({}, instance), {}, {
    status: 'running'
  }));
  res.status(204).end();
};
exports.restartInstance = restartInstance;
var startInstance = function startInstance(req, res) {
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  instances.update(_objectSpread(_objectSpread({}, instance), {}, {
    status: 'running'
  }));
  res.status(204).end();
};

/**
 * addInstance()
 * Add a BM instance
 * @param {*} instances: List of instances
 * @param {*} data: details of the new BM to be added to the List of instances
 */
exports.startInstance = startInstance;
var addInstance = function addInstance(instances, data, res) {
  var _data$reservedIPData, _data$reservedIPData2;
  var randomFromInit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var id = data.id ? data.id : _casual["default"].uuid;
  var regionName = data.regionName || '';
  var profile = utils.getRandomResource(_server.COLS.bm_profiles);
  var inputProfileInfo = data.profile && utils.findResource(_server.COLS.bm_profiles, data.profile.name);

  // Use pre-defined subnet to fetch associated vpc instead of using random vpc
  var subnet = data.subnet && utils.findResource(_server.COLS.subnets, data.subnet.id) || (regionName ? utils.getRandomResourceInZone(_server.COLS.subnets, regionName) : utils.getRandomResource(_server.COLS.subnets));
  var zone = utils.findZone(subnet.zone.name);
  regionName = regionName || zone.region_name;
  var vpc = utils.findResource(_server.COLS.vpcs, subnet.vpc.id);
  // Assign a default subnet to initial instances
  var defaultSubnet = data.name && data.subnet && utils.findResource(_server.COLS.subnets, data.subnet.id);
  var image = utils.getRandomResource(_server.COLS.images);
  var keys = [utils.getRandomResourceInRegion(_server.COLS.keys, regionName)].filter(function (key) {
    return key;
  });
  var userData;
  if (data.initialization) {
    if (data.initialization.keys) {
      keys = data.initialization.keys;
    }
    if (data.initialization.image) {
      image = utils.findResource(_server.COLS.images, data.initialization.image.id, res, false);
    }
    if (data.initialization.user_data) {
      userData = data.user_data;
    }
  }

  // add primary and secondary network interfaces
  var primaryVnic = (0, _network_interfaces.addNetworkInterface)(_objectSpread({
    name: data.name ? "primary-".concat(data.name) : utils.generateName('primary'),
    subnet: {
      id: defaultSubnet ? defaultSubnet.id : subnet.id
    },
    zone: defaultSubnet ? defaultSubnet.zone : zone,
    security_groups: data.security_groups ? data.security_groups : [{
      id: vpc.default_security_group.id
    }],
    reservedIPData: data === null || data === void 0 ? void 0 : (_data$reservedIPData = data.reservedIPData) === null || _data$reservedIPData === void 0 ? void 0 : _data$reservedIPData.primary
  }, data.primary_network_interface), id, res, true, 'bm');
  var secondaryVnic = data.network_interfaces ? data.network_interfaces.map(function (item) {
    return (0, _network_interfaces.addNetworkInterface)(item, id, res, 'bm');
  }) : [(0, _network_interfaces.addNetworkInterface)({
    name: data.name ? "secondary-".concat(data.name) : utils.generateName('secondary'),
    subnet: {
      id: defaultSubnet ? defaultSubnet.id : subnet.id
    },
    zone: defaultSubnet ? defaultSubnet.zone : zone,
    security_groups: data.security_groups ? data.security_groups : [{
      id: vpc.default_security_group.id
    }],
    reservedIPData: data === null || data === void 0 ? void 0 : (_data$reservedIPData2 = data.reservedIPData) === null || _data$reservedIPData2 === void 0 ? void 0 : _data$reservedIPData2.secondary
  }, id, res, false, 'bm')];
  var enable_secure_boot = _casual["default"].integer(0, 5) % 5 !== 1;
  var usedProfile = inputProfileInfo || profile;
  var disks;
  if (usedProfile && usedProfile.disks) {
    disks = _lodash["default"].flatten(usedProfile.disks.map(function (disk) {
      var disksPerType = [];
      for (var i = 0; i < disk.quantity; i++) {
        disksPerType.push({
          id: _casual["default"].uuid,
          name: utils.generateName('bm-localdisk', zone),
          interface_type: disk.supported_interface_types[0],
          size: disk.size,
          resource_type: 'bare_metal_server_disk',
          created_at: utils.generateCreateDate()
        });
      }
      return disksPerType;
    }));
  }
  // Setup firmware updates on BM to be randomized on severity (priority). Then randomize whether they are up to date or not.
  var firmware = [{
    type: 'bmc',
    installed_version: '1.0.6',
    available_version: '1.0.7',
    priority: _casual["default"].coin_flip ? 'critical' : 'optional'
  }, {
    type: 'bios',
    installed_version: '1.0.6',
    available_version: '1.0.7',
    priority: _casual["default"].coin_flip ? 'critical' : 'optional'
  }];
  if (_casual["default"].coin_flip) {
    firmware[0].available_version = '1.0.6';
    firmware[0].priority = 'none';
  }
  if (_casual["default"].coin_flip) {
    firmware[1].available_version = '1.0.6';
    firmware[1].priority = 'none';
  }
  var baseData = {
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // Placholder
    cpu: {
      architecture: inputProfileInfo && inputProfileInfo.cpu_architecture || _casual["default"].random_element(InstancesCPUArchitectures),
      core_count: inputProfileInfo ? inputProfileInfo.cpuCoreCount : profile.cpuCoreCount,
      socket_count: inputProfileInfo ? inputProfileInfo.cpuSocketCount : profile.cpuSocketCount,
      threads_per_core: _casual["default"].integer(1, 64)
    },
    created_at: utils.generateCreateDate(),
    initialization: {
      image: {
        id: image.id
      },
      keys: keys.map(function (key) {
        return {
          id: key.id
        };
      }),
      user_accounts: [{
        username: 'root',
        encrypted_password: 'just-a-mock-password-value',
        encryption_key: keys[0]
      }]
    },
    memory: inputProfileInfo ? inputProfileInfo.memorySize : profile.memorySize,
    network_interfaces: secondaryVnic,
    primary_network_interface: primaryVnic,
    profile: {
      name: profile.name
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    enable_secure_boot: data.enable_secure_boot || enable_secure_boot,
    disks: disks,
    boot_target: disks && disks[0],
    status: data.status ? data.status : 'running',
    // after create to stop, reboot etc. status is required as 'running'
    trusted_platform_module: data.trusted_platform_module || {
      enabled: enable_secure_boot && _casual["default"].integer(0, 5) % 5 !== 1,
      mode: _casual["default"].integer(0, 5) % 5 !== 1 ? 'tpm_2' : 'tpm_2_with_txt'
    },
    vpc: {
      id: vpc.id
    },
    firmware: firmware,
    zone: zone // has extra region_name
  };

  if (userData) {
    // add userdata if provided
    baseData.initialization.user_data = userData;
  }
  if (data.status !== 'running' && _casual["default"].integer(0, 2) === 0 && randomFromInit) {
    // add some randomized statuses for resource suspension and firmware updates.
    if (_casual["default"].integer(0, 2) === 0) {
      data.status = 'stopped';
      baseData.lifecycle_state = 'updating';
    } else if (_casual["default"].integer(0, 2) === 1) {
      data.status = 'stopped';
      baseData.lifecycle_state = 'failed';
      baseData.lifecycle_reasons = [{
        code: 'firmware_update_failed',
        message: 'Mock message from Rias - your firmware update timed out'
      }];
    } else if (_casual["default"].coin_flip) {
      data.status = 'stopped';
      baseData.lifecycle_state = 'suspended';
      baseData.lifecycle_reasons = [{
        code: 'resource_suspended_by_provider ',
        message: 'You have been caught doing nefarious things, you! Server has been suspended.'
      }];
    }
  }
  var newInstance = _objectSpread(_objectSpread({}, baseData), data);
  if (!newInstance.name) {
    newInstance.name = utils.generateName('bare-metal', newInstance.zone);
  }
  instances.insert(newInstance);
  return newInstance;
};

/**
 * init()
 * Initialize Instances
 */
exports.addInstance = addInstance;
var init = function init() {
  var instances = _server.db.addCollection(_server.COLS.bm_instances);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Note: vpc 'vpc1001' is for subnet 'subnet-1'
  addInstance(instances, {
    id: 'baremetal-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'AAA-BareMetal-01',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION
  });

  // Note: vpc 'vpc1002' is for subnet 'subnet-2'
  addInstance(instances, {
    id: 'baremetal-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'AAA-BareMetal-02',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION
  });
  addInstance(instances, {
    id: 'baremetal-cccc-cccc-cccc-cccccccccccc',
    name: 'aaa-cy-test-baremetal',
    subnet: {
      id: 'subnet-1'
    },
    status: 'stopped',
    regionName: utils.DEFAULT_REGION
  });
  addInstance(instances, {
    id: 'baremetal-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
    name: 'cy-test-baremetal-random',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    status: getRandomStatus()
  });
  addInstance(instances, {
    id: 'baremetal-dddd-dddd-dddd-dddddddddddd',
    name: 'aaa-default-baremetal-instance-delete',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'baremetal-ssss-ssss-ssss-ssssssssssss',
    name: 'aaaaa-default-baremetal-instance-delete',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'baremetal-eeee-eeee-eeee-eeeeeeeeee',
    name: 'aaa-default-baremetal-instance-01',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'baremetal-ffff-ffff-ffff-ffffffffff',
    name: 'aaa-default-baremetal-instance-02',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    status: 'running'
  });
  addInstance(instances, {
    id: 'baremetal-gggg-gggg-gggg-gggggggggggg',
    name: 'aaa-default-baremetal-instance-03',
    subnet: {
      id: 'reserved-subnet-1'
    },
    reservedIPData: {
      primary: {
        address: (0, _reserved_private_ips.createCustomReservedIpAddress)('reserved-subnet-1'),
        name: 'aaa-reservedIp-bm-custom-ip-primary'
      },
      secondary: {
        address: (0, _reserved_private_ips.createCustomReservedIpAddress)('reserved-subnet-1'),
        name: 'aaa-reservedIp-bm-custom-ip-secondary'
      }
    },
    regionName: utils.DEFAULT_REGION
  });
  utils.repeat(function () {
    addInstance(instances, {
      status: getRandomStatus()
    }, undefined, true);
  }, 120);
};

/**
 * formatInstanceForClient()
 *
 * format the Instance to include href, crn etc for all subresources.
 *
 * @param {*} req
 * @param {*} instance
 */
exports.init = init;
var formatInstanceForClient = function formatInstanceForClient(instance, req, res) {
  var href = "".concat(utils.getBaseApiUrl(req), "bare_metal_servers/").concat(instance.id);
  var profile = getResponseObjectWithName(_server.COLS.bm_profiles, instance.profile.name, req);
  var vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, instance.vpc.id);

  // primary network interface
  var primaryVnicId = _lodash["default"].get(instance, 'primary_network_interface.id', undefined);
  var primaryVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(primaryVnicId, req, res, true);
  var primaryVnicHref = "".concat(utils.getBaseApiUrl(req), "bare_metal_servers/").concat(instance.id, "/").concat(_server.COLS.network_interfaces, "/").concat(primaryVnicId);
  // secondary network interfaces
  var secondaryVnicsIds = _lodash["default"].get(instance, 'network_interfaces', undefined);
  var secondaryVnics = secondaryVnicsIds && secondaryVnicsIds.map(function (item) {
    var vnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(item.id, req, res, true);
    var vnicHref = "".concat(utils.getBaseApiUrl(req), "bare_metal_servers/").concat(instance.id, "/").concat(_server.COLS.network_interfaces, "/").concat(item.id);
    return _objectSpread(_objectSpread({}, vnic), {}, {
      href: vnicHref
    });
  });
  var id = instance.id,
    name = instance.name,
    cpu = instance.cpu,
    firmware = instance.firmware,
    created_at = instance.created_at,
    memory = instance.memory,
    resource_group = instance.resource_group,
    status = instance.status,
    lifecycle_state = instance.lifecycle_state,
    lifecycle_reasons = instance.lifecycle_reasons,
    zone = instance.zone,
    trusted_platform_module = instance.trusted_platform_module,
    enable_secure_boot = instance.enable_secure_boot,
    disks = instance.disks,
    boot_target = instance.boot_target;
  if (resource_group && !resource_group.name) {
    var _utils$getResource$;
    resource_group.name = (_utils$getResource$ = utils.getResource(_server.COLS.resourceGroups, resource_group.id)[0]) === null || _utils$getResource$ === void 0 ? void 0 : _utils$getResource$.name;
  }
  var result = {
    id: id,
    crn: utils.updateResourceCrnRegion(instance, req),
    name: name,
    cpu: cpu,
    firmware: firmware,
    created_at: created_at,
    memory: memory,
    resource_group: resource_group,
    status: status,
    lifecycle_state: lifecycle_state,
    lifecycle_reasons: lifecycle_reasons,
    zone: zone,
    href: href,
    profile: profile,
    vpc: vpc,
    trusted_platform_module: _objectSpread(_objectSpread({}, trusted_platform_module), {}, {
      supported_modes: ['tpm_2', 'tpm_2_with_txt']
    }),
    enable_secure_boot: enable_secure_boot,
    disks: disks,
    boot_target: boot_target,
    primary_network_interface: _objectSpread(_objectSpread({}, primaryVnic), {}, {
      href: primaryVnicHref
    }),
    network_interfaces: [_objectSpread(_objectSpread({}, primaryVnic), {}, {
      href: primaryVnicHref
    })].concat(_toConsumableArray(secondaryVnics))
  };
  return result;
};

/*
 * This function does the actual filtering and filters by a specific field and parameter.
 * This is just a way to reuse code for the different parameters.
 */
var filterBySubnetWithQuery = function filterBySubnetWithQuery(req, res, resource, queryParam, fieldName) {
  var primaryVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(_lodash["default"].get(resource, 'primary_network_interface').id, req, res, true);
  if (_lodash["default"].get(primaryVnic, fieldName) === queryParam) {
    return true;
  }
  var vnics = _lodash["default"].get(resource, 'network_interfaces');
  if (vnics.find(function (vnic) {
    var fullVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(vnic.id, req, res, true);
    return _lodash["default"].get(fullVnic, fieldName) === queryParam;
  })) {
    return true;
  }
  return false;
};

/*
 * The instances call supports extra query parameters.  These parameters filter based on the subnet
 * containing the instance.  We need to add these as extra filters on the where clause when getting
 * the list of instances.
 */
var filter = function filter(req, res, resource) {
  // We need to filter by types here, so that eventually we can support multiple filters.

  // Filter by subnet
  if (req.query['network_interfaces.subnet.id']) {
    return filterBySubnetWithQuery(req, res, resource, req.query['network_interfaces.subnet.id'], 'subnet.id');
  }
  if (req.query['network_interfaces.subnet.crn']) {
    return filterBySubnetWithQuery(req, res, resource, req.query['network_interfaces.subnet.crn'], 'subnet.crn');
  }
  if (req.query['network_interfaces.subnet.name']) {
    return filterBySubnetWithQuery(req, res, resource, req.query['network_interfaces.subnet.name'], 'subnet.name');
  }

  // Filter other types

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};

/**
 * getInstances()
 * GET /instances
 * @param {*} req
 * @param {*} res
 */
var getInstances = function getInstances(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var instances = utils.getResources(req, _server.COLS.bm_instances, extraFilter);
  var response = instances.bm_instances.map(function (instance) {
    return formatInstanceForClient(instance, req, res);
  });
  delete instances.bm_instances;
  res.json(_objectSpread(_objectSpread({}, instances), {}, {
    bare_metal_servers: response
  })).end();
};

/**
 * getInstance()
 * GET /instances/{id}
 * @param {*} req
 * @param {*} res
 */
exports.getInstances = getInstances;
var getInstance = function getInstance(req, res) {
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  if (!instance) return;
  res.json(formatInstanceForClient(instance, req, res)).end();
};

/**
 * createInstance()
 * POST /instances
 * Create a BM.
 * @param {*} req
 * @param {*} res
 */
exports.getInstance = getInstance;
var createInstance = function createInstance(req, res) {
  var input = req.body;
  input.fromRequest = true;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.bm_instances), input, req, res, 'resource with that name already exists', 'instance')) {
    return;
  }

  // Verify zone exists
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }

  // Verify that a valid profile was provided.
  var profile_name = _lodash["default"].get(input, 'profile.name');
  var profile = _server.db.getCollection(_server.COLS.bm_profiles).findOne({
    name: profile_name
  });
  if (!profile) {
    res.status(400).json(utils.generateErrors('Must provide a valid profile name', 'profile_error', 'profile.name')).end();
    return;
  }
  var id = addInstance(_server.db.getCollection(_server.COLS.bm_instances), input).id;
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  var instance;
  instance = utils.findResource(_server.COLS.bm_instances, id, res, false);

  // Create and add a network interface
  var net_interfaces = (0, _network_interfaces.createNetworkInterfaces)(input, id, res, 'bm');
  var updatedInstance = _objectSpread(_objectSpread({}, instance), net_interfaces);
  // update instance with new network interfaces and fetch updated instance
  instances.update(updatedInstance);
  instance = utils.findResource(_server.COLS.bm_instances, id, res, false);
  res.status(201).json(formatInstanceForClient(instance, req, res)).end();
};

/**
 * deleteInstance()
 * DELETE /instances/{id}
 * Delete a BM.
 * @param {*} req
 * @param {*} res
 */
exports.createInstance = createInstance;
var deleteInstance = function deleteInstance(req, res) {
  var _instance$primary_net;
  var bare_metal_server_id = req.params.bare_metal_server_id;
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  var instance = utils.findResource(_server.COLS.bm_instances, bare_metal_server_id, res, false);
  if (!instance) {
    // Not found return a 404
    res.status(204).end();
    return;
  }
  if ((_instance$primary_net = instance.primary_network_interface) !== null && _instance$primary_net !== void 0 && _instance$primary_net.id) {
    (0, _network_interfaces.deleteNetworkInterfaceFn)(instance.primary_network_interface.id, bare_metal_server_id, utils.fakeResponse);
  }
  instance.network_interfaces.forEach(function (vnic) {
    return (0, _network_interfaces.deleteNetworkInterfaceFn)(vnic.id, bare_metal_server_id, utils.fakeResponse);
  });

  // Now delete the instance itself
  instances.remove(instance);
  res.status(204).end();
};

/**
 * updateInstance()
 * PATCH /instances/{id}
 * Update details in an existing Instance.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteInstance = deleteInstance;
var updateInstance = function updateInstance(req, res) {
  var input = req.body;
  var instances = _server.db.getCollection(_server.COLS.bm_instances);
  var previousInstance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  if (!previousInstance) return;
  var updatedInstance = _objectSpread(_objectSpread({}, previousInstance), input);
  instances.update(updatedInstance);
  res.status(200).json(formatInstanceForClient(updatedInstance, req, res)).end();
};

/**
 * getInitConfiguration()
 * GET /instances/{bare_metal_server_id}/initialization
 * Retrieves configuration variables used to initialize the instance such as SSH keys and the Windows administrator password.
 * @param {*} req
 * @param {*} res
 */
exports.updateInstance = updateInstance;
var getInitConfiguration = function getInitConfiguration(req, res) {
  var instance = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res);
  if (!instance) return;
  var _instance$initializat2 = instance.initialization,
    keys = _instance$initializat2.keys,
    image = _instance$initializat2.image,
    user_accounts = _instance$initializat2.user_accounts;
  var imageObj = utils.getAndFormatResourceLinkForClient(req, _server.COLS.images, image.id);
  var formattedKeys = [];
  keys.forEach(function (key) {
    return formattedKeys.push((0, _keys.formatKeyForClient)(key.id, req, res));
  });
  var formattedAccounts = (user_accounts || []).map(function (account) {
    var encryption_key = account.encryption_key,
      rest = _objectWithoutProperties(account, _excluded2);
    return _objectSpread({
      resource_type: 'host_user_account',
      encryption_key: encryption_key && (0, _keys.formatKeyForClient)(encryption_key.id, req, res)
    }, rest);
  });
  res.status(200).json({
    keys: formattedKeys,
    image: imageObj,
    user_accounts: formattedAccounts
  }).end();
};
exports.getInitConfiguration = getInitConfiguration;
var formatDisk = function formatDisk(serverID, disk, req) {
  return _objectSpread({
    href: "".concat(utils.getBaseApiUrl(req), "bare_metal_servers/").concat(serverID, "/disks/").concat(disk.id),
    resource_type: 'bare_metal_server_disk'
  }, disk);
};

/**
 * getDisks()
 *
 * list disks
 *
 * GET /bare_metal_servers/{bare_metal_server_id}/disks
 *
 * @param {*} req
 * @param {*} res
 */
var getDisks = function getDisks(req, res) {
  var bms = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  if (!bms) {
    res.status(404).end();
    return;
  }
  var disks = bms.disks ? bms.disks.map(function (disk) {
    return formatDisk(bms.id, disk, req);
  }) : [];
  res.json({
    disks: disks
  }).end();
};

/**
 * getDisk()
 *
 * Get a disk
 *
 * GET /bare_metal_servers/{bare_metal_server_id}/disks/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDisks = getDisks;
var getDisk = function getDisk(req, res) {
  var bms = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  if (!bms) {
    res.status(404).end();
    return;
  }
  var disk = bms.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  res.json(formatDisk(bms.id, disk, req)).end();
};

/**
 * updateDisk()
 *
 * update a disk.
 *
 * PATCH /bare_metal_servers/{bare_metal_server_id}/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDisk = getDisk;
var updateDisk = function updateDisk(req, res) {
  var bms = utils.findResource(_server.COLS.bm_instances, req.params.bare_metal_server_id, res, false);
  if (!bms) {
    res.status(404).end();
    return;
  }
  var disk = bms.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  var body = req.body;
  disk.name = body.name;
  var bmss = _server.db.getCollection(_server.COLS.bm_instances);
  bmss.update(bms);
  res.status(200).json(formatDisk(bmss.id, disk, req, res)).end();
};
exports.updateDisk = updateDisk;