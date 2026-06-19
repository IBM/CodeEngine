"""Tests for skill_loader module"""

import os
import tempfile
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch


class TestSkillMetadata:
    def test_basic_init(self):
        from skill_loader import SkillMetadata

        data = {
            "name": "test_skill",
            "description": "A test skill",
            "version": "2.0.0",
            "category": "weather",
            "parameters": ["param1"],
        }
        meta = SkillMetadata(data)
        assert meta.name == "test_skill"
        assert meta.description == "A test skill"
        assert meta.version == "2.0.0"
        assert meta.category == "weather"
        assert meta.parameters == ["param1"]

    def test_default_values(self):
        from skill_loader import SkillMetadata

        meta = SkillMetadata({})
        assert meta.name == "Unknown"
        assert meta.description == ""
        assert meta.version == "1.0.0"
        assert meta.category == "general"
        assert meta.parameters == []

    def test_repr(self):
        from skill_loader import SkillMetadata

        meta = SkillMetadata({"name": "test", "category": "cat", "version": "1.0"})
        assert "SkillMetadata" in repr(meta)
        assert "test" in repr(meta)


class TestSkill:
    def test_basic_init(self):
        from skill_loader import Skill, SkillMetadata

        meta = SkillMetadata({"name": "test_skill"})
        tool = MagicMock()
        skill = Skill(name="test_skill", metadata=meta, tool=tool)
        assert skill.name == "test_skill"
        assert skill.metadata == meta
        assert skill.tool == tool

    def test_repr_with_callable(self):
        from skill_loader import Skill, SkillMetadata

        def my_tool():
            pass

        meta = SkillMetadata({"name": "test"})
        skill = Skill(name="test", metadata=meta, tool=my_tool)
        assert "my_tool" in repr(skill)


class TestParseSkillMetadata:
    def test_with_yaml_frontmatter(self):
        import yaml
        from skill_loader import parse_skill_metadata

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\nname: test_skill\ndescription: A test\ncategory: weather\n---\n# Body content\n")
            temp_path = f.name

        try:
            meta = parse_skill_metadata(Path(temp_path))
            assert meta.name == "test_skill"
            assert meta.description == "A test"
            assert meta.category == "weather"
        finally:
            os.unlink(temp_path)

    def test_without_frontmatter(self):
        from skill_loader import parse_skill_metadata

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("# No frontmatter here\nJust content")
            temp_path = f.name

        try:
            meta = parse_skill_metadata(Path(temp_path))
            assert meta.name == "Unknown"
        finally:
            os.unlink(temp_path)

    def test_empty_file(self):
        from skill_loader import parse_skill_metadata

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("")
            temp_path = f.name

        try:
            meta = parse_skill_metadata(Path(temp_path))
            assert meta.name == "Unknown"
        finally:
            os.unlink(temp_path)

    def test_frontmatter_single_delimiter(self):
        from skill_loader import parse_skill_metadata

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\nname: incomplete")
            temp_path = f.name

        try:
            meta = parse_skill_metadata(Path(temp_path))
            assert meta.name == "Unknown"
        finally:
            os.unlink(temp_path)


class TestLoadSkill:
    def test_successful_load(self):
        import sys
        import importlib
        from skill_loader import load_skill, Skill

        with tempfile.TemporaryDirectory() as tmpdir:
            skill_dir = Path(tmpdir) / "test_skill"
            skill_dir.mkdir()

            (skill_dir / "skill.md").write_text("---\nname: Test Skill\ndescription: Test desc\n---\n# Body")
            (skill_dir / "__init__.py").write_text("")

            def test_skill_func():
                return "hello"

            mock_module = MagicMock()
            mock_module.test_skill = test_skill_func
            with patch("importlib.import_module", return_value=mock_module):
                skill = load_skill(skill_dir)
                assert isinstance(skill, Skill)
                assert skill.name == "test_skill"
                assert skill.metadata.name == "Test Skill"

    def test_missing_skill_md(self):
        from skill_loader import load_skill

        with tempfile.TemporaryDirectory() as tmpdir:
            skill_dir = Path(tmpdir) / "missing_md"
            skill_dir.mkdir()
            with pytest.raises(FileNotFoundError, match="skill.md"):
                load_skill(skill_dir)

    def test_import_error(self):
        from skill_loader import load_skill

        with tempfile.TemporaryDirectory() as tmpdir:
            skill_dir = Path(tmpdir) / "bad_import"
            skill_dir.mkdir()
            (skill_dir / "skill.md").write_text("---\nname: Test\n---\n")
            (skill_dir / "__init__.py").write_text("")

            with patch("importlib.import_module", side_effect=ImportError("Bad import")):
                with pytest.raises(ImportError, match="Failed to import"):
                    load_skill(skill_dir)

    def test_missing_tool_attribute(self):
        from skill_loader import load_skill

        with tempfile.TemporaryDirectory() as tmpdir:
            skill_dir = Path(tmpdir) / "no_tool"
            skill_dir.mkdir()
            (skill_dir / "skill.md").write_text("---\nname: Test\n---\n")
            (skill_dir / "__init__.py").write_text("")

            mock_module = MagicMock(spec=[])
            with patch("importlib.import_module", return_value=mock_module):
                with pytest.raises(AttributeError):
                    load_skill(skill_dir)


class TestDiscoverSkills:
    def test_empty_skills_dir(self):
        from skill_loader import discover_skills

        with tempfile.TemporaryDirectory() as tmpdir:
            skills_dir = Path(tmpdir)
            result = discover_skills(skills_dir)
            assert result == []

    def test_skips_underscore_dirs(self):
        from skill_loader import discover_skills

        with tempfile.TemporaryDirectory() as tmpdir:
            skills_dir = Path(tmpdir)
            (skills_dir / "__pycache__").mkdir()
            result = discover_skills(skills_dir)
            assert result == []

    def test_non_existent_dir(self):
        from skill_loader import discover_skills

        result = discover_skills(Path("/nonexistent/path"))
        assert result == []

    def test_loads_valid_skills(self):
        from skill_loader import discover_skills, Skill

        with tempfile.TemporaryDirectory() as tmpdir:
            skills_dir = Path(tmpdir)
            skill_dir = skills_dir / "my_skill"
            skill_dir.mkdir()
            (skill_dir / "skill.md").write_text("---\nname: My Skill\n---\n")
            (skill_dir / "__init__.py").write_text("")

            def my_skill_func():
                pass

            mock_module = MagicMock()
            mock_module.my_skill = my_skill_func

            with patch("importlib.import_module", return_value=mock_module):
                result = discover_skills(skills_dir)
                assert len(result) == 1
                assert isinstance(result[0], Skill)

    def test_handles_load_error(self):
        from skill_loader import discover_skills

        with tempfile.TemporaryDirectory() as tmpdir:
            skills_dir = Path(tmpdir)
            skill_dir = skills_dir / "bad_skill"
            skill_dir.mkdir()
            (skill_dir / "skill.md").write_text("---\nname: Bad\n---\n")
            (skill_dir / "__init__.py").write_text("")

            with patch("importlib.import_module", side_effect=ImportError("fail")):
                result = discover_skills(skills_dir)
                assert result == []


class TestGetToolsFromSkills:
    def test_extracts_tools(self):
        from skill_loader import get_tools_from_skills, Skill, SkillMetadata

        tool1 = MagicMock()
        tool2 = MagicMock()
        skills = [
            Skill("s1", SkillMetadata({"name": "s1"}), tool1),
            Skill("s2", SkillMetadata({"name": "s2"}), tool2),
        ]
        tools = get_tools_from_skills(skills)
        assert tools == [tool1, tool2]

    def test_empty_skills(self):
        from skill_loader import get_tools_from_skills

        assert get_tools_from_skills([]) == []


class TestPrintSkillsSummary:
    def test_empty(self, capsys):
        from skill_loader import print_skills_summary

        print_skills_summary([])
        captured = capsys.readouterr()
        assert "Loaded 0 skill(s)" in captured.out

    def test_with_skills(self, capsys):
        from skill_loader import print_skills_summary, Skill, SkillMetadata

        tool = MagicMock()
        skill = Skill(
            "test",
            SkillMetadata(
                {
                    "name": "Test Skill",
                    "category": "weather",
                    "version": "1.0",
                    "description": "A test",
                }
            ),
            tool,
        )
        print_skills_summary([skill])
        captured = capsys.readouterr()
        assert "Loaded 1 skill(s)" in captured.out
        assert "Test Skill" in captured.out
        assert "weather" in captured.out
