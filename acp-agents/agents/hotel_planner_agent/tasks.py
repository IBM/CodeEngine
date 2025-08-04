import textwrap

from crewai import Task

from agents import hotel_planner_agent


def create_hotel_task(destination, from_date, to_date, nights, budget, currency):
    return Task(
        description=textwrap.dedent(f"""
            You are a travel assistant. Find **real hotels** in **{destination}** for a stay from **{from_date}** to **{to_date}** (**{nights} nights**) within a total hotel budget of **{budget} {currency}**.

            ---

            ## ✅ Requirements:
            - Only include hotels where **total cost ≤ {budget} {currency}**
            - Do **not** invent or guess prices, amenities, or ratings
            - All data must be from real sources
            - For each hotel, include:
                - **Hotel Name**
                - **Nightly Price**
                - **Total Price** (nightly × nights)
                - **Amenities** (short list)
                - **Review Score**

            ---

            ## ⚠️ Notes:
            - If no hotel is available within budget, clearly state that
            - Do **not** include internal thoughts, calculations, or commentary
            - Output only the final list

            ---

            ## ✅ Output Format (Markdown Table):
            | Hotel Name         | Nightly Price | Total Price | Amenities                  | Rating |
            |--------------------|---------------|-------------|----------------------------|--------|
            | Example Hotel Name | 90 EUR        | 540 EUR     | Free Wi-Fi, Breakfast      | 8.4    |

            List **up to 3 best options**, sorted by rating descending.
        """),
        agent=hotel_planner_agent,
        expected_output="Up to 3 hotel options in a Markdown table with columns: Hotel Name, Nightly Price, Total Price, Amenities, and Rating. Only include hotels within budget.",
    )
