#!/bin/bash

source .env

echo "Creating code engine project"
ibmcloud ce project create --name travel-concierge-project

echo "Selecting code engine project"
ibmcloud ce project select --name travel-concierge-project -k

NAMESPACE=$(ibmcloud ce project current -o json | jq -r '.kube_config_context')

# ibmcloud ce app create --name ollama-qwen3 --build-source ./ollama --build-strategy dockerfile --cpu 12 --memory 48G -p 11434  --wait-timeout 3600 --es 48G --min-scale 1 --visibility public

echo "Creating code engine secret for the agents with parameters from .env file"
ibmcloud ce secret create --name agent-secret --from-literal INFERENCE_BASE_URL="$INFERENCE_BASE_URL" \
--from-literal INFERENCE_API_KEY="$INFERENCE_API_KEY" \
--from-literal INFERENCE_MODEL_NAME="$INFERENCE_MODEL_NAME" \
--from-literal INFERENCE_PROJECT_ID="$INFERENCE_PROJECT_ID"

echo "Creating code engine configmap for the concierge agent to connect to the other agents"
ibmcloud ce configmap create --name concierge-config \
--from-literal AGENT_CITY_SELECTION_URL=http://city-selection-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_CITY_SELECTION_NAME="City_Selection_Expert" \
--from-literal AGENT_BUDGET_PLANNER_URL=http://budget-planner-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_BUDGET_PLANNER_NAME="Budget_Planner" \
--from-literal AGENT_CITY_EXPERT_URL=http://city-expert-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_CITY_EXPERT_NAME="City_Expert" \
--from-literal AGENT_HOTEL_PLANNER_URL=http://hotel-planner-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_HOTEL_PLANNER_NAME="Hotel_Planner" \
--from-literal AGENT_FLIGHT_PLANNER_URL=http://flight-planner-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_FLIGHT_PLANNER_NAME="Flight_Planner" \
--from-literal AGENT_ITINERARY_PLANNER_URL=http://itinerary-planner-agent.$NAMESPACE.svc.cluster.local \
--from-literal AGENT_ITINERARY_PLANNER_NAME="Itinerary_Planner"

echo "Creating code engine applications for agents with private visibility"
ibmcloud ce app create --name budget-planner-agent --env-from-secret agent-secret --build-source ./agents/budget_planner_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait
ibmcloud ce app create --name city-expert-agent --env-from-secret agent-secret --build-source ./agents/city_expert_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait
ibmcloud ce app create --name city-selection-agent --env-from-secret agent-secret --build-source ./agents/city_selection_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait
ibmcloud ce app create --name flight-planner-agent --env-from-secret agent-secret --build-source ./agents/flight_planner_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait
ibmcloud ce app create --name itinerary-planner-agent --env-from-secret agent-secret --build-source ./agents/itinerary_planner_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait
ibmcloud ce app create --name travel-concierge-agent --env-from-secret agent-secret --env-from-configmap concierge-config --build-source ./agents/travel_concierge_agent --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility project --no-wait

echo "Creating code engine applications for the chat UI with a public endpoint"
ibmcloud ce app create --name travel-concierge-chat --env AGENTS_CATALOG=http://travel-concierge-agent.$NAMESPACE.svc.cluster.local --build-source ./ui/chat --build-strategy dockerfile  --cpu 1 --memory 4G -p 8080  --wait-timeout 600 --min-scale 1 --visibility public

while true; do
    ibmcloud ce app list
    not_ready_apps=$(ibmcloud ce app list | grep -e "agent" -e "chat" | grep "Not Ready")
    if [  "$not_ready_apps" == "" ]; then
      break # all apps are ready
    fi
    echo "Waiting for all applications to be ready (sleep 15s)..."
    sleep 15
done

echo -e "\nAll applications are ready.\n"
echo "Use the travel-concierge-chat application to chat with the agents:"
ibmcloud ce app get --name travel-concierge-chat -o json | jq -r '.status.url'