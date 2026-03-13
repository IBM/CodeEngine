from fastmcp import FastMCP

mcp = FastMCP("My FastMCP Server on Code Engine")

@mcp.tool
def process_data(input: str) -> str:
    """Process data on the server"""
    """ADD YOUR BUSINESS LOGIC HERE"""
    return f"Processed: {input}"

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8080)