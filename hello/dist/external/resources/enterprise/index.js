"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAccountDetails = void 0;
var _casual = _interopRequireDefault(require("casual"));
var utils = _interopRequireWildcard(require("../../../utils"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
var generateNonEnterpriseError = function generateNonEnterpriseError() {
  var result = {
    trace: '1',
    errors: [{
      code: 'RETRIEVE_ACCOUNT_ERROR',
      message: 'undefined',
      more_info: 'n/a',
      dependency_code: 'ACCOUNT_MANAGEMENT'
    }]
  };
  return result;
};
var generateEnterpriseResponse = function generateEnterpriseResponse() {
  var accountId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '12345';
  var enterpriseId = _casual["default"].uuid.replace('-', '');
  return {
    url: "/v1/accounts/".concat(accountId),
    id: accountId,
    parent: "crn:v1:bluemix:public:enterprise::a/".concat(accountId, "::enterprise:").concat(enterpriseId),
    enterprise_account_id: accountId,
    enterprise_id: enterpriseId,
    enterprise_path: "enterprise:".concat(enterpriseId),
    name: "Generated Enterprise account for ".concat(accountId),
    domain: null,
    state: 'ACTIVE',
    paid: true,
    owner_iam_id: 'IBMid-12345678-mock',
    owner_email: 'email@rias-mock.ibm.com',
    created_at: utils.generateCreateDate(),
    created_by: 'rias-mock',
    updated_at: new Date().toISOString(),
    updated_by: 'rias-mock',
    crn: "crn:v1:bluemix:public:enterprise::a/".concat(accountId, "::account:").concat(accountId),
    is_enterprise_account: true
  };
};
var getAccountDetails = function getAccountDetails(req, res) {
  var accountId = req.params.accountId;
  var forceEnterprise = req.query.force;
  if (forceEnterprise === 'true') {
    res.json(generateEnterpriseResponse(accountId));
  } else if (accountId) {
    var nonEnterpriseError = generateNonEnterpriseError();
    res.status(400).send(nonEnterpriseError);
  } else {
    res.status(500).end();
  }
};
exports.getAccountDetails = getAccountDetails;