"""Dynamic Skill Loader for LangChain Agent

This module discovers and loads skills from the skills/ directory.
Each skill is expected to have:
- A skill.md file with metadata (YAML frontmatter)
- An __init__.py file with the tool implementation
"""

import importlib
import os
from pathlib import Path
from typing import Any, Dict, List

import yaml


class SkillMetadata:
    """Represents metadata for a skill."""
    
    def __init__(self, data: Dict[str, Any]):
        self.name = data.get("name", "Unknown")
        self.description = data.get("description", "")
        self.version = data.get("version", "1.0.0")
        self.category = data.get("category", "general")
        self.parameters = data.get("parameters", [])
    
    def __repr__(self):
        return f"SkillMetadata(name={self.name}, category={self.category}, version={self.version})"


class Skill:
    """Represents a loaded skill with metadata and tool."""
    
    def __init__(self, name: str, metadata: SkillMetadata, tool: Any):
        self.name = name
        self.metadata = metadata
        self.tool = tool
    
    def __repr__(self):
        return f"Skill(name={self.name}, tool={self.tool.__name__ if hasattr(self.tool, '__name__') else 'unknown'})"


def parse_skill_metadata(skill_md_path: Path) -> SkillMetadata:
    """Parse skill.md file and extract YAML frontmatter metadata.
    
    Args:
        skill_md_path: Path to the skill.md file
    
    Returns:
        SkillMetadata object with parsed metadata
    """
    with open(skill_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract YAML frontmatter (between --- markers)
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            yaml_content = parts[1].strip()
            metadata_dict = yaml.safe_load(yaml_content)
            return SkillMetadata(metadata_dict)
    
    # Return empty metadata if no frontmatter found
    return SkillMetadata({})


def load_skill(skill_dir: Path) -> Skill:
    """Load a single skill from a directory.
    
    Args:
        skill_dir: Path to the skill directory
    
    Returns:
        Skill object with metadata and tool
    
    Raises:
        ImportError: If skill module cannot be imported
        FileNotFoundError: If required files are missing
    """
    skill_name = skill_dir.name
    skill_md_path = skill_dir / "skill.md"
    
    # Check if skill.md exists
    if not skill_md_path.exists():
        raise FileNotFoundError(f"skill.md not found in {skill_dir}")
    
    # Parse metadata
    metadata = parse_skill_metadata(skill_md_path)
    
    # Import the skill module
    module_path = f"skills.{skill_name}"
    try:
        skill_module = importlib.import_module(module_path)
    except ImportError as e:
        raise ImportError(f"Failed to import skill module {module_path}: {e}")
    
    # Get the tool from the module
    # Convention: the tool function has the same name as the directory (with underscores)
    tool_name = skill_name  # e.g., "weather_forecast"
    
    if not hasattr(skill_module, tool_name):
        raise AttributeError(f"Skill module {module_path} does not have a '{tool_name}' function")
    
    tool = getattr(skill_module, tool_name)
    
    return Skill(name=skill_name, metadata=metadata, tool=tool)


def discover_skills(skills_dir: Path = None) -> List[Skill]:
    """Discover and load all skills from the skills directory.
    
    Args:
        skills_dir: Path to the skills directory (defaults to ./skills)
    
    Returns:
        List of loaded Skill objects
    """
    if skills_dir is None:
        # Default to skills/ directory relative to this file
        current_dir = Path(__file__).parent
        skills_dir = current_dir / "skills"
    
    if not skills_dir.exists():
        print(f"Warning: Skills directory not found at {skills_dir}")
        return []
    
    skills = []
    
    # Iterate through subdirectories in skills/
    for item in skills_dir.iterdir():
        if item.is_dir() and not item.name.startswith('_'):
            try:
                skill = load_skill(item)
                skills.append(skill)
                print(f"✓ Loaded skill: {skill.metadata.name} ({skill.name})")
            except Exception as e:
                print(f"✗ Failed to load skill from {item.name}: {e}")
    
    return skills


def get_tools_from_skills(skills: List[Skill]) -> List[Any]:
    """Extract LangChain tools from loaded skills.
    
    Args:
        skills: List of Skill objects
    
    Returns:
        List of LangChain tool objects
    """
    return [skill.tool for skill in skills]


def print_skills_summary(skills: List[Skill]) -> None:
    """Print a summary of loaded skills.
    
    Args:
        skills: List of Skill objects
    """
    print("\n" + "=" * 60)
    print(f"Loaded {len(skills)} skill(s):")
    print("=" * 60)
    
    for skill in skills:
        print(f"\n📦 {skill.metadata.name}")
        print(f"   Category: {skill.metadata.category}")
        print(f"   Version: {skill.metadata.version}")
        print(f"   Description: {skill.metadata.description}")
    
    print("\n" + "=" * 60 + "\n")


# Example usage
if __name__ == "__main__":
    # Test the skill loader
    skills = discover_skills()
    print_skills_summary(skills)
    
    # Get tools for LangChain
    tools = get_tools_from_skills(skills)
    print(f"Extracted {len(tools)} tool(s) for LangChain agent")

# Made with Bob
