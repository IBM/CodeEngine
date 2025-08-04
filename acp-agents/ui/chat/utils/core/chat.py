import httpx
from acp_sdk.client import Client
from acp_sdk.models import (
    Message,
    MessagePart,
)
from utils.core import streamlit as st


async def initialize() -> None:
    agents = []
    agentsMap = {}

    for agent_url in st.session_state["agents_catalog"]:
        try:
            response = httpx.get(f"{agent_url}/agents")
            body = response.json()

            agent_list = [agent.get("name") for agent in body.get("agents")]
            for agent_name in agent_list:
                agentsMap[agent_name] = agent_url

            agents.extend(agent_list)
        except Exception as e:
            print(f"Connection to {agent_url} failed:", e)

    with st.sidebar:
        st.markdown("## Available Agents")

        agent = st.selectbox("Select your Agent", agents)

        st.session_state["agent_id"] = agent
        st.session_state["agent_url"] = []

    # Ensuring that there is a message list in the session state for storing conversation history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    with st.chat_message("assistant"):
        st.markdown("Hello, I'm your personal Travel assistant. How can I help you?")

    # Displaying each message in the session state using Streamlit's chat message display
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Handling user input through Streamlit's chat input box
    if prompt := st.chat_input("Write something..."):
        # Appending the user's message to the session state
        st.session_state.messages.append({"role": "human", "content": prompt})

        # Displaying the user's message in the chat interface
        with st.chat_message("human"):
            st.markdown(prompt)

        # Preparing to display the assistant's response
        with st.chat_message("assistant"):
            message_placeholder = st.empty()  # Placeholder for assistant's response
            full_response = ""  # Initializing a variable to store the full response

            url = agentsMap[agent]

            async with Client(base_url=url) as client:
                async for event in client.run_stream(
                    agent=agent,
                    input=[Message(parts=[MessagePart(content=prompt)])],
                ):
                    try:
                        full_response += "\n\n  " + event.part.content + "  " or ""
                        message_placeholder.markdown(full_response + "▌")  # Displaying the response as it's being 'typed'
                    except Exception:
                        pass

                message_placeholder.markdown(full_response)

        # Appending the assistant's response to the session's message list
        st.session_state.messages.append({"role": "assistant", "content": full_response})
