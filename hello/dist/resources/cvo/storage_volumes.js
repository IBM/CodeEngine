"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateStorageVolume = exports.init = exports.getStorageVolumes = exports.getStorageVolume = exports.formatStorageVolumeForClient = exports.deleteVolumeForSVM = exports.deleteVolumeForOntap = exports.deleteStorageVolume = exports.createStorageVolume = exports.addStorageVolume = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _get = _interopRequireDefault(require("lodash/get"));
var _merge = _interopRequireDefault(require("lodash/merge"));
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _storage_virtual_machines = require("./storage_virtual_machines");
var _features = require("../features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// Constants

// const Statuses = [ 'available', 'failed', 'pending', 'pending_deletion', 'unusable', 'updating'];
// @NOTE: currently only using running status to make it easier to edit/delete/use
var Statuses = ['available'];
var NFS_VERSIONS = ['nsf3', 'nsf4'];
var SECURITY_STYLES = ['mixed', 'nfs', 'unix'];

// @NOTE: ontap ID is found at get(volume, 'volume_configuration.storage_ontap_instance.id');
// @NOTE: svm ID is found at get(volume, 'volume_configuration.storage_virtual_machine.id');

/**
 * isValidVolumesPath() - checks the URL to make sure the instance and svm exist in this region
 */

var isValidVolumesPath = function isValidVolumesPath(req) {
  var matchingOntapInstance = utils.getResource(_server.COLS.ontap_instances, req.params.ontap_id);
  var matchingSVM = utils.getResource(_server.COLS.svm, req.params.svm_id);
  if (matchingOntapInstance) {
    var region = utils.getQueryRegion(req);
    if (matchingOntapInstance.region === region) {
      if (matchingSVM) {
        var _matchingSVM$storage_;
        return ((_matchingSVM$storage_ = matchingSVM.storage_ontap_instance) === null || _matchingSVM$storage_ === void 0 ? void 0 : _matchingSVM$storage_.id) === matchingOntapInstance.id;
      }
    }
  }
  return false;
};

// @TODO: need to use the `isValidVolumesPath` for the List, Details, and Update to check for region and 404 of svm/ontap

var filter = function filter(req, res, volume) {
  if (req.params.ontap_id && req.params.svm_id) {
    return (0, _get["default"])(volume, 'volume_configuration.storage_ontap_instance.id') === req.params.ontap_id && (0, _get["default"])(volume, 'volume_configuration.storage_virtual_machine.id') === req.params.svm_id;
  }
  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var formatStorageVolumeForClient = function formatStorageVolumeForClient(req, storageVolume) {
  // update the href according to the request
  // eslint-disable-next-line max-len
  storageVolume.href = "".concat(utils.getBaseApiUrl(req), "storage_ontap_instances/").concat(req.params.ontap_id, "/storage_virtual_machines/").concat(req.params.svm_id, "/volumes/").concat(storageVolume.id);
  storageVolume.crn = utils.updateResourceCrnRegion(storageVolume, req);
  // remove the region from the response
  delete storageVolume.region;
  return storageVolume;
};
exports.formatStorageVolumeForClient = formatStorageVolumeForClient;
var getStorageVolumeRecord = function getStorageVolumeRecord(req) {
  var removeMeta = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var storageVolumes = _server.db.getCollection(_server.COLS.storage_volumes).chain().find({
    id: req.params.volume_id
  }).data({
    removeMeta: removeMeta
  });
  storageVolumes = storageVolumes.filter(function (volume) {
    return (0, _get["default"])(volume, 'volume_configuration.storage_ontap_instance.id') === req.params.ontap_id && (0, _get["default"])(volume, 'volume_configuration.storage_virtual_machine.id') === req.params.svm_id;
  });
  if (!storageVolumes || storageVolumes.length === 0) {
    return undefined;
  }
  return storageVolumes[0];
};
var addStorageVolume = function addStorageVolume(storageVolumes, data) {
  var baseData = {
    capacity: _casual["default"].integer(1, 16000),
    created_at: utils.generateCreateDate(),
    // crn: utils.generateCRN(),
    href: '',
    id: _casual["default"].uuid,
    name: utils.generateName('storage-volume'),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'storage_volume',
    state: Statuses[0],
    user_tags: [],
    volume_configuration: {
      export_policy_info: {
        nfs_version: NFS_VERSIONS[1],
        policy_type: '',
        rules: [{
          ips: ['1.1.1.2'],
          is_superuser: false,
          nfs_version: NFS_VERSIONS[1],
          rule_access_control: ''
        }]
      },
      junction_path: '/dev/data',
      security_style: _casual["default"].random_element(SECURITY_STYLES),
      share_info: {
        access_control_list: [{
          permission: '',
          users: ['user1']
        }],
        share_name: utils.generateName('cvo-share')
      },
      storage_efficiency_enabled: true,
      storage_ontap_instance: {
        id: 'ontap-1001'
      },
      storage_virtual_machine: {
        id: 'svm-1001'
      }
    }
  };
  var newStorageVolume = _objectSpread(_objectSpread({}, baseData), data);
  storageVolumes.insert(newStorageVolume);
  return newStorageVolume;
};

/**
 * getStorageVolumes() - gets a paginated list of storage volumes
 * @param {*} req
 * @param {*} res
 */
exports.addStorageVolume = addStorageVolume;
var getStorageVolumes = function getStorageVolumes(req, res) {
  var isValidPath = isValidVolumesPath(req);
  if (!isValidPath) {
    res.status(404).end();
    return;
  }
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var items = utils.getResources(req, _server.COLS.storage_volumes, extraFilter, 'created_at', {
    desc: true
  });
  items.storage_volumes.forEach(function (svm) {
    return formatStorageVolumeForClient(req, svm);
  });
  res.json(items).end();
};

/**
 * createStorageVolume() - creates a storage virtual machine
 * @param {*} req
 * @param {*} res
 */
exports.getStorageVolumes = getStorageVolumes;
var createStorageVolume = function createStorageVolume(req, res) {
  var isValidPath = isValidVolumesPath(req);
  if (!isValidPath) {
    res.status(404).end();
    return;
  }
  var input = req.body;
  input.region = utils.getQueryRegion(req);
  // make sure we're not creating a svm that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.storage_volumes), input, req, res, errorMsg, 'storage_volumes')) {
    return;
  }

  // add the volume
  input.status = Statuses[0];
  input.created_at = utils.generateNowDate();
  var foundSVM = (0, _storage_virtual_machines.getSVMRecord)(req, true);
  if (!foundSVM) {
    res.status(400).json({
      errors: {
        code: 'svm_not_found'
      }
    });
    return;
  }
  if (input.volume_configuration) {
    input.volume_configuration.storage_ontap_instance = {
      id: req.params.ontap_id
    };
    input.volume_configuration.storage_virtual_machine = {
      id: req.params.svm_id
    };
  }
  var newStorageVolume = addStorageVolume(_server.db.getCollection(_server.COLS.storage_volumes), input);
  // return the newly added volume
  var items = _server.db.getCollection(_server.COLS.storage_volumes).chain().find({
    id: newStorageVolume.id
  }).data({
    removeMeta: true
  });
  var storageVolume = formatStorageVolumeForClient(req, items[0]);
  res.status(201).json(storageVolume).end();
};

/**
 * deleteStorageVolume() - deletes a storage volume
 * @param {*} req
 * @param {*} res
 */
exports.createStorageVolume = createStorageVolume;
var deleteStorageVolume = function deleteStorageVolume(req, res) {
  var collection = _server.db.getCollection(_server.COLS.storage_volumes);
  var results = collection.find({
    id: req.params.volume_id
  });
  var item = results[0];
  var isValidPath = isValidVolumesPath(req);
  if (!isValidPath || !item) {
    res.status(404).end();
    return;
  }
  collection.remove(item);
  res.status(204).json(item).end();
};

/**
 * getStorageVolume() - gets a single storage volume
 * @param {*} req
 * @param {*} res
 */
exports.deleteStorageVolume = deleteStorageVolume;
var getStorageVolume = function getStorageVolume(req, res) {
  var record = getStorageVolumeRecord(req);
  var isValidPath = isValidVolumesPath(req);
  if (!isValidPath || !record) {
    res.status(404).end();
    return;
  }
  var item = formatStorageVolumeForClient(req, record);
  res.json(item).end();
};

/**
 * updateStorageVolume() - updates a single storage volume
 * @param {*} req
 * @param {*} res
 */
exports.getStorageVolume = getStorageVolume;
var updateStorageVolume = function updateStorageVolume(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.storage_volumes);
  var results = collection.find({
    id: req.params.volume_id
  });
  var itemToUpdate = results[0];
  var match = (0, _get["default"])(itemToUpdate, 'volume_configuration.storage_ontap_instance.id') === req.params.ontap_id && (0, _get["default"])(itemToUpdate, 'volume_configuration.storage_virtual_machine.id') === req.params.svm_id;
  var isValidPath = isValidVolumesPath(req);
  if (!itemToUpdate || !match || !isValidPath) {
    res.status(404).end();
    return;
  }
  var mergedVolumeConfiguration = (0, _merge["default"])(itemToUpdate.volume_configuration, input.volume_configuration);
  var updatedVolume = _objectSpread(_objectSpread(_objectSpread({}, itemToUpdate), input), {}, {
    volume_configuration: mergedVolumeConfiguration
  });
  collection.update(updatedVolume);
  var updatedItem = getStorageVolumeRecord(req);
  var updatedResult = formatStorageVolumeForClient(req, updatedItem);
  res.status(200).json(updatedResult).end();
};
exports.updateStorageVolume = updateStorageVolume;
var deleteVolumeForOntap = function deleteVolumeForOntap(ontapId) {
  // get the list of volumes that are part of this ontap
  var collection = _server.db.getCollection(_server.COLS.storage_volumes);
  var allVolumes = collection.chain().data({
    removeMeta: true
  });
  var ontapVolumes = allVolumes.filter(function (volume) {
    return (0, _get["default"])(volume, 'volume_configuration.storage_ontap_instance.id') === ontapId;
  });
  ontapVolumes.forEach(function (volume) {
    // find the volume
    var results = collection.find({
      id: volume.id
    });
    var item = results[0];
    // delete it
    if (item) {
      collection.remove(item);
    }
  });
};
exports.deleteVolumeForOntap = deleteVolumeForOntap;
var deleteVolumeForSVM = function deleteVolumeForSVM(svmId) {
  // get the list of volumes that are part of this ontap
  var collection = _server.db.getCollection(_server.COLS.storage_volumes);
  var allVolumes = collection.chain().data({
    removeMeta: true
  });
  var svmVolumes = allVolumes.filter(function (volume) {
    return (0, _get["default"])(volume, 'volume_configuration.storage_virtual_machine.id') === svmId;
  });
  svmVolumes.forEach(function (volume) {
    // find the volume
    var results = collection.find({
      id: volume.id
    });
    var item = results[0];
    // delete it
    if (item) {
      collection.remove(item);
    }
  });
};

/**
 * init() - initializes the storage virtual machine model
 */
exports.deleteVolumeForSVM = deleteVolumeForSVM;
var init = function init() {
  var storageVolumes = _server.db.addCollection(_server.COLS.storage_volumes);
  // @NOTE: default volumes will require an ontap and SVM to exist.  default ontap/svm are created as part of the ontaps init

  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var default_volume = {
    capacity: _casual["default"].integer(1, 16000),
    id: 'storage-vol-1001',
    name: 'aaa-default-cvo-volume',
    volume_configuration: {
      export_policy_info: {
        ips: ['1.1.1.1'],
        nfs_version: NFS_VERSIONS[1],
        policy_type: '',
        rules: [{
          ips: ['1.1.1.2'],
          is_superuser: false,
          nfs_version: NFS_VERSIONS[1],
          rule_access_control: ''
        }]
      },
      junction_path: '/dev/data',
      security_style: _casual["default"].random_element(SECURITY_STYLES),
      share_info: {
        access_control_list: [{
          permission: '',
          users: ['user1']
        }],
        share_name: utils.generateName('cvo-share')
      },
      storage_efficiency_enabled: true,
      storage_ontap_instance: {
        id: 'ontap-1001'
      },
      storage_virtual_machine: {
        id: 'svm-1001'
      }
    }
  };
  addStorageVolume(storageVolumes, default_volume);
};
exports.init = init;