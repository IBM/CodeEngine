"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getZonesForRegion = exports.getZones = exports.getZone = exports.getRegions = exports.getRegion = exports.formatZoneForClient = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var regionsData = require('./regions.json');
var init = function init() {
  var regions = _server.db.addCollection(_server.COLS.regions);
  regionsData.forEach(function (region) {
    regions.insert(Object.assign({}, region));
  });
};
exports.init = init;
var getRegionEndpoint = function getRegionEndpoint(req, region) {
  /*
   * This gets the protocol from the 'x-proxy-from' header, which basically
   * indicates where the client is on.
   */
  var protocol = (req.headers['x-proxy-from'] || req.protocol).split(':')[0];
  if (region.name === utils.DEFAULT_REGION) {
    return "".concat(protocol, "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT.substring(0, _server.ROOT_CONTEXT.length - 1));
  }
  return "".concat(protocol, "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT).concat(region.name);
};
var getZones = function getZones(req, res) {
  if (req.params.region_name !== utils.getQueryRegion(req)) {
    /*
     * Right now the real RIAS API is incapable of return zones for a different region.
     * We want to make sure that the mock RIAS does the same thing.
     */
    res.json({
      zones: []
    }).end();
    return;
  }
  var regions = _server.db.getCollection(_server.COLS.regions).chain().find({
    name: req.params.region_name
  }).data({
    removeMeta: true
  });
  if (regions.length === 0) {
    res.status(404).end();
    return;
  }
  regions[0].zones.forEach(function (zone) {
    zone.href = "".concat(utils.getBaseUrl(req), "/").concat(zone.name);
    zone.region = {
      name: "".concat(regions[0].name),
      href: "".concat(utils.getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT, "v1/regions/").concat(regions[0].name)
    };
  });
  utils.delayRegionTimeout(function () {
    res.json({
      zones: regions[0].zones
    }).end();
  }, utils.isRegionTimeoutForName(regions[0].name));
};

/**
 * formatRegionForClient()
 *
 * Format a region for output to the client.
 * @param {*} req - the original request
 * @param {*} region - the region to be formatted.
 */
exports.getZones = getZones;
var formatRegionForClient = function formatRegionForClient(req, region) {
  var r = Object.assign({
    endpoint: getRegionEndpoint(req, region),
    href: "".concat(utils.getBaseUrl(req), "/").concat(region.name)
  }, region);
  r.zones = region.zones.map(function (_ref) {
    var name = _ref.name,
      status = _ref.status;
    return {
      name: name,
      status: status
    };
  });
  return r;
};

/**
 * formatZoneForClient()
 *
 * Format a Zone for output to the client.
 * @param {*} req - the original request
 * @param {*} zone - the zone to be formatted.
 */
var formatZoneForClient = function formatZoneForClient(req, zone) {
  var name = zone.name,
    status = zone.status;
  var region = utils.findZone(name).region_name;
  return {
    name: name,
    status: status,
    href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(region, "/zones/").concat(zone.name),
    region: {
      name: region,
      href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(region)
    }
  };
};
exports.formatZoneForClient = formatZoneForClient;
var getRegions = function getRegions(req, res) {
  var coll = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  });
  utils.delayRegionTimeout(function () {
    res.json({
      regions: coll.map(formatRegionForClient.bind(null, req))
    }).end();
  }, utils.isRegionTimeoutForPath(req));
};
exports.getRegions = getRegions;
var getRegion = function getRegion(req, res) {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().find({
    name: req.params.region_name
  }).data({
    removeMeta: true
  });
  if (regions.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(Object.assign({
    href: "".concat(utils.getBaseUrl(req))
  }, formatRegionForClient(req, regions[0]))).end();
};
exports.getRegion = getRegion;
var getZone = function getZone(req, res) {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().find({
    name: req.params.region_name
  }).data({
    removeMeta: true
  });
  if (regions.length === 0) {
    res.status(404).end();
    return;
  }
  var zone = regions[0].zones.find(function (z) {
    return z.name === req.params.zone_name;
  });
  if (!zone) {
    res.status(404).end();
    return;
  }
  res.json(formatZoneForClient(req, zone)).end();
};
exports.getZone = getZone;
var getZonesForRegion = function getZonesForRegion(regionName) {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().find({
    name: regionName
  }).data({
    removeMeta: true
  });
  if (regions.length > 0) {
    return regions[0].zones.map(function (_ref2) {
      var name = _ref2.name;
      return name;
    });
  }
  return [];
};
exports.getZonesForRegion = getZonesForRegion;