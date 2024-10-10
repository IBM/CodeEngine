const http = require("http");

http
  .createServer(function (request, response) {
    //
    // debug endpoint, which prints all incoming headers and environment variables
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
    // default http endpoint, which prints a simple hello world
    target = process.env.TARGET ? process.env.TARGET : "World";
    msg = process.env.MSG ? process.env.MSG : "Hello " + target + "\n";
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(msg);
  })
  .listen(8080);

console.log("Server running at http://0.0.0.0:8080/");
