# LangChain Skills Agent - Source Code

This directory contains the source code for the LangChain Skills Agent.

## Structure

```
src/
├── main.py              # FastAPI application and agent entrypoint
├── agents.py            # LangChain agent configuration and LLM setup
├── skill_loader.py      # Dynamic skill discovery and loading system
├── pyproject.toml       # Python dependencies
├── Dockerfile           # Container build configuration
├── ruff.toml            # Code linting configuration
├── skills/              # Skills directory (auto-discovered)
│   ├── weather_forecast/
│   ├── travel_recommendations/
│   └── currency_converter/
└── frontend/            # Web UI components
    ├── __init__.py
    └── landing_page.py
```

## Key Files

### `main.py`
- FastAPI application setup
- ACP SDK integration
- Agent endpoint implementation
- Health check and info endpoints

### `agents.py`
- LLM configuration (ChatOpenAI)
- Agent prompt template
- Agent executor creation
- Configuration management

### `skill_loader.py`
- Automatic skill discovery
- Metadata parsing from `skill.md` files
- Dynamic module importing
- Tool registration with LangChain

### `skills/`
Each skill directory contains:
- `skill.md`: Metadata and documentation (YAML frontmatter)
- `__init__.py`: Tool implementation using `@tool` decorator

## Development

### Install Dependencies

```bash
# Using pip
pip install -e .

# Using uv (recommended)
uv sync
```

### Run Locally

```bash
python main.py
```

The agent will be available at `http://localhost:8080`

### Add a New Skill

1. Create a new directory in `skills/`
2. Add `skill.md` with metadata
3. Add `__init__.py` with tool implementation
4. Restart the agent - it will be auto-discovered!

See the main README.md for detailed instructions.