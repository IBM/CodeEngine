from fastapi.responses import HTMLResponse


def render_landing_page(name: str):
    html_content = f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>{name}</title>
            <style>
                :root {{
                    --vp-home-hero-image-background-image: linear-gradient(-45deg, #9971F6 50%, #5B84F6 50%);
                    --vp-home-hero-image-filter: blur(68px);
                }}

                .image-bg {{
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    border-radius: 50%;
                    width: 192px;
                    height: 192px;
                    background-image: var(--vp-home-hero-image-background-image);
                    filter: var(--vp-home-hero-image-filter);
                    transform: translate(-50%, -50%);
                }}

                html, body {{
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background-color: #1B1B1F;
                    height: 100vh;
                    width: 100vw;

                    color: #dfdfd6;
                    font-family: "Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                    font-synthesis: style;
                    text-rendering: optimizeLegibility;
                    -webkit-font-smoothing: antialiased;
                }}

                h1 {{
                    color: #fcfcfc;
                }}
            </style>
        </head>
        <body>
            <div class="image-bg"></div>
            <svg focusable="false" preserveAspectRatio="xMidYMid meet" fill="currentColor"  width="245" height="246" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M18 10H20V12H18zM12 10H14V12H12z"></path><path d="M26,20H21V18h1a2.0023,2.0023,0,0,0,2-2V12h2V10H24V8a2.0023,2.0023,0,0,0-2-2H20V2H18V6H14V2H12V6H10A2.0023,2.0023,0,0,0,8,8v2H6v2H8v4a2.0023,2.0023,0,0,0,2,2h1v2H6a2.0023,2.0023,0,0,0-2,2v8H6V22H26v8h2V22A2.0023,2.0023,0,0,0,26,20ZM10,8H22v8H10Zm3,10h6v2H13Z"></path><title>Bot</title></svg>
            <h1>{name}</h1>
        </body>
    </html>
    """

    return HTMLResponse(content=html_content)
