# job2vsi demo

The sample shows how a job can be used to spawn [Virtual Server Instances (VSIs)]((https://www.ibm.com/cloud/virtual-servers)) in your IBM Cloud account and run workload on them. There are various configuration options for VPC, VSI image, VSI flavour and customization commands to adapt the workload execution.

## Setup

You need to have a [Virtual private cloud](https://cloud.ibm.com/vpc-ext/network/vpcs) (VPC) in your account.

Export an API KEY which is allowed to access your VPC. E.g.:

`export IBMCLOUD_API_KEY=<api key>`

before running the `run` script.

### Tools
- ibmcloud cli with codengine (ce) and vpc-infrastructure (is) plugins. Make sure you use the latest versions
- optional: docker to run the `build` script (alternatively, you can use a prebuilt image provided in the IBM registry)


# How to use the sample

The `run` script will run the sample based on the configuration in [config.yaml](config.yaml). Before executing the `run` script, you need to go through [config.yaml](config.yaml) and add the IDs of your VPC, region, VSI image etc. to be used. In addition, you can customize the workload execution to your needs, the sample config contains a simple `echo "${CE_JOBRUN} ${JOB_INDEX}"` command. All configuration options which require updates are marked with "TODO" - e.g.:

```yaml
# TODO: add the id of your VPC
# list available vpcs: `ibmcloud is vpcs`
vpc_id: "r038-690ee3d2-23e2-4d5f-83b6-f7b13b3281ca"
```

You can adjust other config options according to your needs.

Note: it is not necessary to run the `build` script, the `run` script defaults to a prebuilt container image.

What the sample does - in a nutshell:

1. create a secret for the API KEY
1. create a config map for the `config.yaml`
1. create a job which uses the referenced container image, API KEY and config map
1. run that job
    1. the job will use the VPC API to create a VSI based on the `config.yaml`; the VSI will be configured via cloud init.
    1. environment variables from the job will be forwarded to the VSI
    1. the workload commands will be invoked. Once all commands are executed the VSI will be shutdown
    1. the job monitors the VSI and deprovisions the VSI, once the workload completed

## Debugging on the VSI

By default, the job will delete the VSIs once the workload is complete. You can disable the deprovisioning step in [config.yaml](config.yaml) by setting  `delete_vsi_after_execution` to `false`. However, you need to delete the VSI manually in this case. See the cleanup section for details.

In order to
be able to login to the VSI you can [create an SSH key in your VPC](https://cloud.ibm.com/vpc-ext/compute/sshKeys). Then you will need to provide the id of that key in
[config.yaml](config.yaml) via `ssh_key_id`. If a ssh key is provided, it will be configured to allow you to login as root user. 

You can attach a floating ip to your VSI by setting `floating_ip_name_prefix` in
the [config.yaml](config.yaml). However, floating ips need manual cleanup. See the cleanup section for details.

Then you can ssh to your VSI by using the following command:

```
ssh -i <path to the private key > -l root <floating ip>
```

# Cleanup

You can run `run clean` to cleanup all artifacts the run script created.

If you attached floating ips to your VSIs by setting the `floating_ip_name_prefix` parameter, then you have to manually release the floating ips, again.

If you set `delete_vsi_after_execution` to `false`, then you have to delete the VSI by yourself.


- - -

As noted in [the main README](../README.md), this sample has two pieces:

- a `build` script which will build the container image used
- a `run` script which deploys resources that use this container image

The main purpose of this example is the `run` script, but the `build`
script is included for complete educational (and reuse) purposes.
