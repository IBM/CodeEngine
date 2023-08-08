"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports["default"] = void 0;
var utils = _interopRequireWildcard(require("../../../utils"));
var _server = require("../../../server");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var _ = require('lodash');
var lucene = require('lucene');
var errors = require('./errors.json');
var template = require('./template.json');
var fieldsArray = ['service_name', 'doc.sub_type', 'docSubType', 'service_instance', 'doc.extensions.virtual_private_endpoints.endpoints.ip_address', 'crn', 'region'];
var flattenNameMap = {
  'doc.sub_type': 'docSubType'
};
// value map for Loki search
var flattenValueMap = {
  '*': {
    $exists: true
  }
};
var addResource = function addResource(resources, data) {
  var resource = _.cloneDeep(template);
  resource.service_instance = casual.uuid;
  resource.name = "ghost-".concat(data.service_name || resource.service_name, "-").concat(casual.integer(1, 1000));
  resource.region = utils.getRandomZone().region_name;
  resource = _objectSpread(_objectSpread({}, resource), data);
  resource.crn = utils.generateCRN({
    'service-name': resource.service_name,
    'service-instance': resource.service_instance,
    region: resource.region
  });
  if (resource.service_name === 'kms' || resource.service_name === 'hs-crypto') {
    resource.docSubType = 'kms';
  }
  resources.insert(resource);
  return resource;
};

/**
 * init()
 * Initialize ghost
 */
var init = function init() {
  var ghost = _server.db.addCollection(_server.COLS.ghost, {
    indices: ['service_name']
  });
  addResource(ghost, {
    name: 'ghost-kp-mock-001',
    service_name: 'kms',
    region: 'us-south',
    doc: {
      extensions: {
        virtual_private_endpoints: {
          vrf_id: 'one-vrf-id-1',
          endpoints: [{
            ip_address: '10.10.10.10',
            port: 80,
            zone: 'us-east-1'
          }],
          dns_host: 'private.us-south',
          dns_domain: 'kms.cloud.ibm.com'
        }
      }
    }
  });
  addResource(ghost, {
    name: 'ghost-kp-mock-002',
    service_name: 'kms',
    region: 'us-east',
    doc: {
      extensions: {
        virtual_private_endpoints: {
          vrf_id: 'one-vrf-id-2',
          endpoints: [{
            ip_address: '10.10.10.10',
            port: 80,
            zone: 'us-east-1'
          }],
          dns_host: 'private.us-south',
          dns_domain: 'kms.cloud.ibm.com'
        }
      }
    }
  });
  addResource(ghost, {
    name: 'ghost-kp-mock-003',
    service_name: 'kms',
    region: 'eu-de',
    doc: {
      extensions: {
        virtual_private_endpoints: {
          vrf_id: 'one-vrf-id-3',
          endpoints: [{
            ip_address: '10.10.10.10',
            port: 80,
            zone: 'us-east-1'
          }],
          dns_host: 'private.us-south',
          dns_domain: 'kms.cloud.ibm.com'
        }
      }
    }
  });
  addResource(ghost, {
    name: 'ghost-kp-mock-004',
    service_name: 'kms',
    region: 'jp-tok',
    doc: {
      extensions: {
        virtual_private_endpoints: {
          vrf_id: 'one-vrf-id-4',
          endpoints: [{
            ip_address: '10.10.10.10',
            port: 80,
            zone: 'us-east-1'
          }],
          dns_host: 'private.us-south',
          dns_domain: 'kms.cloud.ibm.com'
        }
      }
    }
  });
  addResource(ghost, {
    name: 'ghost-hpcs-mock-001',
    service_name: 'hs-crypto',
    region: 'us-south'
  });
  addResource(ghost, {
    name: 'ghost-hpcs-mock-002',
    service_name: 'hs-crypto',
    region: 'us-east'
  });
  utils.repeat(function () {
    addResource(ghost, {
      service_name: 'kms'
    });
  }, 2);
  utils.repeat(function () {
    addResource(ghost, {
      service_name: 'hs-crypto'
    });
  }, 2);
  addResource(ghost, {
    name: 'ghost-cloud-object-storage-001',
    service_name: 'cloud-object-storage',
    region: 'global'
  });
  addResource(ghost, {
    name: 'ghost-cloud-object-storage-002',
    service_name: 'cloud-object-storage',
    region: 'global'
  });
  addResource(ghost, {
    name: 'ghost-cloud-object-storage-003',
    service_name: 'cloud-object-storage',
    region: 'us-east'
  });
  addResource(ghost, {
    name: 'ghost-cloud-object-storage-004',
    service_name: 'cloud-object-storage',
    region: 'us-east'
  });
  addResource(ghost, {
    name: 'dsn-svc-001',
    service_name: 'dns-svcs',
    region: 'global',
    doc: {
      guid: 'dns-inst-001'
    }
  });
  addResource(ghost, {
    name: 'dsn-svc-002',
    service_name: 'dns-svcs',
    region: 'global',
    doc: {
      guid: 'dns-inst-002'
    }
  });
  addResource(ghost, {
    name: 'dsn-svc-003',
    service_name: 'dns-svcs',
    region: 'global',
    doc: {
      guid: 'dns-inst-003'
    }
  });
  utils.repeat(function () {
    addResource(ghost, {
      service_name: 'cloud-object-storage',
      region: 'global'
    });
  }, 10);
};
exports.init = init;
var formatClientOutput = function formatClientOutput(instances, req) {
  return instances.map(function (instance) {
    var instanceForClient = _objectSpread({}, instance);
    if (instance.service_name === 'kms' || instance.service_name === 'hs-crypto') {
      var kpEndpointBase = "".concat(utils.getRequestProtocol(req), "://").concat(req.get('host')).concat(_server.ROOT_CONTEXT, "external/kp-mock");
      var publicApiEndpoint = "".concat(kpEndpointBase, "/").concat(instance.region);
      instanceForClient.doc = instance.doc || {};
      instanceForClient.doc.sub_type = 'kms';
      instanceForClient.doc.extensions = instanceForClient.doc.extensions || {};
      instanceForClient.doc.extensions.endpoints = instanceForClient.doc.extensions.endpoints || {};
      instanceForClient.doc.extensions.endpoints["public"] = publicApiEndpoint;
      instanceForClient.doc.state = 'active';
    }
    return instanceForClient;
  });
};
var searchNode = function searchNode(node, targetResult) {
  var leftField = _.get(node, 'left');
  if (leftField && fieldsArray.includes(leftField.field)) {
    targetResult.push({
      value: flattenValueMap[leftField.term] || leftField.term,
      name: flattenNameMap[leftField.field] || leftField.field
    });
  }
  var rightField = _.get(node, 'right');
  if (rightField && fieldsArray.includes(rightField.field)) {
    targetResult.push({
      value: flattenValueMap[rightField.term] || rightField.term,
      name: flattenNameMap[rightField.field] || rightField.field
    });
  }
  if (leftField) {
    searchNode(leftField, targetResult);
  }
  if (rightField) {
    searchNode(rightField, targetResult);
  }
};
var query = function query(req, res) {
  var queryStr = req.body;
  var lucenceStr = queryStr.query;
  if (!lucenceStr) {
    res.status(400).json(errors.NO_QUERY).end();
  }
  var rootQuery = lucene.parse(lucenceStr);
  var targetResult = [];
  searchNode(rootQuery, targetResult);
  var DEFAULT_LIMIT = 100;
  var DEFAULT_OFFSET = 0;
  var limit = Number.parseInt(_.get(req, 'query.limit', DEFAULT_LIMIT), 10);
  var offset = Number.parseInt(_.get(req, 'query.offset', DEFAULT_OFFSET), 10);
  var collection = _server.db.getCollection(_server.COLS.ghost);
  var queryClause = {};
  targetResult.forEach(function (oneTarget) {
    var queryField = fieldsArray.find(function (fieldName) {
      return fieldName === oneTarget.name;
    });
    queryClause[queryField] = oneTarget.value;
  });
  var totalItems = collection.find(queryClause).length;
  var result = collection.chain().find(queryClause).offset(offset).limit(limit).data({
    removeMeta: true
  });
  var queryResult = {};
  if (offset + limit >= totalItems) {
    queryResult.more_data = false;
  } else {
    queryResult.more_data = true;
  }
  queryResult.items = formatClientOutput(result, req);
  queryResult.offset = offset;
  queryResult.limit = limit;
  res.status(200).json(queryResult).end();
};
var _default = query;
exports["default"] = _default;