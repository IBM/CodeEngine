import log4js from "log4js";
import { IamAuthenticator } from "ibm-cloud-sdk-core";
import CodeEngineV2 from "@ibm-cloud/ibm-code-engine-sdk/dist/code-engine/v2.js";

//
// use a formatted logger to have timestamps in the log output 
log4js.configure({
  appenders: {
    out: { type: "stdout" },
  },
  categories: {
    default: { appenders: ["out"], level: process.env.LOGLEVEL || "debug" },
  },
});
const logger = log4js.getLogger();

let codeEngineApi;
function getCodeEngineApi() {
  if (!codeEngineApi) {
    // Extracting the region from the CE_DOMAIN (us-south.codeengine.appdomain.cloud)
    const region = process.env.CE_DOMAIN.substring(0, process.env.CE_DOMAIN.indexOf("."));
    logger.trace(`CE_DOMAIN: '${process.env.CE_DOMAIN}', region: '${region}'`);
  
    // Construct the Code Engine client using the IAM authenticator.
    // see: https://cloud.ibm.com/apidocs/codeengine/v2?code=node#authentication
    codeEngineApi = CodeEngineV2.newInstance({
      authenticator: new IamAuthenticator({
        apikey: process.env.CE_API_KEY,
        url: process.env.IAM_TOKEN_URL || "https://iam.cloud.ibm.com/identity/token",
      }),
      serviceUrl: `https://api.${region}.codeengine.cloud.ibm.com/v2`,
    });
  }
  return codeEngineApi;
}

export async function getJobConfig(projectId, configMapName) {
  const fn = "getJobConfig ";
  logger.trace(`${fn}> configMapName: '${configMapName}'`);
  const configMap = await getConfigMap(projectId, configMapName);
  logger.trace(`${fn}< configmap '${configMapName}' exists `);
  return configMap;
}

export async function updateJobConfig(projectId, configMapName, configDataToUpdate) {
  const fn = "updateJobConfig ";
  logger.trace(`${fn}> configMapName: '${configMapName}', configDataToUpdate: '${JSON.stringify(configDataToUpdate)}'`);
  const updatedConfigMap = await updateConfigMap(projectId, configMapName, configDataToUpdate);
  logger.trace(`${fn}< updated configmap '${JSON.stringify(updatedConfigMap)}'`);
}

export async function isJobAlreadyRunning(projectId, jobName) {
  const fn = "isJobAlreadyRunning ";
  logger.debug(`${fn}> projectId: '${projectId}', jobName: '${jobName}'`);

  try {
    const jobRunList = await listJobRuns(projectId, jobName);
    logger.trace(`${fn}- jobRunList: '${JSON.stringify(jobRunList)}'`);

    if (!jobRunList || !Array.isArray(jobRunList)) {
      logger.debug(`${fn}< false - unexpected response`);
      return false;
    }

    if (jobRunList && Array.isArray(jobRunList) && jobRunList.length === 0) {
      logger.debug(`${fn}< false - no run in the system`);
      return false;
    }

    logger.debug(`${fn}- Found ${jobRunList.length} run(s) of job template '${jobName}' in the system`);
    const runningJob = jobRunList.find((run) => {
      if (!run.status) {
        return false;
      }
      // job in running or pending are considered 
      if ((run.status === "running" || run.status === "pending") && process.env.CE_JOBRUN !== run.name) {
        return true;
      }
    });
    if (runningJob) {
      logger.debug(`${fn}< Found job run: '${JSON.stringify(runningJob)}'`);
      return true;
    }
    logger.debug(`${fn}< false`);
    return false;
  } catch (err) {
    logger.error(`${fn}- Failed to list job runs`, err);
    logger.debug(`${fn}< false - Due to an error we cannot say for sure`);
    return false;
  }
}


/**
 * Utility function to list all job runs of a particular job
 * @param {*} projectId - The guid of the Code Engine project
 * @param {*} jobName - name of the job to filter the runs for
 * @returns
 */
async function listJobRuns(projectId, jobName) {
  const startTime = Date.now();
  const allResults = [];
  try {
    const params = {
      projectId,
      jobName,
      limit: 100,
    };
    // See: https://cloud.ibm.com/apidocs/codeengine/v2?code=node#list-job-runs
    const pager = new CodeEngineV2.JobRunsPager(getCodeEngineApi(), params);
    while (pager.hasNext()) {
      const nextPage = await pager.getNext();
      allResults.push(...nextPage);
    }
    logger.debug(`Successfully listed all runs of job '${jobName}' - duration: ${Date.now() - startTime}ms`);
    return allResults;
  } catch (err) {
    logger.error(`Failed to list runs of job '${jobName}', err =`, err);
    throw err;
  }
}

/**
 * Utility function to update a Code Engine config map
 * @param {*} projectId - The guid of the Code Engine project
 * @param {*} name - the name of the config map that should be updated
 * @param {*} configData - the key-value map of values that should be stored in the config map
 * @returns
 */
async function updateConfigMap(projectId, name, configData) {
  const startTime = Date.now();
  const params = {
    projectId,
    name,
    data: configData,
    ifMatch: "*",
  };

  try {
    // See: https://cloud.ibm.com/apidocs/codeengine/v2?code=node#replace-config-map
    const res = await getCodeEngineApi().replaceConfigMap(params);
    logger.debug(`Successfully updated ConfigMap '${name}' - duration: ${Date.now() - startTime}ms`);
    return res.result;
  } catch (err) {
    logger.error(`Failed to update ConfigMap '${JSON.stringify(params)}', err =`, err);
    throw err;
  }
}

/**
 * Utility function to read a Code Engine config map
 * @param {*} projectId - The guid of the Code Engine project
 * @param {*} name - the name of the config map that should be updated
 * @returns
 */
async function getConfigMap(projectId, name) {
  const startTime = Date.now();
  const params = {
    projectId,
    name
  };

  try {
    // See: https://cloud.ibm.com/apidocs/codeengine/v2?code=node#replace-config-map
    const res = await getCodeEngineApi().getConfigMap(params);
    logger.debug(`Successfully read ConfigMap '${name}' - duration: ${Date.now() - startTime}ms`);
    return res.result;
  } catch (err) {
    logger.error(`Failed to read ConfigMap '${JSON.stringify(params)}', err =`, err);
    throw err;
  }
}
