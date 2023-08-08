"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listKeys = exports.init = exports.getRootKey = exports.getKeyMetadata = void 0;
var utils = _interopRequireWildcard(require("../../../utils"));
var _server = require("../../../server");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
var _ = require('lodash');
var template = require('./template.json');
var addResource = function addResource(resources, parent) {
  var data = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var resource = _.cloneDeep(template);
  resource.id = casual.uuid;
  resource.region = parent.region;
  resource.name = "".concat(parent.name, "-keys-").concat(casual.integer(1, 1000));
  resource.extractable = casual["boolean"];
  var parentCRNfields = parent.crn.split(':');
  parentCRNfields[8] = 'key';
  parentCRNfields[9] = resource.id;
  resource.crn = parentCRNfields.join(':');
  resources.insert(Object.assign(resource, data));
  return resource;
};

/**
 * init()
 * Initialize ghost
 */
var init = function init() {
  var kpKeys = _server.db.addCollection(_server.COLS.keyprotect);
  var collection = _server.db.getCollection(_server.COLS.ghost);
  var kpInstances = collection.find({
    service_name: 'kms'
  });
  kpInstances.forEach(function (kpInstance) {
    addResource(kpKeys, kpInstance, {
      name: 'kp-keys-001'
    });
    addResource(kpKeys, kpInstance, {
      name: 'kp-keys-002'
    });
    utils.repeat(function () {
      addResource(kpKeys, kpInstance);
    }, 20);
  });
  var hpcsInstances = collection.find({
    service_name: 'hs-crypto'
  });
  hpcsInstances.forEach(function (hpcsInstance) {
    addResource(kpKeys, hpcsInstance, {
      name: 'hpcs-keys-001'
    });
    addResource(kpKeys, hpcsInstance, {
      name: 'hpcs-keys-002'
    });
    utils.repeat(function () {
      addResource(kpKeys, hpcsInstance);
    }, 30);
  });
};
exports.init = init;
var listKeys = function listKeys(req, res) {
  var instanceId = req.headers['bluemix-instance'];
  var collection = _server.db.getCollection(_server.COLS.keyprotect);
  var keys = collection.chain().where(function (resource) {
    return resource.crn.split(':')[7] === instanceId;
  }).data({
    removeMeta: true
  });
  var displayKeys = _.cloneDeep(keys);
  displayKeys.forEach(function (displayKey) {
    return delete displayKey.region;
  });
  res.status(200).json({
    resources: displayKeys
  }).end();
};
exports.listKeys = listKeys;
var getKeyMetadata = function getKeyMetadata(req, res) {
  var collection = _server.db.getCollection(_server.COLS.keyprotect);
  var key = collection.chain().find({
    id: req.params.id
  }).data({
    removeMeta: true
  });
  var realRes = {
    metadata: {
      collectionType: 'application/vnd.ibm.kms.key+json',
      collectionTotal: key.length
    },
    resources: key
  };
  res.status(200).json(realRes).end();
};
exports.getKeyMetadata = getKeyMetadata;
var getRootKey = function getRootKey(_ref) {
  var region_name = _ref.region_name;
  var resources = _server.db.getCollection(_server.COLS.keyprotect).chain().find({
    extractable: false,
    region: region_name
  }).data({
    removeMeta: true
  });
  return resources[casual.integer(0, resources.length - 1)];
};
exports.getRootKey = getRootKey;