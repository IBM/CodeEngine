function main(args) {
    const body = {
      args,
      env: process.env,
    };
  
    console.log(`Return body: ${JSON.stringify(body, null, 2)}`);
  
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
      },
      body,
    };
  }
  
  module.exports.main = main;
  