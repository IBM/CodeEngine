"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateInstance = exports.init = exports.getInstances = exports.getInstance = exports.formatInstanceForClient = exports.deleteInstance = exports.createInstance = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = require("lodash");
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _keyprotect = require("../../external/resources/keyprotect");
var _storage_virtual_machines = require("./storage_virtual_machines");
var _subnets = require("../subnets");
var _routing_tables = require("../routing_tables");
var _securityGroups = require("../securityGroups");
var _features = require("../features");
var _excluded = ["active_directory_configuration"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
// Constants

// const Statuses = [ 'available', 'failed', 'pending', 'pending_deletion', 'updating'];
// @NOTE: currently only using available and pending statuses to make it easier to edit/delete/use
var Statuses = ['available', 'pending'];

// const filter = (req, res, resource) => {
var filter = function filter() {
  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var formatInstanceForClient = function formatInstanceForClient(req, instance) {
  // update the href according to the request
  instance.href = "".concat(utils.getBaseApiUrl(req), "storage_ontap_instances/").concat(instance.id);
  instance.crn = utils.updateResourceCrnRegion(instance, req);

  // remove the `ontap_configuration.default_svm_configuration.active_directory_configuration` from the resource
  var _instance$ontap_confi = instance.ontap_configuration.default_svm_configuration,
    active_directory_configuration = _instance$ontap_confi.active_directory_configuration,
    default_svm_configuration = _objectWithoutProperties(_instance$ontap_confi, _excluded);
  instance.ontap_configuration.default_svm_configuration = default_svm_configuration;

  // @NOTE: current API spec only has ID for preferred subnet.  May need to be a reference later
  var preferred_subnet = utils.getResource(_server.COLS.subnets, instance.ontap_configuration.preferred_subnet.id)[0];
  instance.ontap_configuration.preferred_subnet = utils.getResourceReference(preferred_subnet);

  // generate the ontap_configurations.route_table references
  var route_tables = (0, _lodash.get)(instance, 'ontap_configuration.route_table', []).map(function (_ref) {
    var id = _ref.id;
    var item = utils.getResource(_server.COLS.routing_tables, id)[0];
    return utils.getResourceReference(item);
  });
  instance.ontap_configuration.route_table = route_tables;

  // generate the security groups references
  var security_groups = (0, _lodash.get)(instance, 'ontap_configuration.security_groups', []).map(function (sg) {
    var item = utils.getResource(_server.COLS.security_groups, sg.id)[0];
    return utils.getResourceReference(item);
  });
  instance.ontap_configuration.security_groups = security_groups;

  // @NOTE: current API spec only has ID for standby subnet.  May need to be a reference later
  var standby_subnet = utils.getResource(_server.COLS.subnets, instance.ontap_configuration.standby_subnet.id)[0];
  instance.ontap_configuration.standby_subnet = utils.getResourceReference(standby_subnet);

  // generate the VPC reference
  var vpc = utils.getResource(_server.COLS.vpcs, instance.vpc.id)[0];
  instance.vpc = utils.getResourceReference(vpc);
  delete instance.svmId;
  delete instance.region;
  delete instance.ontap_configuration.default_svm_configuration.active_directory;

  // generate the ontap_configuration.default_svm_configuration SVM reference
  var svmId = (0, _lodash.get)(instance, 'ontap_configuration.default_svm_configuration.id');
  if (svmId) {
    var svm = utils.getResource(_server.COLS.svm, svmId);
    var formattedSVM = (0, _storage_virtual_machines.formatSVMForClient)(req, svm);
    instance.ontap_configuration.default_svm_configuration.href = formattedSVM.href;
    instance.ontap_configuration.default_svm_configuration.resource_type = 'storage_ontap_instance_storage_virtual_machine';
  }
  return instance;
};
exports.formatInstanceForClient = formatInstanceForClient;
var getInstanceRecord = function getInstanceRecord(req) {
  var removeMeta = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var instances = _server.db.getCollection(_server.COLS.ontap_instances).chain().find({
    id: req.params.ontap_id,
    region: utils.getQueryRegion(req)
  }).data({
    removeMeta: removeMeta
  });
  if (!instances || instances.length === 0) {
    return undefined;
  }
  return instances[0];
};
var SECURITY_STYLES = ['mixed', 'nfs', 'unix'];
var DEPLOYMENT_TYPES = ['single_zone', 'multi_zone'];
var MIN_CAPACITY = 1;
var MAX_CAPACITY = 192;
var addInstance = function addInstance(instances, data) {
  var _getRootKey, _getRootKey2, _getRootKey3, _data$encryption_key, _data$vpc, _data$ontap_configura, _data$ontap_configura2, _data$ontap_configura3, _data$ontap_configura4, _data$ontap_configura5, _data$ontap_configura6, _data$ontap_configura7, _data$ontap_configura8, _vpc, _preferredSubnet, _standbySubnet;
  var baseData = {
    capacity: _casual["default"].integer(MIN_CAPACITY, MAX_CAPACITY),
    created_at: utils.generateCreateDate(),
    crn: utils.generateCRN(),
    encryption: 'provider_managed',
    href: '',
    id: _casual["default"].uuid,
    name: utils.generateName('ss-ontap'),
    ontap_configuration: {
      default_svm_configuration: {
        active_directory: {
          net_bios_name: _casual["default"].word,
          active_directory_configuration: {
            dns_ips: [],
            domain_name: "".concat(_casual["default"].word, ".").concat(_casual["default"].domain),
            encrypted_ad_domain_password: 'mock-encrypted-ad-domain-password',
            // pragma: allowlist secret
            encrypted_ad_domain_password_key_crn: {
              crn: (_getRootKey = (0, _keyprotect.getRootKey)({
                region_name: 'us-east'
              })) === null || _getRootKey === void 0 ? void 0 : _getRootKey.crn
            },
            organizational_unit_distinguished_name: _casual["default"].word,
            storage_ontap_instance_administrators_group: _casual["default"].word,
            user_name: _casual["default"].word
          }
        },
        encrypted_svm_admin_password: 'mock-encrypted-svm-admin-password',
        // pragma: allowlist secret
        encrypted_svm_admin_password_key_crn: {
          crn: (_getRootKey2 = (0, _keyprotect.getRootKey)({
            region_name: 'us-east'
          })) === null || _getRootKey2 === void 0 ? void 0 : _getRootKey2.crn
        },
        name: utils.generateName('default-svm-config'),
        security_style: SECURITY_STYLES[0]
      },
      deployment_type: DEPLOYMENT_TYPES[0],
      encryption_cluster_admin_password: 'mock-encryption-cluster-admin-password',
      // pragma: allowlist secret
      encryption_cluster_admin_password_key_crn: {
        crn: (_getRootKey3 = (0, _keyprotect.getRootKey)({
          region_name: 'us-east'
        })) === null || _getRootKey3 === void 0 ? void 0 : _getRootKey3.crn
      },
      preferred_subnet: {
        id: 'subnet-1'
      },
      route_table: [{
        id: 'route-table-1'
      }],
      security_groups: [{
        id: 'security-group-1001'
      }],
      standby_subnet: {
        id: 'subnet-3'
      },
      storage_ontap_instance_endpoints: {
        inter_cluster: {
          dns_name: utils.generateName('dns'),
          ip_addresses: []
        },
        management: {
          dns_name: utils.generateName('dns'),
          ip_addresses: []
        }
      },
      virtual_endpoint_ip_address_range: '192.168.3.0/24',
      weekly_maintenance_start_time: '2023-03-29T00:00:00Z'
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    status: Statuses[0],
    status_reasons: [],
    user_tags: [],
    vpc: {
      id: 'vpc1001'
    }
  };
  if ((_data$encryption_key = data.encryption_key) !== null && _data$encryption_key !== void 0 && _data$encryption_key.crn) {
    data.encryption = 'user_managed';
  }
  var newInstance = _objectSpread(_objectSpread({}, baseData), data);

  // Override baseData with defaults for related resources, or ensure inputs have resources
  var vpc = utils.getRandomResourceInRegion(_server.COLS.vpc, data.region);
  if (data !== null && data !== void 0 && (_data$vpc = data.vpc) !== null && _data$vpc !== void 0 && _data$vpc.id) {
    vpc = utils.getResource(_server.COLS.vpcs, data.vpc.id)[0];
  }
  var subnetsForVPC = (0, _subnets.getSubnetsForVpc)(vpc.id);
  var preferredSubnet = _casual["default"].random_element(subnetsForVPC);
  if (data !== null && data !== void 0 && (_data$ontap_configura = data.ontap_configuration) !== null && _data$ontap_configura !== void 0 && (_data$ontap_configura2 = _data$ontap_configura.preferred_subnet) !== null && _data$ontap_configura2 !== void 0 && _data$ontap_configura2.id) {
    preferredSubnet = utils.getResource(_server.COLS.subnets, data.ontap_configuration.preferred_subnet.id)[0];
  }
  var standbySubnet = _casual["default"].random_element(subnetsForVPC);
  if (data !== null && data !== void 0 && (_data$ontap_configura3 = data.ontap_configuration) !== null && _data$ontap_configura3 !== void 0 && (_data$ontap_configura4 = _data$ontap_configura3.standby_subnet) !== null && _data$ontap_configura4 !== void 0 && _data$ontap_configura4.id) {
    standbySubnet = utils.getResource(_server.COLS.subnets, data.ontap_configuration.standby_subnet.id)[0];
  }
  var routingTablesForVPC = (0, _routing_tables.getRoutingTablesForVpc)(vpc.id);
  var defaultRoutingTable = _casual["default"].random_element(routingTablesForVPC);
  var route_table = defaultRoutingTable ? [{
    id: defaultRoutingTable.id
  }] : [];
  if ((data === null || data === void 0 ? void 0 : (_data$ontap_configura5 = data.ontap_configuration) === null || _data$ontap_configura5 === void 0 ? void 0 : (_data$ontap_configura6 = _data$ontap_configura5.route_table) === null || _data$ontap_configura6 === void 0 ? void 0 : _data$ontap_configura6.length) > 0) {
    route_table = data.ontap_configuration.route_table.map(function (table) {
      var item = utils.getResource(_server.COLS.routing_tables, table.id)[0];
      return {
        id: item.id
      };
    });
  }
  var securityGroupsForVPC = (0, _securityGroups.getSecurityGroupsForVpc)(vpc.id);
  var defaultSecurityGroup = _casual["default"].random_element(securityGroupsForVPC);
  var security_groups = defaultSecurityGroup ? [{
    id: defaultSecurityGroup.id
  }] : [];
  if ((data === null || data === void 0 ? void 0 : (_data$ontap_configura7 = data.ontap_configuration) === null || _data$ontap_configura7 === void 0 ? void 0 : (_data$ontap_configura8 = _data$ontap_configura7.security_groups) === null || _data$ontap_configura8 === void 0 ? void 0 : _data$ontap_configura8.length) > 0) {
    security_groups = data.ontap_configuration.security_groups.map(function (sg) {
      var item = utils.getResource(_server.COLS.security_groups, sg.id)[0];
      return {
        id: item.id
      };
    });
  }
  newInstance.vpc = {
    id: (_vpc = vpc) === null || _vpc === void 0 ? void 0 : _vpc.id
  };
  newInstance.ontap_configuration.preferred_subnet = {
    id: (_preferredSubnet = preferredSubnet) === null || _preferredSubnet === void 0 ? void 0 : _preferredSubnet.id
  };
  newInstance.ontap_configuration.standby_subnet = {
    id: (_standbySubnet = standbySubnet) === null || _standbySubnet === void 0 ? void 0 : _standbySubnet.id
  };
  newInstance.ontap_configuration.route_table = route_table;
  newInstance.ontap_configuration.security_groups = security_groups;
  var default_svm_input = _objectSpread(_objectSpread({}, newInstance.ontap_configuration.default_svm_configuration), {}, {
    resource_group: newInstance.resource_group,
    storage_ontap_instance: {
      id: newInstance.id
    }
  });
  if (data.svmId) {
    default_svm_input.id = data.svmId;
  }
  var addedSVM = (0, _storage_virtual_machines.addSVM)(_server.db.getCollection(_server.COLS.svm), default_svm_input);
  newInstance.ontap_configuration.default_svm_configuration.id = addedSVM.id;
  instances.insert(newInstance);
  return newInstance;
};

/**
 * getInstances() - gets a paginated list of ontap instances
 * @param {*} req
 * @param {*} res
 */
var getInstances = function getInstances(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var items = utils.getResources(req, _server.COLS.ontap_instances, extraFilter, 'created_at', {
    desc: true
  });
  items.storage_ontap_instances.forEach(function (ontap) {
    return formatInstanceForClient(req, ontap);
  });
  res.json(items).end();
};

/**
 * createInstance() - creates an ontap instance
 * @param {*} req
 * @param {*} res
 */
exports.getInstances = getInstances;
var createInstance = function createInstance(req, res) {
  var input = req.body;
  input.region = utils.getQueryRegion(req);
  // make sure we're not creating a policy that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.ontap_instances), input, req, res, errorMsg, 'ontaps')) {
    return;
  }

  // add the instance
  input.status = Statuses[0];
  input.created_at = utils.generateNowDate();
  var newInstance = addInstance(_server.db.getCollection(_server.COLS.ontap_instances), input);
  // return the newly added instance
  var items = _server.db.getCollection(_server.COLS.ontap_instances).chain().find({
    id: newInstance.id
  }).data({
    removeMeta: true
  });
  var instance = formatInstanceForClient(req, items[0]);
  res.status(201).json(instance).end();
};

/**
 * deleteInstance() - deletes an ontap FS
 * @param {*} req
 * @param {*} res
 */
exports.createInstance = createInstance;
var deleteInstance = function deleteInstance(req, res) {
  var collection = _server.db.getCollection(_server.COLS.ontap_instances);
  var results = collection.find({
    id: req.params.ontap_id
  });
  var item = results[0];
  if (!item) {
    res.status(404).end();
    return;
  }
  (0, _storage_virtual_machines.deleteSVMForOntap)(item.id);
  collection.remove(item);
  res.status(204).json(item).end();
};

/**
 * getInstance() - gets a single ontap FS
 * @param {*} req
 * @param {*} res
 */
exports.deleteInstance = deleteInstance;
var getInstance = function getInstance(req, res) {
  var record = getInstanceRecord(req);
  if (!record) {
    res.status(404).end();
    return;
  }
  var item = formatInstanceForClient(req, record);
  res.json(item).end();
};

/**
 * updateInstance() - updates a single ontap FS
 * @param {*} req
 * @param {*} res
 */
exports.getInstance = getInstance;
var updateInstance = function updateInstance(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.ontap_instances);
  var results = collection.find({
    id: req.params.ontap_id
  });
  var itemToUpdate = results[0];
  if (!itemToUpdate) {
    res.status(404).end();
    return;
  }
  var updatedOntap = _objectSpread(_objectSpread({}, itemToUpdate), input);
  collection.update(updatedOntap);
  var updatedItem = getInstanceRecord(req);
  var updatedResult = formatInstanceForClient(req, updatedItem);
  res.status(200).json(updatedResult).end();
};

/**
 * init() - initializes the ontaps model
 */
exports.updateInstance = updateInstance;
var init = function init() {
  var instances = _server.db.addCollection(_server.COLS.ontap_instances);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var default_instance = {
    id: 'ontap-1001',
    name: 'aaa-default-ontap-1',
    region: 'us-east',
    status: Statuses[0],
    vpc: {
      id: 'vpc1001'
    },
    svmId: 'svm-1001'
  };
  addInstance(instances, default_instance);
};
exports.init = init;