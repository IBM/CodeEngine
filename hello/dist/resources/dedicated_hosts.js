"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateDisk = exports.updateDedicatedHost = exports.removeInstanceFromDedicatedHost = exports.init = exports.getResponseObjectWithName = exports.getDisks = exports.getDisk = exports.getDedicatedHosts = exports.getDedicatedHost = exports.deleteDedicatedHost = exports.createDedicatedHost = exports.addInstanceToDedicatedHost = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _dedicated_host_groups = require("./dedicated_host_groups");
var _dedicated_host_profiles = require("./dedicated_host_profiles");
var _common = require("./common");
var _features = require("./features");
var _excluded = ["id", "instance_disks"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var AdminStates = ['available', 'unavailable', 'migrating'];
var statusReasons = require('./dedicated_host_status_reasons.json');

/* For now we are filling some of our data with completely random data */
var getRandomElement = function getRandomElement(array) {
  return _casual["default"].random_element(array);
};
var getRandomAdminState = function getRandomAdminState() {
  return getRandomElement(AdminStates);
};

// const LifecycleStates = ['deleted', 'deleting', 'failed', 'pending', 'stable', 'updating', 'waiting', 'suspended'];
// @NOTE: currently only using available and pending statuses to make it easier to edit/delete/use
var LifecycleStates = ['stable', 'pending'];

/**
 * getAvailableMemoryFromProfile()
 *
 * Obtain initial availableMemory value for a dedicated host. Currently we only
 * support fixed memory profile, this function can be extended when we need to
 * support more availableMemory profile structures.
 *
 * If any thing goes bad - we return 0.
 *
 * @param {*} profile
 */
var getAvailableMemoryFromProfile = function getAvailableMemoryFromProfile(profile) {
  return _lodash["default"].get(profile, 'memory.value', 0);
};
var getSocketCountFromProfile = function getSocketCountFromProfile(profile) {
  return _lodash["default"].get(profile, 'socket_count.value', 0);
};

/**
 * getAvailableVcpuFromProfile()
 *
 * Obtain initial availableVcpu value for a dedicated host. Currently we only
 * support fixed vcpu_count profile, this function can be extended when we
 * need to support more vcpu_count profile structures.
 *
 * If any thing goes bad - we return 0.
 *
 * @param {*} profile
 */
var getAvalableVcpuFromProfile = function getAvalableVcpuFromProfile(profile) {
  return _lodash["default"].get(profile, 'vcpu_count.value', 0);
};

/**
 * addInstanceToDedicatedHost
 *
 * This routine adds an instance to a dedicated host. No safety
 * is provided. We assume that the provided ids are valid and exist. These
 * checks should be made when a client makes a request.
 *
 * @param {*} dedicated_host_id
 * @param {*} instance_id
 */
var addInstanceToDedicatedHost = function addInstanceToDedicatedHost(dedicated_host_id, instance_id) {
  // Check input parameters
  if (!(dedicated_host_id && instance_id)) {
    return false;
  }

  // Get the dedicated_host
  var dedicated_hosts = _server.db.getCollection(_server.COLS.dedicated_hosts);
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, dedicated_host_id, null, false);
  if (!dedicated_host) {
    return false;
  }

  // Get the instance
  var instance = utils.findResource(_server.COLS.instances, instance_id, null, false);
  if (!instance) {
    return false;
  }

  // Update our available VCPU
  var requested_vcpu = _lodash["default"].get(instance, 'vcpu.count', 0);
  var available_vcpu = _lodash["default"].get(dedicated_host, 'available_vcpu.count', 0);
  dedicated_host.available_vcpu.count = Math.max(0, available_vcpu - requested_vcpu);
  var max_vcpu = getAvalableVcpuFromProfile(dedicated_host.profile);
  dedicated_host.available_vcpu.percentage = Math.floor(dedicated_host.available_vcpu.count / max_vcpu * 100);

  // Update our available memory
  var requested_memory = _lodash["default"].get(instance, 'memory', 0);
  var available_memory = _lodash["default"].get(dedicated_host, 'available_memory', 0);
  dedicated_host.available_memory = Math.max(0, available_memory - requested_memory);

  // Update the list of instances
  dedicated_host.instances.push(instance_id);

  // add instances in instance_disks if the dedicated host supports local disk
  if (dedicated_host.disks) {
    var insDisks = instance.disks || [];
    if (dedicated_host.disks[0].instance_disks) {
      var concatedDisks = dedicated_host.disks[0].instance_disks.concat(insDisks);
      dedicated_host.disks[0].instance_disks = concatedDisks;
    } else {
      dedicated_host.disks[0].instance_disks = insDisks;
    }
  }

  // Post the updates to LokiJS
  dedicated_hosts.update(dedicated_host);
  return true;
};

/**
 * removeInstanceFromDedicatedHost
 *
 * This routine removes an instance from a dedicated host. We assume
 * that the provided ids are valid and exist. These checks should be made when
 * a client makes a request.
 *
 * @param {*} dedicated_host_id
 * @param {*} instance_id
 */
exports.addInstanceToDedicatedHost = addInstanceToDedicatedHost;
var removeInstanceFromDedicatedHost = function removeInstanceFromDedicatedHost(dedicated_host_id, instance_id) {
  // Check input parameters
  if (!(dedicated_host_id && instance_id)) {
    return false;
  }

  // Get the dedicated_host
  var dedicated_hosts = _server.db.getCollection(_server.COLS.dedicated_hosts);
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, dedicated_host_id, null, false);
  if (!dedicated_host) {
    return false;
  }

  // Get the instance
  var instance = utils.findResource(_server.COLS.instances, instance_id, null, false);
  if (!instance) {
    return false;
  }

  // Get the profile
  var profile_name = _lodash["default"].get(dedicated_host, 'profile.name', '');
  if (!profile_name) {
    return false;
  }
  var profile = utils.findResource(_server.COLS.dedicated_host_profiles, profile_name);
  if (!profile) {
    return false;
  }

  // Update our available VCPU
  var requested_vcpu = _lodash["default"].get(instance, 'vcpu.count', 0);
  var available_vcpu = _lodash["default"].get(dedicated_host, 'avalable_vcpu.count', 0);
  var max_available_vcpu = getAvalableVcpuFromProfile(profile);
  dedicated_host.available_vcpu.count = Math.min(max_available_vcpu, available_vcpu + requested_vcpu);
  dedicated_host.available_vcpu.percentage = Math.floor(dedicated_host.available_vcpu.count / max_available_vcpu * 100);

  // Update our available memory
  var requested_memory = _lodash["default"].get(instance, 'memory', 0);
  var available_memory = _lodash["default"].get(dedicated_host, 'available_memory', 0);
  var max_available_memory = getAvailableMemoryFromProfile(profile);
  dedicated_host.available_memory = Math.min(max_available_memory, available_memory + requested_memory);

  // Update the list of instances
  var dhIns = dedicated_host.instances;
  var insIndex = dhIns.indexOf(instance_id);
  if (insIndex !== -1) {
    dedicated_host.instances.splice(insIndex, 1);
  }
  // Post the updates to LokiJS
  dedicated_hosts.update(dedicated_host);
  return true;
};

// This is special for dedicated_host_profiles - cleanup...
exports.removeInstanceFromDedicatedHost = removeInstanceFromDedicatedHost;
var getResponseObjectWithName = function getResponseObjectWithName(type, resourceName, req) {
  var resource = _server.db.getCollection(type).chain().find({
    name: resourceName
  }).data({
    removeMeta: true
  });
  return {
    id: resource[0].id,
    crn: utils.updateResourceCrnRegion(resource[0], req),
    name: resource[0].name,
    href: "".concat(utils.getBaseApiUrl(req), "dedicated_host/profiles/").concat(resource[0].id)
  };
};

/**
 * verifyAddDedicatedHostToGroup()
 *
 * Add a dedicated_host to a group.
 *
 * Verifies preconditions are all met then adds the supplied dedicated_host to
 * the group and returns true. If any problems are encountered then the
 * response object is updated with error information and we return false.
 *
 * @param {*} dedicated_host
 * @param {*} res
 */
exports.getResponseObjectWithName = getResponseObjectWithName;
var verifyAddDedicatedHostToGroup = function verifyAddDedicatedHostToGroup(dedicated_host, res) {
  // First verify that a dedicated_host_group_id was provided.
  var group_id = _lodash["default"].get(dedicated_host, 'group.id', undefined);
  if (!group_id) {
    if (res) {
      res.status(400).json(utils.generateErrors('Valid dedicated host group is required', 'not_found', 'group.id')).end();
    }
    return false;
  }

  // Now check that that the specified dedicated host group exists
  // const dedicated_host_groups = db.getCollection(COLS.dedicated_host_groups);
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, group_id, res, false);
  if (!dedicated_host_group) {
    // Return 404 if not found
    return false;
  }

  // For now we will not check for available resources nor will we account for resources consumed.

  return true;
};

/**
 * addDedicatedHost()
 *
 * Add a Dedicated Host
 *
 * @param {*} dedicated_hosts: List of dedicated_hosts
 * @param {*} data: details of the new dedicated_host to be added to the list of dedicated_hosts
 */
// eslint-disable-next-line no-unused-vars
var addDedicatedHost = function addDedicatedHost(dedicated_hosts, data, res) {
  var inputProfile = data.profile && utils.findResource(_server.COLS.dedicated_host_profiles, data.profile.name);
  var zone = data.zone;
  var groupId = _lodash["default"].get(data, 'group.id', '');
  var group;
  if (!groupId) {
    group = utils.getRandomResource(_server.COLS.dedicated_host_groups);
    if (zone) {
      group = utils.getRandomZonalResourceInZone(_server.COLS.dedicated_host_groups, zone.name);
    }
    if (!group) {
      groupId = (0, _dedicated_host_groups.addDedicatedHostGroup)(_server.db.getCollection(_server.COLS.dedicated_host_groups), {
        zone: zone
      });
      group = utils.findResource(_server.COLS.dedicated_host_groups, groupId);
    }
    groupId = group.id;
    zone = {
      name: group.zone.name
    };
  }
  if (groupId && !zone) {
    group = utils.findResource(_server.COLS.dedicated_host_groups, groupId);
    zone = group.zone;
  }
  // get a list of dh profiles that match the family and class values with group family and class values
  var possibleProfiles = group && _server.db.getCollection(_server.COLS.dedicated_host_profiles).chain().where(function (profile) {
    return profile.family === group.family && profile["class"] === group["class"];
  }).data({
    removeMeta: true
  });
  // now randomly pick a matched profile
  var profile = inputProfile || possibleProfiles[_casual["default"].integer(0, possibleProfiles.length - 1)];
  var lifecycle_state = data.state || _casual["default"].random_element(LifecycleStates);
  var disks;
  if (profile && profile.disks) {
    disks = profile.disks.map(function (disk) {
      return {
        id: _casual["default"].uuid,
        name: utils.generateName('dh-localdisk', zone),
        interface_type: disk.interface_type.value,
        size: disk.size.value,
        available: Math.round(disk.size.value * _casual["default"]["double"](0, 1)),
        provisionable: _casual["default"]["boolean"],
        lifecycle_state: lifecycle_state
      };
    });
  }
  var status_reasons;
  if (lifecycle_state !== _common.LIFECYCLE_STATE.STABLE) {
    status_reasons = [_casual["default"].random_element(statusReasons)];
  }
  var available_memory = getAvailableMemoryFromProfile(profile);
  var available_vcpu = getAvalableVcpuFromProfile(profile);
  var numaVCPU = available_vcpu / 2;
  var numa = {
    count: 2,
    node: [{
      name: '0',
      available_vcpu: _casual["default"].integer(0, numaVCPU),
      vcpu: numaVCPU
    }, {
      name: '1',
      available_vcpu: _casual["default"].integer(0, numaVCPU),
      vcpu: numaVCPU
    }]
  };
  var baseData = {
    resource_type: 'dedicated_host',
    admin_state: data.admin_state ? data.admin_state : getRandomAdminState(),
    available_memory: available_memory,
    memory: Math.round(available_memory * _casual["default"]["double"](1, 1.9)),
    // The total amount of memory in gibibytes for this host
    available_vcpu: {
      count: available_vcpu,
      architecture: 'amd64'
    },
    // The available VCPU for the dedicated host
    id: data.id || _casual["default"].uuid,
    created_at: data.created_at || utils.generateCreateDate(),
    crn: utils.generateCRN(),
    group: {
      id: groupId
    },
    href: '',
    // Placholder
    instance_placement_enabled: data.instance_placement_enabled || _casual["default"].coin_flip,
    instances: [],
    lifecycle_state: lifecycle_state,
    status_reasons: status_reasons,
    name: data.name || utils.generateName('dedicated-host', zone),
    profile: {
      name: profile.name,
      disks: {}
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: zone,
    disks: disks,
    socket_count: getSocketCountFromProfile(profile),
    numa: numa,
    vcpu: {
      count: Math.round(available_vcpu * _casual["default"]["double"](1, 1.9)),
      architecture: 'amd64'
    } // The total VCPU of the dedicated host
  };

  // Create the new dedicated_host
  var newDedicatedHost = _objectSpread(_objectSpread({}, baseData), {}, {
    state: baseData.admin_state,
    memory: baseData.available_memory
  }, data);

  // Add the dedicated_host to its dedicated_host_group
  (0, _dedicated_host_groups.addDedicatedHostToGroup)(groupId, newDedicatedHost.id);
  dedicated_hosts.insert(newDedicatedHost);
  return newDedicatedHost.id;
};

/**
 * init()
 *
 * Initialize Dedicated Hosts
 */
var init = function init() {
  var dedicated_hosts = _server.db.addCollection(_server.COLS.dedicated_hosts);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'AAA-dedicated-host-01',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'aaa-dedicated-host-02',
    zone: {
      name: 'us-east-2'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: true,
    state: 'stable'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-cccc-cccc-cccc-cccccccccccc',
    name: 'AAA-dedicated-host',
    subnet: {
      id: 'subnet-1'
    },
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
    name: 'AAA-dedicated-host-test',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instances: ['aaa-instance-test-sn-1-inst-11', 'aaa-instance-test-sn-1-inst-12', 'aaa-instance-test-sn-1-inst-13']
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-gggg-gggg-gggg-gggggggggggg',
    name: 'aaaa-dedicated-host-test-delete',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: true
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-03',
    name: 'aaa-dedicated-host-03',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-04',
    name: 'aaa-dedicated-host-04',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: false,
    state: 'failed'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-05',
    name: 'aaa-dedicated-host-05',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    state: 'stable'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-06',
    name: 'aaa-dedicated-host-06',
    zone: {
      name: 'us-east-1'
    },
    subnet: {
      id: 'subnet-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: false,
    state: 'stable'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-07',
    name: 'aaa-dedicated-host-07',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-08',
    name: 'aaa-dedicated-host-08',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-09',
    name: 'aaa-dedicated-host-09',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-10',
    name: 'aaa-dedicated-host-10',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    }
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-delete',
    name: 'AAA-dedicated-host-delete',
    zone: {
      name: 'us-east-2'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: false,
    state: 'stable'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-test-11',
    name: 'AAA-dedicated-host-vsi-01',
    zone: {
      name: 'us-east-1'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: true,
    state: 'stable'
  });
  addDedicatedHost(dedicated_hosts, {
    id: 'dedicated-host-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    name: 'AAA-dedicated-host-template',
    zone: {
      name: 'us-east-2'
    },
    profile: {
      name: 'bx2-host-152x608'
    },
    instance_placement_enabled: true,
    state: 'stable'
  });
  // If adding new dedicated host here, please add profile also in the same

  utils.repeat(function () {
    addDedicatedHost(dedicated_hosts, {
      profile: {
        name: 'bx2-host-152x608'
      }
    });
  }, _features.shouldGenerateLotsOfResources ? 125 : 50);
};
exports.init = init;
var formatDisk = function formatDisk(dhID, disk, req) {
  var diskID = disk.id,
    instance_disks = disk.instance_disks,
    rest = _objectWithoutProperties(disk, _excluded);
  var formattedInstanceDisks = instance_disks ? instance_disks.map(function (iDisk) {
    var instDiskID = iDisk.id,
      instDiskName = iDisk.name,
      instanceID = iDisk.instanceID;
    return {
      id: instDiskID,
      name: instDiskName,
      href: "".concat(utils.getBaseApiUrl(req), "instances/").concat(instanceID, "/disks/").concat(instDiskID),
      resource_type: 'instance_disk'
    };
  }) : [];
  return _objectSpread({
    instance_disks: formattedInstanceDisks,
    id: diskID,
    href: "".concat(utils.getBaseApiUrl(req), "dedicated_hosts/").concat(dhID, "/disks/").concat(diskID)
  }, rest);
};

/**
 * formatDedicatedHostForClient()
 *
 * Format the Dedicated Host for client output.
 *
 * @param {*} req
 * @param {*} dedicated_host
 */
// eslint-disable-next-line no-unused-vars
var formatDedicatedHostForClient = function formatDedicatedHostForClient(dedicated_host, req, res) {
  var dh = JSON.parse(JSON.stringify(dedicated_host));
  var href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.dedicated_hosts, "/").concat(dedicated_host.id);
  var profile = getResponseObjectWithName(_server.COLS.dedicated_host_profiles, dedicated_host.profile.name, req);
  var group = utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_host_groups, dedicated_host.group.id, req);
  group.href = "".concat(utils.getBaseApiUrl(req), "dedicated_host/groups/").concat(group.id);
  var instances = dedicated_host.instances.map(function (instance_id) {
    return utils.getAndFormatResourceLinkForClient(req, _server.COLS.instances, instance_id);
  });
  var available_memory = dh.available_memory,
    available_vcpu = dh.available_vcpu,
    name = dh.name,
    created_at = dh.created_at,
    id = dh.id,
    instance_placement_enabled = dh.instance_placement_enabled,
    lifecycle_state = dh.lifecycle_state,
    status_reasons = dh.status_reasons,
    state = dh.state,
    memory = dh.memory,
    vcpu = dh.vcpu,
    socket_count = dh.socket_count,
    port_speed = dh.port_speed,
    resource_group = dh.resource_group,
    zone = dh.zone,
    disks = dh.disks,
    numa = dh.numa;
  var formattedDisks = disks ? disks.map(function (disk) {
    return formatDisk(dh.id, disk, req);
  }) : [];
  var profileResource = _server.db.getCollection(_server.COLS.dedicated_host_profiles).chain().find({
    name: dedicated_host.profile.name
  }).data({
    removeMeta: true
  })[0];
  var supported_instance_profiles = (0, _dedicated_host_profiles.getSupportedInstanceProfiles)(req, profileResource.family, profileResource["class"]);
  var result = {
    id: id,
    name: name,
    state: state,
    available_memory: available_memory,
    available_vcpu: available_vcpu,
    created_at: created_at,
    crn: utils.updateResourceCrnRegion(dh, req),
    instance_placement_enabled: instance_placement_enabled,
    instances: instances,
    lifecycle_state: lifecycle_state,
    status_reasons: status_reasons,
    memory: memory,
    vcpu: vcpu,
    socket_count: socket_count,
    port_speed: port_speed,
    resource_group: resource_group,
    zone: zone,
    href: href,
    group: group,
    numa: numa,
    profile: profile,
    supported_instance_profiles: supported_instance_profiles,
    disks: formattedDisks
  };
  return result;
};

/**
 * filterByDedicatedGroupWithQuery
 *
 * Currently we only support filtering by the 'dedicated_host_group.id`.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} resource - the base resource we are filtering on
 * @param {*} queryParam - the value to filter on
 * @param {*} fieldName - the field name we are filtering on for the filtering
 */
var filterByDedicatedGroupWithQuery = function filterByDedicatedGroupWithQuery(req, res, resource, queryParam, fieldName) {
  var dedicated_group_id = _lodash["default"].get(resource, fieldName, undefined);
  if (dedicated_group_id === queryParam) {
    return true;
  }
  return false;
};

/*
 * The dedicated_hosts call supports extra query parameters. We need to add
 * these as extra filters on the where clause when getting the list of
 * dedicated_hosts.
 */
var filter = function filter(req, res, resource) {
  // We need to filter by types here, so that eventually we can support multiple filters.

  // Filter by dedicated_group.id
  if (req.query['dedicated_host_group.id']) {
    return filterByDedicatedGroupWithQuery(req, res, resource, req.query['dedicated_host_group.id'], 'group.id');
  }
  // Filter by dedicated_group.id
  if (req.query['zone.name']) {
    return filterByDedicatedGroupWithQuery(req, res, resource, req.query['zone.name'], 'zone.name');
  }

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};

/**
 * getDedicatedHosts()
 *
 * Get a list of Dedicated Hosts.
 *
 * GET /dedicated_hosts
 *
 * @param {*} req
 * @param {*} res
 */
var getDedicatedHosts = function getDedicatedHosts(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var dedicated_hosts = utils.getResources(req, _server.COLS.dedicated_hosts, extraFilter);
  dedicated_hosts.dedicated_hosts = dedicated_hosts.dedicated_hosts.map(function (dedicated_host) {
    return formatDedicatedHostForClient(dedicated_host, req, res);
  });

  // By default getResources() sorts by name we need to sorty by reverse "created_at"
  dedicated_hosts.dedicated_hosts.sort(function (a, b) {
    var itemA = _lodash["default"].get(a, 'created_at', '');
    var itemB = _lodash["default"].get(b, 'created_at', '');
    if (itemA > itemB) return -1;
    if (itemA < itemB) return 1;
    return 0;
  });
  res.json(dedicated_hosts).end();
};

/**
 * getDedicatedHost()
 *
 * Create a dedicated_host.
 *
 * GET /dedicated_hosts/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDedicatedHosts = getDedicatedHosts;
var getDedicatedHost = function getDedicatedHost(req, res) {
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!dedicated_host) {
    return;
  }
  res.json(formatDedicatedHostForClient(dedicated_host, req, res)).end();
};

/**
 * getDisks()
 *
 * list dedicated_host disks
 *
 * GET /dedicated_hosts/{dedicated_host_id}/disks
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDedicatedHost = getDedicatedHost;
var getDisks = function getDisks(req, res) {
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!dedicated_host) {
    res.status(404).end();
    return;
  }
  var disks = dedicated_host.disks ? dedicated_host.disks.map(function (disk) {
    return formatDisk(dedicated_host.id, disk, req);
  }) : [];
  res.json({
    disks: disks
  }).end();
};

/**
 * getDisk()
 *
 * Get a dedicated_host disk
 *
 * GET /dedicated_hosts/{dedicated_host_id}/disks/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDisks = getDisks;
var getDisk = function getDisk(req, res) {
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!dedicated_host) {
    res.status(404).end();
    return;
  }
  var disk = dedicated_host.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  res.json(formatDisk(dedicated_host.id, disk, req)).end();
};

/**
 * updateDisk()
 *
 * update a dedicated_host.
 *
 * PATCH /dedicated_hosts/{dedicated_host_id}/disks/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDisk = getDisk;
var updateDisk = function updateDisk(req, res) {
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!dedicated_host) {
    res.status(404).end();
    return;
  }
  var disk = dedicated_host.disks.find(function (idisk) {
    return idisk.id === req.params.id;
  });
  if (!disk) {
    res.status(404).end();
    return;
  }
  var body = req.body;
  disk.name = body.name;
  var dedicated_hosts = _server.db.getCollection(_server.COLS.dedicated_hosts);
  dedicated_hosts.update(dedicated_host);
  res.status(200).json(formatDisk(dedicated_host.id, disk, req, res)).end();
};

/**
 * createDedicatedHost()
 *
 * Create a new Dedicated Host.
 *
 * POST /dedicated_hosts
 *
 * @param {*} req
 * @param {*} res
 */
exports.updateDisk = updateDisk;
var createDedicatedHost = function createDedicatedHost(req, res) {
  var input = req.body;

  // Validate the name
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.dedicated_hosts), input, req, res, 'resource with that name already exists', 'dedicated_host')) {
    return;
  }

  // Validate a profile.name was provided
  if (!input.profile || !input.profile.name) {
    res.status(400).json(utils.generateErrors('Valid profile is required', 'not_found', 'profile.name')).end();
    return;
  }

  // Validate that a valid profile with that name is found.
  if (!utils.findResource(_server.COLS.dedicated_host_profiles, input.profile.name, res)) {
    return;
  }

  // Provide a proper default value for instance_placement_enabled
  if (input.instance_placement_enabled !== false) {
    input.instance_placement_enabled = true;
  }

  // Attempt to add the dedicated_host to a Group.
  if (!verifyAddDedicatedHostToGroup(input, res)) {
    return;
  }

  // Set the created_at field to the current time
  input.created_at = utils.generateNowDate();

  // Add the resource
  var id = addDedicatedHost(_server.db.getCollection(_server.COLS.dedicated_hosts), input);

  // Now retrieve the resource from the DB and send it to the client.
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, id, res, false);
  var formatedDH = formatDedicatedHostForClient(dedicated_host, req, res);
  // zero out the memory/vcpu/port_speed/socket_count in the post call response
  formatedDH.memory = 0;
  formatedDH.vcpu.count = 0;
  formatedDH.socket_count = 0;
  formatedDH.port_speed = 0;
  formatedDH.available_memory = 0;
  formatedDH.available_vcpu.count = 0;
  res.status(201).json(formatedDH).end();
};

/**
 * deleteDedicatedHost()
 *
 * Delete a specific Dedicated Host.
 *
 * DELETE /dedicated_host/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.createDedicatedHost = createDedicatedHost;
var deleteDedicatedHost = function deleteDedicatedHost(req, res) {
  var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!dedicated_host) {
    return;
  }
  if (dedicated_host.instance_placement_enabled) {
    res.status(400).json((0, utils.generateErrors)('dedicated host cannot be deleted if instance placement is enabled. Disable instance placement first', 400, 'bad_field')).end();
    return;
  }
  var VSIs = _server.db.getCollection(_server.COLS.instances).chain().find().where(function (obj) {
    var _obj$placement_target;
    return ((_obj$placement_target = obj.placement_target) === null || _obj$placement_target === void 0 ? void 0 : _obj$placement_target.id) === req.params.dedicated_host_id;
  }).data({
    removeMeta: true
  });
  if ((VSIs === null || VSIs === void 0 ? void 0 : VSIs.length) > 0) {
    res.status(409).json((0, utils.generateErrors)('dedicated host has 1 or more instances', 409, 'dedicated_host_in_use')).end();
    return;
  }

  // Remove the dedicated_host from the dedicated_host_group
  (0, _dedicated_host_groups.removeDedicatedHostFromGroup)(dedicated_host.group.id, dedicated_host.id);

  // Now remove the dedicated host from the decicated_host_group.
  var dedicated_hosts = _server.db.getCollection(_server.COLS.dedicated_hosts);
  dedicated_hosts.remove(dedicated_host);
  res.status(204).end();
};

/**
 * updateDedicatedHost()
 *
 * Update an existing Dedicated Host.
 *
 * PATCH /dedicated_host/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteDedicatedHost = deleteDedicatedHost;
var updateDedicatedHost = function updateDedicatedHost(req, res) {
  var input = req.body;
  var dedicated_hosts = _server.db.getCollection(_server.COLS.dedicated_hosts);
  var originalDedicatedHost = utils.findResource(_server.COLS.dedicated_hosts, req.params.dedicated_host_id, res, false);
  if (!originalDedicatedHost) {
    return;
  }
  var updatedDedicatedHost = _objectSpread(_objectSpread({}, originalDedicatedHost), input);
  dedicated_hosts.update(updatedDedicatedHost);
  res.status(200).json(formatDedicatedHostForClient(updatedDedicatedHost, req, res)).end();
};
exports.updateDedicatedHost = updateDedicatedHost;