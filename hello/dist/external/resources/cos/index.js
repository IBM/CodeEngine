"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.endpoints = exports.buckets = exports.bucketConfig = exports.bucket = void 0;
var _server = require("../../../server");
var utils = _interopRequireWildcard(require("../../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
var casual = require('casual');
var _ = require('lodash');
var xml = require('xml');
var endpointsTemplate = require('./endpoints.json');
var regions = [];
var resillencies = Object.keys(endpointsTemplate['service-endpoints']);
resillencies.forEach(function (resillency) {
  var subRegions = Object.keys(endpointsTemplate['service-endpoints'][resillency]);
  if (resillency === 'cross-region') {
    regions.push.apply(regions, _toConsumableArray(subRegions.map(function (subRegion) {
      return "".concat(subRegion, "-geo");
    })));
  } else {
    regions.push.apply(regions, subRegions);
  }
});
var resClasses = ['standard', 'vault', 'cold', 'flex'];
var addBucket = function addBucket(buckets, instance, location) {
  var data = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var bucket = {
    Name: "bucket-".concat(casual.uuid),
    CreationDate: new Date().toISOString(),
    Instance: instance.service_instance,
    LocationConstraint: "".concat(location.replace('-geo', ''), "-").concat(casual.random_element(resClasses))
  };
  buckets.insert(Object.assign(bucket, data));
  return bucket;
};
var addObject = function addObject(objects, instance, bucket) {
  var data = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var object = {
    Key: "object-".concat(casual.uuid),
    Size: casual.integer(1024 * 1024 * 1024, 100 * 1024 * 1024 * 1024),
    LastModified: new Date().toISOString(),
    Instance: instance.service_instance,
    Bucket: bucket.Name
  };
  objects.insert(Object.assign(object, data));
  return object;
};

/**
 * init()
 * Initialize ghost
 */
var init = function init() {
  var cosBuckets = _server.db.addCollection(_server.COLS.cosBuckets);
  var cosObjects = _server.db.addCollection(_server.COLS.cosObjects);
  var collection = _server.db.getCollection(_server.COLS.ghost);
  var cosInstances = collection.find({
    service_name: 'cloud-object-storage'
  });
  cosInstances.forEach(function (cosInstance) {
    regions.forEach(function (region) {
      utils.repeat(function () {
        var bucket = addBucket(cosBuckets, cosInstance, region);
        utils.repeat(function () {
          addObject(cosObjects, cosInstance, bucket);
        }, 20);
      }, 10);
    });
  });
};
exports.init = init;
var endpoints = function endpoints(req, res) {
  var serviceEndpoints = Object.values(endpointsTemplate['service-endpoints']);
  var endpoint = "".concat(utils.getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT, "external/cos-mock/buckets");
  serviceEndpoints.forEach(function (resillency) {
    var endpointsRes = Object.values(resillency);
    endpointsRes.forEach(function (location) {
      var endpointsLoc = Object.values(location);
      endpointsLoc.forEach(function (pubprivEndpoints) {
        Object.keys(pubprivEndpoints).forEach(function (loc) {
          pubprivEndpoints[loc] = endpoint;
        });
      });
    });
  });
  res.status(200).json(endpointsTemplate).end();
};
exports.endpoints = endpoints;
var buckets = function buckets(req, res) {
  var instanceId = req.headers['ibm-service-instance-id'];
  if (instanceId && instanceId.indexOf(':') !== -1) {
    instanceId = instanceId.split(':')[7];
  }
  var collection = _server.db.getCollection(_server.COLS.cosBuckets);
  var instanceBuckets = collection.chain().find({
    Instance: instanceId
  }).data({
    removeMeta: true
  });
  var displayBuckets = _.cloneDeep(instanceBuckets);
  displayBuckets.forEach(function (displayBucket) {
    return delete displayBucket.Instance;
  });
  var bucketsContent = {
    ListAllMyBucketsResult: [{
      Owner: [{
        ID: instanceId
      }, {
        DisplayName: instanceId
      }]
    }, {
      Buckets: displayBuckets.map(function (bucket) {
        return {
          Bucket: [{
            Name: bucket.Name
          }, {
            CreationDate: bucket.CreationDate
          }, {
            LocationConstraint: bucket.LocationConstraint
          }]
        };
      })
    }]
  };
  res.type('application/xml');
  var xmlStr = xml(bucketsContent, {
    declaration: true
  });
  res.status(200).send(xmlStr);
};
exports.buckets = buckets;
var bucket = function bucket(req, res) {
  var bucketName = req.params.bucket;
  if (Object.keys(req.query).includes('location')) {
    var collection = _server.db.getCollection(_server.COLS.cosBuckets);
    var bucketsResult = collection.chain().find({
      Name: bucketName
    }).data({
      removeMeta: true
    });
    if (bucketsResult.length > 0) {
      var locationConstraint = {
        LocationConstraint: [{
          _attr: {
            xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/'
          }
        }, bucketsResult[0].LocationConstraint]
      };
      return res.status(200).send(xml(locationConstraint, {
        declaration: true
      }));
    }
  } else {
    var _objectsContent$ListB;
    var maxKeys = req.query['max-keys'] && parseInt(req.query['max-keys'], 10) || 1000;
    var marker = req.query.marker;
    var prefix = req.query.prefix;
    var delimiter = req.query.delimiter;
    var objects = _server.db.getCollection(_server.COLS.cosObjects);
    var bucketObjects = objects.chain().where(function (cosObject) {
      if (cosObject.Bucket !== bucketName) {
        return false;
      }
      if (prefix) {
        return cosObject.Key.startsWith(prefix);
      }
      return true;
    }).simplesort('Key').data({
      removeMeta: true
    });
    var startIndex = 0;
    var isTruncated = false;
    if (marker) {
      startIndex = bucketObjects.findIndex(function (cosObject) {
        return cosObject.Key === marker;
      });
    }
    var remainObjectCounter = bucketObjects.length - startIndex;
    var nextMarker;
    var paginatedObject = [];
    if (startIndex === -1 || bucketObjects.length === 0) {
      isTruncated = false;
    } else if (remainObjectCounter <= maxKeys) {
      isTruncated = false;
      paginatedObject = bucketObjects.slice(startIndex);
    } else {
      isTruncated = true;
      paginatedObject = bucketObjects.slice(startIndex, startIndex + maxKeys);
      nextMarker = bucketObjects[startIndex + maxKeys].Key;
    }
    var objectsContent = {
      ListBucketResult: [{
        Name: bucketName
      }, {
        Prefix: prefix
      }, {
        Marker: marker
      }, {
        NextMarker: nextMarker
      }, {
        MaxKeys: maxKeys
      }, {
        Delimiter: delimiter
      }, {
        IsTruncated: isTruncated
      }]
    };
    var displayedObjects = _.cloneDeep(paginatedObject).map(function (cosObject) {
      return {
        Contents: [{
          Key: cosObject.Key
        }, {
          LastModified: cosObject.LastModified
        }, {
          Size: cosObject.Size
        }]
      };
    });
    (_objectsContent$ListB = objectsContent.ListBucketResult).push.apply(_objectsContent$ListB, _toConsumableArray(displayedObjects));
    res.type('application/xml');
    var xmlStr = xml(objectsContent, {
      declaration: true
    });
    res.status(200).send(xmlStr);
  }
  return res.status(404).end();
};
exports.bucket = bucket;
var bucketConfig = function bucketConfig(req, res) {
  var bucketName = req.params.bucketName;
  var bucketCollection = _server.db.getCollection(_server.COLS.cosBuckets);
  var bucketItem = bucketCollection.chain().find({
    Name: bucketName
  }).data({
    removeMeta: true
  })[0];
  if (bucketItem) {
    // using hardcoded strings -- the service info doesn't matter in mock data
    var result = {
      name: bucketName,
      service_instance_id: 'MOCK_SERVICE_INSTANCE_ID',
      service_instance_crn: 'MOCK_SERVICE_INSTANCE_CRN',
      time_created: utils.generateCreateDate(),
      time_updated: utils.generateNowDate(),
      object_count: casual.integer(1, 500),
      bytes_used: casual.integer(1, 500000)
    };
    res.status(200).json(result).end();
  }
  res.status(404).end();
};
exports.bucketConfig = bucketConfig;