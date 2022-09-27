// Copyright 2022 IBM Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package main

import (
	"log"
	"text/template"
	"time"

	"github.com/IBM/go-sdk-core/v5/core"
	"github.com/IBM/platform-services-go-sdk/globaltaggingv1"
	"github.com/IBM/vpc-go-sdk/vpcv1"
	"github.com/pkg/errors"
)

const (
	cloudConfigTemplateFilePath = "templates/cloud-config-template.tmpl"
)

var vsiStartTime time.Time

func ExecuteJob(apiKey string, conf Config) error {
	cloudConfigTemplate, err := template.ParseFiles(cloudConfigTemplateFilePath)
	if err != nil {
		return errors.Errorf("Error while parsing cloud config template: %s", err)
	}

	userData, err := CreateCloudConfigFromTemplate(&conf, cloudConfigTemplate)
	if err != nil {
		return errors.Errorf("Error while generating cloud config: %s", err)
	}

	vpcService, err := instantiateVpcService(apiKey, conf.Region)
	if err != nil {
		return errors.Errorf("Error creating VPC Service: %s", err)
	}

	instance, response, err := createInstance(vpcService, conf, userData, conf.SshKeyID)
	if err != nil {
		return errors.Errorf("Failed to create VSI: %s \nVPC API response: %s", err, response)
	}

	vsiStartTime = time.Now()

	if conf.FloatingIpNamePrefix != "" {
		floatingIP, response, err := createFloatingIp(conf.FloatingIPName, conf.ZoneName, vpcService)
		if err != nil {
			return errors.Errorf("Failed to create Floating IP: %s\nAPI response: %s", err, response)
		}

		log.Printf("[INFO] Created floating ip: %s\n", *floatingIP.Address)

		floatingIP, response, err = addFloatingIpToVSI(*floatingIP.ID, *instance.ID, *instance.PrimaryNetworkInterface.ID, vpcService)
		if err != nil {
			return errors.Errorf("Error while adding floating ip to instance: %s\nAPI response: %s", err, response)
		}

		log.Printf("[INFO] Added floating ip '%s' to VSI '%s'\n", *floatingIP.Name, *instance.Name)
	}

	err = attachTags(apiKey, conf.VsiTags, instance)
	if err != nil {
		return errors.Errorf("Failed to attach tags to vsi: %v \nError: %s", conf.VsiTags, err)
	}

	err = manageVSILifecycle(vpcService, instance, time.Duration(10)*time.Second, conf.DeleteVsiAfterExecution, conf.VsiStartTimeout)
	if err != nil {
		return errors.Errorf("Error during management of VSI lifecycle: %s", err)
	}

	return nil
}

func instantiateVpcService(apiKey, region string) (vpcService *vpcv1.VpcV1, err error) {
	vpcService, err = vpcv1.NewVpcV1(&vpcv1.VpcV1Options{
		Authenticator: &core.IamAuthenticator{
			ApiKey: apiKey,
		},
		URL: "https://" + region + ".iaas.cloud.ibm.com/v1",
	})
	return
}

func createInstance(vpcService *vpcv1.VpcV1, conf Config, userData string, sshKeyID string) (instance *vpcv1.Instance, response *core.DetailedResponse, err error) {
	instancePrototype := &vpcv1.InstancePrototype{
		Image: &vpcv1.ImageIdentity{
			ID: &conf.Image,
		},
		Zone: &vpcv1.ZoneIdentity{
			Name: &conf.ZoneName,
		},
		Profile: &vpcv1.InstanceProfileIdentity{
			Name: &conf.Profile,
		},
		Name: &conf.Name,
		VPC: &vpcv1.VPCIdentity{
			ID: &conf.VpcID,
		},
		PrimaryNetworkInterface: &vpcv1.NetworkInterfacePrototype{
			Subnet: &vpcv1.SubnetIdentity{
				ID: &conf.SubnetID,
			}},
		UserData: &userData,
	}

	if sshKeyID != "" {
		log.Printf("[INFO] SSH key ID '%s' will be added to the VSI\n", sshKeyID)

		keyObjects := make([]vpcv1.KeyIdentityIntf, 1)
		keyObjects[0] = &vpcv1.KeyIdentity{
			ID: &sshKeyID,
		}

		instancePrototype.Keys = keyObjects
	}

	options := &vpcv1.CreateInstanceOptions{
		InstancePrototype: instancePrototype,
	}

	instance, response, err = vpcService.CreateInstance(options)
	if err != nil {
		return
	}

	log.Printf("[INFO] Instance created. Name: %s ID: %s", *instance.Name, *instance.ID)
	return
}

func createFloatingIp(floatingIPName, zoneName string, vpcService *vpcv1.VpcV1) (floatingIP *vpcv1.FloatingIP, response *core.DetailedResponse, err error) {
	optionsFloatingIP := &vpcv1.CreateFloatingIPOptions{}
	optionsFloatingIP.SetFloatingIPPrototype(&vpcv1.FloatingIPPrototype{
		Name: &floatingIPName,
		Zone: &vpcv1.ZoneIdentity{
			Name: &zoneName,
		},
	})
	return vpcService.CreateFloatingIP(optionsFloatingIP)
}

func addFloatingIpToVSI(floatingIpId, instanceID, networkInterfaceID string, vpcService *vpcv1.VpcV1) (result *vpcv1.FloatingIP, response *core.DetailedResponse, err error) {
	options := &vpcv1.AddInstanceNetworkInterfaceFloatingIPOptions{}
	options.SetID(floatingIpId)
	options.SetInstanceID(instanceID)
	options.SetNetworkInterfaceID(networkInterfaceID)

	return vpcService.AddInstanceNetworkInterfaceFloatingIP(options)
}

func attachTags(apiKey string, vsiTags []string, instance *vpcv1.Instance) (err error) {
	taggingServiceClientOptions := &globaltaggingv1.GlobalTaggingV1Options{
		URL: "https://tags.global-search-tagging.cloud.ibm.com",
		Authenticator: &core.IamAuthenticator{
			ApiKey: apiKey,
		},
	}

	taggingServiceClient, err := globaltaggingv1.NewGlobalTaggingV1UsingExternalConfig(taggingServiceClientOptions)
	if err != nil {
		return errors.Errorf("Error creating service client: %s", err)
	}

	resourceToTag := &globaltaggingv1.Resource{
		ResourceID: instance.CRN,
	}

	attachTagOptions := taggingServiceClient.NewAttachTagOptions(
		[]globaltaggingv1.Resource{*resourceToTag},
	)

	vsiTags = append(vsiTags, "CE_BATCH_VSI")
	attachTagOptions.SetTagNames(vsiTags)
	attachTagOptions.SetTagType("user")

	_, _, err = taggingServiceClient.AttachTag(attachTagOptions)
	if err != nil {
		return errors.Errorf("Error Attaching tags to VSI: %s", *instance.Name)
	}

	log.Printf("[INFO] Successfully added tags:  %+v\n", vsiTags)

	return
}

func manageVSILifecycle(vpcService *vpcv1.VpcV1, instance *vpcv1.Instance, pollInterval time.Duration, deleteVsiAfterExecution bool, vsiStartTimeout int) error {
	for {
		instance, response, err := getStatusOfVSI(vpcService, instance)
		if err != nil && instance == nil {
			log.Printf("[WARNING] Retrieving instance '%s' with error: %s\nAPI response: %s", *instance.Name, err, response)
			continue // Continue as this could be a temporary hickup
		}

		log.Printf("[INFO] Current status of VSI - %s", *instance.Status)

		if isInstanceFinished(instance) {
			log.Printf("[INFO] VSI instance '%s' finished execution. Stopping...", *instance.Name)

			if deleteVsiAfterExecution {
				return deleteInstance(vpcService, instance)
			}

			return nil
		}

		if isInstanceStuck(instance, vsiStartTimeout) {
			if deleteVsiAfterExecution {
				return deleteInstance(vpcService, instance)
			}

			return errors.Errorf("Failing the job index as the VSI is in hanging state %s", *instance.Name)
		}

		log.Printf("[INFO] Waiting %s for resource to change status.", pollInterval)

		time.Sleep(pollInterval)
	}
}

func getStatusOfVSI(vpcService *vpcv1.VpcV1, instance *vpcv1.Instance) (*vpcv1.Instance, *core.DetailedResponse, error) {
	options := &vpcv1.GetInstanceOptions{
		ID: instance.ID,
	}

	return vpcService.GetInstance(options)
}

func isInstanceFinished(instance *vpcv1.Instance) bool {
	return *instance.Status == vpcv1.InstanceStatusStoppedConst
}

func isInstanceStuck(instance *vpcv1.Instance, vsiStartTimeout int) bool {
	return *instance.Status == vpcv1.InstanceStatusStartingConst && isStartTimeoutElapsed(vsiStartTimeout)
}

func deleteInstance(vpcService *vpcv1.VpcV1, instance *vpcv1.Instance) error {
	log.Printf("[INFO] Deleting VSI '%s'\n", *instance.Name)

	options := &vpcv1.DeleteInstanceOptions{
		ID: instance.ID,
	}

	response, err := vpcService.DeleteInstance(options)
	if err != nil {
		return errors.Errorf("Error while deleting VSI '%s': %s\nAPI response: %s", *instance.Name, err, response)
	}

	return nil
}

func isStartTimeoutElapsed(vsiStartTimeout int) bool {
	elapsed := time.Since(vsiStartTime)
	return int(elapsed.Minutes()) > vsiStartTimeout
}
