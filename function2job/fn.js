// stored 
let iamTokens;

async function main(params) {
  const greeting = params["greeting"];
  console.log(
    `function greeting: '${greeting}', params: '${JSON.stringify(params)}'`
  );

  console.log(
    `iamTokens.expiration: '${
      iamTokens && iamTokens.expiration
    }', now: '${Date.now()}'`
  );

  try {
    // Login with the given IAM API key to obtain an IAM access token
    if (!iamTokens || iamTokens.expiration < Date.now()) {
      console.log(
        `Perform a login towards IAM to obtain a fresh access token...`
      );
      iamTokens = await fetch("https://iam.cloud.ibm.com/identity/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa("bx:bx")}`,
        },
        body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${process.env.IBMCLOUD_API_KEY}`,
      }).then((resp) => resp.json());
    }

    // Submit a job run based on the job template that has been configured as CE_JOB_NAME and pass on the greeting as env variable
    const job_run = await fetch(
      `https://api.${process.env.CE_REGION}.codeengine.cloud.ibm.com/v2/projects/${process.env.CE_PROJECT_ID}/job_runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${iamTokens.access_token}`,
        },
        body: JSON.stringify({
          job_name: process.env.CE_JOB_NAME,
          run_env_variables: [
            { type: "literal", name: "greeting", value: greeting },
          ],
        }),
      }
    ).then((resp) => resp.json());
    console.log(`job_run: '${JSON.stringify(job_run)}'`);

    return {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ok", job_run: job_run.name }),
    };
  } catch (err) {
    return {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
}

module.exports.main = main;
