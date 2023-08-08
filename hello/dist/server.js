"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.init = exports.express = exports.db = exports.ROOT_CONTEXT_V1 = exports.ROOT_CONTEXT_REGION = exports.ROOT_CONTEXT_INTERNAL = exports.ROOT_CONTEXT = exports.COLS = void 0;
var bodyParser = _interopRequireWildcard(require("body-parser"));
var dedicated_hosts = _interopRequireWildcard(require("./resources/dedicated_hosts"));
var dedicated_host_groups = _interopRequireWildcard(require("./resources/dedicated_host_groups"));
var dedicated_host_profiles = _interopRequireWildcard(require("./resources/dedicated_host_profiles"));
var keys = _interopRequireWildcard(require("./resources/keys"));
var regions = _interopRequireWildcard(require("./resources/regions"));
var profiles = _interopRequireWildcard(require("./resources/profiles"));
var images = _interopRequireWildcard(require("./resources/images"));
var image_export_jobs = _interopRequireWildcard(require("./resources/image_export_jobs"));
var bmProfiles = _interopRequireWildcard(require("./resources/baremetal/profiles"));
var bmInstances = _interopRequireWildcard(require("./resources/baremetal/bm_instances"));
var instance_groups = _interopRequireWildcard(require("./resources/instance_groups"));
var instance_templates = _interopRequireWildcard(require("./resources/instance_templates"));
var acls = _interopRequireWildcard(require("./resources/acls"));
var securityGroups = _interopRequireWildcard(require("./resources/securityGroups"));
var vpcs = _interopRequireWildcard(require("./resources/vpcs"));
var ppsgs = _interopRequireWildcard(require("./resources/private_path_service_gateways"));
var fips = _interopRequireWildcard(require("./resources/floating_ips"));
var routeServers = _interopRequireWildcard(require("./resources/dynamic_route_servers"));
var gateways = _interopRequireWildcard(require("./resources/public_gateways"));
var endpointGateways = _interopRequireWildcard(require("./resources/endpoint_gateways"));
var network_interfaces = _interopRequireWildcard(require("./resources/network_interfaces"));
var subnets = _interopRequireWildcard(require("./resources/subnets"));
var volumeProfiles = _interopRequireWildcard(require("./resources/volumeProfiles"));
var volumes = _interopRequireWildcard(require("./resources/volumes"));
var instances = _interopRequireWildcard(require("./resources/instances"));
var placment_groups = _interopRequireWildcard(require("./resources/placement_groups"));
var volumeAttachments = _interopRequireWildcard(require("./resources/volumeAttachments"));
var connections = _interopRequireWildcard(require("./resources/connections"));
var vpn_gateways = _interopRequireWildcard(require("./resources/vpn_gateways"));
var vpn_servers = _interopRequireWildcard(require("./resources/vpn_servers"));
var vpn_server_clients = _interopRequireWildcard(require("./resources/vpn_server_clients"));
var vpn_server_routes = _interopRequireWildcard(require("./resources/vpn_server_routes"));
var virtual_network_interfaces = _interopRequireWildcard(require("./resources/virtual_network_interfaces"));
var ike_policies = _interopRequireWildcard(require("./resources/ike_policies"));
var ipsec_policies = _interopRequireWildcard(require("./resources/ipsec_policies"));
var routes = _interopRequireWildcard(require("./resources/routes"));
var croutes = _interopRequireWildcard(require("./resources/croutes"));
var routing_tables = _interopRequireWildcard(require("./resources/routing_tables"));
var vpc_dns_resolution_bindings = _interopRequireWildcard(require("./resources/vpc_dns_resolution_bindings"));
var operatingSystems = _interopRequireWildcard(require("./resources/operatingSystems"));
var reserved_ip = _interopRequireWildcard(require("./resources/reserved_private_ips"));
var flowLogCollectors = _interopRequireWildcard(require("./resources/flow_log_collectors"));
var _utils = require("./utils");
var load_balancers_resources = _interopRequireWildcard(require("./resources/load_balancers/load_balancers"));
var LBProfiles = _interopRequireWildcard(require("./resources/load_balancers/LBProfiles"));
var _load_balancers2 = _interopRequireDefault(require("./routes/load_balancers"));
var _ppsgs = _interopRequireDefault(require("./routes/ppsgs"));
var file_shares = _interopRequireWildcard(require("./resources/file_shares"));
var snapshots = _interopRequireWildcard(require("./resources/snapshots"));
var snapshotConsistencyGroups = _interopRequireWildcard(require("./resources/snapshot_consistency_group"));
var backupPolicies = _interopRequireWildcard(require("./resources/backup_policies/backup_policies"));
var backupPolicyJobs = _interopRequireWildcard(require("./resources/backup_policies/backup_policy_jobs"));
var external = _interopRequireWildcard(require("./external"));
var errors = _interopRequireWildcard(require("./resources/errors"));
var features = _interopRequireWildcard(require("./resources/features"));
var snapshotsClones = _interopRequireWildcard(require("./resources/snapshot_clone"));
var ontap_instances = _interopRequireWildcard(require("./resources/cvo/ontap_instances"));
var storage_virtual_machines = _interopRequireWildcard(require("./resources/cvo/storage_virtual_machines"));
var storage_volumes = _interopRequireWildcard(require("./resources/cvo/storage_volumes"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/* eslint-disable no-console */

var nconf = require('nconf');
var isStandalone = !module.parent;
if (isStandalone) {
  process.title = 'rias-mock-server';
  // Only init nconf if we are running in standalone mode
  nconf.argv().env().file({
    file: 'config/app.json'
  });
  console.log('rias-mock server is running in standalone mode.');
} else {
  // Do not init nconf when we are running in embedded mode as we share
  // the same nconf instance with the genesis-ui server and it will cause
  // genesis-ui settings to be overwritten.
  console.log('rias-mock server is running in embedded mode.');
}
var app = require('./app');
var Loki = require('lokijs');
var db = new Loki('loki.json');
exports.db = db;
var port = process.env.PORT || 4000;
var startTime = new Date();
var ROOT_CONTEXT = '/rias-mock/';
exports.ROOT_CONTEXT = ROOT_CONTEXT;
var ROOT_CONTEXT_REGION = "".concat(ROOT_CONTEXT, ":region/");
exports.ROOT_CONTEXT_REGION = ROOT_CONTEXT_REGION;
var ROOT_CONTEXT_V1 = "".concat(ROOT_CONTEXT_REGION, "v1/");
exports.ROOT_CONTEXT_V1 = ROOT_CONTEXT_V1;
var ROOT_CONTEXT_INTERNAL = "".concat(ROOT_CONTEXT_REGION, "internal/v1/");
exports.ROOT_CONTEXT_INTERNAL = ROOT_CONTEXT_INTERNAL;
app.use(bodyParser.json({
  type: ['json', '+json']
}));
app.use(bodyParser.urlencoded({
  extended: true
}));

/*
 * These are the data store constants.  They identify the collection name for each of
 * our collections. The value must match the rias swagger entity name. For best practices,
 * please use the same name for the key and the value.
 */
var COLS = Object.freeze({
  acls: 'network_acls',
  connections: 'connections',
  dedicated_hosts: 'dedicated_hosts',
  dedicated_host_profiles: 'dedicated_host_profiles',
  dedicated_host_groups: 'dedicated_host_groups',
  dynamic_route_servers: 'dynamic_route_servers',
  floating_ips: 'floating_ips',
  images: 'images',
  image_export_jobs: 'image_export_jobs',
  instances: 'instances',
  keys: 'keys',
  network_interfaces: 'network_interfaces',
  network_interface_templates: 'network_interface_templates',
  placement_groups: 'placement_groups',
  prefixes: 'prefixes',
  profiles: 'profiles',
  public_gateways: 'public_gateways',
  endpoint_gateways: 'endpoint_gateways',
  regions: 'regions',
  security_groups: 'security_groups',
  subnets: 'subnets',
  reserved_private_ips: 'reserved_ips',
  volume_profiles: 'volume_profiles',
  volumes: 'volumes',
  vpcs: 'vpcs',
  vpcsDnsBindings: 'dns_resolution_bindings',
  ppsgs: 'private_path_service_gateways',
  ppsgs_account_policies: 'account_policies',
  ppsgs_bindings: 'endpoint_gateway_bindings',
  load_balancers: 'load_balancers',
  LB_profiles: 'LB_profiles',
  volume_attachments: 'volume_attachments',
  vpn_gateways: 'vpn_gateways',
  vpn_servers: 'vpn_servers',
  vpn_server_clients: 'vpn_server_clients',
  vpn_server_routes: 'vpn_server_routes',
  virtual_network_interfaces: 'virtual_network_interfaces',
  croutes: 'croutes',
  routing_tables: 'routing_tables',
  ike_policies: 'ike_policies',
  ipsec_policies: 'ipsec_policies',
  instance_groups: 'instance_groups',
  instance_group_members: 'instance_group_members',
  instance_group_managers: 'instance_group_managers',
  instance_group_policies: 'instance_group_policies',
  instance_group_actions: 'instance_group_actions',
  instance_templates: 'instance_templates',
  resourceGroups: 'resourceGroups',
  resourceInstances: 'resourceInstances',
  dnszones: 'dnszones',
  certificates: 'certificates',
  secrets: 'secrets',
  ghost: 'ghost',
  keyprotect: 'keyprotect',
  cosBuckets: 'cosBuckets',
  cosObjects: 'cosObjects',
  globalCatalog: 'globalCatalog',
  privateCatalog: 'privateCatalog',
  catalog_offerings: 'catalog_offerings',
  operatingSystems: 'operating_systems',
  authPolicies: 'authPolicies',
  flow_log_collectors: 'flow_log_collectors',
  file_shares: 'shares',
  share_profiles: 'share_profiles',
  snapshots: 'snapshots',
  snapshot_consistency_groups: 'snapshot_consistency_groups',
  trustedProfiles: 'trustedProfiles',
  bm_profiles: 'bm_profiles',
  bm_instances: 'bm_instances',
  backup_policies: 'backup_policies',
  backup_policy_jobs: 'backup_policy_jobs',
  ontap_instances: 'storage_ontap_instances',
  svm: 'storage_virtual_machines',
  storage_volumes: 'storage_volumes'
});

/*
 * This function calls init on all of our objects.  It gets called when the server
 * first starts up and any time we reset the data in the database.
 *
 * NOTE: Order is significant.
 */
exports.COLS = COLS;
var init = function init() {
  // Control system initialization
  errors.init();

  // API Initialization
  regions.init();
  external.init();
  keys.init();
  placment_groups.init();
  profiles.init();
  bmProfiles.init();
  dedicated_host_profiles.init();
  dedicated_host_groups.init();
  images.init();
  image_export_jobs.init();
  fips.init();
  vpcs.init();
  vpc_dns_resolution_bindings.init();
  acls.init();
  securityGroups.init();
  gateways.init();
  subnets.init();
  volumeProfiles.init();
  volumes.init();
  network_interfaces.init();
  dedicated_hosts.init();
  instances.init();
  bmInstances.init();
  load_balancers_resources.init();
  LBProfiles.init();
  ike_policies.init();
  ipsec_policies.init();
  connections.init();
  vpn_gateways.init();
  routes.init();
  routing_tables.init();
  croutes.init(); // Must be after routing_tables
  operatingSystems.init();
  reserved_ip.init();
  virtual_network_interfaces.init(); // Must be after reserved_ip
  file_shares.init();
  storage_virtual_machines.init();

  // second phase of API initialization for items that require the above resources
  instance_templates.init();
  instance_groups.init();
  volumeAttachments.init();
  flowLogCollectors.init();
  endpointGateways.init();
  snapshotConsistencyGroups.init();
  snapshots.init();
  vpn_servers.init();
  vpn_server_clients.init();
  vpn_server_routes.init();
  backupPolicies.init();
  ontap_instances.init();
  ppsgs.init();
  routeServers.init();

  // third phase of resource generation that required items from phase 1 and 2
  volumes.createVolumeFromSnapshot();
  storage_volumes.init();
};
exports.init = init;
init();

/*
 ************************************************
 * Register RIAS-MOCK - CONTROL LAYER ENDPOINTS *
 ************************************************
 */

/*
 * This is a special utility endpoint that isn't in RIAS.  It can clear all the
 * data from the database.
 */
app["delete"]("".concat(ROOT_CONTEXT, "data"), _utils.clearAllData);
/*
 * This is a utility endpoint that isn't in RIAS. It return the current app
 * version information.
 */
app.get("".concat(ROOT_CONTEXT, "version"), _utils.getVersionInfo);
app.get("".concat(ROOT_CONTEXT), _utils.generalInfo);
if (isStandalone) {
  app.get('/liveness', _utils.liveness);
  app.get('/readiness', _utils.liveness);

  /*
  * This is just a little nice to have so that people running the server locally
  * can see something useful if they just go to localhost without a path.
  */
  app.get('/', function (req, res) {
    res.redirect(ROOT_CONTEXT);
  });
}
var reRouteWithDefaultRegion = function reRouteWithDefaultRegion(req, res, next) {
  // if the route has no region, append the region in url
  req.url = req.url.replace(ROOT_CONTEXT, "".concat(ROOT_CONTEXT).concat(_utils.DEFAULT_REGION, "/"));
  // It is hard to test real life API calls when rias mock is so fast. Adding a manual delay simulates a
  // more realistic API environment, but use a manual toggle so that we don't slow down our tests.
  var addManualDelayToApiCalls = false;
  if (!addManualDelayToApiCalls) {
    next();
  } else {
    var manualDelayInCalls = 750;
    setTimeout(next, manualDelayInCalls);
  }
};
app.all("".concat(ROOT_CONTEXT, "v1/*"), reRouteWithDefaultRegion);
app.all("".concat(ROOT_CONTEXT, "internal/v1/*"), reRouteWithDefaultRegion);
app.all("".concat(ROOT_CONTEXT_REGION, "*"), function (req, res, next) {
  req.query.region = req.params.region;
  next();
});

/**
 * Setup the mock error control system endpoints
 *
 */
app.get("".concat(ROOT_CONTEXT, "errors"), errors.getErrors);
app.post("".concat(ROOT_CONTEXT, "errors"), errors.createError);
app["delete"]("".concat(ROOT_CONTEXT, "errors"), errors.deleteErrors);
app.get("".concat(ROOT_CONTEXT, "errors/:error_id"), errors.getError);
app.patch("".concat(ROOT_CONTEXT, "errors/:error_id"), errors.updateError);
app["delete"]("".concat(ROOT_CONTEXT, "errors/:error_id"), errors.deleteError);
// app.get(`${ROOT_CONTEXT}error/control`, errors.getErrorControl);
// app.patch(`${ROOT_CONTEXT}error/control`, errors.updateErrorControl);

/**
 * Process incoming requests against the error system. Only rias-mock control
 * plane endpoints avoid this check. This means we can generate errors against
 * both RIAS API endpoints and External endpoints.
 */
app.all('*', errors.processRequest);

/*
 *******************************************
 * Register RIAS-MOCK - EXTERNAL ENDPOINTS *
 *******************************************
 */

external.registerRoutes(app, ROOT_CONTEXT);

/*
 *******************************************
 * Register RIAS-MOCK - RIAS API ENDPOINTS *
 *******************************************
 */

/*
 * Set up the features endpoints.
 */
app.get("".concat(ROOT_CONTEXT_INTERNAL, "features"), features.getFlags);

/*
 * Set up the keys endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "keys"), keys.getKeys);
app.get("".concat(ROOT_CONTEXT_V1, "keys/:key_id"), keys.getKey);
app.post("".concat(ROOT_CONTEXT_V1, "keys"), keys.createKey);
app["delete"]("".concat(ROOT_CONTEXT_V1, "keys/:key_id"), keys.deleteKey);
app.patch("".concat(ROOT_CONTEXT_V1, "keys/:key_id"), keys.updateKey);

/*
 * Set up the regions endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "regions"), regions.getRegions);
app.get("".concat(ROOT_CONTEXT_V1, "regions/:region_name"), regions.getRegion);
app.get("".concat(ROOT_CONTEXT_V1, "regions/:region_name/zones"), regions.getZones);
app.get("".concat(ROOT_CONTEXT_V1, "regions/:region_name/zones/:zone_name"), regions.getZone);

/*
 * Set up the profiles endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "instance/profiles"), profiles.getProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "instance/profiles/:profile_name"), profiles.getProfile);

/*
 * Set up the baremetal profiles endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_server/profiles"), bmProfiles.getProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_server/profiles/:profile_name"), bmProfiles.getProfile);

/*
 * Set up the images endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "images"), images.getImages);
app.post("".concat(ROOT_CONTEXT_V1, "images"), images.createImage);
app.get("".concat(ROOT_CONTEXT_V1, "images/:image_id"), images.getImage);
app.patch("".concat(ROOT_CONTEXT_V1, "images/:image_id"), images.updateImage);
app["delete"]("".concat(ROOT_CONTEXT_V1, "images/:image_id"), images.deleteImage);
app.post("".concat(ROOT_CONTEXT_V1, "images/:image_id/deprecate"), images.deprecateImage);
app.post("".concat(ROOT_CONTEXT_V1, "images/:image_id/obsolete"), images.obsoleteImage);
app.get("".concat(ROOT_CONTEXT_V1, "images/:image_id/export_jobs"), image_export_jobs.getImageExportJobs);
app.post("".concat(ROOT_CONTEXT_V1, "images/:image_id/export_jobs"), image_export_jobs.createImageExportJob);
app.get("".concat(ROOT_CONTEXT_V1, "images/:image_id/export_jobs/:id"), image_export_jobs.getImageExportJob);
app.patch("".concat(ROOT_CONTEXT_V1, "images/:image_id/export_jobs/:id"), image_export_jobs.updateImageExportJob);
app["delete"]("".concat(ROOT_CONTEXT_V1, "images/:image_id/export_jobs/:id"), image_export_jobs.deleteImageExportJob);
app.get("".concat(ROOT_CONTEXT_V1, "operating_systems"), operatingSystems.getOperatingSystems);
app.get("".concat(ROOT_CONTEXT_V1, "operating_systems/:os_id"), operatingSystems.getOperatingSystem);

/*
 * Set up the acls endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "network_acls"), acls.getACLs);
app.get("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id"), acls.getACL);
app.get("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id/rules"), acls.getRules);
app.get("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id/rules/:rule_id"), acls.getRule);
app.patch("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id"), acls.updateAcl);
app.patch("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id/rules/:rule_id"), acls.updateRule);
app.post("".concat(ROOT_CONTEXT_V1, "network_acls"), acls.createACL);
app.post("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id/rules"), acls.createRule);
app["delete"]("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id"), acls.deleteAcl);
app["delete"]("".concat(ROOT_CONTEXT_V1, "network_acls/:acl_id/rules/:rule_id"), acls.deleteRule);

/*
 * Set up the security group endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "security_groups"), securityGroups.getSecurityGroups);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id"), securityGroups.getSecurityGroup);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/rules"), securityGroups.getRules);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/rules/:rule_id"), securityGroups.getRule);
app.patch("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/"), securityGroups.updateSecurityGroup);
app.patch("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/rules/:rule_id"), securityGroups.updateRule);
app.post("".concat(ROOT_CONTEXT_V1, "security_groups"), securityGroups.createSecurityGroup);
app.post("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/rules"), securityGroups.createRule);
app["delete"]("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/"), securityGroups.deleteSecurityGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/rules/:rule_id"), securityGroups.deleteRule);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/network_interfaces"), securityGroups.getVNICs);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/network_interfaces/:vnic_id"), securityGroups.getVNIC);
app.put("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/network_interfaces/:vnic_id"), securityGroups.setVNIC);
app["delete"]("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/network_interfaces/:vnic_id"), securityGroups.deleteVNIC);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/targets"), securityGroups.getTargets);
app.get("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/targets/:target_id"), securityGroups.getTarget);
app.put("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/targets/:target_id"), securityGroups.setTarget);
app["delete"]("".concat(ROOT_CONTEXT_V1, "security_groups/:sg_id/targets/:target_id"), securityGroups.deleteTarget);

/**
 * Setup the Vpc endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "vpcs"), vpcs.getVpcs);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs"), vpcs.createVpc);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id"), vpcs.deleteVpc);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id"), vpcs.getVpc);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id"), vpcs.updateVpc);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/default_security_group"), vpcs.getDefaultSecurityGroup);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/default_network_acl"), vpcs.getDefaultNetworkACL);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/address_prefixes"), vpcs.getAddressPrefixes);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/address_prefixes/:prefix_id"), vpcs.getAddressPrefix);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/address_prefixes/:prefix_id"), vpcs.updateAddressPrefix);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/address_prefixes"), vpcs.createAddressPrefix);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/address_prefixes/:prefix_id"), vpcs.deleteAddressPrefix);

// VPC Dns shared bindings
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/dns_resolution_bindings"), vpc_dns_resolution_bindings.getDnsResolutionBindings);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/dns_resolution_bindings"), vpc_dns_resolution_bindings.createDnsResolutionBinding);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/dns_resolution_bindings/:id"), vpc_dns_resolution_bindings.getDnsResolutionBinding);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/dns_resolution_bindings/:id"), vpc_dns_resolution_bindings.updateDnsResolutionBinding);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/dns_resolution_bindings/:id"), vpc_dns_resolution_bindings.deleteDnsResolutionBinding);

// VPC Routes
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routes"), routes.getRoutes);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routes/:route_id"), routes.getRoute);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routes/:route_id"), routes.updateRoute);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routes"), routes.createRoute);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routes/:route_id"), routes.deleteRoute);

// VPC Custom Routes
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/default_routing_table"), vpcs.getDefaultRoutingTable);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables"), routing_tables.getRoutingTables);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables"), routing_tables.createRoutingTable);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id"), routing_tables.getRoutingTable);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id"), routing_tables.updateRoutingTable);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id"), routing_tables.deleteRoutingTable);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id/routes"), croutes.getRoutes);
app.post("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id/routes"), croutes.createRoute);
app.get("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id/routes/:route_id"), croutes.getRoute);
app.patch("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id/routes/:route_id"), croutes.updateRoute);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpcs/:vpc_id/routing_tables/:routing_table_id/routes/:route_id"), croutes.deleteRoute);

/**
 * Setup the Floating IP endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "floating_ips"), fips.getFloatingIps);
app.post("".concat(ROOT_CONTEXT_V1, "floating_ips"), fips.createFloatingIp);
app.get("".concat(ROOT_CONTEXT_V1, "floating_ips/:fip_id"), fips.getFloatingIp);
app.patch("".concat(ROOT_CONTEXT_V1, "floating_ips/:fip_id"), fips.updateFloatingIp);
app["delete"]("".concat(ROOT_CONTEXT_V1, "floating_ips/:fip_id"), fips.deleteFloating);

/**
 * Setup the public gateways endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "public_gateways"), gateways.getPublicGateways);
app.post("".concat(ROOT_CONTEXT_V1, "public_gateways"), gateways.createPublicGateway);
app.get("".concat(ROOT_CONTEXT_V1, "public_gateways/:gateway_id"), gateways.getPublicGateway);
app["delete"]("".concat(ROOT_CONTEXT_V1, "public_gateways/:gateway_id"), gateways.deletePublicGateway);
app.patch("".concat(ROOT_CONTEXT_V1, "public_gateways/:gateway_id"), gateways.updatePublicGateway);

/**
 * Setup the service gateways endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "endpoint_gateways"), endpointGateways.getEndpointGateways);
app.post("".concat(ROOT_CONTEXT_V1, "endpoint_gateways"), endpointGateways.createEndpointGateway);
app.get("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id"), endpointGateways.getEndpointGateway);
app["delete"]("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id"), endpointGateways.deleteEndpointGateway);
app.patch("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id"), endpointGateways.updateEndpointGateway);
app.get("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id/ips"), endpointGateways.getEndpointGatewayIPs);
app.put("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id/ips/:reserved_ip_id"), endpointGateways.bindReservedIP);
app.get("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id/ips/:reserved_ip_id"), endpointGateways.getEndpointGatewayIP);
app["delete"]("".concat(ROOT_CONTEXT_V1, "endpoint_gateways/:gateway_id/ips/:reserved_ip_id"), endpointGateways.unbindReservedIP);

/**
 * Setup the subnets endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "subnets"), subnets.getSubnets);
app.post("".concat(ROOT_CONTEXT_V1, "subnets"), subnets.createSubnet);
app["delete"]("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id"), subnets.deleteSubnet);
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id"), subnets.getSubnet);
app.patch("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id"), subnets.updateSubnet);
// network_acl
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/network_acl"), subnets.getNetworkAcl);
app.put("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/network_acl"), subnets.setNetworkAcl);
// public_gateway
app["delete"]("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/public_gateway"), subnets.deletePublicGateway);
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/public_gateway"), subnets.getPublicGateway);
app.put("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/public_gateway"), subnets.setPublicGateway);
// reserved_ips
app["delete"]("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/reserved_ips/:id"), reserved_ip.deleteReservedIP);
app.patch("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/reserved_ips/:id"), reserved_ip.updateReservedIP);
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/reserved_ips/:id"), reserved_ip.getReservedIP);
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/reserved_ips/"), reserved_ip.getReservedIPs);
app.post("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/reserved_ips/"), reserved_ip.createReserveIP);
// routing_table
app.get("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/routing_table"), subnets.getRoutingTable);
app.put("".concat(ROOT_CONTEXT_V1, "subnets/:subnet_id/routing_table"), subnets.setRoutingTable);

/**
 * Setup the dynamic route server(DRS) routes
 */
app.get("".concat(ROOT_CONTEXT_V1, "dynamic_route_servers"), routeServers.getDynamicRouteServers);
app.post("".concat(ROOT_CONTEXT_V1, "dynamic_route_servers"), routeServers.createDynamicRouteServer);
app.get("".concat(ROOT_CONTEXT_V1, "dynamic_route_servers/:server_id"), routeServers.getDynamicRouteServer);
app["delete"]("".concat(ROOT_CONTEXT_V1, "dynamic_route_servers/:server_id"), routeServers.deleteDynamicRouteServer);
app.patch("".concat(ROOT_CONTEXT_V1, "dynamic_route_servers/:server_id"), routeServers.updateDynamicRouteServer);
var drsIdPath = "".concat(ROOT_CONTEXT_V1, "dynamic_route_servers/:server_id");
app.get("".concat(drsIdPath, "/peers"), routeServers.getDynamicRouteServerPeers);
app.post("".concat(drsIdPath, "/peers"), routeServers.createDynamicRouteServerPeer);
app["delete"]("".concat(drsIdPath, "/peers/:peer_id"), routeServers.deleteDynamicRouteServerPeer);
app.get("".concat(drsIdPath, "/peers/:peer_id"), routeServers.getDynamicRouteServerPeer);
app.patch("".concat(drsIdPath, "/peers/:peer_id"), routeServers.updateDynamicRouteServerPeer);
app.get("".concat(drsIdPath, "/ips"), routeServers.getDynamicRouteServerIps);
app["delete"]("".concat(drsIdPath, "/ips/:ip_id"), routeServers.unbindDynamicRouteServerIp);
app.get("".concat(drsIdPath, "/ips/:ip_id"), routeServers.getDynamicRouteServerIp);
app.put("".concat(drsIdPath, "/ips/:ip_id"), routeServers.bindDynamicRouteServerIp);
app.get("".concat(drsIdPath, "/routes"), routeServers.getDynamicRouteServerRoutes);
app.get("".concat(drsIdPath, "/routes/:route_id"), routeServers.getDynamicRouteServerRoute);
/**
 * Setup the load balancer route
 */
app.use("".concat(ROOT_CONTEXT_V1, "private_path_service_gateways"), _ppsgs["default"]);
app.use("".concat(ROOT_CONTEXT_V1, "load_balancers"), _load_balancers2["default"]);

/**
 * load balancer profiles endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "load_balancer/profiles"), LBProfiles.getLBProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "load_balancer/profiles/:profile_name"), LBProfiles.getLBProfile);

/**
 * Setup the volume profiles endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "volume/profiles"), volumeProfiles.getVolumeProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "volume/profiles/:profile_name"), volumeProfiles.getVolumeProfile);

/**
 * Setup the volumes endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "volumes"), volumes.getVolumes);
app.post("".concat(ROOT_CONTEXT_V1, "volumes"), volumes.createVolume);
app["delete"]("".concat(ROOT_CONTEXT_V1, "volumes/:volume_id"), volumes.deleteVolume);
app.get("".concat(ROOT_CONTEXT_V1, "volumes/:volume_id"), volumes.getVolume);
app.patch("".concat(ROOT_CONTEXT_V1, "volumes/:volume_id"), volumes.updateVolume);

/**
 * Set up the autoscale endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups"), instance_groups.getInstanceGroups);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id"), instance_groups.getInstanceGroup);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers"), instance_groups.getInstanceGroupManagers);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id"), instance_groups.getInstanceGroupManager);
app.post("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers"), instance_groups.createInstanceGroupManager);
app.patch("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id"), instance_groups.updateInstanceGroupManager);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id"), instance_groups.deleteInstanceGroupManager);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/policies"), instance_groups.getInstanceGroupPolicies);
app.post("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/policies"), instance_groups.createInstanceGroupPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/policies/:policy_id"), instance_groups.getInstanceGroupPolicy);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/policies/:policy_id"), instance_groups.deleteInstanceGroupPolicy);
app.patch("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/policies/:policy_id"), instance_groups.updateInstanceGroupPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/actions"), instance_groups.getInstanceGroupActions);
app.post("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/actions"), instance_groups.createInstanceGroupAction);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/actions/:action_id"), instance_groups.getInstanceGroupAction);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/actions/:action_id"), instance_groups.deleteInstanceGroupAction);
app.patch("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/managers/:manager_id/actions/:action_id"), instance_groups.updateInstanceGroupAction);
app.post("".concat(ROOT_CONTEXT_V1, "instance_groups"), instance_groups.createInstanceGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id"), instance_groups.deleteInstanceGroup);
app.patch("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id"), instance_groups.updateInstanceGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/load_balancer_pool"), instance_groups.deleteInstanceGroupLoadBalancer);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/memberships"), instance_groups.getInstanceGroupMemberships);
app.get("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/memberships/:member_id"), instance_groups.getInstanceGroupMembership);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/memberships"), instance_groups.detachInstanceGroupMemberships);
app.patch("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/memberships/:member_id"), instance_groups.updateInstanceGroupMembership);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance_groups/:group_id/memberships/:member_id"), instance_groups.detachInstanceGroupMembership);
app.get("".concat(ROOT_CONTEXT_V1, "instance/templates"), instance_templates.getInstanceTemplates);
app.get("".concat(ROOT_CONTEXT_V1, "instance/templates/:template_id"), instance_templates.getInstanceTemplate);
app.post("".concat(ROOT_CONTEXT_V1, "instance/templates"), instance_templates.createInstanceTemplate);
app.patch("".concat(ROOT_CONTEXT_V1, "instance/templates/:template_id"), instance_templates.updateInstanceTemplate);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instance/templates/:template_id"), instance_templates.deleteInstanceTemplate);

/**
 * Set up the baremetal instances endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_servers"), bmInstances.getInstances);
app.post("".concat(ROOT_CONTEXT_V1, "bare_metal_servers"), bmInstances.createInstance);
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id"), bmInstances.getInstance);
app["delete"]("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id"), bmInstances.deleteInstance);
app.patch("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id"), bmInstances.updateInstance);
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/initialization"), bmInstances.getInitConfiguration);

// disks
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/disks"), bmInstances.getDisks);
app.get("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/disks/:id"), bmInstances.getDisk);
app.patch("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/disks/:id"), bmInstances.updateDisk);

// actions

app.post("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/restart"), bmInstances.restartInstance);
app.post("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/start"), bmInstances.startInstance);
app.post("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/stop"), bmInstances.stopInstance);
app.post("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/firmware_update"), bmInstances.updateFirmware);
app.put("".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/initialization"), bmInstances.osReload);

// network_interfaces
var bm_nic_base_url = "".concat(ROOT_CONTEXT_V1, "bare_metal_servers/:bare_metal_server_id/network_interfaces");
app.get("".concat(bm_nic_base_url, "/:vnic_id"), network_interfaces.getNetworkInterface);
app.get("".concat(bm_nic_base_url), network_interfaces.getNetworkInterfaces);
app.patch("".concat(bm_nic_base_url, "/:vnic_id"), network_interfaces.updateNetworkInterface);
app.post("".concat(bm_nic_base_url), network_interfaces.createNetworkInterface);
app["delete"]("".concat(bm_nic_base_url, "/:vnic_id"), network_interfaces.deleteNetworkInterface);

// network_interfaces floating_ips
app.get("".concat(bm_nic_base_url, "/:vnic_id/floating_ips"), network_interfaces.getFloatingIpsForVnic);
app.get("".concat(bm_nic_base_url, "/:vnic_id/floating_ips/:ip_id"), network_interfaces.getFloatingIpForVnic);
app["delete"]("".concat(bm_nic_base_url, "/:vnic_id/floating_ips/:ip_id"), network_interfaces.deleteFloatingIpForVnic);
app.put("".concat(bm_nic_base_url, "/:vnic_id/floating_ips/:ip_id"), network_interfaces.putFloatingIpForVnic);

/**
 * Set up the instances endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "instances"), instances.getInstances);
app.post("".concat(ROOT_CONTEXT_V1, "instances"), instances.createInstance);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id"), instances.getInstance);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instances/:instance_id"), instances.deleteInstance);
app.patch("".concat(ROOT_CONTEXT_V1, "instances/:instance_id"), instances.updateInstance);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/initialization"), instances.getInitConfiguration);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/disks"), instances.getInstanceDisks);
app.patch("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/disks/:id"), instances.updateInstanceDisk);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/disks/:id"), instances.getInstanceDisk);

// actions
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/actions/:action_id"), instances.getActionForInstance);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/actions"), instances.getActionsList);
app.post("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/actions"), instances.postActionForInstance);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/actions/:action_id"), instances.deletePendingActionForInstance);

// network_interfaces
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces/:vnic_id"), network_interfaces.getNetworkInterface);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces"), network_interfaces.getNetworkInterfaces);
app.patch("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces/:vnic_id"), network_interfaces.updateNetworkInterface);
app.post("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces"), network_interfaces.createNetworkInterface);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces/:vnic_id"), network_interfaces.deleteNetworkInterface);

/**
 * Set up the placement group endpoints.
 */

app.get("".concat(ROOT_CONTEXT_V1, "placement_groups"), placment_groups.getPlacementGroups);
app.post("".concat(ROOT_CONTEXT_V1, "placement_groups"), placment_groups.createPlacementGroup);
app.get("".concat(ROOT_CONTEXT_V1, "placement_groups/:placement_group_id"), placment_groups.getPlacementGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "placement_groups/:placement_group_id"), placment_groups.deletePlacementGroup);
app.patch("".concat(ROOT_CONTEXT_V1, "placement_groups/:placement_group_id"), placment_groups.updatePlacementGroup);

/**
 * Set up the dedicated_hosts endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_hosts"), dedicated_hosts.getDedicatedHosts);
app.post("".concat(ROOT_CONTEXT_V1, "dedicated_hosts"), dedicated_hosts.createDedicatedHost);
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id"), dedicated_hosts.getDedicatedHost);
app["delete"]("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id"), dedicated_hosts.deleteDedicatedHost);
app.patch("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id"), dedicated_hosts.updateDedicatedHost);
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id/disks"), dedicated_hosts.getDisks);
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id/disks/:id"), dedicated_hosts.getDisk);
app.patch("".concat(ROOT_CONTEXT_V1, "dedicated_hosts/:dedicated_host_id/disks/:id"), dedicated_hosts.updateDisk);

/*
 * Set up the dedicated_host_profiles endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_host/profiles"), dedicated_host_profiles.getProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_host/profiles/:profile_name"), dedicated_host_profiles.getProfile);

/*
 * Set up the dedicated_host_groups endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_host/groups"), dedicated_host_groups.getDedicatedHostGroups);
app.post("".concat(ROOT_CONTEXT_V1, "dedicated_host/groups"), dedicated_host_groups.createDedicatedHostGroup);
app.get("".concat(ROOT_CONTEXT_V1, "dedicated_host/groups/:group_id"), dedicated_host_groups.getDedicatedHostGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "dedicated_host/groups/:group_id"), dedicated_host_groups.deleteDedicatedHostGroup);
app.patch("".concat(ROOT_CONTEXT_V1, "dedicated_host/groups/:group_id"), dedicated_host_groups.updateDedicatedHostGroup);

// network_interfaces floating_ips
var network_interfaces_base_url = "".concat(ROOT_CONTEXT_V1, "instances/:instance_id/network_interfaces/:vnic_id/");
app.get("".concat(network_interfaces_base_url, "floating_ips"), network_interfaces.getFloatingIpsForVnic);
app.get("".concat(network_interfaces_base_url, "floating_ips/:ip_id"), network_interfaces.getFloatingIpForVnic);
app["delete"]("".concat(network_interfaces_base_url, "floating_ips/:ip_id"), network_interfaces.deleteFloatingIpForVnic);
app.put("".concat(network_interfaces_base_url, "floating_ips/:ip_id"), network_interfaces.putFloatingIpForVnic);

// network_interfaces reserved_ips
app.get("".concat(network_interfaces_base_url, "ips"), network_interfaces.getReservedIpsForVnic);
app.get("".concat(network_interfaces_base_url, "ips/:ip_id"), network_interfaces.getReservedIpForVnic);

/**
 * Setup the volume attachments endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/volume_attachments"), volumeAttachments.getAttachmentsByInstance);
app.post("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/volume_attachments"), volumeAttachments.createAttachment);
app["delete"]("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/volume_attachments/:attachment_id"), volumeAttachments.deleteAttachment);
app.get("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/volume_attachments/:attachment_id"), volumeAttachments.getAttachment);
app.patch("".concat(ROOT_CONTEXT_V1, "instances/:instance_id/volume_attachments/:attachment_id"), volumeAttachments.updateAttachment);

// @NOTE: not officially part of rias spec, but can be useful for dev/debugging
app.get("".concat(ROOT_CONTEXT_V1, "volume_attachments"), volumeAttachments.getAttachments);

/**
 * Setup the VPN gateway (Site-to-site gateways) endpoints.
 */
// Gateways
app.get("".concat(ROOT_CONTEXT_V1, "vpn_gateways"), vpn_gateways.getVpnGateways);
app.post("".concat(ROOT_CONTEXT_V1, "vpn_gateways"), vpn_gateways.createVpnGateway);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpn_gateways/:vpn_gateway_id"), vpn_gateways.deleteVpnGateway);
app.get("".concat(ROOT_CONTEXT_V1, "vpn_gateways/:vpn_gateway_id"), vpn_gateways.getVpnGateway);
app.patch("".concat(ROOT_CONTEXT_V1, "vpn_gateways/:vpn_gateway_id"), vpn_gateways.updateVpnGateway);
// Advertised Cidrs
var vpn_advertised_cidrs_base_url = "".concat(ROOT_CONTEXT_V1, "vpn_gateways/:vpn_gateway_id/advertised_cidrs");
app.get("".concat(vpn_advertised_cidrs_base_url), vpn_gateways.getAdvertisedCidrs);
app.get("".concat(vpn_advertised_cidrs_base_url, "/:prefix_address/:prefix_length"), vpn_gateways.getAdvertisedCidr);
app.put("".concat(vpn_advertised_cidrs_base_url, "/:prefix_address/:prefix_length"), vpn_gateways.addAdvertisedCidr);
app["delete"]("".concat(vpn_advertised_cidrs_base_url, "/:prefix_address/:prefix_length"), vpn_gateways.deleteAdvertisedCidr);
// Connections
var vpn_connections_base_url = "".concat(ROOT_CONTEXT_V1, "vpn_gateways/:vpn_gateway_id/connections");
app.get("".concat(vpn_connections_base_url), connections.getConnections);
app.post("".concat(vpn_connections_base_url), connections.createConnection);
app.get("".concat(vpn_connections_base_url, "/:connection_id"), connections.getConnection);
app.patch("".concat(vpn_connections_base_url, "/:connection_id"), connections.updateConnection);
app["delete"]("".concat(vpn_connections_base_url, "/:connection_id"), connections.deleteConnection);
// Local Cidrs
var vpn_local_cidrs_base_url = "".concat(vpn_connections_base_url, "/:connection_id/local_cidrs");
app.get("".concat(vpn_local_cidrs_base_url), connections.getLocalCidrs);
app.get("".concat(vpn_local_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.getLocalCidr);
app.put("".concat(vpn_local_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.addLocalCidr);
app["delete"]("".concat(vpn_local_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.deleteLocalCidr);
// Peer Cidrs
var vpn_peer_cidrs_base_url = "".concat(vpn_connections_base_url, "/:connection_id/peer_cidrs");
app.get("".concat(vpn_peer_cidrs_base_url), connections.getPeerCidrs);
app.get("".concat(vpn_peer_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.getPeerCidr);
app.put("".concat(vpn_peer_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.addPeerCidr);
app["delete"]("".concat(vpn_peer_cidrs_base_url, "/:prefix_address/:prefix_length"), connections.deletePeerCidr);

/**
 * Setup the VPN server (Client-to-site servers) endpoints.
 */
// VPN Servers
app.get("".concat(ROOT_CONTEXT_V1, "vpn_servers"), vpn_servers.getVpnServers);
app.post("".concat(ROOT_CONTEXT_V1, "vpn_servers"), vpn_servers.createVpnServer);
app["delete"]("".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id"), vpn_servers.deleteVpnServer);
app.get("".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id"), vpn_servers.getVpnServer);
app.patch("".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id"), vpn_servers.updateVpnServer);
app.get("".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id/client_configuration"), vpn_servers.getVpnServerClientConfig);
// VPN Server Clients
var vpn_server_clients_base_url = "".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id/clients");
app.get("".concat(vpn_server_clients_base_url), vpn_server_clients.getClients);
app.get("".concat(vpn_server_clients_base_url, "/:client_id"), vpn_server_clients.getClient);
app["delete"]("".concat(vpn_server_clients_base_url, "/:client_id"), vpn_server_clients.deleteClient); // Terminate the client
app.post("".concat(vpn_server_clients_base_url, "/:client_id/disconnect"), vpn_server_clients.disconnectClient); // Terminate the client
// VPN Server Routes
var vpn_server_routes_base_url = "".concat(ROOT_CONTEXT_V1, "vpn_servers/:vpn_server_id/routes");
app.get("".concat(vpn_server_routes_base_url), vpn_server_routes.getRoutes);
app.post("".concat(vpn_server_routes_base_url), vpn_server_routes.createRoute);
app["delete"]("".concat(vpn_server_routes_base_url, "/:route_id"), vpn_server_routes.deleteRoute);
app.get("".concat(vpn_server_routes_base_url, "/:route_id"), vpn_server_routes.getRoute);
app.patch("".concat(vpn_server_routes_base_url, "/:route_id"), vpn_server_routes.updateRoute);

/**
 * Setup the ike_policies endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "ike_policies"), ike_policies.getIkePolicies);
app.post("".concat(ROOT_CONTEXT_V1, "ike_policies"), ike_policies.createIkePolicy);
app["delete"]("".concat(ROOT_CONTEXT_V1, "ike_policies/:ike_policy_id"), ike_policies.deleteIkePolicy);
app.get("".concat(ROOT_CONTEXT_V1, "ike_policies/:ike_policy_id"), ike_policies.getIkePolicy);
app.patch("".concat(ROOT_CONTEXT_V1, "ike_policies/:ike_policy_id"), ike_policies.updateIkePolicy);
app.get("".concat(ROOT_CONTEXT_V1, "ike_policies/:ike_policy_id/connections"), ike_policies.getIkePolicyConnections);

/**
 * Setup the ipsec_policies endpoints.
 */
app.get("".concat(ROOT_CONTEXT_V1, "ipsec_policies"), ipsec_policies.getIpsecPolicies);
app.post("".concat(ROOT_CONTEXT_V1, "ipsec_policies"), ipsec_policies.createIpsecPolicy);
app["delete"]("".concat(ROOT_CONTEXT_V1, "ipsec_policies/:ipsec_policy_id"), ipsec_policies.deleteIpsecPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "ipsec_policies/:ipsec_policy_id"), ipsec_policies.getIpsecPolicy);
app.patch("".concat(ROOT_CONTEXT_V1, "ipsec_policies/:ipsec_policy_id"), ipsec_policies.updateIpsecPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "ipsec_policies/:ipsec_policy_id/connections"), ipsec_policies.getIpsecPolicyConnections);

/**
 * Setup the flow_log_collectors endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "flow_log_collectors/"), flowLogCollectors.getFlowLogCollectors);
app.post("".concat(ROOT_CONTEXT_V1, "flow_log_collectors/"), flowLogCollectors.createFlowLogCollectors);
app["delete"]("".concat(ROOT_CONTEXT_V1, "flow_log_collectors/:flow_log_id/"), flowLogCollectors.deleteFlowLogCollector);
app.get("".concat(ROOT_CONTEXT_V1, "flow_log_collectors/:flow_log_id/"), flowLogCollectors.getFlowLogCollector);
app.patch("".concat(ROOT_CONTEXT_V1, "flow_log_collectors/:flow_log_id/"), flowLogCollectors.updateFlowLogCollector);

/**
 * Setup the virtual_network_interfaces endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces"), virtual_network_interfaces.getVNIs);
app.post("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces"), virtual_network_interfaces.createVNI);
app["delete"]("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id"), virtual_network_interfaces.deleteVNI);
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id"), virtual_network_interfaces.getVNI);
app.patch("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id"), virtual_network_interfaces.updateVNI);
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/ips"), virtual_network_interfaces.getVNIips);
app["delete"]("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/ips/:reserved_ip_id"), virtual_network_interfaces.deleteVNIip);
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/ips/:reserved_ip_id"), virtual_network_interfaces.getVNIip);
app.put("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/ips/:reserved_ip_id"), virtual_network_interfaces.setVNIip);
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/floating_ips"), virtual_network_interfaces.getVNIFloatingIps);
app["delete"]("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/floating_ips/:floating_ip_id"), virtual_network_interfaces.deleteVNIFloatingIp);
app.get("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/floating_ips/:floating_ip_id"), virtual_network_interfaces.getVNIFloatingIp);
app.put("".concat(ROOT_CONTEXT_V1, "virtual_network_interfaces/:virtual_network_interface_id/floating_ips/:floating_ip_id"), virtual_network_interfaces.setVNIFloatingIp);

/**
 * Setup the file_shares endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "share/profiles"), file_shares.getShareProfiles);
app.get("".concat(ROOT_CONTEXT_V1, "share/profiles/:name"), file_shares.getShareProfile);
app.get("".concat(ROOT_CONTEXT_V1, "shares/"), file_shares.getFileShares);
app.post("".concat(ROOT_CONTEXT_V1, "shares"), file_shares.createFileShare);
app["delete"]("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id"), file_shares.deleteFileShare);
app["delete"]("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/source"), file_shares.deleteFileShareReplicationRelationship);
app.get("".concat(ROOT_CONTEXT_V1, "shares/:id/mount_targets"), file_shares.getFileShareMountTargets);
app["delete"]("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/mount_targets/:mount_target_id"), file_shares.deleteFileShareMountTarget);
app.get("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/mount_targets/:mount_target_id"), file_shares.getFileShareMountTarget);
app.patch("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/mount_targets/:mount_target_id"), file_shares.updateFileShareMountTarget);
app.get("".concat(ROOT_CONTEXT_V1, "shares/:id"), file_shares.getFileShare);
app.post("".concat(ROOT_CONTEXT_V1, "shares/:id/mount_targets"), file_shares.createFileShareMountTarget);
app.patch("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/"), file_shares.updateFileShare);
app.post("".concat(ROOT_CONTEXT_V1, "shares/:file_share_id/failover"), file_shares.failover);

/**
 * Setup the snapshots endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "snapshots/"), snapshots.getSnapshots);
app.post("".concat(ROOT_CONTEXT_V1, "snapshots/"), snapshots.createSnapshot);
app["delete"]("".concat(ROOT_CONTEXT_V1, "snapshots/"), snapshots.deleteSnapshotsForVolume);
app["delete"]("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/"), snapshots.deleteSnapshot);
app.get("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/"), snapshots.getSnapshot);
app.patch("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/"), snapshots.updateSnapshot);
app.get("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/clones/"), snapshotsClones.getSnapshotClones);
app.get("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/clones/:zone_name"), snapshotsClones.getSnapshotClone);
app.put("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/clones/:zone_name"), snapshotsClones.createSnapshotClone);
app["delete"]("".concat(ROOT_CONTEXT_V1, "snapshots/:snapshot_id/clones/:zone_name"), snapshotsClones.deleteSnapshotClone);

/**
 * Setup the snapshot consistency groups endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "snapshot_consistency_groups/"), snapshotConsistencyGroups.getSnapshotConsistencyGroups);
app.post("".concat(ROOT_CONTEXT_V1, "snapshot_consistency_groups/"), snapshotConsistencyGroups.createSnapshotConsistencyGroup);
app["delete"]("".concat(ROOT_CONTEXT_V1, "snapshot_consistency_groups/:group_id/"), snapshotConsistencyGroups.deleteSnapshotConsistencyGroup);
app.get("".concat(ROOT_CONTEXT_V1, "snapshot_consistency_groups/:group_id/"), snapshotConsistencyGroups.getSnapshotConsistencyGroup);
app.patch("".concat(ROOT_CONTEXT_V1, "snapshot_consistency_groups/:group_id/"), snapshotConsistencyGroups.updateSnapshotConsistencyGroup);

/**
 * Setup the backup policy endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/"), backupPolicies.getPolicies);
app.post("".concat(ROOT_CONTEXT_V1, "backup_policies/"), backupPolicies.createPolicy);
app["delete"]("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/"), backupPolicies.deletePolicy);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/"), backupPolicies.getPolicy);
app.patch("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/"), backupPolicies.updatePolicy);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans"), backupPolicies.getPlansForPolicy);
app.post("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans"), backupPolicies.createPlanForPolicy);
app["delete"]("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans/:plan_id"), backupPolicies.deletePlanForPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans/:plan_id"), backupPolicies.getPlanForPolicy);
app.patch("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans/:plan_id"), backupPolicies.updatePlanForPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/plans/:plan_id"), backupPolicies.getPlanForPolicy);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/jobs"), backupPolicyJobs.getJobs);
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/jobs/:job_id"), backupPolicyJobs.getJob);
// Service Endpoints to act like backup service
app.get("".concat(ROOT_CONTEXT_V1, "backup_policies/:policy_id/trigger"), backupPolicies.triggerPolicy);

/**
 * Setup the CVO endpoints
 */

/**
 * CVO Ontaps Endpoints
 */
app.get("".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/"), ontap_instances.getInstances);
app.post("".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/"), ontap_instances.createInstance);
app["delete"]("".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/:ontap_id/"), ontap_instances.deleteInstance);
app.get("".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/:ontap_id/"), ontap_instances.getInstance);
app.patch("".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/:ontap_id/"), ontap_instances.updateInstance);

/**
 * CVO SVM Endpoints
 */
var svmsEndpoints = "".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/:ontap_id/storage_virtual_machines/");
app.get(svmsEndpoints, storage_virtual_machines.getSVMs);
app.get("".concat(svmsEndpoints, ":svm_id"), storage_virtual_machines.getSVM);
app.patch("".concat(svmsEndpoints, ":svm_id"), storage_virtual_machines.updateSVM);

/**
 * CVO Storage Volume Endpoints
 */
var storageVolumesEndpoint = "".concat(ROOT_CONTEXT_V1, "storage_ontap_instances/:ontap_id/storage_virtual_machines/:svm_id/volumes/");
app.get(storageVolumesEndpoint, storage_volumes.getStorageVolumes);
app.post(storageVolumesEndpoint, storage_volumes.createStorageVolume);
app.get("".concat(storageVolumesEndpoint, ":volume_id"), storage_volumes.getStorageVolume);
app.patch("".concat(storageVolumesEndpoint, ":volume_id"), storage_volumes.updateStorageVolume);
app["delete"]("".concat(storageVolumesEndpoint, ":volume_id"), storage_volumes.deleteStorageVolume);
if (isStandalone) {
  app.listen(port, function () {
    console.log('RIAS-MOCK server started.'); // eslint-disable-line no-console
    console.log("Listening at http://localhost:".concat(port)); // eslint-disable-line no-console
    console.log(startTime.toString()); // eslint-disable-line no-console
    console.log((0, _utils.versionInfoToString)()); // eslint-disable-line no-console
  });
}

var express = app;
exports.express = express;