"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateInstanceDisk = exports.updateInstance = exports.postActionForInstance = exports.init = exports.getVolumeAttachment = exports.getResponseObjectWithName = exports.getInstances = exports.getInstanceDisks = exports.getInstanceDisk = exports.getInstance = exports.getInitConfiguration = exports.getActionsList = exports.getActionForInstance = exports.deletePendingActionForInstance = exports.deleteInstance = exports.createInstance = exports.addInstance = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _network_interfaces = require("./network_interfaces");
var _keys = require("./keys");
var _volumes = require("./volumes");
var _dedicated_hosts = require("./dedicated_hosts");
var _dedicated_host_groups = require("./dedicated_host_groups");
var _volumeAttachments = require("./volumeAttachments");
var _hyperwarp = require("../utils/hyperwarp");
var _privatecatalog = require("../external/resources/privatecatalog");
var _features = require("./features");
var _excluded = ["id", "instanceID"];
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
var statusReasons = require('./instance_status_reasons.json');
var InstanceStatuses = ['pending', 'failed', 'paused', 'pausing', 'running', 'starting', 'stopped', 'stopping', 'restarting', 'resuming'];
// const ActionCompletionStatuses = ['pending', 'running', 'failed', 'completed'];

var PLACEMENT_RESOURCE_TYPE = {
  DEDICATED_HOST: 'dedicated_host',
  DEDICATED_GROUP: 'dedicated_host_group',
  PLACEMENT_GROUP: 'placement_group'
};
var AVAILABIBILITY_POLICY_HOST_FAILURES = ['restart', 'stop'];
/**
 * We want to make it look like most of the instances are running so
 * we'll only use the other instances state 25% of the time.
 */
var getRandomStatus = function getRandomStatus(type) {
  if (_casual["default"].integer(0, 4) % 4 === 0) {
    return _casual["default"].random_element(type);
  }
  return type === InstanceStatuses ? 'running' : 'completed';
};
var InstancesCPUArchitectures = ['amd64'];
var getVolumeAttachment = function getVolumeAttachment(volumeId) {
  return {
    id: _casual["default"].uuid,
    href: '',
    // Placholder
    name: utils.generateName('vol'),
    volume: {
      id: volumeId
    }
  };
};

// Returns invalid href for profiles
exports.getVolumeAttachment = getVolumeAttachment;
var getResponseObjectWithName = function getResponseObjectWithName(type, resourceName, req) {
  var resource = _server.db.getCollection(type).chain().find({
    name: resourceName
  }).data({
    removeMeta: true
  });
  return _objectSpread(_objectSpread({}, resource[0]), {}, {
    href: "".concat(utils.getBaseApiUrl(req)).concat(type, "/").concat(resource[0].id),
    crn: utils.updateResourceCrnRegion(resource, req)
  });
};

/**
 * addAction()
 * Util to create a action type object.
 * @param {*} data - data: { type: '' } - input contains the type of action - start, stop, reboot, reset.
 */
exports.getResponseObjectWithName = getResponseObjectWithName;
var addAction = function addAction(data) {
  var baseData = {
    id: _casual["default"].uuid,
    // href: '',
    type: '',
    // start, stop, reboot, reset
    created_at: utils.generateNowDate(),
    started_at: utils.generateFutureTimestamp(2, 'minutes'),
    completed_at: utils.generateFutureTimestamp(5, 'minutes'),
    status: 'completed'
  };
  return _objectSpread(_objectSpread({}, baseData), data);
};

/**
 * getActionForInstance()
 * GET /instances/{instance_id}/actions/{id}
 * @param {*} req
 * @param {*} res
 */
var getActionForInstance = function getActionForInstance(req, res) {
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res);
  var actions = instance.actions;
  var action = actions.find(function (item) {
    return item.id === req.params.action_id;
  });
  res.json(action).end();
};

/**
 * getActionsList
 * GET /instances/{instance_id}/actions
 * @param {*} req
 * @param {*} res
 */
exports.getActionForInstance = getActionForInstance;
var getActionsList = function getActionsList(req, res) {
  var DEFAULT_LIMIT = 10;
  var DEFAULT_OFFSET = 0;
  // UI-4375 - fixes an issue with the inital pagination 'next'
  // value returning NaN, which would break pagination in the UI.
  var reqLimit = _lodash["default"].get(req, 'query.limit', DEFAULT_LIMIT);
  if (reqLimit === '') {
    reqLimit = DEFAULT_LIMIT;
  }
  var reqStart = _lodash["default"].get(req, 'query.start', DEFAULT_OFFSET);
  if (reqStart === '') {
    reqStart = DEFAULT_OFFSET;
  }
  var limit = Number.parseInt(reqLimit, 10);
  var offset = Number.parseInt(reqStart, 10);
  var next = offset + limit;
  var resources = {
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };
  var type = 'actions';
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res);
  var actions = instance.actions;
  resources[type] = actions;
  if (next > resources[type].length) {
    delete resources.next;
  }
  resources[type].forEach(function (resource) {
    resource.href = "".concat(utils.getBaseUrl(req), "/").concat(resource.id);
  });
  res.status(200).json(resources).end();
};

/**
 * deletePendingActionForInstance()
 * DELETE /instances/{instance_id}/actions/{id}
 * This request will only succeed if the action is currently pending.
 * @param {*} req
 * @param {*} res
 */
exports.getActionsList = getActionsList;
var deletePendingActionForInstance = function deletePendingActionForInstance(req, res) {
  var instances = _server.db.getCollection(_server.COLS.instances);
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  var actions = instance.actions;
  var action = actions.find(function (item) {
    return item.id === req.params.action_id;
  });
  if (action.status === 'pending') {
    var updatedActions = actions.map(function (item) {
      return item.id !== req.params.action_id;
    });
    instances.update(_objectSpread(_objectSpread({}, instance), updatedActions));
    res.status(204).end();
  }
  // TODO: Add error and trace information to this response.
  res.status(400).end();
};

/**
 * postActionForInstance()
 * POST /instances/{instance_id}/actions
 * @param {*} req
 * @param {*} res
 */
exports.deletePendingActionForInstance = deletePendingActionForInstance;
var postActionForInstance = function postActionForInstance(req, res) {
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  var _instance$actions = instance.actions,
    actions = _instance$actions === void 0 ? [] : _instance$actions;
  var input = req.body;
  var type = input.type;
  var newAction = addAction({
    type: type
  });
  actions.push(newAction);
  var instances = _server.db.addCollection(_server.COLS.instances);
  instances.update(_objectSpread(_objectSpread(_objectSpread({}, instance), actions), {}, {
    status: 'stopped'
  }));
  setTimeout(function () {
    var status;
    var eventType;
    if (type === 'stop') {
      status = 'stopped';
      eventType = 'virtualmachine.stopped';
    } else if (type === 'start' || type === 'reset' || type === 'reboot') {
      status = 'running';
      eventType = 'virtualmachine.started';
    }
    var inst = utils.findResource(_server.COLS.instances, instance.id, res, false);
    inst.status = status;
    instances.update(inst);
    (0, _hyperwarp.sendHyperwarpEvent)(eventType, inst.crn);
  }, utils.isHyperwarpEnabled() && 5000 || 0);
  newAction.href = "".concat(utils.getBaseUrl(req), "/").concat(newAction.id);
  res.status(201).json(newAction).end();
};
exports.postActionForInstance = postActionForInstance;
var setInstancePropsFromProfile = function setInstancePropsFromProfile(instance, profile) {
  var _profile$secure_boot_;
  instance.profile = {
    name: profile.name
  };
  instance.memory = profile.memorySize;
  instance.bandwidth = profile.bandwidth;
  instance.numa_count = profile.numa_count || 2; // gen2 profile doesn't have numa count attribute
  if (!instance.cpu) {
    instance.vcpu = {
      architecture: _casual["default"].random_element(InstancesCPUArchitectures),
      manufacturer: profile.vcpuManufacturer || 'Intel',
      count: profile.numberOfVirtualCPUs,
      frequency: _casual["default"].integer(1, 8) * 500,
      family: profile.vcpuFamily
    };
  } else {
    instance.vcpu.count = profile.numberOfVirtualCPUs;
  }
  if (profile.disks) {
    /*
     * set local disk info for VSI when the profile is local disk profile
     */
    var instanceDisks = _lodash["default"].flatten(profile.disks.map(function (disk) {
      return utils.repeat(function () {
        return {
          id: _casual["default"].uuid,
          name: "instance-disks-".concat(_casual["default"].word),
          interface_type: _casual["default"].random_element(disk.supported_interface_types),
          created_at: utils.generateNowDate(),
          resource_type: 'instance_disk',
          instanceID: instance.id,
          size: disk.size
        };
      }, disk.quantity);
    }));
    instance.disks = instanceDisks;
  }
  if (profile.confidential_compute_modes && (_profile$secure_boot_ = profile.secure_boot_modes) !== null && _profile$secure_boot_ !== void 0 && _profile$secure_boot_["default"]) {
    instance.confidential_compute_mode = profile.confidential_compute_modes["default"];
    instance.enable_secure_boot = profile.secure_boot_modes["default"];
  }
};
var setPlacementTarget = function setPlacementTarget(data, target) {
  var targetID = target.id;
  /**
   * If dedicated_host placement was specified add it here.
   */
  var dedicated_host_id = _lodash["default"].get(data, 'dedicated_host.id', undefined);
  if (dedicated_host_id && dedicated_host_id === targetID) {
    (0, _dedicated_hosts.addInstanceToDedicatedHost)(dedicated_host_id, data.id);
  }
};

/**
 * addInstance()
 * Add a VSI instance
 * @param {*} instances: List of instances
 * @param {*} data: details of the new VSI to be added to the List of instances
 */
var addInstance = function addInstance(instances, data, res) {
  var _data$boot_volume_att, _data$boot_volume_att2, _data$boot_volume_att3, _data$catalog_offerin, _data$catalog_offerin2;
  var id = data.id ? data.id : _casual["default"].uuid;
  var regionName = data.regionName || '';
  var inputProfileInfo = data.profile && utils.findResource(_server.COLS.profiles, data.profile.name);
  var profile = inputProfileInfo || utils.getRandomResource(_server.COLS.profiles);
  var image = utils.getRandomResource(_server.COLS.images);
  var isBootFromVolumeSnapshot = false;
  if (data.image) {
    image = utils.findResource(_server.COLS.images, data.image.id, res, false);
  } else if ((_data$boot_volume_att = data.boot_volume_attachment) !== null && _data$boot_volume_att !== void 0 && (_data$boot_volume_att2 = _data$boot_volume_att.volume) !== null && _data$boot_volume_att2 !== void 0 && (_data$boot_volume_att3 = _data$boot_volume_att2.source_snapshot) !== null && _data$boot_volume_att3 !== void 0 && _data$boot_volume_att3.id) {
    isBootFromVolumeSnapshot = true;
  }
  // Use pre-defined subnet to fetch associated vpc instead of using random vpc
  var subnet = data.subnet && utils.findResource(_server.COLS.subnets, data.subnet.id) || (regionName ? utils.getRandomResourceInZone(_server.COLS.subnets, regionName) : utils.getRandomResource(_server.COLS.subnets));
  var zone = utils.findZone(subnet.zone.name);
  regionName = regionName || zone.region_name;
  // const sg = utils.getRandomResource(COLS.security_groups);
  var vpc = utils.findResource(_server.COLS.vpcs, subnet.vpc.id);
  var key = utils.getRandomResourceInRegion(_server.COLS.keys, regionName);

  /**
   * Fill in random dedicated_host information -
   * only if not coming from an actual create request and no placement_target provided from data
   * Note for randomized data we only support random placement by "dedicated_host" not by
   * "dedicated_host_group" this allows us to avoid resource limitation issues.
   */
  if (!data.fromRequest && !data.placement_target) {
    if (_casual["default"].random_element([true, false, false, false, false])) {
      var _dedicated_host$name;
      // We have been selected for potential addition as a dedicated_host instance
      var dedicated_host = utils.getRandomZonalResourceInZone(_server.COLS.dedicated_hosts, zone.name);
      if (dedicated_host && !(dedicated_host !== null && dedicated_host !== void 0 && (_dedicated_host$name = dedicated_host.name) !== null && _dedicated_host$name !== void 0 && _dedicated_host$name.includes('delete'))) {
        data.dedicated_host = {
          id: dedicated_host.id
        };
        data.placement_target = {
          id: dedicated_host.id,
          resource_type: PLACEMENT_RESOURCE_TYPE.DEDICATED_HOST
        };
      }
    } else if (_casual["default"].random_element([true, false, false, false])) {
      var _placementGroup$name;
      // We have been selected for potential addition as a placement group instance
      var placementGroup = utils.getRandomResourceInRegion(_server.COLS.placement_groups, regionName);
      if (placementGroup && !(placementGroup !== null && placementGroup !== void 0 && (_placementGroup$name = placementGroup.name) !== null && _placementGroup$name !== void 0 && _placementGroup$name.includes('delete'))) {
        data.placement_target = {
          id: placementGroup.id,
          resource_type: PLACEMENT_RESOURCE_TYPE.PLACEMENT_GROUP
        };
      }
    }
  }
  var status = data.status;
  var status_reasons;

  /**
   * We want to make sure all newly created instances show up as running.
   * only set random status with pre-loaded vsi
   * */
  if (!(res && status)) {
    status = getRandomStatus(InstanceStatuses);
  }
  if (res && !status) {
    status = 'running';
  }
  if (status !== 'running') {
    status_reasons = [_casual["default"].random_element(statusReasons)];
  }
  var actionsArray = [addAction({
    type: 'start'
  }), addAction({
    type: 'stop'
  }), addAction({
    type: 'start'
  })];

  /**
   * availability_policy
   * */
  var availability_policy = data.availability_policy ? _objectSpread({}, data.availability_policy) : {
    host_failure: _casual["default"].random_element(AVAILABIBILITY_POLICY_HOST_FAILURES)
  };
  /**
   * Assign a default subnet to initial instances
   * */
  var defaultSubnet = data.name && data.subnet && utils.findResource(_server.COLS.subnets, data.subnet.id);

  // add primary and secondary network interfaces
  var primaryVnic = (0, _network_interfaces.addNetworkInterface)(_objectSpread({
    name: data.name ? "primary-".concat(data.name) : utils.generateName('primary'),
    subnet: {
      id: defaultSubnet ? defaultSubnet.id : subnet.id
    },
    zone: defaultSubnet ? defaultSubnet.zone : zone,
    security_groups: data.security_groups ? data.security_groups : [{
      id: vpc.default_security_group.id
    }]
  }, data.primary_network_interface), id, res, true);
  var secondaryVnic = data.network_interfaces ? data.network_interfaces.map(function (item) {
    return (0, _network_interfaces.addNetworkInterface)(item, id, res);
  }) : [(0, _network_interfaces.addNetworkInterface)({
    name: data.name ? "secondary-".concat(data.name) : utils.generateName('secondary'),
    subnet: {
      id: defaultSubnet ? defaultSubnet.id : subnet.id
    },
    zone: defaultSubnet ? defaultSubnet.zone : zone,
    security_groups: data.security_groups ? data.security_groups : [{
      id: vpc.default_security_group.id
    }]
  }, id, res, false)];
  var baseData = {
    id: id,
    crn: utils.generateCRN({
      id: id
    }),
    href: '',
    // Placeholder
    // random ID for boot volume for now as volumes do not exist.
    boot_volume_attachment: getVolumeAttachment(_casual["default"].uuid),
    created_at: utils.generateCreateDate(),
    default_trusted_profile: {
      auto_link: true,
      target: {
        id: utils.getRandomTrustedProfileId()
      }
    },
    image: {
      id: image.id
    },
    network_interfaces: secondaryVnic,
    primary_network_interface: primaryVnic,
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    metadata_service: {
      enabled: true
    },
    startable: true,
    status: status,
    status_reasons: status_reasons,
    volume_attachments: [],
    vpc: {
      id: vpc.id
    },
    zone: zone,
    // has extra region_name
    keys: [{
      id: key.id
    }],
    actions: actionsArray,
    availability_policy: _objectSpread({}, availability_policy)
  };
  if (image.operating_system.vendor === 'Microsoft') {
    /*
     * Windows VMs use a password instead of allowing login with an SSH key.
     * If we got a Microsoft image then we want to add a password to the base
     * data - UI-5231
     */
    baseData.password = '<this is the encrypted Windows admin password>';
  }
  setInstancePropsFromProfile(baseData, profile);
  var newInstance = _objectSpread(_objectSpread(_objectSpread({}, baseData), data), {}, {
    bandwidth: profile.bandwidth,
    total_network_bandwidth: data.total_volume_bandwidth ? profile.bandwidth - data.total_volume_bandwidth : Math.floor(profile.bandwidth * (1 - utils.defaultVolumeBandWdithRatio)),
    total_volume_bandwidth: data.total_volume_bandwidth || Math.floor(profile.bandwidth * utils.defaultVolumeBandWdithRatio)
  });
  if ((_data$catalog_offerin = data.catalog_offering) !== null && _data$catalog_offerin !== void 0 && _data$catalog_offerin.version || (_data$catalog_offerin2 = data.catalog_offering) !== null && _data$catalog_offerin2 !== void 0 && _data$catalog_offerin2.offering) {
    newInstance.catalog_offering = data.catalog_offering;
  } else if (!data.fromRequest && _casual["default"].integer(0, 4) % 4 === 0) {
    var version = (0, _privatecatalog.getRandomCatalogVersion)();
    newInstance.catalog_offering = {
      version: {
        crn: version.crn
      }
    };
  }
  if (!newInstance.name) {
    newInstance.name = utils.generateName('instance', newInstance.zone);
  }
  if (isBootFromVolumeSnapshot) {
    delete newInstance.image;
  }
  if (!newInstance.metadata_service.protocol) {
    newInstance.metadata_service.protocol = 'http';
  }
  if (!newInstance.metadata_service.response_hop_limit) {
    newInstance.metadata_service.response_hop_limit = 1;
  }
  instances.insert(newInstance);

  /**
   * If dedicated_host placement was specified add it here.
   */
  var placementTarget = _lodash["default"].get(data, 'placement_target');
  if (placementTarget) {
    setPlacementTarget(baseData, placementTarget);
  }
  return newInstance;
};

/**
 * init()
 * Initialize Instances
 */
exports.addInstance = addInstance;
var init = function init() {
  var instances = _server.db.addCollection(_server.COLS.instances);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Note: vpc 'vpc1001' is for subnet 'subnet-1'
  addInstance(instances, {
    id: 'instance-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'AAA-Instance-01',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    profile: {
      name: 'bx2-2x8'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'instance-aaaa-aaaa-aaaa-tobedeleted',
    name: 'AAA-Instance-to-be-deleted',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    profile: {
      name: 'bx2-2x8'
    },
    status: 'running'
  });

  // Note: vpc 'vpc1002' is for subnet 'subnet-2'
  addInstance(instances, {
    id: 'instance-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'AAA-Instance-02',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      resource_tyoe: 'dedicated_host'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'instance-cccc-cccc-cccc-cccccccccccc',
    name: 'cy-test-instance',
    subnet: {
      id: 'subnet-1'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    regionName: utils.DEFAULT_REGION
  });
  addInstance(instances, {
    id: 'instance-dddd-dddd-dddd-dddddddddddddd',
    name: 'AAA-Instance-03',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    }
  });
  addInstance(instances, {
    id: 'instance-eeee-eeee-eeee-eeeeeeeeeeeeeee',
    name: 'AAA-Instance-04',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'failed'
  });
  addInstance(instances, {
    id: 'instance-sn-1-inst-05',
    name: 'aaaa-Instance-05',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'instance-sn-1-inst-06',
    name: 'aaaa-Instance-06',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'instance-sn-1-inst-07',
    name: 'aaaa-Instance-07',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: null
  });
  addInstance(instances, {
    id: 'aaa-instance-new-sn-1-inst-08',
    name: 'aaaa-instance-new-08',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-new-sn-1-inst-09',
    name: 'aaaa-instance-new-09',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-new-sn-1-inst-10',
    name: 'aaaa-instance-new-10',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-new-sn-1-inst-11',
    name: 'aaaa-instance-new-11',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-new-sn-1-inst-12',
    name: 'aaaa-instance-new-12',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-multi-zone-nics-vsi-id',
    name: 'aaa-multi-zone-nics-vsi',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running',
    network_interfaces: [{
      id: 'vnic-aaaa-aaaa-aaaa-bbbbbbbbbbbb',
      name: utils.generateName('secondary'),
      subnet: {
        id: 'subnet-3',
        name: 'aaa-default-subnet-3'
      }
    }]
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-11',
    name: 'aaaa-instance-test',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-12',
    name: 'aaaa-instance-test-1',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-13',
    name: 'aaaa-instance-test-2',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-14',
    name: 'aaaa-instance-test-3',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-pg-1-inst-21',
    name: 'aaaa-instance-vsi-test-resize',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-21',
    name: 'aaaa-instance-test-5',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-22',
    name: 'aaaa-instance-test-6',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-15',
    name: 'aaaa-instance-test-resize',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-16',
    name: 'aaaa-instance-test-del',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-17',
    name: 'a06-instance-test-1',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    dedicated_host: {
      id: 'dedicated-host-test-06'
    },
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-18',
    name: 'aaaa-instance-test-stop',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-dddd-dddd-dddd-dddddddddddd',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-19',
    name: 'aaaa-instance-vsi-test-del',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-eeee-eeee-eeee-eeeeeeeeeeee',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'running'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-20',
    name: 'aaaa-instance-vsi-test-create-image',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-ffff-ffff-ffff-ffffffffffff',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-23',
    name: 'aaaa-vsi-test-create-image-encryption',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-24',
    name: 'aaaa-vsi-test-create-image-kp-encryption',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'aaa-instance-test-sn-1-inst-25',
    name: 'aaaa-vsi-test-create-image-hpcs-encryption',
    subnet: {
      id: 'aaa-subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped'
  });
  addInstance(instances, {
    id: 'instance-abab-abab-abab-abababababababa',
    name: 'AAAA-block-storage-volume-ci-test',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped',
    storage_volume_available: true
  });
  addInstance(instances, {
    id: 'instance-abab-abab-abab-cdcdcdcdcdcdcdc',
    name: 'AAAA-block-storage-ci-test-2',
    subnet: {
      id: 'subnet-1'
    },
    regionName: utils.DEFAULT_REGION,
    placement_target: {
      id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'placement_group'
    },
    profile: {
      name: 'bx2d-8x32'
    },
    status: 'stopped',
    storage_volume_available: true
  });
  utils.repeat(function () {
    addInstance(instances, {});
  }, _features.shouldGenerateLotsOfResources ? 350 : 50);
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
  var _boot_volume_attachme;
  var href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(instance.id);
  var image;
  var imageID;
  if (instance.image) {
    imageID = instance.image.id;
  }
  var profile = getResponseObjectWithName(_server.COLS.profiles, instance.profile.name, req);
  var vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, instance.vpc.id);

  // primary network interface
  var primaryVnicId = _lodash["default"].get(instance, 'primary_network_interface.id', undefined);
  var primaryVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(primaryVnicId, req, res);
  var primaryVnicHref = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(instance.id, "/").concat(_server.COLS.network_interfaces, "/").concat(primaryVnicId);
  // secondary network interfaces
  var secondaryVnicsIds = _lodash["default"].get(instance, 'network_interfaces', undefined);
  var secondaryVnics = secondaryVnicsIds && secondaryVnicsIds.map(function (item) {
    var vnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(item.id, req, res);
    var vnicHref = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.instances, "/").concat(instance.id, "/").concat(_server.COLS.network_interfaces, "/").concat(item.id);
    return _objectSpread(_objectSpread({}, vnic), {}, {
      href: vnicHref
    });
  });

  // Handle dedicated_host reference
  var dedicated_host_id = _lodash["default"].get(instance, 'dedicated_host.id', undefined);
  var dedicated_host = dedicated_host_id && utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_hosts, dedicated_host_id);

  // Handle dedicated_host placement_target reference
  var placement_target_id = _lodash["default"].get(instance, 'placement_target.id', undefined);
  var placement_target_type = _lodash["default"].get(instance, 'placement_target.resource_type');
  var placement_target;
  if (placement_target_type === PLACEMENT_RESOURCE_TYPE.DEDICATED_HOST) {
    // Placement by dedicated_host - we fetch again so we have a unique object.
    placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_hosts, placement_target_id);
  } else if (placement_target_type === PLACEMENT_RESOURCE_TYPE.DEDICATED_GROUP) {
    // Placement must be by dedicated_group
    placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_host_groups, placement_target_id);
    if (placement_target) {
      placement_target.href = "".concat(utils.getBaseApiUrl(req), "dedicated_host/groups/").concat(placement_target.id);
    }
  } else if (placement_target_type === PLACEMENT_RESOURCE_TYPE.PLACEMENT_GROUP) {
    placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.placement_groups, placement_target_id);
  }

  // todo show placement group info
  var id = instance.id,
    name = instance.name,
    vcpu = instance.vcpu,
    created_at = instance.created_at,
    memory = instance.memory,
    bandwidth = instance.bandwidth,
    metadata_service = instance.metadata_service,
    total_volume_bandwidth = instance.total_volume_bandwidth,
    total_network_bandwidth = instance.total_network_bandwidth,
    resource_group = instance.resource_group,
    status = instance.status,
    zone = instance.zone,
    disks = instance.disks,
    startable = instance.startable,
    status_reasons = instance.status_reasons,
    availability_policy = instance.availability_policy,
    catalog_offering = instance.catalog_offering,
    numa_count = instance.numa_count,
    enable_secure_boot = instance.enable_secure_boot,
    confidential_compute_mode = instance.confidential_compute_mode;
  if (resource_group && !resource_group.name) {
    var _utils$getResource$;
    resource_group.name = (_utils$getResource$ = utils.getResource(_server.COLS.resourceGroups, resource_group.id)[0]) === null || _utils$getResource$ === void 0 ? void 0 : _utils$getResource$.name;
  }
  // boot volume attachment
  var boot_volume_attachments = (0, _volumeAttachments.fetchAttachmentsForInstance)(req, instance.id, 'boot');
  var boot_volume_attachment = boot_volume_attachments[0];
  var bootVolumeID = boot_volume_attachment === null || boot_volume_attachment === void 0 ? void 0 : (_boot_volume_attachme = boot_volume_attachment.volume) === null || _boot_volume_attachme === void 0 ? void 0 : _boot_volume_attachme.id;
  if (bootVolumeID) {
    var _booVol$source_image;
    var booVol = utils.findResource(_server.COLS.volumes, bootVolumeID, res, false);
    if (booVol !== null && booVol !== void 0 && (_booVol$source_image = booVol.source_image) !== null && _booVol$source_image !== void 0 && _booVol$source_image.id) {
      var _booVol$source_image2;
      imageID = booVol === null || booVol === void 0 ? void 0 : (_booVol$source_image2 = booVol.source_image) === null || _booVol$source_image2 === void 0 ? void 0 : _booVol$source_image2.id;
    }
  }
  if (imageID) {
    image = utils.getAndFormatResourceLinkForClient(req, _server.COLS.images, imageID);
  }
  // data volume attachments
  var volume_attachments = (0, _volumeAttachments.fetchAttachmentsForInstance)(req, instance.id, 'data');
  var formattedDisks = disks ? disks.map(function (disk) {
    var diskID = disk.id,
      instanceID = disk.instanceID,
      rest = _objectWithoutProperties(disk, _excluded);
    return _objectSpread({
      href: "".concat(utils.getBaseApiUrl(req), "instances/").concat(instanceID, "/disks/").concat(diskID),
      id: diskID
    }, rest);
  }) : [];
  var result = {
    id: id,
    crn: utils.updateResourceCrnRegion(instance, req),
    name: name,
    dedicated_host: dedicated_host,
    placement_target: placement_target,
    boot_volume_attachment: boot_volume_attachment,
    vcpu: vcpu,
    created_at: created_at,
    memory: memory,
    bandwidth: bandwidth,
    total_volume_bandwidth: total_volume_bandwidth,
    total_network_bandwidth: total_network_bandwidth,
    metadata_service: metadata_service,
    resource_group: resource_group,
    status: status,
    status_reasons: status_reasons,
    startable: startable,
    volume_attachments: volume_attachments,
    zone: zone,
    href: href,
    image: image,
    profile: profile,
    numa_count: numa_count,
    disks: formattedDisks,
    enable_secure_boot: enable_secure_boot,
    confidential_compute_mode: confidential_compute_mode,
    vpc: vpc,
    primary_network_interface: _objectSpread(_objectSpread({}, primaryVnic), {}, {
      href: primaryVnicHref
    }),
    network_interfaces: [_objectSpread(_objectSpread({}, primaryVnic), {}, {
      href: primaryVnicHref
    })].concat(_toConsumableArray(secondaryVnics)),
    availability_policy: availability_policy,
    catalog_offering: catalog_offering
  };
  if (profile.numberOfVirtualGPUs) {
    result.gpu = {
      count: profile.numberOfVirtualGPUs,
      manufacturer: profile.gpuManufacturer,
      memory: profile.memorySizeGPU,
      model: profile.gpuModel
    };
  }
  return result;
};

/*
 * This function does the actual filtering and filters by a specific field and parameter.
 * This is just a way to reuse code for the different parameters.
 */
var filterByZoneWithQuery = function filterByZoneWithQuery(req, res, resource, queryParam) {
  var _resource$zone;
  return (resource === null || resource === void 0 ? void 0 : (_resource$zone = resource.zone) === null || _resource$zone === void 0 ? void 0 : _resource$zone.name) === queryParam;
};
/*
 * This function does the actual filtering and filters by a specific field and parameter.
 * This is just a way to reuse code for the different parameters.
 */
var filterBySubnetWithQuery = function filterBySubnetWithQuery(req, res, resource, queryParam, fieldName) {
  var primaryVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(_lodash["default"].get(resource, 'primary_network_interface').id, req, res);
  if (_lodash["default"].get(primaryVnic, fieldName) === queryParam) {
    return true;
  }
  var vnics = _lodash["default"].get(resource, 'network_interfaces');
  if (vnics.find(function (vnic) {
    var fullVnic = (0, _network_interfaces.getNetworkInterfaceForInstances)(vnic.id, req, res);
    return _lodash["default"].get(fullVnic, fieldName) === queryParam;
  })) {
    return true;
  }
  return false;
};
var filterByDedicatedHostWithQuery = function filterByDedicatedHostWithQuery(req, res, resource, queryParam, fieldName) {
  // For filtering by dedicated host ID we can short circuit the query for the dedicated host
  // because the instance already has the dedicated_host.id.
  if (fieldName === 'id') {
    var dedicated_host_id = _lodash["default"].get(resource, 'dedicated_host.id', undefined);
    if (dedicated_host_id === queryParam) {
      return true;
    }
    return false;
  }

  // Get the dedicated host the provided instance uses.
  var dedicatedHostId = _lodash["default"].get(resource, 'dedicated_host.id');
  if (dedicatedHostId) {
    // This instance belongs to a dedicated host, now we need to get the decicated_host.
    var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, dedicatedHostId);
    if (dedicated_host && dedicated_host[fieldName] === queryParam) {
      return true;
    }
    return false;
  }
  return false;
};
var filterByPlacementGroupWithQuery = function filterByPlacementGroupWithQuery(resource, queryParam, fieldName) {
  var placementGroupID = _lodash["default"].get(resource, 'placement_target.id');
  if (fieldName === 'id') {
    if (placementGroupID === queryParam) {
      return true;
    }
    return false;
  }

  // if query parameter is  placement group id, get the placement group the provided instance uses.
  if (placementGroupID) {
    // This instance belongs to a placement group, now we need to get the placement group.
    var placementGroup = utils.findResource(_server.COLS.placement_groups, placementGroupID);
    if (placementGroup && placementGroup[fieldName] === queryParam) {
      return true;
    }
    return false;
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

  // Filter by dedicated_host
  if (req.query['dedicated_host.crn']) {
    return filterByDedicatedHostWithQuery(req, res, resource, req.query['dedicated_host.crn'], 'crn');
  }
  if (req.query['dedicated_host.id']) {
    return filterByDedicatedHostWithQuery(req, res, resource, req.query['dedicated_host.id'], 'id');
  }
  if (req.query['dedicated_host.name']) {
    return filterByDedicatedHostWithQuery(req, res, resource, req.query['dedicated_host.name'], 'name');
  }

  // Filter by placement group
  if (req.query['placement_group.crn']) {
    return filterByPlacementGroupWithQuery(resource, req.query['placement_group.crn'], 'crn');
  }
  if (req.query['placement_group.id']) {
    return filterByPlacementGroupWithQuery(resource, req.query['placement_group.id'], 'id');
  }
  if (req.query['placement_group.name']) {
    return filterByPlacementGroupWithQuery(resource, req.query['placement_group.name'], 'name');
  }

  // Filter by zone
  if (req.query['zone.name']) {
    return filterByZoneWithQuery(req, res, resource, req.query['zone.name']);
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
  var instances = utils.getResources(req, _server.COLS.instances, extraFilter);
  var response = instances.instances.map(function (instance) {
    return formatInstanceForClient(instance, req, res);
  });
  res.json(_objectSpread(_objectSpread({}, instances), {}, {
    instances: response
  })).end();
};

/**
 * getInstance()
 * GET /instances/{id}
 * Create a VSI.
 * @param {*} req
 * @param {*} res
 */
exports.getInstances = getInstances;
var getInstance = function getInstance(req, res) {
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  if (!instance) return;
  res.json(formatInstanceForClient(instance, req, res)).end();
};

/**
 * createInstance()
 * POST /instances
 * Create a VSI.
 * @param {*} req
 * @param {*} res
 */
exports.getInstance = getInstance;
var createInstance = function createInstance(req, res) {
  var _input$image, _input$boot_volume_at, _input$boot_volume_at2, _input$boot_volume_at3, _input$boot_volume_at4, _input$boot_volume_at5, _input$image2, _input$boot_volume_at6, _input$boot_volume_at7, _input$boot_volume_at8, _input$boot_volume_at9, _bootVolData$source_i, _bootVolData$source_s;
  var input = req.body;
  input.fromRequest = true;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.instances), input, req, res, 'resource with that name already exists', 'instance')) {
    return;
  }
  if (input.source_template) {
    var template = _server.db.getCollection(_server.COLS.instance_templates).chain().find({
      id: input.source_template.id
    }).data({
      removeMeta: true
    })[0];
    if (!template) {
      res.status(404).send('instance template not found');
      return;
    }
    input = _objectSpread(_objectSpread({}, template), input);
    if (template.catalog_offering) {
      delete input.image;
    }
    delete input.id;
  }

  // Verify zone exists
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }

  // Verify that a valid profile was provided.
  var profile_name = _lodash["default"].get(input, 'profile.name');
  var profile = _server.db.getCollection(_server.COLS.profiles).findOne({
    name: profile_name
  });
  if (!profile) {
    res.status(400).json(utils.generateErrors('Must provide a valid profile name', 'profile_error', 'profile.name')).end();
    return;
  }

  // If a placement target was provided it must be either a valid dedicated_host
  // or dedicated_host_group. If one was provided we pre-select the
  // dedicated_host for the instance. If a group was selected we also validate
  // that sufficient resources are available. The consequences of doing the
  // resource check and pre-selection here is that in the add_* routine we
  // will be forced to repeat some of these actions for now.
  var placement_target_id = _lodash["default"].get(input, 'placement_target.id', undefined);
  if (placement_target_id) {
    // A placement was provided we need to validate it.
    var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, placement_target_id, null);
    if (dedicated_host) {
      // A valid dedicated_host was provided
      input.placement_target.resource_type = PLACEMENT_RESOURCE_TYPE.DEDICATED_HOST;
      input.dedicated_host = {
        id: placement_target_id
      };
    } else {
      // it was not a dedicated_host so lets check if its a dedicated_group
      var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, placement_target_id, null);
      if (dedicated_host_group) {
        // A valid dedicated_host was provided
        input.placement_target = {
          resource_type: PLACEMENT_RESOURCE_TYPE.DEDICATED_GROUP,
          id: placement_target_id
        };

        // Now try to identify a dedicated_host
        var dedicated_host_id = (0, _dedicated_host_groups.findDedicatedHostForInstance)(placement_target_id, input.profile.name);
        if (dedicated_host_id) {
          input.dedicated_host = {
            id: dedicated_host_id
          };
        } else {
          res.status(400).json(utils.generateErrors('Can not find available host in the host group', 'placement_error', 'dedicated_host_group.id')).end();
          return;
        }
      } else {
        // it was not a dedicated_host_group so lets check if its a placement_group
        var placement_group = utils.findResource(_server.COLS.placement_groups, placement_target_id, null);
        if (placement_group) {
          // A valid dedicated_host was provided
          input.placement_target = {
            resource_type: PLACEMENT_RESOURCE_TYPE.PLACEMENT_GROUP,
            id: placement_target_id
          };
        } else {
          // Not a valid dedicated_host, dedicated_group, placement_group was provided.
          var invalidMsg = 'Placement target must be a valid dedicated_host, dedicated_group, or placement_group';
          res.status(400).json(utils.generateErrors(invalidMsg, 'placement_error', 'placement_target.id')).end();
          return;
        }
      }
    }
  }
  var imageId = (_input$image = input.image) === null || _input$image === void 0 ? void 0 : _input$image.id;
  var sourceSnapshotId = (_input$boot_volume_at = input.boot_volume_attachment) === null || _input$boot_volume_at === void 0 ? void 0 : (_input$boot_volume_at2 = _input$boot_volume_at.volume) === null || _input$boot_volume_at2 === void 0 ? void 0 : (_input$boot_volume_at3 = _input$boot_volume_at2.source_snapshot) === null || _input$boot_volume_at3 === void 0 ? void 0 : _input$boot_volume_at3.id;
  var bootVolumeId = (_input$boot_volume_at4 = input.boot_volume_attachment) === null || _input$boot_volume_at4 === void 0 ? void 0 : (_input$boot_volume_at5 = _input$boot_volume_at4.volume) === null || _input$boot_volume_at5 === void 0 ? void 0 : _input$boot_volume_at5.id;
  var catalogOffering = input.catalog_offering;
  if (!imageId) {
    if (!sourceSnapshotId && !bootVolumeId && !(catalogOffering !== null && catalogOffering !== void 0 && catalogOffering.offering) && !(catalogOffering !== null && catalogOffering !== void 0 && catalogOffering.version)) {
      res.status(400).json(utils.generateErrors('image or existing boot volume or boot volume ' + 'source snapshot or catalog offering must be supplied', 'bad_field', 'image.id')).end();
      return;
    }
    if (sourceSnapshotId) {
      var sourceSnapshot = utils.findResource(_server.COLS.snapshots, sourceSnapshotId, res, false);
      if (!sourceSnapshot) {
        res.json(utils.generateErrors('snapshot not found', 'bad_field', 'boot_volume_attachment.volume.snapshot.id')).end();
        return;
      }
      if (!sourceSnapshot.source_image) {
        res.status(400).json(utils.generateErrors('boot volume source snapshot is not a bootable volume', 'bad_field', 'boot_volume_attachment.volume.snapshot.id')).end();
        return;
      }
    } else if (catalogOffering) {
      imageId = utils.getRandomResource(_server.COLS.images).id;
    } else {
      var _bootVolume = utils.findResource(_server.COLS.volumes, bootVolumeId, res, false);
      if (!_bootVolume) {
        res.json(utils.generateErrors('boot volume not found', 'bad_field', 'boot_volume_attachment.volume.id')).end();
        return;
      }
      if (!_bootVolume.source_image) {
        res.status(400).json(utils.generateErrors('provided volume is not a bootable volume', 'bad_field', 'boot_volume_attachment.volume.id')).end();
        return;
      }
    }
  }
  var imgExclusiveError = 0;
  if ((_input$image2 = input.image) !== null && _input$image2 !== void 0 && _input$image2.id) {
    imgExclusiveError++;
  }
  if ((_input$boot_volume_at6 = input.boot_volume_attachment) !== null && _input$boot_volume_at6 !== void 0 && (_input$boot_volume_at7 = _input$boot_volume_at6.source_snapshot) !== null && _input$boot_volume_at7 !== void 0 && _input$boot_volume_at7.id) {
    imgExclusiveError++;
  }
  if ((_input$boot_volume_at8 = input.boot_volume_attachment) !== null && _input$boot_volume_at8 !== void 0 && (_input$boot_volume_at9 = _input$boot_volume_at8.volume) !== null && _input$boot_volume_at9 !== void 0 && _input$boot_volume_at9.id) {
    imgExclusiveError++;
  }
  if (input.catalog_offering) {
    imgExclusiveError++;
  }
  if (imgExclusiveError > 1) {
    res.status(400).json(utils.generateErrors('Image, boot volume from snapshot,' + 'existing boot volume and catalog offering are exclusive.')).end();
    return;
  }
  var imageToVolProps;
  if (imageId) {
    var image = utils.findResource(_server.COLS.images, imageId, res, true);
    if (!image) {
      return;
    }
    imageToVolProps = {
      source_image: {
        id: image.id,
        name: image.name
      }
    };
    if (image.operating_system) {
      imageToVolProps.operating_system = {
        name: image.operating_system.name
      };
    }
  }
  input.status = input.name === 'aaaa-virtual-server' ? 'running' : 'pending';
  var id = addInstance(_server.db.getCollection(_server.COLS.instances), input).id;
  var instances = _server.db.getCollection(_server.COLS.instances);
  var instance;
  instance = utils.findResource(_server.COLS.instances, id, res, false);

  // Create and add a network interface
  var net_interfaces = (0, _network_interfaces.createNetworkInterfaces)(input, id, res);
  var updatedInstance = _objectSpread(_objectSpread({}, instance), net_interfaces);
  // update instance with new network interfaces and fetch updated instance
  instances.update(updatedInstance);
  if (utils.isHyperwarpEnabled()) {
    setTimeout(function () {
      var inst = utils.findResource(_server.COLS.instances, id, res, false);
      inst.status = 'running';
      instances.update(inst);
      (0, _hyperwarp.sendHyperwarpEvent)('virtualmachine.created', inst.crn);
    }, 5000);
  }

  // create boot volume and attachment
  instance = utils.findResource(_server.COLS.instances, id, res, false);
  var volumes = _server.db.getCollection(_server.COLS.volumes);
  var attachments = _server.db.getCollection(_server.COLS.volume_attachments);
  var inputBootAttachment = _lodash["default"].get(input, 'boot_volume_attachment', {});
  var bootVolData = _objectSpread(_objectSpread({}, inputBootAttachment.volume), {}, {
    zone: instance.zone
  }, imageToVolProps);
  // UI-16759 - capacity needs to be based on the image/snapshot values

  var bootVolumeCapacity = 100;
  var bootImageId = (_bootVolData$source_i = bootVolData.source_image) === null || _bootVolData$source_i === void 0 ? void 0 : _bootVolData$source_i.id;
  var bootSnapshotId = (_bootVolData$source_s = bootVolData.source_snapshot) === null || _bootVolData$source_s === void 0 ? void 0 : _bootVolData$source_s.id;
  var bootVolume;
  // Volume from image - use image minimum_provisioned_size
  if (bootImageId) {
    var bootImage = utils.findResource(_server.COLS.images, bootImageId, res, true);
    bootVolumeCapacity = bootImage.minimum_provisioned_size;
  }
  // Volume from snapshot - use snapshot minimum_capacity
  if (bootSnapshotId) {
    var bootSnapshot = utils.findResource(_server.COLS.snapshots, bootSnapshotId, res, true);
    bootVolumeCapacity = bootSnapshot.minimum_capacity;
  }
  if (bootVolData.id) {
    bootVolume = utils.findResource(_server.COLS.volumes, bootVolData.id, res, true);
  } else {
    // Volume capacity passed in -- use input
    // Default to 100GB
    bootVolData.capacity = bootVolData.capacity || bootVolumeCapacity;
    bootVolume = (0, _volumes.addVolume)(volumes, bootVolData);
  }
  var bootAttachmentTemplate = {
    volume: {
      id: bootVolume.id,
      capacity: bootVolume.capacity,
      profile: bootVolume.profile,
      iops: bootVolume.iops,
      // the iops will be used for custom IOPS.},
      user_tags: bootVolume.user_tags
    },
    instance: {
      id: instance.id,
      totalVolumeBandwidth: instance.total_volume_bandwidth
    },
    type: 'boot',
    status: 'attached',
    delete_volume_on_instance_delete: inputBootAttachment.delete_volume_on_instance_delete,
    device: {
      id: _casual["default"].uuid
    }
  };
  (0, _volumeAttachments.addAttachment)(attachments, bootAttachmentTemplate);

  // create data volumes and attach if needed
  var inputAttachments = _lodash["default"].get(input, 'volume_attachments', []);
  inputAttachments.forEach(function (item) {
    var volume = _objectSpread(_objectSpread({}, item.volume), {}, {
      zone: instance.zone
    });
    var addedVolume;
    if (volume.id) {
      addedVolume = utils.findResource(_server.COLS.volumes, volume.id, res, true);
    } else {
      addedVolume = (0, _volumes.addVolume)(volumes, volume);
    }
    var attachmentTemplate = {
      volume: {
        id: addedVolume.id,
        capacity: addedVolume.capacity,
        profile: addedVolume.profile,
        iops: addedVolume.iops,
        user_tags: addedVolume.user_tags
      },
      instance: {
        id: instance.id,
        totalVolumeBandwidth: instance.total_volume_bandwidth
      },
      delete_volume_on_instance_delete: item.delete_volume_on_instance_delete
    };
    (0, _volumeAttachments.addAttachment)(attachments, attachmentTemplate);
  });
  if (input.enable_secure_boot !== null) {
    updatedInstance.enable_secure_boot = input.enable_secure_boot;
  }
  if (input.confidential_compute_mode) {
    updatedInstance.confidential_compute_mode = input.confidential_compute_mode;
  }
  res.status(201).json(formatInstanceForClient(instance, req, res)).end();
};

/**
 * deleteInstance()
 * DELETE /instances/{id}
 * Delete a VSI.
 * @param {*} req
 * @param {*} res
 */
exports.createInstance = createInstance;
var deleteInstance = function deleteInstance(req, res) {
  var instance_id = req.params.instance_id;
  var instances = _server.db.getCollection(_server.COLS.instances);
  var instance = utils.findResource(_server.COLS.instances, instance_id, res, false);
  if (!instance) {
    // Not found return a 404
    return;
  }

  // If we were part of a dedicated_host we need to free up resources.
  var dedicated_host_id = _lodash["default"].get(instance, 'dedicated_host.id', undefined);
  if (dedicated_host_id) {
    (0, _dedicated_hosts.removeInstanceFromDedicatedHost)(dedicated_host_id, instance_id);
  }
  var removeAllResources = function removeAllResources() {
    var _instance$primary_net;
    if ((_instance$primary_net = instance.primary_network_interface) !== null && _instance$primary_net !== void 0 && _instance$primary_net.id) {
      (0, _network_interfaces.deleteNetworkInterfaceFn)(instance.primary_network_interface.id, null, utils.fakeResponse);
    }
    instance.network_interfaces.forEach(function (vnic) {
      return (0, _network_interfaces.deleteNetworkInterfaceFn)(vnic.id, null, utils.fakeResponse);
    });

    // Now delete the instance itself
    instances.remove(instance);
    (0, _volumeAttachments.removeAttachmentsForResource)(_server.COLS.instances, instance.id);
  };
  if (_features.shouldAddDelaysToStatusTransitions) {
    setTimeout(removeAllResources, 500 * _casual["default"].integer(1, 20));
  } else {
    removeAllResources();
  }
  if (utils.isHyperwarpEnabled()) {
    setTimeout(function () {
      (0, _hyperwarp.sendHyperwarpEvent)('virtualmachine.deleted', instance.crn);
    }, 5000);
  }
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
  var _input$profile, _input$placement_targ, _input$profile2;
  var input = req.body;
  var instances = _server.db.getCollection(_server.COLS.instances);
  var previousInstance = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  if (!previousInstance) {
    res.status(404).end();
    return;
  }
  var newProfile;
  if ((_input$profile = input.profile) !== null && _input$profile !== void 0 && _input$profile.name) {
    var _previousInstance$pro, _previousInstance$pla;
    if (previousInstance.status !== 'stopped' && previousInstance.status !== 'stopping') {
      res.status(400).json(utils.generateErrors('For the profile to be changed, the instance `status` must be `stopping` or `stopped`', 'resize_instance_status_not_valid', 'status')).end();
      return;
    }
    var previousProfileName = (_previousInstance$pro = previousInstance.profile) === null || _previousInstance$pro === void 0 ? void 0 : _previousInstance$pro.name;
    var profiles = _server.db.getCollection(_server.COLS.profiles).chain().find({
      name: previousProfileName
    }).data({
      removeMeta: true
    });
    var previouProfile = profiles.length > 0 && profiles[0];
    var newProfiles = _server.db.getCollection(_server.COLS.profiles).chain().find({
      name: input.profile.name
    }).data({
      removeMeta: true
    });
    newProfile = newProfiles.length > 0 && newProfiles[0];
    if (!previouProfile) {
      res.status(400).json(utils.generateErrors('old profile does not exist', 'old_profile_not_valid', 'profile.name')).end();
      return;
    }
    if (!newProfile) {
      res.status(400).json(utils.generateErrors('new profile does not exist', 'new_profile_not_valid', 'profile.name')).end();
      return;
    }
    if (previouProfile.disks && previouProfile.disks.length > 0 && (!newProfile.disks || newProfile.disks.length === 0)) {
      res.status(400).json(utils.generateErrors('you can not change instance profile with incompatible local disk configuration', 'resize_profile_local_disk_incompatibility', 'profile.name')).end();
      return;
    }
    if (!previousInstance.placement_target) previousInstance.placement_target = {};
    previousInstance.placement_target.id = previousInstance.id ? null : previousInstance.placement_target.id;
    if ((_previousInstance$pla = previousInstance.placement_target) !== null && _previousInstance$pla !== void 0 && _previousInstance$pla.id) {
      var hostOrGroupId = previousInstance.placement_target.id;
      var group = utils.findResource(_server.COLS.dedicated_host_groups, hostOrGroupId, undefined, false);
      if (group) {
        if (newProfile.family !== group.family) {
          res.status(400).json(utils.generateErrors('new instance profile family is not supported by current instance placed dedicated host group', 'resize_profile_dedicated_host_profile_incompatibility', 'profile.name')).end();
          return;
        }
      } else {
        var host = utils.findResource(_server.COLS.dedicated_hosts, hostOrGroupId, undefined, false);
        if (host) {
          var hostGroupId = host.group.id;
          var hostGroup = utils.findResource(_server.COLS.dedicated_host_groups, hostGroupId, undefined, false);
          if (!hostGroup || hostGroup.family !== newProfile.family) {
            res.status(400).json(utils.generateErrors('new instance profile is not supported by current instance placed dedicated host', 'resize_profile_dedicated_host_profile_incompatibility', 'profile.name')).end();
            return;
          }
        } else {
          var pg = utils.findResource(_server.COLS.placement_groups, hostOrGroupId, undefined, false);
          if (!pg) {
            res.status(400).json(utils.generateErrors('can not find instance placement host or group', 'instance_placement_invalid', 'profile.name')).end();
            return;
          }
        }
      }
    }
  }
  if ((_input$placement_targ = input.placement_target) !== null && _input$placement_targ !== void 0 && _input$placement_targ.id) {
    if (previousInstance.status !== 'stopped' && previousInstance.status !== 'stopping') {
      res.status(400).json(utils.generateErrors('For the placement target to be changed, the instance `status` must be `stopping` or `stopped`', 'patch_placement_target_status_invalid', 'status')).end();
      return;
    }
    var invalidMsg = 'can not find instance placement dedicated_host, dedicated_host_group, or placement_group';
    var placement_target_id = input.placement_target.id;
    var _group = utils.findResource(_server.COLS.dedicated_host_groups, placement_target_id, undefined, false);
    if (!_group) {
      var _host = utils.findResource(_server.COLS.dedicated_hosts, placement_target_id, undefined, false);
      if (!_host) {
        var _pg = utils.findResource(_server.COLS.placement_groups, placement_target_id, undefined, false);
        if (!_pg) {
          res.status(400).json(utils.generateErrors(invalidMsg, 'instance_placement_invalid', 'placement_target.id')).end();
          return;
        }
        input.placement_target.resource_type = PLACEMENT_RESOURCE_TYPE.PLACEMENT_GROUP;
      } else {
        var _previousInstance$ded;
        var previousDHID = (_previousInstance$ded = previousInstance.dedicated_host) === null || _previousInstance$ded === void 0 ? void 0 : _previousInstance$ded.id;
        (0, _dedicated_hosts.removeInstanceFromDedicatedHost)(previousDHID, req.params.instance_id);
        (0, _dedicated_hosts.addInstanceToDedicatedHost)(placement_target_id, req.params.instance_id);
        input.placement_target.resource_type = PLACEMENT_RESOURCE_TYPE.DEDICATED_HOST;
      }
    } else {
      var _previousInstance$pro2, _previousInstance$ded2;
      var profileName = input.profile.name || ((_previousInstance$pro2 = previousInstance.profile) === null || _previousInstance$pro2 === void 0 ? void 0 : _previousInstance$pro2.name);
      var dedicated_host_id = (0, _dedicated_host_groups.findDedicatedHostForInstance)(placement_target_id, profileName);
      var _previousDHID = (_previousInstance$ded2 = previousInstance.dedicated_host) === null || _previousInstance$ded2 === void 0 ? void 0 : _previousInstance$ded2.id;
      (0, _dedicated_hosts.removeInstanceFromDedicatedHost)(_previousDHID, req.params.instance_id);
      (0, _dedicated_hosts.addInstanceToDedicatedHost)(dedicated_host_id, req.params.instance_id);
      input.placement_target.resource_type = PLACEMENT_RESOURCE_TYPE.DEDICATED_GROUP;
    }
  }
  var updatedInstance = _objectSpread(_objectSpread({}, previousInstance), input);
  if (input.total_volume_bandwidth) {
    updatedInstance.total_network_bandwidth = previousInstance.bandwidth - input.total_volume_bandwidth;
  }
  if ((_input$profile2 = input.profile) !== null && _input$profile2 !== void 0 && _input$profile2.name) {
    setInstancePropsFromProfile(updatedInstance, newProfile);
  }
  if (input.availability_policy) {
    updatedInstance.availability_policy = input.availability_policy;
  }
  if (input.metadata_service) {
    var modifiedMetadata = Object.assign(previousInstance.metadata_service, input.metadata_service);
    updatedInstance.metadata_service = modifiedMetadata;
  }
  updatedInstance.status = 'pending';
  if (input.enable_secure_boot !== undefined) {
    // secure boot setting can only be changed while vsi is in the stopped state
    // change SE setting shouldn't change vsi status
    updatedInstance.enable_secure_boot = input.enable_secure_boot;
    updatedInstance.status = 'stopped';
  }
  if (input.confidential_compute_mode) {
    updatedInstance.confidential_compute_mode = input.confidential_compute_mode;
    updatedInstance.status = 'stopped';
  }
  instances.update(updatedInstance);
  if (utils.isHyperwarpEnabled()) {
    setTimeout(function () {
      var inst = utils.findResource(_server.COLS.instances, updatedInstance.id, res, false);
      inst.status = 'running';
      instances.update(inst);
      (0, _hyperwarp.sendHyperwarpEvent)('instance.updated', inst.crn);
    }, 5000);
  }
  res.status(200).json(formatInstanceForClient(updatedInstance, req, res)).end();
};

/**
 * getInitConfiguration()
 * GET /instances/{instance_id}/initialization
 * Retrieves configuration variables used to initialize the instance such as SSH keys and the Windows administrator password.
 * @param {*} req
 * @param {*} res
 */
exports.updateInstance = updateInstance;
var getInitConfiguration = function getInitConfiguration(req, res) {
  var instance = utils.findResource(_server.COLS.instances, req.params.instance_id, res);
  if (!instance) return;
  var default_trusted_profile = instance.default_trusted_profile,
    keys = instance.keys,
    password = instance.password;
  var formattedKeys = [];
  keys.forEach(function (key) {
    return formattedKeys.push((0, _keys.formatKeyForClient)(key.id, req, res));
  });
  var formattedPassword = {
    encrypted_password: password,
    encryption_key: {
      id: keys[0].id
    }
  };
  res.status(200).json({
    default_trusted_profile: default_trusted_profile,
    keys: formattedKeys,
    password: formattedPassword
  }).end();
};
exports.getInitConfiguration = getInitConfiguration;
var formatDisk = function formatDisk(serverID, disk, req) {
  return _objectSpread({
    href: "".concat(utils.getBaseApiUrl(req), "instances/").concat(serverID, "/disks/").concat(disk.id),
    resource_type: 'instance_disk'
  }, disk);
};

/**
 * getInstanceDisks()
 *
 * list disks
 *
 * GET /instances/{instance_id}/disks
 * @param {*} req
 * @param {*} res
 */
var getInstanceDisks = function getInstanceDisks(req, res) {
  var ins = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  if (!ins) {
    res.status(404).end();
    return;
  }
  var disks = ins.disks ? ins.disks.map(function (disk) {
    return formatDisk(ins.id, disk, req);
  }) : [];
  res.json({
    disks: disks
  }).end();
};

/**
 * getInstanceDisk()
 *
 * Get a disk
 *
 * GET /instances/{instance_id}/disks/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getInstanceDisks = getInstanceDisks;
var getInstanceDisk = function getInstanceDisk(req, res) {
  var ins = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  if (!ins) {
    res.status(404).end();
    return;
  }
  var disk = ins.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  res.json(formatDisk(ins.id, disk, req)).end();
};

/**
 * updateInstanceDisk()
 *
 * update a disk.
 *
 * PATCH /instances/{instance_id}/disks/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getInstanceDisk = getInstanceDisk;
var updateInstanceDisk = function updateInstanceDisk(req, res) {
  var ins = utils.findResource(_server.COLS.instances, req.params.instance_id, res, false);
  if (!ins) {
    res.status(404).end();
    return;
  }
  var disk = ins.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  var body = req.body;
  disk.name = body.name;
  var inss = _server.db.getCollection(_server.COLS.instances);
  inss.update(ins);
  res.status(200).json(formatDisk(inss.id, disk, req, res)).end();
};
exports.updateInstanceDisk = updateInstanceDisk;