from typing import Any
from fastmcp import FastMCP
from art import text2art

mcp = FastMCP("My FastMCP Server on Code Engine")

@mcp.tool
def ascii_art(input: str) -> str:
    """Take an arbitraty input and return it as an ASCII art banner"""

    if input == "Code Engine":
        response = ". ___  __  ____  ____\n"
        response += "./ __)/  \\(    \\(  __)\n"
        response += "( (__(  O )) D ( ) _)\n"
        response += ".\\___)\\__/(____/(____)\n"
        response += ".____  __ _   ___  __  __ _  ____\n"
        response += "(  __)(  ( \\ / __)(  )(  ( \\(  __)\n"
        response += ".) _) /    /( (_ \\ )( /    / ) _)\n"
        response += "(____)\\_)__) \\___/(__)\\_)__)(____)\n"
    else:
        response: str = text2art(input)

    return response

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8080)