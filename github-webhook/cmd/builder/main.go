package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/go-logr/logr"
	"github.com/go-logr/zapr"
	"github.com/go-playground/webhooks/v6/github"
	buildAPI "github.com/shipwright-io/build/pkg/apis/build/v1beta1"
	build "github.com/shipwright-io/build/pkg/client/clientset/versioned/typed/build/v1beta1"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/rest"
	servingv1 "knative.dev/serving/pkg/apis/serving/v1"
	serving "knative.dev/serving/pkg/client/clientset/versioned/typed/serving/v1"
)

/*
	We need to identify the Build without the need of knowing its name.
	Fix image name not present for non icr ksv usage
*/

// Partially based on https://github.com/permhoot/rebuild/blob/main/main.go
const (
	namespaceFile                = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
	updateTimestampAnnotationKey = "codeengine.samples/updateTimestamp"
	defaultBuildRunWaitTimeout   = time.Duration(10 * time.Minute)
	userImageAnnotation          = "client.knative.dev/user-image"
)

var (
	logger *logr.Logger
)

type GitData struct {
	Event          string             `json:"event"`
	RepoCommitHash string             `json:"repo_commit_hash"`
	RepoURl        string             `json:"repo_url"`
	Git            github.PushPayload `json:"git_data"`
}

type ENPayload struct {
	Data GitData `json:"data"`
	Type string  `json:"type"`
	ID   string  `json:"id"`
}

func main() {
	zapLogger, _ := zap.NewProduction()
	defer zapLogger.Sync()

	ctx := context.Background()

	l := zapr.NewLogger(zapLogger)
	logger = &l

	ns, buildClient, servingClient, err := inClusterSetup()
	if err != nil {
		l.Error(err, "failed to setup in cluster config")
		os.Exit(1)
	}

	enData := os.Getenv("ibmendata")
	if enData != "" {
		l.Info("ibmendata env var is properly populated")
	}

	nameBuild := os.Getenv("BUILD_NAME")

	var payload ENPayload
	var imageOutput string

	err = json.Unmarshal([]byte(enData), &payload)
	if err != nil {
		l.Error(err, "failed to unmarshall payload from env var", "build", nameBuild)
		os.Exit(1)
	}

	l.Info("detected a new commit", "commit id", payload.Data.RepoCommitHash)
	l.Info("new commit in repo", "repo id", payload.Data.RepoURl)
	l.Info("git ssh url", "url", payload.Data.Git.Repository.SSHURL)
	l.Info("git http url", "url", payload.Data.RepoURl)

	err = validateBuildURLExists(ctx, buildClient, nameBuild, ns, payload.Data.Git.Repository.SSHURL, payload.Data.RepoURl)
	if err != nil {
		l.Error(err, "validating the reference build failed", "build", nameBuild)
		os.Exit(1)
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()

		l.Info("going to create buildrun from existing build", "build", nameBuild)
		br := &buildAPI.BuildRun{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "builder-buildrun",
			},
			Spec: buildAPI.BuildRunSpec{
				Build: buildAPI.ReferencedBuild{
					Name: &nameBuild,
				},
			},
		}
		br, err = buildClient.BuildRuns(ns).Create(ctx, br, metav1.CreateOptions{})
		if err != nil {
			log.Panic(err)
		}
		l.Info("Succesfully created", "buildrun", br.Name)

		br, err = waitForBuildRunCompletion(ctx, buildClient, br)
		if err != nil {
			l.Error(err, "waiting for buildrun failed", "buildrun", br.Name)
		}
		l.Info("Buildrun completed succesfully", "buildrun", br.Name)

		imageOutput = br.Status.BuildSpec.Output.Image

	}()
	wg.Wait()

	l.Info("Looking for a matching knative service", "namespace", ns, "image", imageOutput)

	svc, err := findService(ctx, servingClient, ns, imageOutput)
	if err != nil {
		l.Error(err, "error when looking for a ksvc", "namespace", ns)
	}
	if svc == nil {
		l.Info("non knative services found, that match the image output", "namespace", ns, "image", imageOutput)
	} else {
		l.Info("A matching knative service was found", "namespace", ns, "image", imageOutput)
		deleteService(ctx, servingClient, svc)
	}
}

func validateBuildURLExists(ctx context.Context,
	buildClient *build.ShipwrightV1beta1Client,
	buildName string,
	ns string,
	sshURLEndpoint string,
	httpURLEndpoint string) error {

	desiredBuild, err := buildClient.Builds(ns).Get(ctx, buildName, metav1.GetOptions{})
	if err != nil {
		return err
	}

	if desiredBuild.Spec.Source.Type != buildAPI.GitType {
		return errors.New("build source type not supported, should use Git")
	}

	if desiredBuild.Spec.Source.Git.URL != sshURLEndpoint && desiredBuild.Spec.Source.Git.URL != httpURLEndpoint {
		return errors.New("Build Source git URL does not match the event payload, bailing out")
	}

	return nil
}

func waitForBuildRunCompletion(ctx context.Context, buildClient *build.ShipwrightV1beta1Client, buildRun *buildAPI.BuildRun) (*buildAPI.BuildRun, error) {
	l := *logger

	var conditionFunc = func(ctx context.Context) (done bool, err error) {
		l.Info("Waiting for buildrun to complete", "buildrun", buildRun.Name)
		buildRun, err = buildClient.BuildRuns(buildRun.Namespace).Get(ctx, buildRun.Name, metav1.GetOptions{})
		if err != nil {
			return false, err
		}

		var condition = buildRun.Status.GetCondition(buildAPI.Succeeded)
		if condition == nil {
			return false, nil
		}

		switch condition.Status {
		case corev1.ConditionTrue:
			if buildRun.Status.CompletionTime != nil {
				return true, nil
			}

		case corev1.ConditionFalse:
			return false, fmt.Errorf(condition.Message)
		}

		return false, nil
	}

	timeout := lookUpTimeout(ctx, buildClient, buildRun)
	deadlineCtx, deadlineCancel := context.WithTimeout(ctx, timeout)
	defer deadlineCancel()

	if err := wait.PollUntilContextTimeout(deadlineCtx, 10*time.Second, timeout, true, conditionFunc); err != nil {
		return nil, fmt.Errorf("waiting for build-run to finish failed: %w", err)
	}

	return buildRun, nil
}

func lookUpTimeout(ctx context.Context, buildClient *build.ShipwrightV1beta1Client, buildRun *buildAPI.BuildRun) time.Duration {
	if buildRun.Spec.Timeout != nil {
		return buildRun.Spec.Timeout.Duration
	}

	if buildRun.Spec.Build.Name != nil {
		build, err := buildClient.Builds(buildRun.Namespace).Get(ctx, *buildRun.Spec.Build.Name, metav1.GetOptions{})
		if err == nil {
			if build.Spec.Timeout != nil {
				return build.Spec.Timeout.Duration
			}
		}
	}

	return defaultBuildRunWaitTimeout
}

func findService(ctx context.Context, servingClient *serving.ServingV1Client, namespace string, image string) (*servingv1.Service, error) {
	services, err := servingClient.Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for i := range services.Items {
		var service = services.Items[i]

		if userImage, ok := service.Annotations[userImageAnnotation]; ok {
			if userImage == image {
				return &service, nil
			}
		}
	}

	return nil, nil
}

func deleteService(ctx context.Context, servingClient *serving.ServingV1Client, service *servingv1.Service) {
	l := *logger
	l.Info("deleting Knative servive to force a new revision", "namespace", service.Namespace, "name", service.Name)

	annotations := service.Spec.Template.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[updateTimestampAnnotationKey] = time.Now().UTC().Format(time.RFC3339)
	service.Spec.Template.SetAnnotations(annotations)

	_, err := servingClient.Services(service.Namespace).Update(ctx, service, metav1.UpdateOptions{})
	if err != nil {
		l.Error(err, "failed to update service", "namespace", service.Namespace, "service", service.Name)
	}
}

func inClusterSetup() (string, *build.ShipwrightV1beta1Client, *serving.ServingV1Client, error) {
	l := *logger
	ns, err := os.ReadFile(namespaceFile)
	if err != nil {
		return "", nil, nil, err
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		return "", nil, nil, err
	}

	buildClient, err := build.NewForConfig(config)
	if err != nil {
		return "", nil, nil, err
	}

	servingClient, err := serving.NewForConfig(config)
	if err != nil {
		return "", nil, nil, err
	}

	l.Info("properly set all cluster client config")
	return string(ns), buildClient, servingClient, nil
}
