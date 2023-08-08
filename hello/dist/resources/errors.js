"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateError = exports.processRequest = exports.init = exports.getErrors = exports.getError = exports.deleteErrors = exports.deleteError = exports.createError = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var utils = _interopRequireWildcard(require("../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var match = require('urlp-js');

/**
 * Errors - RIAS-MOCK - Mock Error Generation Control Sytem
 *
 * This module provides the mock error generation control system for
 * rias-mock. It has two primary use cases:
 *
 *   1. Enable testing of error cases in functional tests.
 *   2. Assist with debug and analysis of reported error cases.
 *
 * The error system defines a rias-mock control layer that sits above the
 * normal rias-mock endpoints. It is only active when errors are defined
 * in the system and the control system is enabled.
 *
 * A set of error cases may be defined and processed against all incoming
 * server requests. Each error cases defines two things.
 *
 *   1. Match criteria - a set of attributes that enables a precise and
 *      flexible method of identifying particular requests.
 *
 *   2. Error response - that should be returned if the match is found.
 *
 * Error and control system data are stored only in memory. This is
 * done for two reasons. First the information is considered rias-mock
 * server control data not and not cloud state data. The second reason is
 * that we will need to check against this control data for every single
 * system request and we would prefer not to add any additional unnecessary
 * overhead.
 *
 * In normal operation the error system will not be active. No errors will
 * be generated unless a client makes calls to the error control system to
 * activate it. The number of errors defined is never expected to be more
 * than at most a handful of errors cases and only when the error system
 * is in use.
 *
 * Another mode of operation is for rias-mock developers. By enabling the
 * USE_DEUBG_ERROR_CASES flag, the errorCases defined in the debugErrorCases
 * array will be active by default. This is a developer mode only and should
 * never be enabled in production systems. This mode may be useful in
 * cases when mock error generation / testing / analysis is desired.
 *
 * At some point we may define a library of error cases so that they do not
 * need to be defined in long form via the rest API which may be inconvenient.
 * For now we can just use commented debugErrorCases for this purpose.
 *
 */
var DEBUG = false;
var ENABLE_DEBUG_ERROR_CASES = false;

// Default control state values
var defaultControlState = {
  checkForErrors: true
};

// Define default error match conditions
var defaultRequestMatch = {
  body: null,
  operation: null,
  urlEnds: null,
  urlBegins: null,
  urlPattern: null,
  probability: 1
};

// Defines a default error for cases when one is not provided by
var defaultError = {
  errorCode: 999,
  errors: {
    code: 'mock_rias_error_none_provided',
    message: 'This is the default error message for rias-mock if none was provided.',
    more_info: 'https://cloud.ibm.com/docs/vpc-on-classic?topic=vpc-on-classic-rias-error-messages#not_found',
    target: {
      name: '00000000-0000-0000-0000-000000000000',
      type: 'rias_mock_none_provided'
    }
  }
};

// This is the default error case provided if none was provided
var defaultErrorCase = _objectSpread(_objectSpread({
  id: null
}, defaultRequestMatch), defaultError);

// A Template Error Case
// {
//   body: { name: 'joe' }
//   operation: 'POST',
//   urlEnds: '/vpcs',
//   urlContains: '/vpcs'
//   urlPattern: 'rias-mock/:region/subnets/:subnet_id'
//   probability: 0.5
//   errorCode: 400,
//   errors: [
//     {
//       code: 'not_found',
//       message: 'Please check whether resource you are requesting exists.',
//       more_info: 'https://cloud.ibm.com/docs/vpc-on-classic?topic=vpc-on-classic-rias-error-messages#not_found',
//       target: {
//         name: '00000000-0000-0000-0000-000000000000',
//         type: 'vpc',
//       },
//     },
//   ],
// },

/**
 * This is in lieu of our future error library. We can store commented or
 * uncommented debug error cases here. These are useful for cases when a
 * developer wants to experiment with particular error cases. Rather than
 * remove them after testing - leave cases commented so they might be used
 * later for addition to our library. If related to a JIRA issue, provide
 * a reference to it in comments.
 */
var debugErrorCases = [
// {
//   errorCode: 909,
//   errors: [
//     {
//       code: 'all_error_case',
//       message: 'Please check whether resource you are requesting exists.',
//       more_info: 'https://cloud.ibm.com/docs/vpc-on-classic?topic=vpc-on-classic-rias-error-messages#not_found',
//     },
//   ],
// },

// {
//   operation: 'GET',
//   urlEnds: 'resourcemanager-mock/v2/resource_groups',
//   body: null,
//   errorCode: 500,
// },
// {
//   operation: 'POST',
//   urlEnds: '/vpcs',
//   body: null,
//   errorCode: 400,
//   errors: [
//     {
//       code: 'not_found',
//       message: 'Please check whether resource you are requesting exists.',
//       more_info: 'https://cloud.ibm.com/docs/vpc-on-classic?topic=vpc-on-classic-rias-error-messages#not_found',
//       target: {
//         name: '00000000-0000-0000-0000-000000000000',
//         type: 'vpc',
//       },
//     },
//   ],
// },

{
  // This is to reproduce UI-9991
  operation: 'POST',
  urlEnds: '/vpcs',
  body: null,
  errorCode: 400,
  errors: [{
    code: 'over_quota',
    message: 'Please check whether resource you are requesting exists.',
    more_info: 'https://cloud.ibm.com/docs/vpc-on-classic?topic=vpc-on-classic-rias-error-messages#not_found'
  }]
}, {
  // To reproduce UI-10070
  // Generate errors when we get subnets
  // Load LB details with this in place.
  body: null,
  operation: 'GET',
  urlPattern: '/rias-mock/:region/v1/subnets/:subnet_id',
  errorCode: 404,
  errors: [{
    code: 'not_found',
    message: 'Subnet not found'
  }]
}, {
  // To reproduce UI-10070
  // Generate errors when we get subnets
  // Load subnet details with this in place.
  body: null,
  operation: 'GET',
  urlPattern: '/rias-mock/v1/subnets/:subnet_id',
  errorCode: 404,
  errors: [{
    code: 'not_found',
    message: 'Subnet not found'
  }]
}, {
  // To reproduce UI-26265
  // Generate error when provisioning backup policies without having the proper Service-to-Service authorizations set up
  body: null,
  operation: 'POST',
  urlEnds: '/backup_policies',
  errorCode: 400,
  errors: [{
    code: 'backup_policies_s2s_setup_not_completed',
    message: 'Service-to-service authorization has not been correctly setup for this account.'
  }]
}];

// These are the values that we will use for live error processing
var errorCases = [];
var errorControl = {};
var findError = function findError(errorID) {
  return errorCases.find(function (error) {
    return error.id === errorID;
  });
};
var initErrorControl = function initErrorControl() {
  errorControl = _objectSpread({}, defaultControlState);
};
var initErrorData = function initErrorData() {
  errorCases = [];
  // Add in the debug error cases if developer enabled this flag
  if (ENABLE_DEBUG_ERROR_CASES) {
    errorCases = [].concat(_toConsumableArray(errorCases), debugErrorCases);
  }
};
var formatErrorForClient = function formatErrorForClient(req, error) {
  var result = _objectSpread({}, error);
  result.href = "".concat(utils.getBaseServerUrl(req), "/errors/").concat(error.id);
  return result;
};
var init = function init() {
  initErrorControl();
  initErrorData();
  if (DEBUG) console.log('errors.init()');
};
exports.init = init;
var addError = function addError(errorCasesParam, data) {
  var errorCase = _objectSpread(_objectSpread({}, defaultErrorCase), data);
  errorCase.id = errorCase.id || casual.uuid;
  errorCasesParam.push(errorCase);
  return errorCase.id;
};

/**
 * createError()
 *
 * Add an error case into the error system.
 *
 * @param {} req
 * @param {*} res
 */
var createError = function createError(req, res) {
  var input = req.body;
  var id = addError(errorCases, input);
  var error = findError(id);
  var formattedErrorCase = formatErrorForClient(req, error);
  res.status(201).json(formattedErrorCase).end();
};

/**
 * getErrors()
 *
 * Returns all of the defined error cases.
 *
 * @param {*} req
 * @param {*} res
 */
exports.createError = createError;
var getErrors = function getErrors(req, res) {
  var errorsForClient = errorCases.map(function (error) {
    return formatErrorForClient(req, error);
  });
  var allErrorsForClient = {
    errors: errorsForClient
  };
  res.json(allErrorsForClient).end();
};

/**
 * deleteErrors()
 *
 * Reinitialises all error cases defined in the system. Normally this clears
 * all of the defined error cases. (Unless ENABLE_DEBUG_ERROR_CASES is
 * enabled.)
 *
 * @param {*} req
 * @param {*} res
 */
exports.getErrors = getErrors;
var deleteErrors = function deleteErrors(req, res) {
  errorCases = [];
  res.status(204).end();
};

/**
 * getError()
 *
 * Returns the error whose id was provided. If the error is not found
 * returns 404.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteErrors = deleteErrors;
var getError = function getError(req, res) {
  var error_id = req.params.error_id;
  var error = findError(error_id);
  if (!error) {
    res.status(404).end();
    return;
  }
  var errorForClient = formatErrorForClient(req, error);
  res.json(errorForClient).end();
};

/**
 * deleteError()
 *
 * Deletes the error whose id was provided. If the error is not found
 * returns 404.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getError = getError;
var deleteError = function deleteError(req, res) {
  var error_id = req.params.error_id;
  var error = findError(error_id);
  if (!error) {
    res.status(404).end();
    return;
  }
  _lodash["default"].pull(errorCases, error);
  res.status(204).end();
};

/**
 * updateError()
 *
 * Update the error whose is was provided. If the error is not found
 * returns 404.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteError = deleteError;
var updateError = function updateError(req, res) {
  var input = req.body;
  var error_id = req.params.error_id;
  var error = findError(error_id);
  if (!error) {
    res.status(404).end();
    return;
  }
  var updatedError = _objectSpread(_objectSpread({}, error), input);
  _lodash["default"].pull(errorCases, error);
  errorCases.push(updatedError);
  var resultError = findError(error_id);
  var resultErrorForClient = formatErrorForClient(req, resultError);
  res.status(200).json(resultErrorForClient).end();
};

/**
 * processRequest()
 *
 * Process an incoming request against all of the defined error cases. This is
 * the core functionality of the error control system.
 *
 * We check the following for matches:
 * - body: { param1: value1, param2: value2} - the request body has these param values
 * - operation: {GET, PUT, POST, DELETE ... }
 * - urlContains - the request URL contains this string
 * - urlEnds - the request URL ends with this string
 * - urlPattern - the request matches the defined URL pattern (use this one!)
 * - probability - value between 0 and 1
 *
 * If a matching parameter is not defined it is considered to be a match.
 *
 * @param {*} req - req object
 * @param {*} res - response object
 * @param {*} next - next handler
 */
exports.updateError = updateError;
var processRequest = function processRequest(req, res, next) {
  // First check if we should bypass the error control system.
  if (errorControl && errorControl.checkForErrors && errorCases && errorCases.length) {
    // Check for matches against operations
    var matchedOperations = errorCases.filter(function (errorCase) {
      return !errorCase.operation || errorCase.operation === req.method;
    });

    // Check for matches against URL substrings
    var matchedUrlContains = matchedOperations.filter(function (errorCase) {
      return !errorCase.urlContains || req.path.includes(errorCase.urlContains);
    });

    // Check for matches against URL termination
    var matchedUrlEndings = matchedUrlContains.filter(function (errorCase) {
      return !errorCase.urlEnds || req.path.endsWith(errorCase.urlEnds);
    });

    // Check for matches against URL patterns
    var matchedUrlPatterns = matchedUrlEndings.filter(function (errorCase) {
      if (errorCase.urlPattern) {
        // This is for convenience in debugging
        var matchPattern = errorCase.urlPattern;
        var requestPath = req.path;
        var result = match(matchPattern, requestPath);
        return result.match;
      }
      return true;
    });

    // Check for matches against request body parameters
    var matchedBodies = matchedUrlPatterns.filter(function (errorCase) {
      var result = true;
      // We are using Object.keys so we only iterate over our direct properties
      var keys = Object.keys(errorCase.body || {}) || [];
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      var _iterator = _createForOfIteratorHelper(keys),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var key = _step.value;
          if (req.body[key] !== errorCase.body[key]) {
            result = false;
            break;
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      return result;
    });

    // Factor in probability metric
    var matchedAll = matchedBodies.filter(function (errorCase) {
      return !errorCase.probability || errorCase.probability > Math.random();
    });
    if (matchedAll.length > 0) {
      // We report an error for the first match
      var errors = matchedAll[0].errors || defaultError.errors;
      var result = {
        errors: errors,
        trace: 'no-trace-available',
        mock_error: true
      };
      if (DEBUG) console.log("Returning mock_error for request: ".concat(req.method, " ").concat(req.path));
      res.status(matchedAll[0].errorCode).json(result).end();
      return;
    }
  }
  // No error case match was made
  if (DEBUG) console.log("Handling request: ".concat(req.method, " ").concat(req.path));
  next();
};
exports.processRequest = processRequest;