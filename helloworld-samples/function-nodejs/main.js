function main(params) {
      var msg = 'You did not tell me who you are.';
      if (params.name) {
          msg = `Hello, ${params.name}!`
       } else {
          msg = `Hello, Functions on CodeEngine!`
      }
      return {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          body: `<html><body><h3>${msg}</h3></body></html>`
       }
  }
  
  module.exports.main = main;
