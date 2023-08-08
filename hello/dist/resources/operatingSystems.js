"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.getOperatingSystems = exports.getOperatingSystem = exports.formatOperatingSystemForClient = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var operatingSystemsData = require('./operatingSystems.json');
var formatOperatingSystemForClient = function formatOperatingSystemForClient(req, os) {
  os.href = "".concat(utils.getBaseApiUrl(req), "operating_systems/").concat(os.name);
};
exports.formatOperatingSystemForClient = formatOperatingSystemForClient;
var init = function init() {
  var dbOperatingSystems = _server.db.addCollection(_server.COLS.operatingSystems);
  operatingSystemsData.forEach(function (operatingSystem) {
    dbOperatingSystems.insert(Object.assign({}, operatingSystem));
  });
};
exports.init = init;
var getOperatingSystems = function getOperatingSystems(req, res) {
  var operatingSystems = utils.getResources(req, _server.COLS.operatingSystems);
  operatingSystems[_server.COLS.operatingSystems].forEach(function (os) {
    return formatOperatingSystemForClient(req, os);
  });
  res.json(operatingSystems).end();
};
exports.getOperatingSystems = getOperatingSystems;
var getOperatingSystem = function getOperatingSystem(req, res) {
  var osList = _server.db.getCollection(_server.COLS.operatingSystems).chain().find({
    name: req.params.os_id
  }).data({
    removeMeta: true
  });
  if (osList.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(osList[0]).end();
};
exports.getOperatingSystem = getOperatingSystem;