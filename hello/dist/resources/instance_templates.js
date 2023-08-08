"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateInstanceTemplate = exports.init = exports.getInstanceTemplates = exports.getInstanceTemplate = exports.deleteInstanceTemplate = exports.createInstanceTemplate = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _get = _interopRequireDefault(require("lodash/get"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _instances = require("./instances");
var _volumeAttachments = require("./volumeAttachments");
var _volumeProfiles = require("./volumeProfiles");
var _privatecatalog = require("../external/resources/privatecatalog");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var _formatVolumeForTemplate = function _formatVolumeForTemplate(volume) {
  delete volume.id;
  delete volume.crn;
  delete volume.encryption;
  delete volume.href;
  delete volume.status;
  delete volume.zone;
  volume.profile = {
    name: volume.profile.name
  };
  volume.iops = (0, _volumeProfiles.getIOPSForProfile)(volume.capacity, volume.profile, volume.iops);
  return volume;
};

// eslint-disable-next-line default-param-last
var _getBootVolumesAttachment = function _getBootVolumesAttachment() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var boot_volume_attachment = data.boot_volume_attachment;
  if (!boot_volume_attachment) {
    // default data if not create
    var volume = _formatVolumeForTemplate(utils.getRandomResource(_server.COLS.volumes));
    return {
      name: volume.name,
      volume: volume,
      delete_volume_on_instance_delete: true
    };
  }
  // use values from create
  return boot_volume_attachment;
};
var _getDataVolumesAttachments = function _getDataVolumesAttachments() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var volume_attachments = data.volume_attachments;
  // create data volumes and attach if needed
  var dataAttachments = volume_attachments || [];

  // random volume if not create
  if (dataAttachments.length === 0 && _casual["default"].integer(0, 10) === 5 && JSON.stringify(data) !== '{}') {
    var volume = _formatVolumeForTemplate(utils.getRandomResource(_server.COLS.volumes));
    return [{
      name: volume.name,
      volume: volume,
      delete_volume_on_instance_delete: false
    }];
  }
  // use values from create
  // if volume is tiered, no iops is passed down, make sure iops is set to match what api will return
  // determine the number of iops for the volume
  //  - Tiered profile volumes get the number of iops of the tier
  //  - Custom profile volumes get the custom number of iops (no change from default)
  dataAttachments.forEach(function (item) {
    var _item$volume, _item$volume2, _item$volume2$source_;
    if (!(item !== null && item !== void 0 && (_item$volume = item.volume) !== null && _item$volume !== void 0 && _item$volume.id) && !((_item$volume2 = item.volume) !== null && _item$volume2 !== void 0 && (_item$volume2$source_ = _item$volume2.source_snapshot) !== null && _item$volume2$source_ !== void 0 && _item$volume2$source_.id)) {
      item.volume.iops = (0, _volumeProfiles.getIOPSForProfile)(item.volume.capacity, item.volume.profile, item.volume.iops);
    }
  });
  return dataAttachments;
};

// similar to instances:addInstance, as they are similar objects
// eslint-disable-next-line default-param-last
var addInstanceTemplate = function addInstanceTemplate(templates) {
  var _data$boot_volume_att, _data$boot_volume_att2, _data$boot_volume_att3, _data$boot_volume_att4, _data$boot_volume_att5;
  var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var res = arguments.length > 2 ? arguments[2] : undefined;
  var id = data.id ? data.id : _casual["default"].uuid;
  var regionName = data.regionName || data.zone && utils.findZone(data.zone.name).region_name || '';
  var profile = utils.getRandomResource(_server.COLS.profiles);
  var inputProfileInfo = data.profile && utils.findResource(_server.COLS.profiles, data.profile.name);
  var image;
  if (data.image) {
    image = utils.findResource(_server.COLS.images, data.image.id, res, false);
  } else if (!((_data$boot_volume_att = data.boot_volume_attachment) !== null && _data$boot_volume_att !== void 0 && (_data$boot_volume_att2 = _data$boot_volume_att.volume) !== null && _data$boot_volume_att2 !== void 0 && (_data$boot_volume_att3 = _data$boot_volume_att2.snapshot) !== null && _data$boot_volume_att3 !== void 0 && _data$boot_volume_att3.id) && !((_data$boot_volume_att4 = data.boot_volume_attachment) !== null && _data$boot_volume_att4 !== void 0 && (_data$boot_volume_att5 = _data$boot_volume_att4.volume) !== null && _data$boot_volume_att5 !== void 0 && _data$boot_volume_att5.id)) {
    image = utils.getRandomResource(_server.COLS.images);
  }
  var subnet = regionName ? utils.getRandomResourceInZone(_server.COLS.subnets, regionName) : utils.getRandomResource(_server.COLS.subnets);
  var zone = utils.findZone(subnet.zone.name);
  regionName = regionName || zone.region_name;
  var vpc = utils.findResource(_server.COLS.vpcs, subnet.vpc.id);
  var key = data.key || utils.getRandomResourceInRegion(_server.COLS.keys, regionName);
  /**
   * Assign a default subnet to initial templates
   * */
  var userData = data.user_data || undefined;
  var bootVolumeAttachment = _getBootVolumesAttachment(data);
  var volumeAttachments = _getDataVolumesAttachments(data);
  var baseData = {
    id: id,
    crn: utils.generateCRN(),
    href: '',
    // Placholder
    // random ID for boot volume for now as volumes do not exist.
    boot_volume_attachment: bootVolumeAttachment,
    created_at: utils.generateCreateDate(),
    memory: inputProfileInfo ? inputProfileInfo.memorySize : profile.memorySize,
    network_interfaces: data.network_interfaces ? data.network_interfaces : [],
    primary_network_interface: data.primary_network_interface || {
      name: utils.generateName('primary'),
      subnet: {
        id: subnet.id
      },
      security_groups: [utils.getRandomResourceInZone(_server.COLS.security_groups, regionName)]
    },
    profile: {
      name: profile.name
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    user_data: userData,
    metadata_service: {
      enabled: true
    },
    volume_attachments: volumeAttachments,
    vpc: {
      id: vpc.id
    },
    keys: [{
      id: key.id
    }],
    total_volume_bandwidth: profile.totalVolumeBandwidth
  };
  if (JSON.stringify(data) === '{}') {
    if (_casual["default"].integer(0, 4) % 4 === 0) {
      var version = (0, _privatecatalog.getRandomCatalogVersion)();
      baseData.catalog_offering = {
        version: {
          crn: version.crn
        }
      };
    }
    if (_casual["default"].integer(0, 4) % 4 === 0) {
      baseData.default_trusted_profile = {
        auto_link: true,
        target: {
          id: utils.getRandomTrustedProfileId()
        }
      };
    }
    if (_casual["default"].integer(0, 4) % 4 === 1) {
      var _getZonalResourcesInZ, _getZonalResourcesInZ2, _dedicatedHost$name, _placementGroup$name;
      var dedicatedHost = (_getZonalResourcesInZ = (0, utils.getZonalResourcesInZone)(_server.COLS.dedicated_hosts, subnet.zone.name)) === null || _getZonalResourcesInZ === void 0 ? void 0 : _getZonalResourcesInZ[0];
      var dedicatedGroup = (_getZonalResourcesInZ2 = (0, utils.getZonalResourcesInZone)(_server.COLS.dedicated_host_groups, subnet.zone.name)) === null || _getZonalResourcesInZ2 === void 0 ? void 0 : _getZonalResourcesInZ2[0];
      var placementGroup = utils.getRandomResourceInRegion(_server.COLS.placement_groups, regionName);
      if (_casual["default"].coin_flip && dedicatedHost !== null && dedicatedHost !== void 0 && dedicatedHost.id && !((_dedicatedHost$name = dedicatedHost.name) !== null && _dedicatedHost$name !== void 0 && _dedicatedHost$name.includes('delete'))) {
        baseData.placement_target = {
          id: dedicatedHost.id
        };
      } else if (_casual["default"].coin_flip && dedicatedGroup !== null && dedicatedGroup !== void 0 && dedicatedGroup.id) {
        baseData.placement_target = {
          id: dedicatedGroup.id
        };
      } else if (placementGroup !== null && placementGroup !== void 0 && placementGroup.id && !((_placementGroup$name = placementGroup.name) !== null && _placementGroup$name !== void 0 && _placementGroup$name.includes('delete'))) {
        baseData.placement_target = {
          id: placementGroup.id
        };
      }
    }
  }
  if (image) {
    baseData.image = {
      id: image.id
    };
  }
  var newTemplate = _objectSpread(_objectSpread(_objectSpread({}, baseData), data), {}, {
    zone: zone
  });
  if (!newTemplate.name) {
    newTemplate.name = utils.generateName('template');
  }
  templates.insert(newTemplate);
  return newTemplate.id;
};
var formatInstanceTemplateForClient = function formatInstanceTemplateForClient(template, req) {
  var href = "".concat(utils.getBaseApiUrl(req), "instance/templates/").concat(template.id);
  var crn = utils.updateResourceCrnRegion(template, req);
  var image = template.image ? utils.getAndFormatResourceLinkForClient(req, _server.COLS.images, template.image.id) : undefined;
  var profile = (0, _instances.getResponseObjectWithName)(_server.COLS.profiles, template.profile.name, req);
  var vpc = utils.getAndFormatResourceLinkForClient(req, _server.COLS.vpcs, template.vpc.id);
  var id = template.id,
    boot_volume_attachment = template.boot_volume_attachment,
    default_trusted_profile = template.default_trusted_profile,
    name = template.name,
    vcpu = template.vcpu,
    primary_network_interface = template.primary_network_interface,
    network_interfaces = template.network_interfaces,
    created_at = template.created_at,
    keys = template.keys,
    memory = template.memory,
    resource_group = template.resource_group,
    metadata_service = template.metadata_service,
    user_data = template.user_data,
    status = template.status,
    volume_attachments = template.volume_attachments,
    zone = template.zone,
    total_volume_bandwidth = template.total_volume_bandwidth,
    catalog_offering = template.catalog_offering;
  var placement_target_id = (0, _get["default"])(template, 'placement_target.id', undefined);
  var placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_hosts, placement_target_id);
  if (!placement_target) {
    placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.dedicated_host_groups, placement_target_id);
    if (placement_target) {
      placement_target.href = "".concat(utils.getBaseApiUrl(req), "dedicated_host/groups/").concat(placement_target.id);
    }
  }
  if (!placement_target) {
    placement_target = utils.getAndFormatResourceLinkForClient(req, _server.COLS.placement_groups, placement_target_id);
  }
  var result = {
    id: id,
    crn: crn,
    default_trusted_profile: default_trusted_profile,
    name: name,
    boot_volume_attachment: boot_volume_attachment,
    vcpu: vcpu,
    created_at: created_at,
    keys: keys,
    memory: memory,
    resource_group: resource_group,
    metadata_service: metadata_service,
    status: status,
    volume_attachments: volume_attachments,
    zone: zone,
    href: href,
    image: image,
    profile: profile,
    user_data: user_data,
    vpc: vpc,
    primary_network_interface: primary_network_interface,
    network_interfaces: network_interfaces,
    placement_target: placement_target,
    total_volume_bandwidth: total_volume_bandwidth,
    catalog_offering: catalog_offering
  };
  return result;
};
var createInstanceTemplate = function createInstanceTemplate(req, res) {
  var input = req.body;
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.instance_templates), input, req, res, 'resource with that name already exists', 'instance_template')) {
    return;
  }
  if (input.source_template) {
    var template = _server.db.getCollection(_server.COLS.instance_templates).chain().find({
      id: input.source_template.id
    }).data({
      removeMeta: true
    })[0];
    if (!template) {
      res.status(404).send('instance template not found');
      return;
    }
    input = _objectSpread(_objectSpread({}, template), input);
    delete input.id;
  }
  if (utils.validZoneNameCheck(input.zone, req, res)) {
    return;
  }
  var id = addInstanceTemplate(_server.db.getCollection(_server.COLS.instance_templates), input, res);
  var instance;
  instance = utils.findResource(_server.COLS.instance_templates, id, res, false);
  instance = utils.findResource(_server.COLS.instance_templates, id, res, false);
  res.status(201).json(formatInstanceTemplateForClient(instance, req)).end();
};
exports.createInstanceTemplate = createInstanceTemplate;
var init = function init() {
  var instance_templates = _server.db.addCollection(_server.COLS.instance_templates);
  _server.db.addCollection(_server.COLS.network_interface_templates);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-1',
    id: 'instancetemplate-1',
    primary_network_interface: {
      name: utils.generateName('primary'),
      subnet: {
        id: 'subnet-1'
      },
      security_groups: [utils.getRandomResourceInZone(_server.COLS.security_groups, utils.DEFAULT_REGION)]
    },
    vpc: {
      id: 'vpc1001'
    },
    regionName: utils.DEFAULT_REGION,
    image: {
      id: 'e15b69f1-c701-f621-e752-70eda3df5695'
    }
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-3',
    id: 'instancetemplate-3',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-4',
    id: 'instancetemplate-4',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-5',
    id: 'instancetemplate-5',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-6',
    id: 'instancetemplate-6',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-7',
    id: 'instancetemplate-7',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-8',
    id: 'instancetemplate-8',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-9',
    id: 'instancetemplate-9',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-10',
    id: 'instancetemplate-10',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-11',
    id: 'instancetemplate-11',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-1-delete',
    id: 'instancetemplate-1-delete',
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-2',
    id: 'instancetemplate-2',
    subnet: {
      id: 'subnet-2'
    },
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-default-instance-template-12',
    id: 'instancetemplate-12',
    subnet: {
      id: 'subnet-2'
    },
    key: {
      id: '8cdf8de2-5835-4843-8c87-925c94a6d136'
    },
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-test-default-duplicate-instance-template-1',
    id: 'instancetemplate-13',
    subnet: {
      id: 'subnet-1'
    },
    vpc: {
      id: 'vpc1001'
    },
    key: {
      id: '8cdf8de2-5835-4843-8c87-925c94a6d136'
    },
    volume_attachments: [{
      name: 'aaa-test-data-volume',
      volume: {
        name: 'aaa-test-data-volume',
        capacity: 101,
        profile: {
          name: '5iops-tier'
        }
      },
      delete_volume_on_instance_delete: true
    }],
    regionName: utils.DEFAULT_REGION
  });
  addInstanceTemplate(instance_templates, {
    name: 'aaa-test-it-duplicate-cy-1',
    id: 'instancetemplate-14',
    subnet: {
      id: 'subnet-1'
    },
    vpc: {
      id: 'vpc1001'
    },
    key: {
      id: '8cdf8de2-5835-4843-8c87-925c94a6d136'
    },
    regionName: utils.DEFAULT_REGION
  });
  utils.repeat(function () {
    addInstanceTemplate(instance_templates);
  }, _casual["default"].integer(_features.shouldGenerateLotsOfResources ? 68 : 18, _features.shouldGenerateLotsOfResources ? 98 : 38));
};
exports.init = init;
var getInstanceTemplates = function getInstanceTemplates(req, res) {
  var instanceTemplates = utils.getResources(req, _server.COLS.instance_templates);
  instanceTemplates.templates = instanceTemplates.instance_templates.map(function (template) {
    return formatInstanceTemplateForClient(template, req);
  });
  delete instanceTemplates.instance_templates;
  res.json(instanceTemplates).end();
};
exports.getInstanceTemplates = getInstanceTemplates;
var getInstanceTemplate = function getInstanceTemplate(req, res) {
  var template = (utils.getResource(_server.COLS.instance_templates, req.params.template_id) || [])[0];
  if (!template) {
    res.status(404).end();
    return;
  }
  res.json(formatInstanceTemplateForClient(template, req)).end();
};

/**
 * updateInstanceTemplate()
 * PATCH /instances/templates/{id}
 * Update details in an existing instance template.
 *
 * @param {*} req
 * @param {*} res
 */
exports.getInstanceTemplate = getInstanceTemplate;
var updateInstanceTemplate = function updateInstanceTemplate(req, res) {
  var input = req.body;
  var templates = _server.db.getCollection(_server.COLS.instance_templates);
  var prviousTemplate = utils.findResource(_server.COLS.instance_templates, req.params.template_id, res, false);
  var updatedTemplate = _objectSpread(_objectSpread({}, prviousTemplate), input);
  templates.update(updatedTemplate);
  var response = formatInstanceTemplateForClient(updatedTemplate, req);
  res.status(200).json(response).end();
};
exports.updateInstanceTemplate = updateInstanceTemplate;
var deleteInstanceTemplate = function deleteInstanceTemplate(req, res) {
  var templates = _server.db.getCollection(_server.COLS.instance_templates).find({
    id: req.params.template_id
  });
  if (!templates || templates.length === 0) {
    res.status(404).end();
    return;
  }
  var groups = _server.db.getCollection(_server.COLS.instance_groups).chain().find().where(function (obj) {
    var _obj$instance_templat;
    return ((_obj$instance_templat = obj.instance_template) === null || _obj$instance_templat === void 0 ? void 0 : _obj$instance_templat.id) === req.params.template_id;
  }).data({
    removeMeta: true
  });
  if ((groups === null || groups === void 0 ? void 0 : groups.length) > 0) {
    res.status(400).json((0, utils.generateErrors)('instance template is being used by 1 or more instance groups', 409, 'template_in_use')).end();
    return;
  }
  _server.db.getCollection(_server.COLS.instance_templates).findAndRemove({
    id: req.params.template_id
  });
  (0, _volumeAttachments.removeAttachmentsForResource)(_server.COLS.instance_templates, req.params.template_id);
  res.status(204).end();
};
exports.deleteInstanceTemplate = deleteInstanceTemplate;