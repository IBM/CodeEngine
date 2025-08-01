import json
import os

from utils.core import config
from utils.core import streamlit as st

config = None  # noqa: F811
config_file_path = "config.json"


async def initialize():
    application_config = load()

    try:
        st.set_page_config(
            page_title=application_config.get("title"),
            page_icon=application_config.get("icon"),
            layout="wide",
            initial_sidebar_state="expanded",
        )
    except Exception:
        pass

    st.logo(
        "public/icons/ibm-cloud--code-engine.svg",
        icon_image="public/icons/ibm-cloud--code-engine.svg",
        # link="/",
    )

    st.session_state["agents_catalog"] = [item.strip() for item in os.getenv("AGENTS_CATALOG", "").split(",")]


def load():
    global config

    if config:
        return config
    else:
        try:
            with open(config_file_path, "r") as json_file:
                config = json.load(json_file)
        except FileNotFoundError:
            print(f"The file at {config_file_path} does not exist.")
        except json.JSONDecodeError:
            print(f"Failed to decode JSON from the file at {config_file_path}.")

        return config
