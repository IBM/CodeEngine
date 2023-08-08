"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VPE_LIFECYCLE_REASON = exports.LIFECYCLE_STATE = exports.HEALTH_STATE = void 0;
var LIFECYCLE_STATE = {
  // DELETED: 'deleted', // This state is never exposed to RIAS clients.
  DELETING: 'deleting',
  FAILED: 'failed',
  PENDING: 'pending',
  STABLE: 'stable',
  UPDATING: 'updating',
  WAITING: 'waiting'
};
exports.LIFECYCLE_STATE = LIFECYCLE_STATE;
var HEALTH_STATE = {
  OK: 'ok',
  DEGRADED: 'degraded',
  FAULTED: 'faulted',
  INAPPLICABLE: 'inapplicable'
};
exports.HEALTH_STATE = HEALTH_STATE;
var VPE_LIFECYCLE_REASON = {
  PENDING_ACCESS: 'pending_access',
  ACCESS_DENIED: 'access_denied',
  ACCESS_EXPIRED: 'access_expired'
};
exports.VPE_LIFECYCLE_REASON = VPE_LIFECYCLE_REASON;