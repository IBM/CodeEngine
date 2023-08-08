"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateVolume = exports.isVolumeActive = exports.init = exports.getVolumes = exports.getVolume = exports.deleteVolume = exports.createVolumeFromSnapshot = exports.createVolume = exports.createBootVolume = exports.addVolume = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = require("lodash");
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _volumeProfiles = require("./volumeProfiles");
var _volumeAttachments = require("./volumeAttachments");
var _keyprotect = require("../external/resources/keyprotect");
var _features = require("./features");
var _excluded = ["zone", "encryption", "encryption_key", "source_snapshot"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var healthStatusReasons = [{
  code: 'internal_error',
  message: 'Internal error',
  more_info: 'https://cloud.ibm.com/docs/vpc?topic='
}, {
  code: 'initializing_from_snapshot',
  message: 'Volume is being created from a snapshot',
  more_info: 'https://cloud.ibm.com/docs/vpc?topic='
}];

// Constants
var DEFAULT_NUMBER_OF_VOLUMES = 25;
var MIN_CAPACITY = 10;
var MAX_CAPACITY = 16000;
var MIN_IOPS = 100;
var MAX_IOPS = 1000;
var DEFAULT_BOOT_VOLUME_CAPACITY = 100;
var VolumeStatuses = ['available', 'pending', 'unusable'];
var HealthStatuses = ['ok', 'degraded', 'faulted', 'inapplicable'];
// @NOTE: currently only using available and pending statuses to make it easier to edit/delete/use
// the mock volumes.  Below is the full list of statuses.
// const VolumeStatuses = ['available', 'failed', 'pending', 'pending_deletion', 'pending_update'];

var EncryptionTypes = ['provider_managed', 'user_managed'];
var VOLUME_ATTACHMENT_STATES = ['unattached', 'attached', 'unusable'];
var filterTag = function filterTag(req, resource) {
  // We need to filter based on tags
  if (req.query.tag) {
    // ensure the tags from the request query are in an array
    var queryTags = (0, _lodash.flatten)([req.query.tag]);
    // find the intersection of the two arrays
    var matches = (0, _lodash.intersectionWith)(queryTags, resource.user_tags, _lodash.isEqual);
    // We are only returning volumes that match _all_ of the query tags requested
    return matches.length === queryTags.length;
  }
  return true;
};
var filterZone = function filterZone(req, resource) {
  var zoneFilter = req.query['zone?.name'];
  if (zoneFilter) {
    return resource.zone === zoneFilter;
  }
  return true;
};
var filterOSAttribute = function filterOSAttribute(req, resource, attributeKey) {
  var osQueryParam = req.query["operating_system.".concat(attributeKey)];
  if (osQueryParam) {
    return resource.operating_system && resource.operating_system[attributeKey] === osQueryParam;
  }
  return true;
};
var filterOSArchitecture = function filterOSArchitecture(req, resource) {
  return filterOSAttribute(req, resource, 'architecture');
};
var filterOSFamily = function filterOSFamily(req, resource) {
  return filterOSAttribute(req, resource, 'family');
};
var filterEncryptionType = function filterEncryptionType(req, resource) {
  if (req.query.encryption_type) {
    return resource.encryption && resource.encryption === req.query.encryption_type;
  }
  return true;
};
var filterAttachmentState = function filterAttachmentState(req, resource) {
  var attachmentStateQuery = req.query.attachment_state;
  if (attachmentStateQuery) {
    // check whether volume attachment state is unattached
    if (attachmentStateQuery === VOLUME_ATTACHMENT_STATES[0]) {
      return !resource.volume_attachments || !resource.volume_attachments.length;
    }
    if (attachmentStateQuery === VOLUME_ATTACHMENT_STATES[1]) {
      // check whether volume attachment state is attached
      return !!resource.volume_attachments && resource.volume_attachments.length;
    }
    // check whether volume attachment state is unusable
    if (attachmentStateQuery === VOLUME_ATTACHMENT_STATES[2]) {
      return resource.status === attachmentStateQuery;
    }
  }
  /*
  * If there was no query parameter then we don't want to filter so
  * we just return true here.
  */
  return true;
};
var filter = function filter(req, res, resource) {
  return filterTag(req, resource) && filterZone(req, resource) && filterOSArchitecture(req, resource) && filterOSFamily(req, resource) && filterEncryptionType(req, resource) && filterAttachmentState(req, resource);
};
var isVolumeActive = function isVolumeActive(req, volume, volAtts) {
  var volAttachments = volAtts;
  if (!volAttachments) {
    volAttachments = (0, _volumeAttachments.fetchAttachmentForVolume)(req, volume.id);
  }
  return !!volAttachments.find(function (attachment) {
    var _attachment$instance;
    var instanceID = (_attachment$instance = attachment.instance) === null || _attachment$instance === void 0 ? void 0 : _attachment$instance.id;
    if (instanceID) {
      var instance = utils.findResource(_server.COLS.instances, instanceID, undefined, true);
      return instance.status === 'running';
    }
    return false;
  });
};
exports.isVolumeActive = isVolumeActive;
var formatVolumeForClient = function formatVolumeForClient(req, volume) {
  var _volume$profile;
  // update the volume href according to the request
  volume.href = "".concat(utils.getBaseApiUrl(req), "volumes/").concat(volume.id);
  volume.crn = utils.updateResourceCrnRegion(volume, req);

  // determine the number of iops for the volume
  //  - Tiered profile volumes get the number of iops of the tier
  //  - Custom profile volumes get the custom number of iops (no change from default)
  volume.iops = (0, _volumeProfiles.getIOPSForProfile)(volume.capacity, volume.profile, volume.iops);

  // trim the zone to just name and href
  volume.zone = {
    name: volume.zone.name,
    href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(volume.zone.region_name, "/zones/").concat(volume.zone.name)
  };

  // trim the profile to just name/crn/href
  volume.profile = {
    name: volume.profile.name,
    crn: utils.updateResourceCrnRegion(volume.profile, req),
    href: "".concat(utils.getBaseApiUrl(req), "volume/profiles/").concat(volume.profile.name)
  };
  var rg = utils.getResource(_server.COLS.resourceGroups, volume.resource_group.id);
  volume.resource_group = _objectSpread({
    name: rg && rg[0] && rg[0].name
  }, volume.resource_group);
  var attachmentStateQuery = req.query.attachment_state;
  if (!attachmentStateQuery && attachmentStateQuery !== VOLUME_ATTACHMENT_STATES[0]) {
    volume.volume_attachments = (0, _volumeAttachments.fetchAttachmentForVolume)(req, volume.id);
  }
  volume.active = isVolumeActive(req, volume, volume.volume_attachments);
  volume.bandwidth = utils.getVolumeBandWidthByIops(volume.iops, (_volume$profile = volume.profile) === null || _volume$profile === void 0 ? void 0 : _volume$profile.name);
  return volume;
};

/**
 * addVolume()
 *
 * @param {*} volumes - reference to the volumes collection
 * @param {*} data - data to be used for volume creation
 */
var addVolume = function addVolume(volumes) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var inputZone = data.zone,
    inputEnc = data.encryption,
    inputEncKey = data.encryption_key,
    inputSourceSnapshot = data.source_snapshot,
    dataOverride = _objectWithoutProperties(data, _excluded);
  var volumeStatus = data !== null && data !== void 0 && data.storage_volume_available ? VolumeStatuses[0] : _casual["default"].random_element(VolumeStatuses);
  var statusReasons = [];
  if (volumeStatus === 'unusable') {
    statusReasons.push({
      code: 'encryption_key_deleted',
      message: 'Encryption key has been deleted.',
      more_info: 'https://cloud.ibm.com/docs/key-protect?topic=key-protect-restore-keys'
    });
  }
  var zone = inputZone && utils.findZone(inputZone.name) || utils.getRandomZone();
  var encryption_key;
  var encryption;
  if (inputEnc) {
    encryption = inputEnc;
    var rootKey = (0, _keyprotect.getRootKey)(zone);
    encryption_key = encryption === 'user_managed' ? {
      crn: rootKey && rootKey.crn
    } : undefined;
  }
  if (inputEncKey) {
    encryption = 'user_managed';
    encryption_key = inputEncKey;
  }
  if (!inputEnc && !inputEncKey) {
    encryption = 'provider_managed';
    encryption_key = undefined;
  }
  var healthStatus = HealthStatuses[0];
  var healthReasons = [];
  var source_snapshot;
  var source_image;
  if (inputSourceSnapshot) {
    var foundSnapshot = utils.getResource(_server.COLS.snapshots, inputSourceSnapshot.id);
    if (foundSnapshot.length > 0) {
      var _foundSnapshot$ = foundSnapshot[0],
        id = _foundSnapshot$.id,
        crn = _foundSnapshot$.crn,
        href = _foundSnapshot$.href,
        name = _foundSnapshot$.name,
        resource_type = _foundSnapshot$.resource_type;
      source_image = foundSnapshot[0].source_image;
      source_snapshot = {
        id: id,
        crn: crn,
        href: href,
        name: name,
        resource_type: resource_type
      };
      healthStatus = _casual["default"].coin_flip ? HealthStatuses[0] : HealthStatuses[3];
      healthReasons.push(healthStatusReasons[1]);
    }
  }
  var baseData = {
    id: _casual["default"].uuid,
    crn: utils.generateCRN(),
    name: utils.generateName('volume'),
    href: '',
    // determined by formatVolumeForClient()
    capacity: _casual["default"].integer(MIN_CAPACITY, MAX_CAPACITY),
    iops: _casual["default"].integer(MIN_IOPS, MAX_IOPS),
    // overridden if a tiered profile by formatVolumeForClient()
    encryption: encryption,
    encryption_key: encryption_key,
    status: volumeStatus,
    status_reasons: statusReasons,
    zone: zone,
    busy: _casual["default"].integer(0, 20) === 1,
    profile: data.profile ? data.profile : utils.getRandomResource(_server.COLS.volume_profiles),
    user_tags: [],
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    created_at: utils.generateCreateDate(),
    volume_attachments: [],
    // attachments are overridden by formatVolumeForClient()
    source_snapshot: source_snapshot,
    source_image: source_image,
    health_state: healthStatus,
    health_reasons: healthReasons
  };
  var newVolume = _objectSpread(_objectSpread({}, baseData), dataOverride);
  volumes.insert(newVolume);
  return newVolume;
};

/**
 * createBootVolume() - creates a boot volume for an instance
 * @param {*} instance - a VSI
 * @param {*} capacity - the capacity for the boot volume (optional)
 */
exports.addVolume = addVolume;
var createBootVolume = function createBootVolume(instance) {
  var _instance$image;
  var capacity = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_BOOT_VOLUME_CAPACITY;
  var volumes = _server.db.getCollection(_server.COLS.volumes);
  var profiles = utils.getResource(_server.COLS.volume_profiles, 'general-purpose');
  var profile = profiles[0];
  var bootVolumeTemplate = {
    name: "".concat(instance.name, "-BOOT"),
    capacity: capacity,
    busy: false,
    zone: instance.zone,
    profile: profile,
    tags: ['boot'],
    encryption: _casual["default"].random_element(EncryptionTypes),
    storage_volume_available: instance === null || instance === void 0 ? void 0 : instance.storage_volume_available
  };
  if ((_instance$image = instance.image) !== null && _instance$image !== void 0 && _instance$image.id) {
    var image = utils.findResource(_server.COLS.images, instance.image.id, undefined, true);
    if (image) {
      if (image.operating_system) {
        bootVolumeTemplate.operating_system = image.operating_system;
      }
      bootVolumeTemplate.source_image = {
        id: image.id,
        name: image.name
      };
    }
  }
  return addVolume(volumes, bootVolumeTemplate);
};
exports.createBootVolume = createBootVolume;
var init = function init() {
  var volumes = _server.db.addCollection(_server.COLS.volumes);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // add a known static volume
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    encryption: _casual["default"].random_element(EncryptionTypes),
    id: 'vol1001',
    name: 'aaa-default-volume-1',
    status: 'available',
    busy: false,
    profile: {
      id: 'custom',
      name: 'custom',
      crn: 'crn:v1:staging:public:globalcatalog::::volume.profile:custom',
      family: 'custom',
      generation: 2
    },
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: ['defaultBackupTag:defaultBackupTagValue']
  });

  // add a number of additional volumes
  utils.repeat(function () {
    addVolume(volumes, {
      capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
      encryption: _casual["default"].random_element(EncryptionTypes)
    });
  }, DEFAULT_NUMBER_OF_VOLUMES);
};

/**
 * getVolumes() - gets a paginated list of volumes
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.init = init;
var getVolumes = function getVolumes(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var volumes = utils.getResources(req, _server.COLS.volumes, extraFilter);
  volumes.volumes.forEach(function (volume) {
    return formatVolumeForClient(req, volume);
  });
  res.json(volumes).end();
};

/**
 * createVolume() - creates a volume
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getVolumes = getVolumes;
var createVolume = function createVolume(req, res) {
  var input = req.body;

  // make sure we're not creating a volume that already exists
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.volumes), input, req, res, 'resource with that name already exists', 'volume')) {
    return;
  }

  // add the volume
  input.status = VolumeStatuses[0];
  var newVolume = addVolume(_server.db.getCollection(_server.COLS.volumes), input);
  // return the newly added volume
  var volumes = _server.db.getCollection(_server.COLS.volumes).chain().find({
    id: newVolume.id
  }).data({
    removeMeta: true
  });
  var volume = formatVolumeForClient(req, volumes[0]);
  res.status(201).json(volume).end();
};

/**
 * deleteVolume() - deletes a volume
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.createVolume = createVolume;
var deleteVolume = function deleteVolume(req, res) {
  var collection = _server.db.getCollection(_server.COLS.volumes);
  var volumes = collection.find({
    id: req.params.volume_id
  });
  if (!volumes || volumes.length === 0) {
    res.status(404).end();
    return;
  }
  var volume = volumes[0];

  // extra response case if attempting to delete a volume that has attachments
  var volume_attachments = (0, _volumeAttachments.fetchAttachmentForVolume)(req, volume.id);
  if (volume_attachments.length > 0) {
    res.status(403).end();
    return;
  }
  collection.remove(volume);
  res.status(204).end();
};

/**
 * getVolume() - gets a single volume by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.deleteVolume = deleteVolume;
var getVolume = function getVolume(req, res) {
  // find the specific volume from the collection
  var volumes = _server.db.getCollection(_server.COLS.volumes).chain().find({
    id: req.params.volume_id
  }).data({
    removeMeta: true
  });
  if (!volumes || volumes.length === 0) {
    res.status(404).end();
    return;
  }
  var volume = formatVolumeForClient(req, volumes[0]);

  // return the volume
  res.json(volume).end();
};

/**
 * updateVolume() - updates a specific volume by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getVolume = getVolume;
var updateVolume = function updateVolume(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.volumes);
  var results = collection.find({
    id: req.params.volume_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var volumeToUpdate = results[0];

  // UI-11250 - expandable volume support
  // @NOTE: this can be removed later, but errors would be useful during dev
  // return an error if `name`, `capacity`, `iops`, or `profile` are in the input body
  if (Object.keys(input).length > 1 && !input.iops && !input.profile) {
    var errorObj = {
      code: 'bad_field',
      message: 'The input body cannot contain more than one value.',
      target: {
        type: '',
        name: ''
      }
    };
    res.status(500).json({
      errors: [errorObj]
    }).end();
    return;
  }

  // return an error if the capacity is too large
  if (input.capacity > MAX_CAPACITY) {
    var _errorObj = {
      code: 'capacity_too_large',
      message: 'The requested capacity is too large for this volume profile.',
      target: {
        type: '',
        name: ''
      }
    };
    res.status(500).json({
      errors: [_errorObj]
    }).end();
    return;
  }

  // return an error if the updated capacity is smaller than the current capacity
  if (input.capacity < volumeToUpdate.capacity) {
    var _errorObj2 = {
      code: 'capacity_too_small',
      message: 'The requested capacity is smaller than the current volume capacity.',
      target: {
        type: '',
        name: ''
      }
    };
    res.status(500).json({
      errors: [_errorObj2]
    }).end();
    return;
  }
  var updatedVolume = _objectSpread(_objectSpread({}, volumeToUpdate), input);

  // update the volume
  collection.update(updatedVolume);
  // find the updated volume
  var updatedResults = collection.find({
    id: updatedVolume.id
  });
  var updatedResult = formatVolumeForClient(req, updatedResults[0]);
  // return the updated volume
  res.status(200).json(updatedResult).end();
};
exports.updateVolume = updateVolume;
var createVolumeFromSnapshot = function createVolumeFromSnapshot() {
  var volumes = _server.db.getCollection(_server.COLS.volumes);

  // add a known static volume from a known snapshot
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    encryption: _casual["default"].random_element(EncryptionTypes),
    id: 'vol1002',
    name: 'aaa-default-snap-volume-1',
    status: 'available',
    busy: false,
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: [],
    source_snapshot: {
      id: 'snapshot-1001'
    }
  });
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    id: 'vol1003',
    name: 'aaa-default-snap-volume-2',
    status: 'available',
    busy: false,
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: [],
    source_snapshot: {
      id: 'snapshot-1001'
    },
    profile: {
      id: 'custom',
      name: 'custom',
      crn: 'crn:v1:staging:public:globalcatalog::::volume.profile:custom',
      family: 'custom',
      generation: 2
    }
  });
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    encryption: EncryptionTypes[0],
    id: 'vol1004',
    name: 'aaa-default-snap-volume-3',
    status: 'available',
    busy: false,
    profile: {
      id: 'custom',
      name: 'custom',
      crn: 'crn:v1:staging:public:globalcatalog::::volume.profile:custom',
      family: 'custom',
      generation: 2
    },
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: [],
    source_snapshot: {
      id: 'snapshot-1001'
    }
  });
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    encryption: EncryptionTypes[0],
    id: 'vol1005',
    name: 'aaa-default-snap-volume-4',
    status: 'available',
    busy: false,
    profile: {
      id: 'custom',
      name: 'custom',
      crn: 'crn:v1:staging:public:globalcatalog::::volume.profile:custom',
      family: 'custom',
      generation: 2
    },
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: [],
    source_snapshot: {
      id: 'snapshot-1001'
    }
  });
  addVolume(volumes, {
    capacity: _casual["default"].integer(MIN_CAPACITY, 2000),
    encryption: EncryptionTypes[0],
    id: 'vol1006',
    name: 'aaa-aa-default-snap-volume-5',
    status: 'available',
    busy: false,
    profile: {
      id: 'custom',
      name: 'custom',
      crn: 'crn:v1:staging:public:globalcatalog::::volume.profile:custom',
      family: 'custom',
      generation: 2
    },
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: [],
    source_snapshot: {
      id: 'snapshot-1001'
    }
  });
};
exports.createVolumeFromSnapshot = createVolumeFromSnapshot;