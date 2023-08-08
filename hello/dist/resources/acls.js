"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateRule = exports.updateAcl = exports.init = exports.getRules = exports.getRule = exports.getACLs = exports.getACL = exports.formatNetworkAclForClient = exports.deleteRule = exports.deleteAcl = exports.createRule = exports.createACL = exports.addACL = void 0;
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _subnets = require("./subnets");
var _vpcs = require("./vpcs");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var ACLS_NUM = 20;

/**
 * formatNetworkAclForClient()
 *
 * Takes an ACL and properly formats it for output to the client.
 *
 * @param {*} req
 * @param {*} acl - raw acl from DB entry
 */
var formatNetworkAclForClient = function formatNetworkAclForClient(req, acl) {
  // Add href for this ACL
  acl.href = "".concat(utils.getBaseApiUrl(req), "network_acls/").concat(acl.id);
  acl.crn = utils.updateResourceCrnRegion(acl, req);

  // Rules - Add href to each rule.
  acl.rules.forEach(function (rule) {
    rule.href = "".concat(acl.href, "/rules/").concat(rule.id);
  });
  var vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, acl.vpc.id);
  if (vpc) acl.vpc = vpc;

  // Subnets - Add array of {id, crn, href, name} or if none delete subnets.
  var subnets = (0, _subnets.findSubnetsUsingAcl)(acl.id);
  if (subnets.length > 0) {
    acl.subnets = subnets.map(function (subnet) {
      return utils.formatResourceLinkForClient(req, _server.COLS.subnets, subnet);
    });
  } else {
    delete acl.subnets;
  }
  delete acl.zone;
};

/*
 * This function generates our default rules.  By default every ACL gets a
 * rule that allows all requests in and all requests out.
 */
exports.formatNetworkAclForClient = formatNetworkAclForClient;
var generateDefaultRules = function generateDefaultRules() {
  return [{
    id: casual.uuid,
    name: utils.generateName('acl-rule'),
    protocol: 'all',
    source: '0.0.0.0/0',
    destination: '0.0.0.0/0',
    direction: 'inbound',
    action: 'allow',
    ip_version: 'ipv4',
    created_at: utils.generateCreateDate()
  }, {
    id: casual.uuid,
    name: utils.generateName('acl-rule'),
    protocol: 'all',
    source: '0.0.0.0/0',
    destination: '0.0.0.0/0',
    direction: 'outbound',
    action: 'allow',
    ip_version: 'ipv4',
    created_at: utils.generateCreateDate()
  }];
};
var getRandomVPC = function getRandomVPC(vpcs, region) {
  return {
    vpc: {
      id: casual.random_element(vpcs.filter(function (vpc) {
        return vpc.zone.region_name === region;
      })).id
    }
  };
};

/*
 * This is a data load function that can add an ACL.  It will
 * give that ACL a resource group, an id, and a generated create
 * date some time in the last 100 days.
 */
var addACL = function addACL(acls, data) {
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().data({
    removeMeta: true
  });
  var id = casual.uuid;
  var resourceGroupId = data && data.resource_group && data.resource_group.id || utils.getRandomResourceGroup();
  var resourceGroupName = utils.getResource(_server.COLS.resourceGroups, resourceGroupId)[0].name;
  var acl = Object.assign({
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // Placholder
    created_at: utils.generateCreateDate(),
    zone: utils.getRandomZone(),
    // has extra region_name
    rules: generateDefaultRules(),
    subnets: '' // Placeholder
  }, data);
  acl.resource_group = {
    id: resourceGroupId,
    name: resourceGroupName
  };
  if (!data.name) {
    acl.name = "".concat(utils.generateName('acl', acl.zone));
  }
  if (!acl.vpc) {
    acl.vpc = getRandomVPC(vpcs, acl.zone.region_name).vpc;
  }
  acls.insert(acl);
  return id;
};

/*
 * Our init function creates two well known ACLs and a set of
 * random ACLs.
 */
exports.addACL = addACL;
var init = function init() {
  var acls = _server.db.addCollection(_server.COLS.acls);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  var vpcs = _server.db.getCollection(_server.COLS.vpcs).chain().data({
    removeMeta: true
  });
  var defaultZone = utils.findZone(utils.getDefaultZone());
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-1',
    id: '85589c9a-c982-4e93-be47-eb053d8baf9b',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-2',
    id: 'c31d5b9d-ed19-4be0-a271-be993de0bef8',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-del',
    id: 'd31d5b9d-ed19-4be0-a271-be993de0bef8',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-inbound-delete',
    id: 'de2d5b9d-e8ud-4be0-a272-be993de0gt67',
    zone: utils.findZone(utils.getDefaultZone()),
    rules: generateDefaultRules().splice(0, 1)
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-acl-test-attach-subnet',
    id: 'aaa-acl-test-attach-subnet-id',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-acl-test-attach-detach-subnet',
    id: 'aaa-acl-test-attach-detach-subnet-id',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-test-rename',
    id: 'c31d5b9d-ed19-4be0-a271-aa000aa0aaa0',
    zone: utils.findZone(utils.getDefaultZone())
  }, getRandomVPC(vpcs, defaultZone.region_name)));
  addACL(acls, _objectSpread({
    name: 'aaa-default-acl-outbound-delete',
    id: 'de2d5b9d-e8ud-4be0-a272-be993de0yz41',
    zone: utils.findZone(utils.getDefaultZone()),
    rules: generateDefaultRules().splice(1, 1)
  }, getRandomVPC(vpcs, defaultZone.region_name)));

  // Make sure every region, we have acl.
  var regions = _server.db.getCollection(_server.COLS.regions).chain().simplesort('name').data({
    removeMeta: true
  });
  regions.forEach(function (region) {
    addACL(acls, _objectSpread({
      name: "acl_per_region_".concat(region.name),
      zone: utils.findZoneInRegion(region.name)
    }, getRandomVPC(vpcs, region.name)));
  });

  // Create the remaining additional ACLs - we subtract the ones from above
  var remainingCount = Math.max(ACLS_NUM - 6, 0);
  utils.repeat(function () {
    addACL(acls, {});
  }, remainingCount);
};

/*
 * Get a list of ACLs and handle pagination.
 */
exports.init = init;
var getACLs = function getACLs(req, res) {
  var network_acls_list = utils.getResources(req, _server.COLS.acls);
  network_acls_list.network_acls.forEach(function (acl) {
    return formatNetworkAclForClient(req, acl);
  });
  res.json(network_acls_list).end();
};

/*
 * Get a specific ACL.
 */
exports.getACLs = getACLs;
var getACL = function getACL(req, res) {
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, true);
  if (!acl) return;
  formatNetworkAclForClient(req, acl);
  res.json(acl).end();
};

/*
 * Create a new ACL.
 */
exports.getACL = getACL;
var createACL = function createACL(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.acls), input, req, res, 'network_acl is already existed', 'network_acl')) {
    return;
  }
  if (input.source_network_acl && input.source_network_acl.id) {
    /*
     * This means they want to copy this ACL from an existing one.
     */
    var acl = utils.findResource(_server.COLS.acls, input.source_network_acl.id, res, true);
    if (!acl) return;
    input.rules = [];
    acl.rules.forEach(function (r) {
      return input.rules.push(Object.assign({}, r));
    });
    delete input.source_network_acl;
  }

  /*
   * We need to set the zone so the ACL shows up in the correct region.
   */
  input.zone = utils.findZoneInRegion(utils.getQueryRegion(req));
  if (input.rules) {
    // sort the input rules in order 'inbound' 'outbound'
    input.rules.sort(function (a, b) {
      if (a.direction < b.direction) {
        return -1;
      }
      if (a.direction > b.direction) {
        return 1;
      }
      return 0;
    }).forEach(function (rule) {
      rule.id = casual.uuid;
      if (!rule.name) {
        rule.name = utils.generateName('acl-rule');
      }
    });
  }
  input.created_at = utils.generateNowDate();
  var id = addACL(_server.db.getCollection(_server.COLS.acls), input);
  var result = utils.findResource(_server.COLS.acls, id, res, true);
  formatNetworkAclForClient(req, result);
  res.status(201).json(result).end();
};

/*
 * Get the rules for an ACL with pagination.
 */
exports.createACL = createACL;
var getRules = function getRules(req, res) {
  var limit = Number.parseInt(utils.getQueryParam(req.query, 'limit', 10), 10);
  var offset = Number.parseInt(utils.getQueryParam(req.query, 'start', 0), 10);
  var next = offset + limit;
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, true);
  if (!acl) return;
  acl.rules.forEach(function (rule) {
    rule.href = "".concat(utils.getBaseUrl(req), "/").concat(rule.id);
  });
  var rules = {
    rules: acl.rules.slice(offset, limit + offset),
    limit: limit,
    first: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit)
    },
    next: {
      href: "".concat(utils.getBaseUrl(req), "?limit=").concat(limit, "&start=").concat(next)
    }
  };
  if (next > acl.rules.length) {
    delete rules.next;
  }
  res.json(rules).end();
};

/*
 * Get the details of a specific rule
 */
exports.getRules = getRules;
var getRule = function getRule(req, res) {
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, true);
  if (!acl) return;
  var rule = acl.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    res.status(404).end();
    return;
  }
  res.json(rule).end();
};

/*
 * Update the data in an ACL.  This only supports changing the ACL name.
 */
exports.getRule = getRule;
var updateAcl = function updateAcl(req, res) {
  var input = req.body;
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, false);
  if (!acl) return;
  acl.name = input.name;
  _server.db.getCollection(_server.COLS.acls).update(acl);

  // Get the updated entry and strip meta info
  var result = utils.findResource(_server.COLS.acls, req.params.acl_id, res, true);
  if (!result) return;

  // Format it for client output.
  formatNetworkAclForClient(req, result);

  // Return our result.
  res.json(result).status(200).end();
};

/*
 * Update a specified rule for an ACL.
 */
exports.updateAcl = updateAcl;
var updateRule = function updateRule(req, res) {
  var input = req.body;
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, false);
  if (!acl) return;
  var rule = acl.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    res.status(404).end();
    return;
  }

  // Delete unrelated fields when protocol is changed
  if (input.protocol === 'icmp') {
    delete rule.port_min;
    delete rule.port_max;
    delete rule.source_port_min;
    delete rule.source_port_max;
  } else if (input.protocol === 'tcp' || input.protocol === 'udp') {
    delete rule.type;
    delete rule.code;
  } else if (input.protocol === 'all') {
    delete rule.type;
    delete rule.code;
    delete rule.port_min;
    delete rule.port_max;
    delete rule.source_port_min;
    delete rule.source_port_max;
  }
  var index = acl.rules.length;

  // We want to remove the rule so we can add it at the new index
  acl.rules.splice(acl.rules.findIndex(function (r) {
    return r.id === req.params.rule_id;
  }), 1);
  if (input.before && input.before.id) {
    index = acl.rules.findIndex(function (r) {
      return r.id === input.before.id;
    });
    acl.rules.splice(index, 0, rule);
  } else if (input.direction === 'inbound') {
    acl.rules.splice(acl.rules.findIndex(function (r) {
      return r.direction === 'outbound';
    }), 0, rule);
  } else {
    acl.rules.push(rule);
  }

  // Delete unwanted fields.
  delete input.before;
  var updatedRule = Object.assign(rule, input);
  _server.db.getCollection(_server.COLS.acls).update(acl);
  res.json(updatedRule).status(200).end();
};

/*
 * Create a new rule.
 */
exports.updateRule = updateRule;
var createRule = function createRule(req, res) {
  var input = req.body;
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, false);
  if (!acl) return;
  var index = acl.rules.length;
  if (input.before && input.before.id) {
    index = acl.rules.findIndex(function (rule) {
      return rule.id === input.before.id;
    });
  } else if (input.direction === 'inbound') {
    index = acl.rules.findIndex(function (r) {
      return r.direction === 'outbound';
    });
  }
  input.id = casual.uuid;
  if (!input.name) {
    input.name = "acl-".concat(casual.word, "-").concat(casual.integer(-1000, 1000));
  }
  delete input.before;
  acl.rules.splice(index, 0, input);

  // Update the DB
  _server.db.getCollection(_server.COLS.acls).update(acl);
  res.status(201).json(input).end();
};
exports.createRule = createRule;
var deleteAcl = function deleteAcl(req, res) {
  // First find the resource and verify that it exists.
  var aclId = req.params.acl_id;
  var acl = utils.findResource(_server.COLS.acls, aclId, res, false);
  if (!acl) return;

  // Next check if any subnets or VPCs are using this ACL.
  var vpcs = (0, _vpcs.findVpcsUsingAcl)(aclId);
  var subnets = (0, _subnets.findSubnetsUsingAcl)(aclId);
  if (vpcs.length > 0 || subnets.length > 0) {
    res.status(409).json(utils.generateErrors('The network ACL cannot be deleted since it is attached to resources.', 'acl_in_use', _server.COLS.acls)).end();
    return;
  }

  // We are good to delete the acl!
  _server.db.getCollection(_server.COLS.acls).remove(acl);
  res.status(204).end();
};
exports.deleteAcl = deleteAcl;
var deleteRule = function deleteRule(req, res) {
  var acl = utils.findResource(_server.COLS.acls, req.params.acl_id, res, false);
  if (!acl) return;
  var rule = acl.rules.find(function (r) {
    return r.id === req.params.rule_id;
  });
  if (!rule) {
    res.status(404).end();
    return;
  }
  acl.rules.splice(acl.rules.findIndex(function (r) {
    return r.id === req.params.rule_id;
  }), 1);

  // Update the DB
  _server.db.getCollection(_server.COLS.acls).update(acl);
  res.status(204).end();
};
exports.deleteRule = deleteRule;