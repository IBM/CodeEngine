"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getLBProfiles = exports.getLBProfile = void 0;
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var LBProfileData = require('./LB_profiles.json');
var formatLBProfileForClient = function formatLBProfileForClient(req, profile) {
  profile.href = "".concat(utils.getBaseUrl(req), "/").concat(profile.name);
  profile.crn = utils.updateResourceCrnRegion(profile, req);
};
var init = function init() {
  var LBProfiles = _server.db.addCollection(_server.COLS.LB_profiles);
  LBProfileData.profiles.forEach(function (LBProfile) {
    LBProfiles.insert(Object.assign({}, LBProfile));
  });
};
exports.init = init;
var getLBProfiles = function getLBProfiles(req, res) {
  var LBProfiles = utils.getResources(req, _server.COLS.LB_profiles);
  LBProfiles.profiles = LBProfiles.LB_profiles;
  delete LBProfiles.LB_profiles;
  LBProfiles.profiles.forEach(function (profile) {
    return formatLBProfileForClient(req, profile);
  });
  res.json(LBProfiles).end();
};
exports.getLBProfiles = getLBProfiles;
var getLBProfile = function getLBProfile(req, res) {
  var LBProfiles = _server.db.getCollection(_server.COLS.LB_profiles).chain().find({
    name: req.params.profile_name
  }).data({
    removeMeta: true
  });
  if (LBProfiles.length === 0) {
    res.status(404).end();
    return;
  }
  var _LBProfiles$ = LBProfiles[0],
    crn = _LBProfiles$.crn,
    name = _LBProfiles$.name,
    family = _LBProfiles$.family;
  res.json({
    crn: crn,
    name: name,
    family: family,
    href: "".concat(utils.getBaseUrl(req))
  }).end();
};
exports.getLBProfile = getLBProfile;