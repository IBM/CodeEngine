// ======================================================= //
//  IBM Cloud Code Engine - Functions-as-a-Service Sample  //
//                                                         //
//  main.ts (TypeScript sample)                            //
//                                                         //
//  This sample code uses an external module "lorem-ipsum" //
//  to generate an arbitrary result message. IBM code      //
//  engine functions code with references to external      //
//  modules have to be deployed as code-bundles.           //
//                                                         //
//  This sample shows how an external reference is coded   //
//  in the source file (main.ts) and how the module is     //
//  referenced in the packages.json file                   //
// ======================================================= //

/**
 * The `main` function is the entry-point into the function.
 *  
 * A Code engine function source file can define multiple
 * functions, but it needs to have one dedicated 'main' 
 * function, which will be called by the code engine runtime
 * on function's invocation. 
 * 
 * The 'main' function has one optional argument, which 
 * carries all the parameters the function was invoked with.
 * But in this example the input argument is not used. 
 * 
 */ 

  // refernce external module 
import { LoremIpsum } from "lorem-ipsum";

interface Params {
  [key: string]: any;
}

interface Response {
  headers: { [key: string]: string };
  body: string;
}

// export the main function within this source file 
// as the 'main' symbol to make it known to the runtime
// This also works, if the function name is not 'main'.
// By exporting the function as 'main', it will be 
// found and invoked by the runtime.
export function main(params?: Params): Response {
  // create a default text generator. 
  const lorem = new LoremIpsum();
  // finally, build an HTML response that can be rendered 
  // properly in a browser. To do so, we need to specify
  // the correct 'Content-Type' ('text/html' for HTML markup)
  // Alternatively, we could also use 'text/plain' or 
  // 'application/json', depending on the text we plan to 
  // return.
  return {
    // specify headers for the HTTP response
    // we only set the Content-Type in this case, to 
    // ensure the text is properly displayed in the browser   
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    // use the text generator to create a response sentence 
    // with 10 words
    body: lorem.generateWords(10),
  };
}
