/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

package notifications

import (
	"fmt"

	"log/slog"

	"observer/configuration"

	"github.com/IBM/code-engine-go-sdk/codeenginev2"
	"github.com/IBM/go-sdk-core/v5/core"
)

type codeEngineJobPoker struct {
	initialised bool
	config      configuration.Config
	clients     map[string]*codeenginev2.CodeEngineV2
	jobs        jobCache
}

func (cjp *codeEngineJobPoker) initialise() {
	slog.Info("CodeEngineJobPoker: Initialising code engine connection")
	cjp.config.LoadCodeEngineConfig()
	if err := cjp.getCeClients(); nil != err {
		slog.Warn("CodeEngineJobPoker: failed to create Code Engine Clients", "error", err)
		return
	}
	cjp.initialised = true
}

func (cjp *codeEngineJobPoker) poke(jobName string, data map[string]string) error {
	slog.Info("CodeEngineJobPoker: Building job run request")

	if !cjp.initialised {
		cjp.initialise()
	}
	if !cjp.initialised {
		slog.Warn("CodeEngineJobPoker: aborting notification")
		return fmt.Errorf("CodeEngine notification failed to initialise connection")
	}

	if job, err := cjp.identifyJob(jobName); nil != err {
		slog.Warn("CodeEngineJobPoker: error looking for job", "job", jobName, "error", err)
		return err
	} else if nil == job {
		slog.Warn("CodeEngineJobPoker: unable to find job in any project", "job", jobName)
		return fmt.Errorf("CodeEngineJobPoker: job %s not found", jobName)
	} else if err = cjp.runJob(job, data); nil != err {
		slog.Warn("CodeEngineJobPoker: error running", "job", jobName, "error", err)
		return err
	}

	return nil
}

func (cjp codeEngineJobPoker) buildApiEndpoint(region string) string {
	return "https://api." + region + ".codeengine.cloud.ibm.com/v2"
}

func (cjp *codeEngineJobPoker) getCeClients() error {
	// Create an IAM authenticator.
	authenticator := &core.IamAuthenticator{
		ApiKey:       cjp.config.CodeEngineAPIKey(),
		ClientId:     cjp.config.CodeEngineClientId(),
		ClientSecret: cjp.config.CodeEngineClientSecret(),
		URL:          cjp.config.CodeEngineAuthEndpoint(),
	}

	// slog.Info("CodeEngineJobPoker: ", "API Key", cjp.config.CodeEngineAPIKey())
	// slog.Info("CodeEngineJobPoker: ", "Client ID", cjp.config.CodeEngineClientId())
	// slog.Info("CodeEngineJobPoker: ", "Client Secret", cjp.config.CodeEngineClientSecret())

	if nil == authenticator {
		slog.Warn("CodeEngineJobPoker: Authenticator error")
		return fmt.Errorf("CodeEngineJobPoker: failed to create authenticator")
	}

	cjp.clients = make(map[string]*codeenginev2.CodeEngineV2)
	regions := cjp.config.CodeEngineRegions()

	for _, region := range regions {
		codeEngineApiEndpoint := cjp.buildApiEndpoint(region)
		slog.Info("CodeEngineJobPoker: endpoint identified", "endpoint", codeEngineApiEndpoint)

		// Setup a Code Engine client
		codeEngineServiceOptions := &codeenginev2.CodeEngineV2Options{
			Authenticator: authenticator,
			URL:           codeEngineApiEndpoint,
		}

		ceClient, err := codeenginev2.NewCodeEngineV2UsingExternalConfig(codeEngineServiceOptions)
		if err != nil {
			slog.Warn("CodeEngineJobPoker: Authentication error", "error", err)
			return err
		}

		cjp.clients[region] = ceClient
	}

	return nil
}

func (cjp *codeEngineJobPoker) identifyJob(jobName string) (*cejob, error) {
	if cjp.jobs.shouldBeUpdated() {
		if err := cjp.loadJobCache(); nil != err {
			slog.Warn("CodeEngineJobPoker: Don't have cache of jobs", "error", err)
			return nil, err
		}
	}
	cejob, found := cjp.jobs.find(jobName)
	if !found {
		slog.Info("CodeEngineJobPoker: Job not found", "name", jobName)
		return nil, nil
	}
	slog.Info("CodeEngineJobPoker: matching Job found", "name", jobName)

	return &cejob, nil
}

func (cjp *codeEngineJobPoker) loadJobCache() error {
	slog.Info("CodeEngineJobPoker: Loading cache of jobs")
	regions := cjp.config.CodeEngineRegions()

	for _, region := range regions {
		slog.Info("CodeEngineJobPoker: Loading projects for", "region", region)

		if projects, err := cjp.loadProjects(region); nil != err {
			slog.Warn("CodeEngineJobPoker: Error loading projects", "error", err)
			continue
		} else if 0 == len(*projects) {
			slog.Info("CodeEngineJobPoker: No projects found")
			continue
		} else if err = cjp.loadJobs(region, projects); nil != err {
			slog.Warn("CodeEngineJobPoker: Error loading jobs", "region", region, "error", err)
			continue
		}
	}

	if 0 == cjp.jobs.size() {
		slog.Warn("CodeEngineJobPoker: No jobs found")
		return fmt.Errorf("No Code Engine jobs found in any specified region")
	} else {
		cjp.jobs.setGoodTil()
		slog.Info("CodeEngineJobPoker: List of jobs obtained")
	}

	return nil
}

func (cjp codeEngineJobPoker) loadProjects(region string) (*[]codeenginev2.Project, error) {
	slog.Info("CodeEngineJobPoker: Loading Projects")

	// Doing this the paging way, just in case
	// Code cribbed from
	// https://cloud.ibm.com/apidocs/codeengine/v2?code=go#pagination

	listProjectsOptions := &codeenginev2.ListProjectsOptions{
		Limit: core.Int64Ptr(int64(100)),
	}

	pager, err := cjp.clients[region].NewProjectsPager(listProjectsOptions)
	if err != nil {
		return nil, err
	}

	slog.Info("CodeEngineJobPoker: Project Pager obtained")

	var projects []codeenginev2.Project

	for pager.HasNext() {
		nextPage, err := pager.GetNext()
		if err != nil {
			return nil, err
		}
		projects = append(projects, nextPage...)
	}

	slog.Info("CodeEngineJobPoker:", "number of projects", len(projects))
	return &projects, nil
}

func (cjp *codeEngineJobPoker) loadJobs(region string, projects *[]codeenginev2.Project) error {
	slog.Info("CodeEngineJobPoker: Loading Jobs")

	for _, p := range *projects {
		slog.Info("CodeEngineJobPoker: project details", "name", *p.Name, "id", *p.ID)
		if jobs, err := cjp.loadJobsFor(region, p); nil != err {
			return err
		} else if 0 == len(*jobs) {
			slog.Info("CodeEngineJobPoker: no jobs found")
		} else {
			slog.Info("CodeEngineJobPoker: processing jobs", "count", len(*jobs))
			cjp.addToCache(region, p, jobs)
		}
	}

	return nil
}

func (cjp codeEngineJobPoker) loadJobsFor(region string, p codeenginev2.Project) (*[]codeenginev2.Job, error) {
	slog.Info("CodeEngineJobPoker: Loading Jobs for", "project", *p.Name)

	listJobsOptions := &codeenginev2.ListJobsOptions{
		ProjectID: p.ID,
		Limit:     core.Int64Ptr(int64(100)),
	}

	pager, err := cjp.clients[region].NewJobsPager(listJobsOptions)
	if err != nil {
		return nil, err
	}

	var jobs []codeenginev2.Job
	for pager.HasNext() {
		nextPage, err := pager.GetNext()
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, nextPage...)
	}

	slog.Info("CodeEngineJobPoker:", "number of jobs", len(jobs))
	return &jobs, nil
}

func (cjp *codeEngineJobPoker) addToCache(region string, project codeenginev2.Project, jobs *[]codeenginev2.Job) {
	for _, j := range *jobs {
		slog.Info("CodeEngineJobPoker: adding to cache", "project", *project.Name, "job", *j.Name)
		cjp.jobs.add(region, *j.Name, *j.ID, *project.ID)
	}
}

func (cjp *codeEngineJobPoker) runJob(job *cejob, data map[string]string) error {
	slog.Info("CodeEngineJobPoker: Preparing to runJob")

	region := job.region

	createJobRunOptions := cjp.clients[region].NewCreateJobRunOptions(job.projectId)
	createJobRunOptions.SetJobName(job.name)

	var envsForJob []codeenginev2.EnvVarPrototype

	for k, v := range data {
		slog.Info("CodeEngineJobPoker: setting", k, v)

		envVar := new(codeenginev2.EnvVarPrototype)
		envVar.Name = core.StringPtr(k)
		envVar.Type = core.StringPtr("literal")
		envVar.Value = core.StringPtr(v)

		envsForJob = append(envsForJob, *envVar)
	}

	slog.Info("CodeEngineJobPoker: job environment variables set", "count", len(envsForJob))

	createJobRunOptions.SetRunEnvVariables(envsForJob)

	jobRun, _, err := cjp.clients[region].CreateJobRun(createJobRunOptions)
	if err != nil {
		slog.Info("CodeEngineJobPoker: Failed to run job", "error", err)
		return err
	}

	slog.Info(fmt.Sprintf("CodeEngineJobPoker: jobrun %s created for job %s", *jobRun.Name, *jobRun.JobName))
	return nil
}
