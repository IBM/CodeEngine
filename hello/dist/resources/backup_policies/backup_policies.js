"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updatePolicy = exports.updatePlanForPolicy = exports.triggerPolicy = exports.init = exports.getPolicy = exports.getPolicies = exports.getPlansForPolicy = exports.getPlanForPolicy = exports.formatPlanForClient = exports.deletePolicy = exports.deletePlanForPolicy = exports.createPolicy = exports.createPlanForPolicy = exports.addPolicy = exports.addPlan = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = require("lodash");
var _server = require("../../server");
var utils = _interopRequireWildcard(require("../../utils"));
var _snapshots = require("../snapshots");
var _backup_policy_jobs = require("./backup_policy_jobs");
var _volumeAttachments = require("../volumeAttachments");
var _regions = require("../regions");
var _keyprotect = require("../../external/resources/keyprotect");
var _features = require("../features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var dayjs = require('dayjs');

// Constants

// const LifecycleStates = ['deleted', 'deleting', 'failed', 'pending', 'stable', 'updating', 'waiting', 'suspended'];
// @NOTE: currently only using available and pending statuses to make it easier to edit/delete/use
var LifecycleStates = ['stable', 'pending'];
var filter = function filter(req, res, resource) {
  // We need to filter based on source_volume and source_image
  if (req.query.tag) {
    var selectedTags = req.query.tag;
    return resource.match_user_tags.some(function (tag) {
      return selectedTags.includes(tag);
    });
  }

  /*
   * If there was no query parameter then we don't want to filter so
   * we just return true here.
   */
  return true;
};
var getPolicyRecord = function getPolicyRecord(req) {
  var removeMeta = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var backup_policies = _server.db.getCollection(_server.COLS.backup_policies).chain().find({
    id: req.params.policy_id
  }).data({
    removeMeta: removeMeta
  });
  if (!backup_policies || backup_policies.length === 0) {
    return undefined;
  }
  return backup_policies[0];
};
var formatDeletionTrigger = function formatDeletionTrigger(plan) {
  var delete_after = (0, _lodash.get)(plan, 'deletion_trigger.delete_after');
  var delete_over_count = (0, _lodash.get)(plan, 'deletion_trigger.delete_over_count');
  if (delete_after) {
    return {
      delete_after: delete_after
    };
  }
  return {
    delete_over_count: delete_over_count
  };
};
var formatRemoteRegionCopy = function formatRemoteRegionCopy(remoteRegionCopies) {
  var remoteRegionCopyData = remoteRegionCopies.map(function (remoteRegionCopy) {
    return {
      delete_over_count: remoteRegionCopy.delete_over_count ? remoteRegionCopy.delete_over_count : 5,
      region: remoteRegionCopy.region ? remoteRegionCopy.region : null,
      encryption_key: remoteRegionCopy.encryption_key
    };
  });
  return remoteRegionCopyData;
};
var formatPlanForClient = function formatPlanForClient(req, policyId, plan) {
  var isReference = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var formattedPlan = plan;
  formattedPlan.href = "".concat(utils.getBaseApiUrl(req), "backup_policies/").concat(policyId, "/plans/").concat(plan.id);
  formattedPlan.deletion_trigger = formatDeletionTrigger(formattedPlan);
  if (isReference) {
    formattedPlan = {
      deleted: plan.deleted,
      href: formattedPlan.href,
      id: plan.id,
      name: plan.name,
      resource_type: plan.resource_type || 'backup_policy_plan'
    };
  }
  return formattedPlan;
};
exports.formatPlanForClient = formatPlanForClient;
var formatPolicyForClient = function formatPolicyForClient(req, policy) {
  policy.href = "".concat(utils.getBaseApiUrl(req), "backup_policies/").concat(policy.id);
  policy.crn = utils.updateResourceCrnRegion(policy, req);
  policy.plans = (policy.plans || []).map(function (item) {
    return formatPlanForClient(req, policy.id, item, true);
  });
  var rg = utils.getResource(_server.COLS.resourceGroups, policy.resource_group.id);
  policy.resource_group = _objectSpread({
    name: rg && rg[0] && rg[0].name
  }, policy.resource_group);
  delete policy.region;
  return policy;
};
var formatPlanInput = function formatPlanInput(data) {
  var baseData = {
    active: true,
    attach_user_tags: [],
    copy_user_tags: true,
    created_at: utils.generateCreateDate(),
    cron_spec: '0 0 * * *',
    deletion_trigger: {
      delete_after: 30
    },
    href: '',
    // determined by formatPlanForClient()
    id: _casual["default"].uuid,
    lifecycle_state: _casual["default"].random_element(LifecycleStates),
    name: utils.generateName('backup_policy_plan'),
    resource_type: 'backup_policy_plan'
  };
  if (data.remote_region_policies && data.remote_region_policies.length > 0) {
    data.remote_region_policies = formatRemoteRegionCopy(data.remote_region_policies);
  }
  var newPolicy = _objectSpread(_objectSpread({}, baseData), data);
  return newPolicy;
};

/**
 * addPolicy() - adds a policy to the database
 * @param {*} policies
 * @param {*} data
 */
var addPolicy = function addPolicy(policies, data) {
  var baseData = {
    created_at: utils.generateCreateDate(),
    last_job_completed_at: utils.generateCreateDate(),
    crn: utils.generateCRN(),
    filters: data.match_resource_types === 'instance' ? ['exclude_boot_volume'] : ['exclude_full_instance_backup'],
    href: '',
    // determined by formatPolicyForClient()
    id: _casual["default"].uuid,
    lifecycle_state: _casual["default"].random_element(LifecycleStates),
    match_resource_types: data.match_resource_types || ['volume'],
    // supports instance or volume
    match_user_tags: [],
    name: utils.generateName('backup_policy'),
    plans: [],
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    resource_type: 'backup_policy',
    region: data.regionID || utils.getRandomRegion().name
  };
  var newPolicy = _objectSpread(_objectSpread({}, baseData), data);
  newPolicy.plans = (newPolicy.plans || []).map(function (plan) {
    return formatPlanInput(plan);
  });
  policies.insert(newPolicy);
  return newPolicy;
};

/**
 * getPolicies() - gets a paginated list of policies
 * @param {*} req
 * @param {*} res
 */
exports.addPolicy = addPolicy;
var getPolicies = function getPolicies(req, res) {
  var extraFilter = function extraFilter(resource) {
    return filter(req, res, resource);
  };
  var policies = utils.getResources(req, _server.COLS.backup_policies, extraFilter, 'created_at', {
    desc: true
  });
  policies.backup_policies.forEach(function (policy) {
    return formatPolicyForClient(req, policy);
  });
  res.json(policies).end();
};

/**
 * createPolicy() - creates a backup policy
 * @param {*} req
 * @param {*} res
 */
exports.getPolicies = getPolicies;
var createPolicy = function createPolicy(req, res) {
  var input = req.body;
  input.region = utils.getQueryRegion(req);
  // make sure we're not creating a policy that already exists
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.backup_policies), input, req, res, errorMsg, 'backup_policies')) {
    return;
  }

  // add the policy
  input.status = LifecycleStates[0];
  input.created_at = utils.generateNowDate();
  var newBackupPolicy = addPolicy(_server.db.getCollection(_server.COLS.backup_policies), input);
  // return the newly added snapshot
  var backup_policies = _server.db.getCollection(_server.COLS.backup_policies).chain().find({
    id: newBackupPolicy.id
  }).data({
    removeMeta: true
  });
  var policy = formatPolicyForClient(req, backup_policies[0]);
  res.status(201).json(policy).end();
};

/**
 * deletePolicy() - deletes a backup policy
 * @param {*} req
 * @param {*} res
 */
exports.createPolicy = createPolicy;
var deletePolicy = function deletePolicy(req, res) {
  var collection = _server.db.getCollection(_server.COLS.backup_policies);
  var results = collection.find({
    id: req.params.policy_id
  });
  var policy = results[0];
  if (!policy) {
    res.status(404).end();
    return;
  }
  collection.remove(policy);
  res.status(202).json(policy).end();
};

/**
 * getPolicy() - gets a single backup policy
 * @param {*} req
 * @param {*} res
 */
exports.deletePolicy = deletePolicy;
var getPolicy = function getPolicy(req, res) {
  var record = getPolicyRecord(req);
  if (!record) {
    res.status(404).end();
    return;
  }
  var policy = formatPolicyForClient(req, record);
  res.json(policy).end();
};

/**
 * updatePolicy() - updates a single backup policy
 * @param {*} req
 * @param {*} res
 */
exports.getPolicy = getPolicy;
var updatePolicy = function updatePolicy(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.backup_policies);
  var results = collection.find({
    id: req.params.policy_id
  });
  var policyToUpdate = results[0];
  if (!policyToUpdate) {
    res.status(404).end();
    return;
  }
  var updatedPolicy = _objectSpread(_objectSpread({}, policyToUpdate), input);
  collection.update(updatedPolicy);
  var updatedPolicyRecord = getPolicyRecord(req);
  var updatedResult = formatPolicyForClient(req, updatedPolicyRecord);
  res.status(200).json(updatedResult).end();
};
exports.updatePolicy = updatePolicy;
var generateRandomClonePolicy = function generateRandomClonePolicy(region) {
  var zones = [];
  if (region) {
    zones = (0, _regions.getZonesForRegion)(region);
  }

  // if we don't have zones, don't create a clone policy
  if (zones.length === 0) {
    return undefined;
  }
  var randomNbrOfZones = _casual["default"].integer(1, zones.length);
  zones = (0, _lodash.sampleSize)(zones, randomNbrOfZones);
  var formattedZones = zones.map(function (zone) {
    return {
      name: zone
    };
  });
  var clonePolicy = {
    max_snapshots: _casual["default"].integer(1, 10),
    zones: formattedZones
  };
  return clonePolicy;
};

/**
 * init() - initializes the backup policies model
 */
var init = function init() {
  var _getRootKey, _getRootKey2, _getRootKey3, _getRootKey4;
  var backupPolicies = _server.db.addCollection(_server.COLS.backup_policies);
  _server.db.addCollection(_server.COLS.backup_policy_jobs);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addPolicy(backupPolicies, {
    id: 'backup-policy-1001',
    lifecycle_state: 'stable',
    name: 'aaa-default-backup-policy-1',
    plans: [{
      id: 'backup-policy-plan-1001',
      active: true,
      attach_user_tags: ['defaultPlan:defaultPolicy'],
      copy_user_tags: true,
      cron_spec: '0 0 * * *',
      deletion_trigger: {
        delete_after: 30
      },
      name: 'default-backup-policy-1-default-plan',
      clone_policy: generateRandomClonePolicy('us-east'),
      remote_region_policies: []
    }],
    match_user_tags: ['defaultBackupTag:defaultBackupTagValue'],
    region: 'us-east'
  });
  addPolicy(backupPolicies, {
    id: 'backup-policy-1002',
    lifecycle_state: 'stable',
    name: 'aaa-default-backup-policy-2',
    plans: [{
      id: 'backup-policy-plan-1002',
      active: true,
      attach_user_tags: ['defaultPlan2:defaultPolicy1', 'defaultPlan2:defaultPolicy2', 'defaultPlan2:defaultPolicy3', 'defaultPlan2:defaultPolicy4', 'defaultPlan2:defaultPolicy5', 'defaultPlan2:defaultPolicy6', 'defaultPlan2:defaultPolicy7'],
      copy_user_tags: true,
      cron_spec: '0 0 * * *',
      deletion_trigger: {
        delete_after: 30
      },
      name: 'default-backup-policy-2-default-plan',
      clone_policy: generateRandomClonePolicy('us-east'),
      remote_region_policies: [{
        encryption_key: {
          crn: (_getRootKey = (0, _keyprotect.getRootKey)({
            region_name: 'eu-gb'
          })) === null || _getRootKey === void 0 ? void 0 : _getRootKey.crn
        },
        delete_over_count: 0,
        region: {
          name: 'eu-gb',
          href: 'https://eu-gb.iaas.cloud.ibm.com/v1/regions/eu-gb'
        }
      }, {
        encryption_key: {
          crn: (_getRootKey2 = (0, _keyprotect.getRootKey)({
            region_name: 'us-south'
          })) === null || _getRootKey2 === void 0 ? void 0 : _getRootKey2.crn
        },
        delete_over_count: 0,
        region: {
          name: 'us-south',
          href: 'https://us-south.iaas.cloud.ibm.com/v1/regions/us-south'
        }
      }, {
        encryption_key: {
          crn: (_getRootKey3 = (0, _keyprotect.getRootKey)({
            region_name: 'eu-de'
          })) === null || _getRootKey3 === void 0 ? void 0 : _getRootKey3.crn
        },
        delete_over_count: 0,
        region: {
          name: 'eu-de',
          href: 'https://eu-de.iaas.cloud.ibm.com/v1/regions/eu-de'
        }
      }]
    }],
    match_user_tags: ['defaultPlan2:defaultPolicy1', 'defaultPlan2:defaultPolicy2', 'defaultPlan2:defaultPolicy3', 'defaultPlan2:defaultPolicy4', 'defaultPlan2:defaultPolicy5', 'defaultPlan2:defaultPolicy6', 'defaultPlan2:defaultPolicy7'],
    region: 'us-east'
  });
  addPolicy(backupPolicies, {
    id: 'backup-policy-1003',
    lifecycle_state: 'stable',
    name: 'aaa-default-backup-policy-3',
    plans: [{
      active: true,
      attach_user_tags: [],
      copy_user_tags: true,
      cron_spec: '0 0 * * *',
      deletion_trigger: {
        delete_after: 30
      },
      name: 'default-backup-policy-3-default-plan',
      clone_policy: generateRandomClonePolicy('us-east'),
      remote_region_policies: [{
        encryption_key: {
          crn: (_getRootKey4 = (0, _keyprotect.getRootKey)({
            region_name: 'eu-de'
          })) === null || _getRootKey4 === void 0 ? void 0 : _getRootKey4.crn
        },
        delete_over_count: 0,
        region: {
          name: 'eu-de',
          href: 'https://eu-de.iaas.cloud.ibm.com/v1/regions/eu-de'
        }
      }]
    }],
    match_user_tags: [],
    region: 'us-east'
  });
  addPolicy(backupPolicies, {
    id: 'backup-policy-1004',
    lifecycle_state: 'stable',
    name: 'aaa-default-backup-policy-4-delete',
    plans: [{
      active: true,
      attach_user_tags: [],
      copy_user_tags: true,
      cron_spec: '0 0 * * *',
      deletion_trigger: {
        delete_after: 30
      },
      name: 'default-backup-policy-3-default-plan',
      clone_policy: generateRandomClonePolicy('us-east')
    }],
    match_user_tags: [],
    region: 'us-east'
  });
  addPolicy(backupPolicies, {
    id: 'backup-policy-instance',
    lifecycle_state: 'stable',
    name: 'default-backup-policy-instance-level',
    plans: [{
      active: true,
      attach_user_tags: ['defaultPlan:instanceLevelPolicy'],
      copy_user_tags: true,
      cron_spec: '0 0 * * *',
      deletion_trigger: {
        delete_after: 30
      },
      name: 'default-backup-policy-instance-level-plan',
      clone_policy: generateRandomClonePolicy('us-east')
    }],
    match_resource_types: ['instance'],
    match_user_tags: ['defaultPlan:instanceLevelPolicy'],
    region: 'us-east'
  });
};
exports.init = init;
var getPlansForPolicy = function getPlansForPolicy(req, res) {
  var policy = getPolicyRecord(req);
  var plans = policy.plans.map(function (plan) {
    return formatPlanForClient(req, policy.id, plan);
  });
  res.json({
    plans: plans
  }).end();
};
exports.getPlansForPolicy = getPlansForPolicy;
var getPlanForPolicy = function getPlanForPolicy(req, res) {
  var policy = getPolicyRecord(req);
  if (!policy) {
    res.status(404).end();
    return;
  }
  var plan = policy.plans.find(function (item) {
    return item.id === req.params.plan_id;
  });
  var formattedPlan = formatPlanForClient(req, policy.id, plan);
  res.json(formattedPlan).end();
};
exports.getPlanForPolicy = getPlanForPolicy;
var addPlan = function addPlan(policy, data) {
  var baseData = {
    active: true,
    created_at: utils.generateCreateDate(),
    last_job_completed_at: utils.generateCreateDate(),
    href: '',
    // determined by formatSnapshotForClient()
    id: _casual["default"].uuid,
    lifecycle_state: _casual["default"].random_element(LifecycleStates),
    name: utils.generateName('backup_policy_plan'),
    copy_user_tags: true,
    resource_type: 'backup_policy',
    deletion_trigger: {
      delete_after: 30
    },
    cron_spec: '0 0 * * *'
  };
  var newPolicy = _objectSpread(_objectSpread({}, baseData), data);
  newPolicy.deletionTrigger = formatDeletionTrigger(newPolicy);
  if (newPolicy.remote_region_policies && newPolicy.remote_region_policies.length > 0) {
    newPolicy.remote_region_policies = formatRemoteRegionCopy(newPolicy.remote_region_policies);
  }
  var plans = policy.plans;
  plans.push(newPolicy);
  return plans;
};
exports.addPlan = addPlan;
var createPlanForPolicy = function createPlanForPolicy(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.backup_policies);
  var policyToUpdate = getPolicyRecord(req, false);
  if (!policyToUpdate) {
    res.status(404).end();
    return;
  }
  var plans = addPlan(policyToUpdate, input);
  var updatedPolicy = _objectSpread(_objectSpread({}, policyToUpdate), {}, {
    plans: plans
  });
  collection.update(updatedPolicy);
  var updatedPolicyRecord = getPolicyRecord(req);
  var updatedPlan = updatedPolicyRecord.plans.find(function (item) {
    return item.name === input.name;
  });
  var updatedResult = formatPlanForClient(req, updatedPolicy.id, updatedPlan);
  res.status(201).json(updatedResult).end();
};
exports.createPlanForPolicy = createPlanForPolicy;
var deletePlanForPolicy = function deletePlanForPolicy(req, res) {
  var collection = _server.db.getCollection(_server.COLS.backup_policies);
  var policy = getPolicyRecord(req, false);
  if (!policy) {
    res.status(404).end();
    return;
  }
  var plans = policy.plans;
  var updatedPlans = plans.filter(function (item) {
    return item.id !== req.params.plan_id;
  });
  var plan = policy.plans.find(function (item) {
    return item.id === req.params.plan_id;
  });
  var formattedPlan = formatPlanForClient(req, policy.id, plan);
  var updatedPolicy = _objectSpread(_objectSpread({}, policy), {}, {
    plans: updatedPlans
  });
  collection.update(updatedPolicy);
  res.status(202).json(formattedPlan).end();
};
exports.deletePlanForPolicy = deletePlanForPolicy;
var updatePlanForPolicy = function updatePlanForPolicy(req, res) {
  var collection = _server.db.getCollection(_server.COLS.backup_policies);
  var input = req.body;
  var policy = getPolicyRecord(req, false);
  var plan = policy === null || policy === void 0 ? void 0 : policy.plans.find(function (item) {
    return item.id === req.params.plan_id;
  });
  if (!policy || !plan) {
    res.status(404).end();
    return;
  }
  var updatedPlans = policy.plans.map(function (item) {
    if (item.id === plan.id) {
      if (!(input !== null && input !== void 0 && input.remote_region_policies)) {
        item === null || item === void 0 ? true : delete item.remote_region_policies;
      }
      var temp = _objectSpread(_objectSpread({}, item), input);
      return temp;
    }
    return item;
  });
  var updatedPolicy = _objectSpread(_objectSpread({}, policy), {}, {
    plans: updatedPlans
  });
  collection.update(updatedPolicy);
  var updatedPlan = updatedPolicy.plans.find(function (item) {
    return item.id === plan.id;
  });
  var formattedPlan = formatPlanForClient(req, policy.id, updatedPlan);
  res.json(formattedPlan).end();
};
exports.updatePlanForPolicy = updatePlanForPolicy;
var createBackupJobsForPolicy = function createBackupJobsForPolicy(req, policy) {
  var _policy$plans$;
  var volumes = _server.db.getCollection(_server.COLS.volumes);
  var snapshots = _server.db.getCollection(_server.COLS.snapshots);
  var jobs = _server.db.getCollection(_server.COLS.backup_policy_jobs);
  var policyTags = policy.match_user_tags;
  // Get any volumes that matches any of the policyTags
  var matchingVolumes = volumes.where(function (volume) {
    var volumeTags = volume.user_tags;
    var matches = (0, _lodash.intersectionWith)(policyTags, volumeTags, _lodash.isEqual);
    return matches.length > 0;
  });
  var remoteRegionCopyData = ((_policy$plans$ = policy.plans[0]) === null || _policy$plans$ === void 0 ? void 0 : _policy$plans$.remote_region_policies) || [];
  var childrenSnapshots = [];

  // Create a snapshot for each matching volume.
  matchingVolumes.forEach(function (volume) {
    var crn = volume.crn,
      deleted = volume.deleted,
      encryption_key = volume.encryption_key,
      encryption = volume.encryption,
      href = volume.href,
      id = volume.id,
      name = volume.name,
      operating_system = volume.operating_system,
      resource_group = volume.resource_group,
      resource_type = volume.resource_type,
      source_image = volume.source_image,
      user_tags = volume.user_tags;
    var source_volume = {
      crn: crn,
      deleted: deleted,
      href: href,
      id: id,
      name: name,
      resource_type: resource_type,
      user_tags: user_tags
    };

    // create a snapshot for each volume. This is the parent snashot.
    var snapshotTemplate = {
      deletable: true,
      encryption_key: encryption_key,
      encryption: encryption,
      lifecycle_state: LifecycleStates[0],
      operating_system: operating_system,
      resource_group: resource_group,
      service_tags: ["backup-policy:policy-".concat(policy.id)],
      source_image: source_image,
      source_volume: source_volume,
      user_tags: policyTags,
      backup_policy_plan: policy.plans[0]
    };

    //  - snapshots need to have service_tags added that match the policy schema 'backup-policy:policy-{id}'
    // only attached volumes can have snapshots created of them
    var attachments = (0, _volumeAttachments.fetchAttachmentForVolume)(req, volume.id);
    if (attachments.length > 0) {
      var snapshot = (0, _snapshots.addSnapshot)(snapshots, snapshotTemplate);

      // Create remote copies if the remote region is enabled.
      remoteRegionCopyData.forEach(function (data) {
        var remoteRegionZone = utils.findZoneInRegion(data.region.name);
        var remoteCopiesTemplate = {
          deletable: true,
          encryption_key: encryption_key,
          encryption: encryption,
          lifecycle_state: LifecycleStates[0],
          operating_system: operating_system,
          resource_group: resource_group,
          service_tags: ["backup-policy:policy-".concat(policy.id)],
          source_image: source_image,
          source_volume: source_volume,
          user_tags: policyTags,
          zone: remoteRegionZone,
          source_snapshot: snapshot,
          clones: [],
          copies: []
        };
        childrenSnapshots = (0, _snapshots.addSnapshot)(snapshots, remoteCopiesTemplate);
      });

      // Update the parent snashot with the remote copies if the cross region enabled
      if (childrenSnapshots.length > 0) {
        childrenSnapshots.forEach(function (data) {
          snapshot.copies = [{
            crn: data.crn,
            href: data.href,
            name: data.name,
            remote: {
              name: data.zone.region_name
            },
            resource_type: data.resource_type
          }];
        });
      }
      var source = {
        crn: source_volume.crn,
        deleted: source_volume.deleted,
        href: source_volume.href,
        id: source_volume.id,
        name: source_volume.id,
        resource_type: source_volume.resource_type
      };
      if (policy.match_resource_types.includes('instance')) {
        /* usually we'd want to match the tags on the vsi
         with the tags on the policy but the tags on vsi is random
        here so just pick a random vsi */
        var randomInstance = utils.getRandomUniqueResource(_server.COLS.instances);
        source = {
          crn: randomInstance.crn,
          deleted: randomInstance.deleted,
          href: randomInstance.href,
          id: randomInstance.id,
          name: randomInstance.name,
          resource_type: ['instance']
        };
      }

      // Create a backup job record with the 'succeeded' status
      var jobTemplate = {
        target_snapshot: {
          crn: snapshot.crn,
          deleted: snapshot.deleted,
          href: snapshot.href,
          id: snapshot.id,
          name: snapshot.name,
          resource_type: snapshot.resource_type
        },
        target_snapshots: [{
          crn: snapshot.crn,
          deleted: snapshot.deleted,
          href: snapshot.href,
          id: snapshot.id,
          name: snapshot.name,
          resource_type: snapshot.resource_type
        }],
        plan_id: policy.plans[0].id,
        policy_id: policy.id,
        source_volume: {
          crn: source_volume.crn,
          deleted: source_volume.deleted,
          href: source_volume.href,
          id: source_volume.id,
          name: source_volume.id,
          resource_type: source_volume.resource_type
        },
        source: source,
        status: 'succeeded',
        job_type: 'creation',
        backup_policy_plan: {
          deleted: undefined,
          href: policy.plans[0].href,
          id: policy.plans[0].id,
          name: policy.plans[0].name,
          resource_type: 'backup_policy_plan'
        }
      };
      (0, _backup_policy_jobs.addJob)(jobs, jobTemplate);
    }
  });
};
var createRetentionJobsForPolicy = function createRetentionJobsForPolicy(req, policy) {
  var snapshots = _server.db.getCollection(_server.COLS.snapshots);
  var jobs = _server.db.getCollection(_server.COLS.backup_policy_jobs);
  // create a retention job for each expired snapshot per plan
  // go through each policy plan
  policy.plans.forEach(function (plan) {
    var jobFilter = function jobFilter(job) {
      return job.plan_id === plan.id && job.job_type === 'backup';
    };
    // get all jobs that match this planID
    var matchingJobs = jobs.chain().where(jobFilter).simplesort('created_at', {
      desc: true
    }).data({
      removeMeta: true
    });

    // get its retention type (days/number)
    var deletion_trigger = plan.deletion_trigger;
    var oldJobs = matchingJobs;
    if (deletion_trigger.delete_after) {
      var deleteAfterDate = dayjs().subtract(deletion_trigger.delete_after, 'days');
      oldJobs = oldJobs.filter(function (job) {
        return dayjs(job.created_at).isSameOrBefore(deleteAfterDate);
      });
    }
    if (deletion_trigger.delete_over_count) {
      oldJobs = oldJobs.slice(deletion_trigger.delete_over_count);
    }
    oldJobs.forEach(function (oldJob) {
      var target_snapshot = oldJob.target_snapshot;
      // const shouldDeleteSnapshot = backup_info.resource_type === 'snapshot' && backup_info.deleted === undefined;
      var shouldDeleteSnapshot = true;
      if (shouldDeleteSnapshot) {
        var snapshotID = target_snapshot.id;
        var records = snapshots.find({
          id: snapshotID
        });
        if (records.length > 0) {
          var snapshot = records[0];
          // delete the matching snapshot (if exists)
          snapshots.remove(snapshot);
          var deletedInfo = {
            more_info: 'https://cloud.ibm.com/apidocs/vpc#deleted-resources',
            deleted_at: dayjs().toISOString(),
            final_name: utils.generateDeletedName(snapshotID)
          };

          // create the retention job record
          var jobTemplate = {
            target_snapshot: {
              crn: snapshot.crn,
              deleted: deletedInfo,
              href: snapshot.href,
              id: snapshot.id,
              name: deletedInfo.final_name,
              resource_type: snapshot.resource_type
            },
            backup_resource_type: 'snapshot',
            plan_id: oldJob.plan_id,
            policy_id: oldJob.policy_id,
            source: oldJob.source_volume,
            status: 'succeeded',
            job_type: 'deletion',
            backup_policy_plan: _objectSpread({}, oldJob.backup_policy_plan)
          };
          (0, _backup_policy_jobs.addJob)(jobs, jobTemplate);
        }
      }
    });
  });
};

/**
 * triggerPolicy() - simulate the cron for a policy's plans execution
 * @param {*} req
 * @param {*} res
 */
var triggerPolicy = function triggerPolicy(req, res) {
  var policy = getPolicyRecord(req);
  if (!policy) {
    res.status(404).end();
  }
  createBackupJobsForPolicy(req, policy);
  createRetentionJobsForPolicy(req, policy);
  res.status(200).end();
};
exports.triggerPolicy = triggerPolicy;