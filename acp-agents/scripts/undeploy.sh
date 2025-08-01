#!/bin/sh

echo "Deleting code engine project"
ibmcloud ce project delete --name travel-concierge-project --force --hard --wait