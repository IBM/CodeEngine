"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateFlowLogCollector = exports.init = exports.getFlowLogCollectors = exports.getFlowLogCollector = exports.deleteFlowLogCollector = exports.createFlowLogCollectors = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
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
var casual = require('casual');
var lifecycleStates = ['stable', 'deleted', 'deleting', 'failed', 'pending', 'updating', 'waiting'];
var targetResourceTypes = ['vpc', 'subnet', 'instance', 'network_interface'];
var getResourceRegion = function getResourceRegion(resource, resourceType) {
  var resourceRegion;
  if (resourceType === 'network_interface') {
    var instance = _server.db.getCollection(_server.COLS.instances).find({
      id: resource.instance_id
    })[0];
    resourceRegion = instance ? instance.zone.region_name : (0, utils.getRandomZone)().region_name;
  } else if (resource.zone.region_name) {
    resourceRegion = resource.zone.region_name;
  } else {
    // some resources don't seem to have a resource.zone.region_name
    // if they don't, we need to do a lookup and get the region from the zone.
    var zoneData = utils.findZone(resource.zone.name);
    resourceRegion = zoneData.region_name;
  }
  return resourceRegion;
};
var getResourceTypeByTargetId = function getResourceTypeByTargetId(id) {
  // we don't know the resource type, we need to search the targetResourceTypes
  var foundType;
  targetResourceTypes.forEach(function (resourceType) {
    if (!foundType) {
      var collection = "".concat(resourceType, "s");
      var temp = utils.getResource(collection, id)[0];
      if (temp) {
        foundType = resourceType;
      }
    }
  });
  return foundType;
};
var generateStorageBucketForResource = function generateStorageBucketForResource(resource, resourceType) {
  // if the resource is a network_interface, we need to get the instance's region
  var resourceRegion = getResourceRegion(resource, resourceType);
  var buckets = _server.db.getCollection(_server.COLS.cosBuckets).find({
    LocationConstraint: "".concat(resourceRegion, "-standard")
  });
  var bucket = casual.random_element(buckets);
  return {
    name: bucket.Name
  };
};
var addFlowLog = function addFlowLog(flowLogs) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  // get a random target resource
  var randomResourceType = casual.random_element(targetResourceTypes);
  var randomResourceTypeColMapping = "".concat(randomResourceType, "s");
  var randomResource = utils.getRandomResource(randomResourceTypeColMapping);
  var randomTarget = {
    id: randomResource.id,
    resource_type: randomResourceType,
    name: randomResource.name
  };

  // bucket should have `name`
  var randomStorageBucket = generateStorageBucketForResource(randomResource, randomResourceType);
  var baseData = {
    created_at: utils.generateCreateDate(),
    crn: utils.generateCRN(),
    href: '',
    id: casual.uuid,
    lifecycle_state: casual.random_element(lifecycleStates),
    name: utils.generateName('flow-log'),
    storage_bucket: randomStorageBucket,
    target: randomTarget,
    suspended: false,
    region: getResourceRegion(randomResource, randomResourceType)
  };
  // if we have a target specified, we need to get the resource type for it
  if (data.target && data.target.id) {
    var resourceType = getResourceTypeByTargetId(data.target.id);
    var collection = "".concat(resourceType, "s");
    var resource = utils.getResource(collection, data.target.id)[0];
    var resourceRegion = getResourceRegion(resource, resourceType);
    data.target = {
      id: resource.id,
      resource_type: resourceType,
      name: resource.name
    };
    data.region = resourceRegion;

    // if we don't have the bucket info, we need to override the random one
    if (!data.storage_bucket) {
      data.storage_bucket = generateStorageBucketForResource(resource, resourceType);
    }
  }
  var newFlowLog = _objectSpread(_objectSpread({}, baseData), data);
  flowLogs.insert(newFlowLog);
  return newFlowLog;
};
var init = function init() {
  var flowLogCollectors = _server.db.addCollection(_server.COLS.flow_log_collectors);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // Create a flow log for a known VPC
  addFlowLog(flowLogCollectors, {
    lifecycle_state: 'stable',
    target: {
      id: 'vpc1001'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aa-flow-log-default-1',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'vpc1001'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aaa-flow-log-default-vpc-delete',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'vpc1001'
    }
  });

  // Create a flow log for a known Subnet
  addFlowLog(flowLogCollectors, {
    name: 'aa-flow-log-default-2',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'subnet-1',
      name: 'aaa-default-subnet-1'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aaa-flow-log-default-subnet-delete',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'subnet-1',
      name: 'aaa-default-subnet-1'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aa-flow-log-default-instance-1',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'instance-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'instance'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aa-flow-log-default-instance-2-delete',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'instance-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      resource_type: 'instance'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aa-flow-log-interface-1',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'vnic-aaaa-aaaa-aaaa-bbbbbbbbbbbb'
    }
  });
  addFlowLog(flowLogCollectors, {
    name: 'aaa-flow-log-default-interface-delete',
    lifecycle_state: 'stable',
    active: true,
    target: {
      id: 'vnic-aaaa-aaaa-aaaa-bbbbbbbbbbbb'
    }
  });
  utils.repeat(function () {
    addFlowLog(flowLogCollectors, {});
  }, 20);
};
exports.init = init;
var formatFlowLogConnectionForClient = function formatFlowLogConnectionForClient(req, flowLog) {
  var href = "".concat(utils.getBaseApiUrl(req)).concat(_server.COLS.flow_log_collectors, "/").concat(flowLog.id);
  var crn = utils.updateResourceCrnRegion(flowLog, req);
  var flowLogForClient = _objectSpread(_objectSpread({}, flowLog), {}, {
    crn: crn,
    href: href
  });
  delete flowLogForClient.region;
  return flowLogForClient;
};
var generateFilterFunc = function generateFilterFunc(IDsToMatch, resourceTypeToMatch) {
  return function (resource) {
    var hasResourceType = resourceTypeToMatch !== undefined;
    var hasIDs = IDsToMatch && IDsToMatch.length > 0;

    // if we have both parameters, we need to only return both matches
    if (hasIDs && hasResourceType) {
      return IDsToMatch.indexOf(resource.target.id) >= 0 && resource.target.resource_type === resourceTypeToMatch;
    }
    // if we only have IDs to match, only return the items that match the IDs
    if (hasIDs) {
      return IDsToMatch.indexOf(resource.target.id) >= 0;
    }
    // if we only have a resource type to match, only return the items that match it
    if (hasResourceType) {
      return resource.target.resource_type === resourceTypeToMatch;
    }

    // if none of the other cases are met, return all resources
    return true;
  };
};
var getFlowLogCollectors = function getFlowLogCollectors(req, res) {
  var targetID = _lodash["default"].get(req, 'query["target.id"]');
  var targetResourceType = _lodash["default"].get(req, 'query["target.resource_type"]');
  var vpcID = _lodash["default"].get(req, 'query["vpc.id"]');
  var IDsToMatch = [];
  var hasResourceType = targetResourceType && targetResourceTypes.indexOf(targetResourceType) >= 0;
  var resourceTypeToMatch = hasResourceType ? targetResourceType : undefined;
  if (targetID) {
    IDsToMatch = [targetID];
  } else if (vpcID) {
    var VPCs = utils.getResource(_server.COLS.vpcs, vpcID);
    if (VPCs.length > 0) {
      // get the subnets for the VPC;
      var VPCSubnets = _server.db.getCollection(_server.COLS.subnets).chain().where(function (item) {
        return item.vpc.id === vpcID;
      }).data({
        removeMeta: true
      });
      var subnetIDs = VPCSubnets.map(function (item) {
        return item.id;
      });
      // then get all the interfaces for those subnets
      var subnetInterfaces = _server.db.getCollection(_server.COLS.network_interfaces).chain().where(function (item) {
        return subnetIDs.indexOf(item.subnet.id) >= 0;
      }).data({
        removeMeta: true
      });
      var ids = [];
      // since this is scoping based on a vpc, we need the subnets, instances, and interfaces
      subnetInterfaces.forEach(function (item) {
        ids.push(item.id);
        ids.push(item.instance_id);
      });
      // make sure we only have one instance of the ID in the array and all falsy values are gone
      IDsToMatch = _lodash["default"].compact(_lodash["default"].uniq([vpcID].concat(_toConsumableArray(subnetIDs), ids)));
    }
  }
  var flowLogs = utils.getResources(req, _server.COLS.flow_log_collectors, generateFilterFunc(IDsToMatch, resourceTypeToMatch));
  var flowLogCollecters = flowLogs.flow_log_collectors.map(function (log) {
    return formatFlowLogConnectionForClient(req, log);
  });
  flowLogs.flow_log_collectors = flowLogCollecters;
  res.json(flowLogs).end();
};
exports.getFlowLogCollectors = getFlowLogCollectors;
var createFlowLogCollectors = function createFlowLogCollectors(req, res) {
  var input = req.body;
  var invalidRG = input.resource_group && utils.resourceGroupCheck(input, res);
  if (invalidRG) return;
  input.lifecycle_state = lifecycleStates[0];
  var newFlowLogCollector = addFlowLog(_server.db.getCollection(_server.COLS.flow_log_collectors), input);
  var flowLog = utils.findResource(_server.COLS.flow_log_collectors, newFlowLogCollector.id, res, true);
  if (!flowLog) return;
  res.status(201).json(formatFlowLogConnectionForClient(req, flowLog)).end();
};
exports.createFlowLogCollectors = createFlowLogCollectors;
var deleteFlowLogCollector = function deleteFlowLogCollector(req, res) {
  // get and verify the flow log
  var collection = _server.db.getCollection(_server.COLS.flow_log_collectors);
  var flowLog = collection.find({
    id: req.params.flow_log_id
  });
  if (!flowLog) {
    res.status(404).end();
    return;
  }

  // Delete the flow log
  collection.remove(flowLog);
  res.status(204).end();
};
exports.deleteFlowLogCollector = deleteFlowLogCollector;
var getFlowLogCollector = function getFlowLogCollector(req, res) {
  // get and verify the flow log
  var flowLog = utils.findResource(_server.COLS.flow_log_collectors, req.params.flow_log_id, res, true);
  if (!flowLog) return;
  var flowLogForClient = formatFlowLogConnectionForClient(req, flowLog);
  res.json(flowLogForClient).end();
};
exports.getFlowLogCollector = getFlowLogCollector;
var updateFlowLogCollector = function updateFlowLogCollector(req, res) {
  var collection = _server.db.getCollection(_server.COLS.flow_log_collectors);
  // get and verify the flow log
  var flowLog = utils.findResource(_server.COLS.flow_log_collectors, req.params.flow_log_id, res, false);
  if (!flowLog) return;

  // update the flow log item
  var updatedLog = _objectSpread(_objectSpread({}, flowLog), req.body);
  collection.update(updatedLog);
  var flowLogForClient = formatFlowLogConnectionForClient(req, updatedLog);
  res.json(flowLogForClient).end();
};
exports.updateFlowLogCollector = updateFlowLogCollector;