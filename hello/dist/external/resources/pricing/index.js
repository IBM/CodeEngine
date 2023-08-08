"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.calculatePricing = void 0;
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var pricingDefinition = require('./pricingDefinition.json');
var casual = require('casual');
var init = function init() {};
exports.init = init;
var calculatePricing = function calculatePricing(req, res) {
  var body = req.body;
  var resBody = _objectSpread({}, body);
  var service_id = resBody.service_id;
  var isInstanceMonthly = service_id === 'is.instance' && !body.start;
  var pricingDef = pricingDefinition.pricingDefinitions.find(function (price) {
    return price.service_id === service_id;
  });
  if (!pricingDef) {
    resBody.metrics = resBody.measures.map(function (measure) {
      return {
        name: measure.measure,
        quantity: measure.quantity,
        cost: 0.1
      };
    });
    resBody.cost = resBody.measures.length * 0.1;
  } else {
    var reqMeasures = body.measures;
    resBody.metrics = reqMeasures.map(function (reqMeasure) {
      var matchedMeasure = pricingDef.measures.find(function (measureDef) {
        return measureDef.name === reqMeasure.measure;
      });
      var metric = {};
      if (matchedMeasure) {
        metric.name = matchedMeasure.metrics_name;
        if (reqMeasure.measure === 'VOLUME') {
          metric.quantity = reqMeasure.quantity * 720;
        } else {
          metric.quantity = reqMeasure.quantity;
        }
        metric.cost = metric.quantity * matchedMeasure.cost;
      } else {
        metric.name = reqMeasure.measure;
        metric.quantity = reqMeasure.quantity;
        metric.cost = 0.1;
      }
      if (isInstanceMonthly) {
        var discount = Math.round(metric.cost * 72);
        metric.cost = metric.cost * 720 - casual.integer(1, discount > 1 ? discount : 1);
      }
      return metric;
    });
    resBody.cost = resBody.metrics.reduce(function (sum, cur) {
      return sum + cur.cost;
    }, 0);
  }
  res.status(200).json(resBody).end();
};
exports.calculatePricing = calculatePricing;