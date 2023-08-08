"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updatePlacementGroup = exports.init = exports.getPlacementGroups = exports.getPlacementGroup = exports.deletePlacementGroup = exports.createPlacementGroup = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _common = require("./common");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var PLACEMENT_STRATEGY = ['host_spread', 'power_spread', 'cluster'];
var addPlacementGroup = function addPlacementGroup(placementGroups) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var id = casual.uuid;
  var region = data.regionID || utils.getRandomRegion().name;
  var placementGroup = Object.assign({
    id: id,
    name: data.name || utils.generateName('vsi-placement-group'),
    crn: utils.generateCRN({
      region: data.regionID
    }),
    region: region,
    created_at: utils.generateCreateDate(),
    strategy: PLACEMENT_STRATEGY[casual.integer(0, PLACEMENT_STRATEGY.length - 1)],
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'placement_group',
    lifecycle_state: data.lifecycle_state || utils.getRandomLifecycleState()
  }, data);
  if (!placementGroup.name) {
    placementGroup.name = utils.generateName('vsi-placement-group', {
      region_name: region
    });
  }
  placementGroups.insert(placementGroup);
  return id;
};
var init = function init() {
  var placementGroups = _server.db.addCollection(_server.COLS.placement_groups);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group1',
    id: 'placement-group-cccc-cccc-cccc-cccccccccccc',
    strategy: PLACEMENT_STRATEGY[0],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group2',
    id: 'placement-group-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    strategy: PLACEMENT_STRATEGY[1],
    regionID: 'us-east',
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group3',
    id: 'placement-group-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    strategy: PLACEMENT_STRATEGY[1],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group4',
    id: 'placement-group-dddd-dddd-dddd-dddddddddddd',
    strategy: PLACEMENT_STRATEGY[1],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group-delete',
    id: 'placement-group-mock-delete',
    strategy: PLACEMENT_STRATEGY[1],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-placement-group6',
    id: 'placement-group-ffff-ffff-ffff-ffffffffffff',
    strategy: PLACEMENT_STRATEGY[1],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });
  addPlacementGroup(placementGroups, {
    name: 'vsi-delete-placement-group',
    id: 'placement-group-delete-mock',
    strategy: PLACEMENT_STRATEGY[1],
    lifecycle_state: _common.LIFECYCLE_STATE.STABLE,
    regionID: 'us-east'
  });

  // Generate PlacementGroup for each supported region
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    addPlacementGroup(placementGroups, {
      name: "placement-group-region-".concat(region.name),
      regionID: region.name
    }, true);
  });
};
exports.init = init;
var formatPlacementGroupForClient = function formatPlacementGroupForClient(placementGroup, req) {
  var href = "".concat(utils.getBaseApiUrl(req), "placement_groups/").concat(placementGroup.id);
  return _objectSpread({
    href: href
  }, placementGroup);
};
var createPlacementGroup = function createPlacementGroup(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.placement_groups), input, req, res, 'Instance PlacementGroup is already existed', 'PlacementGroup')) {
    return;
  }
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  input.created_at = utils.generateNowDate();
  var id = addPlacementGroup(_server.db.getCollection(_server.COLS.placement_groups), input);
  var newPlacementGroup = utils.findResource(_server.COLS.placement_groups, id, res, true);
  newPlacementGroup.href = "".concat(utils.getBaseUrl(req), "/").concat(newPlacementGroup.id);
  res.status(201).json(formatPlacementGroupForClient(newPlacementGroup, req)).end();
};
exports.createPlacementGroup = createPlacementGroup;
var deletePlacementGroup = function deletePlacementGroup(req, res) {
  var placementGroup = _server.db.getCollection(_server.COLS.placement_groups).find({
    id: req.params.placement_group_id
  });
  if (!placementGroup || placementGroup.length === 0) {
    res.status(404).end();
    return;
  }
  var VSIs = _server.db.getCollection(_server.COLS.instances).chain().find().where(function (obj) {
    var _obj$placement_target;
    return ((_obj$placement_target = obj.placement_target) === null || _obj$placement_target === void 0 ? void 0 : _obj$placement_target.id) === req.params.placement_group_id;
  }).data({
    removeMeta: true
  });
  if ((VSIs === null || VSIs === void 0 ? void 0 : VSIs.length) > 0) {
    res.status(409).json((0, utils.generateErrors)('placement group has 1 or more instances', 409, 'placement_group_in_use')).end();
    return;
  }
  _server.db.getCollection(_server.COLS.placement_groups).findAndRemove({
    id: req.params.placement_group_id
  });
  res.status(204).end();
};
exports.deletePlacementGroup = deletePlacementGroup;
var updatePlacementGroup = function updatePlacementGroup(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.placement_groups), input, req, res, 'placement group is already existed', 'PlacementGroup')) {
    return;
  }

  // params is set by app.patch(`${ROOT_CONTEXT_V1}placement_groups/:placement_group_id`, placement_groups.updatePlacementGroup);
  var placementGroup = _server.db.getCollection(_server.COLS.placement_groups).find({
    id: req.params.placement_group_id
  });
  if (!placementGroup || placementGroup.length === 0) {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.placement_groups).findAndUpdate({
    id: req.params.placement_group_id
  }, function (k) {
    k.name = input.name;
  });
  var updatedPlacementGroup = _server.db.getCollection(_server.COLS.placement_groups).chain().find({
    id: req.params.placement_group_id
  }).data({
    removeMeta: true
  });
  updatedPlacementGroup[0].href = "".concat(utils.getBaseApiUrl(req), "/placement_groups/").concat(req.params.placementGroup_id);
  res.status(200).json(formatPlacementGroupForClient(updatedPlacementGroup[0], req)).end();
};
exports.updatePlacementGroup = updatePlacementGroup;
var getPlacementGroups = function getPlacementGroups(req, res) {
  var placementGroups = utils.getResources(req, _server.COLS.placement_groups);
  placementGroups.placement_groups.forEach(function (group) {
    formatPlacementGroupForClient(group, req, res);
  });
  res.json(placementGroups).end();
};
exports.getPlacementGroups = getPlacementGroups;
var getPlacementGroup = function getPlacementGroup(req, res) {
  var PlacementGroup = _server.db.getCollection(_server.COLS.placement_groups).chain().find({
    id: req.params.placement_group_id
  }).data({
    removeMeta: true
  });
  if (PlacementGroup.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(formatPlacementGroupForClient(PlacementGroup[0], req)).end();
};
exports.getPlacementGroup = getPlacementGroup;