# from crewai import Agent
import logging

from tasks.extract_travel_budget import extract_travel_budget
from tasks.extract_travel_destinations import extract_travel_destinations
from tasks.extract_travel_origin import extract_travel_origin
from tasks.extract_travel_period import extract_travel_period
from tasks.extract_traveler_interests import extract_traveler_interests
from tasks.extract_traveler_preferences import extract_traveler_preferences

logger = logging.getLogger(__name__)


class ExtractAgent:
    async def run(self, user_prompt: str) -> dict:
        travel_origin = await extract_travel_origin.run(f"""
            Extract only the **travel origin** — the city or location where the user is starting their trip.  
            Do **not** include destinations, dates, budget, interests, or preferences. Return only the departure location.

            User input: {user_prompt}
        """)

        travel_destinations = await extract_travel_destinations.run(f"""
            Extract the destination or destinations the user wants to travel to. 
            Do not include the travel origin: {travel_origin}. 
            Only return the destination(s), and ignore dates, interests, and other preferences.

            User input: {user_prompt}
        """)

        travel_period = await extract_travel_period.run(f"""
            Extract the travel period, including the start date and duration or end date, from the user's input. 
            If only duration or start date is given, extract what's available. 
            Ignore the travel origin, destination, and any preferences.

            User input: {user_prompt}
        """)

        travel_budget = await extract_travel_budget.run(f"""
            Extract the user's travel budget from the input. This can be a price range, a general category (e.g., budget, mid-range, luxury), or both. 
            Ignore any information about travel dates, origin, destination, or personal interests.

            User input: {user_prompt}
        """)

        traveler_preferences = await extract_traveler_preferences.run(f"""
            Extract the user's travel preferences from the input.

            **Preferences** describe *how* the person likes to travel—such as accommodation style, budget, travel pace, food preferences, transportation choices, and things to avoid. 
            Do not include interests, destinations, travel dates, or origin.

            User input: {user_prompt}
        """)

        traveler_interests = await extract_traveler_interests.run(f"""
            Extract the user's travel interests from the input.

            **Interests** describe *what* the person wants to explore or experience—such as topics, themes, or activities they are curious or passionate about (e.g., history, sightseeing, technology, hiking, food tours).

            Exclude preferences (like accommodation type, food restrictions, pace of travel, or things to avoid), and also exclude origin, destination, dates, and budget.

            Previously extracted preferences: {", ".join(traveler_preferences.list)}  
            User input: {user_prompt}
        """)

        return {
            "origin": travel_origin,
            "destinations": travel_destinations,
            "period": travel_period,
            "budget": travel_budget,
            "preferences": traveler_preferences,
            "interests": traveler_interests,
        }


extract_agent = ExtractAgent()
