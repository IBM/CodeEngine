"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateImageExportJob = exports.init = exports.getImageExportJobs = exports.getImageExportJob = exports.deleteImageExportJob = exports.createImageExportJob = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var JobStatuses = ['queued', 'running', 'succeeded', 'failed', 'deleting'];
var StatusReasons = ['code_tbd'];
var addImageExportJob = function addImageExportJob(jobs, data, imageId) {
  var _data$storage_bucket, _data$storage_bucket2;
  var jobStatus = data.status || _casual["default"].random_element(JobStatuses);
  var statusReasons = [{
    code: StatusReasons[0],
    message: StatusReasons[0]
    // more_info: 'https://cloud.ibm.com/docs/key-protect?topic=key-protect-restore-keys'
  }];

  var baseData = {
    id: _casual["default"].uuid,
    name: data.name || utils.generateName('export_job'),
    _image_id: imageId,
    created_at: new Date(),
    resource_type: 'image_export_job',
    status: jobStatus,
    status_reasons: statusReasons,
    storage_object: {
      name: utils.generateName('export_job_object')
    }
  };
  var bucket = _casual["default"].random_element(_server.db.getCollection(_server.COLS.cosBuckets).chain().data());
  baseData.storage_bucket = {
    name: ((_data$storage_bucket = data.storage_bucket) === null || _data$storage_bucket === void 0 ? void 0 : _data$storage_bucket.name) || utils.generateName('bucket') || bucket.Name,
    crn: ((_data$storage_bucket2 = data.storage_bucket) === null || _data$storage_bucket2 === void 0 ? void 0 : _data$storage_bucket2.crn) || utils.generateCRN({
      id: baseData.id
    })
  };
  baseData.storage_href = "cos://".concat(utils.getQueryRegion(), "/").concat(baseData.storage_bucket.name);
  switch (jobStatus) {
    case 'queued':
      delete baseData.storage_object;
      break;
    case 'running':
      baseData.started_at = new Date();
      break;
    case 'succeeded':
    case 'failed':
      baseData.started_at = new Date();
      baseData.completed_at = new Date();
      break;
    default:
  }
  var newImageExportJob = _objectSpread(_objectSpread({}, baseData), data);
  jobs.insert(newImageExportJob);
  return newImageExportJob.id;
};

/**
 * getAndVerifyExportJob()
 *
 * @param {*} req - the original request
 * @param {*} res - the original response
 * @param {*} removeMeta - boolean indicating whether to strip meta from the VPN Server Route.
 */
var getAndVerifyExportJob = function getAndVerifyExportJob(req, res) {
  var removeMeta = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  // Get our ids
  var image = req.params.image_id;
  var job = req.params.id;
  var collection = _server.db.getCollection(_server.COLS.images);
  var images = collection.find({
    id: req.params.image_id
  });
  if ((images === null || images === void 0 ? void 0 : images.length) === 0) {
    res.status(404).json(utils.generateErrors('image does not exist', 'image_does_not_exist', 'image_id', 'param')).end();
    return null;
  }
  // Now lets find our job
  var jobs = _server.db.getCollection(_server.COLS.image_export_jobs).chain().find({
    id: job,
    _image_id: image
  }).data({
    removeMeta: removeMeta
  });

  // Check that the jobs exists
  if (!jobs || jobs.length === 0) {
    res.status(404).json(utils.generateErrors("Export job not found with id ".concat(job, " for the image id ").concat(image), 'not_found', _server.COLS.image_export_jobs)).end();
    return null;
  }
  return jobs[0];
};

/**
 * formatImageExportJobForClient()
 *
 * @param {*} req
 * @param {*} job
 */
var formatImageExportJobForClient = function formatImageExportJobForClient(req, _job) {
  var job = _lodash["default"].cloneDeep(_job);
  job.href = "".concat(utils.getBaseApiUrl(req), "image/").concat(job._image_id, "/export_jobs/").concat(job.id);
  return job;
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
var getImageExportJobs = function getImageExportJobs(req, res) {
  var image = req.params.image_id;
  var collection = _server.db.getCollection(_server.COLS.images);
  var images = collection.find({
    id: req.params.image_id
  });
  if ((images === null || images === void 0 ? void 0 : images.length) === 0) {
    res.status(404).json(utils.generateErrors('image does not exist', 'image_does_not_exist', 'image_id', 'param')).end();
    return;
  }
  // Now lets find our route
  var jobs = _server.db.getCollection(_server.COLS.image_export_jobs).chain().find({
    _image_id: image
  }).data({
    removeMeta: true
  }).map(function (job) {
    return formatImageExportJobForClient(req, job);
  });
  res.status(200).json({
    export_jobs: jobs
  }).end();
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getImageExportJobs = getImageExportJobs;
var createImageExportJob = function createImageExportJob(req, res) {
  var _input$storage_bucket, _input$storage_bucket2;
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.image_export_jobs), input, req, res, 'resource with that name already exists', 'image')) {
    return;
  }
  if (!((_input$storage_bucket = input.storage_bucket) !== null && _input$storage_bucket !== void 0 && _input$storage_bucket.name) && !((_input$storage_bucket2 = input.storage_bucket) !== null && _input$storage_bucket2 !== void 0 && _input$storage_bucket2.crn)) {
    res.status(400).json(utils.generateErrors('storage_bucket is required', 'missing_type', 'field')).end();
    return;
  }
  var collection = _server.db.getCollection(_server.COLS.images);
  var images = collection.find({
    id: req.params.image_id
  });
  if ((images === null || images === void 0 ? void 0 : images.length) === 0) {
    res.status(404).json(utils.generateErrors('image does not exist', 'image_does_not_exist', 'image_id', 'param')).end();
    return;
  }
  var id = addImageExportJob(_server.db.getCollection(_server.COLS.image_export_jobs), input, req.params.image_id);
  req.params.id = id;
  var job = getAndVerifyExportJob(req, res, true);
  if (!job) {
    return;
  }
  res.status(201).json(formatImageExportJobForClient(req, job)).end();
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.createImageExportJob = createImageExportJob;
var getImageExportJob = function getImageExportJob(req, res) {
  var job = getAndVerifyExportJob(req, res, true);
  if (!job) {
    return;
  }
  res.status(200).json(formatImageExportJobForClient(req, job)).end();
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getImageExportJob = getImageExportJob;
var updateImageExportJob = function updateImageExportJob(req, res) {
  var imageExportJobsCol = _server.db.getCollection(_server.COLS.image_export_jobs);
  var job = imageExportJobsCol.find({
    id: req.params.id,
    _image_id: req.params.image_id
  });
  if (!job || job.length === 0) {
    res.status(404).end();
    return;
  }
  var originJob = job[0];
  var updatedJob = _objectSpread(_objectSpread({}, originJob), req.body);
  imageExportJobsCol.update(updatedJob);
  job = getAndVerifyExportJob(req, res, true);
  if (!job) return;
  res.status(200).json(formatImageExportJobForClient(req, job)).end();
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.updateImageExportJob = updateImageExportJob;
var deleteImageExportJob = function deleteImageExportJob(req, res) {
  var job = getAndVerifyExportJob(req, res, false);
  if (!job) return;
  _server.db.getCollection(_server.COLS.image_export_jobs).remove(job);
  res.status(204).end();
};
exports.deleteImageExportJob = deleteImageExportJob;
var init = function init() {
  _server.db.addCollection(_server.COLS.image_export_jobs);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  utils.repeat(function () {
    addImageExportJob(_server.db.getCollection(_server.COLS.image_export_jobs), {}, utils.getRandomResource(_server.COLS.images).id);
  }, 50);
};
exports.init = init;