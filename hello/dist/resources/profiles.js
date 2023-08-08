"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getProfiles = exports.getProfile = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var profileData = require('./profiles.json');
var init = function init() {
  var profiles = _server.db.addCollection(_server.COLS.profiles);
  /*
   * This makes it easy for us to load our profile data.  This file came from calling the
   * real RIAS API.
   */
  profileData.profiles.forEach(function (profile) {
    var bandwidth = Math.min(profile.numberOfVirtualCPUs * 2000, 80000);
    profiles.insert(Object.assign({}, profile, {
      bandwidth: bandwidth,
      totalVolumeBandwidth: Math.floor(bandwidth * utils.defaultVolumeBandWdithRatio)
    }));
  });
};
exports.init = init;
var getFixedProfileAttribute = function getFixedProfileAttribute(value) {
  if (value) {
    return {
      type: 'fixed',
      value: value
    };
  }
  return null;
};
var getEnumProfileAttribute = function getEnumProfileAttribute(value) {
  if (value) {
    return {
      type: 'enum',
      values: value.values,
      "default": value["default"]
    };
  }
  return null;
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
    numberOfVirtualCPUs = rawProfileData.numberOfVirtualCPUs,
    network_interface_count = rawProfileData.network_interface_count,
    memorySize = rawProfileData.memorySize,
    memorySizeGPU = rawProfileData.memorySizeGPU,
    numberOfVirtualGPUs = rawProfileData.numberOfVirtualGPUs,
    numa_count = rawProfileData.numa_count,
    generation = rawProfileData.generation,
    gpuManufacturer = rawProfileData.gpuManufacturer,
    gpuModel = rawProfileData.gpuModel,
    disks = rawProfileData.disks,
    totalVolumeBandwidth = rawProfileData.totalVolumeBandwidth,
    vcpuManufacturer = rawProfileData.vcpuManufacturer,
    vcpuArchitecture = rawProfileData.vcpuArchitecture,
    secure_boot_modes = rawProfileData.secure_boot_modes,
    confidential_compute_modes = rawProfileData.confidential_compute_modes;
  var apiData = {};
  apiData.crn = utils.updateResourceCrnRegion(rawProfileData, req);
  apiData.name = name;
  apiData.href = "".concat(utils.getBaseUrl(req), "/").concat(rawProfileData.name);
  apiData.bandwidth = getFixedProfileAttribute(bandwidth);
  apiData.port_speed = getFixedProfileAttribute(speed);
  apiData.family = family;
  apiData.status = generation === 'previous' ? 'previous' : 'current';
  apiData.vcpu_count = getFixedProfileAttribute(numberOfVirtualCPUs);
  apiData.vcpu_architecture = getFixedProfileAttribute(vcpuArchitecture);
  apiData.vcpu_manufacturer = getFixedProfileAttribute(vcpuManufacturer);
  apiData.memory = getFixedProfileAttribute(memorySize);
  apiData.gpu_memory = getFixedProfileAttribute(memorySizeGPU);
  apiData.gpu_count = getFixedProfileAttribute(numberOfVirtualGPUs);
  apiData.gpu_manufacturer = {
    type: 'fixed',
    values: [gpuManufacturer]
  };
  apiData.gpu_model = {
    type: 'fixed',
    values: [gpuModel]
  };
  apiData.numa_count = getFixedProfileAttribute(numa_count);
  apiData.network_interface_count = network_interface_count;
  apiData.disks = disks && [{
    size: getFixedProfileAttribute(disks[0].size),
    quantity: getFixedProfileAttribute(disks[0].quantity),
    supported_interface_types: {
      type: 'enum',
      values: disks[0].supported_interface_types
    }
  }];
  apiData.total_volume_bandwidth = {
    "default": totalVolumeBandwidth,
    max: bandwidth - 500,
    min: 500,
    step: 1,
    type: 'range'
  };
  apiData.secure_boot_modes = getEnumProfileAttribute(secure_boot_modes);
  apiData.confidential_compute_modes = getEnumProfileAttribute(confidential_compute_modes);
  return apiData;
};
var getProfiles = function getProfiles(req, res) {
  var profiles = utils.getResources(req, _server.COLS.profiles, function (resource) {
    // only show gen2 profile with old generation in eu-de region
    if (req.query.region === 'eu-de') {
      var generationValue = resource.generation;
      if (generationValue) {
        return false;
      }
    }
    return true;
  });
  var profilesRawData = profiles.profiles;
  var updatesProfiles = profilesRawData.map(function (profile) {
    return convertProfileData(profile, req);
  });
  res.json(_objectSpread(_objectSpread({}, profiles), {}, {
    profiles: updatesProfiles
  })).end();
};
exports.getProfiles = getProfiles;
var getProfile = function getProfile(req, res) {
  var profiles = _server.db.getCollection(_server.COLS.profiles).chain().find({
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