package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/IBM/CodeEngine/kafka-observer/internal/cmd"
	"github.com/IBM/code-engine-go-sdk/codeenginev2"
	"github.com/IBM/go-sdk-core/v5/core"
)

type KeyedMutex struct {
	mutexes sync.Map // Zero value is empty and ready for use
}

func (m *KeyedMutex) Lock(key string) func() {
	value, _ := m.mutexes.LoadOrStore(key, &sync.Mutex{})
	mtx := value.(*sync.Mutex)
	mtx.Lock()

	return func() { mtx.Unlock() }
}

func createJobInvoker(ceClient cmd.CEClient, projectID string, km *KeyedMutex) (*JobInvoker, error) {
	ceService, err := GetCodeEngineService(ceClient)
	if err != nil {
		return nil, err
	}

	return &JobInvoker{
		ProjectID:  projectID,
		CodeEngine: ceService,
		JobMutexes: km,
	}, nil
}

func (ji *JobInvoker) InvokeJobs(count int64, jobName string) error {
	failuresCounter := 0
	var indices string
	var err error
	if indices, err = ji.getArrayDesiredIndices(jobName, count); err != nil {
		return err
	}
	if indices != "" {
		if err := ji.createJobRun(jobName, indices); err != nil {
			failuresCounter++
			log.Printf("creating Jobrun %s failed: %v", jobName, err)
			return err
		}
	}
	return nil
}

// GetCodeEngineService returns a Code Engine client
func GetCodeEngineService(ceConfig cmd.CEClient) (*codeenginev2.CodeEngineV2, error) {
	authenticator := &core.IamAuthenticator{
		ApiKey:       ceConfig.IamApiKey,
		ClientId:     "bx",
		ClientSecret: "bx",
		URL:          "https://iam.cloud.ibm.com",
	}

	baseUrl := os.Getenv("CE_API_BASE_URL")
	if baseUrl == "" {
		log.Println("fetching base url failed, falling back to a default one")
		baseUrl = codeenginev2.DefaultServiceURL
	} else {
		baseUrl = baseUrl + "/v2"
	}

	codeEngineService, err := codeenginev2.NewCodeEngineV2(&codeenginev2.CodeEngineV2Options{
		Authenticator: authenticator,
		URL:           baseUrl,
	})
	if err != nil {
		log.Printf("error getting CE api client: %s\n", err.Error())
		return nil, err
	}
	return codeEngineService, nil
}

// getArrayDesiredIndices returns the arrayspec for a jobrun based on JobRun array indices
func (ji *JobInvoker) getArrayDesiredIndices(jobName string, desired int64) (string, error) {
	var alreadyCreated int64
	listJobRunsOptions := &codeenginev2.ListJobRunsOptions{
		ProjectID: core.StringPtr(ji.ProjectID),
		JobName:   core.StringPtr(jobName),
		Limit:     core.Int64Ptr(int64(100)),
	}

	pager, err := ji.CodeEngine.NewJobRunsPager(listJobRunsOptions)
	if err != nil {
		return "", err
	}

	var allResults []codeenginev2.JobRun
	for pager.HasNext() {
		nextPage, err := pager.GetNext()
		if err != nil {
			return "", err
		}
		allResults = append(allResults, nextPage...)
	}

	if len(allResults) == 0 {
		log.Printf("new desired array indices value: %v", strconv.Itoa(int(desired)))
		return fmt.Sprintf("0-%v", desired-1), nil
	}

	for _, jr := range allResults {
		if jr.StatusDetails != nil {
			if jr.StatusDetails.Requested != nil {
				alreadyCreated += *jr.StatusDetails.Requested
			}
			if jr.StatusDetails.Running != nil {
				alreadyCreated += *jr.StatusDetails.Running
			}
			if jr.StatusDetails.Pending != nil {
				alreadyCreated += *jr.StatusDetails.Pending
			}
		}
	}
	newpods := desired - alreadyCreated
	if newpods <= 0 {
		log.Printf("already created JobRuns instances are sufficient, nothing to do.")
		return "", nil
	}
	reqArraySpec := fmt.Sprintf("0-%v", newpods-1)
	log.Printf("new desired array indices value: %v", reqArraySpec)
	return reqArraySpec, nil
}

// createJobRun creates the jobrun for a job
func (ji *JobInvoker) createJobRun(jobName string, arraySpec string) error {
	createJobRunOptions := ji.CodeEngine.NewCreateJobRunOptions(ji.ProjectID)
	createJobRunOptions.SetJobName(jobName)
	createJobRunOptions.SetScaleArraySpec(arraySpec)

	log.Printf("creating jobrun for job %s with arrayspec %s", jobName, arraySpec)
	result, _, err := ji.CodeEngine.CreateJobRun(createJobRunOptions)
	if err != nil {
		return err
	}

	log.Printf("jobrun %s created for job %s ", *result.Name, *result.JobName)

	retryTimes := 0

	for {
		getJobRunOptions := ji.CodeEngine.NewGetJobRunOptions(ji.ProjectID, *result.Name)

		// For now ignoring error
		jr, _, _ := ji.CodeEngine.GetJobRun(getJobRunOptions)
		var podsActive int64
		if jr != nil {
			if jr.StatusDetails != nil {
				if jr.StatusDetails.Requested != nil {
					podsActive += *jr.StatusDetails.Requested
				}
				if jr.StatusDetails.Running != nil {
					podsActive += *jr.StatusDetails.Running
				}
				if jr.StatusDetails.Pending != nil {
					podsActive += *jr.StatusDetails.Pending
				}
			}
		}
		if podsActive > 0 {
			log.Printf("jobrun %s has been scheduled", *result.Name)
			break
		}

		if retryTimes > 4 {
			log.Printf("couldn't get the jobrun %s in 5 retries", *result.Name)
			return errors.New("couldn't get the jobrun " + *result.Name + "in 5 retries ")
		}

		time.Sleep(2 * time.Second)
		retryTimes++
	}
	return nil
}
