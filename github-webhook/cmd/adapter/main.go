package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IBM/event-notifications-go-admin-sdk/eventnotificationsv1"
	"github.com/IBM/go-sdk-core/v5/core"
	"github.com/go-logr/logr"
	"github.com/go-logr/zapr"
	"github.com/go-openapi/strfmt"
	"github.com/go-playground/webhooks/v6/github"
	"go.uber.org/zap"
)

var (
	logger *logr.Logger
	config Config = getConfig()
)

type Config struct {
	EN_REGION      string
	IAM_API_KEY    string
	GITHUB_SECRET  string
	EN_SOURCE_ID   string
	EN_INSTANCE_ID string
}

func getConfig() Config {
	return Config{
		EN_REGION:      os.Getenv("CE_REGION"),
		IAM_API_KEY:    os.Getenv("IAM_API_KEY"),
		GITHUB_SECRET:  os.Getenv("GITHUB_SECRET"),
		EN_SOURCE_ID:   os.Getenv("EN_SOURCE_ID"),
		EN_INSTANCE_ID: os.Getenv("EN_INSTANCE_ID"),
	}
}

func main() {
	zapLogger, _ := zap.NewProduction()
	defer zapLogger.Sync()

	l := zapr.NewLogger(zapLogger)
	logger = &l

	mux := http.NewServeMux()
	mux.HandleFunc("/health", health)
	mux.HandleFunc("/", handler)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		l.Info("adapter server starting")
		if err := server.ListenAndServe(); err != nil {
			if err != http.ErrServerClosed {
				l.Error(err, "adapter server failed")
			} else {
				l.Info("adapter server stopped")
			}
		}
	}()

	// catch signals upon stop
	stopCh := make(chan os.Signal, 1)
	signal.Notify(stopCh, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	sig := <-stopCh
	l.Info("shutting down server", "signal", sig)

	// graceful server shutdown
	if err := server.Shutdown(context.Background()); err != nil {
		l.Error(err, "Failed to gracefully shutdown the server.")
	}

}

func health(resp http.ResponseWriter, req *http.Request) {
	resp.WriteHeader(http.StatusNoContent)
}

func handler(resp http.ResponseWriter, req *http.Request) {
	l := *logger
	/*
	  adapter handles only the Github Push Event, this can be extended.
	  https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28#pushevent
	*/
	gh_events := []github.Event{github.PushEvent}

	hook, err := github.New(github.Options.Secret(config.GITHUB_SECRET))
	if err != nil {
		l.Error(err, "failed to initialize gitHub webhook")
		resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	payload, err := hook.Parse(req, gh_events...)
	if err != nil {
		if err == github.ErrEventNotFound {
			l.Error(err, "unsupported event for adapter, only Push Event.")
		} else {
			l.Error(err, "parsing the github event failed")
		}
		resp.WriteHeader(http.StatusBadRequest)
		return
	}

	eventHeader := req.Header.Get("X-GitHub-Event")
	if eventHeader == "" {
		l.Error(errors.New("missing X-GitHub-Event header"), "GitHub event header not found")
		resp.WriteHeader(http.StatusBadRequest)
		return
	}
	event := github.Event(eventHeader)
	l.Info(fmt.Sprintf("processing github %s support event", event))

	if err := send(getPayload(event, payload)); err != nil {
		l.Error(err, "sending the EN notification failed")
		resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	resp.WriteHeader(http.StatusOK)
	resp.Header().Set("Content-Type", "text/plain")
}

func send(enPayload map[string]interface{}, short *string) error {
	l := *logger
	c, err := getClient()
	if err != nil {
		return err
	}
	l.Info("sending converted payload to the EN api source endpoint")
	res, resp, err := c.SendNotifications(enOptions(enPayload, short))
	if err != nil {
		return err
	}
	l.Info(fmt.Sprintf("result from EN: %v", *res.NotificationID))
	l.Info(fmt.Sprintf("response from EN: %v", resp))
	return nil
}

func getPayload(event github.Event, payload interface{}) (map[string]interface{}, *string) {
	l := *logger
	var enPayload map[string]interface{}
	var short *string
	switch event {
	case github.PushEvent:
		l.Info("github push event detected, going to process it")
		repo := payload.(github.PushPayload).Repository.FullName
		short = core.StringPtr("[" + repo + "] Github Event: " + string(event))
		enPayload = map[string]interface{}{
			"event":            event,
			"git_data":         payload.(github.PushPayload),
			"repo_url":         payload.(github.PushPayload).Repository.URL,
			"repo_commit_hash": payload.(github.PushPayload).HeadCommit.ID,
		}
	default:
		l.Info(fmt.Sprintf("unknown or unsupported event %s", event))
		return nil, nil
	}
	return enPayload, short
}

func enOptions(enPayload map[string]interface{}, short *string) *eventnotificationsv1.SendNotificationsOptions {
	specVersion := "1.0"
	notificationID := "adapterwebhook"
	notificationsSource := "adapter.webhook"
	typeValue := "PushEvent"
	notificationSeverity := "LOW"
	datacontenttype := "application/json"
	notificationCreateModel := &eventnotificationsv1.NotificationCreate{}
	notificationCreateModel.Ibmenseverity = &notificationSeverity
	notificationCreateModel.ID = &notificationID
	notificationCreateModel.Source = &notificationsSource
	notificationCreateModel.Ibmensourceid = &config.EN_SOURCE_ID
	notificationCreateModel.Specversion = &specVersion
	notificationCreateModel.Type = &typeValue
	notificationCreateModel.Time = &strfmt.DateTime{}
	notificationCreateModel.Specversion = &specVersion
	notificationCreateModel.Ibmendefaultshort = short
	notificationCreateModel.Ibmendefaultlong = core.StringPtr("adapter of github payload into an event notifications supported one")
	notificationCreateModel.Data = enPayload
	notificationCreateModel.Datacontenttype = &datacontenttype
	sendNotificationsOptionsModel := new(eventnotificationsv1.SendNotificationsOptions)
	sendNotificationsOptionsModel.InstanceID = &config.EN_INSTANCE_ID
	sendNotificationsOptionsModel.Body = notificationCreateModel
	return sendNotificationsOptionsModel
}

func getClient() (*eventnotificationsv1.EventNotificationsV1, error) {
	l := *logger

	authenticator := &core.IamAuthenticator{
		ApiKey: config.IAM_API_KEY,
		URL:    "https://iam.cloud.ibm.com/identity/token",
	}
	options := &eventnotificationsv1.EventNotificationsV1Options{
		Authenticator: authenticator,
		URL:           "https://" + config.EN_REGION + ".event-notifications.cloud.ibm.com/event-notifications",
	}
	eventNotificationsAPIService, err := eventnotificationsv1.NewEventNotificationsV1(options)
	if err != nil {
		l.Error(err, "could not create the event notification client")
		return nil, errors.New("error building en client")
	}
	l.Info("event notification client retrieved")
	return eventNotificationsAPIService, nil
}
