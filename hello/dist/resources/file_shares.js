"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateFileShareMountTarget = exports.updateFileShare = exports.init = exports.getShareProfiles = exports.getShareProfile = exports.getFileShares = exports.getFileShareMountTargets = exports.getFileShareMountTarget = exports.getFileShareFromDB = exports.getFileShare = exports.formatFileShareForClient = exports.failover = exports.deleteFileShareReplicationRelationship = exports.deleteFileShareMountTarget = exports.deleteFileShare = exports.createFileShareMountTarget = exports.createFileShare = exports.addFileShare = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _virtual_network_interfaces = require("./virtual_network_interfaces");
var _features = require("./features");
var _excluded = ["access_control_mode", "encryption", "encryption_key", "replica_share", "source_share", "mount_targets", "zone"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var profileData = require('./file_share_profiles.json');

// Constants
var DEFAULT_NUMBER_OF_FILE_SHARES = 7;
var casual = require('casual');
var lodash = require('lodash');
var FileShareStatuses = ['deleted', 'deleting', 'pending', 'stable', 'suspended', 'updating', 'waiting'];
var FILE_SHARE_REPLICATION_ROLES = {
  NONE: 'none',
  REPLICA: 'replica',
  SOURCE: 'source'
};
var ENCRYPTION_IN_TRANSIT_MODES = {
  NONE: 'none',
  USER_MANAGED: 'user_managed'
};
var ACCESS_CONTROL_MODES = {
  SECURITY_GROUP: 'security_group',
  VPC: 'vpc'
};
var generateMountTarget = function generateMountTarget() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var inputId = data.id,
    name = data.name,
    shareZoneName = data.shareZoneName,
    transit_encryption = data.transit_encryption,
    vpc = data.vpc,
    virtual_network_interface = data.virtual_network_interface;
  var id = inputId || casual.uuid;
  var href = ''; // determined by formatFileShareForClient()
  var inputName = name || utils.generateName('share_target');
  var created_at = utils.generateCreateDate();
  var lifecycle_state = FileShareStatuses[3]; // the state should be fixed when ip is valid
  var encryptionInTransit = transit_encryption || ENCRYPTION_IN_TRANSIT_MODES.NONE;
  var accessControlMode = ACCESS_CONTROL_MODES.VPC;
  var virtualNetworkInterface;
  var inputVpc;
  if (vpc) {
    inputVpc = utils.findResource(_server.COLS.vpcs, vpc === null || vpc === void 0 ? void 0 : vpc.id);
  } else if (virtual_network_interface) {
    var _virtual_network_inte, _virtual_network_inte2, _primaryIpData2, _primaryIpData2$zone, _primaryIpData3, _primaryIpData3$zone, _subnetData, _subnetData$zone;
    var primaryIpId = virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : (_virtual_network_inte = virtual_network_interface.primary_ip) === null || _virtual_network_inte === void 0 ? void 0 : _virtual_network_inte.id;
    var subnetId = virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : (_virtual_network_inte2 = virtual_network_interface.subnet) === null || _virtual_network_inte2 === void 0 ? void 0 : _virtual_network_inte2.id;
    if (!primaryIpId && !subnetId) {
      throw new Error('generateMountTarget: An existing primary_ip or subnet must' + ' be specified when creating a VNI based mount target.' + 'The current implementation only supports the id field.');
    }
    var subnetData;
    var primaryIpData;
    if (subnetId && primaryIpId) {
      var _utils$getResource;
      primaryIpData = (_utils$getResource = utils.getResource(_server.COLS.reserved_private_ips, primaryIpId)) === null || _utils$getResource === void 0 ? void 0 : _utils$getResource[0];
      subnetData = utils.getResource(_server.COLS.subnets, subnetId)[0];
    } else if (subnetId) {
      // let the virtual_network_interfaces code handle getting a random IP
      primaryIpData = null;
      subnetData = utils.getResource(_server.COLS.subnets, subnetId)[0];
    } else if (primaryIpId) {
      var _utils$getResource2, _primaryIpData;
      primaryIpData = (_utils$getResource2 = utils.getResource(_server.COLS.reserved_private_ips, primaryIpId)) === null || _utils$getResource2 === void 0 ? void 0 : _utils$getResource2[0];
      subnetData = utils.getResource(_server.COLS.subnets, (_primaryIpData = primaryIpData) === null || _primaryIpData === void 0 ? void 0 : _primaryIpData.subnetId)[0];
    }
    if (!subnetData) {
      throw new Error("generateMountTarget: Could not find the subnet with id: ".concat(subnetId));
    }
    if ((_primaryIpData2 = primaryIpData) !== null && _primaryIpData2 !== void 0 && (_primaryIpData2$zone = _primaryIpData2.zone) !== null && _primaryIpData2$zone !== void 0 && _primaryIpData2$zone.name && shareZoneName !== ((_primaryIpData3 = primaryIpData) === null || _primaryIpData3 === void 0 ? void 0 : (_primaryIpData3$zone = _primaryIpData3.zone) === null || _primaryIpData3$zone === void 0 ? void 0 : _primaryIpData3$zone.name)) {
      throw new Error("generateMountTarget: The specified primary IP, ".concat(primaryIpId, " is not in the same zone as the file share."));
    }
    if (shareZoneName !== ((_subnetData = subnetData) === null || _subnetData === void 0 ? void 0 : (_subnetData$zone = _subnetData.zone) === null || _subnetData$zone === void 0 ? void 0 : _subnetData$zone.name)) {
      throw new Error("generateMountTarget: The specified subnet, ".concat(subnetId, ", is not in the same zone as the file share."));
    }
    accessControlMode = ACCESS_CONTROL_MODES.SECURITY_GROUP;
    inputVpc = _server.db.addCollection(_server.COLS.vpcs).chain().where(function (resource) {
      var _virtual_network_inte3, _virtual_network_inte4;
      return (resource === null || resource === void 0 ? void 0 : resource.id) === (virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : (_virtual_network_inte3 = virtual_network_interface.subnet) === null || _virtual_network_inte3 === void 0 ? void 0 : (_virtual_network_inte4 = _virtual_network_inte3.vpc) === null || _virtual_network_inte4 === void 0 ? void 0 : _virtual_network_inte4.id);
    }).data({
      removeMeta: true
    })[0];
    virtualNetworkInterface = (0, _virtual_network_interfaces.addVNI)(_server.db.getCollection(_server.COLS.virtual_network_interfaces), {
      primary_ip: virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : virtual_network_interface.primary_ip,
      // Share mount targets do not support IP spoofing and disabling infrastructure NAT
      allow_ip_spoofing: false,
      enable_infrastructure_nat: true,
      security_groups: virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : virtual_network_interface.security_groups,
      subnet: virtual_network_interface === null || virtual_network_interface === void 0 ? void 0 : virtual_network_interface.subnet,
      target: {
        id: id,
        name: inputName,
        resource_type: 'share_mount_target'
      }
    });
  } else {
    throw new Error('generateMountTarget: A mount target must have a vpc or virtual_network_interface field as part' + 'of its input.');
  }
  return {
    access_control_mode: accessControlMode,
    created_at: created_at,
    href: href,
    id: id,
    lifecycle_state: lifecycle_state,
    name: inputName,
    transit_encryption: encryptionInTransit,
    vpc: inputVpc,
    virtual_network_interface: virtualNetworkInterface
  };
};
var getFileShareFromDB = function getFileShareFromDB(id, res) {
  return utils.findResource(_server.COLS.file_shares, id, res, true);
};
exports.getFileShareFromDB = getFileShareFromDB;
var generateFileSize = function generateFileSize() {
  return Math.floor(Math.random() * 100) + 1;
};
var generateRandomResourceGroup = function generateRandomResourceGroup() {
  var id = utils.getRandomResourceGroup();
  return {
    id: id,
    href: "https://resource-controller.cloud.ibm.com/v2/resource_groups/".concat(id)
  };
};
var formatFileShareForClient = function formatFileShareForClient(req, share) {
  if (share) {
    // Add href for this ACL
    var file_share = lodash.cloneDeep(share);
    var region = req.query.region;
    file_share.crn = utils.generateCRN({
      region: region,
      'service-instance': share.id
    });
    file_share.href = "".concat(utils.getBaseApiUrl(req), "shares/").concat(share.id);
    file_share.created_at = utils.generateCreateDate();
    file_share.lifecycle_state = share.lifecycle_state || casual.random_element(FileShareStatuses);
    file_share.size = share.size || generateFileSize();
    var zone = utils.findZone(file_share.zone.name);
    file_share.zone = {
      name: zone.name,
      href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(zone.region_name, "/zones/").concat(zone.name)
    };
    file_share.resource_group = generateRandomResourceGroup();
    file_share.mount_targets = file_share.mount_targets.map(function (target) {
      var _target$vpc;
      return _objectSpread(_objectSpread({}, target), {}, {
        href: "".concat(file_share.href, "/").concat(target.id),
        vpc: {
          id: (target === null || target === void 0 ? void 0 : (_target$vpc = target.vpc) === null || _target$vpc === void 0 ? void 0 : _target$vpc.id) || (target === null || target === void 0 ? void 0 : target.vpc_id)
        }
      });
    });
    return file_share;
  }
  return null;
};

/**
 * Get a list of file shares
 * @param {*} req
 * @param {*} res
 */
exports.formatFileShareForClient = formatFileShareForClient;
var getFileShares = function getFileShares(req, res) {
  var file_shares = utils.getResources(req, _server.COLS.file_shares);
  file_shares.shares = file_shares.shares.map(function (share) {
    var file_share = formatFileShareForClient(req, share);
    if (share.sourceId) {
      file_share.source_share = formatFileShareForClient(req, getFileShareFromDB(share.sourceId));
    } else if (share.replicaId) {
      file_share.replica_share = formatFileShareForClient(req, getFileShareFromDB(share.replicaId));
    }
    return file_share;
  });
  res.json(file_shares).end();
};

/**
 * formatFileShareForClient()
 *
 * Takes a file share and file share mount target and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} share - raw file share from DB entry
 * * @param {*} target - file share mount target
 */
exports.getFileShares = getFileShares;
var formatFileShareMountTargetForClient = function formatFileShareMountTargetForClient(req, share, target) {
  var _target$vpc2;
  var displayedMountTarget = lodash.cloneDeep(target);
  displayedMountTarget.href = "".concat(utils.getBaseApiUrl(req), "shares/").concat(share.id, "/mount_targets/").concat(target.id);
  displayedMountTarget.mount_path = "161.26.98.243:/nxg_s_voll_mz7121_58e7e963_8f4b_4a0c_b71a_8ba8d9cd1e2e/".concat(target.id);
  displayedMountTarget.vpc = _objectSpread(_objectSpread({}, displayedMountTarget.vpc), {}, {
    href: "".concat(utils.getBaseApiUrl(req), "vpcs/").concat((target === null || target === void 0 ? void 0 : (_target$vpc2 = target.vpc) === null || _target$vpc2 === void 0 ? void 0 : _target$vpc2.id) || (target === null || target === void 0 ? void 0 : target.vpc_id))
  });
  displayedMountTarget.virtual_network_interface = displayedMountTarget.virtual_network_interface ? utils.formatResourceLinkForClient(req, _server.COLS.virtual_network_interfaces, displayedMountTarget.virtual_network_interface) : undefined;
  return displayedMountTarget;
};

/*
 * Get targets by file share
 * @param {*} req
 * @param {*} res
 */
var getFileShareMountTargets = function getFileShareMountTargets(req, res) {
  var share = getFileShareFromDB(req.params.id, res);
  if (!share) {
    return;
  }
  var targetsForClient = share.mount_targets.map(function (target) {
    return formatFileShareMountTargetForClient(req, share, target);
  });
  res.json({
    mount_targets: targetsForClient
  }).end();
};
exports.getFileShareMountTargets = getFileShareMountTargets;
var getIopsRange = function getIopsRange(size) {
  if (size >= 10 && size <= 39) {
    return {
      maximumIops: 1000,
      minimumIops: 100
    };
  }
  if (size >= 40 && size <= 79) {
    return {
      maximumIops: 2000,
      minimumIops: 100
    };
  }
  if (size >= 80 && size <= 99) {
    return {
      maximumIops: 4000,
      minimumIops: 100
    };
  }
  if (size >= 100 && size <= 499) {
    return {
      maximumIops: 6000,
      minimumIops: 100
    };
  }
  if (size >= 500 && size <= 999) {
    return {
      maximumIops: 10000,
      minimumIops: 100
    };
  }
  if (size >= 1000 && size <= 1999) {
    return {
      maximumIops: 20000,
      minimumIops: 100
    };
  }
  if (size >= 2000 && size <= 3999) {
    return {
      maximumIops: 40000,
      minimumIops: 200
    };
  }
  if (size >= 4000 && size <= 7999) {
    return {
      maximumIops: 40000,
      minimumIops: 300
    };
  }
  if (size >= 8000 && size <= 15999) {
    return {
      maximumIops: 64000,
      minimumIops: 500
    };
  }
  if (size >= 16000 && size <= 32000) {
    return {
      maximumIops: 96000,
      minimumIops: 2000
    };
  }
  return {};
};

/**
 * addFileShare()
 *
 * @param {*} file_shares - reference to the file shares collection
 * @param {*} data - data to be used for file share creation
 * */
var addFileShare = function addFileShare(file_shares) {
  var _getIopsRange;
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var generateMountTargets = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var access_control_mode = data.access_control_mode,
    inputEnc = data.encryption,
    inputEncKey = data.encryption_key,
    replica_share = data.replica_share,
    source_share = data.source_share,
    _data$mount_targets = data.mount_targets,
    mount_targets = _data$mount_targets === void 0 ? [] : _data$mount_targets,
    inputZone = data.zone,
    dataOverride = _objectWithoutProperties(data, _excluded);
  var zone = inputZone && utils.findZone(inputZone.name) || utils.getRandomZone();
  if (generateMountTargets === true) {
    utils.repeat(function () {
      try {
        mount_targets.splice(0, 0, generateMountTarget({
          vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, zone.region_name)
        }));
      } catch (err) {/* empty */}
    }, casual.integer(0, 4));
  }
  var encryption_key = data.encryption_key;
  if (data.encryption_key) {
    data.encryption = 'user_managed';
  } else {
    data.encryption = 'provider_managed';
  }
  var encryption = data.encryption;
  var replication_role = FILE_SHARE_REPLICATION_ROLES.NONE;
  if (source_share !== null && source_share !== void 0 && source_share.id) {
    replication_role = FILE_SHARE_REPLICATION_ROLES.REPLICA;
  } else if (replica_share !== null && replica_share !== void 0 && replica_share.name) {
    replication_role = FILE_SHARE_REPLICATION_ROLES.SOURCE;
  }
  var profile = data.profile || utils.getRandomResource(_server.COLS.share_profiles);
  var size = data.size || casual.integer(10, 16000);
  var baseData = {
    access_control_mode: access_control_mode || ACCESS_CONTROL_MODES.VPC,
    created_at: utils.generateCreateDate(),
    crn: utils.generateCRN(),
    href: '',
    // determined by formatFileShareForClient()
    id: casual.uuid,
    iops: size ? (_getIopsRange = getIopsRange(size)) === null || _getIopsRange === void 0 ? void 0 : _getIopsRange.minimumIops : casual.integer(100, 48000),
    encryption: encryption,
    encryption_key: encryption_key,
    lifecycle_state: data.lifecycle_state || casual.random_element(FileShareStatuses),
    mount_targets: mount_targets,
    name: utils.generateName('file_share'),
    profile: profile,
    replication_role: replication_role,
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    size: size,
    sourceId: source_share === null || source_share === void 0 ? void 0 : source_share.id,
    tags: casual.array_of_words(casual.integer(0, 5)),
    // @TODO: tags may need to be their own resource later
    zone: zone
  };

  // If replica_share exists, then this is a brand-new source, and they are creating a replica at the same time.
  // The ability to create a replica with a new source was removed from the UI, due to increasing design complexity.
  if (replica_share) {
    var replica = {
      created_at: utils.generateCreateDate(),
      crn: utils.generateCRN(),
      encryption: encryption,
      encryption_key: encryption_key,
      href: '',
      id: replica_share.id || casual.uuid,
      iops: replica_share.iops || casual.integer(100, 48000),
      lifecycle_state: replica_share.lifecycle_state || FileShareStatuses[4],
      mount_targets: replica_share.mount_targets,
      name: replica_share.name,
      profile: replica_share.profile || utils.getRandomResource(_server.COLS.share_profiles),
      replication_cron_spec: replica_share.replication_cron_spec,
      replication_role: FILE_SHARE_REPLICATION_ROLES.REPLICA,
      size: size,
      sourceId: (dataOverride === null || dataOverride === void 0 ? void 0 : dataOverride.id) || baseData.id,
      zone: replica_share.zone
    };
    var addedReplica = addFileShare(file_shares, replica);
    baseData.replicaId = addedReplica.id;
  }

  // update the source share if this is a new replica, but the source pre-existed
  if (source_share) {
    var fileShares = file_shares.find({
      id: source_share.id
    });
    if (fileShares.length) {
      var fileShare = fileShares[0];
      fileShare.replicaId = baseData.id;
      fileShare.replication_role = FILE_SHARE_REPLICATION_ROLES.SOURCE;
      file_shares.update(fileShare);
    }
  }
  var newFileShare = _objectSpread(_objectSpread({}, baseData), dataOverride);
  file_shares.insert(newFileShare);
  return newFileShare;
};
exports.addFileShare = addFileShare;
var getFileShare = function getFileShare(req, res) {
  var share = getFileShareFromDB(req.params.id, res);
  if (!share) {
    return;
  }
  var file_share = formatFileShareForClient(req, share);
  if (share.sourceId) {
    file_share.source_share = formatFileShareForClient(req, getFileShareFromDB(share.sourceId));
  } else if (share.replicaId) {
    file_share.replica_share = formatFileShareForClient(req, getFileShareFromDB(share.replicaId));
  }
  res.json(file_share).end();
};
exports.getFileShare = getFileShare;
var createFileShare = function createFileShare(req, res) {
  var input = req.body;
  var inputTargets = input.mount_targets && _toConsumableArray(input.mount_targets);

  // make sure we're not creating a file share that already exists
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.file_shares), input, req, res, 'resource with that name already exists', 'file_share')) {
    return;
  }

  // add the file share
  input.lifecycle_state = FileShareStatuses[3]; // corresponds to 'stable'
  input.mount_targets = (inputTargets || []).map(function (target) {
    var _input$zone;
    return generateMountTarget(_objectSpread(_objectSpread({}, target), {}, {
      shareZoneName: input === null || input === void 0 ? void 0 : (_input$zone = input.zone) === null || _input$zone === void 0 ? void 0 : _input$zone.name
    }));
  });
  var newFileShare = addFileShare(_server.db.getCollection(_server.COLS.file_shares), input);
  // return the newly added file share
  var file_shares = _server.db.getCollection(_server.COLS.file_shares).chain().find({
    id: newFileShare.id
  }).data({
    removeMeta: true
  });
  var file_share = formatFileShareForClient(req, file_shares[0]);
  res.status(201).json(file_share).end();
};
exports.createFileShare = createFileShare;
var createFileShareMountTarget = function createFileShareMountTarget(req, res) {
  var _req$body, _req$body$vpc;
  var fileShare_id = req.params && req.params.id ? req.params.id : '';
  var target_name = req.body && req.body.name ? req.body.name : '';

  // Find the FileShare
  var file_shares = _server.db.getCollection(_server.COLS.file_shares);
  var fileShares = file_shares.find({
    id: fileShare_id
  });
  if (!fileShare_id || fileShares.length === 0) {
    res.status(404).json(utils.generateNotFoundError(fileShare_id, 'fileShare')).end();
    return;
  }
  var fileShare = fileShares && fileShares[0];
  var mount_target = null;
  var vpc_id = ((_req$body = req.body) === null || _req$body === void 0 ? void 0 : (_req$body$vpc = _req$body.vpc) === null || _req$body$vpc === void 0 ? void 0 : _req$body$vpc.id) || (req === null || req === void 0 ? void 0 : req.body.vpc_id) || '';
  if (vpc_id) {
    // Find the VPC
    var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().find({
      id: vpc_id
    }).data({
      removeMeta: true
    });
    if (!vpc_id || vpcs.length === 0) {
      res.status(404).json(utils.generateNotFoundError(vpc_id, 'vpc')).end();
      return;
    }
    var vpc = vpcs[0];

    // Generate New Target
    mount_target = generateMountTarget({
      vpc: vpc,
      name: target_name
    });
  } else {
    var _req$body2, _fileShare$zone;
    var virtual_network_interface = (_req$body2 = req.body) === null || _req$body2 === void 0 ? void 0 : _req$body2.virtual_network_interface;
    mount_target = generateMountTarget({
      name: target_name,
      shareZoneName: fileShare === null || fileShare === void 0 ? void 0 : (_fileShare$zone = fileShare.zone) === null || _fileShare$zone === void 0 ? void 0 : _fileShare$zone.name,
      transit_encryption: req.body.transit_encryption,
      virtual_network_interface: virtual_network_interface
    });
  }
  if (!mount_target) {
    res.status(500).json('Unknown error: mount_target is missing').end();
    return;
  }

  // Update File Share
  fileShare.mount_targets.push(mount_target);
  file_shares.update(fileShare);
  res.status(201).json(formatFileShareMountTargetForClient(req, fileShare, mount_target)).end();
};
exports.createFileShareMountTarget = createFileShareMountTarget;
var deleteFileShare = function deleteFileShare(req, res) {
  var shareId = req.params.file_share_id;
  var file_shares = _server.db.getCollection(_server.COLS.file_shares);
  var fss = file_shares.find({
    id: shareId
  });
  var share = fss && fss[0];
  if (!share) {
    res.status(404).end();
    return;
  }
  if (share.replication_role === 'replica') {
    var source_shares = file_shares.find({
      id: share.sourceId
    });
    if (source_shares.length) {
      var fileShare = source_shares[0];
      fileShare.replicaId = null;
      fileShare.replication_role = FILE_SHARE_REPLICATION_ROLES.NONE;
      file_shares.update(fileShare);
    }
  }
  file_shares.remove(share);
  res.status(202).json(share).end();
};
exports.deleteFileShare = deleteFileShare;
var deleteFileShareMountTarget = function deleteFileShareMountTarget(req, res) {
  var shareId = req.params.file_share_id;
  var mountTargetId = req.params.mount_target_id;
  var file_shares = _server.db.getCollection(_server.COLS.file_shares);
  var file_share = file_shares.find({
    id: shareId
  });
  var file_share_targets = file_share[0].mount_targets;
  if (file_share) {
    var targetIndex = lodash.findIndex(file_share_targets, {
      id: mountTargetId
    });
    if (targetIndex > -1) {
      var _file_share_targets$t, _file_share_targets$t2;
      var targetVniId = (_file_share_targets$t = file_share_targets[targetIndex]) === null || _file_share_targets$t === void 0 ? void 0 : (_file_share_targets$t2 = _file_share_targets$t.virtual_network_interface) === null || _file_share_targets$t2 === void 0 ? void 0 : _file_share_targets$t2.id;
      var file_share_target = formatFileShareMountTargetForClient(req, file_share[0], file_share_targets[targetIndex]);
      file_share_targets.splice(targetIndex, 1);
      file_shares.update(file_share);
      if (targetVniId) {
        // update vni target data.
        var vni = utils.findResource(_server.COLS.virtual_network_interfaces, targetVniId, res, false);
        delete vni.target;
        var vnisCols = _server.db.getCollection(_server.COLS.virtual_network_interfaces);
        vnisCols.update(vni);
      }
      return res.status(202).json(file_share_target).end();
    }
    return res.status(404).end();
  }
  return res.status(404).end();
};
exports.deleteFileShareMountTarget = deleteFileShareMountTarget;
var deleteFileShareReplicationRelationship = function deleteFileShareReplicationRelationship(req, res) {
  var sourceShareId = req.params.file_share_id;
  var fileSharesDb = _server.db.getCollection(_server.COLS.file_shares);
  var sourceShares = fileSharesDb.find({
    id: sourceShareId
  });
  var sourceShare = sourceShares && sourceShares[0];
  if (!sourceShare) {
    res.status(404).end();
    return;
  }
  if (sourceShare.replicaId) {
    var replicaShares = fileSharesDb.find({
      id: sourceShare.replicaId
    });
    var replicaShare = replicaShares[0];
    sourceShare = _objectSpread(_objectSpread({}, sourceShare), {}, {
      replicaId: null,
      replication_cron_spec: null,
      replication_role: FILE_SHARE_REPLICATION_ROLES.NONE,
      replication_status: 'none',
      sourceId: null
    });
    replicaShare = _objectSpread(_objectSpread({}, replicaShare), {}, {
      replicaId: null,
      replication_cron_spec: null,
      replication_role: FILE_SHARE_REPLICATION_ROLES.NONE,
      replication_status: 'none',
      sourceId: null
    });
    fileSharesDb.update(sourceShare);
    fileSharesDb.update(replicaShare);
  } else {
    res.status(400).json((0, utils.generateErrors)('Share is not a source.', 400, 'replication_role'));
  }
  res.status(202).end();
};
exports.deleteFileShareReplicationRelationship = deleteFileShareReplicationRelationship;
var updateFileShareMountTarget = function updateFileShareMountTarget(req, res) {
  var shareId = req.params.file_share_id;
  var mountTargetId = req.params.mount_target_id;
  var file_shares = _server.db.getCollection(_server.COLS.file_shares);
  var file_share = file_shares.find({
    id: shareId
  });
  if (file_share.length === 0) {
    return res.status(404).end();
  }
  var file_share_targets = file_share[0].mount_targets;
  if (file_share) {
    var targetIndex = lodash.findIndex(file_share_targets, {
      id: mountTargetId
    });
    if (targetIndex > -1) {
      var target = file_share_targets[targetIndex];
      var updatedTarget = _objectSpread(_objectSpread({}, target), req.body);
      file_share_targets[targetIndex] = updatedTarget;
      file_shares.update(file_share);
      return res.status(200).json(formatFileShareMountTargetForClient(req, file_share, updatedTarget)).end();
    }
    return res.status(404).end();
  }
  return res.status(404).end();
};
exports.updateFileShareMountTarget = updateFileShareMountTarget;
var getFileShareMountTarget = function getFileShareMountTarget(req, res) {
  var shareId = req.params.file_share_id;
  var mountTargetId = req.params.mount_target_id;
  var file_shares = _server.db.getCollection(_server.COLS.file_shares);
  var file_share = file_shares.find({
    id: shareId
  });
  if (file_share.length === 0) {
    return res.status(404).end();
  }
  var file_share_targets = file_share[0].mount_targets;
  if (file_share) {
    var targetIndex = lodash.findIndex(file_share_targets, {
      id: mountTargetId
    });
    if (targetIndex > -1) {
      return res.status(200).json(formatFileShareMountTargetForClient(req, file_share[0], file_share_targets[targetIndex])).end();
    }
    return res.status(404).end();
  }
  return res.status(404).end();
};
exports.getFileShareMountTarget = getFileShareMountTarget;
var updateFileShare = function updateFileShare(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.file_shares);
  var results = collection.find({
    id: req.params.file_share_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var fileShareToUpdate = results[0];
  var updatedFileShare = _objectSpread(_objectSpread({}, fileShareToUpdate), {}, {
    access_control_mode: input.access_control_mode || (fileShareToUpdate === null || fileShareToUpdate === void 0 ? void 0 : fileShareToUpdate.access_control_mode),
    iops: input.iops || (fileShareToUpdate === null || fileShareToUpdate === void 0 ? void 0 : fileShareToUpdate.iops),
    name: input.name || (fileShareToUpdate === null || fileShareToUpdate === void 0 ? void 0 : fileShareToUpdate.name),
    profile: input.profile || (fileShareToUpdate === null || fileShareToUpdate === void 0 ? void 0 : fileShareToUpdate.profile),
    size: input.size || (fileShareToUpdate === null || fileShareToUpdate === void 0 ? void 0 : fileShareToUpdate.size)
  });

  // update the fileShare
  collection.update(updatedFileShare);
  // find the updated fileShare
  var updatedResults = collection.find({
    id: updatedFileShare.id
  });
  var updatedResult = formatFileShareForClient(req, updatedResults[0]);
  // return the updated fileShare
  res.status(200).json(updatedResult).end();
};
exports.updateFileShare = updateFileShare;
var failover = function failover(req, res) {
  var _req$params, _req$body3, _req$body4;
  var id = ((_req$params = req.params) === null || _req$params === void 0 ? void 0 : _req$params.file_share_id) || '';
  var fallback_policy = ((_req$body3 = req.body) === null || _req$body3 === void 0 ? void 0 : _req$body3.fallback_policy) || 'fail';
  var timeout = ((_req$body4 = req.body) === null || _req$body4 === void 0 ? void 0 : _req$body4.timeout) || 300; // 5 minutes is the min

  if (!['fail', 'split'].includes(fallback_policy)) {
    var message = 'The fallback_policy field must be \'fail\' or \'split\'';
    res.status(400).json((0, utils.generateErrors)(message, 400, 'fallback_policy')).end();
  }
  if (timeout < 300 || timeout > 3600) {
    var _message = 'The timeout field must be in the range of 300 seconds to 3600 seconds.';
    res.status(400).json((0, utils.generateErrors)(_message, 400, 'timeout')).end();
  }
  var fileSharesDb = _server.db.getCollection(_server.COLS.file_shares);
  var fileShares = fileSharesDb.find({
    id: id
  });
  if (fileShares.length) {
    var fileShare = fileShares[0];
    if (fileShare.replicaId) {
      // The file share passed in is the source, need to get the replica share.
      var replicaShares = fileSharesDb.find({
        id: fileShare.replicaId
      });
      var replica = replicaShares[0];
      fileShare = _objectSpread(_objectSpread({}, fileShare), {}, {
        replicaId: null,
        replication_cron_spec: fileShare.replication_cron_spec,
        replication_role: FILE_SHARE_REPLICATION_ROLES.REPLICA,
        sourceId: replica.id
      });
      replica = _objectSpread(_objectSpread({}, replica), {}, {
        replicaId: fileShare.id,
        replication_cron_spec: null,
        replication_role: FILE_SHARE_REPLICATION_ROLES.SOURCE,
        sourceId: null
      });
      fileSharesDb.update(fileShare);
      fileSharesDb.update(replica);
    } else if (fileShare.sourceId) {
      var sourceShares = fileSharesDb.find({
        id: fileShare.sourceId
      });
      var source = sourceShares[0];
      fileShare = _objectSpread(_objectSpread({}, fileShare), {}, {
        replicaId: source.id,
        replication_cron_spec: null,
        replication_role: FILE_SHARE_REPLICATION_ROLES.SOURCE,
        sourceId: null
      });
      source = _objectSpread(_objectSpread({}, source), {}, {
        replicaId: null,
        replication_cron_spec: fileShare.replication_cron_spec,
        replication_role: FILE_SHARE_REPLICATION_ROLES.REPLICA,
        sourceId: fileShare.id
      });
      fileSharesDb.update(fileShare);
      fileSharesDb.update(source);
    } else {
      res.status(400).json((0, utils.generateErrors)('Share is not a replica or a source.', 400, 'replication_role'));
    }
  } else {
    res.status(404).json((0, utils.generateErrors)('Share not found.', 404, 'id', 'param'));
  }
  res.status(202).end();
};
exports.failover = failover;
var init = function init() {
  var _profileData$profiles, _profileData$profiles2, _profileData$profiles3, _profileData$profiles4, _profileData$profiles5, _profileData$profiles6, _profileData$profiles7, _profileData$profiles8, _profileData$profiles9;
  var shareProfiles = _server.db.addCollection(_server.COLS.share_profiles);
  var file_shares = _server.db.addCollection(_server.COLS.file_shares);
  profileData.profiles.forEach(function (profile) {
    shareProfiles.insert(Object.assign({}, profile));
  });
  if (_features.shouldNotCreateRIASResources) {
    return;
  }

  // add a known static file share without targets
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share1001',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-default-file-share-1',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles = profileData.profiles) === null || _profileData$profiles === void 0 ? void 0 : _profileData$profiles[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share1002',
    lifecycle_state: 'stable',
    name: 'aaa-default-file-share-2',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles2 = profileData.profiles) === null || _profileData$profiles2 === void 0 ? void 0 : _profileData$profiles2[4],
    replica_share: {
      id: 'file_share1002_replica',
      lifecycle_state: 'stable',
      mount_targets: [],
      name: 'aaa-default-file-share-5',
      profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles3 = profileData.profiles) === null || _profileData$profiles3 === void 0 ? void 0 : _profileData$profiles3[4],
      replication_cron_spec: '0 */5 * * *',
      zone: utils.findZone('us-east-1')
    },
    replication_role: 'source',
    mount_targets: [generateMountTarget({
      vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, utils.DEFAULT_REGION)
    })],
    zone: utils.findZone('us-east-2')
  });

  // add a known static file share with targets
  addFileShare(file_shares, {
    encryption: 'user_managed',
    id: 'file_share1003',
    lifecycle_state: 'suspended',
    name: 'aaa-default-file-share-3',
    mount_targets: [generateMountTarget({
      vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, utils.DEFAULT_REGION)
    }), generateMountTarget({
      vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, utils.DEFAULT_REGION)
    })],
    zone: utils.findZone('us-east-2')
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share1004',
    lifecycle_state: 'stable',
    name: 'aaa-default-file-share-4',
    mount_targets: [generateMountTarget({
      vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, utils.DEFAULT_REGION)
    }), generateMountTarget({
      vpc: utils.getRandomResourceInZone(_server.COLS.vpcs, utils.DEFAULT_REGION)
    })],
    zone: utils.findZone('us-east-2')
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share100100',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-default-file-share-iops',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles4 = profileData.profiles) === null || _profileData$profiles4 === void 0 ? void 0 : _profileData$profiles4[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    access_control_mode: ACCESS_CONTROL_MODES.SECURITY_GROUP,
    encryption: 'provider_managed',
    id: 'file_share1006',
    lifecycle_state: 'stable',
    name: 'aaa-default-file-share-6',
    mount_targets: [generateMountTarget({
      virtual_network_interface: {
        subnet: {
          id: 'subnet-1',
          vpc: {
            id: 'vpc1001'
          }
        }
      },
      shareZoneName: utils.getDefaultZone(),
      name: 'default-mount-target',
      id: '6df33c29-4bbd-bbbb-bbbb-2e4ae4aa144f'
    }), generateMountTarget({
      virtual_network_interface: {
        subnet: {
          id: 'subnet-2',
          vpc: {
            id: 'vpc1001'
          }
        }
      },
      shareZoneName: utils.getDefaultZone()
    })],
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share_del',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-default-file-share-del',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles5 = profileData.profiles) === null || _profileData$profiles5 === void 0 ? void 0 : _profileData$profiles5[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share_rpl',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-default-file-share-rpl',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles6 = profileData.profiles) === null || _profileData$profiles6 === void 0 ? void 0 : _profileData$profiles6[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share1008',
    name: 'aaa-default-file-share-8',
    lifecycle_state: 'stable',
    mount_targets: [],
    replica_share: {
      id: 'file_share10003_replica',
      lifecycle_state: 'stable',
      mount_targets: [],
      name: 'aaa-default-file-share-9',
      replication_cron_spec: '0 */9 * * *',
      zone: utils.findZone('us-east-1')
    },
    replication_role: 'source',
    zone: utils.findZone('us-east-2')
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'cypress_file_share_action',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-test-file-share-activity-tracking',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles7 = profileData.profiles) === null || _profileData$profiles7 === void 0 ? void 0 : _profileData$profiles7[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'cypress_file_share_delete',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-test-file-share-delete',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles8 = profileData.profiles) === null || _profileData$profiles8 === void 0 ? void 0 : _profileData$profiles8[0],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });

  // add a known static file share without targets
  addFileShare(file_shares, {
    encryption: 'provider_managed',
    id: 'file_share1007',
    lifecycle_state: 'stable',
    mount_targets: [],
    name: 'aaa-default-file-share-7',
    profile: profileData === null || profileData === void 0 ? void 0 : (_profileData$profiles9 = profileData.profiles) === null || _profileData$profiles9 === void 0 ? void 0 : _profileData$profiles9[4],
    size: 20,
    zone: utils.findZone(utils.getDefaultZone())
  });

  // add a number of additional volumes
  utils.repeat(function () {
    addFileShare(file_shares, {
      encryption: 'provider_managed'
    }, !!_features.shouldGenerateLotsOfResources);
  }, _features.shouldGenerateLotsOfResources ? 100 : DEFAULT_NUMBER_OF_FILE_SHARES);
};
exports.init = init;
var formatShareProfileForClient = function formatShareProfileForClient(req, profile) {
  profile.href = "".concat(utils.getBaseUrl(req), "share/profiles/").concat(profile.name);
};
var getShareProfiles = function getShareProfiles(req, res) {
  var shareProfiles = utils.getResources(req, _server.COLS.share_profiles);

  // remap the share_profiles to profiles for the response to match RIAS
  shareProfiles.profiles = shareProfiles.share_profiles;
  delete shareProfiles.share_profiles;
  shareProfiles.profiles.forEach(function (profile) {
    return formatShareProfileForClient(req, profile);
  });
  res.json(shareProfiles).end();
};
exports.getShareProfiles = getShareProfiles;
var getShareProfile = function getShareProfile(req, res) {
  var shareProfiles = _server.db.getCollection(_server.COLS.share_profiles).chain().find({
    name: req.params.name
  }).data({
    removeMeta: true
  });
  if (shareProfiles.length === 0) {
    res.status(404).end();
    return;
  }
  var profile = shareProfiles[0];
  profile.href = "".concat(utils.getBaseUrl(req), "share/profiles/").concat(profile.name);
  res.json(profile).end();
};
exports.getShareProfile = getShareProfile;