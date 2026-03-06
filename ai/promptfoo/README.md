# promptfoo on IBM Cloud Code Engine

![](./images/architecture.png)

## What is promptfoo

- [promptfoo](https://www.promptfoo.dev/) is an open-source **LLM testing, evaluation, and red-teaming framework** that helps you build reliable LLM applications.
- It enables you to **systematically test and compare** prompts, models, and RAG pipelines across providers, ensuring quality and safety before production.
- Key capabilities include:
  - **Testing & Evaluation:** Run automated tests with assertions, compare outputs across models, and track performance metrics
  - **Red-teaming:** Identify vulnerabilities, jailbreaks, and harmful outputs with built-in security testing
  - **Prompt Engineering:** Iterate on prompts with side-by-side comparisons and regression testing
  - **CI/CD Integration:** Integrate into your development workflow to catch issues early
  - **Web UI:** Visualize results, share findings with stakeholders, and collaborate on improvements
- Supports all major LLM providers (OpenAI, Anthropic, Google, Azure, AWS, and more), local models, and custom providers.

## Why Code Engine is a great fit

Using **[IBM Cloud Code Engine](https://www.ibm.com/products/code-engine)** you can host promptfoo's web UI and create a centralized hub for your team's LLM testing and evaluation workflows.

- **Managed runtime:** Code Engine runs containers without managing servers, lowering operational overhead.
- **Public endpoints:** Apps get a reachable URL out of the box, making it easy to share test results, red-team findings, and evaluation reports with your team.
- **Scalability & cost control:** Configure CPU/memory and min/max scale for predictable resource use and autoscaling when needed.
- **Integrates with COS:** Object storage (IBM Cloud Object Storage) can be mounted as a persistent data store for test results, configurations, datasets, and historical comparisons.
- **Secure secrets & PDS:** Use Code Engine secrets and Persistent Data Stores (PDS) to store credentials and mount COS buckets securely.
- **Team collaboration:** Centralized deployment enables teams to share test suites, compare results, and maintain a single source of truth for LLM quality metrics.

## Deploy 

This repository includes a convenience script `deploy.sh` that automates the common steps (creating a Code Engine project, creating a COS instance and bucket, creating a service key, creating a CE secret and PDS, and deploying the image).

**Prerequisites**

Create an IBM Cloud account on the target Code Engine provider (e.g., IBM Cloud Code Engine) and [login into your IBM Cloud account using the IBM Cloud CLI](https://cloud.ibm.com/docs/codeengine?topic=codeengine-install-cli).


**Deploy** 
Run the bundled script from this folder which automates the steps above and configures COS/PDS integration:

```bash
./deploy.sh
```

The script accepts optional environment variables to customize region and naming, e.g.:

```bash
REGION=eu-de NAME_PREFIX=ce-promptfoo ./deploy.sh
```

Notes on persistence

- The deployment mounts an IBM Cloud Object Storage bucket as a Persistent Data Store so promptfoo can persist evaluation results and configurations across restarts.
- The script creates a secret (`promptfoo-cos-secret`) containing HMAC credentials and a PDS (`promptfoo-store`) that points the app at the bucket.

## Access the environment

After deployment, retrieve the app URL with:

```bash
ibmcloud ce app get --name promptfoo -o json | jq -r '.status.url'
```

The script also prints the reachable URL, for example:

```
https://promptfoo.26pr644bfbfc.eu-de.codeengine.appdomain.cloud
```

## Use promptfoo

Open the URL in a browser window to access the web UI of [promptfoo](https://www.promptfoo.dev/) and view your evaluation results.

## Use promptfoo CLI locally and share with the deployed application

You can run promptfoo evaluations locally and share the results with your deployed Code Engine application. This allows you to:

- Run evaluations on your local machine with your preferred configuration
- View and share results through the hosted web UI
- Collaborate with team members by pointing them to the shared URL

### Setup

1. Install promptfoo locally:

```bash
npm install -g promptfoo
```

2. Get your deployed application URL:

```bash
ibmcloud ce app get --name promptfoo -o json | jq -r '.status.url'
```

3. Configure your `promptfooconfig.yaml` to use the deployed application as the sharing endpoint:

```yaml
# yaml-language-server: $schema=https://promptfoo.dev/config-schema.json

description: "My eval"

sharing:
  apiBaseUrl: https://promptfoo.26pr644bfbfc.eu-de.codeengine.appdomain.cloud

prompts:
  - "Write a tweet about {{topic}}"
  - "Write a concise, funny tweet about {{topic}}"

providers:
  - id: "openai:gpt-4"
    config:
      apiKey: ${OPENAI_API_KEY}

tests:
  - vars:
      topic: bananas

  - vars:
      topic: avocado toast
    assert:
      - type: icontains
        value: avocado
      - type: javascript
        value: 1 / (output.length + 1)
```

4. Run your evaluation locally:

```bash
promptfoo eval
```

5. View results in the web UI:

```bash
promptfoo view
```

This will open the local viewer, but you can also access the shared results through your deployed Code Engine URL.

### Sharing results

When you run `promptfoo eval` with the `sharing.apiBaseUrl` configured, your evaluation results are automatically uploaded to the deployed application. Team members can then access these results by visiting the Code Engine URL.

**Benefits:**
- **Centralized results:** All team members can view evaluation results in one place
- **No local setup required:** Stakeholders can review results without installing promptfoo
- **Persistent storage:** Results are stored in COS and persist across application restarts
- **Collaboration:** Share specific evaluation URLs with team members for review and discussion

