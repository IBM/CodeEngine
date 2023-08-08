"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateSnapshot = exports.init = exports.getSnapshots = exports.getSnapshot = exports.formatSnapshotForClient = exports.deleteSnapshotsForVolume = exports.deleteSnapshot = exports.createSnapshot = exports.addSnapshot = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = require("lodash");
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _snapshot_clone = require("./snapshot_clone");
var _features = require("./features");
var _excluded = ["zone", "source_volume", "clones", "source_snapshot", "snapshot_consistency_group"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// Constants
var MINIMUM_CAPACITY = 100;

// const LifecycleStates = ['deleted', 'deleting', 'failed', 'pending', 'stable', 'updating', 'waiting', 'suspended'];
// @NOTE: currently only using available and pending statuses to make it easier to edit/delete/use
var LifecycleStates = ['stable', 'pending'];
var filter = function filter(req, res, resource) {
  // We need to filter based on source_volume and source_image
  if (req.query['source_volume.id']) {
    return resource.source_volume.id === req.query['source_volume.id'];
  }
  if (req.query['source_image.id']) {
    var _resource$source_imag;
    var sourceImageId = req.query['source_image.id'];
    // this will filter the list to only apply to "data" volumes
    if (sourceImageId === 'null') {
      return resource.source_image === undefined;
    }

    // this will filter the list to only apply "bootable" volumes
    if (sourceImageId === 'not:null') {
      return resource.source_image !== undefined;
    }
    return ((_resource$source_imag = resource.source_image) === null || _resource$source_imag === void 0 ? void 0 : _resource$source_imag.id) === sourceImageId;
  }
  if (req.query['snapshot_consistency_group.id']) {
    var _resource$snapshot_co;
    return ((_resource$snapshot_co = resource.snapshot_consistency_group) === null || _resource$snapshot_co === void 0 ? void 0 : _resource$snapshot_co.id) === req.query['snapshot_consistency_group.id'];
  }
  if (req.query['snapshot_consistency_group.crn']) {
    var _resource$snapshot_co2;
    return ((_resource$snapshot_co2 = resource.snapshot_consistency_group) === null || _resource$snapshot_co2 === void 0 ? void 0 : _resource$snapshot_co2.crn) === req.query['snapshot_consistency_group.crn'];
  }

  // We need to filter based on tags
  if (req.query.tag) {
    // ensure the tags from the request query are in an array
    var queryTags = (0, _lodash.flatten)([req.query.tag]);
    // find the intersection of the two arrays
    var matches = (0, _lodash.intersectionWith)(queryTags, resource.user_tags, _lodash.isEqual);
    // We are only returning volumes that match _all_ of the query tags requested
    return matches.length === queryTags.length;
  }

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var formatSnapshotForClient = function formatSnapshotForClient(req, snapshot) {
  var _snapshot$source_volu;
  // update the snapshot href according to the request
  snapshot.href = "".concat(utils.getBaseApiUrl(req), "snapshots/").concat(snapshot.id);

  // trim the zone to just name and href
  snapshot.zone = {
    name: snapshot.zone.name,
    href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(snapshot.zone.region_name, "/zones/").concat(snapshot.zone.name)
  };
  var rg = utils.getResource(_server.COLS.resourceGroups, snapshot.resource_group.id);
  snapshot.resource_group = _objectSpread({
    name: rg && rg[0] && rg[0].name
  }, snapshot.resource_group);
  var deletedInfo = {
    more_info: 'https://cloud.ibm.com/apidocs/vpc#deleted-resources'
  };
  if (snapshot.snapshot_consistency_group) {
    // update the snapshot_consistency_group href according to the request
    snapshot.snapshot_consistency_group.href = "".concat(utils.getBaseApiUrl(req), "snapshot_consistency_groups/").concat(snapshot.snapshot_consistency_group.id);
  }

  // format the href and/or deleted value for the source volume
  if ((_snapshot$source_volu = snapshot.source_volume) !== null && _snapshot$source_volu !== void 0 && _snapshot$source_volu.id) {
    snapshot.source_volume.href = "".concat(utils.getBaseApiUrl(req), "volumes/").concat(snapshot.source_volume.id);
    var foundVolume = utils.getResource(_server.COLS.volumes, snapshot.source_volume.id);
    // if the volume is deleted, we need to add the "deleted" section
    if (foundVolume.length === 0) {
      snapshot.source_volume.deleted = deletedInfo;
      snapshot.source_volume.name = utils.generateDeletedName(snapshot.source_volume.id);
    }
  }
  if (snapshot.source_image) {
    snapshot.operating_system = snapshot.source_image.operating_system;
    snapshot.source_image = utils.formatResourceLinkForClient(req, _server.COLS.images, snapshot.source_image);
    if (snapshot.source_image.id) {
      var foundImage = utils.getResource(_server.COLS.images, snapshot.source_image.id);
      if (foundImage.length === 0) {
        snapshot.source_image.deleted = deletedInfo;
        snapshot.source_image.name = utils.generateDeletedName(snapshot.source_image.id);
      }
    }
  }
  snapshot.clones = snapshot.clones.map(function (clone) {
    return (0, _snapshot_clone.formateSnapshotCloneForClient)(req, clone);
  });
  if (snapshot.copies) {
    snapshot.copies = snapshot.copies.map(function (copy) {
      var copyRegion = utils.getCrnField(copy.crn, 'region');
      return _objectSpread(_objectSpread({}, copy), {}, {
        href: "".concat(utils.getBaseApiUrl(req, copyRegion), "snapshots/").concat(copy.id)
      });
    });
  }
  return snapshot;
};

/**
 * addSnapshot()
 *
 * @param {*} snapshots - reference to the snapshots collection
 * @param {*} data - data to be used for snapshot creation
 */
exports.formatSnapshotForClient = formatSnapshotForClient;
var addSnapshot = function addSnapshot(snapshots) {
  var _data$zone;
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var inputZone = data.zone,
    inputSourceVolume = data.source_volume,
    inputClones = data.clones,
    inputSourceSnapshot = data.source_snapshot,
    inputSnapshotConsistencyGroup = data.snapshot_consistency_group,
    dataOverride = _objectWithoutProperties(data, _excluded);
  var zone = utils.getRandomZone();
  if (inputZone) {
    zone = utils.findZone(inputZone.name);
  } else if (data.region) {
    zone = (0, utils.findZoneInRegion)(data.region);
  }
  var encryption_key;
  var encryption = 'provider_managed';
  var source_volume;
  var source_image;
  var bootable = false;
  if (inputSourceVolume) {
    var foundVolume = utils.getResource(_server.COLS.volumes, inputSourceVolume.id);
    if (foundVolume.length > 0) {
      var _foundVolume$ = foundVolume[0],
        id = _foundVolume$.id,
        crn = _foundVolume$.crn,
        href = _foundVolume$.href,
        name = _foundVolume$.name,
        volZone = _foundVolume$.zone;
      var volumeAttachments = _server.db.getCollection(_server.COLS.volume_attachments).chain().where(function (resource) {
        return resource.volume.id === id;
      }).simplesort('name').data({
        removeMeta: true
      });
      encryption = foundVolume[0].encryption;
      encryption_key = foundVolume[0].encryption_key;
      source_volume = {
        id: id,
        crn: crn,
        href: href,
        name: name
      };

      // if we have a source volume, we need to make sure the snapshot's zone matches the volume
      zone = inputSourceSnapshot ? utils.findZone(inputZone.name) : volZone;
      if (volumeAttachments.length > 0 && volumeAttachments[0].type === 'boot') {
        // default all snapshot source_images to the first public image in images.json
        var instanceID = volumeAttachments[0].instance && volumeAttachments[0].instance.id;
        if (instanceID) {
          var instance = utils.getResource(_server.COLS.instances, instanceID)[0];
          source_image = utils.getResource(_server.COLS.images, instance.image.id)[0];
        } else {
          var defaultSourceImage = utils.getResource(_server.COLS.images, 'cfdaf1a0-5350-4350-fcbc-97173b510843')[0];
          source_image = defaultSourceImage;
        }
        bootable = true;
      }
    }
  }
  var clones = [];
  if (inputClones && inputClones.length > 0) {
    clones = inputClones.map(function (clone) {
      return (0, _snapshot_clone.SnapshotClone)({
        zone_name: clone.zone.name,
        href: clone.zone.href
      });
    });
  } else if (inputClones && inputClones.length === 0) {
    clones = [];
  } else {
    var _zone;
    clones = [(0, _snapshot_clone.SnapshotClone)({
      zone_name: (_zone = zone) === null || _zone === void 0 ? void 0 : _zone.name
    })];
  }
  var source_snapshot;
  if (inputSourceSnapshot) {
    var foundSnapshot = snapshots.find({
      crn: data.source_snapshot.crn
    });
    var _foundSnapshot$ = foundSnapshot[0],
      _id = _foundSnapshot$.id,
      _crn = _foundSnapshot$.crn,
      _href = _foundSnapshot$.href,
      _name = _foundSnapshot$.name;
    source_snapshot = {
      id: _id,
      crn: _crn,
      href: _href,
      name: _name
    };
  }
  var snapshot_consistency_group;
  if (inputSnapshotConsistencyGroup) {
    var foundConsistencyGroup = utils.getResource(_server.COLS.snapshot_consistency_groups, inputSnapshotConsistencyGroup.id);
    if (foundConsistencyGroup.length > 0) {
      var _foundConsistencyGrou = foundConsistencyGroup[0],
        _id2 = _foundConsistencyGrou.id,
        _crn2 = _foundConsistencyGrou.crn,
        _href2 = _foundConsistencyGrou.href,
        _name2 = _foundConsistencyGrou.name;
      snapshot_consistency_group = {
        id: _id2,
        crn: _crn2,
        href: _href2,
        name: _name2
      };
    }
  }
  if (data.encryptionKey) {
    encryption_key = data.encryptionKey;
    encryption = 'user_managed';
  }

  // UI-16759 - make the `minimum_capacity` based on the snapshot size (for randomness)
  var size = _casual["default"].integer(0, MINIMUM_CAPACITY);
  var crnRegion = data.region || ((_data$zone = data.zone) === null || _data$zone === void 0 ? void 0 : _data$zone.region_name);
  var baseData = {
    created_at: utils.generateCreateDate(),
    captured_at: utils.generateCreateDate(),
    crn: data.crn ? data.crn : utils.generateCRN({
      region: crnRegion
    }),
    bootable: bootable,
    deletable: true,
    encryption_key: encryption_key,
    encryption: encryption,
    href: '',
    // determined by formatSnapshotForClient()
    id: _casual["default"].uuid,
    lifecycle_state: _casual["default"].random_element(LifecycleStates),
    minimum_capacity: _casual["default"].integer(size, size * 2),
    name: utils.generateName('snapshot'),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'snapshot',
    size: size,
    source_image: source_image,
    source_volume: source_volume,
    source_snapshot: source_snapshot,
    snapshot_consistency_group: snapshot_consistency_group,
    clones: clones,
    zone: zone,
    user_tags: [],
    service_tags: []
  };
  var newSnapshot = _objectSpread(_objectSpread({}, baseData), dataOverride);
  snapshots.insert(newSnapshot);
  if (data.source_snapshot) {
    var originalSourceSnapshot = snapshots.find({
      crn: data.source_snapshot.crn
    });
    var originalSnapshot = originalSourceSnapshot[0];
    var _id3 = newSnapshot.id,
      _crn3 = newSnapshot.crn,
      _name3 = newSnapshot.name,
      resource_type = newSnapshot.resource_type;
    var copyInfo = {
      id: _id3,
      crn: _crn3,
      name: _name3,
      resource_type: resource_type
    };
    if (originalSnapshot.copies) {
      originalSnapshot.copies.push(copyInfo);
      snapshots.update(originalSnapshot);
    } else {
      var newCopies = [_objectSpread({}, copyInfo)];
      var snapshotWithNewCopies = _objectSpread(_objectSpread({}, originalSnapshot), {}, {
        copies: newCopies
      });
      snapshots.update(snapshotWithNewCopies);
    }
  }
  return newSnapshot;
};
exports.addSnapshot = addSnapshot;
var init = function init() {
  var snapshots = _server.db.addCollection(_server.COLS.snapshots, {
    clone: true
  });
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // add a snapshot of a known static volume
  addSnapshot(snapshots, {
    id: 'snapshot-1001',
    source_volume: {
      id: 'vol1001'
    },
    name: 'aaa-default-snapshot-1',
    crn: 'crn:v1:staging:public:is:us-east:a/823bd195e9fd4f0db40ac2e1bffef3e0:042756b8-923d-4b40-8379-20c518275d7f::',
    lifecycle_state: 'stable',
    zone: utils.findZone(utils.getDefaultZone()),
    user_tags: ['asdf', 'default-backup-policy-1-default-plan'],
    service_tags: ['backup-managed']
  });
  addSnapshot(snapshots, {
    id: 'snapshot-1002',
    source_volume: {
      id: 'vol1001'
    },
    snapshot_consistency_group: {
      crn: 'crn:v1:staging:public:is:us-east:a/823bd195e9fd4f0db40ac2e1bffef3p0:042756b8-923d-4b40-8379-20c518275d9f::',
      id: 'snpshtCG-1001',
      name: 'aaa-snapshot-consistency-group-1',
      resource_type: ['snapshot_consistency_group']
    },
    name: 'aaa-default-snapshot-2',
    lifecycle_state: 'stable',
    zone: utils.findZone(utils.getDefaultZone())
  });
  addSnapshot(snapshots, {
    id: 'snapshot-1003',
    source_volume: {
      id: 'vol1001'
    },
    name: 'aaa-default-snapshot-3',
    lifecycle_state: 'stable',
    zone: utils.findZone(utils.getDefaultZone())
  });
  // add a number of additional snapshots
};

/**
 * getSnapshots() - gets a paginated list of snapshots
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.init = init;
var getSnapshots = function getSnapshots(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var snapshots = utils.getResources(req, _server.COLS.snapshots, extraFilter, 'created_at', {
    desc: true
  });
  snapshots.snapshots.forEach(function (snapshot) {
    return formatSnapshotForClient(req, snapshot);
  });
  res.json(snapshots).end();
};

/**
 * createSnapshot() - creates a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshots = getSnapshots;
var createSnapshot = function createSnapshot(req, res) {
  var _req$params;
  var input = req.body;

  // make sure we're not creating a snapshot that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.snapshots), input, req, res, errorMsg, 'snapshots')) {
    return;
  }

  // add the snapshot
  input.status = LifecycleStates[0];
  input.created_at = utils.generateNowDate();
  input.captured_at = utils.generateNowDate();
  input.region = (_req$params = req.params) === null || _req$params === void 0 ? void 0 : _req$params.region;
  var newSnapshot = addSnapshot(_server.db.getCollection(_server.COLS.snapshots), input);

  // return the newly added snapshot
  var snapshots = _server.db.getCollection(_server.COLS.snapshots).chain().find({
    id: newSnapshot.id
  }).data({
    removeMeta: true
  });
  var snapshot = formatSnapshotForClient(req, snapshots[0]);
  res.status(201).json(snapshot).end();
};

/**
 * Removes deleted snapshot from source snapshots copies array
 * @param copyId
 */
exports.createSnapshot = createSnapshot;
var deleteCopyFromSnapshots = function deleteCopyFromSnapshots(copyId) {
  var collection = _server.db.getCollection(_server.COLS.snapshots);
  var snapsWithCopy = collection.where(function (snap) {
    var _snap$copies;
    return (_snap$copies = snap.copies) === null || _snap$copies === void 0 ? void 0 : _snap$copies.some(function (copy) {
      return copy.id === copyId;
    });
  });
  if (!snapsWithCopy || snapsWithCopy.length === 0 || !copyId) {
    return;
  }
  var snapWithCopyRemoved = snapsWithCopy.map(function (snapshot) {
    snapshot.copies = snapshot.copies.filter(function (c) {
      return c.id !== copyId;
    });
    return snapshot;
  });
  collection.update(snapWithCopyRemoved);
};

/**
 * deleteSnapshot() - deletes a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
var deleteSnapshot = function deleteSnapshot(req, res) {
  var collection = _server.db.getCollection(_server.COLS.snapshots);
  var snapshots = collection.find({
    id: req.params.snapshot_id
  });
  if (!snapshots || snapshots.length === 0) {
    res.status(404).end();
    return;
  }
  var snapshot = snapshots[0];
  if (snapshot.source_snapshot) {
    deleteCopyFromSnapshots(snapshot.id);
  }
  collection.remove(snapshot);
  res.status(204).end();
};

/**
 * deleteSnapshotsForVolume() - deletes a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.deleteSnapshot = deleteSnapshot;
var deleteSnapshotsForVolume = function deleteSnapshotsForVolume(req, res) {
  var sourceVolumeID = req.query['source_volume.id'];
  var collection = _server.db.getCollection(_server.COLS.snapshots);
  var snapshots = collection.where(function (snapshot) {
    return snapshot.source_volume.id === sourceVolumeID;
  });
  if (!snapshots || snapshots.length === 0 || !sourceVolumeID) {
    res.status(400).end();
    return;
  }
  collection.findAndRemove({
    'source_volume.id': sourceVolumeID
  });
  res.status(204).end();
};

/**
 * getSnapshot() - gets a single snapshot by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.deleteSnapshotsForVolume = deleteSnapshotsForVolume;
var getSnapshot = function getSnapshot(req, res) {
  // find the specific snapshot from the collection
  var snapshots = _server.db.getCollection(_server.COLS.snapshots).chain().find({
    id: req.params.snapshot_id
  }).data({
    removeMeta: true
  });
  if (!snapshots || snapshots.length === 0) {
    res.status(404).end();
    return;
  }
  var snapshot = formatSnapshotForClient(req, snapshots[0]);

  // return the snapshot
  res.json(snapshot).end();
};

/**
 * updateSnapshot() - updates a specific snapshot by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshot = getSnapshot;
var updateSnapshot = function updateSnapshot(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.snapshots);
  var results = collection.find({
    id: req.params.snapshot_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var snapshotToUpdate = results[0];
  var updatedSnapshot = _objectSpread(_objectSpread({}, snapshotToUpdate), input);

  // update the snapshot
  collection.update(updatedSnapshot);
  // find the updated snapshot
  var updatedResults = collection.find({
    id: updatedSnapshot.id
  });
  var updatedResult = formatSnapshotForClient(req, updatedResults[0]);
  // return the updated snapshot
  res.status(200).json(updatedResult).end();
};
exports.updateSnapshot = updateSnapshot;