"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getSupportedInstanceProfiles = exports.getProfiles = exports.getProfile = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
  * We load our data directly from JSON data. Currently our code handles
  * only fixed profiles. We can adapt to the other profile formats as
  * needed.
  */
var profileData = require('./dedicated_host_profiles.json');
var instanceProfileData = require('./profiles.json');
var init = function init() {
  var profiles = _server.db.addCollection(_server.COLS.dedicated_host_profiles);
  profileData.profiles.forEach(function (profile) {
    profile.id = profile.name; // Synthetic one so we work with our utils
    profiles.insert(Object.assign({}, profile));
  });
};
exports.init = init;
var getSupportedInstanceProfiles = function getSupportedInstanceProfiles(req, family, className) {
  return instanceProfileData.profiles.filter(function (profile) {
    return profile.family === family && className === profile.name.split('-')[0];
  }).map(function (profile) {
    return {
      name: profile.name,
      crn: utils.updateResourceCrnRegion(profile, req),
      href: "".concat(utils.getBaseApiUrl(req), "instance/profiles/").concat(profile.name)
    };
  });
};

/**
 * formatDedicatedHostProfileForClient()
 *
 * We are loading our data directly from JSON data. We only need to update fields
 * that are not present or need to be modidifed.
 *
 * @param {*} dedicated_host_profile
 * @param {*} req
 * @param {*} res
 */
// eslint-disable-next-line no-unused-vars
exports.getSupportedInstanceProfiles = getSupportedInstanceProfiles;
var formatDedicatedHostProfileForClient = function formatDedicatedHostProfileForClient(dedicated_host_profile, req, res) {
  var name = dedicated_host_profile.name,
    socket_count = dedicated_host_profile.socket_count,
    vcpu_architecture = dedicated_host_profile.vcpu_architecture,
    vcpu_manufacturer = dedicated_host_profile.vcpu_manufacturer,
    vcpu_count = dedicated_host_profile.vcpu_count,
    generation = dedicated_host_profile.generation,
    memory = dedicated_host_profile.memory,
    family = dedicated_host_profile.family,
    disks = dedicated_host_profile.disks;
  var href = "".concat(utils.getBaseApiUrl(req), "dedicated_host/profiles/").concat(name);
  var supported_instance_profiles = getSupportedInstanceProfiles(req, family, dedicated_host_profile["class"]);
  var result = {
    name: name,
    crn: utils.updateResourceCrnRegion(dedicated_host_profile, req),
    socket_count: socket_count,
    vcpu_architecture: vcpu_architecture,
    vcpu_manufacturer: vcpu_manufacturer,
    vcpu_count: vcpu_count,
    status: (generation === null || generation === void 0 ? void 0 : generation.value) === 'previous' ? 'previous' : 'current',
    memory: memory,
    family: family,
    href: href,
    "class": dedicated_host_profile["class"],
    // not using destructuring assignment to bypassing  keyword 'class'
    supported_instance_profiles: supported_instance_profiles,
    disks: disks
  };
  return result;
};

/**
 * getProfiles()
 *
 * Get the dedicated host profiles list.
 * NOTE: We are not currently handling paging.
 *
 * @param {} req
 * @param {*} res
 */
var getProfiles = function getProfiles(req, res) {
  var profiles = utils.getResources(req, _server.COLS.dedicated_host_profiles, function (resource) {
    var _resource$generation = resource.generation;
    _resource$generation = _resource$generation === void 0 ? {} : _resource$generation;
    var generationValue = _resource$generation.value,
      vcpu_architecture = resource.vcpu_architecture;
    // only show gen2 profile without generation value in eu-de region
    if (req.query.region === 'eu-de') {
      if (generationValue && generationValue === 'current') {
        return false;
      }
    }
    if (req.query.region === 'jp-tok') {
      // hide z DH in jp-tok region
      if (vcpu_architecture.value === 's390x') return false;
    }
    return true;
  });
  var profilesRawData = profiles.dedicated_host_profiles;
  var profilesForClient = profilesRawData.map(function (profile) {
    return formatDedicatedHostProfileForClient(profile, req, res);
  });
  var allProfilesForClient = {
    profiles: profilesForClient
  };
  res.json(allProfilesForClient).end();
};

/**
 * getProfile()
 *
 * Get single dedicated host profile. If not found returns 404.
 *
 * @param {} req
 * @param {*} res
 */
exports.getProfiles = getProfiles;
var getProfile = function getProfile(req, res) {
  var profiles = _server.db.getCollection(_server.COLS.dedicated_host_profiles).chain().find({
    name: req.params.profile_name
  }).data({
    removeMeta: true
  });
  if (profiles.length === 0) {
    res.status(404).end();
    return;
  }
  var profileForClient = formatDedicatedHostProfileForClient(profiles[0], req, res);
  res.json(profileForClient).end();
};
exports.getProfile = getProfile;