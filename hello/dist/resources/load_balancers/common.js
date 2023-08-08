"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = exports.updatePending = exports.provisioningStatuses = exports.initialData = exports.getLoadBalancerFromDB = exports.createPending = exports.active = void 0;
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var initialData = require('./initialData.json');
exports.initialData = initialData;
var version = ['disabled', 'v1', 'v2'];
exports.version = version;
var createPending = 'create_pending';
exports.createPending = createPending;
var updatePending = 'update_pending';
exports.updatePending = updatePending;
var active = 'active';
exports.active = active;
var provisioningStatuses = [active, createPending, updatePending, 'delete_pending', 'maintenance_pending'];
exports.provisioningStatuses = provisioningStatuses;
var getLoadBalancerFromDB = function getLoadBalancerFromDB(id, res) {
  return utils.findResource(_server.COLS.load_balancers, id, res, true);
};
exports.getLoadBalancerFromDB = getLoadBalancerFromDB;