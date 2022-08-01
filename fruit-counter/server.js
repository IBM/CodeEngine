// express webserver https://www.npmjs.com/package/express
// & HTTP body parsing middleware https://www.npmjs.com/package/body-parser
const express = require('express')
const bodyParser = require('body-parser')

// the official Node.js Cloudant library - https://www.npmjs.com/package/@ibm-cloud/cloudant
const { CloudantV1 } = require('@ibm-cloud/cloudant')
const client = CloudantV1.newInstance()
const DBNAME = process.env.DBNAME

// constants
const PORT = 8080 // the default for Code Engine
const HOST = '0.0.0.0' // listen on all network interfaces
const DESIGN_DOC = 'fruitCounter'

// the express app with:
// - static middleware serving out the 'public' directory as a static website
// - the HTTP body parsing middleware to handling POSTed HTTP bodies
const app = express()
app.use(express.static('public'))
app.use(bodyParser.json())

// utility function to create a design document to count the frequency of each fruit type
const createDesignDoc = async function () {
  // for more information on Cloudant design documents see https://cloud.ibm.com/docs/Cloudant?topic=Cloudant-views-mapreduce
  // first see if the ddoc already exists

  try {
    // if the design document exists
    await client.getDesignDocument({
      db: DBNAME,
      ddoc: DESIGN_DOC
    })

    // nothing to do, it already exists
    console.log('design document exists')
  } catch (e) {
    // does not exist, so create it
    console.log('Creating design document')
    const designDoc = {
      views: {
        test: {
          // count occurrences within the index
          reduce: '_count',
          // simple map function to create an index on the 'fruit' attribute
          map: 'function (doc) {\n  emit(doc.fruit, null);\n}'
        }
      }
    }
    await client.putDesignDocument({
      db: DBNAME,
      designDocument: designDoc,
      ddoc: DESIGN_DOC
    })
  }
}
createDesignDoc()

// respond to POST requests to the /fruit endpoint
app.post('/fruit', async (req, res) => {
  // extract the chosen fruit from the POSted body
  const fruit = req.body.fruit

  // build the document to save to Cloudant
  const fruitDocument = {
    fruit: fruit,
    timestamp: new Date().toISOString()
  }

  // Save the document in the database
  await client.postDocument({
    db: DBNAME,
    document: fruitDocument
  })

  // now retrieve totals using a MapReduce view
  const totals = await client.postView({
    db: DBNAME,
    ddoc: DESIGN_DOC,
    view: 'test',
    group: true
  })
  res.send({ totals: totals.result.rows })
})

// start the webserver
app.listen(PORT, HOST)
console.log(`Running on http://${HOST}:${PORT}`)
