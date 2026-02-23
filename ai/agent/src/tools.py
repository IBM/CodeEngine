from crewai.tools.base_tool import BaseTool
from crewai_tools import ScrapeWebsiteTool, SerperDevTool
from langchain_community.tools import DuckDuckGoSearchRun


class DuckDuckGoSearchTool(BaseTool):
    name: str = "DuckDuckGo Search Tool"
    description: str = "Search the web for a given query."

    def _run(self, query: str) -> str:
        try:
            duckduckgo_tool = DuckDuckGoSearchRun()

            return duckduckgo_tool.invoke(query)
        except SyntaxError:
            return "Error: Invalid syntax in mathematical expression"

    def _get_tool(self):
        # Create an instance of the tool when needed
        return DuckDuckGoSearchTool()


scrape_tool = ScrapeWebsiteTool()
duckduckgosearch_tool = DuckDuckGoSearchTool()
search_tool = SerperDevTool()
