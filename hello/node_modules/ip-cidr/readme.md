# Install  
`npm install ip-cidr`

# About  
Module for working with CIDR (v4, v6). Based on [ip-address](https://github.com/beaugunderson/ip-address).

# Example  

```js
const IPCIDR = require("ip-cidr");
const BigInteger = require("jsbn").BigInteger;
const address = "50.165.190.0/23";

if(!IPCIDR.isValidCIDR(address)) {
  return;
}

const cidr = new IPCIDR(address); 

// get start ip address as a string
cidr.start(); 

// get end ip address as a big integer
cidr.end({ type: "bigInteger" }); 

// do something with each element of the range  
cidr.loop(ip => console.log(ip), { type: "addressObject" });

// get an array of all ip addresses in the range as a big integer;
cidr.toArray({ type: "bigInteger" }); 

// get an array by chunks using from/limit
cidr.toArray({ from: 1, limit: new BigInteger('2') });

// get an array by chunks using from/to
cidr.toArray({ from: new BigInteger('1'), to: 3 });
cidr.toArray({ from: '50.165.190.1', to: '50.165.190.3' });

// get an array of start and end ip addresses as a string [startIpAsString, endIpAsString]
cidr.toRange(); 
```

## Client side
Load __/dist/ip-cidr.js__ as a script and you can get the library in __window.IPCIDR__

# API  
### .formatIP(address, [options])  
to return an "ip-address" module object in the necessary format 

### .isValidAddress(address)  
to check the address is valid or not (ip or cidr)

### .isValidCIDR(address)  
to check the address is valid (only cidr)

### .createAddress(address)  
to create an object address from the string

### .prototype.contains(address)  
to check the address belongs to the range

### .prototype.start([options])  
to get the start ip address

### .prototype.end([options])  
to get the end ip address

### .prototype.toString()   
to convert the cidr to a string like "50.165.190.0/23"

### .prototype.toRange([options])  
to convert the cidr to an array with start and end ip addresses [startIp, endIp]

### .prototype.toObject([options])   
to convert the cidr to an object with start and end ip addresses {start: startIp, end: endIp}

### .prototype.toArray([options], [results])  
to convert the cidr to an array with all ip addresses in the range  
you can get information by chunks using **options.from/options.limit** or **options.from/options.to**  
you can pass the second argument "results" (object) to get all chunk pagination information

### .prototype.loop(fn, [options], [results])  
to run __fn__ for each element of the range  
you can use the same chunk options as in __.toArray()__



