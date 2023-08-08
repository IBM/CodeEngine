"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateDedicatedHostGroup = exports.removeDedicatedHostFromGroup = exports.init = exports.getDedicatedHostGroups = exports.getDedicatedHostGroup = exports.findDedicatedHostForInstance = exports.deleteDedicatedHostGroup = exports.createDedicatedHostGroup = exports.addDedicatedHostToGroup = exports.addDedicatedHostGroup = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var _dedicated_host_profiles = require("./dedicated_host_profiles");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// the order of classes and families need match each other
var classes = ['mx2', 'bx2', 'cx2', 'bx2d', 'mx2d'];
var groupFamilies = ['memory', 'balanced', 'compute', 'balanced-disk', 'memory-disk'];
/**
 * addDedicatedHostGroup()
 *
 * Add a Dedicated Host Group
 *
 * @param {*} dedicated_host_groups: List of dedicated_host groups
 * @param {*} data: details of the new dedicated_host_group to be added to the list of dedicated_host_groups
 */
// eslint-disable-next-line no-unused-vars
var addDedicatedHostGroup = function addDedicatedHostGroup(dedicated_host_groups, data, res) {
  var randomClassIndex = _casual["default"].integer(0, groupFamilies.length - 1);
  var groupClass = data["class"] || classes[randomClassIndex];
  var isZGroup = groupClass.charAt(1) === 'z';
  var groupArchitecture = isZGroup ? 's390' : 'amd64';
  var groupManufacture = isZGroup ? 'ibm' : 'intel';
  var baseData = {
    resource_type: 'dedicated_host_group',
    id: data.id || _casual["default"].uuid,
    created_at: data.created_at || utils.generateCreateDate(),
    crn: utils.generateCRN(),
    dedicated_hosts: [],
    href: '',
    // Placholder
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: data.zone || utils.getRandomZoneFromRestrictedRegions(),
    "class": groupClass,
    family: data.family || groupFamilies[randomClassIndex],
    vcpu: {
      architecture: groupArchitecture,
      manufacturer: groupManufacture
    }
  };
  var newDedicatedHostGroup = _objectSpread(_objectSpread({}, baseData), data);
  if (!newDedicatedHostGroup.name) {
    newDedicatedHostGroup.name = utils.generateName('dedicated-group', newDedicatedHostGroup.zone);
  }
  dedicated_host_groups.insert(newDedicatedHostGroup);
  return newDedicatedHostGroup.id;
};

/**
 * addDedicatedHostToGroup
 *
 * This routine adds a dedicated host to a dedicated host group. No safety
 * is provided. We assume that the provided ids are valid and exist. These
 * checks should be made when a client makes a request.
 *
 * @param {*} group_id
 * @param {*} dedicated_host_id
 */
exports.addDedicatedHostGroup = addDedicatedHostGroup;
var addDedicatedHostToGroup = function addDedicatedHostToGroup(group_id, dedicated_host_id) {
  // Check input parameters
  if (!(group_id && dedicated_host_id)) {
    return false;
  }

  // Get the dedicated_host_Group
  var dedicated_host_groups = _server.db.getCollection(_server.COLS.dedicated_host_groups);
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, group_id, null, false);
  if (!dedicated_host_group) {
    return false;
  }

  // For now we will not check for available resources nor will we account for resources consumed.
  dedicated_host_group.dedicated_hosts.push(dedicated_host_id);
  dedicated_host_groups.update(dedicated_host_group);
  return true;
};

/**
 * removeDedicatedHostFromGroup
 *
 * This routine removes a dedicated host from a dedicated host group. We assume
 * that the provided ids are valid and exist. These checks should be made when
 * a client makes a request.
 *
 * @param {*} group_id
 * @param {*} dedicated_host_id
 */
exports.addDedicatedHostToGroup = addDedicatedHostToGroup;
var removeDedicatedHostFromGroup = function removeDedicatedHostFromGroup(group_id, dedicated_host_id) {
  // Check input parameters
  if (!(group_id && dedicated_host_id)) {
    return false;
  }

  // Get the dedicated_host_Group
  var dedicated_host_groups = _server.db.getCollection(_server.COLS.dedicated_host_groups);
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, group_id, null, false);
  if (!dedicated_host_group) {
    return false;
  }

  // Remove the specified dedicated_host from our dedicated_host_group.
  dedicated_host_group.dedicated_hosts.splice(dedicated_host_group.dedicated_hosts.indexOf(dedicated_host_id), 1);
  dedicated_host_groups.update(dedicated_host_group);
  return true;
};

/**
 * init()
 *
 * Initialize Dedicated Host Groups
 *
 */
exports.removeDedicatedHostFromGroup = removeDedicatedHostFromGroup;
var init = function init() {
  var dedicated_host_groups = _server.db.addCollection(_server.COLS.dedicated_host_groups);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addDedicatedHostGroup(dedicated_host_groups, {
    id: 'dedicated-host-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'AAAa-dedicated-host-group-01',
    zone: {
      name: 'us-east-1'
    },
    "class": 'mx2',
    family: 'memory',
    vcpu: {
      architecture: 'amd64',
      manufacturer: 'intel'
    }
  });
  addDedicatedHostGroup(dedicated_host_groups, {
    id: 'dedicated-host-group-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'BBB-dedicated-host-group-02',
    zone: {
      name: 'us-east-1'
    },
    "class": 'mx2',
    family: 'memory',
    vcpu: {
      architecture: 'amd64',
      manufacturer: 'intel'
    }
  });
  addDedicatedHostGroup(dedicated_host_groups, {
    id: 'dedicated-host-group-cccc-cccc-cccc-cccccccccccc',
    name: 'CCC-dedicated-host-group-03',
    zone: {
      name: 'us-east-1'
    },
    "class": 'bx2',
    family: 'balanced',
    vcpu: {
      architecture: 'amd64',
      manufacturer: 'intel'
    }
  });
  utils.repeat(function () {
    addDedicatedHostGroup(dedicated_host_groups, {});
  }, 50);
};

/**
 * formatDedicatedHostGroupForClient()
 *
 * Format the Dedicated Host Group for output to client.
 *
 * @param {*} req
 * @param {*} dedicated_host_group
 */
// eslint-disable-next-line no-unused-vars
exports.init = init;
var formatDedicatedHostGroupForClient = function formatDedicatedHostGroupForClient(dedicated_host_group, req, res) {
  var href = "".concat(utils.getBaseApiUrl(req), "dedicated_host/groups/").concat(dedicated_host_group.id);
  var dedicated_hosts = dedicated_host_group.dedicated_hosts.map(function (dedicated_host) {
    return utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_hosts, dedicated_host);
  });
  var name = dedicated_host_group.name,
    created_at = dedicated_host_group.created_at,
    id = dedicated_host_group.id,
    resource_group = dedicated_host_group.resource_group,
    zone = dedicated_host_group.zone,
    family = dedicated_host_group.family,
    vcpu = dedicated_host_group.vcpu;
  var supported_instance_profiles = (0, _dedicated_host_profiles.getSupportedInstanceProfiles)(req, family, dedicated_host_group["class"]);
  var result = {
    id: id,
    name: name,
    created_at: created_at,
    crn: utils.updateResourceCrnRegion(dedicated_host_group, req),
    dedicated_hosts: dedicated_hosts,
    resource_group: resource_group,
    zone: zone,
    href: href,
    family: family,
    "class": dedicated_host_group["class"],
    supported_instance_profiles: supported_instance_profiles,
    vcpu: vcpu
  };
  return result;
};

/**
 * filterByZoneWithQuery
 *
 * Currently we only support filtering by the 'zone.name`.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} resource - the base resource we are filtering on
 * @param {*} queryParam - the value to filter on
 * @param {*} fieldName - the field name we are filtering on for the filtering
 */
var filterByZoneWithQuery = function filterByZoneWithQuery(req, res, resource, queryParam, fieldName) {
  var zone_name = _lodash["default"].get(resource, fieldName, undefined);
  if (zone_name === queryParam) {
    return true;
  }
  return false;
};

/*
 * The dedicated_host_groups call supports extra query parameters. We need to add
 * these as extra filters on the where clause when getting the list of
 * dedicated_host_groups.
 */
var filter = function filter(req, res, resource) {
  if (req.query['zone.name']) {
    return filterByZoneWithQuery(req, res, resource, req.query['zone.name'], 'zone.name');
  }

  /*
   * If there was no matching query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};

/**
 * getDedicatedHostGroups()
 *
 * Get a list of dedicated host groups.
 *
 * GET /dedicated_host/groups
 *
 * @param {*} req
 * @param {*} res
 */
var getDedicatedHostGroups = function getDedicatedHostGroups(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var dedicated_host_groups = utils.getResources(req, _server.COLS.dedicated_host_groups, extraFilter);
  dedicated_host_groups.groups = dedicated_host_groups.dedicated_host_groups.map(function (dedicated_host_group) {
    return formatDedicatedHostGroupForClient(dedicated_host_group, req, res);
  });
  delete dedicated_host_groups.dedicated_host_groups;

  // By default getResources() sorts by name we need to sorty by reverse "created_at"
  dedicated_host_groups.groups.sort(function (a, b) {
    var itemA = _lodash["default"].get(a, 'created_at', '');
    var itemB = _lodash["default"].get(b, 'created_at', '');
    if (itemA > itemB) return -1;
    if (itemA < itemB) return 1;
    return 0;
  });
  res.json(dedicated_host_groups).end();
};

/**
 * getDedicatedHostGroup()
 *
 * Get a specific dedicated host group.
 *
 * GET /dedicated_host/groups/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDedicatedHostGroups = getDedicatedHostGroups;
var getDedicatedHostGroup = function getDedicatedHostGroup(req, res) {
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, req.params.group_id, res, false);
  if (!dedicated_host_group) {
    return;
  }
  res.json(formatDedicatedHostGroupForClient(dedicated_host_group, req, res)).end();
};

/**
 * createDedicatedHostGroup()
 *
 * Create a Dedicated Host Group.
 *
 * POST /dedicated_host/groups
 *
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDedicatedHostGroup = getDedicatedHostGroup;
var createDedicatedHostGroup = function createDedicatedHostGroup(req, res) {
  var input = req.body;

  // Validate the name
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.dedicated_host_groups), input, req, res, 'resource with that name already exists', 'instance')) {
    return;
  }
  // Validate the zone
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }

  // Set the created_at field to now.
  input.created_at = utils.generateNowDate();

  // Add the resource
  var id = addDedicatedHostGroup(_server.db.getCollection(_server.COLS.dedicated_host_groups), input);

  // Now retrieve the resource from the DB and send it to the client.
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, id, res, false);
  res.status(201).json(formatDedicatedHostGroupForClient(dedicated_host_group, req, res)).end();
};

/**
 * deleteDedicatedHostGroup()
 *
 * Delete a specific Dedicated Host Group
 *
 * DELETE /dedicated_host/groups/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.createDedicatedHostGroup = createDedicatedHostGroup;
var deleteDedicatedHostGroup = function deleteDedicatedHostGroup(req, res) {
  var dedicated_host_group = utils.findResource(_server.COLS.dedicated_host_groups, req.params.group_id, res, false);
  if (!dedicated_host_group) {
    return;
  }
  var dedicatedHosts = _server.db.getCollection(_server.COLS.dedicated_hosts).chain().find().where(function (obj) {
    var _obj$group;
    return ((_obj$group = obj.group) === null || _obj$group === void 0 ? void 0 : _obj$group.id) === req.params.group_id;
  }).data({
    removeMeta: true
  });
  if ((dedicatedHosts === null || dedicatedHosts === void 0 ? void 0 : dedicatedHosts.length) > 0) {
    res.status(409).json((0, utils.generateErrors)('dedicated group has 1 or more dedicated hosts', 409, 'dedicated_group_in_use')).end();
    return;
  }
  var dedicated_host_groups = _server.db.getCollection(_server.COLS.dedicated_host_groups);
  dedicated_host_groups.remove(dedicated_host_group);
  res.status(204).end();
};

/**
 * updateDedicatedHostGroup()
 *
 * Update details in an existing Instance.
 *
 * PATCH /dedicated_host/groups/{id}
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteDedicatedHostGroup = deleteDedicatedHostGroup;
var updateDedicatedHostGroup = function updateDedicatedHostGroup(req, res) {
  var input = req.body;
  var dedicated_host_groups = _server.db.getCollection(_server.COLS.dedicated_host_groups);
  var originalDedicatedHostGroup = utils.findResource(_server.COLS.dedicated_host_groups, req.params.group_id, res, false);
  if (!originalDedicatedHostGroup) {
    return;
  }
  var updatedDedicatedHostGroup = _objectSpread(_objectSpread({}, originalDedicatedHostGroup), input);
  dedicated_host_groups.update(updatedDedicatedHostGroup);
  res.status(200).json(formatDedicatedHostGroupForClient(updatedDedicatedHostGroup, req, res)).end();
};

/**
 * findDedicatedHostForInstance()
 *
 * Find a dedicated host from a group to which we can add an instance. First
 * we find the collection of hosts that have sufficient capacity to hold the
 * provided instance. Then we randomly return one of them. If no host with
 * the required capacity is available we return undefined.
 *
 * @param {*} groupID
 * @param {*} instanceProfileName
 */
exports.updateDedicatedHostGroup = updateDedicatedHostGroup;
var findDedicatedHostForInstance = function findDedicatedHostForInstance(groupID, instanceProfileName) {
  var group = utils.findResource(_server.COLS.dedicated_host_groups, groupID, null, false);
  var hosts = group.dedicated_hosts;
  var instProfileInfo = utils.findResource(_server.COLS.profiles, instanceProfileName);
  var requested_vcpu = instProfileInfo.numberOfVirtualCPUs;
  var requested_memory = instProfileInfo.memorySize;
  var availableHost = hosts.filter(function (host) {
    var dedicated_host = utils.findResource(_server.COLS.dedicated_hosts, host, null, false);
    var available_vcpu = _lodash["default"].get(dedicated_host, 'available_vcpu.count', 0);
    var available_memory = _lodash["default"].get(dedicated_host, 'available_memory', 0);
    if (available_vcpu >= requested_vcpu && available_memory >= requested_memory) {
      return true;
    }
    return false;
  });
  return _casual["default"].random_element(availableHost);
};
exports.findDedicatedHostForInstance = findDedicatedHostForInstance;