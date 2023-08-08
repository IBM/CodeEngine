"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getVolumeProfiles = exports.getVolumeProfile = exports.getIOPSForProfile = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var volumeProfileData = require('./volume_profiles.json');
var showNewProfiles = false; // enable to include Acadia profiles

var iopsValues = [{
  name: '10iops-tier',
  iops: 10,
  predefinedValues: [{
    minSize: 10,
    maxSize: 300,
    iops: 3000
  }]
}, {
  name: '5iops-tier',
  iops: 5,
  predefinedValues: [{
    minSize: 10,
    maxSize: 600,
    iops: 3000
  }]
}, {
  name: 'general-purpose',
  iops: 3,
  predefinedValues: [{
    minSize: 10,
    maxSize: 1000,
    iops: 3000
  }]
}];
var filter = function filter(req, res, resource) {
  var isGen2 = resource.generation === 2;
  var isAcadiaProfile = resource.family === 'defined-performance';
  if (!showNewProfiles) {
    return isGen2 && !isAcadiaProfile;
  }
  return isGen2;
};
var formatVolumeProfileForClient = function formatVolumeProfileForClient(req, profile) {
  profile.href = "".concat(utils.getBaseUrl(req), "volume/profiles/").concat(profile.name);
};

/**
 * getIOPSForProfile will return the number of iops for a profile tier
 * @param {*} size - the size of a volume
 * @param {*} profile - a volume profile
 * @param {*} customIOps - iops for custom profile
 */
var getIOPSForProfile = function getIOPSForProfile(size, profile, customIOps) {
  var foundProfile = iopsValues.find(function (item) {
    return item.name === profile.name;
  });
  // if we have a profile, check the predefined values
  if (foundProfile) {
    var predefinedIOPS = foundProfile.predefinedValues.find(function (values) {
      var minSize = values.minSize,
        maxSize = values.maxSize;
      return minSize <= size && size <= maxSize;
    });

    // if our size matches one of the predefined value ranges, use that iops value
    if (predefinedIOPS) {
      return predefinedIOPS.iops;
    }

    // otherwise, return the calculated iops value
    return size * foundProfile.iops;
  }
  return customIOps;
};
exports.getIOPSForProfile = getIOPSForProfile;
var init = function init() {
  var volumeProfiles = _server.db.addCollection(_server.COLS.volume_profiles);
  volumeProfileData.profiles.forEach(function (volumeProfile) {
    volumeProfiles.insert(Object.assign({}, volumeProfile));
  });
};
exports.init = init;
var getVolumeProfiles = function getVolumeProfiles(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var volumeProfiles = utils.getResources(req, _server.COLS.volume_profiles, extraFilter);

  // remap the volume_profiles to profiles for the response to match RIAS
  volumeProfiles.profiles = volumeProfiles.volume_profiles;
  delete volumeProfiles.volume_profiles;
  volumeProfiles.profiles.forEach(function (profile) {
    return formatVolumeProfileForClient(req, profile);
  });
  res.setHeader('X-Byok-Whitelist-Response', 'true');
  res.setHeader('X-Expandable-Whitelist-Response', 'true');
  res.json(volumeProfiles).end();
};
exports.getVolumeProfiles = getVolumeProfiles;
var getVolumeProfile = function getVolumeProfile(req, res) {
  var volumeProfiles = _server.db.getCollection(_server.COLS.volume_profiles).chain().find({
    name: req.params.profile_name
  }).data({
    removeMeta: true
  });
  if (volumeProfiles.length === 0) {
    res.status(404).end();
    return;
  }
  var profile = volumeProfiles[0];
  profile.href = "".concat(utils.getBaseUrl(req), "volume/profiles/").concat(profile.name);
  res.json(profile).end();
};
exports.getVolumeProfile = getVolumeProfile;