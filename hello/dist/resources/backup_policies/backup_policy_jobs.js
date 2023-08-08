"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getJobs = exports.getJob = exports.addJob = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _backup_policies = require("./backup_policies");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// Constants
// const statuses = ['running', 'failed', 'succeeded', 'deleted'];
var statuses = ['running', 'failed', 'succeeded'];
var filter = function filter(req, res, resource) {
  var sourceVolumeID = req.query['source_volume.id'];
  var sourceSnapshotID = req.query['target_snapshot[0].id'];
  var jobStatus = req.query.status;
  var planID = req.query.plan_id;
  var policyID = req.params.policy_id;
  var hasExtraFilter = sourceVolumeID || sourceSnapshotID || jobStatus || planID;
  var policyMatch = resource.policy_id === policyID;
  var match = policyMatch;
  if (hasExtraFilter) {
    var volumeMatch = true;
    var snapshotMatch = true;
    var statusMatch = true;
    var planMatch = true;
    if (sourceVolumeID) {
      volumeMatch = resource.source_volume.id === sourceVolumeID;
    }
    if (sourceSnapshotID) {
      snapshotMatch = resource.target_snapshot.id === sourceSnapshotID;
    }
    if (jobStatus) {
      statusMatch = resource.status === jobStatus;
    }
    if (planID) {
      planMatch = resource.backup_policy_plan.id === planID;
    }
    match = policyMatch && volumeMatch && snapshotMatch && statusMatch && planMatch;
  }
  return match;
};
var getPolicyJobRecord = function getPolicyJobRecord(req) {
  var removeMeta = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var jobs = _server.db.getCollection(_server.COLS.backup_policy_jobs).chain().find({
    id: req.params.job_id
  }).data({
    removeMeta: removeMeta
  });
  if (!jobs || jobs.length === 0) {
    return undefined;
  }
  return jobs[0];
};
var getPolicyPlan = function getPolicyPlan(policyID, planID) {
  var policies = _server.db.getCollection(_server.COLS.backup_policies).chain().find({
    id: policyID
  }).data({
    removeMeta: true
  });
  if (policies.length > 0) {
    var plan = policies[0].plans.find(function (item) {
      return item.id === planID;
    });
    return plan;
  }
  return undefined;
};
var formatJobForClient = function formatJobForClient(req, job) {
  var policy_id = job.policy_id,
    plan_id = job.plan_id;
  if (plan_id && policy_id) {
    // fetch the plan from the policy
    var plan = getPolicyPlan(policy_id, plan_id);
    job.backup_policy_plan = (0, _backup_policies.formatPlanForClient)(req, policy_id, plan, true);
  }
  job.href = "".concat(utils.getBaseApiUrl(req), "backup_policies/").concat(job.id);
  delete job.policy_id;
  delete job.plan_id;
  return job;
};

/**
 * getJob() - gets a single backup policy job
 * @param {*} req
 * @param {*} res
 */
var getJob = function getJob(req, res) {
  var record = getPolicyJobRecord(req);
  if (!record) {
    res.status(404).end();
    return;
  }
  var job = formatJobForClient(req, record);
  res.json(job).end();
};

/**
 * addJob() - adds a job to the database
 * @param {*} jobs
 * @param {*} data
 */
exports.getJob = getJob;
var addJob = function addJob(jobs, data) {
  var createdDate = utils.generateCreateDate();
  var completedDate = utils.generateLaterDate(createdDate);
  var baseData = {
    backup_policy_plan: undefined,
    completed_at: completedDate,
    last_job_completed_at: createdDate,
    created_at: createdDate,
    href: '',
    id: _casual["default"].uuid,
    job_type: 'creation',
    resource_type: 'backup_policy_job',
    plan_id: '',
    policy_id: '',
    source_volume: undefined,
    source: undefined,
    status: _casual["default"].random_element(statuses),
    status_reasons: [],
    target_snapshot: undefined,
    target_snapshots: undefined
  };
  var newJob = _objectSpread(_objectSpread({}, baseData), data);
  jobs.insert(newJob);
  return newJob;
};
exports.addJob = addJob;
var getJobs = function getJobs(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var jobs = utils.getResources(req, _server.COLS.backup_policy_jobs, extraFilter, 'created_at', {
    desc: true
  });
  jobs.backup_policy_jobs.forEach(function (job) {
    return formatJobForClient(req, job);
  });

  // UI-18161 - swap the `backup_policy_jobs` key for `jobs`
  var result = _objectSpread(_objectSpread({}, jobs), {}, {
    jobs: jobs.backup_policy_jobs,
    backup_policy_jobs: undefined
  });
  res.json(result).end();
};
exports.getJobs = getJobs;