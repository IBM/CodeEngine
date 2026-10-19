function main(args) {
    const body = {
      args,
      env: process.env,
    };
  
    // do not log the body, as it contains the process environment (which may hold credentials)
    console.log(`Returning response body with ${Object.keys(args || {}).length} args and ${Object.keys(process.env).length} env vars`);
  
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
      },
      body,
    };
  }
  
  module.exports.main = main;
  