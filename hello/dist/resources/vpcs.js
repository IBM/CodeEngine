"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateVpc = exports.updateAddressPrefix = exports.udpateVpcDnsResolutionBindingCount = exports.init = exports.getVpcs = exports.getVpc = exports.getDnsSharedBindings = exports.getDefaultSecurityGroup = exports.getDefaultRoutingTableIdFromVpc = exports.getDefaultRoutingTable = exports.getDefaultNetworkAclIdFromVpc = exports.getDefaultNetworkACL = exports.getAddressPrefixes = exports.getAddressPrefix = exports.formatVpcForClient = exports.formatAddressPrefixForClient = exports.findVpcsUsingAcl = exports.deleteVpc = exports.deleteAddressPrefix = exports.createVpc = exports.createAddressPrefix = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var _acls = require("./acls");
var _securityGroups = require("./securityGroups");
var _routing_tables = require("./routing_tables");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
var _excluded = ["vpcs"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var VirtualPrivateCloudStatuses = ['available'];

/**
 * getPrefixName()
 *
 * Generate a unique and valid name from a CIDR.
 *
 * @param {*} cidr
 */
var getPrefixName = function getPrefixName(cidr) {
  return "prefix-".concat(cidr.replace(/[^a-zA-Z0-9]/g, '-'));
};

/**
 * findVpcsUsingAcl()
 *
 * Finds the VPCs that have been assigned with a particular Network Acl.
 *
 * @param {string} acl_id - Network ACL ID of the ACL
 */
var findVpcsUsingAcl = function findVpcsUsingAcl(acl_id) {
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().where(function (vpc) {
    return _lodash["default"].get(vpc, 'default_network_acl.id', '') === acl_id;
  }).data({
    removeMeta: true
  });
  return vpcs;
};

/**
 * getDefaultNetworkAclIdFromVpc()
 *
 * Returns the ID of the network_acl that is defined as the default
 * network acl for this vpc.
 *
 * We made this into a function, in case we decide to use links to
 * data rather than actually composing the data in our object.
 * @param {*} vpc
 */
exports.findVpcsUsingAcl = findVpcsUsingAcl;
var getDefaultNetworkAclIdFromVpc = function getDefaultNetworkAclIdFromVpc(vpc) {
  return _lodash["default"].get(vpc, 'default_network_acl.id', '');
};

/**
 * generateDefaultAclForVpc()
 *
 * Generate the default ACL for a VPC. We select a random ACL from the
 * collection of ACLs. We then filter down to ony the fields we are
 * interested in.
 */
exports.getDefaultNetworkAclIdFromVpc = getDefaultNetworkAclIdFromVpc;
var generateDefaultAclForVpc = function generateDefaultAclForVpc(vpcId, zone) {
  var acl_id = (0, _acls.addACL)(_server.db.addCollection(_server.COLS.acls), {
    zone: zone,
    vpc: {
      id: vpcId
    }
  });
  return {
    id: acl_id
  };
};

/**
 * generateDefaultSgForVpc()
 *
 * Generate the default SG for a VPC.
 *
 * For SG we currently have a catch-22 between VPC and SG with cross
 * dependency and initialization order so we are doing somethig a
 * little weird here.
 */
var generateDefaultSgForVpc = function generateDefaultSgForVpc(vpcId, zone) {
  var sg_id = (0, _securityGroups.addSecurityGroup)(_server.db.addCollection(_server.COLS.security_groups), {
    zone: zone,
    vpc: {
      id: vpcId
    }
  });
  return {
    id: sg_id
  };
};

/**
 * getDefaultRoutingTableIdFromVpc()
 *
 * Returns the ID of the routing_table that is defined as the default
 * routing_table for this vpc.
 *
 * We made this into a function, in case we decide to use links to
 * data rather than actually composing the data in our object.
 * @param {*} vpc
 */
var getDefaultRoutingTableIdFromVpc = function getDefaultRoutingTableIdFromVpc(vpc) {
  return _lodash["default"].get(vpc, 'default_routing_table.id', '');
};

/**
 * generateDefaultRoutingTbleForVpc()
 *
 * Generate the default Routing table for a VPC.
 */
exports.getDefaultRoutingTableIdFromVpc = getDefaultRoutingTableIdFromVpc;
var generateDefaultRoutingTableForVpc = function generateDefaultRoutingTableForVpc(vpcId, zone) {
  var routing_table_id = (0, _routing_tables.addRoutingTable)(_server.db.addCollection(_server.COLS.routing_tables), {
    is_default: true,
    name: 'default-routing-table-for-this-vpc',
    vpcId: vpcId,
    zone: zone
  });
  return {
    id: routing_table_id
  };
};

/**
 * addAddressPrefix()
 *
 * Creates a new address prefix with random data. The random fields are then
 * overridden with the values provided in the data object. Finally the new
 * address prefix is added to the prefix collection.
 *
 * @param {*} prefixes - reference to the prefixes collection
 * @param {string} vpcId - parent VPC ID
 * @param {*} data - data to use for address prefix creation.
 */
var addAddressPrefix = function addAddressPrefix(prefixes, vpcId, data) {
  var cidr = "".concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(0, 3) * Math.pow(2, 6), ".0/18");
  // Get the VPC sans meta
  var vpcRegionName = _lodash["default"].get(utils.findResource(_server.COLS.vpcs, vpcId, null, true), 'zone.region_name', '') || utils.DEFAULT_REGION;
  var randomZoneInVpcRegion = utils.getRandomZoneInRegion(vpcRegionName);

  // All of our REST API fields should be included here in correct field order.
  var baseData = {
    vpcId: vpcId,
    // This is not a field in RIAS!
    id: _casual["default"].uuid,
    classic_access: false,
    href: '',
    // placeholder
    name: getPrefixName(cidr),
    cidr: cidr,
    zone: {
      name: randomZoneInVpcRegion.name
    },
    created_at: utils.generateNowDate(),
    has_subnets: false,
    is_default: false
  };
  var newPrefix = _objectSpread(_objectSpread({}, baseData), data);
  prefixes.insert(newPrefix);
  return newPrefix.id;
};

/**
 * addAddressPrefixesForVpc()
 *
 * Adds address prefixes to the prefixes collection for the provided vpc_id.
 *
 * @param {string} vpc_id - id of the VPC we are adding prefixes too.
 * @param {boolean} addMockPrefixes - add additional mock prefixes.
 */
var addAddressPrefixesForVpc = function addAddressPrefixesForVpc(vpcId, addMockPrefixes) {
  var prefixes = _server.db.getCollection(_server.COLS.prefixes);

  // Find the region for the given VPC
  var vpcRegionName = _lodash["default"].get(utils.findResource(_server.COLS.vpcs, vpcId, null, true), 'zone.region_name', '') || utils.DEFAULT_REGION;
  var vpcRegion = utils.findRegion(vpcRegionName);

  // Add one Address Prefix for each zone to be default address prefix.
  vpcRegion.zones.forEach(function (item, idx) {
    var cidr = item.defaultPrefix || "10.".concat(240 + idx, ".0.0/16");
    var name = getPrefixName(cidr);
    var zone = {
      name: item.name
    };
    var is_default = true;
    var has_subnets = item.has_subnets;
    addAddressPrefix(prefixes, vpcId, {
      cidr: cidr,
      name: name,
      zone: zone,
      is_default: is_default,
      has_subnets: has_subnets
    });
  });

  // Add 0-4 additional prefixes for each zone.
  if (addMockPrefixes) {
    vpcRegion.zones.forEach(function (zoneEntry) {
      var numAdd = _casual["default"].integer(0, 4);
      for (var i = 0; i < numAdd; i++) {
        var zone = {
          name: zoneEntry.name
        };
        addAddressPrefix(prefixes, vpcId, {
          zone: zone
        });
      }
    });
  }
};

/**
 * Creates an array of Cloud Service Endpoint source addresses
 */
var getSourceIps = function getSourceIps() {
  return _toConsumableArray(Array(_casual["default"].integer(0, 5))).map(function () {
    return {
      ip: {
        address: "".concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254), ".").concat(_casual["default"].integer(1, 254))
      },
      zone: utils.getRandomZone()
    };
  });
};

/**
 * addVpc()
 * Creates a new Vpc with random data. The random fields are then overridden
 * with the values provided in the data object. Finally the new VPC is added
 * to the vpc collection.
 *
 * @param {*} vpcs - reference to the Vpc collection
 * @param {*} data - data to use for Vpc creation.
 * @param {boolean} addMockPrefixes - add mock address prefixes
 */
var addVpc = function addVpc(vpcs, data, addMockPrefixes) {
  // All of our REST API fields should be included here in correct field order.
  var id = data.id ? data.id : _casual["default"].uuid;
  var addressPrefixDefault = 'auto';
  var addressPrefixManual = 'manual';
  var randomZone = data.zone || utils.getRandomZone(); // has extra region_name

  /**
   * We need to make sure that VPCs have a zone.  Even though we are pretending that they are
   * global for right now they are really regional and we need them to respond with separate
   * VPCs based on region.
   */
  var baseData = {
    address_prefix_management: addressPrefixDefault,
    classic_access: false,
    created_at: utils.generateNowDate(),
    cse_source_ips: getSourceIps(),
    href: '',
    // placeholder
    id: id,
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    status: _casual["default"].random_element(VirtualPrivateCloudStatuses),
    zone: randomZone
  };
  var newVpc = _objectSpread(_objectSpread({}, baseData), data);
  if (!data.name) {
    newVpc.name = utils.generateName('vpc', randomZone);
  }

  // Generate attachments
  if (!data.default_network_acl) {
    newVpc.default_network_acl = generateDefaultAclForVpc(id, randomZone);
  }
  newVpc.default_security_group = generateDefaultSgForVpc(id, randomZone);
  newVpc.crn = utils.generateCRN(_objectSpread(_objectSpread({}, newVpc), {}, {
    zone: undefined,
    region: randomZone === null || randomZone === void 0 ? void 0 : randomZone.region_name
  }));
  vpcs.insert(newVpc);
  if (data.address_prefix_management !== addressPrefixManual) {
    addAddressPrefixesForVpc(newVpc.id, addMockPrefixes);
  }

  // UI-30634 Add default routing table after new VPC is created, otherwise, it will report vpc not found
  newVpc.default_routing_table = generateDefaultRoutingTableForVpc(id, randomZone);
  vpcs.update(newVpc);
  return newVpc.id;
};

/**
 * init()
 *
 * Initialize the VPC and associated Address Prefix collections.
 */
var init = function init() {
  // Regular init.
  var vpcs = _server.db.addCollection(_server.COLS.vpcs);
  _server.db.addCollection(_server.COLS.prefixes);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var defaultZone = utils.findZone(utils.getDefaultZone());
  var defaultZoneName = defaultZone === null || defaultZone === void 0 ? void 0 : defaultZone.name;

  // There can be two default VPC - also we use a fixed name and id for convenience.
  // one Hub VPC vs some Spork VPCs
  // for Hub VPC, `enable_sharing` allowing customer to decide whether to enable DNS sharing on Hub VPC.
  // When this property is set to true, the VPC must have empty `additional_permitted_vpcs`.
  addVpc(vpcs, {
    name: 'aaa-default-vpc-1',
    classic_access: true,
    id: 'vpc1001',
    dns: {
      enable_hub: true,
      resolution_binding_count: 0
    },
    resource_group: {
      id: '5018a8564e8120570150b0764d39ebcc'
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  var hubVPC = vpcs.findOne({
    id: 'vpc1001'
  });
  var hubVPCRef = _lodash["default"].pick(hubVPC, ['id', 'name', 'crn', 'href']);
  addVpc(vpcs, {
    name: 'aaa-default-vpc-2',
    classic_access: true,
    id: 'vpc1002',
    dns: {
      resolver: {
        type: 'system',
        configuration: 'default',
        servers: [{
          address: '192.168.1.4',
          zone_affinity: {
            name: defaultZoneName
          }
        }]
      }
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  addVpc(vpcs, {
    name: 'aaa-default-vpc-2-dns',
    classic_access: true,
    id: 'vpc1002-dns',
    dns: {
      resolver: {
        type: 'system',
        configuration: 'dns_services',
        servers: [{
          address: '192.168.1.4',
          zone_affinity: {
            name: defaultZoneName
          }
        }]
      }
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  addVpc(vpcs, {
    name: 'aaa-default-vpc-3',
    classic_access: true,
    id: '1111-11111111-1111-1111-1111-111111111111',
    dns: {
      resolver: {
        type: 'delegated',
        vpc: hubVPCRef,
        servers: [{
          address: '192.168.1.4',
          zone_affinity: {
            name: defaultZoneName
          }
        }]
      }
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  addVpc(vpcs, {
    name: 'aaa-default-vpc-4',
    classic_access: true,
    id: '4444-4444444-4444-4444-4444-4444444444444',
    dns: {
      resolver: {
        type: 'manual',
        manual_servers: [{
          address: '192.168.3.4'
        }]
      }
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  addVpc(vpcs, {
    name: 'aaa-default-vpc-4-zonal',
    classic_access: true,
    id: '4444-4444444-4444-4444-zonal-4444444444444',
    dns: {
      resolver: {
        type: 'manual',
        manual_servers: [{
          address: '192.168.1.4',
          zone_affinity: {
            name: defaultZoneName
          }
        }]
      }
    },
    created_at: utils.generateCreateDate(),
    zone: defaultZone
  }, true);
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    addVpc(vpcs, {
      name: "vpc_per_region_".concat(region.name),
      zone: utils.findZoneInRegion(region.name)
    }, true);
  });

  // Create some additional VPCs
  utils.repeat(function () {
    addVpc(vpcs, {
      created_at: utils.generateCreateDate()
    }, true);
  }, _features.shouldGenerateLotsOfResources ? 25 : 5);
};

/**
 * formatVpcForClient()
 *
 * Format a VPC resource object for output to the client.
 *
 * @param {*} req - the original request
 * @param {*} vpc - the VPC resource to be formatted.
 */
exports.init = init;
var formatVpcForClient = function formatVpcForClient(req, vpc) {
  var _vpc$dns, _vpc$dns$resolver;
  // Vpc href
  vpc.href = "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(vpc.id);

  // Acl Resource Ref
  var acl_id = _lodash["default"].get(vpc, 'default_network_acl.id', '');
  if (acl_id) {
    vpc.default_network_acl = utils.getAndFormatResourceLinkForClient(req, _server.COLS.acls, acl_id);
  }

  // Routing Table Ref
  var routing_table_id = _lodash["default"].get(vpc, 'default_routing_table.id', '');
  if (routing_table_id) {
    vpc.default_routing_table = utils.getAndFormatResourceLinkForClient(req, _server.COLS.routing_tables, routing_table_id);
  }

  // SG Resource Ref
  var sg_id = _lodash["default"].get(vpc, 'default_security_group.id', '');
  if (sg_id) {
    vpc.default_security_group = utils.getAndFormatResourceLinkForClient(req, _server.COLS.security_groups, sg_id);
  }
  if ((vpc === null || vpc === void 0 ? void 0 : (_vpc$dns = vpc.dns) === null || _vpc$dns === void 0 ? void 0 : (_vpc$dns$resolver = _vpc$dns.resolver) === null || _vpc$dns$resolver === void 0 ? void 0 : _vpc$dns$resolver.type) === 'system') {
    var _utils$getRandomZoneI;
    var vpcRegionName = _lodash["default"].get(vpc, 'zone.region_name', '') || utils.DEFAULT_REGION;
    vpc.dns.resolver.configuration = _casual["default"].random_element(['dns_services', 'system']);
    vpc.dns.resolver.servers = [{
      address: '192.168.3.4',
      zone_affinity: (_utils$getRandomZoneI = utils.getRandomZoneInRegion(vpcRegionName)) === null || _utils$getRandomZoneI === void 0 ? void 0 : _utils$getRandomZoneI.name
    }];
  }
  delete vpc.address_prefix_management;
};

/**
 * formatAddressPrefixForClient()
 *
 * Format an Address Prefix for output to the client.
 * @param {*} req - the original request
 * @param {*} prefix - the address prefix to be formatted.
 */
exports.formatVpcForClient = formatVpcForClient;
var formatAddressPrefixForClient = function formatAddressPrefixForClient(req, prefix) {
  prefix.href = "".concat(utils.getBaseApiUrl(req), "vpcs/").concat(prefix.vpcId, "/address_prefixes/").concat(prefix.id);
  delete prefix.vpcId;
};

/*
 * The function filters on extra query parameter classic_access.
 * We need to add it  s extra filters on the where clause when getting
 * the list of vpcs
 */
exports.formatAddressPrefixForClient = formatAddressPrefixForClient;
var filterByClassic = function filterByClassic(req, res, resource) {
  if ('classic_access' in req.query) {
    if (resource.classic_access === JSON.parse(req.query.classic_access.toLowerCase())) {
      return true;
    }
    return false;
  }

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var filterByHubVPC = function filterByHubVPC(hubVpcId, resource) {
  var _resource$dns, _resource$dns$additio, _resource$dns$additio2;
  if ((resource === null || resource === void 0 ? void 0 : (_resource$dns = resource.dns) === null || _resource$dns === void 0 ? void 0 : (_resource$dns$additio = _resource$dns.additional_permitted_vpcs) === null || _resource$dns$additio === void 0 ? void 0 : (_resource$dns$additio2 = _resource$dns$additio[0]) === null || _resource$dns$additio2 === void 0 ? void 0 : _resource$dns$additio2.id) === hubVpcId) {
    return true;
  }
  return false;
};

/**
 * getVpcs()
 *
 * Get a list of all the VPCs.
 *
 * @param {*} req
 * @param {*} res
 */
var getVpcs = function getVpcs(req, res) {
  var vpcs = utils.getResources(req, _server.COLS.vpcs, function (resource) {
    return filterByClassic(req, res, resource);
  });
  vpcs.vpcs.forEach(function (vpc) {
    return formatVpcForClient(req, vpc);
  });
  utils.delayRegionTimeout(function () {
    res.json(vpcs).end();
  }, utils.isRegionTimeoutForPath(req));
};

/**
 * getVpc()
 *
 * Get a specific VPC.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getVpcs = getVpcs;
var getVpc = function getVpc(req, res) {
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().find({
    id: req.params.vpc_id
  }).data({
    removeMeta: true
  });
  if (!vpcs || vpcs.length === 0) {
    res.status(404).end();
    return;
  }
  var vpc = vpcs[0];
  formatVpcForClient(req, vpc);
  res.json(vpc).end();
};
exports.getVpc = getVpc;
var getDnsSharedBindings = function getDnsSharedBindings(req, res) {
  var hubVpcId = req.params.vpc_id;
  var vpcsSchema = utils.getResources(req, _server.COLS.vpcs, function (resource) {
    return filterByHubVPC(hubVpcId, resource);
  });
  var vpcs = vpcsSchema.vpcs,
    vpcListSchema = _objectWithoutProperties(vpcsSchema, _excluded);
  var dnsSharedBindingVpcs = vpcs.map(function (vpc) {
    formatVpcForClient(req, vpc);
    return _lodash["default"].pick(vpc, 'id', 'name', 'crn', 'href', 'resource_type');
  });
  var dnsSharedBindings = _objectSpread(_objectSpread({}, vpcListSchema), {}, {
    dns_shared_bindings: dnsSharedBindingVpcs
  });
  utils.delayRegionTimeout(function () {
    res.json(dnsSharedBindings).end();
  }, utils.isRegionTimeoutForPath(req));
};

/**
 * deleteVpc()
 * Delete a specific VPC.
 * @param {*} req
 * @param {*} res
 */
exports.getDnsSharedBindings = getDnsSharedBindings;
var deleteVpc = function deleteVpc(req, res) {
  var vpcCol = _server.db.getCollection(_server.COLS.vpcs);
  var vpc = vpcCol.findOne({
    id: req.params.vpc_id
  });
  if (!vpc) {
    res.status(404).end();
    return;
  }
  var drs = _server.db.getCollection(_server.COLS.dynamic_route_servers).chain().find().where(function (obj) {
    var _obj$vpc;
    return ((_obj$vpc = obj.vpc) === null || _obj$vpc === void 0 ? void 0 : _obj$vpc.id) === req.params.vpc_id;
  }).data({
    removeMeta: true
  });
  if ((drs === null || drs === void 0 ? void 0 : drs.length) > 0) {
    res.status(400).json((0, utils.generateErrors)('vpc is being used by 1 or more dynamic route servers', 409, 'drs_in_use')).end();
    return;
  }

  // Check if this VPC has any attached subnets
  // to-do

  // Attempt to delete the routing tables
  if (!(0, _routing_tables.deleteRoutingTablesInVpc)(vpc.id, res)) {
    return;
  }
  vpcCol.remove(vpc);
  res.status(204).end();
};

/**
 * createVpc()
 *
 * Create a new VPC.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteVpc = deleteVpc;
var createVpc = function createVpc(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.vpcs), input, req, res, 'resource with that name already exists', 'vpc')) {
    return;
  }
  if (utils.resourceGroupCheck(input, res)) {
    return;
  }

  /*
   * We need to set the correct zone based on the endpoint this request came to.
   */
  input.zone = utils.findZoneInRegion(utils.getQueryRegion(req));
  var id = addVpc(_server.db.getCollection(_server.COLS.vpcs), input, false);
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var vpc = vpcs[0];
  formatVpcForClient(req, vpc);
  res.status(201).json(vpc).end();
};

/**
 * updateVpc()
 *
 * Update the data in an existing VPC.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createVpc = createVpc;
var updateVpc = function updateVpc(req, res) {
  var newVpcData = req.body;
  var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
  var origVpc = vpcCols.findOne({
    id: req.params.vpc_id
  });

  // Verify that it exists
  if (!origVpc) {
    res.status(404).end();
    return;
  }

  // Update the entry
  if (newVpcData.dns) {
    newVpcData.dns = _objectSpread(_objectSpread({}, origVpc === null || origVpc === void 0 ? void 0 : origVpc.dns), newVpcData.dns);
  }
  var updatedVpc = _objectSpread(_objectSpread({}, origVpc), newVpcData);
  vpcCols.update(updatedVpc);

  // Retreive the latest version
  var resultVpcs = vpcCols.chain().find({
    id: updatedVpc.id
  }, true).data({
    removeMeta: true
  });
  res.status(200).json(resultVpcs[0]).end();
};
exports.updateVpc = updateVpc;
var udpateVpcDnsResolutionBindingCount = function udpateVpcDnsResolutionBindingCount(vpcId, resolutionBindingCountChange) {
  var vpcCols = _server.db.getCollection(_server.COLS.vpcs);
  var origVpc = vpcCols.findOne({
    id: vpcId
  });
  // Update the entry
  if (origVpc !== null && origVpc !== void 0 && origVpc.dns) {
    var oldCount = origVpc.dns.resolution_binding_count || 0;
    var newCount = oldCount + resolutionBindingCountChange;
    origVpc.dns = _objectSpread(_objectSpread({}, origVpc === null || origVpc === void 0 ? void 0 : origVpc.dns), {}, {
      resolution_binding_count: newCount < 0 ? 0 : newCount
    });
  } else {
    origVpc.dns = {
      resolution_binding_count: resolutionBindingCountChange < 0 ? 0 : 1
    };
  }
  vpcCols.update(origVpc);
};

/**
 * getAddressPrefixes()
 *
 * Retrieve the list of Address Prefixes for a specific VPC.
 *
 * @param {*} req
 * @param {*} res
 */
exports.udpateVpcDnsResolutionBindingCount = udpateVpcDnsResolutionBindingCount;
var getAddressPrefixes = function getAddressPrefixes(req, res) {
  var region = utils.getQueryRegion(req);
  var limit = Number.parseInt(utils.getQueryParam(req.query, 'limit', 10), 10);
  var offset = Number.parseInt(utils.getQueryParam(req.query, 'start', 0), 10);
  var next = offset + limit;
  var prefixCol = _server.db.getCollection(_server.COLS.prefixes);
  var address_prefixes = prefixCol.chain().find({
    vpcId: req.params.vpc_id
  }).where(function (prefix) {
    var zoneName = _lodash["default"].get(prefix, 'zone.name', '');
    return zoneName.includes(region);
  }).simplesort('name').offset(offset).limit(limit).data({
    removeMeta: true
  });
  address_prefixes.forEach(function (prefix) {
    return formatAddressPrefixForClient(req, prefix);
  });
  var addressPrefixes = {
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    },
    address_prefixes: address_prefixes
  };
  if (next >= address_prefixes.length) {
    delete addressPrefixes.next;
  }
  res.json(addressPrefixes).end();
};

/**
 * getAddressPrefix()
 *
 * Retrieve a specific Address Prefix providing the vpc_id and prefix_id.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getAddressPrefixes = getAddressPrefixes;
var getAddressPrefix = function getAddressPrefix(req, res) {
  var addressPrefixes = _server.db.getCollection(_server.COLS.prefixes).chain().find({
    vpcId: req.params.vpc_id,
    id: req.params.prefix_id
  }).data({
    removeMeta: true
  });
  if (addressPrefixes.length === 0) {
    res.status(404).end();
    return;
  }
  var prefix = addressPrefixes[0];
  formatAddressPrefixForClient(req, prefix);
  res.json(prefix).end();
};

/**
 * updateAddressPrefix()
 *
 * Updates the Address Prefix whose vpc_id and prefix_id was provided.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getAddressPrefix = getAddressPrefix;
var updateAddressPrefix = function updateAddressPrefix(req, res) {
  var input = req.body;
  var prefixesCol = _server.db.getCollection(_server.COLS.prefixes);
  var prefixes = prefixesCol.find({
    id: req.params.prefix_id
  });
  if (!prefixes || prefixes.length === 0) {
    res.status(404).end();
    return;
  }
  var prefix = prefixes[0];
  var newPrefix = _objectSpread(_objectSpread({}, prefix), input);
  prefixesCol.update(newPrefix);
  var updatedPrefix = _server.db.getCollection(_server.COLS.prefixes).chain().find({
    id: req.params.prefix_id
  }).data({
    removeMeta: true
  });
  updatedPrefix[0].href = "".concat(utils.getBaseUrl(req), "/").concat(prefix.id);
  res.status(200).json(updatedPrefix[0]).end();
};

/**
 * createAddressPrefix()
 *
 * Create a new Address Prefix attached to the VPC whose vpc_id is
 * provided.
 *
 * @param {*} req
 * @param {*} res
 */
exports.updateAddressPrefix = updateAddressPrefix;
var createAddressPrefix = function createAddressPrefix(req, res) {
  var input = req.body;
  var vpc_id = req.params.vpc_id;
  var prefixesCol = _server.db.getCollection(_server.COLS.prefixes);

  // We are not doing a duplicate name check here.

  var id = addAddressPrefix(prefixesCol, vpc_id, input);
  var prefixes = prefixesCol.chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var prefix = prefixes[0];
  prefix.href = "".concat(utils.getBaseUrl(req), "/").concat(prefix.id);
  res.status(201).json(prefix).end();
};

/**
 * deleteAddressPrefix()
 *
 * Deletes the Address Prefix whose prefix_id was provided.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createAddressPrefix = createAddressPrefix;
var deleteAddressPrefix = function deleteAddressPrefix(req, res) {
  var prefixesCol = _server.db.getCollection(_server.COLS.prefixes);
  var prefix = prefixesCol.findOne({
    id: req.params.prefix_id
  });
  if (!prefix) {
    res.status(404).end();
    return;
  }
  prefixesCol.remove(prefix);
  res.status(204).end();
};

/**
 * getDefaultNetworkACL()
 * GET /vpcs/{vpc_id}/default_network_acl
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteAddressPrefix = deleteAddressPrefix;
var getDefaultNetworkACL = function getDefaultNetworkACL(req, res) {
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) return;
  var defaultACL = vpc.default_network_acl;
  var acl = utils.findResource(_server.COLS.acls, defaultACL.id, res, false);
  if (!acl) return;
  (0, _acls.formatNetworkAclForClient)(req, acl);
  res.status(200).json(acl).end();
};

/**
 * getDefaultSecurityGroup()
 * GET /vpcs/{vpc_id}/default_security_group
 *
 * This request retrieves the default security group for the VPC specified by the identifier in the URL.
 * The default security group is applied to any new network interfaces in the VPC which do not specify a security group.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDefaultNetworkACL = getDefaultNetworkACL;
var getDefaultSecurityGroup = function getDefaultSecurityGroup(req, res) {
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) return;
  var defaultSG = utils.findResource(_server.COLS.security_groups, vpc.default_security_group.id, res, false);
  if (!defaultSG) return;
  (0, _securityGroups.formatSecurityGroupForClient)(req, res, defaultSG);
  res.status(200).json(defaultSG).end();
};

/**
 * getDefaultRoutingTable()
 * GET /vpcs/{vpc_id}/default_routing_table
 *
 * This request retrieves the default routing table for the VPC specified by the identifier in the URL.
 * The default routing table is applied to any new subnet in the VPC which do not specify a routing table.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getDefaultSecurityGroup = getDefaultSecurityGroup;
var getDefaultRoutingTable = function getDefaultRoutingTable(req, res) {
  var vpc = utils.findResource(_server.COLS.vpcs, req.params.vpc_id, res, false);
  if (!vpc) return;
  var default_routing_table = utils.findResource(_server.COLS.routing_tables, vpc.default_routing_table.id, res, false);
  if (!default_routing_table) return;
  res.status(200).json((0, _routing_tables.formatRoutingTableForClient)(default_routing_table, req)).end();
};
exports.getDefaultRoutingTable = getDefaultRoutingTable;