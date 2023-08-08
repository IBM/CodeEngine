"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateAttachment = exports.removeAttachmentsForResource = exports.initDataAttachments = exports.init = exports.getAttachmentsByInstance = exports.getAttachments = exports.getAttachment = exports.fetchAttachmentsForInstance = exports.fetchAttachmentForVolume = exports.deleteAttachment = exports.createAttachment = exports.addAttachment = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _sampleSize = _interopRequireDefault(require("lodash/sampleSize"));
var _get = _interopRequireDefault(require("lodash/get"));
var _cloneDeep = _interopRequireDefault(require("lodash/cloneDeep"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _volumes2 = require("./volumes");
var _features = require("./features");
var _excluded = ["volume"];
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
// Constants

var AttachmentStatuses = ['attaching', 'attached', 'detaching'];
var AttachmentTypes = ['boot', 'data'];
var volmentAttachmentsBandwidth = new Map();
var formatAttachedItem = function formatAttachedItem(req, resourceType, resource) {
  var items = utils.getResource(resourceType, resource.id);
  var item = items[0];
  var result = {
    id: item.id,
    crn: utils.updateResourceCrnRegion(item, req),
    href: "".concat(utils.getBaseApiUrl(req)).concat(resourceType, "/").concat(item.id),
    name: item.name
  };
  return result;
};
var formatVolumeAttachmentForClient = function formatVolumeAttachmentForClient(req, _attachment, resourceType, attachments) {
  var recalculated = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var attachment = (0, _cloneDeep["default"])(_attachment);
  // update the volume href according to the request
  attachment.href = "".concat(utils.getBaseApiUrl(req), "instances/").concat(attachment.instance.id, "/volume_attachments/").concat(attachment.id);

  // if the request is coming from an `/instances` request, we return the attached volume
  if (resourceType === _server.COLS.instances) {
    if (!recalculated && volmentAttachmentsBandwidth.has(attachment.id)) {
      attachment.bandwidth = volmentAttachmentsBandwidth.get(attachment.id);
    } else {
      var _attachment$instance;
      var totalVolumeBandwidth = (_attachment$instance = attachment.instance) === null || _attachment$instance === void 0 ? void 0 : _attachment$instance.totalVolumeBandwidth;
      var volumesBandwidth = utils.getInstanceAttachedVolumesBandwidth(attachments, totalVolumeBandwidth);
      // write volume's actual bandwidth to `volmentAttachmentsBandwidth` variable
      volumesBandwidth.forEach(function (item) {
        volmentAttachmentsBandwidth.set(item.id, item.bandwidth);
      });
      attachment.bandwidth = volmentAttachmentsBandwidth.get(attachment.id);
    }
    delete attachment.instance;
    attachment.volume = formatAttachedItem(req, _server.COLS.volumes, attachment.volume);
  }

  // if the request is coming from a `/volumes` request, we return the attached instance
  if (resourceType === _server.COLS.volumes) {
    delete attachment.volume;
    attachment.instance = formatAttachedItem(req, _server.COLS.instances, attachment.instance);
  }
  return attachment;
};

/**
 * getAttachmentsForInstance() - returns an array of attachments for an instance
 * @param {*} req - request object
 */
var fetchAttachmentsForInstance = function fetchAttachmentsForInstance(req, instanceID) {
  var attachmentType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var attachmentsByInstance = _server.db.getCollection(_server.COLS.volume_attachments).chain().data().filter(function (vol) {
    var _vol$instance;
    return ((_vol$instance = vol.instance) === null || _vol$instance === void 0 ? void 0 : _vol$instance.id) === instanceID;
  });
  var attachments = _server.db.getCollection(_server.COLS.volume_attachments).chain().where(function (resource) {
    var idMatch = resource.instance.id === instanceID;
    if (attachmentType !== '') {
      return idMatch && resource.type === attachmentType;
    }
    return idMatch;
  }).simplesort('name').data({
    removeMeta: true
  });
  var result = attachments.map(function (resource) {
    return formatVolumeAttachmentForClient(req, resource, _server.COLS.instances, attachmentsByInstance);
  });
  return result;
};
exports.fetchAttachmentsForInstance = fetchAttachmentsForInstance;
var fetchAttachmentForVolume = function fetchAttachmentForVolume(req, volumeID) {
  var attachments = _server.db.getCollection(_server.COLS.volume_attachments).chain().where(function (resource) {
    return resource.volume.id === volumeID;
  }).simplesort('name').data({
    removeMeta: true
  });
  return attachments.map(function (resource) {
    return formatVolumeAttachmentForClient(req, resource, _server.COLS.volumes);
  });
};

/**
 * addAttachment() - adds an attachment to the db
 * @param {*} attachments - Attachments collection
 * @param {*} data - input data for new attachment
 */
exports.fetchAttachmentForVolume = fetchAttachmentForVolume;
var addAttachment = function addAttachment(attachments, data) {
  var baseData = {
    name: utils.generateName('volume-attachment'),
    volume: undefined,
    instance: undefined,
    id: _casual["default"].uuid,
    href: '',
    // determined by formatVolumeAttachmentForClient()
    created_at: utils.generateCreateDate(),
    status: AttachmentStatuses[1],
    type: AttachmentTypes[1],
    // default to a data attachment
    delete_volume_on_instance_delete: false // default to false
  };

  var newAttachment = _objectSpread(_objectSpread({}, baseData), data);
  attachments.insert(newAttachment);
  return newAttachment;
};

/**
 * initDataAttachments() - initializes a random set of attached data volumes
 * @param {*} attachments - attachments collection
 */
exports.addAttachment = addAttachment;
var initDataAttachments = function initDataAttachments(attachments) {
  // get a random number of volumes to attach
  var volumes = _server.db.getCollection('volumes').chain().simplesort('name').data({
    removeMeta: true
  });
  var randomVolumes = (0, _sampleSize["default"])(volumes, _casual["default"].integer(1, volumes.length));
  randomVolumes.forEach(function (volume) {
    // check to see if the volume is available status
    if (volume.status === 'available' && volume.id !== 'vol1001') {
      // get a VSI that matches the volume's zone
      var instances = _server.db.getCollection(_server.COLS.instances).chain().where(function (instance) {
        return instance.zone.region_name === volume.zone.region_name;
      }).data({
        removeMeta: true
      });
      var instance = _casual["default"].random_element(instances);
      if (!instance) {
        return;
      }

      // attach the volume to the VSI
      var attachmentData = {
        name: "volume-attachment-".concat(instance.name, "-").concat(volume.name),
        volume: {
          id: volume.id,
          capacity: volume.capacity,
          profile: volume.profile,
          iops: volume.iops // the iops will be used for custom IOPS.
        },

        instance: {
          id: instance.id,
          totalVolumeBandwidth: instance.total_volume_bandwidth
        },
        type: AttachmentTypes[1],
        device: {
          id: _casual["default"].uuid
        }
      };
      addAttachment(attachments, attachmentData);
    }
  });
};

/**
 * initBootAttachments() - initializes boot volumes for every instance in the db
 * @param {*} attachments - attachments collection
 */
exports.initDataAttachments = initDataAttachments;
var initBootAttachments = function initBootAttachments(attachments) {
  // get all of the instances
  var instances = _server.db.getCollection(_server.COLS.instances).chain().simplesort('name').data({
    removeMeta: true
  });
  instances.forEach(function (instance) {
    // create a boot volume
    var volume = (0, _volumes2.createBootVolume)(instance);

    // attach the volume to the VSI
    var attachmentData = {
      delete_volume_on_instance_delete: true,
      device: {
        id: _casual["default"].uuid
      },
      instance: {
        id: instance.id,
        totalVolumeBandwidth: instance.total_volume_bandwidth
      },
      name: "volume-attachment-".concat(instance.name, "-").concat(volume.name),
      status: AttachmentStatuses[1],
      type: AttachmentTypes[0],
      volume: {
        id: volume.id,
        capacity: volume.capacity,
        profile: volume.profile,
        iops: volume.iops // the iops will be used for custom IOPS.
      }
    };

    addAttachment(attachments, attachmentData);
  });
};
var init = function init() {
  var attachments = _server.db.addCollection(_server.COLS.volume_attachments);
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  initDataAttachments(attachments);
  initBootAttachments(attachments);
};

/**
 * getAttachments() - gets a list of the attachments
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.init = init;
var getAttachments = function getAttachments(req, res) {
  var attachments = utils.getResources(req, _server.COLS.volume_attachments);
  attachments.volume_attachments.forEach(function (attachment) {
    return formatVolumeAttachmentForClient(req, attachment);
  });
  res.json(attachments).end();
};

/**
 * getAttachmentsForInstance() - gets a list of the attachments for the specific instance
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getAttachments = getAttachments;
var getAttachmentsByInstance = function getAttachmentsByInstance(req, res) {
  var resources = fetchAttachmentsForInstance(req, req.params.instance_id);
  res.json({
    volume_attachments: resources
  }).end();
};

/**
 * createAttachment() - creates a volume attachment
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.getAttachmentsByInstance = getAttachmentsByInstance;
var createAttachment = function createAttachment(req, res) {
  var input = req.body;
  var volumeID = input.volume.id;
  if (!volumeID && !input.volume.profile && (!input.volume.capacity || !input.volume.source_snapshot)) {
    res.status(400).json(utils.generateErrors('An existing volume ID or new volume profile, capacity or source_snapshot must be supplied', 'bad_field', 'volume.id')).end();
    return;
  }

  // check to see if the instance exists
  var instances = utils.getResource(_server.COLS.instances, req.params.instance_id);
  if (!instances || instances.length === 0) {
    // if not, kick back a 404
    res.status(404).end();
    return;
  }
  if (!volumeID) {
    var _volumes = _server.db.getCollection(_server.COLS.volumes);
    var addedVolume = (0, _volumes2.addVolume)(_volumes, _objectSpread(_objectSpread({}, input.volume), {}, {
      zone: instances[0].zone
    }));
    volumeID = addedVolume.id;
  }

  // kick back a 400 if the volume doesn't exist
  if (utils.objectRefCheck(_server.COLS.volumes, volumeID, res)) {
    return;
  }
  var isAttachedVolume = _server.db.getCollection(_server.COLS.volume_attachments).chain().where(function (item) {
    return item.volume.id === volumeID;
  }).data({
    removeMeta: true
  });

  // kick back a 400 if the volume doesn't exist or is already attached
  if (isAttachedVolume.length > 0) {
    res.status(400).end();
    return;
  }

  // otherwise, we're good to create the attachment
  // create the attachment and send back a 201 w/ the attachment
  // make sure we're not creating a attachment that already exists
  var collection = _server.db.getCollection(_server.COLS.volume_attachments);
  var errorMsg = 'resource with that name already exists';
  if (utils.duplicateNameCheck(collection, input, req, res, errorMsg, _server.COLS.volume_attachments, true)) {
    return;
  }

  // add the attachment
  var volume = input.volume,
    rest = _objectWithoutProperties(input, _excluded);
  var volumes = utils.getResource(_server.COLS.volumes, volumeID);
  var attachmentTemplate = _objectSpread({
    volume: {
      id: volumeID,
      capacity: volumes[0].capacity,
      profile: volumes[0].profile,
      iops: volumes[0].iops // the iops will be used for custom IOPS.
    },

    instance: {
      id: req.params.instance_id,
      totalVolumeBandwidth: instances[0].total_volume_bandwidth
    }
  }, rest);
  var newAttachment = addAttachment(_server.db.getCollection(_server.COLS.volume_attachments), attachmentTemplate);
  // return the newly added attachment
  var attachments = _server.db.getCollection(_server.COLS.volume_attachments).chain().find({
    id: newAttachment.id
  }).data({
    removeMeta: true
  });
  var attachmentsByInstance = _server.db.getCollection(_server.COLS.volume_attachments).chain().data().filter(function (vol) {
    var _vol$instance2;
    return ((_vol$instance2 = vol.instance) === null || _vol$instance2 === void 0 ? void 0 : _vol$instance2.id) === req.params.instance_id;
  });
  var attachment = formatVolumeAttachmentForClient(req, attachments[0], _server.COLS.instances, attachmentsByInstance, true);
  res.status(201).json(attachment).end();
};

/**
 * deleteAttachment() - deletes a volume attachment
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.createAttachment = createAttachment;
var deleteAttachment = function deleteAttachment(req, res) {
  var attachments = utils.getResource(_server.COLS.volume_attachments, req.params.attachment_id);
  if (!attachments || attachments.length === 0) {
    res.status(404).end();
    return;
  }
  var attachment = attachments[0];

  // make sure the volume and instance exists
  if (utils.objectRefCheck(_server.COLS.volumes, attachment.volume.id, res)) {
    return;
  }
  if (utils.objectRefCheck(_server.COLS.instances, req.params.instance_id, res)) {
    return;
  }
  var attachmentsByInstance = _server.db.getCollection(_server.COLS.volume_attachments).chain().data().filter(function (vol) {
    var _vol$instance3;
    return ((_vol$instance3 = vol.instance) === null || _vol$instance3 === void 0 ? void 0 : _vol$instance3.id) === req.params.instance_id;
  });
  attachmentsByInstance.forEach(function (item) {
    volmentAttachmentsBandwidth["delete"](item.id);
  });

  // remove the attachment
  var attachmentsCollection = _server.db.getCollection(_server.COLS.volume_attachments);
  attachmentsCollection.remove(attachment);
  res.status(204).end();
};
exports.deleteAttachment = deleteAttachment;
var removeAttachmentsForResource = function removeAttachmentsForResource(resourceType, attachedResourceID) {
  if (resourceType === _server.COLS.instances || resourceType === _server.COLS.instance_templates) {
    var attachments = _server.db.getCollection(_server.COLS.volume_attachments).where(function (resource) {
      return resource.instance.id === attachedResourceID;
    });
    // if we're removing the attachments from an instance, it means we're deleting the instance.
    // we need to delete any attached volumes that have the `delete_volume_on_instance_delete` flag set.
    attachments.forEach(function (attachment) {
      var volumeId = (0, _get["default"])(attachment, 'volume.id', undefined);
      var delete_volume_on_instance_delete = attachment.delete_volume_on_instance_delete;
      if (delete_volume_on_instance_delete && volumeId !== undefined) {
        // delete the volume
        var collection = _server.db.getCollection(_server.COLS.volumes);
        collection.findAndRemove({
          id: volumeId
        });
      }
    });
  }

  // remove the associated attachments
  _server.db.getCollection(_server.COLS.volume_attachments).removeWhere(function (resource) {
    if (resourceType === _server.COLS.volumes) {
      return resource.volume.id === attachedResourceID;
    }
    if (resourceType === _server.COLS.instances || resourceType === _server.COLS.instance_templates) {
      return resource.instance.id === attachedResourceID;
    }
    return true;
  });
};

/**
 * getAttachment() - gets a single attachment
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.removeAttachmentsForResource = removeAttachmentsForResource;
var getAttachment = function getAttachment(req, res) {
  // find the specific attachment from the collection
  var attachment = utils.findResource(_server.COLS.volume_attachments, req.params.attachment_id, res);
  var attachmentsByInstance = _server.db.getCollection(_server.COLS.volume_attachments).chain().data().filter(function (vol) {
    var _vol$instance4;
    return ((_vol$instance4 = vol.instance) === null || _vol$instance4 === void 0 ? void 0 : _vol$instance4.id) === req.params.instance_id;
  });
  var response = formatVolumeAttachmentForClient(req, attachment, _server.COLS.instances, attachmentsByInstance);

  // return the attachment
  res.json(response).end();
};
exports.getAttachment = getAttachment;
var updateAttachment = function updateAttachment(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.volume_attachments);
  var attachmentToUpdate = utils.findResource(_server.COLS.volume_attachments, req.params.attachment_id, res, false);
  var updatedAttachment = _objectSpread(_objectSpread({}, attachmentToUpdate), {}, {
    delete_volume_on_instance_delete: input.delete_volume_on_instance_delete
  });

  // update the attachment
  collection.update(updatedAttachment);
  // find the updated volume
  var updatedResults = collection.find({
    id: updatedAttachment.id
  });
  var updatedResult = formatVolumeAttachmentForClient(req, updatedResults[0]);

  // return the updated volume
  res.status(200).json(updatedResult).end();
};
exports.updateAttachment = updateAttachment;