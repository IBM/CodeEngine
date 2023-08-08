"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.query = exports.init = exports.getResourcePlans = exports.getResource = exports.getProfilePricingPlan = exports.getPlanDeployments = void 0;
var _server = require("../../../server");
var utils = _interopRequireWildcard(require("../../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var casual = require('casual');
var profileData = require('./gcProfiles.json');
var bmProfileData = require('./bareMetalProfiles.json');
var gcRegionsZones = require('./gcRegionsZones.json');
var gcPlans = require('./gcPlans.json');
var vpcServices = require('./vpcServices.json');
var profilePricingData = require('./pricingPlan.json');
var planDeployments = require('./gcDeployments.json');
var serviceIds = require('./serviceIds.json');
var metadata = require('./gcMetadata.json');
var gcVolumeProfiles = require('./gcVolumeProfiles.json');
var image = 'https://cache.globalcatalog.test.cloud.ibm.com/static/cache/5552-91e855dec52b6892/images/g2/globe.png';
var addRegionOrZone = function addRegionOrZone(riasRegionZone, kind) {
  var gcRegions = _server.db.getCollection(_server.COLS.globalCatalog);
  var gcRegion = {
    id: riasRegionZone.name,
    parent_id: gcRegionsZones[riasRegionZone.name].parent_id,
    kind: kind,
    overview_ui: {
      en: {
        description: gcRegionsZones[riasRegionZone.name].description,
        display_name: gcRegionsZones[riasRegionZone.name].display_name
      }
    },
    images: {
      image: image
    }
  };
  gcRegions.insert(gcRegion);
};
var addProfiles = function addProfiles() {
  var gcProfiles = _server.db.getCollection(_server.COLS.globalCatalog);
  profileData.resources.forEach(function (profile) {
    var gcProfile = {
      id: profile.id,
      name: profile.name,
      kind: 'instance.profile',
      metadata: profile.metadata
    };
    gcProfiles.insert(gcProfile);
  });
  bmProfileData.resources.forEach(function (profile) {
    var gcProfile = {
      id: profile.id,
      name: profile.name,
      kind: 'instance.profile',
      metadata: profile.metadata
    };
    gcProfiles.insert(gcProfile);
  });
  gcVolumeProfiles.resources.forEach(function (profile) {
    var gcProfile = {
      id: profile.id,
      name: profile.name,
      kind: 'volume.profile',
      metadata: profile.metadata,
      overview_ui: profile.overview_ui
    };
    gcProfiles.insert(gcProfile);
  });
};
var addPlans = function addPlans() {
  var gc = _server.db.getCollection(_server.COLS.globalCatalog);
  gcPlans.plans.forEach(function (plan) {
    var gcPlan = _objectSpread(_objectSpread({}, plan), {}, {
      kind: 'plan'
    });
    gc.insert(gcPlan);
  });
};
var addMetadata = function addMetadata() {
  var gc = _server.db.getCollection(_server.COLS.globalCatalog);
  serviceIds.forEach(function (serviceId) {
    gc.insert(_objectSpread(_objectSpread({}, metadata), {}, {
      id: serviceId
    }));
  });
};
var addProfilePricingPlans = function addProfilePricingPlans() {
  var gc = _server.db.getCollection(_server.COLS.globalCatalog);
  profilePricingData.forEach(function (plan) {
    var pricePlan = _objectSpread(_objectSpread({}, plan), {}, {
      id: plan.origin,
      kind: 'profile.plan'
    });
    gc.insert(pricePlan);
  });
};
/**
 * init()
 * Initialize globalcatalog
 */
var init = function init() {
  var regions = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  });
  _server.db.addCollection(_server.COLS.globalCatalog);
  regions.forEach(function (riasRegion) {
    addRegionOrZone(riasRegion, 'region');
    riasRegion.zones.forEach(function (riasZone) {
      addRegionOrZone(riasZone, 'zone');
    });
  });
  addProfiles();
  addPlans();
  addProfilePricingPlans();
  addMetadata();
};
exports.init = init;
var getResource = function getResource(req, res) {
  var gcResource = _server.db.getCollection(_server.COLS.globalCatalog).chain().find({
    id: req.params.id
  }).data({
    removeMeta: true
  });
  if (gcResource.length === 0) {
    res.status(404).end();
    return;
  }
  utils.delayRegionTimeout(function () {
    res.status(200).json(gcResource[0]).end();
  }, utils.isZoneTimeout(req.params.id));
};
exports.getResource = getResource;
var getResourcePlans = function getResourcePlans(req, res) {
  var gcResources = _server.db.getCollection(_server.COLS.globalCatalog).chain().find({
    kind: 'plan',
    parent_id: req.params.id
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    resources: gcResources
  }).end();
};
exports.getResourcePlans = getResourcePlans;
var getPlanDeployments = function getPlanDeployments(req, res) {
  var planId = req.params.id;
  var planName = casual.word;
  var regions = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  }).map(function (riasRegion) {
    return riasRegion.name;
  });
  var planDeployment = planDeployments.enabled && planDeployments.deployments.find(function (deployment) {
    return deployment.planId === planId;
  });
  if (planDeployment && planDeployment.locations) {
    regions = planDeployment.locations;
    planName = planDeployment.planName;
  }
  var deployments = regions.map(function (location) {
    return {
      id: casual.uuid,
      name: "".concat(planName, "-").concat(location),
      parent_id: planId,
      metadata: {
        deployment: {
          location: location
        }
      },
      kind: 'deployment'
    };
  });
  res.status(200).json({
    resources: deployments
  }).end();
};
exports.getPlanDeployments = getPlanDeployments;
var getProfilePricingPlan = function getProfilePricingPlan(req, res) {
  var gcResources = _server.db.getCollection(_server.COLS.globalCatalog).chain().find({
    kind: 'profile.plan',
    id: req.params.profileID
  }).data({
    removeMeta: true
  });
  res.status(200).json({
    resources: gcResources
  }).end();
};
exports.getProfilePricingPlan = getProfilePricingPlan;
var query = function query(req, res) {
  if (req.query && req.query.q.indexOf('name:is') >= 0) {
    res.status(200).json({
      resource_count: 1
    }).end();
    return;
  }
  if (req.query && req.query.q.indexOf('name:cloudcerts') >= 0) {
    res.status(200).json({
      resources: [{
        id: 'cc56b926-cfa1-4f50-ab9d-01986ff692be'
      }]
    }).end();
    return;
  }
  if (req.query && req.query.q.indexOf('name:secrets-manager') >= 0) {
    res.status(200).json({
      resources: [{
        id: 'bb56b926-cfa1-4f50-ab9d-01986ff692bb'
      }, {
        id: 'dd56b926-cfa1-4f50-ab9d-01986ff692dd'
      }, {
        id: 'ee56b926-cfa1-4f50-ab9d-01986ff692ee'
      }, {
        id: 'ff56b926-cfa1-4f50-ab9d-01986ff692ff'
      }, {
        id: 'gg56b926-cfa1-4f50-ab9d-01986ff692gg'
      }]
    }).end();
    return;
  }
  if (req.query && req.query.catalog === 'true') {
    var visibleVpcServices = vpcServices.resources.filter(function (service) {
      return service.isPrivateCatalogVisible !== false;
    });
    res.status(200).json({
      resources: visibleVpcServices
    }).end();
  }
  if (req.query && req.query.q === 'kind:instance.profile') {
    var profiles = _server.db.getCollection(_server.COLS.globalCatalog).chain().find({
      kind: 'instance.profile'
    }).data({
      removeMeta: true
    });
    res.status(200).json({
      resources: profiles
    }).end();
    return;
  }
  if (req.query && req.query.q === 'kind:volume.profile') {
    var _profiles = _server.db.getCollection(_server.COLS.globalCatalog).chain().find({
      kind: 'volume.profile'
    }).data({
      removeMeta: true
    });
    res.status(200).json({
      resources: _profiles
    }).end();
    return;
  }
  res.status(404).end();
};
exports.query = query;