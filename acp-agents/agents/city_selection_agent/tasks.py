import os
import textwrap

from crewai import Task
from dotenv import load_dotenv

from agents import city_research_agent, city_selection_expert_agent
from classes.task import Model
from classes.task import Task as CustomTask
from schemas import CityLocation

load_dotenv()


def create_city_research_task(destination, origin, travel_period, interests, preferences, budget):
    return Task(
        description=(
            f"Collect detailed and up-to-date travel information about **{destination}** for a traveler coming from "
            f"**{origin}** from **{travel_period}**. The information should be tailored to the following interests and preferences:\n\n"
            f"**Interests:** {interests}\n"
            f"**Preferences:** {preferences}\n"
            f"**Budget:** {budget}\n\n"
            "Your research should include:\n"
            "- Top tourist attractions and local experiences\n"
            "- Best neighborhoods to stay in\n"
            "- Local transportation options\n"
            "- Cultural norms, safety tips, and general travel advisories\n"
            "- Local food and drink highlights\n"
            "- Events or festivals during the travel period\n"
            "- Sample round-trip flights from the origin to the destination with approximate prices\n"
            "- Recommended hotels in different price ranges (budget, mid-range, luxury) with nightly rates\n\n"
            "Deliver all findings in a well-organized markdown format categorized by topic."
        ),
        expected_output=(
            "A markdown document structured as follows:\n"
            "- **Attractions**\n"
            "- **Neighborhoods**\n"
            "- **Transportation**\n"
            "- **Culture & Safety**\n"
            "- **Food & Drink**\n"
            "- **Events**\n"
            "- **Sample Flights**: Airline, dates, round-trip price estimate\n"
            "- **Hotels**: Name, star rating, area, nightly price, category (budget/mid-range/luxury)"
        ),
        agent=city_research_agent,
    )


def create_select_best_city_task(travel_information):
    return Task(
        description=textwrap.dedent(f"""
        You are a travel planning expert tasked with selecting the single best city for an upcoming trip. 
        Your decision must be based on a comparative analysis of multiple cities using the following criteria:
        - Current and forecasted weather
        - Seasonal or cultural events
        - Key attractions and activities
        - Local customs or unique experiences
        - Total travel costs (including flights and accommodations)
        - Travel requirements (e.g., visas, vaccinations)

        Carefully evaluate each candidate city using real or plausible data. Then choose ONE city that offers the best 
        overall experience based on the above factors.

        **Your response must be a detailed report in Markdown format**, with the following structure:
        1. **City Chosen**: Name the selected city.
        2. **Overview**: Brief summary of the city's appeal.
        3. **Weather Forecast**: Current and upcoming conditions.
        4. **Cultural & Seasonal Events**: Any notable events during the planned travel period.
        5. **Attractions**: Key highlights and must-see locations.
        6. **Local Culture & Customs**: Any unique or important local considerations.
        7. **Food & Drink**: Notable local cuisine or dining experiences.
        8. **Travel Costs**:
           - Estimated flight cost from the traveler's origin
           - Average hotel cost per night
        9. **Travel Requirements**: Visa or other entry considerations.
        10. **Justification**: A clear explanation of why this city is the best choice over others considered.

       **Important:** Do not generate a generic travel guide. Instead, make a reasoned, data-backed recommendation based on the travel information provided.

        ---
                                    
        **Travel information to consider:**
 
        {travel_information}

        ---
        **Reminder:** Select and report on only **one** city.
    """),
        agent=city_selection_expert_agent,
        expected_output=(
            "Markdown format. Use a structured report with headings as listed above. The report should include a single selected city, detailed supporting analysis, and justification based on comparative evaluation of all options."
        ),
    )


extract_city = CustomTask(
    model=Model(
        base_url=os.getenv("INFERENCE_BASE_URL"),
        api_key=os.getenv("INFERENCE_API_KEY", ""),
        model=os.getenv("INFERENCE_MODEL_NAME"),
        project_id=os.getenv("INFERENCE_PROJECT_ID"),
    ),
    output_type=CityLocation,
)
