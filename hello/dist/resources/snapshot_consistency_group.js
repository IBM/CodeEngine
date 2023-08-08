"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateSnapshotConsistencyGroup = exports.init = exports.getSnapshotConsistencyGroups = exports.getSnapshotConsistencyGroup = exports.deleteSnapshotConsistencyGroup = exports.createSnapshotConsistencyGroup = exports.addSnapshotConsistencyGroup = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _snapshot_reference = require("./snapshot_reference");
var _excluded = ["isInit", "zone", "snapshots"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// const LifecycleStates = ['deleting', 'failed', 'pending', 'stable', 'updating', 'waiting', 'suspended'];
// @NOTE: currently only using stable and pending statuses to make it easier to edit/delete/use
var LifecycleStates = ['stable', 'pending'];
var filter = function filter(req, res, resource) {
  // We need to filter based on backup_policy_plan
  if (req.query['backup_policy_plan.id']) {
    return resource.backup_policy_plan.id === req.query['backup_policy_plan.id'];
  }

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var formatSnapshotConsistencyGroupForClient = function formatSnapshotConsistencyGroupForClient(req, snapshotConsistencyGroup) {
  // update the snapshot consistency group href according to the request
  snapshotConsistencyGroup.href = "".concat(utils.getBaseApiUrl(req), "snapshot_consistency_groups/").concat(snapshotConsistencyGroup.id);
  var rg = utils.getResource(_server.COLS.resourceGroups, snapshotConsistencyGroup.resource_group.id);
  snapshotConsistencyGroup.resource_group = _objectSpread({
    name: rg && rg[0] && rg[0].name
  }, snapshotConsistencyGroup.resource_group);
  return snapshotConsistencyGroup;
};

/**
 * addSnapshotConsistencyGroup()
 *
 * @param {*} consistencyGroups - reference to the snapshot consistency group collection
 * @param {*} data - data to be used for snapshot creation
 */
var addSnapshotConsistencyGroup = function addSnapshotConsistencyGroup(consistencyGroups) {
  var _data$zone;
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var isInit = data.isInit,
    inputZone = data.zone,
    inputSnapshots = data.snapshots,
    dataOverride = _objectWithoutProperties(data, _excluded);
  var zone = utils.getRandomZone();
  if (inputZone) {
    zone = utils.findZone(inputZone.name);
  } else if (data.region) {
    zone = utils.findZoneInRegion(data.region);
  }
  var snapshotMembers = [];
  if (inputSnapshots) {
    snapshotMembers = inputSnapshots.map(function (snap) {
      if (isInit) {
        return (0, _snapshot_reference.SnapshotReference)(_objectSpread({}, snap));
      }
      var foundSnap = utils.getResource(_server.COLS.snapshots, snap.id);
      if (foundSnap.length > 0) {
        var _foundSnap$ = foundSnap[0],
          id = _foundSnap$.id,
          crn = _foundSnap$.crn,
          href = _foundSnap$.href,
          name = _foundSnap$.name;
        return (0, _snapshot_reference.SnapshotReference)({
          id: id,
          crn: crn,
          href: href,
          name: name
        });
      }
      return null;
    });
  }
  var crnRegion = data.region || ((_data$zone = data.zone) === null || _data$zone === void 0 ? void 0 : _data$zone.region_name);
  var baseData = {
    created_at: utils.generateCreateDate(),
    crn: data.crn ? data.crn : utils.generateCRN({
      region: crnRegion
    }),
    deleteSnapshotsOnDelete: true,
    href: '',
    // determined by formatSnapshotConsistencyGroupForClient()
    id: _casual["default"].uuid,
    lifecycle_state: _casual["default"].random_element(LifecycleStates),
    name: utils.generateName('snapshotConsistencyGroup'),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'snapshot',
    snapshot_members: snapshotMembers,
    zone: zone,
    service_tags: ['is.instance:instance-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
  };
  var newSnapshotConsistencyGroup = _objectSpread(_objectSpread({}, baseData), dataOverride);
  consistencyGroups.insert(newSnapshotConsistencyGroup);
  return newSnapshotConsistencyGroup;
};
exports.addSnapshotConsistencyGroup = addSnapshotConsistencyGroup;
var init = function init() {
  var consistencyGroups = _server.db.addCollection(_server.COLS.snapshot_consistency_groups);

  // add a snapshot of a known static volume
  addSnapshotConsistencyGroup(consistencyGroups, {
    isInit: true,
    id: 'snpshtCG-1001',
    snapshots: [{
      id: 'snapshot-1001',
      name: 'aaa-default-snapshot-1',
      crn: 'crn:v1:staging:public:is:us-east:a/823bd195e9fd4f0db40ac2e1bffef3e0:042756b8-923d-4b40-8379-20c518275d7f::',
      href: ''
    }],
    name: 'aaa-snapshot-consistency-group-1',
    crn: 'crn:v1:staging:public:is:us-east:a/823bd195e9fd4f0db40ac2e1bffef3p0:042756b8-923d-4b40-8379-20c518275d9f::',
    lifecycle_state: 'stable',
    zone: utils.findZone(utils.getDefaultZone())
  });
};

/**
 * getSnapshotConsistencyGroups() - gets a paginated list of snapshots consistency groups
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.init = init;
var getSnapshotConsistencyGroups = function getSnapshotConsistencyGroups(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var consistencyGroups = utils.getResources(req, _server.COLS.snapshot_consistency_groups, extraFilter, 'created_at', {
    desc: true
  });
  consistencyGroups.snapshot_consistency_groups.forEach(function (group) {
    return formatSnapshotConsistencyGroupForClient(req, group);
  });
  res.json(consistencyGroups).end();
};

/**
 * createSnapshot() - creates a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshotConsistencyGroups = getSnapshotConsistencyGroups;
var createSnapshotConsistencyGroup = function createSnapshotConsistencyGroup(req, res) {
  var input = req.body;

  // make sure we're not creating a group that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.snapshot_consistency_groups), input, req, res, errorMsg, 'snapshot_consistency_groups')) {
    return;
  }

  // add the snapshot
  input.status = LifecycleStates[0];
  input.created_at = utils.generateNowDate();
  var newConsistencyGroup = addSnapshotConsistencyGroup(_server.db.getCollection(_server.COLS.snapshot_consistency_groups), input);

  // return the newly added consistency group
  var consistencyGroups = _server.db.getCollection(_server.COLS.snapshot_consistency_groups).chain().find({
    id: newConsistencyGroup.id
  }).data({
    removeMeta: true
  });
  var consistencyGroup = formatSnapshotConsistencyGroupForClient(req, consistencyGroups[0]);
  res.status(201).json(consistencyGroup).end();
};

/**
 * createSnapshotConsistencyGroup() - deletes a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.createSnapshotConsistencyGroup = createSnapshotConsistencyGroup;
var deleteSnapshotConsistencyGroup = function deleteSnapshotConsistencyGroup(req, res) {
  var collection = _server.db.getCollection(_server.COLS.snapshot_consistency_groups);
  var snapshotConsistencyGroups = collection.find({
    id: req.params.group_id
  });
  if (!snapshotConsistencyGroups || snapshotConsistencyGroups.length === 0) {
    res.status(404).end();
    return;
  }
  var group = snapshotConsistencyGroups[0];
  collection.remove(group);
  res.status(204).end();
};

/**
 * getSnapshotConsistencyGroup() - gets a single snapshot by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.deleteSnapshotConsistencyGroup = deleteSnapshotConsistencyGroup;
var getSnapshotConsistencyGroup = function getSnapshotConsistencyGroup(req, res) {
  // find the specific consistency group from the collection
  var groups = _server.db.getCollection(_server.COLS.snapshot_consistency_groups).chain().find({
    id: req.params.group_id
  }).data({
    removeMeta: true
  });
  if (!groups || groups.length === 0) {
    res.status(404).end();
    return;
  }
  var consistencyGroup = formatSnapshotConsistencyGroupForClient(req, groups[0]);

  // return the consistency group
  res.json(consistencyGroup).end();
};

/**
 * updateSnapshotConsistencyGroup() - updates a specific snapshot consistency group by ID
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshotConsistencyGroup = getSnapshotConsistencyGroup;
var updateSnapshotConsistencyGroup = function updateSnapshotConsistencyGroup(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.snapshot_consistency_groups);
  var results = collection.find({
    id: req.params.group_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var groupToUpdate = results[0];
  var updatedGroup = _objectSpread(_objectSpread({}, groupToUpdate), input);

  // update the consistency group
  collection.update(updatedGroup);
  // find the updated consistency group
  var updatedResults = collection.find({
    id: updatedGroup.id
  });
  var updatedResult = formatSnapshotConsistencyGroupForClient(req, updatedResults[0]);
  // return the updated consistency group
  res.status(200).json(updatedResult).end();
};
exports.updateSnapshotConsistencyGroup = updateSnapshotConsistencyGroup;