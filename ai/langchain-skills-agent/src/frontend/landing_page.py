"""Landing Page for LangChain Skills Agent"""


def render_landing_page(name: str) -> str:
    """Render a simple HTML landing page for the agent.
    
    Args:
        name: Name of the agent
    
    Returns:
        HTML string for the landing page
    """
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{name} - LangChain Skills Agent</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            
            .container {{
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 800px;
                width: 100%;
                padding: 40px;
            }}
            
            h1 {{
                color: #333;
                font-size: 2.5em;
                margin-bottom: 10px;
                text-align: center;
            }}
            
            .subtitle {{
                color: #666;
                text-align: center;
                font-size: 1.1em;
                margin-bottom: 30px;
            }}
            
            .badge {{
                display: inline-block;
                background: #667eea;
                color: white;
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 0.9em;
                margin-bottom: 20px;
            }}
            
            .skills {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }}
            
            .skill-card {{
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                border-left: 4px solid #667eea;
            }}
            
            .skill-card h3 {{
                color: #333;
                font-size: 1.2em;
                margin-bottom: 10px;
            }}
            
            .skill-card p {{
                color: #666;
                font-size: 0.95em;
                line-height: 1.5;
            }}
            
            .endpoints {{
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin-top: 30px;
            }}
            
            .endpoints h2 {{
                color: #333;
                font-size: 1.5em;
                margin-bottom: 15px;
            }}
            
            .endpoint {{
                background: white;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 10px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
            }}
            
            .method {{
                display: inline-block;
                padding: 3px 8px;
                border-radius: 3px;
                font-weight: bold;
                margin-right: 10px;
            }}
            
            .get {{
                background: #61affe;
                color: white;
            }}
            
            .post {{
                background: #49cc90;
                color: white;
            }}
            
            .footer {{
                text-align: center;
                margin-top: 30px;
                color: #999;
                font-size: 0.9em;
            }}
            
            .icon {{
                font-size: 2em;
                margin-bottom: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align: center;">
                <div class="icon">🤖</div>
                <h1>{name}</h1>
                <p class="subtitle">LangChain-Powered Skills-Based Agent</p>
                <span class="badge">✨ Skill-Based Architecture</span>
            </div>
            
            <div class="skills">
                <div class="skill-card">
                    <h3>🌤️ Weather Forecast</h3>
                    <p>Get current weather and multi-day forecasts for any location worldwide.</p>
                </div>
                
                <div class="skill-card">
                    <h3>✈️ Travel Recommendations</h3>
                    <p>Personalized destination suggestions based on preferences and budget.</p>
                </div>
                
                <div class="skill-card">
                    <h3>💱 Currency Converter</h3>
                    <p>Convert between 30+ currencies with current exchange rates.</p>
                </div>
            </div>
            
            <div class="endpoints">
                <h2>📡 API Endpoints</h2>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span>/agents</span>
                    <p style="margin-top: 5px; color: #666;">List available agents</p>
                </div>
                
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span>/runs</span>
                    <p style="margin-top: 5px; color: #666;">Execute agent with a query</p>
                </div>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span>/info</span>
                    <p style="margin-top: 5px; color: #666;">Get agent and skills information</p>
                </div>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span>/health</span>
                    <p style="margin-top: 5px; color: #666;">Health check endpoint</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Powered by LangChain • IBM Cloud Code Engine</p>
                <p style="margin-top: 5px;">Skills are dynamically loaded from the skills/ directory</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

# Made with Bob
