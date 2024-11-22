const http = require("http");

http
  .createServer(function (request, response) {

    //
    // If the app has been configured to check the CIS secret, 
    // make sure that the request header value 'x-cis-secret' matches the configured secret.
    // If it doesn't match, assume that the request bypassed the CIS firewall and reject it.
    if(process.env.CIS_SECRET && request.headers['x-cis-secret'] !== process.env.CIS_SECRET){
      response.writeHead(403);
      return response.end();
    }

    //
    // Debug endpoint, which prints all incoming headers and environment variables
    if (request.url == "/debug") {
      const respData = {
        headers: request.headers,
        url: request.url,
        method: request.method,
        env: process.env,
      };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(respData));
      return;
    }

    //
    // Default http endpoint, which prints a simple hello world
    target = process.env.TARGET ? process.env.TARGET : "World";
    msg = process.env.MSG ? process.env.MSG : "Hello " + target + "\n";
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(msg);
  })
  .listen(8080);

console.log("Server running at http://0.0.0.0:8080/");
