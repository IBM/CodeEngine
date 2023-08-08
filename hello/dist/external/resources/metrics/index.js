"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../../../server");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
var getResourceID = function getResourceID(filter) {
  if (!filter) {
    return null;
  }
  if (filter.indexOf('ibm_resource=') > -1) {
    return filter.substring(14, filter.length - 1);
  }
  var _filter$match = filter.match(/ibm_resource in \("(\S*)"\)/),
    _filter$match2 = _slicedToArray(_filter$match, 2),
    resourceID = _filter$match2[1];
  return resourceID;
};

// input like:
// metricsValue = [
//      ['vda', 'vdb'],
//      [100],
//      [200],
// ]
// ==> output
// [
//   ['vda', 100, 200],
//   ['vdb', 100, 200],
// ]
//
var getDataPointWithMetricValues = function getDataPointWithMetricValues(metricValues) {
  var result = [];
  var expandArray = function expandArray(arr) {
    var subArrayIdx = arr.findIndex(function (el) {
      return Array.isArray(el);
    });
    if (subArrayIdx === -1) {
      return;
    }
    var subArrayEl = arr[subArrayIdx];
    var preEls = arr.slice(0, subArrayIdx);
    var sufEls = arr.slice(subArrayIdx + 1);
    var expArray = subArrayEl.map(function (expEL) {
      return [].concat(_toConsumableArray(preEls), [expEL], _toConsumableArray(sufEls));
    });
    expArray.forEach(function (newEL) {
      var containNestedArray = newEL.find(function (nestedEL) {
        return Array.isArray(nestedEL);
      });
      if (containNestedArray) {
        expandArray(newEL);
      } else {
        result.push(newEL);
      }
    });
  };
  expandArray(metricValues);
  return result;
};
var generateDataPointValues = function generateDataPointValues(metrics, resourceID) {
  var hasVolumeID = metrics.find(function (metric) {
    return metric.id === 'ibm_is_volume_id';
  });
  var hasDiskName = metrics.find(function (metric) {
    return metric.id === 'ibm_is_disk_name';
  });
  var hasVolumeIDAndDiskName = hasVolumeID && hasDiskName;
  var volumeIDs;
  var diskNames = [];
  var diskVolumeMap = new Map();
  if (hasVolumeID || hasDiskName) {
    var attachmentsByInstance = _server.db.getCollection(_server.COLS.volume_attachments).chain().data().filter(function (vol) {
      var _vol$instance;
      return ((_vol$instance = vol.instance) === null || _vol$instance === void 0 ? void 0 : _vol$instance.id) === resourceID;
    });
    volumeIDs = attachmentsByInstance.map(function (att) {
      return att.volume.id;
    });
    volumeIDs.forEach(function (val, index) {
      var diskName = "vd".concat(String.fromCharCode(97 + index));
      diskNames.push(diskName);
      diskVolumeMap[diskName] = val;
    });
    diskNames.push("vd".concat(String.fromCharCode(97 + volumeIDs.length)));
    diskNames.push("vd".concat(String.fromCharCode(98 + volumeIDs.length)));
  }
  var voluemIDPlaceHolder = 'volume_id_placeholder';
  var dpValues = metrics.map(function (metric) {
    var _metric$aggregations;
    var id = metric.id;
    var isTimeSum = (metric === null || metric === void 0 ? void 0 : (_metric$aggregations = metric.aggregations) === null || _metric$aggregations === void 0 ? void 0 : _metric$aggregations.time) === 'sum';
    if (id === 'ibm_is_instance_running_state') {
      var runningAry = new Array(20).fill(1);
      var stopAry = new Array(3).fill(-1);
      return [_casual["default"].random_element([].concat(_toConsumableArray(runningAry), [0], _toConsumableArray(stopAry)))];
    }
    if (id === 'ibm_is_volume_id') {
      if (hasDiskName) {
        return [voluemIDPlaceHolder];
      }
      return volumeIDs;
    }
    if (id === 'ibm_is_disk_name') {
      return diskNames;
    }
    if (id === 'ibm_resource') {
      return [resourceID];
    }
    if (id === 'ibm_is_instance_cpu_usage_percentage') {
      return [_casual["default"].random];
    }
    if (id === 'ibm_is_vcpu_index') {
      return ['' + _casual["default"].integer(1, 16)];
    }
    if (id === 'ibm_is_instance_network_in_bytes') {
      return [_casual["default"].integer(1000000, 10000000)];
    }
    if (id === 'ibm_is_instance_network_out_bytes') {
      return [_casual["default"].integer(1000000, 10000000)];
    }
    if (id === 'ibm_is_instance_network_in_packets') {
      return [_casual["default"]["double"](1000, 10000)];
    }
    if (id === 'ibm_is_instance_network_out_packets') {
      return [_casual["default"]["double"](1000, 10000)];
    }
    if (id === 'ibm_is_instance_memory_free_kib') {
      return [_casual["default"]["double"](1000, 10000)];
    }
    if (id === 'ibm_is_instance_memory_usage_percentage') {
      return [_casual["default"].random];
    }
    if (id === 'ibm_is_instance_volume_read_bytes') {
      return [_casual["default"].integer(100000, 1000000)];
    }
    if (id === 'ibm_is_instance_volume_write_bytes') {
      return [_casual["default"].integer(100, 10000)];
    }
    if (id === 'ibm_is_instance_volume_read_requests') {
      return [_casual["default"]["double"](100, 10000)];
    }
    if (id === 'ibm_is_instance_volume_write_requests') {
      return [_casual["default"]["double"](10, 1000)];
    }
    if (id === 'ibm_is_vpn_gateway_bytes_in') {
      return [_casual["default"].integer(100000, 1000000)];
    }
    if (id === 'ibm_is_vpn_gateway_bytes_out') {
      return [_casual["default"].integer(10000, 1000000)];
    }
    if (id === 'ibm_is_vpn_gateway_packets_in') {
      return [_casual["default"]["double"](100000, 1000000)];
    }
    if (id === 'ibm_is_vpn_gateway_packets_out') {
      return [_casual["default"]["double"](10000, 1000000)];
    }
    if (id === 'ibm_is_vpn_server_data_received_bytes') {
      return [_casual["default"]["double"](100000, 1000000)];
    }
    if (id === 'ibm_is_vpn_server_data_sent_bytes') {
      return [_casual["default"]["double"](10000, 1000000)];
    }
    if (id === 'ibm_is_load_balancer_active_connections') {
      return [_casual["default"].integer(1, 10)];
    }
    if (id === 'ibm_is_load_balancer_connection_rate') {
      return [_casual["default"].integer(1, 10)];
    }
    if (id === 'ibm_is_load_balancer_throughput') {
      if (isTimeSum) {
        return [_casual["default"].integer(1000000000, 10000000000)];
      }
      return [_casual["default"].integer(10, 1000)];
    }
    if (id === 'ibm_is_load_balancer_total_bytes_out') {
      if (isTimeSum) {
        return [_casual["default"].integer(1000000000, 10000000000)];
      }
      return [_casual["default"].integer(10, 1000)];
    }
    if (id === 'ibm_is_load_balancer_total_bytes_in') {
      if (isTimeSum) {
        return [_casual["default"].integer(1000000000, 10000000000)];
      }
      return [_casual["default"].integer(10, 1000)];
    }
    if (id === 'ibm_is_load_balancer_request_count') {
      return [_casual["default"].integer(100, 1000)];
    }
    return ['n/a'];
  });
  var dps = getDataPointWithMetricValues(dpValues);
  var vrbInx = metrics.findIndex(function (me) {
    return me.id === 'ibm_is_instance_volume_read_bytes';
  });
  var vwbInx = metrics.findIndex(function (me) {
    return me.id === 'ibm_is_instance_volume_write_bytes';
  });
  var vrrInx = metrics.findIndex(function (me) {
    return me.id === 'ibm_is_instance_volume_read_requests';
  });
  var vwrInx = metrics.findIndex(function (me) {
    return me.id === 'ibm_is_instance_volume_write_requests';
  });
  if (hasVolumeIDAndDiskName) {
    dps.forEach(function (dp) {
      var diskName = dp.find(function (dpv) {
        return diskNames.includes(dpv);
      });
      var volumeIDPlaceHolderIdx = dp.findIndex(function (dpv) {
        return dpv === voluemIDPlaceHolder;
      });
      if (diskVolumeMap[diskName]) {
        dp[volumeIDPlaceHolderIdx] = diskVolumeMap[diskName];
      } else {
        // if there is no associated volume for the disk, the ibm_is_volume_id is 'local'
        dp[volumeIDPlaceHolderIdx] = 'local';
      }
      if (vrbInx !== -1) {
        dp[vrbInx] = _casual["default"].integer(100000, 1000000);
      }
      if (vwbInx !== -1) {
        dp[vwbInx] = _casual["default"].integer(100, 10000);
      }
      if (vrrInx !== -1) {
        dp[vrrInx] = _casual["default"]["double"](100, 10000);
      }
      if (vwrInx !== -1) {
        dp[vwrInx] = _casual["default"]["double"](10, 1000);
      }
    });
  }
  return dps;
};
var getMetrics = function getMetrics(req, res) {
  var _ref = req.body || {},
    start = _ref.start,
    end = _ref.end,
    sampling = _ref.sampling,
    metrics = _ref.metrics,
    filter = _ref.filter;
  var data = [];
  var resourceID = getResourceID(filter);
  var samples = sampling ? Math.floor((end - start) / sampling) : 1;
  if (samples > 600) {
    var t = Date.now() / 1000;
    res.status(400).json({
      errors: [{
        reason: 'Too many data points',
        message: "The maximum number of allowed data points per requests is 600, while this query is asking for ".concat(samples, " data points (").concat(sampling, "-sec sampling)"),
        // eslint-disable-line
        field: 'start',
        rejectedValue: t
      }]
    }).end();
  }
  var _loop = function _loop(i) {
    var dpValues = generateDataPointValues(metrics, resourceID);
    var dpValuesWithTime = dpValues.map(function (dpValue) {
      return sampling ? {
        t: sampling * i + start,
        d: dpValue
      } : {
        d: dpValue
      };
    });
    data.push.apply(data, _toConsumableArray(dpValuesWithTime));
  };
  for (var i = 0; i < samples; i++) {
    _loop(i);
  }
  setTimeout(function () {
    return res.status(200).json({
      start: start,
      end: end,
      data: data
    }).end();
  }, _casual["default"].integer(3000, 10000));
};
var _default = getMetrics;
exports["default"] = _default;