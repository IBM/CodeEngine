"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateKey = exports.init = exports.getKeys = exports.getKey = exports.formatKeyForClient = exports.deleteKey = exports.createKey = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var casual = require('casual');
var addKey = function addKey(keys) {
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var id = casual.uuid;
  var region = data.regionID || utils.getRandomRegion().name;
  var key = Object.assign({
    id: id,
    crn: utils.generateCRN({
      region: region
    }),
    created_at: utils.generateCreateDate(),
    public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDEVQntREgmdzbOD3Lk+MGJ4cBtQIXC8xaM4pPFGM84XtOA+EWyUyEMH4e8i9BCBayDme25UrxkxpE8zl3mruff218iSmkrol3SREF1+INv9+EFdUoKbtM1DW9Mm0MKYnjbVVkmKIgHnA4EdDEP5IQvZQHU9SyhuJmbe6rB9pPzrg1WM5046ErWzYrjeeVQDINYSgvztcSxlh2R6fBp+hsu7Ih9W+d/8Og8ESszcrttMUXv7kyKjSwIhzv8XO/4WSPg02vfXnsmurf2bzk75PSZJPUXevSZpocpnH6MTkEaeBuZI4tiOYgfD/ZEKng7i001sde7nLVmr4UfSmhlGGg1 zack.grossbart@ibm.com',
    // eslint-disable-line max-len
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    fingerprint: 'SHA256:0bS71gxtIOTi+ds0hzFO9tFawhE6WZafRD+PCUxW+Hw',
    length: 2048,
    type: 'rsa',
    region: region
  }, data);
  if (!key.name) {
    key.name = utils.generateName('key', {
      region_name: key.region
    });
  }
  keys.insert(key);
  return id;
};
var init = function init() {
  var keys = _server.db.addCollection(_server.COLS.keys);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addKey(keys, {
    name: 'key1',
    id: '31b984aa-81e3-48d6-a3bd-98a470931eed',
    regionID: 'us-east'
  });
  addKey(keys, {
    name: 'key2',
    id: 'a17b751d-de93-41a0-8795-5f1ceb743dc4'
  });
  addKey(keys, {
    name: 'key3',
    id: '7cdf8de2-5835-4843-8c87-925c94a6d136'
  });
  addKey(keys, {
    name: 'aa-key-delete',
    id: '8cdf8de2-5835-4843-8c87-925c94a6d136',
    regionID: 'us-east'
  });
  addKey(keys, {
    name: 'bb-key-delete',
    id: '9cdf8de2-5835-4843-8c87-925c94a6d136',
    regionID: 'us-east'
  });
  addKey(keys, {
    name: 'aa-key1',
    id: '32b984aa-81e3-48d6-a3bd-98a470931eed',
    regionID: 'us-east'
  });

  // Generate key for each supported region
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    addKey(keys, {
      name: "key_per_region_".concat(region.name),
      regionID: region.name
    }, true);
  });
  utils.repeat(function () {
    addKey(keys, {});
  }, 25);
};
exports.init = init;
var formatKeyForClient = function formatKeyForClient(keyId, req, res) {
  var key = utils.findResource(_server.COLS.keys, keyId, res, false);
  return {
    id: key.id,
    name: key.name,
    fingerprint: key.fingerprint,
    crn: utils.updateResourceCrnRegion(key, req),
    href: "".concat(utils.getBaseApiUrl(req), "/keys/").concat(key.id)
  };
};
exports.formatKeyForClient = formatKeyForClient;
var createKey = function createKey(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.keys), input, req, res, 'key is already existed', 'key')) {
    return;
  }
  input.regionID = utils.findRegion(utils.getQueryRegion(req)).name;
  input.created_at = utils.generateNowDate();
  var id = addKey(_server.db.getCollection(_server.COLS.keys), input);
  var newKey = utils.findResource(_server.COLS.keys, id, res, true);
  newKey.href = "".concat(utils.getBaseUrl(req), "/").concat(newKey.id);
  newKey.crn = utils.updateResourceCrnRegion(newKey, req);
  res.status(201).json(newKey).end();
};
exports.createKey = createKey;
var deleteKey = function deleteKey(req, res) {
  var key = _server.db.getCollection(_server.COLS.keys).find({
    id: req.params.key_id
  });
  if (!key || key.length === 0) {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.keys).findAndRemove({
    id: req.params.key_id
  });
  res.status(204).end();
};
exports.deleteKey = deleteKey;
var updateKey = function updateKey(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.keys), input, req, res, 'key is already existed', 'key')) {
    return;
  }
  var key = _server.db.getCollection(_server.COLS.keys).find({
    id: req.params.key_id
  });
  if (!key || key.length === 0) {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.keys).findAndUpdate({
    id: req.params.key_id
  }, function (k) {
    k.name = input.name;
  });
  var updatedKey = _server.db.getCollection(_server.COLS.keys).chain().find({
    id: req.params.key_id
  }).data({
    removeMeta: true
  });
  updatedKey[0].href = "".concat(utils.getBaseApiUrl(req), "/keys/").concat(req.params.key_id);
  res.status(200).json(updatedKey[0]).end();
};
exports.updateKey = updateKey;
var getKeys = function getKeys(req, res) {
  res.json(utils.getResources(req, _server.COLS.keys)).end();
};
exports.getKeys = getKeys;
var getKey = function getKey(req, res) {
  var key = _server.db.getCollection(_server.COLS.keys).chain().find({
    id: req.params.key_id
  }).data({
    removeMeta: true
  });
  if (key.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(key[0]).end();
};
exports.getKey = getKey;