"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateInstanceGroupPolicy = exports.updateInstanceGroupMembership = exports.updateInstanceGroupManager = exports.updateInstanceGroupAction = exports.updateInstanceGroup = exports.init = exports.getInstanceGroups = exports.getInstanceGroupPolicy = exports.getInstanceGroupPolicies = exports.getInstanceGroupMemberships = exports.getInstanceGroupMembership = exports.getInstanceGroupManagers = exports.getInstanceGroupManager = exports.getInstanceGroupActions = exports.getInstanceGroupAction = exports.getInstanceGroup = exports.detachInstanceGroupMemberships = exports.detachInstanceGroupMembership = exports.deleteInstanceGroupPolicy = exports.deleteInstanceGroupManager = exports.deleteInstanceGroupLoadBalancer = exports.deleteInstanceGroupAction = exports.deleteInstanceGroup = exports.createInstanceGroupPolicy = exports.createInstanceGroupManager = exports.createInstanceGroupAction = exports.createInstanceGroup = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _lodash = _interopRequireDefault(require("lodash"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _members = require("./load_balancers/members");
var _instances = require("./instances");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// const groupStatuses = ['scaling', 'healthy', 'unhealthy'];
// @NOTE: currently only using healthy and unhealthy statuses to make it easier to edit/delete/use
var groupStatuses = ['healthy', 'unhealthy'];
var actionStatuses = ['active', 'completed', 'failed', 'new', 'omitted'];

/**
 * We want to make it look like most of the groups are healthy so
 * we'll only use the other statuses 33% of the time.
 */
var getRandomStatus = function getRandomStatus() {
  if (_casual["default"].integer(0, 3) % 3 === 0) {
    return _casual["default"].random_element(groupStatuses);
  }
  return 'healthy';
};

// keep track of all VSI ids we used as members of groups since we should have a VSI be a member of only 1 group, not more.
var usedIds = [];
// eslint-disable-next-line default-param-last
var addManagerToGroup = function addManagerToGroup(id, newInstanceGroup) {
  var data = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var type = arguments.length > 3 ? arguments[3] : undefined;
  var req = arguments.length > 4 ? arguments[4] : undefined;
  var group = (utils.getResource(_server.COLS.instance_groups, id) || [])[0];
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var managers = _server.db.getCollection(_server.COLS.instance_group_managers);
  var baseData = {
    id: _casual["default"].uuid,
    manager_type: 'autoscale',
    management_enabled: _casual["default"].integer(0, 7) % 7 !== 1,
    policies: [],
    actions: []
  };
  baseData.href = "".concat(req ? utils.getBaseApiUrl(req) : '/api/v1/', "instance_groups/").concat(id, "/managers/").concat(baseData.id);
  var min;
  var max;
  var aggregation_window;
  var cooldown;
  var autoScaleManagerSizeCardParams = newInstanceGroup.managers && newInstanceGroup.managers.length ? newInstanceGroup.managers[0] : null;
  if (data.manager_type === 'scheduled' || type === 'scheduled') {
    baseData = _objectSpread(_objectSpread({}, baseData), {}, {
      manager_type: 'scheduled',
      timezone: 'utc'
    });
  } else {
    if (!autoScaleManagerSizeCardParams) {
      if (data.max_membership_count === undefined) {
        // in here means we're auto generating groups. otherwise if creating from user action data would be populated with input
        if (_casual["default"].integer(0, 6) % 6 === 1 && !group.auto_scale_manager) return null; // randomize some groups with no managers
        if (_casual["default"].integer(0, 9) % 9 === 1) {
          // edge case, have min and max be the same;
          min = _casual["default"].integer(0, 100);
          max = min;
        } else if (_casual["default"].integer(0, 10) % 10 === 1) {
          // edge case, have min and max be furthest apart
          min = 0;
          max = 100;
        } else {
          min = _casual["default"].integer(1, 100);
          max = _casual["default"].integer(min, 100);
        }
      }
      aggregation_window = _casual["default"].integer(90 / 30, 600 / 30) * 30; // aggregation window needs to be divisible by 30
      cooldown = _casual["default"].integer(120 / 60, 3600 / 60) * 60; // cooldown needs to be divisible by 60
    } else {
      aggregation_window = autoScaleManagerSizeCardParams.aggregationWindow;
      cooldown = autoScaleManagerSizeCardParams.cooldown;
      min = autoScaleManagerSizeCardParams.minMembershipCount;
      max = autoScaleManagerSizeCardParams.maxMembershipCount;
    }
    baseData = _objectSpread(_objectSpread({}, baseData), {}, {
      aggregation_window: aggregation_window,
      cooldown: cooldown,
      max_membership_count: max,
      min_membership_count: min
    });
  }
  var newManager = _objectSpread(_objectSpread({}, baseData), data);
  var oldManagers = group.managers || [];
  var newManagers = [].concat(_toConsumableArray(oldManagers), [newManager]);
  groups.update(_objectSpread(_objectSpread({}, group), {}, {
    managers: newManagers
  }));
  managers.insert(newManager);
  return baseData.id;
};
var setPoliciesOnManager = function setPoliciesOnManager(groupId, managerId) {
  var data = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var isModify = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var isDelete = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var manager = (utils.getResource(_server.COLS.instance_group_managers, managerId) || [])[0];
  var group = (utils.getResource(_server.COLS.instance_groups, groupId) || [])[0];
  var managers = _server.db.getCollection(_server.COLS.instance_group_managers);
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var policies = _server.db.getCollection(_server.COLS.instance_group_policies);
  var type = data.policy_type;
  var trigger = {
    type: data.type,
    metric_type: data.metric_type,
    metric_value: data.metric_value
  };
  var policyId = data.id || _casual["default"].uuid;
  var policyHref = "".concat(manager.href, "/policies/").concat(policyId);
  var availableMetric = ['cpu', 'memory', 'network_in', 'network_out'].find(function (m) {
    return manager.policies.every(function (p) {
      return p.metric_type !== m;
    });
  });
  if (data.policy_type === undefined && !isDelete) {
    // in here means we're auto generating groups. otherwise if creating from user action data would be populated with input
    if (_casual["default"].integer(0, 6) % 6 === 1 && !isModify) return null; // randomize some groups with no policies
    if (_casual["default"].integer(0, 1) % 2 === 1 && availableMetric) {
      // edge case, have min and max be the same;
      type = 'target';
      var value = _casual["default"].integer(10, availableMetric === 'cpu' || availableMetric === 'memory' ? 90 : 10000000);
      trigger = {
        metric_type: availableMetric,
        metric_value: value
      };
    }
  }
  var policy = _objectSpread({
    id: policyId,
    href: policyHref,
    name: data.name,
    policy_type: type
  }, trigger);
  if (isDelete) {
    manager.policies = manager.policies.filter(function (p) {
      return p.id !== data.id;
    });
    managers.update(_objectSpread(_objectSpread({}, manager), {}, {
      policies: manager.policies
    }));
    groups.update(_objectSpread(_objectSpread({}, group), {}, {
      managers: group.managers.map(function (m) {
        return m.id === manager.id ? manager : m;
      })
    }));
    _server.db.getCollection(_server.COLS.instance_group_policies).findAndRemove({
      id: data.id
    });
    return undefined;
  }
  if (isModify) {
    var origPolicy = (utils.getResource(_server.COLS.instance_group_policies, data.id) || [])[0];
    manager.policies = manager.policies.map(function (p) {
      return p.id !== data.id ? p : _objectSpread(_objectSpread({}, p), data);
    });
    policy = _objectSpread(_objectSpread({}, origPolicy), data);
    policies.update(policy);
  } else {
    manager.policies.push(policy);
    policies.insert(policy);
  }
  managers.update(_objectSpread(_objectSpread({}, manager), {}, {
    policies: manager.policies
  }));
  groups.update(_objectSpread(_objectSpread({}, group), {}, {
    managers: group.managers.map(function (m) {
      return m.id === manager.id ? manager : m;
    })
  }));
  return policy;
};

// eslint-disable-next-line default-param-last
var setActionsOnManager = function setActionsOnManager(groupId, managerId) {
  var data = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var isModify = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var isDelete = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var autoscaleManager = arguments.length > 5 ? arguments[5] : undefined;
  var manager = (utils.getResource(_server.COLS.instance_group_managers, managerId) || [])[0];
  var group = (utils.getResource(_server.COLS.instance_groups, groupId) || [])[0];
  var managers = _server.db.getCollection(_server.COLS.instance_group_managers);
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var actions = _server.db.getCollection(_server.COLS.instance_group_actions);
  var actionId = data.id || _casual["default"].uuid;
  var actionHref = "".concat(manager.href, "/actions/").concat(actionId);
  var status = _casual["default"].random_element(actionStatuses);
  var baseData = {
    created_at: utils.generateCreateDate(),
    id: actionId,
    href: actionHref,
    action_type: 'scheduled',
    name: utils.generateName('action'),
    status: status,
    last_applied_at: utils.generateCreateDate(),
    next_run_at: status !== 'failed' && status !== 'completed' ? utils.generateFutureDate() : undefined
  };
  if (data.name === undefined && !isDelete) {
    if (_casual["default"].integer(0, 6) % 6 === 1) return null; // randomize some groups with no actions

    var isDynamic = autoscaleManager && autoscaleManager.id && autoscaleManager.management_enabled;
    if (isDynamic) {
      var min_membership_count = isDynamic ? _casual["default"].integer(0, 98) : undefined;
      var max_membership_count = isDynamic ? _casual["default"].integer(min_membership_count, 99) : undefined;
      baseData = _objectSpread(_objectSpread({}, baseData), {}, {
        manager: {
          min_membership_count: min_membership_count,
          max_membership_count: max_membership_count,
          id: autoscaleManager.id
        }
      });
    } else {
      baseData = _objectSpread(_objectSpread({}, baseData), {}, {
        group: {
          membership_count: _casual["default"].integer(0, 99)
        }
      });
    }
    if (_casual["default"].integer(0, 1) % 2 === 1) {
      // one time action
      baseData.run_at = (0, utils.generateFutureDate)();
    } else {
      // recurring action. Randomize cron string to account for all possibilities
      var minute = '*';
      var hour = '*';
      var day = '*';
      var month = '*';
      var weekday = '*';
      if (_casual["default"].integer(0, 4) % 5 === 1) {
        var start = _casual["default"].integer(0, 58);
        minute = "".concat(start, "-").concat(_casual["default"].integer(start, 59));
      } else if (_casual["default"].integer(0, 2) % 2 !== 1) minute = _casual["default"].integer(0, 59);
      if (_casual["default"].integer(0, 4) % 5 === 1) {
        hour = "*/".concat(_casual["default"].integer(2, 10));
      } else if (_casual["default"].integer(0, 2) % 2 !== 1) hour = _casual["default"].integer(0, 23);
      if (_casual["default"].integer(0, 2) % 3 === 1) day = _casual["default"].integer(1, 31);
      if (_casual["default"].integer(0, 2) % 3 === 1) {
        var first = _casual["default"].integer(1, 6);
        var second = _casual["default"].integer(first, 10);
        month = "".concat(first, ",").concat(second, ",").concat(_casual["default"].integer(second, 12));
      }
      if (_casual["default"].integer(0, 3) % 4 === 1) {
        var _start = _casual["default"].integer(0, 5);
        weekday = "".concat(_start, "-").concat(_casual["default"].integer(_start, 6), "/").concat(_casual["default"].integer(1, 4));
      }
      baseData.cron_spec = "".concat(minute, " ").concat(hour, " ").concat(day, " ").concat(month, " ").concat(weekday);
    }
  } else {
    baseData = _objectSpread(_objectSpread({}, baseData), data);
  }
  var action = baseData;
  if (isDelete) {
    manager.actions = manager.actions.filter(function (p) {
      return p.id !== data.id;
    });
    managers.update(_objectSpread(_objectSpread({}, manager), {}, {
      actions: manager.actions
    }));
    groups.update(_objectSpread(_objectSpread({}, group), {}, {
      managers: group.managers.map(function (m) {
        return m.id === manager.id ? manager : m;
      })
    }));
    _server.db.getCollection(_server.COLS.instance_group_actions).findAndRemove({
      id: data.id
    });
    return undefined;
  }
  if (isModify) {
    var origAction = (utils.getResource(_server.COLS.instance_group_actions, data.id) || [])[0];
    manager.actions = manager.actions.map(function (p) {
      return p.id !== data.id ? p : data;
    });
    var managerObj = data.manager ? {
      manager: _objectSpread(_objectSpread({}, origAction.manager), data.manager)
    } : {};
    action = _objectSpread(_objectSpread(_objectSpread({}, origAction), data), managerObj);
    actions.update(action);
  } else {
    manager.actions.push(action);
    actions.insert(action);
  }
  managers.update(_objectSpread(_objectSpread({}, manager), {}, {
    actions: manager.actions
  }));
  groups.update(_objectSpread(_objectSpread({}, group), {}, {
    managers: group.managers.map(function (m) {
      return m.id === manager.id ? manager : m;
    })
  }));
  return action;
};
var updateLBPWithGroup = function updateLBPWithGroup(group, loadBalancer, pool) {
  if (!loadBalancer || !pool) {
    return;
  }
  var poolMembers = group.memberships.map(function (member) {
    // add member to load balancer pool
    var server = member.instance;
    var primaryVnicId = _lodash["default"].get(server, 'primary_network_interface.id', undefined);
    var vnic = utils.getResource(_server.COLS.network_interfaces, primaryVnicId);
    var serverIP;
    if (vnic.length > 0) {
      serverIP = vnic[0].primary_ipv4_address;
    }
    var poolMember = (0, _members.addMember)({
      target: {
        address: serverIP
      },
      port: group.application_port,
      provisioning_status: 'active'
    });
    member.pool_member = {
      id: poolMember.id
    };
    return poolMember;
  });
  pool.members = poolMembers;
  pool.instance_group = {
    id: group.id,
    crn: group.crn,
    name: group.name,
    href: group.href
  };
  var lbs = _server.db.getCollection(_server.COLS.load_balancers);
  lbs.update(loadBalancer);
};
var addInstanceGroup = function addInstanceGroup() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var members = _server.db.getCollection(_server.COLS.instance_group_members);
  var id = data.id ? data.id : _casual["default"].uuid;
  var regions = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  });
  var region = data.region ? data.region.region_name : regions[_casual["default"].integer(1, 40) % regions.length].name;
  var subnets = data.subnets ? data.subnets.map(function (s) {
    return utils.getResource(_server.COLS.subnets, s.id)[0];
  }) : _toConsumableArray(Array(_casual["default"].integer(1, 4))).map(function () {
    return utils.getRandomResourceInZone(_server.COLS.subnets, region);
  });
  var loadBalancer;
  var load_balancer_pool;
  var application_port = data.application_port;
  if (data.subnets) {
    region = utils.findZone(subnets[0].zone.name).region_name;
    if (data.load_balancer_pool) {
      var lbs = utils.getResourcesInZone(_server.COLS.load_balancers, region, false);
      loadBalancer = lbs.find(function (lb) {
        return lb.pools.some(function (pool) {
          return pool.id === data.load_balancer_pool.id;
        });
      });
      load_balancer_pool = loadBalancer.pools.find(function (pool) {
        return pool.id === data.load_balancer_pool.id;
      });
    }
  } else if (subnets.length > 0 && _casual["default"].integer(0, 2) % 2 === 0) {
    var _lbs = utils.getResourcesInZone(_server.COLS.load_balancers, region, false).filter(function (lb) {
      return lb.provisioning_status !== 'delete_pending';
    });
    var loadBalancers = _lbs.filter(function (lb) {
      return lb.pools.filter(function (lb1) {
        return lb1.provisioning_status !== 'delete_pending';
      }).length > 0 && lb.subnets.some(function (s) {
        return subnets.some(function (s2) {
          return s2.id === s.id;
        });
      });
    });
    loadBalancer = _casual["default"].random_element(loadBalancers);
    if (loadBalancer) {
      load_balancer_pool = _casual["default"].random_element(loadBalancer.pools.filter(function (pool) {
        return pool.provisioning_status !== 'delete_pending';
      }));
      application_port = _casual["default"].integer(1, 65535);
    }
  }
  var baseData = {
    id: id,
    crn: utils.generateCRN(),
    href: "/api/v1/instance_groups/".concat(id),
    name: data.name || utils.generateName('group'),
    resource_group: {
      id: data.resource_group && data.resource_group.id || utils.getRandomResourceGroup()
    },
    instance_template: data.instance_template ? utils.getResource(_server.COLS.instance_templates, data.instance_template.id)[0] : utils.getRandomResourceInZone(_server.COLS.instance_templates, region),
    loadBalancer: loadBalancer,
    load_balancer_pool: load_balancer_pool,
    application_port: application_port,
    status: data.status ? data.status : getRandomStatus(),
    subnets: subnets,
    membership_count: data.membership_count === undefined ? 0 : data.membership_count,
    memberships: [],
    managers: (data === null || data === void 0 ? void 0 : data.managers) || [],
    auto_scale_manager: data.auto_scale_manager || false
  };
  var newGroup = _objectSpread(_objectSpread({}, baseData), {}, {
    region: region
  });

  // leave a few groups without members (1 out of 8).
  var count = data.membership_count || _casual["default"].integer(0, 8) > 0 && _casual["default"].integer(1, 5) || 0;
  var servers = utils.getResourcesInZone(_server.COLS.instances, region);
  _lodash["default"].remove(servers, function (ele) {
    return usedIds.includes(ele.id);
  });
  // get between 1-5 VSIs in this zone, and make them members of this autoscale group if they are not members already of
  // another group (so anywhere between 0 or 5)
  var addedMembersCount = 0;
  var instances = _server.db.addCollection(_server.COLS.instances);
  utils.repeat(function () {
    var server;
    if (subnets.length > 0) {
      var instanceSubnet = _casual["default"].random_element(subnets);
      server = (0, _instances.addInstance)(instances, {
        name: "".concat(newGroup.name, "-instance-").concat(addedMembersCount),
        subnet: {
          id: instanceSubnet.id
        },
        status: 'running'
      });
    } else {
      server = _casual["default"].random_element(servers);
    }
    if (server && usedIds.indexOf(server.id) === -1) {
      usedIds.push(server.id);
      var member = {
        id: _casual["default"].uuid,
        crn: utils.generateCRN(),
        href: "/api/v1/instance_groups/".concat(id),
        instance: server,
        instance_template: newGroup.instance_template,
        status: newGroup.status,
        delete_instance_on_membership_delete: _casual["default"].integer(0, 4) !== 1
      };
      newGroup.memberships.push(member);
      addedMembersCount++;
    }
    _lodash["default"].remove(servers, function (ele) {
      return ele.id === server.id;
    });
  }, count);
  if (data.membership_count === undefined) {
    newGroup.membership_count = addedMembersCount;
  }
  updateLBPWithGroup(newGroup, loadBalancer, load_balancer_pool);
  newGroup.memberships.forEach(function (member) {
    members.insert(member);
  });
  groups.insert(newGroup);
  if (!data.name || baseData.id.includes('instanceGroup100')) {
    var autoscaleManagerId;
    if (data.name || _casual["default"].integer(0, 6) % 5 !== 1) {
      autoscaleManagerId = addManagerToGroup(newGroup.id, newGroup);
      // some of the random generated groups have no manager on purpose, skip those
      if (autoscaleManagerId) {
        var repeat = _casual["default"].integer(0, 8);
        if (repeat > 0) {
          repeat = Math.max(1, repeat - 4); // we want most groups to have 1 policy, a few outliers will have multiples.
        }

        utils.repeat(function () {
          setPoliciesOnManager(newGroup.id, autoscaleManagerId);
        }, repeat);
      }
    }
    if (data.name || _casual["default"].integer(0, 6) % 5 !== 1) {
      var managerId = addManagerToGroup(newGroup.id, newGroup, undefined, 'scheduled');
      // some of the random generated groups have no manager on purpose, skip those
      if (managerId) {
        var _repeat = _casual["default"].integer(0, 8);
        if (_repeat > 0) {
          _repeat = Math.max(1, _repeat - 4); // we want most groups to have 1 policy, a few outliers will have multiples.
        }

        utils.repeat(function () {
          setActionsOnManager(newGroup.id, managerId, undefined, undefined, undefined, {
            id: autoscaleManagerId,
            management_enabled: true
          });
        }, _repeat);
      }
    }
  }
  return newGroup;
};
var init = function init() {
  _server.db.addCollection(_server.COLS.instance_groups);
  _server.db.addCollection(_server.COLS.instance_group_managers);
  _server.db.addCollection(_server.COLS.instance_group_members);
  _server.db.addCollection(_server.COLS.instance_group_policies);
  _server.db.addCollection(_server.COLS.instance_group_actions);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addInstanceGroup({
    name: 'aaa-default-instance-group-1',
    id: 'instanceGroup1001',
    region: utils.findZone(utils.getDefaultZone()),
    membership_count: 2,
    status: 'healthy',
    subnets: [{
      id: 'subnet-1',
      name: 'aaa-default-subnet-1'
    }]
  });
  addInstanceGroup({
    name: 'aaa-default-instance-group-2',
    id: 'instanceGroup1002',
    region: utils.findZone(utils.getDefaultZone())
  });
  addInstanceGroup({
    name: 'aaa-default-instance-group-to-delete',
    id: 'instanceGroup1004',
    region: utils.findZone(utils.getDefaultZone()),
    membership_count: 0,
    status: 'healthy'
  });
  addInstanceGroup({
    name: 'aaa-default-instance-group-size',
    id: 'instanceGroup1005',
    region: utils.findZone(utils.getDefaultZone()),
    manager_type: 'autoscale',
    status: 'healthy',
    auto_scale_manager: true,
    managers: [{
      aggregationWindow: 240,
      cooldown: 780,
      maxMembershipCount: 87,
      minMembershipCount: 9
    }]
  });
  utils.repeat(function () {
    addInstanceGroup();
  }, _casual["default"].integer(_features.shouldGenerateLotsOfResources ? 98 : 18, _features.shouldGenerateLotsOfResources ? 128 : 38));
};
exports.init = init;
var formatInstanceGroupForClient = function formatInstanceGroupForClient(req, groupToFormat) {
  var _group$instance_templ, _group$instance_templ2;
  var group = JSON.parse(JSON.stringify(groupToFormat));
  if (group.subnets) {
    group.subnets = group.subnets.map(function (subnet) {
      return utils.formatResourceLinkForClient(req, _server.COLS.subnets, subnet);
    });
  }
  if (group.load_balancer_pool && group.loadBalancer) {
    group.load_balancer_pool.href = "".concat(utils.getBaseApiUrl(req), "load_balancers/").concat(group.loadBalancer.id, "/pools/").concat(group.load_balancer_pool.id);
  } else {
    delete group.load_balancer_pool;
  }
  group.href = "".concat(utils.getBaseApiUrl(req), "instance_groups/").concat(group.id);
  group.crn = utils.updateResourceCrnRegion(group, req);
  group.vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, (_group$instance_templ = group.instance_template) === null || _group$instance_templ === void 0 ? void 0 : (_group$instance_templ2 = _group$instance_templ.vpc) === null || _group$instance_templ2 === void 0 ? void 0 : _group$instance_templ2.id);
  if (group.instance_template) {
    group.instance_template = {
      id: group.instance_template.id,
      crn: utils.updateResourceCrnRegion(group.instance_template, req),
      href: group.instance_template.href
    };
  }
  group.managers = group.managers.map(function (manager) {
    return {
      id: manager.id,
      href: manager.href
    };
  });
  delete group.memberships;
  if (group.load_balancer_pool) {
    group.load_balancer_pool = {
      id: group.load_balancer_pool.id,
      name: group.load_balancer_pool.name,
      crn: utils.updateResourceCrnRegion(group.load_balancer_pool, req),
      href: group.load_balancer_pool.href
    };
  }
  if (group.loadBalancer) {
    group.loadBalancer = {
      id: group.loadBalancer.id,
      crn: utils.updateResourceCrnRegion(group.loadBalancer, req),
      href: group.loadBalancer.href
    };
  }
  // always return healthy status for aa-instance
  if (group.name === 'aa-instance') {
    group.status = 'healthy';
  }
  return group;
};
var getInstanceGroups = function getInstanceGroups(req, res) {
  var instanceGroups = utils.getResources(req, _server.COLS.instance_groups);
  instanceGroups.instance_groups = instanceGroups.instance_groups.map(function (group) {
    return formatInstanceGroupForClient(req, group);
  });
  res.json(instanceGroups).end();
};
exports.getInstanceGroups = getInstanceGroups;
var getInstanceGroup = function getInstanceGroup(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  res.json(formatInstanceGroupForClient(req, group)).end();
};
exports.getInstanceGroup = getInstanceGroup;
var getInstanceGroupManagers = function getInstanceGroupManagers(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var resources = utils.getResources(req, _server.COLS.instance_group_managers, function (manager) {
    return group.managers.some(function (m) {
      return m.id === manager.id;
    });
  });
  resources.managers = resources.instance_group_managers.map(function (mgr) {
    return _objectSpread(_objectSpread({}, mgr), {}, {
      policies: mgr.policies.map(function (policy) {
        return {
          id: policy.id,
          href: policy.href
        };
      })
    });
  });
  delete resources.instance_group_managers;
  res.json(resources).end();
};
exports.getInstanceGroupManagers = getInstanceGroupManagers;
var getInstanceGroupMemberships = function getInstanceGroupMemberships(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var members = utils.getResources(req, _server.COLS.instance_group_members, function (member) {
    return group.memberships.some(function (m) {
      return m.id === member.id;
    });
  });
  res.json(_objectSpread(_objectSpread({}, members), {}, {
    instance_group_members: undefined,
    memberships: members.instance_group_members.map(function (member) {
      var _member$instance_temp, _member$instance_temp2, _member$instance_temp3;
      return _objectSpread(_objectSpread({}, member), {}, {
        instance: {
          id: member.instance.id,
          href: member.instance.href,
          crn: member.instance.crn,
          name: member.instance.name
        },
        instance_template: {
          id: (_member$instance_temp = member.instance_template) === null || _member$instance_temp === void 0 ? void 0 : _member$instance_temp.id,
          crn: (_member$instance_temp2 = member.instance_template) === null || _member$instance_temp2 === void 0 ? void 0 : _member$instance_temp2.crn,
          href: (_member$instance_temp3 = member.instance_template) === null || _member$instance_temp3 === void 0 ? void 0 : _member$instance_temp3.href
        }
      });
    })
  })).end();
};
exports.getInstanceGroupMemberships = getInstanceGroupMemberships;
var getInstanceGroupMembership = function getInstanceGroupMembership(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var members = utils.getResource(_server.COLS.instance_group_members, req.params.member_id);
  if (members.length === 0) {
    res.status(404).end();
    return;
  }
  res.json(members[0]).end();
};
exports.getInstanceGroupMembership = getInstanceGroupMembership;
var getInstanceGroupManager = function getInstanceGroupManager(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  res.json(_objectSpread(_objectSpread({}, manager), {}, {
    policies: (manager.policies || []).map(function (policy) {
      return {
        id: policy.id,
        href: policy.href
      };
    })
  })).end();
};
exports.getInstanceGroupManager = getInstanceGroupManager;
var getInstanceGroupPolicies = function getInstanceGroupPolicies(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policies = utils.getResources(req, _server.COLS.instance_group_policies, function (policy) {
    return (manager.policies || []).some(function (m) {
      return m.id === policy.id;
    });
  });
  res.json(_objectSpread(_objectSpread({}, policies), {}, {
    instance_group_policies: undefined,
    policies: policies.instance_group_policies
  })).end();
};
exports.getInstanceGroupPolicies = getInstanceGroupPolicies;
var createInstanceGroup = function createInstanceGroup(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.instance_groups), input, req, res, 'resource with that name already exists', 'instance_groups')) {
    return;
  }
  var group = addInstanceGroup(input);
  res.status(201).json(formatInstanceGroupForClient(req, group)).end();
};
exports.createInstanceGroup = createInstanceGroup;
var createInstanceGroupPolicy = function createInstanceGroupPolicy(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policy = setPoliciesOnManager(group.id, manager.id, input);
  res.status(201).json(policy).end();
};
exports.createInstanceGroupPolicy = createInstanceGroupPolicy;
var getInstanceGroupPolicy = function getInstanceGroupPolicy(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policy = manager.policies.find(function (p) {
    return p.id === req.params.policy_id;
  });
  if (!policy) {
    res.status(404).end();
    return;
  }
  res.status(200).json(policy).end();
};
exports.getInstanceGroupPolicy = getInstanceGroupPolicy;
var updateInstanceGroupPolicy = function updateInstanceGroupPolicy(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policy = setPoliciesOnManager(group.id, manager.id, _objectSpread(_objectSpread({}, input), {}, {
    id: req.params.policy_id
  }), true);
  res.status(200).json(policy).end();
};
exports.updateInstanceGroupPolicy = updateInstanceGroupPolicy;
var deleteInstanceGroupManager = function deleteInstanceGroupManager(req, res) {
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var previousGroup = utils.findResource(_server.COLS.instance_groups, req.params.group_id, res, false);
  if (!previousGroup) {
    res.status(404).end();
    return;
  }
  var oldManagers = previousGroup.managers;
  oldManagers.splice(oldManagers.findIndex(function (manager) {
    return manager.id === req.params.manager_id;
  }), 1);
  var updatedGroup = _objectSpread(_objectSpread({}, previousGroup), {}, {
    managers: oldManagers
  });
  groups.update(updatedGroup);
  _server.db.getCollection(_server.COLS.instance_group_managers).findAndRemove({
    id: req.params.manager_id
  });
  res.status(204).end();
};
exports.deleteInstanceGroupManager = deleteInstanceGroupManager;
var deleteInstanceGroupPolicy = function deleteInstanceGroupPolicy(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policy = setPoliciesOnManager(group.id, manager.id, {
    id: req.params.policy_id
  }, false, true);
  res.status(204).json(policy).end();
};
exports.deleteInstanceGroupPolicy = deleteInstanceGroupPolicy;
var createInstanceGroupManager = function createInstanceGroupManager(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var id = addManagerToGroup(group.id, group, input, undefined, req);
  group = utils.findResource(_server.COLS.instance_groups, group.id, res, false);
  res.status(201).json(group.managers.find(function (m) {
    return m.id === id;
  })).end();
};
exports.createInstanceGroupManager = createInstanceGroupManager;
var updateInstanceGroupManager = function updateInstanceGroupManager(req, res) {
  var input = req.body;
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var managers = _server.db.getCollection(_server.COLS.instance_group_managers);
  var previousGroup = utils.findResource(_server.COLS.instance_groups, req.params.group_id, res, false);
  var previousManager = utils.findResource(_server.COLS.instance_group_managers, req.params.manager_id, res, false);
  var oldManagers = previousGroup.managers;
  var updatedManager = _objectSpread(_objectSpread({}, previousManager), input);
  var updatingManagerIndex = oldManagers.findIndex(function (manager) {
    return manager.id === req.params.manager_id;
  });
  if (updatingManagerIndex === -1) {
    res.status(404).end();
    return;
  }
  oldManagers[updatingManagerIndex] = updatedManager;
  managers.update(updatedManager);
  groups.update(_objectSpread(_objectSpread({}, previousGroup), {}, {
    managers: oldManagers
  }));
  res.status(200).json(updatedManager).end();
};
exports.updateInstanceGroupManager = updateInstanceGroupManager;
var createInstanceGroupAction = function createInstanceGroupAction(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var policy = setActionsOnManager(group.id, manager.id, input);
  res.status(201).json(policy).end();
};
exports.createInstanceGroupAction = createInstanceGroupAction;
var getInstanceGroupActions = function getInstanceGroupActions(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var actions = utils.getResources(req, _server.COLS.instance_group_actions, function (action) {
    return (manager.actions || []).some(function (m) {
      return m.id === action.id;
    });
  }, req.query.sort || undefined);
  res.json(_objectSpread(_objectSpread({}, actions), {}, {
    instance_group_actions: undefined,
    actions: actions.instance_group_actions
  })).end();
};
exports.getInstanceGroupActions = getInstanceGroupActions;
var getInstanceGroupAction = function getInstanceGroupAction(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var action = manager.actions.find(function (p) {
    return p.id === req.params.action_id;
  });
  if (!action) {
    res.status(404).end();
    return;
  }
  res.status(200).json(action).end();
};
exports.getInstanceGroupAction = getInstanceGroupAction;
var updateInstanceGroupAction = function updateInstanceGroupAction(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var action = setActionsOnManager(group.id, manager.id, _objectSpread(_objectSpread({}, input), {}, {
    id: req.params.action_id
  }), true);
  res.status(200).json(action).end();
};
exports.updateInstanceGroupAction = updateInstanceGroupAction;
var deleteInstanceGroupAction = function deleteInstanceGroupAction(req, res) {
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var manager = (utils.getResource(_server.COLS.instance_group_managers, req.params.manager_id) || [])[0];
  if (!manager) {
    res.status(404).end();
    return;
  }
  var action = setActionsOnManager(group.id, manager.id, {
    id: req.params.action_id
  }, false, true);
  res.status(204).json(action).end();
};
exports.deleteInstanceGroupAction = deleteInstanceGroupAction;
var clearLBPoolMembers = function clearLBPoolMembers(group, clearInstanceGroup) {
  var lbID = group.loadBalancer && group.loadBalancer.id;
  var lbPoolID = group.load_balancer_pool && group.load_balancer_pool.id;
  var lb = lbID && utils.getResource(_server.COLS.load_balancers, lbID);
  if (lb && lb.length > 0) {
    var lbp = lb[0].pools.find(function (pool) {
      return pool.id === lbPoolID;
    });
    lbp.members = [];
    if (clearInstanceGroup) {
      delete lbp.instance_group;
    }
    _server.db.getCollection(_server.COLS.load_balancers).update(lb);
  }
};
var deleteInstanceGroupLoadBalancer = function deleteInstanceGroupLoadBalancer(req, res) {
  var groups = _server.db.getCollection(_server.COLS.instance_groups).find({
    id: req.params.group_id
  });
  if (!groups || groups.length === 0) {
    res.status(404).end();
    return;
  }
  var group = groups[0];
  clearLBPoolMembers(group, true);
  delete group.loadBalancer;
  delete group.load_balancer_pool;
  delete group.application_port;
  group.memberships.forEach(function (member) {
    delete member.pool_member;
  });
  _server.db.getCollection(_server.COLS.instance_groups).update(group);
  res.status(204).end();
};
exports.deleteInstanceGroupLoadBalancer = deleteInstanceGroupLoadBalancer;
var detachInstanceGroupMembership = function detachInstanceGroupMembership(req, res) {
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var removingID = req.params.member_id;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var member = utils.findResource(_server.COLS.instance_group_members, removingID, res, false);
  if (!member) {
    return;
  }
  var remainingMembers = group.memberships.filter(function (m) {
    return m.id !== removingID;
  });
  if (group) {
    group.membership_count--;
    var updatedGroup = _objectSpread(_objectSpread({}, group), {}, {
      memberships: remainingMembers
    });
    var lbID = group.loadBalancer && group.loadBalancer.id;
    var lbPoolID = group.load_balancer_pool && group.load_balancer_pool.id;
    var lb = lbID && utils.getResource(_server.COLS.load_balancers, lbID);
    if (lb && lb.length > 0) {
      var lbp = lb[0].pools.find(function (pool) {
        return pool.id === lbPoolID;
      });
      var removingLPMID = member.pool_member && member.pool_member.id;
      _lodash["default"].remove(lbp.members, function (lbpm) {
        return lbpm.id === removingLPMID;
      });
      var lbs = _server.db.getCollection(_server.COLS.load_balancers);
      lbs.update(lb);
    }
    groups.update(updatedGroup);
  }
  _server.db.getCollection(_server.COLS.instance_group_members).remove(member);
  // remove instance if auto_delete is true
  if (member.delete_instance_on_membership_delete) {
    if (member && member.instance) {
      var instance = utils.findResource(_server.COLS.instances, member.instance.id, res, false);
      var instances = _server.db.getCollection(_server.COLS.instances);
      instances.remove(instance);
    }
  }
  res.status(204).end();
};
exports.detachInstanceGroupMembership = detachInstanceGroupMembership;
var detachInstanceGroupMemberships = function detachInstanceGroupMemberships(req, res, ignoreResponse) {
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var members = utils.getResources(req, _server.COLS.instance_group_members, function (member) {
    return group.memberships.some(function (m) {
      return m.id === member.id;
    });
  });
  if (group) {
    group.membership_count = 0;
    groups.update(_objectSpread(_objectSpread({}, group), {}, {
      memberships: []
    }));
  }

  // remove members from LB pool if the instance group has LB pool
  clearLBPoolMembers(group);

  // remove instance if delete_instance_on_membership_delete is true
  members.instance_group_members.forEach(function (member) {
    if (member.delete_instance_on_membership_delete && member.instance) {
      req.params.instance_id = member.instance.id;
      (0, _instances.deleteInstance)(req, utils.fakeResponse);
    }
  });
  if (ignoreResponse !== true) {
    res.status(204).end();
  }
};
exports.detachInstanceGroupMemberships = detachInstanceGroupMemberships;
var deleteInstanceGroup = function deleteInstanceGroup(req, res) {
  var groups = _server.db.getCollection(_server.COLS.instance_groups).find({
    id: req.params.group_id
  });
  if (!groups || groups.length === 0) {
    res.status(404).end();
    return;
  }
  clearLBPoolMembers(groups[0], true);
  detachInstanceGroupMemberships(req, res, true);
  _server.db.getCollection(_server.COLS.instance_groups).findAndRemove({
    id: req.params.group_id
  });
  res.status(204).end();
};

/**
 * updateInstanceGroup()
 * PATCH /instance_groups/{id}
 * Update details in an existing instance group.
 *
 * @param {*} req
 * @param {*} res
 */
exports.deleteInstanceGroup = deleteInstanceGroup;
var updateInstanceGroup = function updateInstanceGroup(req, res) {
  var input = req.body;
  var groups = _server.db.getCollection(_server.COLS.instance_groups);
  var groupId = req.params.group_id;
  var previousGroup = utils.findResource(_server.COLS.instance_groups, groupId, res, false);
  if (input.subnets) {
    var subnets = input.subnets.map(function (s) {
      return utils.getResource(_server.COLS.subnets, s.id)[0];
    });
    input.subnets = subnets;
  }
  var newLB;
  var newLBP;
  if (input.load_balancer_pool) {
    // clean the members in the old load balancer pool
    clearLBPoolMembers(previousGroup, true);
    var region = previousGroup.region;
    var lbs = utils.getResourcesInZone(_server.COLS.load_balancers, region, false);
    var loadBalancer = lbs.find(function (lb) {
      return lb.pools.some(function (pool) {
        return pool.id === input.load_balancer_pool.id;
      });
    });
    if (loadBalancer) {
      var pools = loadBalancer.pools.filter(function (pool) {
        return pool.id === input.load_balancer_pool.id;
      });
      input.load_balancer_pool = pools[0];
      // if adding a pool when one didnt exist before, need to add the loadBalancer to object
      if (!previousGroup.loadBalancer) {
        input.loadBalancer = loadBalancer;
      }
      newLB = loadBalancer;
      newLBP = pools[0];
    }
  }
  var updatedGroup = _objectSpread(_objectSpread({}, previousGroup), input);
  if (input.membership_count === 0) {
    detachInstanceGroupMemberships(req, utils.fakeResponse, true);
    updatedGroup.status = 'scaling';
    setTimeout(function () {
      var grp = utils.findResource(_server.COLS.instance_groups, groupId, res, false);
      groups.update(_objectSpread(_objectSpread({}, grp), {}, {
        status: 'healthy'
      }));
    }, _features.shouldAddDelaysToStatusTransitions ? 5000 : 0);
  }
  updateLBPWithGroup(updatedGroup, newLB, newLBP);
  groups.update(updatedGroup);
  res.status(200).json(formatInstanceGroupForClient(req, updatedGroup)).end();
};
exports.updateInstanceGroup = updateInstanceGroup;
var updateInstanceGroupMembership = function updateInstanceGroupMembership(req, res) {
  var input = req.body;
  var group = (utils.getResource(_server.COLS.instance_groups, req.params.group_id) || [])[0];
  if (!group) {
    res.status(404).end();
    return;
  }
  var members = utils.getResource(_server.COLS.instance_group_members, req.params.member_id);
  if (members.length === 0) {
    res.status(404).end();
    return;
  }
  var updatedMember = _objectSpread(_objectSpread({}, members[0]), input);
  var ig_members = _server.db.getCollection(_server.COLS.instance_group_members);
  ig_members.update(updatedMember);
  res.json(updatedMember).end();
};
exports.updateInstanceGroupMembership = updateInstanceGroupMembership;