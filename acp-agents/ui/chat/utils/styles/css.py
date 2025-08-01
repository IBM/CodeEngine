from utils.core import streamlit as st


def apply():
    st.write(
        """
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap');

            html, body, .appview-container *  {
                font-family: "IBM Plex Sans", sans-serif;
            }

            .reportview-container {
                margin-top: -2em;
            }
            #MainMenu {
                display:none;
                visibility: hidden;
            }
            .stAppDeployButton {
                display:none;
                visibility: hidden;
            }
            header #stDecoration {
                background-image: linear-gradient(90deg, rgb(82 100 255), rgb(60 240 255));
            }
            .stApp > header,
            .stApp > .stAppViewContainer,
            .stBottom > div {
                background-color: #161616;
            }
            .stMainBlockContainer {
                padding: 2rem;
            }

            .stBottom > div > div {
                padding: 2rem;
            }

            .stSidebar {
                background-color: #262626;
            }
            footer {visibility: hidden;}
            #stDecoration {display:none;}

            [data-testid=stSidebarHeader]::before,
            [data-testid=stSidebarHeader]::after {
                position: absolute;
                top: 1.25rem;
                display: block;
                font-size: 1.25rem;
                color: #fff;
                text-align: left;
            }

            [data-testid=stSidebarHeader]::before {
                content: "CE";
                left: 4rem;
                font-weight: 300;
            }

            [data-testid=stSidebarHeader]::after {
                content: "Travel Agency";
                left: 6rem;
                font-weight: 900;
            }

            .stBottom textarea {
                border-radius: initial;
                outline-offset: -2px;
                position: relative;
                display: block;
                background-color: #393939;
                padding-top: 12px;
                padding-left: 1rem;
                padding-right: 4rem;
                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.28572;
                letter-spacing: 0.16px;
                min-height: 42px;
                color: #fff;
            }

            .stBottom textarea::placeholder {
                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.28572;
                letter-spacing: 0.16px;
                color: #8D8D8D;
            }

            .stBottom textarea:focus,
            .stBottom textarea:active {
                outline: 2px solid #ffffff;
                outline-offset: -2px;
            }

            .stBottom .stChatInput,
            .stBottom .stChatInput [data-baseweb="textarea"] {
                border-radius: initial;
                border: none;
                border-color: none;
            }

            .stBottom .stChatInput > div {
                border: none;
                border-radius: 0;
                padding-left: 0;
            }

            .stNumberInput input,
            .stNumberInput [data-testid="stNumberInputStepDown"],
             .stNumberInput [data-testid="stNumberInputStepUp"] {
                background-color: #393939;
            }

            .stNumberInput input {
                padding-left: 1rem;
                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.28572;
                letter-spacing: 0.16px;
            }

            .stNumberInput [data-baseweb="input"] {
                height: 40px;
            }

            .stNumberInput div,
            .stNumberInput button,
            .stNumberInput button[data-testid="stNumberInputStepUp"],
            .stNumberInput [data-testid="stNumberInputContainer"] {
                border-radius: 0;
                border-color: transparent;
            }

            .stNumberInput [data-testid="stNumberInputContainer"]:focus-within {
                outline: 2px solid #ffffff;
                outline-offset: -2px;
            }

            .stSelectbox > div > div {
                border-radius: initial;
                outline-offset: -2px;
                position: relative;
                display: block;
                background-color: #393939;
                block-size: 2.5rem;
                color: #f4f4f4;
                cursor: pointer;
                inline-size: 100%;
                border-width: initial;
                border-style: none;
                border-color: initial;
                border-image: initial;
                border-block-end: 1px solid #8d8d8d;
                list-style: none;
                outline: transparent solid 2px;
                transition: background-color 70ms cubic-bezier(0.2, 0, 0.38, 0.9);

                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.28572;
                letter-spacing:  0.16px;
            }

            .stSelectbox:focus-within > div > div {
                outline: 2px solid #ffffff;
                outline-offset: -2px;
            }

            [data-baseweb="popover"] ul {
                background-color: #393939;
                border-radius: inherit;
            }

            [data-baseweb="popover"] ul li:hover {
                background-color: #474747;
            }

            [data-baseweb="popover"] ul li[aria-selected="true"] {
                background-color: #525252;
                border-block-end-color: #525252;
                color: #f4f4f4;
                outline: 2px solid #ffffff;
                outline-offset: -2px;
            }

            .stNumberInput > label p,
            .stSlider > label p,
            .stSelectbox > label p,
            .stMarkdown p > em {
                font-size: 0.75rem;
                font-weight: 400;
                line-height: 1.33333;
                letter-spacing: 0.32px;
                display: inline-block;
                color: #c6c6c6;
                font-weight: 400;
                line-height: 1rem;
                -webkit-margin-after: .5rem;
                margin-block-end: .5rem;
                vertical-align: baseline;
            }

            .stMarkdown {
                color: #fff;
            }

            .stTooltipHoverTarget[data-testid^='stTooltipHoverTarget'] {
                pointer-events: none;
            }

            .stTooltipHoverTarget[data-testid^='stTooltipHoverTarget']::after {
                content: none !important;
                pointer-events: none;
                display: none;
            }

            .stAlertContainer.st-au {
                position: relative;
                border-left: 3px solid #42be65;
                background: #f4f4f4;
                color: #000;
                padding-left: 3rem;
                height: 48px;
                border-radius: 0;
                padding-top: 1rem;
            }

            .stAlertContainer.st-au p {
                font-size: 0.875rem;
                font-weight: 400;
                line-height: 1.28572;
                letter-spacing: 0.16px;

                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .stAlertContainer.st-au::before {
                content: "";
                position: absolute;
                top: 0.875rem;
                left: 0.75rem;
                display: inline-block;
                width: 20px;
                height: 20px;
                background-image: url('data:image/svg+xml,<svg focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" fill="green" class="bx--inline-notification__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10,1c-4.9,0-9,4.1-9,9s4.1,9,9,9s9-4,9-9S15,1,10,1z M8.7,13.5l-3.2-3.2l1-1l2.2,2.2l4.8-4.8l1,1L8.7,13.5z"></path><path fill="none" d="M8.7,13.5l-3.2-3.2l1-1l2.2,2.2l4.8-4.8l1,1L8.7,13.5z" data-icon-path="inner-path" opacity="0"></path></svg>');
                background-size: contain;
                background-repeat: no-repeat;
                vertical-align: middle;
            }

            .stMarkdown p > em {
                display: block;
            }

            .stMarkdown p > a {
                color: #78a9ff;
                text-decoration: none;
            }

            .stMarkdown p > a:hover {
                color: #a6c8ff;
                text-decoration: underline;
            }

            .stChatMessage {
                border-radius: 0;
            }

            [data-testid="stChatMessageAvatarAssistant"],
            [data-testid="stChatMessageAvatarUser"] {
                border-radius: 50%;
            }

            [data-testid="stChatMessageAvatarAssistant"] svg,
            [data-testid="stChatMessageAvatarUser"] svg {
                fill: #000000;
            }

            [data-testid="stChatMessageAvatarAssistant"] {
                background-color: #A6C8FF;
            }

            [data-testid="stChatMessageAvatarUser"] {
                background-color: #FFFFFF;
            }

            [data-testid="stChatInputSubmitButton"] {
                border-radius: inherit;
                height: calc(100% - 4px);
                margin: 2px;
            }

            .stCode pre {
                background: #393939;
                border-radius: 0;
            }
        </style>
    """,
        unsafe_allow_html=True,
    )
