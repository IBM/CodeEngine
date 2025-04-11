# create a cos instance
resource "ibm_resource_instance" "cos_instance" {
  name = "cos-instance"
  resource_group_id = var.resource_group
  plan = "standard"
  service = "cloud-object-storage"
  location = "global"
}

# create cos-credentials for cos access
resource "ibm_resource_key" "cos-credentials" {
  name = "cos-credentials"
  resource_instance_id = ibm_resource_instance.cos_instance.id
  parameters = {"HMAC" = true}
}

locals {
  resource_credentials =jsondecode(ibm_resource_key.cos-credentials.credentials_json)
}

# create cos-but to upload 
resource "ibm_cos_bucket" "cos_bucket" {
  bucket_name = "fotobox-bucket"
  resource_instance_id = ibm_resource_instance.cos_instance.id
  region_location = "us-south"
  storage_class = "smart"
}

# create code engine project
# set region at provider
resource "ibm_code_engine_project" "ce-fotobox-project" {
  name = "codeengine-fotobox-project"
  resource_group_id = var.resource_group
}

# create secret in project

resource "ibm_code_engine_secret" "fotobox-secret" {
  project_id = ibm_code_engine_project.ce-fotobox-project.id
  name = "fotobox-secret"
  format = "generic"
  
  data = {
    "apikey" = local.resource_credentials.apikey
  }
}

resource "ibm_code_engine_secret" "registry_secret" {
  project_id = ibm_code_engine_project.ce-fotobox-project.id
  name       = "container-registry-secret"
  format = "registry"
  data = {
    "username" = "iamapikey" # Use 'iamapikey' as username for IBM Cloud
    "password" = var.icr_secret
    "server"   = "us.icr.io" # Change if using a different registry
  }
}

# create config map in project

resource "ibm_code_engine_config_map" "fotobox-config" {
  name = "fotobox-config"
  project_id = ibm_code_engine_project.ce-fotobox-project.id
  data = {
    "bucket" = ibm_cos_bucket.cos_bucket.bucket_name
    "endpointURL" = ibm_cos_bucket.cos_bucket.s3_endpoint_private
    "imageprefix" = "my-event-"
    "password" = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
    "region" = ibm_cos_bucket.cos_bucket.region_location
    "resource_instance_id" = local.resource_credentials.resource_instance_id
  }
}