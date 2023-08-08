"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sendHyperwarpEvent = void 0;
var _utils = require("../utils");
var http = require('http');
var hostname = 'localhost';
var port = 39002;
var path = '/vpc/data/hyperwarp';
var sendHyperwarpEvent = function sendHyperwarpEvent(eventType, crn) {
  var send = function send() {
    var data = JSON.stringify([{
      account_id: 'local',
      event_id: "".concat(Math.random()),
      event_properties: {
        action: 'Start',
        crn: crn || '',
        generation: 'ng',
        iam_id: '',
        regional_api_endpoint: '',
        updated_at: '2021-11-29T05:35:51.634Z'
      },
      event_type: eventType,
      family: 'genesis.events',
      publisher: 'genesis',
      publisher_id: 'genesis',
      timestamp: '2021-09-25T02:02:31.0+00:00',
      version: '0'
    }]);
    var options = {
      hostname: hostname,
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-auth': 'VPC-UI-HYPERWARP' // pragma: allowlist secret
      }
    };

    var httpReq = http.request(options, function (httpRes) {
      httpRes.on('data', function (d) {
        return process.stdout.write(d);
      });
    });

    // eslint-disable-next-line no-console
    httpReq.on('error', function (error) {
      return console.error(error);
    });
    httpReq.write(data);
    httpReq.end();
  };
  if ((0, _utils.isHyperwarpEnabled)()) {
    send();
  }
};
exports.sendHyperwarpEvent = sendHyperwarpEvent;