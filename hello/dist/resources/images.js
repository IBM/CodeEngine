"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateImage = exports.obsoleteImage = exports.init = exports.getImages = exports.getImage = exports.deprecateImage = exports.deleteImage = exports.createImage = void 0;
var _casual = _interopRequireDefault(require("casual"));
var _server = require("../server");
var utils = _interopRequireWildcard(require("../utils"));
var _keyprotect = require("../external/resources/keyprotect");
var _volumeAttachments = require("./volumeAttachments");
var _privatecatalog = require("../external/resources/privatecatalog");
var _features = require("./features");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
var imageData = require('./images.json');
var osList = require('./operatingSystems.json');
var ImageStatuses = ['available', 'pending', 'failed', 'deprecated', 'obsolete', 'deleting', 'tentative', 'unusable'];
var StatusReasons = ['encryption_key_deleted', 'encryption_key_disabled'];
var Visibility = ['public', 'private'];
var OperatingSystems = ['Debian GNU/Linux', 'CentOS', 'Ubuntu Linux', 'Fedora', 'Windows Server'];
var Architectures = ['s390x', 'amd64'];
var addImage = function addImage(images, data) {
  var _data$operating_syste2, _data$operating_syste3;
  var imageStatus = data.status || _casual["default"].random_element(ImageStatuses);
  var statusReasons = [];
  if (imageStatus === 'unusable') {
    var code = _casual["default"].random_element[StatusReasons];
    statusReasons.push({
      code: code,
      message: code === 'encryption_key_deleted' ? 'Encryption key has been deleted.' : 'Encryption key has been disabled.',
      more_info: 'https://cloud.ibm.com/docs/key-protect?topic=key-protect-restore-keys'
    });
  }
  var fileSize = _casual["default"].integer(50, 110);
  var matchingOs = osList.find(function (os) {
    var _data$operating_syste;
    return os.name === (data === null || data === void 0 ? void 0 : (_data$operating_syste = data.operating_system) === null || _data$operating_syste === void 0 ? void 0 : _data$operating_syste.name);
  });
  var osType = (data === null || data === void 0 ? void 0 : (_data$operating_syste2 = data.operating_system) === null || _data$operating_syste2 === void 0 ? void 0 : _data$operating_syste2.family) || (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.family) || _casual["default"].random_element(OperatingSystems);
  var baseData = {
    id: _casual["default"].uuid,
    crn: utils.generateCRN(),
    created_at: utils.generateCreateDate(),
    format: 'vhd',
    file: {
      checksums: {
        sha256: _casual["default"].uuid
      },
      href: "ims://images/".concat(_casual["default"].uuid),
      size: fileSize
    },
    operating_system: {
      name: _casual["default"].uuid,
      type: osType,
      architecture: (data === null || data === void 0 ? void 0 : (_data$operating_syste3 = data.operating_system) === null || _data$operating_syste3 === void 0 ? void 0 : _data$operating_syste3.architecture) || (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.architecture) || _casual["default"].random_element(Architectures),
      description: (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.family) || _casual["default"].random_element(OperatingSystems),
      display_name: (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.display_name) || osType,
      vendor: (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.vendor) || osType,
      family: (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.family) || osType,
      version: (matchingOs === null || matchingOs === void 0 ? void 0 : matchingOs.version) || "".concat(_casual["default"].integer(5, 10), "x - ").concat(osType)
    },
    encryption_key: data.encryption_key,
    minimum_provisioned_size: fileSize + 10,
    status: imageStatus,
    status_reasons: statusReasons,
    visibility: _casual["default"].random_element(Visibility),
    owner_type: 'provider'
  };
  if (baseData.visibility === 'private') {
    // We are adding a custom image - We don't have proper
    // OS information readily available so we we will just
    // use the random base data for OS and file.
    delete data.operating_system;
    delete data.file;
    baseData.resource_group = {
      id: utils.getRandomResourceGroup()
    };
  }

  // If are adding a custom image - We don't have proper
  // OS information readily available so we we will just
  // use the random base data for OS and file.
  if (data.visibility === 'private') {
    delete data.operating_system;
    delete data.file;
  }
  if (data.encryption_key && data.encryption_key.crn) {
    data.encryption = 'user_managed';
  } else {
    data.encryption = 'none';
  }
  var newImage = _objectSpread(_objectSpread({}, baseData), data);
  images.insert(newImage);
  return newImage.id;
};
var formatImageForClient = function formatImageForClient(req, image) {
  var _image$source_volume, _image$source_image;
  // Image href
  image.href = "".concat(utils.getBaseApiUrl(req), "images/").concat(image.id);
  image.crn = utils.updateResourceCrnRegion(image, req);
  if ((_image$source_volume = image.source_volume) !== null && _image$source_volume !== void 0 && _image$source_volume.id) {
    var sourceVol = utils.findResource(_server.COLS.volumes, image.source_volume.id, undefined, false);
    if (sourceVol) {
      image.source_volume.name = sourceVol.name;
    } else {
      image.source_volume.deleted = {
        more_info: 'https://cloud.ibm.com/apidocs/vpc#deleted-resources'
      };
      image.source_volume.name = utils.generateDeletedName(image.source_volume.id);
    }
  }
  if (image !== null && image !== void 0 && (_image$source_image = image.source_image) !== null && _image$source_image !== void 0 && _image$source_image.id) {
    var sourceImg = utils.findResource(_server.COLS.images, image.source_image.id, undefined, false);
    var zone = utils.findZone((sourceImg === null || sourceImg === void 0 ? void 0 : sourceImg.zone.name) || utils.getDefaultZone());
    if (sourceImg) {
      image.source_image.name = sourceImg.name;
      image.source_image.href = "".concat(utils.getBaseApiUrl(req), "images/").concat(sourceImg.id);
      image.source_image.remote = {
        name: zone.name,
        href: "".concat(utils.getBaseApiUrl(req), "regions/").concat(zone.region_name, "/zones/").concat(zone.name)
      };
    } else {
      image.source_image.deleted = {
        more_info: 'https://cloud.ibm.com/apidocs/vpc#deleted-resources'
      };
      image.source_image.name = utils.generateDeletedName(image.source_image.id);
    }
  }
  if (!image.owner_type) {
    if (image.visibility === 'public') {
      image.owner_type = 'provider';
    } else {
      image.owner_type = 'user';
    }
  }
};

/**
 * Create a new Image.
 * @param {*} req
 * @param {*} res
 */
var createImage = function createImage(req, res) {
  var _input$source_volume, _input$source_image;
  var input = req.body;
  input.visibility = input.visibility || 'private';
  if (utils.duplicateNameCheck(_server.db.getCollection(_server.COLS.images), input, req, res, 'resource with that name already exists', 'image')) {
    return;
  }
  input.id = _casual["default"].uuid;
  /* Setting status as available to enable Delete/Edit functionality for test cases */
  input.status = 'available';
  var instanceId;
  var insCol;
  var collection = _server.db.getCollection(_server.COLS.volumes);
  var imagesCollection = _server.db.getCollection(_server.COLS.images);
  if ((_input$source_volume = input.source_volume) !== null && _input$source_volume !== void 0 && _input$source_volume.id) {
    var _bootAtt$instance;
    var volumes = collection.find({
      id: input.source_volume.id
    });
    if (!volumes || volumes.length === 0) {
      res.status(400).json(utils.generateErrors('volume does not exist', 'volume_does_not_exist', 'source_volume.id')).end();
      return;
    }
    var volume = volumes[0];
    volume.busy = true;
    collection.update(volume);
    var volAtts = (0, _volumeAttachments.fetchAttachmentForVolume)(req, volume.id);
    var bootAtt = volAtts.find(function (vatt) {
      return vatt.type === 'boot';
    });
    instanceId = bootAtt === null || bootAtt === void 0 ? void 0 : (_bootAtt$instance = bootAtt.instance) === null || _bootAtt$instance === void 0 ? void 0 : _bootAtt$instance.id;
    insCol = _server.db.getCollection(_server.COLS.instances);
    if (instanceId) {
      var instances = insCol.find({
        id: instanceId
      });
      if (instances && instances.length > 0) {
        instances[0].status = 'stopped';
        instances[0].status_reasons = [{
          code: 'image_creation_in_progress',
          message: 'Image is creating from the attached boot volume',
          more_info: 'https://cloud.ibm.com/docs/image_create_from_volume.html'
        }];
        instances[0].startable = false;
        insCol.update(instances[0]);
      }
    }
  } else if ((_input$source_image = input.source_image) !== null && _input$source_image !== void 0 && _input$source_image.crn) {
    var _images = imagesCollection.data.filter(function (image) {
      var _input$source_image2;
      var imageCrn = utils.updateResourceCrnRegion(image, req);
      return imageCrn === ((_input$source_image2 = input.source_image) === null || _input$source_image2 === void 0 ? void 0 : _input$source_image2.crn);
    });
    if (!_images || _images.length === 0) {
      res.status(400).json(utils.generateErrors('image does not exist', 'image_does_not_exist', 'source_image.crn')).end();
      return;
    }
    var _image = _images[0];
    _image.busy = true;
    input.source_image.id = _image.id;
    imagesCollection.update(_image);
  }
  // set volume/image status after 60 seconds
  setTimeout(function () {
    var _input$source_volume2, _input$source_image3;
    if (instanceId) {
      var _instances = insCol.find({
        id: instanceId
      });
      if (_instances && _instances.length > 0) {
        _instances[0].status = 'running';
        _instances[0].status_reasons = [];
        _instances[0].startable = true;
        insCol.update(_instances[0]);
      }
    }
    if ((_input$source_volume2 = input.source_volume) !== null && _input$source_volume2 !== void 0 && _input$source_volume2.id) {
      var vols = collection.find({
        id: input.source_volume.id
      });
      if (vols && vols.length > 0) {
        vols[0].busy = false;
        collection.update(vols[0]);
      }
    }
    if ((_input$source_image3 = input.source_image) !== null && _input$source_image3 !== void 0 && _input$source_image3.crn) {
      var imgs = imagesCollection.data.filter(function (image) {
        var _input$source_image4;
        var imageCrn = utils.updateResourceCrnRegion(image, req);
        return imageCrn === ((_input$source_image4 = input.source_image) === null || _input$source_image4 === void 0 ? void 0 : _input$source_image4.crn);
      });
      if (imgs && imgs.length > 0) {
        imgs[0].busy = false;
        imagesCollection.update(imgs[0]);
      }
    }
    var imgCol = _server.db.getCollection(_server.COLS.images);
    var images = imgCol.find({
      id: input.id
    });
    if (images && images.length > 0) {
      images[0].status = 'available';
      images[0].status_reasons = [];
      imgCol.update(images[0]);
    }
  }, 60000);
  input.zone = utils.findZoneInRegion(utils.getQueryRegion(req));
  input.owner_type = 'user';
  var id = addImage(_server.db.getCollection(_server.COLS.images), input, false);
  var images = _server.db.getCollection(_server.COLS.images).chain().find({
    id: id
  }).data({
    removeMeta: true
  });
  var image = images[0];
  formatImageForClient(req, image);
  res.status(201).json(image).end();
};
exports.createImage = createImage;
var init = function init() {
  var _getRootKey2, _getRootKey3;
  var images = _server.db.addCollection(_server.COLS.images);

  /*
   * This makes it easy for us to load our image data.  This file came from calling the
   * real RIAS API.
   */
  var regions = _server.db.getCollection(_server.COLS.regions).chain().data({
    removeMeta: true
  });
  // console.log("regions ", regions);
  var makeOneImageFromVolume = false;
  var makeImage = function makeImage(image, index) {
    var fileSize = _casual["default"].integer(50, 110);
    var baseData = _objectSpread(_objectSpread({}, image), {}, {
      region: image.visibility === 'private' ? regions[(index + 1) % regions.length].name : undefined,
      // 'us-east'
      file: _objectSpread(_objectSpread({}, image.file), {}, {
        size: fileSize
      }),
      minimum_provisioned_size: fileSize + _casual["default"].integer(10, 50)
    });
    if (baseData.visibility === 'private') {
      var _baseData$encryption_;
      baseData.resource_group = {
        id: utils.getRandomResourceGroup()
      };
      if (image.encryption === 'user_managed') {
        var _getRootKey;
        baseData.encryption_key = {
          crn: (_getRootKey = (0, _keyprotect.getRootKey)({
            region_name: baseData.region
          })) === null || _getRootKey === void 0 ? void 0 : _getRootKey.crn
        };
      }
      if (!(baseData !== null && baseData !== void 0 && (_baseData$encryption_ = baseData.encryption_key) !== null && _baseData$encryption_ !== void 0 && _baseData$encryption_.crn) && _casual["default"].integer(0, 4) % 4 === 1) {
        var version = (0, _privatecatalog.getRandomCatalogVersion)();
        baseData.catalog_offering = {
          version: {
            crn: version.crn
          },
          managed: true
        };
      }
      if (baseData.status === 'available' && !baseData.catalog_offering) {
        // If status is available, and is not catalog managed, randomized some image lifecycle dates for deprecated/obsolete
        var lifecycleStatusRandomizer = _casual["default"].integer(0, 6);
        if (lifecycleStatusRandomizer < 2) {
          baseData.status = 'deprecated';
          baseData.deprecation_at = utils.generateCreateDate();
          if (_casual["default"].integer(0, 1) === 1) {
            baseData.obsolescence_at = utils.generateFutureDate();
          }
        } else if (lifecycleStatusRandomizer < 4) {
          if (_casual["default"].integer(0, 1) === 1) {
            baseData.deprecation_at = utils.generateFutureDate();
          }
          if (_casual["default"].integer(0, 1) === 1) {
            baseData.obsolescence_at = utils.generateFutureDate();
          }
        } else if (lifecycleStatusRandomizer === 4) {
          baseData.status = 'obsolete';
          baseData.deprecation_at = utils.generateCreateDate();
          baseData.obsolescence_at = utils.generateCreateDate();
        }
      }
      if (!makeOneImageFromVolume) {
        makeOneImageFromVolume = true;
        baseData.source_volume = {
          id: 'vol1001'
        };
      }
    }
    if (!baseData.owner_type) {
      baseData.owner_type = 'provider';
    }
    images.insert(baseData);
  };
  imageData.images.forEach(function (img, i) {
    if (img.id === 'e15b69f1-c701-f621-e752-70eda3df5696') {
      // we're going to make many images from this one
      utils.repeat(function (a, idx) {
        makeImage(_objectSpread(_objectSpread({}, img), {}, {
          id: _casual["default"].uuid,
          crn: utils.generateCRN(),
          name: "".concat(img.name, "-").concat(idx)
        }), i);
      }, _casual["default"].integer(12, 25));
    } else {
      makeImage(img, i);
    }
  });
  if (_features.shouldNotCreateRIASResources) {
    return;
  }
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'aaa-custom-image-01',
    visibility: 'Private',
    __typename: 'Image',
    owner_type: 'user',
    status: 'available',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone())
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'aaa-custom-image-default-02_encrypted',
    visibility: 'Private',
    __typename: 'Image',
    owner_type: 'user',
    encryption_key: {
      crn: (_getRootKey2 = (0, _keyprotect.getRootKey)({
        region_name: 'us-east'
      })) === null || _getRootKey2 === void 0 ? void 0 : _getRootKey2.crn
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone())
  });
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-cccc-cccc-cccc-cccccccccccc',
    name: 'aaa-ci-default-04',
    visibility: 'Private',
    __typename: 'Image',
    owner_type: 'user',
    status: 'available',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone())
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-dddd-dddd-dddd-dddddddddddd',
    name: 'aaa-ci-default-05',
    visibility: 'Private',
    __typename: 'Image',
    owner_type: 'user',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getSecondDefaultZone()),
    isManagedByCatalog: true,
    encryption_key: 'none'
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'aaa-ci-default-06',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getSecondDefaultZone()),
    owner_type: 'user',
    catalog_offering: {
      version: {
        crn: (0, _privatecatalog.getRandomCatalogVersion)().crn
      },
      managed: true
    }
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-ffff-ffff-ffff-ffffffffffff',
    name: 'aaa-ci-default-07',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getSecondDefaultZone()),
    status: 'available',
    owner_type: 'user'
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-ffff-ffff-ffff-fffffffffffff',
    name: 'aaa-aa-ci-delete',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getSecondDefaultZone()),
    status: 'available',
    owner_type: 'user'
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-azaz-azaz-azaz-azazazazazaza',
    name: 'aaa-ci-test-source-vol',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getSecondDefaultZone()),
    status: 'available',
    owner_type: 'user',
    source_volume: {
      id: 'd02e50dd-e12c-4f92-a7da-b1428a8c0498'
    }
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-abcd-abcd-abcd-bbbbbbbbbbbb',
    name: 'aaa-custom-source-image',
    visibility: 'Private',
    __typename: 'Image',
    owner_type: 'user',
    source_image: {
      id: 'custom-image-ffff-ffff-ffff-fffffffffffff'
    },
    encryption_key: {
      crn: (_getRootKey3 = (0, _keyprotect.getRootKey)({
        region_name: 'us-east'
      })) === null || _getRootKey3 === void 0 ? void 0 : _getRootKey3.crn
    },
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone())
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-hhhh-hhhh-hhhh-hhhhhhhhhhhh',
    name: 'aaa-aa-custom-image-delete',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone()),
    status: 'available',
    owner_type: 'user'
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-wwww-wwww-wwww-wwwwwwwwwwww',
    name: 'aaa-ci-test',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone()),
    status: 'available',
    owner_type: 'user',
    source_volume: {
      id: 'd02e50dd-e12c-4f92-a7da-b1428a8c0498'
    }
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-tttt-aaaa-nnnn-avavavavavav',
    name: 'aaa-windows-test',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone()),
    operating_system: {
      href: 'https://us-south.iaas.cloud.ibm.com/v1/operating_systems/windows-2012-amd64',
      name: 'windows-2012-amd64',
      architecture: 'amd64',
      display_name: 'Windows Server 2012 Standard Edition (amd64)',
      family: 'Windows Server'
    },
    status: 'available',
    owner_type: 'user',
    source_volume: {
      id: 'd02e50dd-e12c-4f92-a7da-b1428a8c0498'
    }
  }, false);
  addImage(images, {
    created_at: utils.generateCreateDate(),
    CRN: utils.generateCRN(),
    id: 'custom-image-ssss-uuuu-pppp-rrreeettthhh',
    name: 'aaa-ubutu-linux-test',
    visibility: 'private',
    resource_group: {
      id: utils.getRandomResourceGroup()
    },
    zone: utils.findZone(utils.getDefaultZone()),
    operating_system: {
      href: 'https://us-south.iaas.cloud.ibm.com/v1/operating_systems/ubuntu-18-04-amd64',
      name: 'ubuntu-18-04-amd64',
      architecture: 'amd64',
      display_name: 'Ubuntu Linux 18.04 LTS Bionic Beaver Minimal Install (s390x)',
      family: 'Ubuntu Linux'
    },
    status: 'available',
    owner_type: 'user',
    source_volume: {
      id: 'd02e50dd-e12c-4f92-a7da-b1428a8c0498'
    }
  }, false);
  addImage(images, {
    id: 'custom-image-aaaa-uuuu-rrrr-bbbbiiiinnnn',
    CRN: utils.generateCRN(),
    name: 'ibm-redhat-8-4-minimal-amd64',
    operating_system: {
      name: 'ibm-redhat-8-4-minimal-amd64',
      architecture: 'amd64',
      display_name: 'Red Hat Enterprise Linux 8.x - Minimal Install (amd64)',
      family: 'Red Hat Enterprise Linux',
      vendor: 'Red Hat',
      version: '7.x - Minimal Install'
    },
    status: 'available',
    visibility: 'public',
    owner_type: 'provider'
  }, false);
};
exports.init = init;
var getImages = function getImages(req, res) {
  var images = utils.getResources(req, _server.COLS.images, function (resource) {
    // hide z images in eu-de region
    if (req.query.region === 'eu-de') {
      if (resource.operating_system.architecture === 's390x') {
        return false;
      }
    }
    if (req.query.visibility && resource.visibility !== req.query.visibility) {
      return false;
    }
    if (req.query.owner_type && resource.owner_type !== req.query.owner_type) {
      return false;
    }
    var provisionQuery = req.query.provisionable;
    if (provisionQuery === undefined) {
      // no provisionable query, only return provisionable images
      return resource.provisionable !== false;
    }
    var provisionValues = provisionQuery.split(',');
    var hasTrue = false;
    var hasFalse = false;
    provisionValues.forEach(function (pv) {
      if (pv.trim() === 'true') {
        hasTrue = true;
      }
      if (pv.trim() === 'false') {
        hasFalse = true;
      }
    });
    if (hasTrue && hasFalse) {
      return true;
    }
    if (hasTrue) {
      return resource.provisionable !== false;
    }
    if (hasFalse) {
      return resource.provisionable === false;
    }
    return true;
  });
  images.images.forEach(function (image) {
    formatImageForClient(req, image);
  });
  res.json(images).end();
};
exports.getImages = getImages;
var getImage = function getImage(req, res) {
  var images = _server.db.getCollection(_server.COLS.images).chain().find({
    id: req.params.image_id
  }).data({
    removeMeta: true
  });
  if (images.length === 0) {
    res.status(404).end();
    return;
  }
  var image = images[0];
  formatImageForClient(req, image);
  res.json(image).end();
};
exports.getImage = getImage;
var deleteImage = function deleteImage(req, res) {
  var images = _server.db.getCollection(_server.COLS.images).find({
    id: req.params.image_id
  });
  if (!images || images.length === 0) {
    res.status(404).end();
    return;
  }

  // Make sure we are only deleting private images
  if (images[0].visibility !== 'private') {
    res.status(404).end();
    return;
  }
  _server.db.getCollection(_server.COLS.images).findAndRemove({
    id: req.params.image_id
  });
  res.status(204).end();
};

/**
 *
 * @param {*} req - request object
 * @param {*} res - response object
 */
exports.deleteImage = deleteImage;
var updateImage = function updateImage(req, res) {
  var input = req.body;
  var collection = _server.db.getCollection(_server.COLS.images);
  var results = collection.find({
    id: req.params.image_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var imageToUpdate = results[0];
  var updatedImage = _objectSpread(_objectSpread({}, imageToUpdate), input);
  // Image lifecycle intricate behaviors with status **BEGIN**
  if (input.deprecation_at && imageToUpdate.deprecation_at && (imageToUpdate.status === 'deprecated' || imageToUpdate.status === 'obsolete')) {
    res.status(400).json(utils.generateErrors('Cannot change deprecation date on an already deprecated image', 'image_error')).end();
    return;
  }
  if (input.obsolescence_at && imageToUpdate.obsolescence_at && imageToUpdate.status === 'obsolete') {
    res.status(400).json(utils.generateErrors('Cannot change obsoleted date on an already obsoleted image', 'image_error')).end();
    return;
  }
  // Clearing obsolete date on an obsolete image. Move the image back to deprecated status
  // (if deprecate date is set) or available if not
  if (input.obsolescence_at === null && imageToUpdate.obsolescence_at && updatedImage.status === 'obsolete') {
    updatedImage.status = imageToUpdate.deprecation_at ? 'deprecated' : 'available';
  }
  // Clearing deprecated date on an deprecated image. Move the image back to available status.
  if (input.deprecation_at === null && imageToUpdate.deprecation_at && updatedImage.status === 'deprecated') {
    updatedImage.status = 'available';
  }
  // Image lifecycle intricate behaviors with status **END**

  // update the image
  collection.update(updatedImage);
  // find the updated image
  var updatedResults = collection.find({
    id: updatedImage.id
  });
  var image = updatedResults[0];
  formatImageForClient(req, image);
  res.status(200).json(image).end();
};
exports.updateImage = updateImage;
var deprecateImage = function deprecateImage(req, res) {
  var collection = _server.db.getCollection(_server.COLS.images);
  var results = collection.find({
    id: req.params.image_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var imageToDeprecate = results[0];
  if (imageToDeprecate.status !== 'available') {
    res.status(400).json(utils.generateErrors('Image must be available in order to immediately deprecate it', 'image_error')).end();
    return;
  }
  var updatedImage = _objectSpread(_objectSpread({}, imageToDeprecate), {}, {
    status: 'deprecated',
    deprecation_at: utils.generateNowDate()
  });

  // update the image
  collection.update(updatedImage);
  // find the updated image
  var updatedResults = collection.find({
    id: updatedImage.id
  });
  var image = updatedResults[0];
  formatImageForClient(req, image);
  res.status(200).json(image).end();
};
exports.deprecateImage = deprecateImage;
var obsoleteImage = function obsoleteImage(req, res) {
  var collection = _server.db.getCollection(_server.COLS.images);
  var results = collection.find({
    id: req.params.image_id
  });
  if (!results || results.length === 0) {
    res.status(404).end();
    return;
  }
  var imageToDeprecate = results[0];
  if (imageToDeprecate.status !== 'available' && imageToDeprecate.status !== 'deprecated') {
    res.status(400).json(utils.generateErrors('Image must be available or deprecated in order to immediately obsolete it', 'image_error')).end();
    return;
  }
  var updatedImage = _objectSpread(_objectSpread({}, imageToDeprecate), {}, {
    status: 'obsolete',
    obsolescence_at: utils.generateNowDate()
  });

  // update the image
  collection.update(updatedImage);
  // find the updated image
  var updatedResults = collection.find({
    id: updatedImage.id
  });
  var image = updatedResults[0];
  formatImageForClient(req, image);
  res.status(200).json(image).end();
};
exports.obsoleteImage = obsoleteImage;