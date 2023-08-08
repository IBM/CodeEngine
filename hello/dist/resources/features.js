"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldNotCreateRIASResources = exports.shouldGenerateLotsOfResources = exports.shouldCreateSubnetsInRandomZones = exports.shouldAddDelaysToStatusTransitions = exports.getFlags = void 0;
var featureFlags = require('./features.json');
var shouldAddDelaysToStatusTransitions = false;
exports.shouldAddDelaysToStatusTransitions = shouldAddDelaysToStatusTransitions;
var shouldGenerateLotsOfResources = false;
exports.shouldGenerateLotsOfResources = shouldGenerateLotsOfResources;
var shouldCreateSubnetsInRandomZones = false;
exports.shouldCreateSubnetsInRandomZones = shouldCreateSubnetsInRandomZones;
var shouldNotCreateRIASResources = false;
exports.shouldNotCreateRIASResources = shouldNotCreateRIASResources;
var getFlags = function getFlags(req, res) {
  var region = req.params.region;
  if (!region) return res.status(404);
  var featuresInRegion;
  featureFlags.forEach(function (flag) {
    if (flag.region === region) {
      featuresInRegion = {
        features: flag.features
      };
    }
  });
  return res.status(200).json(featuresInRegion).end();
};
exports.getFlags = getFlags;