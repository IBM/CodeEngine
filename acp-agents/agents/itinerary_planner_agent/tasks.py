from crewai import Task

from agents import itinerary_planner_agent


def create_itinerary_task(travel_guide, hotel_options, flight_options):
    return Task(
        description=f"""
            You are a professional travel itinerary planner. Create a **detailed multi-day Markdown-formatted travel itinerary** using the provided travel guide, hotel options, and flight options. This itinerary should be **personalized**, **well-organized**, and **optimized for comfort, efficiency, and enjoyment**.

            ---

            ## ✅ Required Structure and Content

            ### For Each Day:
            - **Section Title**: `## Day X: [Short Description or Theme]`
            - **Schedule (Table Format)**:
                | Time of Day | Plan |
                |-------------|------|
                | Morning     | ...  |
                | Afternoon   | ...  |
                | Evening     | ...  |

            - **Weather Forecast & Conditions**
            - **Clothing & Packing Suggestions**
            - **Estimated Budget Breakdown**:
                - Transport
                - Meals
                - Activities
                - Lodging

            ### Recommendations You Must Include:
            - ✈️ Specific flights to/from the destination (best pick with reason)
            - 🏨 Best hotel (or family-friendly) with short reasoning (e.g., walkability, amenities)
            - 🏛️ Attractions & activities tailored to interests
            - 🍽️ Suggested restaurants/cafes for each meal (with a short reason: "great for kids", "top-rated", etc.)

            ---

            ## ⚠️ DO NOT:
            - Do **not** copy or summarize the travel guide directly
            - Do **not** return generic or unstructured responses
            - Avoid encyclopedic city summaries

            ---

            ## ✅ Output Format:
            - Must be in **Markdown**
            - Use clear sections (`##`, `###`, `-`, `|`)
            - Include explanations for all recommendations (brief and friendly)
            - Make it feel curated and helpful, not robotic

            ---

            ### Provided Data:

            **🧭 Travel Guide (from Local Expert Agent):**  
            {travel_guide}

            **🏨 Hotel Options:**  
            {hotel_options}

            **✈️ Flight Options:**  
            {flight_options}
        """,
        agent=itinerary_planner_agent,
        expected_output="Detailed, multi-day Markdown-formatted travel itinerary with daily schedule tables, budget estimates, and recommendations.",
    )
