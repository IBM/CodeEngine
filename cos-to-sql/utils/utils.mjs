// Libraries to convert CSV content into a object structure
import csv from "csv-parser";
import { Readable } from "stream";

// helper function to convert a CSV data structure into an array of objects
export function convertCsvToDataStruct(csvContent) {
  return new Promise((resolve) => {
    // the result to return
    const results = [];

    // create a new readable stream
    var readableStream = new Readable();

    // the CSV parser consumes the stream
    readableStream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        console.log(`converted CSV data: ${JSON.stringify(results)}`);

        resolve(results);
      });

    // push the CSV file content to the stream
    readableStream.push(csvContent);
    readableStream.push(null); // indicates end-of-file
  });
}
