"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateSVM = exports.init = exports.getSVMs = exports.getSVMRecord = exports.getSVM = exports.formatSVMForClient = exports.deleteSVMForOntap = exports.deleteSVM = exports.createSVM = exports.addSVM = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _get = _interopRequireDefault(require("lodash/get"));
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _keyprotect = require("../../external/resources/keyprotect");
var _storage_volumes = require("./storage_volumes");
var _excluded = ["encrypted_ad_domain_password", "encrypted_ad_domain_password_key_crn"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
// Constants

// const Statuses = [ 'deleting', 'running', 'starting', 'stopped', 'stopping'];
// @NOTE: currently only using running status to make it easier to edit/delete/use
var Statuses = ['running'];

// const filter = (req, res, resource) => {
var filter = function filter(req, res, resource) {
  if (req.params.ontap_id) {
    return resource.storage_ontap_instance.id === req.params.ontap_id;
  }
  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var formatSVMForClient = function formatSVMForClient(req, svm) {
  // update the href according to the request
  svm.href = "".concat(utils.getBaseApiUrl(req), "storage_ontap_instances/").concat(req.params.ontap_id, "/storage_virtual_machines/").concat(svm.id);
  svm.crn = utils.updateResourceCrnRegion(svm, req);
  var ad_configuration = (0, _get["default"])(svm, 'active_directory.active_directory_configuration');
  if (ad_configuration) {
    var encrypted_ad_domain_password = ad_configuration.encrypted_ad_domain_password,
      encrypted_ad_domain_password_key_crn = ad_configuration.encrypted_ad_domain_password_key_crn,
      active_directory_configuration = _objectWithoutProperties(ad_configuration, _excluded);
    // remove the encrypted_ad_domain_password fields
    svm.active_directory.active_directory_configuration = active_directory_configuration;
  }

  // remove the encrypted_svm_admin_password fields
  delete svm.encrypted_svm_admin_password;
  delete svm.encrypted_svm_admin_password_key_crn;
  return svm;
};
exports.formatSVMForClient = formatSVMForClient;
var getSVMRecord = function getSVMRecord(req) {
  var removeMeta = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var svms = _server.db.getCollection(_server.COLS.svm).chain().find({
    id: req.params.svm_id
  }).data({
    removeMeta: removeMeta
  });
  svms = svms.filter(function (svm) {
    var _svm$storage_ontap_in;
    return ((_svm$storage_ontap_in = svm.storage_ontap_instance) === null || _svm$storage_ontap_in === void 0 ? void 0 : _svm$storage_ontap_in.id) === req.params.ontap_id;
  });
  if (!svms || svms.length === 0) {
    return undefined;
  }
  return svms[0];
};
exports.getSVMRecord = getSVMRecord;
var SECURITY_STYLES = ['mixed', 'nfs', 'unix'];
var addSVM = function addSVM(svms, data) {
  var _getRootKey;
  var baseData = {
    active_directory: {
      active_directory_configuration: {
        dns_ips: [],
        domain_name: "".concat(_casual["default"].word, ".").concat(_casual["default"].domain),
        encrypted_ad_domain_password: 'password',
        // pragma: allowlist secret
        encrypted_ad_domain_password_key_crn: {
          crn: (_getRootKey = (0, _keyprotect.getRootKey)({
            region_name: 'us-east'
          })) === null || _getRootKey === void 0 ? void 0 : _getRootKey.crn
        },
        organizational_unit_distinguished_name: _casual["default"].word,
        storage_ontap_administrators_group: _casual["default"].word,
        user_name: _casual["default"].word
      },
      net_bios_name: _casual["default"].word
    },
    created_at: utils.generateCreateDate(),
    // crn: utils.generateCRN(),
    href: '',
    id: _casual["default"].uuid,
    name: utils.generateName('svm'),
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'storage_virtual_machine',
    root_volume_security_style: SECURITY_STYLES[0],
    status: Statuses[0],
    // storage_efficiency_enabled: true,
    storage_ontap_instance: {
      id: 'ontap-1001' // reference info will be filled out by format function
    },

    storage_virtual_machine_endpoints: {
      management: {
        dns_name: utils.generateName('dns'),
        ip_addresses: ['127.0.0.1']
      },
      nfs: {
        dns_name: utils.generateName('dns'),
        ip_addresses: ['127.0.0.1']
      },
      smb: {
        dns_name: utils.generateName('dns'),
        ip_addresses: ['127.0.0.1']
      }
    }
    // user_tags: []
  };

  var newSVM = _objectSpread(_objectSpread({}, baseData), data);
  svms.insert(newSVM);
  return newSVM;
};

/**
 * getSVMs() - gets a paginated list of storage virtual machines
 * @param {*} req
 * @param {*} res
 */
exports.addSVM = addSVM;
var getSVMs = function getSVMs(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var items = utils.getResources(req, _server.COLS.svm, extraFilter, 'created_at', {
    desc: true
  });
  items.storage_virtual_machines.forEach(function (svm) {
    return formatSVMForClient(req, svm);
  });
  res.json(items).end();
};

/**
 * createSVM() - creates a storage virtual machine
 * @param {*} req
 * @param {*} res
 */
exports.getSVMs = getSVMs;
var createSVM = function createSVM(req, res) {
  var input = req.body;
  input.region = utils.getQueryRegion(req);
  // make sure we're not creating a svm that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.svm), input, req, res, errorMsg, 'svms')) {
    return;
  }

  // add the svm
  input.status = Statuses[0];
  input.created_at = utils.generateNowDate();
  input.storage_ontap_instance = {
    id: req.params.ontap_id
  };
  var newSVM = addSVM(_server.db.getCollection(_server.COLS.svm), input);
  // return the newly added snapshot
  var items = _server.db.getCollection(_server.COLS.svm).chain().find({
    id: newSVM.id
  }).data({
    removeMeta: true
  });
  var svm = formatSVMForClient(req, items[0]);
  res.status(201).json(svm).end();
};

/**
 * deleteSVM() - deletes a storage virtual machine
 * @param {*} req
 * @param {*} res
 */
exports.createSVM = createSVM;
var deleteSVM = function deleteSVM(req, res) {
  var collection = _server.db.getCollection(_server.COLS.svm);
  var results = collection.find({
    id: req.params.svm_id
  });
  var item = results[0];
  if (!item) {
    res.status(404).end();
    return;
  }
  collection.remove(item);
  res.status(202).json(item).end();
};

/**
 * getSVM() - gets a single storage virtual machine
 * @param {*} req
 * @param {*} res
 */
exports.deleteSVM = deleteSVM;
var getSVM = function getSVM(req, res) {
  var record = getSVMRecord(req);
  if (!record) {
    res.status(404).end();
    return;
  }
  var item = formatSVMForClient(req, record);
  res.json(item).end();
};

/**
 * updateSVM() - updates a single storage virtual machine
 * @param {*} req
 * @param {*} res
 */
exports.getSVM = getSVM;
var updateSVM = function updateSVM(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.svm);
  var results = collection.find({
    id: req.params.svm_id
  });
  var itemToUpdate = results[0];
  if (!itemToUpdate || itemToUpdate.storage_ontap_instance.id !== req.params.ontap_id) {
    res.status(404).end();
    return;
  }
  var updatedSVM = _objectSpread(_objectSpread({}, itemToUpdate), input);
  collection.update(updatedSVM);
  var updatedItem = getSVMRecord(req);
  var updatedResult = formatSVMForClient(req, updatedItem);
  res.status(200).json(updatedResult).end();
};
exports.updateSVM = updateSVM;
var deleteSVMForOntap = function deleteSVMForOntap(ontapId) {
  // get the list of SVMs that are part of this ontap
  var collection = _server.db.getCollection(_server.COLS.svm);
  var allSVMs = collection.chain().data({
    removeMeta: true
  });
  var ontapSVMs = allSVMs.filter(function (svm) {
    return svm.storage_ontap_instance.id === ontapId;
  });
  ontapSVMs.forEach(function (svm) {
    // find the svm
    var results = collection.find({
      id: svm.id
    });
    var item = results[0];
    // delete it
    if (item) {
      (0, _storage_volumes.deleteVolumeForSVM)(item.id);
      collection.remove(item);
    }
  });
};

/**
 * init() - initializes the storage virtual machine model
 */
exports.deleteSVMForOntap = deleteSVMForOntap;
var init = function init() {
  _server.db.addCollection(_server.COLS.svm);
  // @NOTE: default SVM will require an ontap to exist.  default SVMs are created as part of the ontaps init
};
exports.init = init;