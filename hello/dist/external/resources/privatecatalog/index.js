"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getResource = exports.getRandomCatalogVersion = exports.getCatalogOfferings = exports.getCatalogOffering = exports["default"] = void 0;
var _server = require("../../../server");
var utils = _interopRequireWildcard(require("../../../utils"));
var _catalog_offerings = _interopRequireDefault(require("./catalog_offerings.json"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var _ = require('lodash');
var casual = require('casual');
var lucene = require('lucene');
var errors = require('./errors.json');
var template = require('./template.json');
var fieldsArray = ['service_name', 'service_instance', 'crn', 'region', 'kind'];
var flattenNameMap = {};
// value map for Loki search
var flattenValueMap = {};
var addResource = function addResource(resources, data) {
  var id = data.id || casual.uuid;
  var resource = _.cloneDeep(template);
  resource.id = id;
  resource.label = "pCatalog-".concat(data.service_name || resource.service_name, "-").concat(casual.integer(1, 1000));
  resource = _objectSpread(_objectSpread({}, resource), data);
  resource.crn = utils.generateCRN({
    'service-name': 'globalcatalog-collection',
    'service-instance': id,
    region: 'global'
  });
  resources.insert(resource);
  return resource;
};
/**
 * init()
 * Initialize globalcatalog
 */
var init = function init() {
  var catalogOfferings = _server.db.addCollection(_server.COLS.catalog_offerings);
  JSON.parse(JSON.stringify(_catalog_offerings["default"])).forEach(function (offering) {
    catalogOfferings.insert(offering);
  });
  var pCatalog = _server.db.addCollection(_server.COLS.privateCatalog, {
    indices: ['kind']
  });
  addResource(pCatalog, {
    id: 'pCatalog-hello-001',
    parent_id: 'us-south',
    kind: 'hello',
    data: {
      endpoint_type: ' ',
      fully_qualified_domain_names: ['private.us-south.hello.cloud.ibm.com'],
      service_crn: 'crn:v1:bluemix:public:hello:us-south:::endpoint:private.us-south.hello.cloud.ibm.com'
    }
  });
  addResource(pCatalog, {
    id: 'pCatalog-kp-mock-001',
    parent_id: 'us-south',
    data: {
      endpoint_type: ' ',
      fully_qualified_domain_names: ['private.us-south.kms.cloud.ibm.com'],
      service_crn: 'crn:v1:bluemix:public:kms:us-south:::endpoint:private.us-south.kms.cloud.ibm.com'
    }
  });
  addResource(pCatalog, {
    id: 'pCatalog-kp-mock-002',
    parent_id: 'us-east',
    data: {
      endpoint_type: ' ',
      fully_qualified_domain_names: ['private.us-east.kms.cloud.ibm.com'],
      service_crn: 'crn:v1:bluemix:public:kms:us-east:::endpoint:private.us-east.kms.cloud.ibm.com'
    }
  });
  addResource(pCatalog, {
    id: 'pCatalog-cos-mock-002',
    parent_id: 'us-east',
    data: {
      endpoint_type: ' ',
      fully_qualified_domain_names: ['private.us-east.cos.cloud.ibm.com'],
      service_crn: 'crn:v1:bluemix:public:cloud-object-storage:us-east:::endpoint:private.us-east.cos.cloud.ibm.com'
    }
  });
  addResource(pCatalog, {
    id: 'pCatalog-cos-mock-002',
    parent_id: 'us-south',
    data: {
      endpoint_type: ' ',
      fully_qualified_domain_names: ['private.us-south.cos.cloud.ibm.com'],
      service_crn: 'crn:v1:bluemix:public:cloud-object-storage:us-south:::endpoint:private.us-south.cos.cloud.ibm.com'
    }
  });
};
exports.init = init;
var getCatalogOfferings = function getCatalogOfferings(req, res) {
  var catalogOfferings = utils.getResources(req, _server.COLS.catalog_offerings).catalog_offerings;
  res.json({
    offset: 0,
    limit: 200,
    total_count: catalogOfferings.length,
    resource_count: catalogOfferings.length,
    first: '/api/v1-beta/offerings?limit=200',
    last: '/api/v1-beta/offerings?limit=200',
    resources: catalogOfferings
  }).end();
};
exports.getCatalogOfferings = getCatalogOfferings;
var getRandomCatalogVersion = function getRandomCatalogVersion() {
  var catalogOfferings = _server.db.getCollection(_server.COLS.catalog_offerings).data;
  var offeringsWithVersion = catalogOfferings.filter(function (a) {
    var _a$kinds$, _a$kinds$$versions;
    return (_a$kinds$ = a.kinds[0]) === null || _a$kinds$ === void 0 ? void 0 : (_a$kinds$$versions = _a$kinds$.versions) === null || _a$kinds$$versions === void 0 ? void 0 : _a$kinds$$versions.length;
  });
  return casual.random_element(casual.random_element(offeringsWithVersion).kinds[0].versions);
};
exports.getRandomCatalogVersion = getRandomCatalogVersion;
var getCatalogOffering = function getCatalogOffering(req, res) {
  var catalogOfferings = utils.getResources(req, _server.COLS.catalog_offerings).catalog_offerings;
  res.json(catalogOfferings.filter(function (offering) {
    return offering.id === req.params.offeringId;
  })[0]).end();
};
exports.getCatalogOffering = getCatalogOffering;
var getResource = function getResource(req, res) {
  var gcResource = _server.db.getCollection(_server.COLS.privateCatalog).chain().find({
    id: req.params.id
  }).data({
    removeMeta: true
  });
  if (gcResource.length === 0) {
    res.status(404).end();
    return;
  }
  utils.delayRegionTimeout(function () {
    res.status(200).json(gcResource[0]).end();
  }, utils.isZoneTimeout(req.params.id));
};
exports.getResource = getResource;
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
  var queryStr = req.query;
  var lucenceStr = queryStr.query;
  if (!lucenceStr) {
    res.status(400).json(errors.NO_QUERY).end();
    return;
  }
  var rootQuery = lucene.parse(lucenceStr);
  var targetResult = [];
  searchNode(rootQuery, targetResult);
  var DEFAULT_LIMIT = 100;
  var DEFAULT_OFFSET = 0;
  var limit = Number.parseInt(_.get(req, 'query.limit', DEFAULT_LIMIT), 10);
  var offset = Number.parseInt(_.get(req, 'query.offset', DEFAULT_OFFSET), 10);
  var collection = _server.db.getCollection(_server.COLS.privateCatalog);
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
  queryResult.resources = result;
  res.status(200).json(queryResult).end();
};
var _default = query;
exports["default"] = _default;