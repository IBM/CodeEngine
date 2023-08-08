"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registerRoutes = exports.init = void 0;
var _ghost = _interopRequireDefault(require("./routes/ghost"));
var _keyprotect = _interopRequireDefault(require("./routes/keyprotect"));
var _cos = _interopRequireDefault(require("./routes/cos"));
var _globalcatalog = _interopRequireDefault(require("./routes/globalcatalog"));
var _pricing = _interopRequireDefault(require("./routes/pricing"));
var _privatecatalog = _interopRequireDefault(require("./routes/privatecatalog"));
var _resourcegroup = _interopRequireDefault(require("./routes/resourcegroup"));
var _resourcecontroller = _interopRequireDefault(require("./routes/resourcecontroller"));
var _certificatemanager = _interopRequireDefault(require("./routes/certificatemanager"));
var _secretsmanager = _interopRequireDefault(require("./routes/secretsmanager"));
var _metrics = _interopRequireDefault(require("./routes/metrics"));
var _alerts = _interopRequireDefault(require("./routes/alerts"));
var _iam = _interopRequireDefault(require("./routes/iam"));
var _dns_zone = _interopRequireDefault(require("./routes/dns_zone"));
var _enterprise = _interopRequireDefault(require("./routes/enterprise"));
var ghostResources = _interopRequireWildcard(require("./resources/ghost"));
var kpResources = _interopRequireWildcard(require("./resources/keyprotect"));
var cosResources = _interopRequireWildcard(require("./resources/cos"));
var gcResources = _interopRequireWildcard(require("./resources/globalcatalog"));
var privatecatalogResources = _interopRequireWildcard(require("./resources/privatecatalog"));
var pricingResources = _interopRequireWildcard(require("./resources/pricing"));
var rgResources = _interopRequireWildcard(require("./resources/resourcegroup"));
var rcResources = _interopRequireWildcard(require("./resources/resourcecontroller"));
var certResources = _interopRequireWildcard(require("./resources/certificatemanager"));
var secretResources = _interopRequireWildcard(require("./resources/secretsmanager"));
var alertResources = _interopRequireWildcard(require("./resources/alerts"));
var iamResources = _interopRequireWildcard(require("./resources/iam"));
var dnsZoneResources = _interopRequireWildcard(require("./resources/dns-zone"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var externalRoutePath = 'external';
var GHOST_CONTEXT_V2 = "".concat(externalRoutePath, "/ghost-mock/v2");
var KP_CONTEXT_API_V2 = "".concat(externalRoutePath, "/kp-mock/api/v2");
var KP_CONTEXT_API_V2_REGIONAL = "".concat(externalRoutePath, "/kp-mock/:kpRegion/api/v2");
var COS_API = "".concat(externalRoutePath, "/cos-mock");
var GC_API = "".concat(externalRoutePath, "/globalcatalog-mock");
var PRICING_API = "".concat(externalRoutePath, "/pricing-mock");
var PRIVATECATALOG_API = "".concat(externalRoutePath, "/privatecatalog-mock");
var RG_API = "".concat(externalRoutePath, "/resourcemanager-mock");
var RC_API = "".concat(externalRoutePath, "/resourcecontroller-mock");
var DNS_ZONE_API = "".concat(externalRoutePath, "/dns-svc-mock");
var CM_API = "".concat(externalRoutePath, "/certmanager-mock");
var SECRETSMANAGER_API = "".concat(externalRoutePath, "/secretsmanager-mock");
var METRICS_API = "".concat(externalRoutePath, "/metrics-mock/api/data");
var ALERTS_API = "".concat(externalRoutePath, "/metrics-mock/v1/alert");
var IAM_API = "".concat(externalRoutePath, "/iam-mock");
var ENTERPRISE_API = "".concat(externalRoutePath, "/enterprise-mock/v1");
var init = function init() {
  rgResources.init();
  rcResources.init();
  certResources.init();
  secretResources.init();
  ghostResources.init();
  kpResources.init();
  cosResources.init();
  gcResources.init();
  pricingResources.init();
  privatecatalogResources.init();
  iamResources.init();
  alertResources.init();
  dnsZoneResources.init();
};
exports.init = init;
var registerRoutes = function registerRoutes(app, appContext) {
  /**
   * Setup the Resource Groups routes
   */
  app.use("".concat(appContext).concat(RG_API), _resourcegroup["default"]);
  /**
   * Setup the Resource Controller routes
   */
  app.use("".concat(appContext).concat(RC_API), _resourcecontroller["default"]);
  /**
   * Setup the Certificates Manager routes
   */
  app.use("".concat(appContext).concat(CM_API), _certificatemanager["default"]);
  /**
   * Setup the Secrets Manager routes
   */
  app.use("".concat(appContext).concat(SECRETSMANAGER_API), _secretsmanager["default"]);
  /**
   * Setup the ghost routes
   */
  app.use("".concat(appContext).concat(GHOST_CONTEXT_V2), _ghost["default"]);
  /**
   * Setup the key protect routes
   */
  app.use("".concat(appContext).concat(KP_CONTEXT_API_V2), _keyprotect["default"]);
  app.use("".concat(appContext).concat(KP_CONTEXT_API_V2_REGIONAL), _keyprotect["default"]);
  /**
   * Setup the COS routes
   */
  app.use("".concat(appContext).concat(COS_API), _cos["default"]);

  /**
   * Setup the Global Catalog routes
   */
  app.use("".concat(appContext).concat(GC_API), _globalcatalog["default"]);

  /**
   * Setup the Pricing routes
   */
  app.use("".concat(appContext).concat(PRICING_API), _pricing["default"]);

  /**
   * Setup the Pricing routes
   */
  app.use("".concat(appContext).concat(PRIVATECATALOG_API), _privatecatalog["default"]);

  /**
   * Setup the Metrics routes
   */
  app.use("".concat(appContext).concat(METRICS_API), _metrics["default"]);

  /**
   * Setup the IAM routes
   */
  app.use("".concat(appContext).concat(IAM_API), _iam["default"]);

  /**
   * Setup the Alerts routes
   */
  app.use("".concat(appContext).concat(ALERTS_API), _alerts["default"]);

  /**
   * Setup the DNS Zones routes
   */
  app.use("".concat(appContext).concat(DNS_ZONE_API), _dns_zone["default"]);

  /**
   * Setup the Enterprise API routes
   */
  app.use("".concat(appContext).concat(ENTERPRISE_API), _enterprise["default"]);
};
exports.registerRoutes = registerRoutes;