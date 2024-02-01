/**************************************************************************************
 * IBM Cloud Code Engine  - Quickstart sample to consume Cloudant changes
 *
 * Short Description:
 *  This sample Code Engine job can be deployed to act as a Cloudant Database change listener.
 *  The job, which is executed in "daemon" mode (https://cloud.ibm.com/docs/codeengine?topic=codeengine-job-daemon),
 *  uses the ibm-cloud/cloudant SDK function postChanges() to listen on changes within the connected database.
 *  On each detected change a Code Engine Function (function) or Application (app) is invoked.
 *
 * Pre-Conditions: 
 *  - ConfigMap :  with initial key/value pair  "DB_LAST_SEQ" / "now"
 *      The CE Project hosting the job has to have a config map with the name "<jobname>-config" which is used 
 *      to persist the DB_LAST_SEQ value on termination of the job. DB_LAST_SEQ is read when a subsequent job starts to define 
 *      the start listening indicator ("since" value).
 *  
 *  - ServiceID :  
 *      The job needs access to the CodeEngine API with a Project related service API key to 
 *           - check that only one instance of the job exists
 *           - to write data to the config map upon job exit 
 * 
 *  - Code Engine target  ( app or function URL )
 *      A code engine function or app must exist and its URL endpoint must be known.
 * 
 *  - Cloudant DB Instance 
 *      The job needs the cloudant DB connection info to be able to connect. The connection info settings can be retrieved from the 
 *      service binding of the DB by either 
 *        a) copy and paste the values from the servide binding to the job's env vars 
 *          or 
 *        b) assign the service binding directly to the job  
 *     See "Service Binding" (https://cloud.ibm.com/docs/containers?topic=containers-service-binding)
 *     
 * Functionality:  
 *  On job start the mandatory startup values are read from the environment variables. The job ends immediately with exit(0) if any startup 
 *  value is missing or incorrect. Default values are used if possible.
 *  Customer TODO: You may provide env var values if the default is not working
 *  
 *  The DB connection is established and the value of the DB_LAST_SEQ is used as start listen point of the DB feed. 
 * 
 *  When a change event is noted, the job invokes a function and passes the change event for further processing.
 *  The invoked function or app endpoint has to consume the "change" object as input. The id and the revision element of the change object can be used
 *  to identify the db document (including version) which triggered the change event.
 *  While processing changes a "lruCache" is used to filter out duplicate db notifications for the same change. This is necessary because 
 *  the IBM Cloudant DB SDK requires a client to be "idempotent".
 *
 *  On exit the value of the DB_LAST_SEQ is written to the config map, so that the next running job can start exactly from the last handled 
 *  change, independently how long the time between exit of the current job instance and the start of the next job instance will be 
 * 
 *  Customer TODO: Ensure that the db-client "idempotent" requirement is fullfilled across running job instances. An idempotent client must 
 *        ensure that it detects multiple notifications of the same change. There the lruCache must be persisted and passed on from the ending 
 *        job to the next starting job. Use an external DB like REDIS, Cloud Object Store , ...
 *
 *  Customer TODO: 
 *        You may add DB views and filters as needed.
 * 
 * Disclaimer:
 *  This sample can be used as-is. It does neither guarantee high-availability (HA), nor does it prevent event loss.
 *
 * Mandatory Environment variables:
 *   - CE_PROJECT_ID             GUID of the Code Engine project that hosts this Cloudant change listener job
 *   - CE_API_KEY                IAM APIKey that has at least Writer permission in the Code Engine project that hosts this Cloudant change listener job
 *   - CLOUDANTNOSQLDB_HOST      DB hostname e.g: 45396a6c-ad3e-4d11-909b-e67df631a310-bluemix.cloudantnosqldb.appdomain.cloud
 *   - CLOUDANTNOSQLDB_PORT      (optional) DB port number (default: 443)
 *   - CLOUDANTNOSQLDB_APIKEY    The IBM Cloud IAM APIkey if using IAMAuthentication on DB connection
 *   - DB_NAME                   The name of the DB to listen on.  e.g "MyTestDB"
 *   - DB_LAST_SEQ               (optional) last_seq value to use as start identifier for db changes feed.
 *   - CE_TARGET                 Full URL of the target Code Engine function or application that should receive events
 *   - DB_POST_CHANGES_TIMEOUT   Max wait-time in milliseconds on each long-polling call to the DB (default: 8000)
 *                               The poll timeout can be used to adapt the listening timeout to the settings defined on the cloudant DB 
 *   - IAM_TOKEN_URL             Provide if not using the default IAM service , default("https://iam.cloud.ibm.com/identity/token")
 *
 *   - CLOUDANTNOSQLDB_USERNAME  (use only if you use a legacy or Non IBM cloud cloudant DB)
 *   - CLOUDANTNOSQLDB_PASSWORD  (use only if you use a legacy or Non IBM cloud cloudant DB)
 *************************************************************************************/
import { CloudantV1 } from "@ibm-cloud/cloudant";
import { BasicAuthenticator, IamAuthenticator } from "ibm-cloud-sdk-core";
import log4js from "log4js";
import { LRUCache } from "lru-cache";
import { isJobAlreadyRunning, updateJobConfig, getJobConfig } from "./ce-api-utils.mjs";

//
// use a formatted logger to have timestamps in the log output 
log4js.configure({
  appenders: {
    out: { type: "stdout" },
  },
  categories: {
    default: { appenders: ["out"], level: process.env.LOGLEVEL || "info" },
  },
});
const logger = log4js.getLogger();

logger.info('Starting Cloudant DB change listener ...');

/** 
 * check for mandatory and optional startup parameters 
 **/

// 
// use Job assigned var here 
// check for mandatory startup parameters 
const projectId = process.env.CE_PROJECT_ID;
if (!projectId) {
  logger.warn('Exiting - Please provide the GUID of the Code Engine project which hosts the listener job as environment variable "CE_PROJECT_ID"');
  process.exit(0);
}

if (!process.env.CE_DOMAIN || process.env.CE_DOMAIN.indexOf(".") === -1) {
  logger.warn('Exiting - Please provide the CE_DOMAIN (e.g. "eu-de.codeengine.appdomain.cloud") of the Code Engine project which hosts the listener job as environment variable "CE_DOMAIN"');
  process.exit(0);
}

//
// use code engine provided env var here 
// https://cloud.ibm.com/docs/codeengine?topic=codeengine-inside-env-vars
const jobName = process.env.CE_JOB;
if (!jobName) {
  logger.warn('Exiting - Please provide the name of the Code Engine job as environment variable "CE_JOB"');
  process.exit(0);
}


//
// use Job assigned env var with value from ServiceID definition 
// See: https://cloud.ibm.com/apidocs/codeengine/v2?code=node#authentication
if (!process.env.CE_API_KEY) {
  logger.warn(`Exiting - Please provide an APIKey that can be used to operate towards the Code Engine project '${projectId}' as environment variable "CE_API_KEY"`);
  process.exit(0);
}

//
// use env var provided by Cloudant DB Service binding or Job defined env var 
const dbHost = process.env.CLOUDANTNOSQLDB_HOST;
if (!dbHost) {
  logger.warn('Exiting - Please provide the DB hostname as environment variable "CLOUDANTNOSQLDB_HOST"');
  process.exit(0);
}
const dbPort = process.env.CLOUDANTNOSQLDB_PORT || 443;
const dbUrl = `https://${dbHost}:${dbPort}`;
logger.info(`Using DB URL: '${dbUrl}'`);

const dbName = process.env.DB_NAME;
if (!dbName) {
  logger.warn('Exiting - Please provide the name of your DB as environment variable "DB_NAME"');
  process.exit(0);
}
logger.info(`Using DB name: '${dbName}'`);

//
// use env var provided by Cloudant DB Service binding or Job defined env var 
//
// Evaluate which authentication method to use to connect to the DB
// IAM Authentication is recommended in IBM Cloud. BASIC Authentication is only for legacy
const dbUserName = process.env.CLOUDANTNOSQLDB_USERNAME;
const dbPassword = process.env.CLOUDANTNOSQLDB_PASSWORD;
const dbIAMApiKey = process.env.CLOUDANTNOSQLDB_APIKEY;
let authenticator;
if (dbIAMApiKey) {
  authenticator = new IamAuthenticator({
    apikey: dbIAMApiKey,
    url: process.env.IAM_TOKEN_URL || "https://iam.cloud.ibm.com/identity/token",
  });
  logger.info("Using IAM authentication to connect to the DB using the provided APIkey");
} else if (dbUserName && dbPassword) {
  authenticator = new BasicAuthenticator({
    username: dbUserName,
    password: dbPassword,
  });
  logger.info("Using Basic Auth to connect to the DB, because no IAM APIkey has been provided to the environment");
} else {
  logger.warn(
    'Exiting - Missing authentication credentials. Either set "CLOUDANTNOSQLDB_APIKEY" to authenticate through IAM, or set "CLOUDANTNOSQLDB_USERNAME" and "CLOUDANTNOSQLDB_PASSWORD" to use Basic authentication towards your Cloudant DB instance'
  );
  process.exit(0);
}

//
// use env var directly defined on Job  
// Defines the target URL that will be called on each detected DB change
const targetCEUrl = process.env.CE_TARGET;
if (!targetCEUrl) {
  logger.warn(
    'Exiting - Missing target function. Please provide the URL of an app or a function that will be called on each change in the configured Cloudant database by providing the environment variable "CE_TARGET"'
  );
  process.exit(0);
}
logger.info(`Target CE Url: '${targetCEUrl}'`);

// naming rule for config map that must be assigned to hosting project is : "<jobname>-config"
const configMapName=`${process.env.CE_JOB}-config`   //* Configmap must exist in CE Project and be assigned to Job 

// 
// Check if config-map ${cloudant-change-listener-config} exists in CE Project 
try {
  await getJobConfig(projectId, configMapName );  
} catch (err) {
  logger.warn(`Exiting - Missing configMap or assignment on CE Project. Please configure configMap '${configMapName}'. Error : '`, err);
  process.exit(0);
}

// 
// use env var , assume it is set by the config map assigned to the job  
// check if the DB_LAST_SEQ env var exists 
//  -> assumption: env var is defined by config map ( BUT: call cannot detect if directly defined env var or coming from config map)
// Customer TODO: if it cannot guaranteed that env var is set from assigned config map, then improve the check here
logger.info(`LAST_SEQ on start : `, process.env.DB_LAST_SEQ);
if ( ! process.env.DB_LAST_SEQ ) {
  logger.warn('Exiting - Expected env var DB_LAST_SEQ defined in config map does not exist. ');
  process.exit(0);
}

//
// use env var directly defined on Job   (optional)
// Wait timeout for each polling action towards the Cloudant API ( must be > 1000)
const postChangesTimeout = process.env.DB_POST_CHANGES_TIMEOUT || 8_000;


/**
 * LruCache to hold the history of the change notifications already handled by the app.
 * This is used to avoid that a single DB change ends in multiple times calling the target CE function
 *  -> clients using cloudant-sdk lib must be "idempotent"
 */
function getLRUCache() {
  return new LRUCache({
    // TODO: Customer has to consider about the LRU Cache size and define it depending its needs 
    //       - for each tracked DB document that notified a change one item is in the cache 
    //       - the lruCache must fit into the memory of the job 
    //       - persistence storage (see SIGTERM function) must be sufficient to hold the cache 
    //       - job must be able to save the whole cache within the timeout value of the SIGTERM function 
    // 
    // proposed number of items to keep : 35000 ( one item is in average 160 Bytes =>  ca 5 MB in memory )
    max: 35_000,
    updateAgeOnGet: true,
    // time after that an item in the cache will be handled as
    // dead ( in msec ) -> 10 days  ( 10 * 24 *60 *60 *1000 )  remove items older 10 days 
    //* TODO: adjust the removal period to the intervals of job termination and restart. 
    //*       The cache should hold all info about the changes of one life-cycle of a job  ( e.g here interval is 10 days)
    ttl: 10 * 24 * 60 * 60 * 1_000,
  });
}

/**
 * Helper function to let the process wait for a while
 */
const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

/**
 * Wrapper function to ensure that the postChanges() call from the ibm-cloud/cloudant sdk
 * module will not wait forever on connecting to DB and try to get changes.
 *
 * **HINT:**
 * The wrapper is necessary because it was detected that the postChanges() library
 * had a bug in providing the "timeout" notification reliable. Ensures that the
 * postChanges did hang forever.
 */
async function waitForDbChanges(dbClient, sinceToken) {
  return new Promise(async (resolve, reject) => {
    logger.info(`postChanges -> sinceToken: '${sinceToken}'`);

    //
    // Setup a wrapper timeout with a longer timeout values as the timeout in postChanges() [e.g + 1 sec ]
    // if wrapper timeout occur then the err info is "WRAPPER_TIMEOUT".
    const timeoutID = setTimeout(() => {
      if (!isTerminating) {
        logger.info(`postChanges <- aborting as safety timeout has been reached`);
        reject(new Error("WRAPPER_TIMEOUT"));
      }
    }, postChangesTimeout + 1_000);

    //
    // wrapper checks every second if a request for job termination is received
    // if termination is requested then the err info is "SIGTERM_REQUESTED".
    const intervalID = setInterval(() => {
      logger.trace(`postChanges <- check if SIGTERM request reached`);
      if (isTerminating) {
        reject(new Error("SIGTERM_REQUESTED"));
      }
    }, 1_000);

    //
    // Do the cloudant-sdk call to establish a listen feed till timeout is reached.
    try {
      const response = await dbClient.postChanges({
        db: dbName,
        feed: "longpoll",
        timeout: postChangesTimeout,
        // filter : "_view",   //* filter not used in this quick-start version
        // view: viewPath,     //* view not used in this quick-start version
        since: sinceToken,
        includeDocs: false,
      });
      //
      // if job is in terminating  then do not handle any changes anymore
      if (!isTerminating) {
        logger.info(`postChanges <- postchanges() done, evaluate result now`);
        return resolve(response);
      }
    } catch (err) {
      logger.error(`postChanges <- ERR failed due to an unexpected error`, err);
      reject(err);
    } finally {
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
      if (intervalID) {
        clearInterval(intervalID);
      }
    }
  });
}

/**
 * Action done on a detected change
 *
 * Cloundant DB changes tracking gets sometimes duplicated changes
 * notified in case of "cloudant DB rewind" situation. To prevent
 * calling CE function mulitple times for the same change notification
 * use an in-memory lruCache (db client must be idempotent)
 */
function dbChangeHandler(change) {
  //
  // Determine doc_name, doc_revision and doc_revision_nr
  // of the document that has been changed
  let doc_revision = "unknown";
  let doc_revision_nr = 0;
  if (change.changes && change.changes[0] && change.changes[0].rev) {
    doc_revision = change.changes[0].rev;
    doc_revision_nr = Number(doc_revision.split("-")[0]);
  }
  const doc_name = change.id || "unknown";
  logger.info(`Received a change event from  DB '${dbName}' for doc '${doc_name}' with revision '${doc_revision}', change: '${JSON.stringify(change)}'`);

  //
  // Use LRU cache to ensure that duplicate change notifications are ignored.
  const documentRev = parseInt(doc_revision_nr, 10);
  const processedRev = parseInt(lruCache.get(doc_name), 10) || -1;
  if (processedRev >= documentRev) {
    logger.info(`Ignoring change on document '${doc_name}' whith revision '${doc_revision}', changes: '${change.changes}'`);
    return;
  }

  //
  // Store this entity in the LRU cache
  lruCache.set(doc_name, doc_revision_nr);

  //
  // Call the Code Engine target (app or function) and share that event
  const startTime = Date.now();
  fetch(targetCEUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8" },
    body: JSON.stringify(change),
  })
    .then((httpRes) => {
      logger.info(`Successfully called CE URL of app or function with response: '${httpRes.status}' - duration: ${Date.now() - startTime}ms`);
    })
    .catch((err) => {
      logger.error(`Failed to call CE URL of app or function'${targetCEUrl}', err =`, err);
    });
}

//
// Ephemeral variables that are used at runtime
//
let isTerminating = false;
let isWaitingOnDBChanges = false;
const lruCache = getLRUCache();
// Variable to store the last item that has been consumed from the feed
// "now" is a keyword to signal that it should just consume new changes
let lastHandledSeq = "now";

/** 
//  doListen() is like the main:  Connect database and listen on changes feed
*/
async function doListen() {
  logger.info("Checking prerequisites ...");

  //
  // To avoid duplicated processing of change events,
  // we enforce that only the instance with the JOB_INDEX==0 is allowed to get executed
  if (process.env.JOB_INDEX !== "0") {
    logger.info(`Abort - Assume that there is only a single instance of this jobrun running. JOB_INDEX: '${process.env.JOB_INDEX}'`);
    process.exit(0);
  }

  //
  // To avoid duplicated processing of change events,
  // check whether there is already a jobrun based on the same template that exists
  const isAlreadyRunning = await isJobAlreadyRunning(projectId, jobName);
  if (isAlreadyRunning) {
    logger.info(`Abort - Detected a run of job '${jobName}' that already runs.`);
    process.exit(0);
  }

  logger.info("Initializing DB change listener ...");

  //
  // Customer TODO: add custom code here to load Cache history from persistence and 
  //                pre-fill the lRUCache
  // like: chgHistory is an Array read from persistance and contains the cached elements  
  // 
  // chgHistory.forEach( (element) =>{  
  //   triggerData.lruCache.set ( element.doc, element.rev)   
  // })
                   



  //
  // Init the DB client
  let dbClient;
  try {
    dbClient = CloudantV1.newInstance({ authenticator });
    dbClient.setServiceUrl(dbUrl);

    await dbClient.getDatabaseInformation({
      db: dbName,
    });
    logger.info(`Successfully connected to database '${dbName}'`);
  } catch (err) {
    logger.error("Unexpected error while running DB change listener job", err);
    process.exit(1);
  }

  //******************************************************************************
  //* try/catch used to handle result of async/await waitForDbChanges.
  //* endless while loop must stop when app is terminating. ( a running endless
  //* loop is unneccessarily delaying the termination of the app)
  //* postChanges() changes feed uses the "since" option to determine the "last already handled"
  //* change from which the listening starts. This since option is controlled in
  //* this loop by following rules:
  //*   - use DB_LAST_SEQ value on first cycle of loop
  //*   - if waitForDbChanges() call provides a valid last_seq value in response, then
  //*     use this value for the next run of the loop
  //*   - if waitForDbChanges() call fails with timeout or retryalbe error,
  //*     then re-run with same seq value as in the previous loop cycle
  //*   - if waitForDbChanges() call fails with an unexpected or a permanent response data error,
  //*     then re-run postChanges() with since ='now' to prevent an endless error looping
  //******************************************************************************

  //
  // Listen on changes feed in an endless loop
  let sinceToken = process.env.DB_LAST_SEQ || "now";
  logger.info(`Start listening on DB change events on : ` , sinceToken);
  while (!isTerminating) {
    isWaitingOnDBChanges = true;
    try {
      //
      // Consume change events from the DB
      const response = await waitForDbChanges(dbClient, sinceToken);

      //
      // Response exist when waitForDbChanges returns OK
      // If response.result.results == 0 = {  "results": [] , "last_seq" : value }  means  timeout occur
      // If response = <value>  Doc change received  ( feed.on(data,..))
      if (Object.keys(response).length === 0) {
        logger.info("Cloudant-SDK provided an unexpected empty response object on postChanges() call. Continue listening");
        sinceToken = sinceToken; // intentionally set to make it obvious
        continue; // run waitForDbChanges again with current since token
      }

      if (!response || !response.result) {
        sinceToken = "now";
        logger.info(`Got Ok postChanges result, but not a valid last_seq value. Start fresh by pulling only new changes.`);
        continue; // run waitForDbChanges with new since token
      }

      if (Array.isArray(response.result.results) && response.result.results.length === 0 && response.result.last_seq) {
        //
        // Wait timed out and delivered the lastSeq value as start point for the next loop
        sinceToken = response.result.last_seq;
        lastHandledSeq = response.result.last_seq;
        logger.info(`No changes detected in the given wait period. Assigned new since token from result.`);
        continue; // run waitForDbChanges with updated since token
      }

      if (Array.isArray(response.result.results) && response.result.results.length > 0) {
        logger.info(`Detected ${response.result.results.length} change(s) in the DB. Assigned new since token from result.`);
        //
        // processing each change individually
        response.result.results.forEach((result) => {
          dbChangeHandler(result);
        });

        //
        // Get the last_seq value to use in the next postChanges() query
        sinceToken = response.result.last_seq;
        lastHandledSeq = response.result.last_seq;
        continue; // run waitForDbChanges with updated since token
      }

      //
      // In all other cases postChanges() returned OK, but not a
      // valid lastSeq number then continue the wrapper loop with
      // since = now
      sinceToken = "now";
      logger.info(`Got Ok postChanges result, but not a valid last_seq value. Start fresh by pulling only new changes.`);
      continue;
    } catch (err) {
      // Handle how to proceed loop in case of WRAPPER_TIMEOUT
      if ("WRAPPER_TIMEOUT" == err.message) {
        logger.info("wrapper timeout detected");
        continue;
      }

      // Handle how to proceed loop in case of WRAPPER_TIMEOUT
      if ("SIGTERM_REQUESTED" == err.message) {
        logger.info("job is requested to exit");
        continue;
      }

      logger.error("Error in waitForDbChanges loop, err = ", err);

      // In case of unexpected error occur, then continue
      // with wrapper loop and since = 'now'
      // and log as much as possible
      if (err.body) {
        logger.warn("Error detail = ", err.body);
      }
      if (err.statusText) {
        logger.warn("Error detail = ", err.statusText);
      }

      //
      // Resume processing
      sinceToken = "now";
      logger.info(`Start fresh by pulling only new changes.`);
      continue;
    }
  } // end of endless while loop

  //
  // flag is controlled in SIGTERM handler to ensure that job exit
  // occurs only when loop has ended
  isWaitingOnDBChanges = false;
}

//
// Defining exit handler sto preserve state and context
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} signal received. Allowing the current loop to finish ...`);
    isTerminating = true;

    // Need to wait until the postChanges() loop has finished
    // (max 5 sec, because loop checks each sec)
    //* if not finished, then the values to persist may be inconsistent.
    //* On restart of the job some changes could arrive a second time and handled twice.
    const ts = Date.now();
    while (isWaitingOnDBChanges === false) {
      if (Date.now() - ts > 5 * 1000) {
        logger.error(`loop listening on DB changes successfully not stopped, will save inconsistent lastHandledSeq and HandledChangesCache values`);
        break;
      }
      await sleep(500);
    }

    //**  TODO: add custom code here  persisting of lruCache history

    //
    // persist the DB_LAST_SEQ to the config map. So the next started Job can access the value as env var
    try {
      logger.log(`Save lastHandledSeq: '${lastHandledSeq}' to configMap of project`);
      await updateJobConfig(projectId, configMapName , { DB_LAST_SEQ: lastHandledSeq });
    } catch (err) {
      logger.warn(`Failed to safe the change listener state`, err);
    }
    logger.log(`Stopped Cloudant DB change listener!`);
    process.exit(0);
  });
});

//
// Connect to the DB and start the listing loop
doListen();
