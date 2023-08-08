"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SnapshotClone = void 0;
exports.createSnapshotClone = createSnapshotClone;
exports.deleteSnapshotClone = void 0;
exports.formateSnapshotCloneForClient = formateSnapshotCloneForClient;
exports.getSnapshotClones = exports.getSnapshotClone = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _regions = require("./regions");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
/**
 * SnapshotClone()
 *
 * @param {*} data - data to be used for snapshot creation
 */
var SnapshotClone = function SnapshotClone() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  if (data.href) {
    var splittedHref = data.href.split('/');
    data.zone_name = splittedHref[splittedHref.length - 1];
    utils.findZone(data.zone_name);
  }
  if (!data.href && !data.zone_name) {
    data.zone_name = utils.getDefaultZone();
  }
  var newSnapshotClone = {
    id: _casual["default"].uuid,
    zone_name: data.zone_name,
    available: _casual["default"]["boolean"],
    created_at: utils.generateCreateDate()
  };
  return newSnapshotClone;
};
exports.SnapshotClone = SnapshotClone;
function formateSnapshotCloneForClient(req, snapshotClone) {
  var zone = (0, _regions.formatZoneForClient)(req, {
    name: snapshotClone.zone_name
  });
  var displayedSC = {
    available: snapshotClone.available,
    created_at: snapshotClone.created_at,
    zone: {
      name: zone.name,
      href: zone.href
    }
  };
  return displayedSC;
}

/**
 * getSnapshotClones() - gets a paginated list of snapshots
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
var getSnapshotClones = function getSnapshotClones(req, res) {
  var snapshot = utils.findResource(_server.COLS.snapshots, req.params.snapshot_id, res, true);
  if (!snapshot) {
    return;
  }
  // return the snapshot clone
  res.json({
    clones: snapshot.clones.map(function (clone) {
      return formateSnapshotCloneForClient(req, clone);
    })
  }).end();
};
/**
 * getSnapshotClones() - gets a paginated list of snapshots
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshotClones = getSnapshotClones;
var getSnapshotClone = function getSnapshotClone(req, res) {
  var snapshot = utils.findResource(_server.COLS.snapshots, req.params.snapshot_id, res, true);
  if (!snapshot) {
    return;
  }
  var snapshotClone = snapshot.clones.filter(function (clone) {
    return clone.zone_name === req.params.zone_name;
  });
  if (snapshotClone.length === 0) {
    res.status(404).end();
    return;
  }

  // return the snapshot clone
  res.json(formateSnapshotCloneForClient(req, snapshotClone[0])).end();
};

/**
 * createSnapshotClone() - creates a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getSnapshotClone = getSnapshotClone;
function createSnapshotClone(req, res) {
  var snapshot = utils.findResource(_server.COLS.snapshots, req.params.snapshot_id, res, false);
  if (!snapshot) {
    return;
  }
  var snapshotClone = _lodash["default"].find(snapshot.clones, {
    zone_name: req.params.zone_name
  });
  if (snapshotClone) {
    res.status(200).json(formateSnapshotCloneForClient(req, snapshotClone)).end();
    return;
  }
  // add the zonal snapshot clone
  snapshotClone = SnapshotClone({
    zone_name: req.params.zone_name
  });
  snapshot.clones.push(snapshotClone);
  _server.db.getCollection(_server.COLS.snapshots).update(snapshot);
  res.status(201).json(formateSnapshotCloneForClient(req, snapshotClone)).end();
}

/**
 * deleteSnapshotClone() - deletes a snapshot
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
var deleteSnapshotClone = function deleteSnapshotClone(req, res) {
  var snapshot = utils.findResource(_server.COLS.snapshots, req.params.snapshot_id, res, false);
  if (!snapshot) {
    return;
  }
  var removed = _lodash["default"].remove(snapshot.clones, {
    zone_name: req.params.zone_name
  });
  if (removed.length === 0) {
    res.status(404).end();
  }
  _server.db.getCollection(_server.COLS.snapshots).update(snapshot);
  res.status(202).end();
};
exports.deleteSnapshotClone = deleteSnapshotClone;