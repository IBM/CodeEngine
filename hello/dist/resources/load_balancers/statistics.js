"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLoadBalancerStatistics = exports.addStatistics = void 0;
var casual = _interopRequireWildcard(require("casual"));
var _common = require("./common");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
var Statistics = function Statistics() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return {
    active_connections: data.active_connections || casual.integer(1, 15000),
    connection_rate: data.connection_rate || casual["double"](1.0, 1500.30),
    data_processed_this_month: data.data_processed_this_month || casual.integer(1, 15000),
    throughput: data.throughput || casual["double"](1.0, 1500.30)
  };
};

/*
 * Get load balancer statistics
 */
var getLoadBalancerStatistics = function getLoadBalancerStatistics(req, res) {
  var lb = (0, _common.getLoadBalancerFromDB)(req.params.id, res);
  if (!lb) {
    res.status(404).end();
    return;
  }
  var statistics = lb.statistics;
  res.json(statistics).end();
};
exports.getLoadBalancerStatistics = getLoadBalancerStatistics;
var addStatistics = function addStatistics(data) {
  var statistics = Statistics(data);
  return statistics;
};
exports.addStatistics = addStatistics;