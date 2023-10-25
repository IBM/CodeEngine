package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"

	ce "github.com/IBM/code-engine-go-sdk/codeenginev2"
	en "github.com/IBM/event-notifications-go-admin-sdk/eventnotificationsv1"
	"github.com/IBM/go-sdk-core/v5/core"
	sm "github.com/IBM/secrets-manager-go-sdk/secretsmanagerv2"
	"github.com/gorilla/mux"
)

type Service struct {
	SMClient *sm.SecretsManagerV2
	CEClient *ce.CodeEngineV2
	ENClient *en.EventNotificationsV1
}

type Notification struct {
	ID   string `json:"notification_id,omitempty"`
	Type string `json:"type,omitempty"`
	Data Data   `json:"data,omitempty"`
}

type Data struct {
	Secrets []Secret `json:"secrets,omitempty"`
}

type Secret struct {
	ID      string `json:"secret_id,omitempty"`
	Name    string `json:"secret_name,omitempty"`
	GroupID string `json:"secret_group_id,omitempty"`
}

func HandleNotification(w http.ResponseWriter, r *http.Request) {
	log.Println("HandleNotification route called")
	var n Notification

	err := json.NewDecoder(r.Body).Decode(&n)
	if err != nil {
		log.Println("could not decode the notification")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("notification received with ID %s and type %s", n.ID, n.Type)

	secretId := n.Data.Secrets[0].ID

	log.Printf("secret with secret ID %s will be rotated", secretId)

	// Create Sample Service
	svc := CreateService()

	// Get update Secret from Secrets Manager
	secret, response, err := svc.GetSecretFromSM(secretId)
	if err != nil {
		w.WriteHeader(response.StatusCode)
		fmt.Fprintf(w, "couldn't get the secret from SM")
		return
	}

	// Update Secret into the cluster
	response, err = svc.UpdateSecretInCluster(secret)
	if err != nil {
		log.Println("Couldn't update the secret in CE project")
		w.WriteHeader(response.StatusCode)
		fmt.Fprintf(w, "Secret couldn't be updated")
		return
	}

	//As a response, we will write secret updated in cluster and set status as 201.
	log.Println("Request processed successfully")
	w.WriteHeader(http.StatusCreated)
	fmt.Fprintf(w, "Secret Updated in the project")
}

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/", HandleNotification)
	http.ListenAndServe(":8080", r)
}

func CreateService() *Service {
	authenticator := &core.IamAuthenticator{
		ApiKey: os.Getenv("IAM_API_KEY"),
		URL:    "https://iam.cloud.ibm.com",
	}
	return &Service{
		SMClient: NewSecretManagerService(authenticator),
		CEClient: NewCodeEngineService(authenticator),
		ENClient: NewEventNotificationsService(authenticator),
	}
}

func NewCodeEngineService(authenticator *core.IamAuthenticator) *ce.CodeEngineV2 {
	region := os.Getenv("CE_REGION")
	codeEngineService, err := ce.NewCodeEngineV2(&ce.CodeEngineV2Options{
		Authenticator: authenticator,
		URL:           "https://api." + region + ".codeengine.cloud.ibm.com/v2",
	})
	if err != nil {
		log.Printf("NewCodeEngineV2 error: %v\n", err.Error())
		os.Exit(1)
	}
	log.Println("Code Engine Service Created")
	return codeEngineService
}

func NewSecretManagerService(authenticator *core.IamAuthenticator) *sm.SecretsManagerV2 {
	smOptions := &sm.SecretsManagerV2Options{
		URL:           os.Getenv("SM_ENDPOINT"),
		Authenticator: authenticator,
	}

	secretsManagerClient, err := sm.NewSecretsManagerV2(smOptions)
	if err != nil {
		log.Println("could not create the SM service")
		os.Exit(1)
	}

	log.Println("Secrets Manager service created")
	return secretsManagerClient
}

func NewEventNotificationsService(authenticator *core.IamAuthenticator) *en.EventNotificationsV1 {
	region := os.Getenv("EN_REGION")
	options := &en.EventNotificationsV1Options{
		Authenticator: authenticator,
		URL:           "https://" + region + ".event-notifications.cloud.ibm.com/event-notifications",
	}
	eventNotificationsService, err := en.NewEventNotificationsV1(options)
	if err != nil {
		log.Println("could not create the EN service")
		os.Exit(1)
	}
	log.Println("Event Notification service created")
	return eventNotificationsService
}

func (svc *Service) GetSecretFromSM(id string) (*sm.ImportedCertificate, *core.DetailedResponse, error) {
	getOptions := svc.SMClient.NewGetSecretOptions(id)
	secretResult, resp, err := svc.SMClient.GetSecret(getOptions)
	if err != nil {
		log.Println(err.Error())
		return nil, resp, err
	}

	certificate, ok := secretResult.(*sm.ImportedCertificate)
	if !ok {
		log.Println("failed to cast to PublicCertificate")
		return nil, resp, errors.New("failed to cast to PublicCertificate")
	}
	log.Println("got the secret successfully")
	return certificate, resp, nil
}

func (svc *Service) UpdateSecretInCluster(secret *sm.ImportedCertificate) (*core.DetailedResponse, error) {
	log.Println("Updating secret", *secret.Name)
	projectID := os.Getenv("CE_PROJECT_ID")
	replaceSecretOptions := &ce.ReplaceSecretOptions{
		ProjectID: core.StringPtr(projectID),
		Name:      core.StringPtr(*secret.Name),
		IfMatch:   core.StringPtr("*"),
		Format:    core.StringPtr("tls"),
		Data: &ce.SecretDataTLSSecretData{
			TlsCert: core.StringPtr(*secret.Certificate),
			TlsKey:  core.StringPtr(*secret.PrivateKey),
		},
	}
	_, response, err := svc.CEClient.ReplaceSecret(replaceSecretOptions)
	if err != nil {
		return response, err
	}
	log.Println("Secret Updated Successfully")
	return response, nil
}
