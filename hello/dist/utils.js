"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.arrayOf = exports.DEFAULT_REGION = void 0;
exports.buildZoneReturnObject = buildZoneReturnObject;
exports.clearAllData = clearAllData;
exports.delayRegionTimeout = exports.delay = exports.defaultVolumeBandWdithRatio = void 0;
exports.duplicateNameCheck = duplicateNameCheck;
exports.fakeResponse = void 0;
exports.findRegion = findRegion;
exports.findResource = findResource;
exports.findResourceByCrn = findResourceByCrn;
exports.findZone = findZone;
exports.findZoneInRegion = findZoneInRegion;
exports.floatingIPRefCheck = floatingIPRefCheck;
exports.formatResourceLinkForClient = formatResourceLinkForClient;
exports.generalInfo = generalInfo;
exports.generateCRN = generateCRN;
exports.generateCreateDate = generateCreateDate;
exports.generateDeletedName = void 0;
exports.generateErrors = generateErrors;
exports.generateFutureDate = generateFutureDate;
exports.generateFutureTimestamp = generateFutureTimestamp;
exports.generateHostname = generateHostname;
exports.generateLaterDate = generateLaterDate;
exports.generateMacAddress = generateMacAddress;
exports.generateName = generateName;
exports.generateNotFoundError = generateNotFoundError;
exports.generateNowDate = generateNowDate;
exports.getAndFormatResourceLinkForClient = void 0;
exports.getBaseApiUrl = getBaseApiUrl;
exports.getBaseServerUrl = getBaseServerUrl;
exports.getBaseUrl = getBaseUrl;
exports.getConnectionsByPolicy = getConnectionsByPolicy;
exports.getCrnField = getCrnField;
exports.getInstanceAttachedVolumesBandwidth = exports.getDefaultZone = void 0;
exports.getQueryParam = getQueryParam;
exports.getQueryRegion = getQueryRegion;
exports.getRandomIpAddress = getRandomIpAddress;
exports.getRandomLifecycleState = void 0;
exports.getRandomRegion = getRandomRegion;
exports.getRandomResource = getRandomResource;
exports.getRandomResourceFromArray = getRandomResourceFromArray;
exports.getRandomResourceGroup = getRandomResourceGroup;
exports.getRandomResourceInRegion = getRandomResourceInRegion;
exports.getRandomResourceInZone = getRandomResourceInZone;
exports.getRandomTrustedProfileId = getRandomTrustedProfileId;
exports.getRandomUniqueResource = getRandomUniqueResource;
exports.getRandomZonalResourceInZone = getRandomZonalResourceInZone;
exports.getRandomZone = getRandomZone;
exports.getRandomZoneFromRestrictedRegions = void 0;
exports.getRandomZoneInRegion = getRandomZoneInRegion;
exports.getRequestProtocol = getRequestProtocol;
exports.getResource = getResource;
exports.getResourceReference = getResourceReference;
exports.getResources = getResources;
exports.getResourcesInZone = getResourcesInZone;
exports.getSecondDefaultZone = void 0;
exports.getVersionInfo = getVersionInfo;
exports.getVolumeBandWidthByIops = void 0;
exports.getZonalResourcesInZone = getZonalResourcesInZone;
exports.isRegionTimeoutForPath = exports.isRegionTimeoutForName = exports.isHyperwarpEnabled = void 0;
exports.isResourceInUse = isResourceInUse;
exports.isZoneTimeout = void 0;
exports.liveness = liveness;
exports.minBootVolumeBandwidth = void 0;
exports.objectRefCheck = objectRefCheck;
exports.regionRedirect = regionRedirect;
exports.releaseResourceID = releaseResourceID;
exports.repeat = repeat;
exports.reserveResourceID = reserveResourceID;
exports.resourceGroupCheck = resourceGroupCheck;
exports.updateEndpointGatewayIdInSecurityGroup = void 0;
exports.updateResourceCrnRegion = updateResourceCrnRegion;
exports.validIpV4CidrCheck = validIpV4CidrCheck;
exports.validZoneNameCheck = validZoneNameCheck;
exports.validationFailure = validationFailure;
exports.versionInfoToString = versionInfoToString;
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("./server");
var _versionInfo = _interopRequireDefault(require("./resources/version-info.json"));
var rgResources = _interopRequireWildcard(require("./external/resources/resourcegroup"));
var iamResources = _interopRequireWildcard(require("./external/resources/iam"));
var _common = require("./resources/common");
var _volumeProfiles = require("./resources/volumeProfiles");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// Dynamically update the version before anyone accesses it.
_versionInfo["default"].nodeVersion = process.version;
var marked = require('marked');
var fs = require('fs');
var casual = require('casual');
var dayjs = require('dayjs');
var nconf = require('nconf');
var app = require('./app');
var IPv4_CIDR = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}\/(3[0-2]|[12]?[0-9])$/;
var block_size_16 = 16;
var block_size_256 = 256;
/*
 * This is the default region for our server.  This region must be
 * one of the regions in the data from regions.js.
 */
var DEFAULT_REGION = 'us-east';
exports.DEFAULT_REGION = DEFAULT_REGION;
var getDefaultZone = function getDefaultZone() {
  return "".concat(DEFAULT_REGION, "-1");
};

// Need to create resources in another zone
exports.getDefaultZone = getDefaultZone;
var getSecondDefaultZone = function getSecondDefaultZone() {
  return "".concat(DEFAULT_REGION, "-2");
};
exports.getSecondDefaultZone = getSecondDefaultZone;
var defaultVolumeBandWdithRatio = 0.25;
/*
 * These resource groups are in the global catalog for the stage 02
 * user right now.
 */
exports.defaultVolumeBandWdithRatio = defaultVolumeBandWdithRatio;
var resourceGroups;
var trustedProfiles;

/*
 * Get the protocol to use based on the request.
 * This gets the protocol from the 'x-proxy-from' header, which basically
 * indicates where the client is on.
 */
function getRequestProtocol(req) {
  return (req.headers['x-proxy-from'] || req.protocol).split(':')[0];
}

/*
 * Get a random resource group ID.
 */
function getRandomResourceGroup() {
  if (!resourceGroups) {
    rgResources.init();
    resourceGroups = _server.db.getCollection(_server.COLS.resourceGroups).chain().data().map(function (rg) {
      return rg.id;
    });
  }
  return casual.random_element(resourceGroups);
}

/*
 * Get a random trusted profile ID.
 */
function getRandomTrustedProfileId() {
  if (!trustedProfiles) {
    iamResources.init();
    trustedProfiles = _server.db.getCollection(_server.COLS.trustedProfiles).chain().data().map(function (rg) {
      return rg.id;
    });
  }
  return casual.random_element(trustedProfiles);
}
function repeat(map, count) {
  return new Array(count).fill(0).map(map);
}
var zoneMap = {};
function initZoneMap() {
  if (Object.entries(zoneMap).length === 0) {
    var regions = _server.db.getCollection(_server.COLS.regions).chain().data();
    regions.forEach(function (region) {
      region.zones.forEach(function (zone) {
        zoneMap[zone.name] = region.name;
      });
    });
  }
}

/*
 * Finds the specified zone and returns an object containing the zone and region name
 */
function findZone(zoneName) {
  initZoneMap();
  var region = zoneMap[zoneName];
  if (region) {
    return {
      name: zoneName,
      region_name: region
    };
  }
  throw new Error("Unable to find region for zone name: ".concat(zoneName));
}
function zoneExists(zoneName) {
  initZoneMap();
  var region = zoneMap[zoneName];
  if (region) {
    return true;
  }
  return false;
}

/*
 * Find the region entry for the given region name.
 */
function findRegion(regionName) {
  return _server.db.getCollection(_server.COLS.regions).findOne({
    name: regionName
  });
}

/*
 * Returns the first zone in a given region.
 */
function findZoneInRegion(regionName) {
  return _objectSpread(_objectSpread({}, findRegion(regionName).zones[0]), {}, {
    region_name: regionName
  });
}

/**
 * getRandomZoneInRegion()
 *
 * Given a regionName find that region and return a random zone from
 * within that region.
 * @param {String} regionName - name of the region to select a zone from
 * @return {String} - zone from within the specified region
 */
function getRandomZoneInRegion(regionName) {
  var region = findRegion(regionName);
  return casual.random_element(region.zones) || getDefaultZone();
}

/*
 * Get a query parameter with a default value.
 */
function getQueryParam(params, name, defaultVal) {
  var val = params[name];
  if (val) {
    return val;
  }
  return defaultVal;
}

/*
 * Generate an errors object to return to the client.
 */
function generateErrors(message, code, target, targetType) {
  var errors = [{
    message: message,
    code: code
  }];
  if (target) {
    errors[0].target = {
      type: targetType || 'field',
      name: target
    };
  }
  return {
    errors: errors,
    trace: casual.uuid
  };
}

/*
 * Generate an error when a passed in resource isn't found.
 */
function generateNotFoundError(target, type) {
  return {
    errors: [{
      code: 'not_found',
      message: 'Please check whether the resource you are requesting exists.',
      more_info: 'https://cloud.ibm.com/docs/infrastructure/vpc/errors.html#not_found',
      target: {
        name: target,
        type: type
      }
    }]
  };
}

/*
 * Get the base URL for all requests.
 */
function getBaseApiUrl(req, passedRegion) {
  var _req$query;
  /*
   * This gets the region from the query parameters.  If it isn't there
   * then we assume this is a request for our default region.
   */
  var region = passedRegion || ((_req$query = req.query) === null || _req$query === void 0 ? void 0 : _req$query.region);
  if (region) {
    return "".concat(getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT).concat(region, "/v1/");
  }
  return "".concat(getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT, "v1/");
}

/*
 * Get the base URL for the current request.
 */
function getBaseUrl(req) {
  return "".concat(getRequestProtocol(req), "://").concat(req.get('host')).concat(req.path);
}

/**
 * getBaseServerUrl()
 *
 * Return the server base URL for the rias-mock server itself.
 * This is similar to the BaseApiUrl but without region or the '/v1'.
 *
 * Example: 'http://localhost:4000/rias-mock'
 *
 * @param {} req - The original request
 * @returns {String} - The rias-mock-server base URL
 */
function getBaseServerUrl(req) {
  return "".concat(getRequestProtocol(req), "://").concat(req.get('host'));
}

/**
 * findResource()
 *
 * Find a single resource by id of the specified type. If the resource does
 * not exist then the response is updated with a 404 error. If the resource
 * does exist it is returned.
 *
 * removeMeta = { true, false }
 * If we are doing a findResource for client output we may want to clear the
 * meta information. (use removeMeta=true)
 *
 * If we are doing a find resource for udpating DB info - we need to leave
 * the meta information intact. (use removeMeta=false)
 *
 * If unsure (use removeMeta=false).
 *
 * @param {*} type  - LokiJS collection type (COL.*)
 * @param {*} id - id (uuid) of the resource to be obtained
 * @param {*} res - response object for the oustanding request
 * @param {*} removeMeta - determines whether to remove the LokiJS meta info.
 */
function findResource(type, id, res, removeMeta) {
  var resource = _server.db.getCollection(type).chain().find({
    id: id
  }).data({
    removeMeta: removeMeta
  });
  if (resource.length === 0) {
    if (res) res.status(404).json(generateErrors("Resource not found with id ".concat(id), 'not_found', type)).end();
    console.log("Resource of type ".concat(type, " not found with id ").concat(id, " "));
    return undefined;
  }
  return resource[0];
}

/*
 * Find the resource of a given type using the CRN.
 */
function findResourceByCrn(type, crn) {
  var resourceCollection = _server.db.getCollection(type);
  var resource = resourceCollection.findOne({
    crn: crn
  });
  if (!resource) {
    console.error(generateErrors("Resource not found with crn ".concat(crn), 'not_found', type));
    return undefined;
  }
  return resource;
}

// When we have methods calling other methods, sometimes those methods try to
// send a response. But if we try to send a response twice, the rias mock server crashes
// so for nested methods that require a response object, send a fake one to avoid errors
var fakeResponse = {
  json: function json() {
    return {
      end: function end() {}
    };
  },
  status: function status() {
    return {
      end: function end() {},
      json: function json() {
        return {
          end: function end() {}
        };
      }
    };
  }
};

/*
 * Find the resource of a given type using the UUID.
 */
exports.fakeResponse = fakeResponse;
function getResource(type, uuid) {
  return _server.db.getCollection(type).find({
    id: uuid
  });
}
function getResourceReference(resource) {
  if (resource) {
    var resource_type = resource.resource_type,
      id = resource.id,
      name = resource.name,
      href = resource.href,
      crn = resource.crn;
    return {
      resource_type: resource_type,
      id: id,
      name: name,
      href: href,
      crn: crn
    };
  }
  return null;
}

/*
 * Returns a valid random IPv4 Address
 */
function getRandomIpAddress() {
  var useCidrBlock = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  var ipBeginning = "".concat(casual.integer(1, 254), ".") + "".concat(casual.integer(1, 254), ".") + "".concat(casual.integer(1, 254));
  var ipEnd = ".".concat(casual.integer(1, 254));
  var cidrEnd = '.0/24';
  return "".concat(ipBeginning).concat(useCidrBlock ? cidrEnd : ipEnd);
}
/*
 * Returns a random resource of the given type
 */
function getRandomResource(type) {
  var resources = _server.db.getCollection(type).chain().data({
    removeMeta: true
  });
  return resources[casual.integer(0, resources.length - 1)];
}

/**
 * getZonalResourcesInZone(type, zone)
 *
 * Returns the set of all zonal resources in a particular zone.
 *
 * @param {} type
 * @param {*} zone
 */
function getZonalResourcesInZone(type, zone) {
  return _server.db.getCollection(type).chain().where(function (resource) {
    return resource.zone && resource.zone.name && resource.zone.name === zone;
  }).data({
    removeMeta: true
  });
}

/**
 * getRandomZonalResourceInZone()
 *
 * Returns a random zonal resource that is in a particular zone.
 *
 * @param {} type
 * @param {*} zone
 */
function getRandomZonalResourceInZone(type, zone) {
  var resources = getZonalResourcesInZone(type, zone);
  return resources[casual.integer(0, resources.length - 1)];
}

/*
 * Returns all resources of the given type in zone
 */
function getResourcesInZone(type, region) {
  var removeMetaData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  return _server.db.getCollection(type).chain().where(function (resource) {
    if (resource.zone) {
      return findZone(resource.zone.name).region_name === region;
    }
    return true;
  }).data({
    removeMeta: removeMetaData
  });
}

/*
 * Returns a random resource of the given type in zone
 */
function getRandomResourceInZone(type, region) {
  var resources = getResourcesInZone(type, region);
  return resources[casual.integer(0, resources.length - 1)];
}

/*
 * Returns a random resource of the given type in region
 */
function getRandomResourceInRegion(type, region) {
  var resources = _server.db.getCollection(type).chain().find({
    region: region
  }).data({
    removeMeta: true
  });
  return resources[casual.integer(0, resources.length - 1)];
}
var usedIDs = [];
function isResourceInUse(id) {
  return usedIDs.includes(id);
}
function reserveResourceID(id) {
  if (!usedIDs.includes(id)) {
    usedIDs.push(id);
  }
}
function releaseResourceID(id) {
  if (usedIDs.includes(id)) {
    var index = usedIDs.indexOf(id);
    usedIDs.splice(index, 1);
  }
}
function clearUsedResources() {
  usedIDs.splice(0, usedIDs.length);
}
function getRandomResourceFromArray(resources) {
  var resource = resources[casual.integer(0, resources.length - 1)];
  return resource;
}

/*
 * Returns a random resource of the given type and makes sure that resource will
 * be returned once and only once until the server data is reset.
 */
function getRandomUniqueResource(type) {
  var resources = _server.db.getCollection(type).chain().where(function (resource) {
    return !isResourceInUse(resource.id);
  }).data({
    removeMeta: true
  });
  if (resources.length === 0) {
    throw new Error("There are no more resources available of type ".concat(type));
  }
  return getRandomResourceFromArray(resources);
}

/*
 * Get a random region
 */
function getRandomRegion() {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  });
  return regions[casual.integer(0, regions.length - 1)];
}

/*
 * Get a random available zone and return a specialized object with the zone name
 * and the name of the region it belongs to.
 */
function getRandomZone() {
  var region = getRandomRegion();
  return {
    name: region.zones[casual.integer(0, region.zones.length - 1)].name,
    region_name: region.name
  };
}

/*
 * Generate a random CRN.  We may have to do some work here to make this
 * more realistic.
 */
function generateCRN() {
  var fields = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var isZoneResource = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var crnModel = {
    prefix: 'crn',
    version: 'v1',
    cname: 'staging',
    ctype: 'public',
    'service-name': 'is',
    // For zone resource like subnet, should include zone id in crn
    // For example:
    // "crn:v1:staging:public:is:us-east-1:a/823bd195e9fd4f0db40ac2e1bffef3e0:5486be4a-5a3d-4d52-b546-c9f62be9b1e9::"
    region: isZoneResource ? fields.zone || getRandomZone().name : fields.region || getRandomZone().region_name,
    scope: 'a/823bd195e9fd4f0db40ac2e1bffef3e0',
    'service-instance': casual.uuid,
    'resource-type': '',
    resource: fields.id || ''
  };
  var crn = _objectSpread(_objectSpread({}, crnModel), fields);
  var crnFields = [crn.prefix, crn.version, crn.cname, crn.ctype, crn['service-name'], crn.region, crn.scope, crn['service-instance'], crn['resource-type'], crn.resource];
  return crnFields.join(':');
}
function updateCRN(crn, fields) {
  var crnArray = crn.split(':');
  var crnModel = {
    prefix: crnArray[0],
    version: crnArray[1],
    cname: crnArray[2],
    ctype: crnArray[3],
    'service-name': crnArray[4],
    region: crnArray[5],
    scope: crnArray[6],
    'service-instance': crnArray[7],
    'resource-type': crnArray[8],
    resource: crnArray[9]
  };
  Object.keys(fields).forEach(function (oneKey) {
    crnModel[oneKey] = fields[oneKey];
  });
  return Object.values(crnModel).join(':');
}
function updateResourceCrnRegion(resource, req) {
  var _req$query2, _resource$zone;
  var region = (_req$query2 = req.query) === null || _req$query2 === void 0 ? void 0 : _req$query2.region;
  var crn = resource === null || resource === void 0 ? void 0 : resource.crn;
  var zone = resource === null || resource === void 0 ? void 0 : (_resource$zone = resource.zone) === null || _resource$zone === void 0 ? void 0 : _resource$zone.name;
  if (zone && crn) {
    // For zone resource like subnet, should include zone id in crn
    return updateCRN(crn, {
      region: zone
    });
  }
  if (region && crn) {
    return updateCRN(crn, {
      region: region
    });
  }
  return crn;
}
function getCrnField(crn, field) {
  var crnArray = crn.split(':');
  var crnModel = {
    prefix: crnArray[0],
    version: crnArray[1],
    cname: crnArray[2],
    ctype: crnArray[3],
    'service-name': crnArray[4],
    region: crnArray[5],
    scope: crnArray[6],
    'service-instance': crnArray[7],
    'resource-type': crnArray[8],
    resource: crnArray[9]
  };
  return crnModel[field];
}

/**
 * formatResourceLinkForClient()
 *
 * Given a resource, returns a new object with just the fields filled in
 * for a simple RIAS entity link reference. These are references that provide
 * just {id, crn, name, href, resource_type} when one RIAS object references
 * another one.
 *
 * RiasEntity: {
 *   ...
 *   riasSubEntity: { id, crn, name, href, resource_type }
 *   ...
 * }
 *
 * The resource is usually an object that was already retreived from the LokiJS
 * database.
 *
 * NOTE: If the entity does not contain an associated reference link field
 *       the value will not be provided to the client. To support this we
 *       we rely on eventual JSON.stringification of the result to
 *       automatically filter undfined fields.
 *
 * Use this when you already have the resource item or your search is more
 * more complex than the one provided in getAndFormatResourceLinkForClient().
 *
 * @param {*} req - the original request
 * @param {*} type - LokiJS collection type (COL.*)
 * @param {*} resource - should have {id, name, crn, resource_type}
 */
function formatResourceLinkForClient(req, type, resource) {
  if (!resource) return null;
  var href = "".concat(getBaseApiUrl(req)).concat(type, "/").concat(resource.id);
  var crn = updateResourceCrnRegion(resource, req);
  var id = resource.id,
    name = resource.name,
    resource_type = resource.resource_type;
  return {
    id: id,
    crn: crn,
    name: name,
    href: href,
    resource_type: resource_type
  };
}

/**
 * getAndFormatResourceLinkForClient()
 *
 * Given a resource type and resource id, returns a new object with just the
 * fields filled in for a simple RIAS entity link reference. These are
 * references that provide just {id, crn, name, href} when one RIAS object
 * links to another one.
 *
 * RiasEntity: {
 *   ...
 *   riasSubEntity: { id, crn, name, href }
 *   ...
 * }
 *
 * @param {*} req - the original request
 * @param {*} type - LokiJS collection type (COL.*)
 * @param {*} id - id value for the resource we want
 */
var getAndFormatResourceLinkForClient = function getAndFormatResourceLinkForClient(req, type, id) {
  var target = _server.db.getCollection(type).findOne({
    id: id
  });
  return formatResourceLinkForClient(req, type, target);
};

/**
 * getQueryRegion()
 *
 * Every request either has an explicit or implicit region. This function
 * returns that region.
 *
 * Examples:
 *   /rias-mock/us-south/v1/instances <-- 'us-south'
 *   /rias-mock/v1/intances <-- DEFAULT_REGION
 *
 * @param {*} req - original request
 */
exports.getAndFormatResourceLinkForClient = getAndFormatResourceLinkForClient;
function getQueryRegion(req) {
  return _lodash["default"].get(req, 'query.region', DEFAULT_REGION);
}

/**
 * getResource()
 *
 * Gets a specified list of resources.
 * - Provides results in RIAS list format. { OBJ_TYPE_NAME: [ obj1, obj2 ...]}
 * - Handles paging and inserts paging parameters into result object.
 * - Filters based on region for regional queries.
 *
 * @param {*} req - the original request
 * @param {*} type - LokiJS collection type (COL.*)
 * @param {function} extraFilter - An optional filter function to supplement the where clause
 * @param {string} sortField - the column to sort by.  Default "name".
 * @param {*} sortOptions - An optional config for sorting the list.
 */
// eslint-disable-next-line default-param-last
function getResources(req, type, extraFilter) {
  var _this = this;
  var sortField = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'name';
  var sortOptions = arguments.length > 4 ? arguments[4] : undefined;
  var DEFAULT_LIMIT = 10;
  var DEFAULT_OFFSET = 0;

  // UI-4375 - fixes an issue with the initial pagination 'next'
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
      href: "".concat(this.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(this.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };

  /*
   * This gets the region from the query parameters.  If it isn't there
   * then we assume this is a request for our default region.
   */
  var region = getQueryRegion(req);
  var vpcID = req.query['vpc.id'];
  var mode = req.query.mode;
  var next_hop = req.query.next_hop;
  var name = req.query.name;
  var filterFunc = function filterFunc(resource) {
    // We assume that resource should match all query parameters from request.
    var match = true;

    // Check if it's matching the region query parameter if resource.zone or resource.region exists.
    if (match && resource.zone) {
      match = findZone(resource.zone.name).region_name === region;
    } else if (match && resource.region) {
      // for resource that only have region info, but no zone
      match = region === resource.region;
    }

    // Check if it's matching the vpcID query parameter.
    if (match && vpcID) {
      match = resource.vpc ? resource.vpc.id === vpcID : match;
    }
    // Check if it's matching the next_hop query parameter.
    if (match && next_hop) {
      match = _lodash["default"].get(resource, 'next_hop.connection.id') === next_hop;
    }

    // Check if it's matching the mode query parameter
    if (match && mode) {
      match = resource.mode === mode;
    }
    if (match && name) {
      match = resource.name === name;
    }
    if (match && extraFilter && !extraFilter(resource)) {
      /*
       * If we have a match then we run it through the extra filter
       * to see if we should reject it.
       */
      return false;
    }
    return match;
  };
  resources[type] = _server.db.getCollection(type).chain().where(filterFunc).simplesort(sortField, sortOptions).offset(offset).limit(limit).data({
    removeMeta: true
  });

  // Get our total resource count
  var totalCount = _server.db.getCollection(type).where(filterFunc).length;
  resources.total_count = totalCount;
  if (next >= totalCount) {
    delete resources.next;
  }

  // Think this should this be handled in each resources formatForClient?
  resources[type].forEach(function (resource) {
    resource.href = "".concat(_this.getBaseUrl(req), "/").concat(type, "/").concat(resource.id);
  });
  return resources;
}
function generateCreateDate() {
  return dayjs().add(casual.integer(-100, 0), 'days').toISOString();
}
function generateLaterDate() {
  var initialDate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : dayjs();
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
    min: 1,
    max: 48,
    type: 'hours'
  };
  var min = options.min,
    max = options.max,
    type = options.type;
  return dayjs(initialDate).add(casual.integer(min, max), type).toISOString();
}

/*
 * Generate a creation date for right now with the ISO format
 */
function generateNowDate() {
  return dayjs().toISOString();
}
function generateFutureDate() {
  return dayjs().add(casual.integer(1, 100), 'days').toISOString();
}

/*
 * Generate random hostname
 */
function generateHostname() {
  return casual.domain;
}

/**
 * generateFutureTimestamp()
 * Generate a date in future - with the ISO format
 * For More Details, See https://day.js.org/docs/en/manipulate/add
 * @export
 * @param {*} value - Number - 5, 10 etc
 * @param {*} unit - String - minutes, hours, days etc
 * @returns
 */
function generateFutureTimestamp(value, unit) {
  return dayjs().add(value, unit).toISOString();
}

/**
 * generateName()
 *
 * Generate a random name with a given prefix and region from a supplied zone
 * object. A region name will be provided even if our zone object is incomplete
 * and only contains a `zone.name`. If no valid region name can be provided we
 * simply do not include the region in the generated name.
 *
 * TODO: We should probably have 2 versions of generate name. One that takes a
 *       a zone and requires it and another that does not use a zone. This way
 *       we will avoid resources not having zones when they are expected to
 *       have them. Also, should we be putting the zone on the name rather
 *       than the region?
 *
 * @param {string} prefix - prefix to use for the name.
 */
// eslint-disable-next-line default-param-last
function generateName() {
  var prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var zone = arguments.length > 1 ? arguments[1] : undefined;
  var region_name = zone && (zone.region_name || zone.name && findZone(zone.name).region_name);
  return "".concat(prefix, "-").concat(casual.word, "-").concat(casual.integer(0, 10000)).concat(region_name ? "-".concat(region_name) : '');
}
/**
 * duplicateNameCheck()
 *
 * Checks for a valid name parameter if none was provided returns a response
 * with 400 error. If a valid name was provided then the appropriate
 * collection is searched for a duplicate name. If a duplicate is found
 * the response object returns with a 400 error the provided message
 * and error field.
 *
 * If a valid name is provided and no duplicates were found this function
 * returns false. If any problems are detected true is returned and the
 * response object is updated with an error status.
 *
 * @param {*} type - LokiJS collection type (COL.*)
 * @param {*} input - request input object with a name attribute
 * @param {*} res - response object
 * @param {*} message - error message
 * @param {*} fieldName - error field name
 */
function duplicateNameCheck(type, input, req, res, message, fieldName, isNotRequired) {
  var _input$vpc;
  if (!input.name && !isNotRequired) {
    res.status(400).json(generateErrors('Valid name must be provided', 'invalid name', 'name')).end();
    return true;
  }
  switch (fieldName) {
    case 'securityGroup':
    case 'subnet':
    case 'public_gateway':
    case 'network_acl':
    case 'endpoint_gateway':
    case 'virtual_network_interfaces':
      if ((_input$vpc = input.vpc) !== null && _input$vpc !== void 0 && _input$vpc.id && type.chain().data().filter(function (r) {
        var _r$vpc, _input$vpc2;
        return ((_r$vpc = r.vpc) === null || _r$vpc === void 0 ? void 0 : _r$vpc.id) === ((_input$vpc2 = input.vpc) === null || _input$vpc2 === void 0 ? void 0 : _input$vpc2.id);
      }).filter(function (r) {
        return r.name === input.name;
      }).length > 0) {
        res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
        return true;
      }
      return false;
    case 'vpn_gateway':
    case 'load_balancer':
      {
        var _input$subnet, _input$subnets$, _db$getCollection$fin, _db$getCollection$fin2;
        var inputSubnetId = fieldName === 'vpn_gateway' ? (_input$subnet = input.subnet) === null || _input$subnet === void 0 ? void 0 : _input$subnet.id : input.subnets && ((_input$subnets$ = input.subnets[0]) === null || _input$subnets$ === void 0 ? void 0 : _input$subnets$.id);
        var inputVpcId = inputSubnetId && ((_db$getCollection$fin = _server.db.getCollection(_server.COLS.subnets).findOne({
          id: inputSubnetId
        })) === null || _db$getCollection$fin === void 0 ? void 0 : (_db$getCollection$fin2 = _db$getCollection$fin.vpc) === null || _db$getCollection$fin2 === void 0 ? void 0 : _db$getCollection$fin2.id);
        var resourcesWithVpc = type.chain().data().map(function (r) {
          var _r$subnet, _r$subnets$, _db$getCollection$fin3;
          var resouceSubnetId = fieldName === 'vpn_gateway' ? (_r$subnet = r.subnet) === null || _r$subnet === void 0 ? void 0 : _r$subnet.id : (_r$subnets$ = r.subnets[0]) === null || _r$subnets$ === void 0 ? void 0 : _r$subnets$.id;
          var vpc = (_db$getCollection$fin3 = _server.db.getCollection(_server.COLS.subnets).findOne({
            id: resouceSubnetId
          })) === null || _db$getCollection$fin3 === void 0 ? void 0 : _db$getCollection$fin3.vpc;
          return _objectSpread(_objectSpread({}, r), {}, {
            vpc: vpc
          });
        });
        if (inputVpcId && resourcesWithVpc.filter(function (r) {
          var _r$vpc2;
          return ((_r$vpc2 = r.vpc) === null || _r$vpc2 === void 0 ? void 0 : _r$vpc2.id) === inputVpcId;
        }).filter(function (r) {
          return r.name === input.name;
        }).length > 0) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
    case 'routing_table':
      {
        var _inputVpcId = req.params.vpc_id;
        var _resourcesWithVpc = type.chain().data().filter(function (r) {
          return r.vpcId === _inputVpcId;
        });
        if (_inputVpcId && _resourcesWithVpc.filter(function (r) {
          return r.name === input.name;
        }).length > 0) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
    case 'reserve_ip':
      {
        var _inputSubnetId = req.params.subnet_id;
        var resourcesWithSubnet = type.chain().data().filter(function (r) {
          return r.subnetId === _inputSubnetId;
        });
        if (_inputSubnetId && resourcesWithSubnet.filter(function (r) {
          return r.name === input.name;
        }).length > 0) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
    case 'vpn_connection':
      {
        var inputVpnGatewayId = req.params.vpn_gateway_id;
        var resourcesInVpnGateway = type.chain().data().filter(function (r) {
          return r._vpn_gateway_id === inputVpnGatewayId;
        });
        if (inputVpnGatewayId && resourcesInVpnGateway.filter(function (r) {
          return r.name === input.name;
        }).length > 0) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
    case 'backup_policies':
      {
        var region = getQueryRegion(req);
        var resources = type.chain().data();
        var found = resources.find(function (item) {
          return item.name === input.name && item.region === region;
        });
        if (found) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
    default:
      {
        var _region = getQueryRegion(req);
        var resourcesInRegion = type.chain().data().filter(function (r) {
          var _r$zone, _r$zone2, _resourceZone;
          var resourceZone;
          if (r !== null && r !== void 0 && (_r$zone = r.zone) !== null && _r$zone !== void 0 && _r$zone.name || r !== null && r !== void 0 && (_r$zone2 = r.zone) !== null && _r$zone2 !== void 0 && _r$zone2.id) {
            resourceZone = findZone(r.zone.name || r.zone.id);
          }
          return (((_resourceZone = resourceZone) === null || _resourceZone === void 0 ? void 0 : _resourceZone.region_name) || r.region || r.regionName) === _region;
        });
        if ((resourcesInRegion || []).filter(function (r) {
          return r.name === input.name;
        }).length > 0) {
          res.status(400).json(generateErrors(message, 'conflict_field', fieldName)).end();
          return true;
        }
        return false;
      }
  }
}

/*
 * Check for an exiting resource group and generate an error for the client if it
 * doesn't exist
 */
function resourceGroupCheck(input, res) {
  if (!input.resource_group) {
    return false;
  }
  var resourceGroup = _server.db.getCollection(_server.COLS.resourceGroups).chain().data().find(function (rg) {
    return rg.id === input.resource_group.id;
  });
  if (!resourceGroup) {
    res.status(400).json(generateErrors('The specified resource group was invalid', 'conflict_field', 'resource_group')).end();
    return true;
  }
  return false;
}

/*
 * Return a generic error for when the JSON data is invalid.
 */
function validationFailure(res) {
  res.status(400).json({
    errors: [{
      code: 'validation_failure',
      message: 'The JSON provided did not match the expected structure.',
      more_info: 'https://console.cloud.ibm.com/docs/infrastructure/vpc/errors.html#validation_failure',
      target: {
        name: '',
        type: ''
      }
    }],
    trace: 'db6009945df22447a035c1dca6fa204c'
  }).end();
}
function validZoneNameCheck(zone, req, res) {
  if (!zone || !zoneExists(zone.name)) {
    /*
     * This means the zone was just bogus.
     */
    res.status(400).json(generateErrors('zone not found', 'not_found', 'zone')).end();
    return true;
  }
  if (getQueryRegion(req) !== findZone(zone.name).region_name) {
    /*
     * This means the zone exists, but didn't match the region.
     * Using actual error obtained from POST /volume with invalid zone.
     */
    res.status(400).json(generateErrors('Please check whether the resources you are requesting are in the same zone.', 'invalid_zone')).end();
    return true;
  }
  return false;
}
function validIpV4CidrCheck(cidr, req, res) {
  var fieldName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'CIDR';
  if (!cidr || !(typeof cidr === 'string') || !IPv4_CIDR.test(cidr)) {
    res.status(400).json(generateErrors('Invalid CIDR form', 'invalid', fieldName)).end();
    return true;
  }
  return false;
}

/*
 * This function checks if the object of the specified type with the specified UUID
 * exists and it not it formats and sends an error response.
 */
function objectRefCheck(type, uuid, res) {
  var resource = getResource(type, uuid);
  if (resource.length > 0) {
    return false;
  }
  var errors = {
    errors: [{
      message: 'Please check whether the resource you are requesting exists.',
      code: 'not_found',
      target: {
        type: type,
        name: uuid
      },
      more_info: 'https://console.bluemix.net/docs/infrastructure/vpc/errors.html#not_found'
    }]
  };
  res.status(400).json(errors).end();
  return true;
}

/*
 * This function checks if the floating IP with the specified address
 * exists and it not it formats and sends an error response.
 */
function floatingIPRefCheck(address, res) {
  var fip = _server.db.getCollection(_server.COLS.floating_ips).find({
    address: address
  });
  if (fip.length > 0) {
    return false;
  }
  var errors = {
    errors: [{
      message: 'Please check whether the resource you are requesting exists.',
      code: 'not_found',
      target: {
        type: 'floating_ips',
        name: address
      },
      more_info: 'https://console.bluemix.net/docs/infrastructure/vpc/errors.html#not_found'
    }]
  };
  res.status(400).json(errors).end();
  return true;
}

/*
 * This function returns the VPN connections using the given VPN policy
 */
function getConnectionsByPolicy(id, type) {
  var connections = _server.db.getCollection(_server.COLS.connections).where(function (connection) {
    return _lodash["default"].get(connection, "".concat(type, ".id")) === id;
  });
  var connectionRefs = connections.map(function (connection) {
    return {
      name: _lodash["default"].get(connection, 'name', '')
    };
  });
  return connectionRefs;
}

/*
 * This is a custom endpoint.  It finds every collection we've loaded and then
 * removes and then calls init again to reload the starting data.
 */
function clearAllData(req, res) {
  Object.entries(_server.COLS).forEach(function (col) {
    _server.db.removeCollection(col[1]);
  });
  clearUsedResources();
  (0, _server.init)();
  res.status(204).end();
}

/*
 * This is a custom endpoint. It returns the version info for the current
 * Rias Mock app.
 */
function getVersionInfo(req, res) {
  res.json(_versionInfo["default"]).end();
}
function versionInfoToString() {
  var propMap = {
    projectName: 'Project',
    projectVersion: 'Version',
    buildLabel: 'Build Label',
    buildStartTime: 'Build Time',
    gitBranch: 'GIT Branch',
    gitRevision: 'GIT Revision',
    gitLastCommitTime: 'GIT Date',
    gitTag: 'GIT Tag',
    nodeVersion: 'Node.js'
  };
  var ret = [];
  ret.push('-'.repeat(56));
  Object.keys(_versionInfo["default"]).forEach(function (prop) {
    if (_versionInfo["default"][prop]) ret.push("".concat((propMap[prop] || prop).padEnd(12), " : ").concat(_versionInfo["default"][prop]));
  });
  ret.push('-'.repeat(56));
  return ret.join('\n');
}

/*
 * Returns the href for the zone represented by a specialized zone object from the
 * findRandomZone function.
 */
function buildZoneReturnObject(req, zone) {
  return {
    href: "".concat(getBaseApiUrl(req), "regions/").concat(zone.region_name, "/zones/").concat(zone.name),
    name: zone.name
  };
}
function getApiForRoute(route, parentPath) {
  var pathPrefix = parentPath || '';
  var api = {
    path: "".concat(pathPrefix).concat(route.route.path),
    method: route.route.stack[0].method
  };
  var paths = api.path.split('/');
  if (paths[2] === ':region') {
    paths.splice(2, 1);
    api.path = paths.join('/');
  }
  if (api.method === 'get' && api.path.indexOf(':') === -1) {
    api.text = "| ".concat(api.method.toUpperCase(), " | [").concat(api.path, "](").concat(api.path, ") |");
  } else {
    api.text = "| ".concat(api.method.toUpperCase(), " | ").concat(api.path, " |");
  }
  return api;
}
function getRouterPath(router) {
  var paths = router.regexp.source.replace(/\\/g, '').replace('^', '').split('/');
  if (paths.length > 2) {
    paths.splice(paths.length - 2, 2);
  }
  if (paths[1] === 'rias-mock' && paths[2].startsWith('(')) {
    paths.splice(2, 2);
  }
  if (paths[3] === 'kp-mock' && paths[4].startsWith('(')) {
    // ignore this path
    return undefined;
  }
  return paths.join('/');
}
var apis = [];
function collectAPIs() {
  if (apis.length > 0) {
    return;
  }
  var handleRouter = function handleRouter(router, parentPath) {
    var prefixPath = parentPath || '';
    var subRouterPath = getRouterPath(router);
    if (!subRouterPath) {
      return;
    }
    var routerPath = "".concat(prefixPath).concat(subRouterPath);
    var nestedStacks = router.handle.stack;
    nestedStacks.forEach(function (nestedRoute) {
      if (nestedRoute.name === 'bound dispatch') {
        var api = getApiForRoute(nestedRoute, routerPath);
        apis.push(api);
      } else if (nestedRoute.name === 'router') {
        handleRouter(nestedRoute, routerPath);
      }
    });
  };
  app._router.stack.forEach(function (route) {
    if (route.route && route.route.path.startsWith(_server.ROOT_CONTEXT_V1)) {
      var api = getApiForRoute(route);
      apis.push(api);
    } else if (route.name === 'router') {
      handleRouter(route);
    }
  });
  apis.sort(function (a, b) {
    if (a.path < b.path) {
      return -1;
    }
    if (a.path > b.path) {
      return 1;
    }
    if (a.method < b.method) {
      return -1;
    }
    if (a.method > b.method) {
      return 1;
    }
    return 0;
  });
}
/*
 * This function gets all the routes in our express app that represent a RIAS API call,
 * sorts them, and formats them as a Markdown table.
 */
function getRoutes() {
  collectAPIs();
  var out = [];
  apis.forEach(function (api) {
    out.push(api.text);
  });
  return out.join('\n');
}
function getRouteCount() {
  collectAPIs();
  return apis.length;
}
var isRegionTimeoutMode = function isRegionTimeoutMode() {
  return nconf.get('regionTimeout') === 'true';
};
var isHyperwarpEnabled = function isHyperwarpEnabled() {
  return nconf.get('hyperwarp') === 'true';
};
exports.isHyperwarpEnabled = isHyperwarpEnabled;
var isRegionTimeoutForPath = function isRegionTimeoutForPath(req) {
  return isRegionTimeoutMode() && req.path.includes('eu-de');
};
exports.isRegionTimeoutForPath = isRegionTimeoutForPath;
var isRegionTimeoutForName = function isRegionTimeoutForName(name) {
  return isRegionTimeoutMode() && name === 'eu-de';
};
exports.isRegionTimeoutForName = isRegionTimeoutForName;
var isZoneTimeout = function isZoneTimeout(zone) {
  return isRegionTimeoutMode() && zone === 'eu-de-1';
};
exports.isZoneTimeout = isZoneTimeout;
var getTimeoutValue = function getTimeoutValue(isTimeout) {
  var timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 60000;
  return isTimeout ? timeout : 0;
};
var delay = function delay(f, timeout) {
  return setTimeout(f, timeout);
};
exports.delay = delay;
var delayRegionTimeout = function delayRegionTimeout(f, isTimeout) {
  return delay(f, getTimeoutValue(isTimeout));
};

/*
 * This is a specialized endpoint to get the information about the application.
 * It's the only endpoint that serves HTML and it serves from the root of the
 * application.  It renders the index.md file.
 */
exports.delayRegionTimeout = delayRegionTimeout;
function generalInfo(req, res) {
  /*
   * The index.md file has a special section that looks like this:
   *
   *        {{routes_list}}
   *
   * We replace that section with the list of routes.
   */
  var file = fs.readFileSync('public/index.md', 'utf8').replace('{{routes_list}}', getRoutes()).replace('{{routes_count}}', getRouteCount()).replace('{{version_info}}', versionInfoToString());
  var css = fs.readFileSync('node_modules/github-markdown-css/github-markdown-light.css', 'utf8');
  res.send("\n    <html>\n    <head>\n      <title>RIAS API Mock</title>\n      <style>".concat(css, "</style>\n      <style>\n        .markdown-body {\n          box-sizing: border-box;\n          min-width: 200px;\n          max-width: 980px;\n          margin: 0 auto;\n          padding: 45px;\n        }\n\n        @media (max-width: 767px) {\n          .markdown-body {\n            padding: 15px;\n          }\n        }\n      </style>\n    </head>\n    <body>\n    <article class=\"markdown-body\">\n      ").concat(marked.parse(file.toString()), "\n      </article>\n    </body>\n    </html>\n    ")).end();
}

/*
 * This function gives us support for multiple regions in the mock API.  Normally multiple
 * regions run on completely separate servers, but we don't want to do that for the mock API.
 * Instead we can handle multiple regions with a single server.
 *
 * We can handle regions with a specific path.  For example, instead of and URL like this:
 *
 *    http://localhost:4000/v1/subnets
 *
 * we can us an URL like this:
 *
 *    http://localhost:4000/jp-tok/v1/subnets
 *
 * This function will then take that URL and issue a redirect to an URL like this:
 *
 *    http://localhost:4000/v1/subnets?region=jp-tok
 *
 * The query parameter allows us to use all the default endpoints and then just look for the
 * query parameter when listing resources.
 */
function regionRedirect(req, res) {
  var region = req.path.split("".concat(_server.ROOT_CONTEXT))[1].split('/')[0];
  var query = [];
  query.push("region=".concat(region));
  delete req.query.region;
  Object.entries(req.query).forEach(function (key) {
    query.push("".concat(key[0], "=").concat(key[1]));
  });
  var path = req.path.substring(_server.ROOT_CONTEXT.length + region.length + 1);
  var url = "".concat(getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT).concat(path, "?").concat(query.join('&'));
  res.redirect(url);
}

/*
 * This function implements the liveness and readiness call from Bluemix.  Since our entire
 * application is in memory and we have no dependencies this always returns a 200.  The only
 * time this will fail is if we have problem deploying or a problem running node and in both
 * of those cases our code won't get called.
 */
function liveness(req, res) {
  res.status(200).end();
}
var macAddressChars = [].concat(_toConsumableArray(_toConsumableArray(Array(10).keys()).map(function (a) {
  return "".concat(a);
})), ['a', 'b', 'c', 'd', 'e', 'f']);
var macChar = function macChar() {
  return casual.random_element(macAddressChars);
};
var macTuple = function macTuple() {
  return "".concat(macChar()).concat(macChar());
};
function generateMacAddress() {
  return "".concat(macTuple(), ":").concat(macTuple(), ":").concat(macTuple(), ":").concat(macTuple(), ":").concat(macTuple(), ":").concat(macTuple());
}

/**
 *
 * @param {*} id - a resource ID
 *
 * This function will generate a "deleted" reference name based on an ID
 * See https://github.ibm.com/cloudlab/srb/tree/master/proposals/1434 for more details
 */
var generateDeletedName = function generateDeletedName(id) {
  var idParts = id.split('-');
  var lastIDPart = idParts[idParts.length - 1];
  var deletedName = "-deleted-".concat(lastIDPart);
  return deletedName;
};

/**
 *
 * We would like a particular region to be free of certain resources
 * This function provides a specialized way to do that.
 * Current region being excluced "jp-tok".
 */
exports.generateDeletedName = generateDeletedName;
var getRandomZoneFromRestrictedRegions = function getRandomZoneFromRestrictedRegions() {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().find({
    name: {
      $ne: 'jp-tok'
    }
  }).data({
    removeMeta: true
  });
  var region = regions[casual.integer(0, regions.length - 1)];
  var zone = {
    name: region.zones[casual.integer(0, region.zones.length - 1)].name,
    region_name: region.name || 'us-east'
  };
  return zone;
};
exports.getRandomZoneFromRestrictedRegions = getRandomZoneFromRestrictedRegions;
var getRandomLifecycleState = function getRandomLifecycleState() {
  return casual.random_element(Object.values(_common.LIFECYCLE_STATE));
};
exports.getRandomLifecycleState = getRandomLifecycleState;
var getVolumeBandWidthByIops = function getVolumeBandWidthByIops(iops, profileName) {
  return Math.floor(iops * (profileName === '10iops-tier' ? block_size_256 : block_size_16) * 1024 * 8 / 1000000);
};
exports.getVolumeBandWidthByIops = getVolumeBandWidthByIops;
var minBootVolumeBandwidth = 393;
exports.minBootVolumeBandwidth = minBootVolumeBandwidth;
var getInstanceAttachedVolumesBandwidth = function getInstanceAttachedVolumesBandwidth(volAttachments, totalVolumeBandwidth) {
  // calculated instance attached volumes bandwidth by iops and volume profile
  var volumesBandwidth = volAttachments.map(function (attachment) {
    var iops = (0, _volumeProfiles.getIOPSForProfile)(attachment.volume.capacity, attachment.volume.profile, attachment.volume.iops);
    return {
      id: attachment.id,
      isBootVolume: attachment.type === 'boot',
      bandwidth: getVolumeBandWidthByIops(iops, attachment.volume.profile.name)
    };
  });
  var sumVolumesBandwidth = volumesBandwidth.reduce(function (acc, curr) {
    return acc + curr.bandwidth;
  }, 0);
  // recalculated instance attached volumes bandwidth when sumVolumesBandwidth > totalVolumeBandwidth
  // individual volume bandwidth is weighted by its bandwidth,
  // the sum of  individual volum bandwidth is less than the instance's storage bandwidth.
  // min boot volume bandwidth is 393 Mbps
  if (totalVolumeBandwidth && sumVolumesBandwidth > totalVolumeBandwidth) {
    var bootVolumeBandwidth;
    volumesBandwidth = volumesBandwidth.map(function (item) {
      if (item.isBootVolume) {
        var bandwidth = Math.floor(item.bandwidth / sumVolumesBandwidth * totalVolumeBandwidth);
        bootVolumeBandwidth = Math.max(minBootVolumeBandwidth, bandwidth);
        return _objectSpread(_objectSpread({}, item), {}, {
          bandwidth: bootVolumeBandwidth
        });
      }
      return item;
    });
    var sumDataVolumesBandwidth = volumesBandwidth.reduce(function (acc, curr) {
      return acc + (curr.isBootVolume ? 0 : curr.bandwidth);
    }, 0);
    volumesBandwidth = volumesBandwidth.map(function (item) {
      if (!item.isBootVolume) {
        var bandwidth = Math.floor(item.bandwidth / sumDataVolumesBandwidth * (totalVolumeBandwidth - bootVolumeBandwidth));
        return _objectSpread(_objectSpread({}, item), {}, {
          bandwidth: bandwidth
        });
      }
      return item;
    });
  }
  return volumesBandwidth;
};
exports.getInstanceAttachedVolumesBandwidth = getInstanceAttachedVolumesBandwidth;
var updateEndpointGatewayIdInSecurityGroup = function updateEndpointGatewayIdInSecurityGroup(id, default_sg_id) {
  var securityGroup = findResource(_server.COLS.security_groups, default_sg_id);
  if (securityGroup.targets_peg) {
    securityGroup.targets_peg.push({
      id: id
    });
  } else {
    securityGroup.targets_peg = [{
      id: id
    }];
  }
  _server.db.getCollection(_server.COLS.security_groups).update(securityGroup);
};
exports.updateEndpointGatewayIdInSecurityGroup = updateEndpointGatewayIdInSecurityGroup;
var arrayOf = function arrayOf(generator, times) {
  var result = [];
  for (var i = 0; i < times; ++i) {
    result.push(generator());
  }
  return result;
};
exports.arrayOf = arrayOf;