PWD := $(shell pwd)
CONTAINER_COMPOSE_FILE = $(PWD)/container-compose.yml

.PHONY: start-podman
start-podman:
	@echo "📦 Building container images"
	podman-compose --file ${CONTAINER_COMPOSE_FILE} build --no-cache;
	@echo "🚀 Starting containers"
	podman-compose --file ${CONTAINER_COMPOSE_FILE} --project-name travel-agents up -d;

.PHONY: stop-podman
stop-podman:
	podman-compose --file ${CONTAINER_COMPOSE_FILE} --project-name travel-agents down -v;

.PHONY: start-docker
start-docker:
	@echo "📦 Building container images"
	docker compose --file ${CONTAINER_COMPOSE_FILE} build;
	@echo "🚀 Starting containers"
	docker compose --file ${CONTAINER_COMPOSE_FILE} --project-name travel-agents up -d;

.PHONY: stop-docker
stop-docker:
	docker compose --file ${CONTAINER_COMPOSE_FILE} --project-name travel-agents down -v;

.PHONY: check
check: ## Run code quality tools
	@echo "🚀 Checking lock file consistency with 'pyproject.toml'"
	@uv lock --locked
	@echo "🚀 Linting code: Running pre-commit"
	@uv run pre-commit run -a
	@echo "🚀 Static type checking: Running mypy"
	@uv run mypy agents/travel_concierge_agent
	@uv run mypy agents/city_selection_agent
	@uv run mypy agents/flight_planner_agent
	@uv run mypy agents/hotel_planner_agent
	@uv run mypy agents/city_expert_agent
	@uv run mypy agents/itinerary_planner_agent

.PHONY: deploy-codeengine
deploy-codeengine:
	@echo "📦 Deploy agents to Code Engine"
	sh scripts/deploy.sh

.PHONY: undeploy-codeengine
undeploy-codeengine:
	@echo "📦 Undeploy agents from Code Engine"
	sh scripts/undeploy.sh



.PHONY: help
help:
	@uv run python -c "import re; \
	[[print(f'\033[36m{m[0]:<20}\033[0m {m[1]}') for m in re.findall(r'^([a-zA-Z_-]+):.*?## (.*)$$', open(makefile).read(), re.M)] for makefile in ('$(MAKEFILE_LIST)').strip().split()]"

.DEFAULT_GOAL := help
