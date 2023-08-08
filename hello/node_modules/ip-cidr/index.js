"use strict";

const ipAddress = require('ip-address');
const BigInteger = require('jsbn').BigInteger;

class IPCIDR {
  constructor(cidr) {
    if(typeof cidr !== 'string' || !cidr.match('/')) {
      throw new Error('Invalid CIDR address.');
    }

    const address = this.constructor.createAddress(cidr);
    this.cidr = address.address;
    this.ipAddressType = address.constructor;
    this.address = address;
    this.addressStart = address.startAddress();
    this.addressEnd = address.endAddress();    
    this.addressStart.subnet = this.addressEnd.subnet = this.address.subnet;
    this.addressStart.subnetMask = this.addressEnd.subnetMask = this.address.subnetMask;
    this.size = new BigInteger(this.addressEnd.bigInteger().subtract(this.addressStart.bigInteger()).add(new BigInteger('1')).toString());
  }
  
  contains(address) {
    try {
      if(!(address instanceof ipAddress.Address6) && !(address instanceof ipAddress.Address4)) {
        if(typeof address == 'object') {
          address = this.ipAddressType.fromBigInteger(address);
        }
        else {
          address = this.constructor.createAddress(address);
        }
      }

      return address.isInSubnet(this.address)
    }
    catch(err) {
      return false;
    }   
  }

  start(options) {
    return this.constructor.formatIP(this.addressStart, options);
  }

  end(options) {
    return this.constructor.formatIP(this.addressEnd, options);
  }

  toString() {
    return this.cidr;
  }

  toRange(options) {
    return [this.constructor.formatIP(this.addressStart, options), this.constructor.formatIP(this.addressEnd, options)];
  }

  toObject(options) {
    return {
      start: this.constructor.formatIP(this.addressStart, options),
      end: this.constructor.formatIP(this.addressEnd, options)
    };
  }

  toArray(options, results) {
    options = options || {};
    const list = [];
    const start = this.constructor.formatIP(this.addressStart, { type: 'bigInteger' });
    const end = this.constructor.formatIP(this.addressEnd, { type: 'bigInteger' });
    const length = end.subtract(start).add(new BigInteger('1'));
    const info = this.getChunkInfo(length, options);

    if(results)  {
      Object.assign(results, info);
    }

    this.loopInfo(info, (val) => {
      const num = start.add(val);
      const ip = this.constructor.formatIP(this.ipAddressType.fromBigInteger(num), options);
      list.push(ip);
    });

    return list;
  }
  
  loop(fn, options, results) {
    options = options || {};
    const promise = [];
    const start = this.constructor.formatIP(this.addressStart, { type: 'bigInteger' });
    const end = this.constructor.formatIP(this.addressEnd, { type: 'bigInteger' });
    const length = end.subtract(start).add(new BigInteger('1'));
    const info = this.getChunkInfo(length, options);
    
    if(results)  {
      Object.assign(results, info);
    }

    this.loopInfo(info, (val) => {
      const num = start.add(val);
      const ip = this.constructor.formatIP(this.ipAddressType.fromBigInteger(num), options);
      promise.push(fn(ip));
    });

    return Promise.all(promise);
  }

  loopInfo(info, fn) {
    let i = info.from;

    while(i.compareTo(info.to) < 0) {
      fn(i);
      i = i.add(new BigInteger('1'));
    }
  }

  getChunkInfo(length, options) {
    let from = options.from;
    let limit = options.limit;
    let to = options.to;
    let maxLength;
    const addressBigInteger = this.constructor.formatIP(this.address, { type: 'bigInteger' });

    const getBigInteger = (val) => {
      if(typeof val == 'string' && val.match(/:|\./)) {
        return this.constructor.formatIP(this.constructor.createAddress(val), { type: 'bigInteger' }).subtract(addressBigInteger);
      }
      else if(typeof val != 'object') {
        return new BigInteger(val + '');
      }

      return val;
    }

    from = getBigInteger(from !== undefined? from: 0);

    if(to !== undefined) {
      to = getBigInteger(to);
      limit = to.subtract(from);
    }
    else {
      limit = limit !== undefined? getBigInteger(limit): length;
    }   

    maxLength = length.subtract(from);
    
    if(limit.compareTo(maxLength) > 0) {
      limit = maxLength;
    }
    
    to = from.add(limit);
    return {
      from: from,
      to: to,
      limit: limit,
      length: length
    };
  }
}

IPCIDR.formatIP = function(address, options) {
  options = options || {};

  if (options.type == "bigInteger") {
    return new BigInteger(address.bigInteger().toString());
  }
  else if (options.type == "addressObject") {
    return address;
  }

  return address.addressMinusSuffix;
}

IPCIDR.createAddress = function (val) {
  if(typeof val !== 'string') {
    throw new Error('Invalid IP address.');
  }

  val.match(/:.\./) && (val = val.split(':').pop());
  const ipAddressType = val.match(":")? ipAddress.Address6: ipAddress.Address4;

  if(ipAddressType === ipAddress.Address4) {
    const parts = val.split('.');

    for(let i = 0; i < parts.length; i++) {
      const part = parts[i].split('/')[0];

      if(part[0] == '0' && part.length > 1) {
        throw new Error('Invalid IPv4 address.');
      }
    }
  }

  return new ipAddressType(val);
}

IPCIDR.isValidAddress = function (address) {
  try {
    return !!this.createAddress(address);
  }
  catch(err) {
    return false;
  }
}

IPCIDR.isValidCIDR = function (address) {
  if(typeof address !== 'string' || !address.match('/')) {
    return false;
  }

  try {
    return !!this.createAddress(address);
  }
  catch(err) {
    return false;
  }
}

module.exports = IPCIDR;
