"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getProfiles = exports.getProfile = void 0;
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var profileData = require('./profiles.json');
var init = function init() {
  var profiles = _server.db.addCollection(_server.COLS.bm_profiles);

  /*
   * This makes it easy for us to load our profile data.  This file came from calling the
   * real RIAS API.
   */
  profileData.profiles.forEach(function (profile) {
    profiles.insert(Object.assign({}, profile));
  });
};
exports.init = init;
var getFixedProfileAttribute = function getFixedProfileAttribute(value) {
  return {
    type: 'fixed',
    value: value
  };
};

/**
 *  Convert the profile json data to the format of RIAS API response format
 * @param rawProfileData the raw data from the db, ie. profiles.json
 * @param req request
 */

var convertProfileData = function convertProfileData(rawProfileData, req) {
  var name = rawProfileData.name,
    speed = rawProfileData.speed,
    bandwidth = rawProfileData.bandwidth,
    family = rawProfileData.family,
    cpu_architecture = rawProfileData.cpu_architecture,
    cpuCoreCount = rawProfileData.cpuCoreCount,
    cpuSocketCount = rawProfileData.cpuSocketCount,
    memorySize = rawProfileData.memorySize,
    disks = rawProfileData.disks,
    supported_image_flags = rawProfileData.supported_image_flags,
    tpm_supported_modes = rawProfileData.tpm_supported_modes,
    network_interface_count = rawProfileData.network_interface_count,
    console_types = rawProfileData.console_types;
  var apiData = {};
  apiData.crn = utils.updateResourceCrnRegion(rawProfileData, req);
  apiData.name = name;
  apiData.href = "".concat(utils.getBaseUrl(req), "/").concat(rawProfileData.name);
  apiData.bandwidth = getFixedProfileAttribute(bandwidth);
  apiData.port_speed = getFixedProfileAttribute(speed);
  apiData.family = family;
  apiData.cpu_architecture = getFixedProfileAttribute(cpu_architecture);
  apiData.cpu_core_count = getFixedProfileAttribute(cpuCoreCount);
  apiData.cpu_socket_count = getFixedProfileAttribute(cpuSocketCount);
  apiData.memory = getFixedProfileAttribute(memorySize);
  apiData.network_interface_count = network_interface_count;
  apiData.console_types = console_types;
  apiData.disks = disks && disks.map(function (disk) {
    return {
      size: getFixedProfileAttribute(disk.size),
      quantity: getFixedProfileAttribute(disk.quantity),
      supported_interface_types: {
        type: 'enum',
        values: disk.supported_interface_types
      }
    };
  });
  apiData.supported_image_flags = supported_image_flags;
  apiData.os_architecture = {
    type: 'enum',
    "default": cpu_architecture,
    values: [cpu_architecture]
  };
  apiData.supported_trusted_platform_module_modes = {
    type: 'enum',
    values: tpm_supported_modes || []
  };
  return apiData;
};
var getProfiles = function getProfiles(req, res) {
  var profiles = utils.getResources(req, _server.COLS.bm_profiles);
  var profilesRawData = profiles.bm_profiles;
  var updatesProfiles = profilesRawData.map(function (profile) {
    return convertProfileData(profile, req);
  });
  delete profiles.bm_profiles;
  res.json(_objectSpread(_objectSpread({}, profiles), {}, {
    profiles: updatesProfiles
  })).end();
};
exports.getProfiles = getProfiles;
var getProfile = function getProfile(req, res) {
  var profiles = _server.db.getCollection(_server.COLS.bm_profiles).chain().find({
    name: req.params.profile_name
  }).data({
    removeMeta: true
  });
  if (profiles.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(_objectSpread(_objectSpread({}, convertProfileData(profiles[0], req)), {}, {
    href: "".concat(utils.getBaseUrl(req))
  })).end();
};
exports.getProfile = getProfile;