import textwrap

from crewai import Task

from agents import flight_planner_agent


def create_flight_task(origin, destination, from_date, to_date, budget, currency):
    return Task(
        description=textwrap.dedent(f"""
            You are a travel assistant. Find **real round-trip flights** from **{origin}** to **{destination}**, 
            departing on **{from_date}** and returning on **{to_date}**, with a total budget of **{budget} {currency}**.

            ---

            ## ✅ Requirements:
            - Include only flights where **total price ≤ {budget} {currency}**
            - Prioritize:
                - **Direct flights**
                - **Highly-rated airlines**
                - Reasonable departure and return times
            - List **1 to 5 top round-trip options**

            ---

            ## ✅ Output Format (Markdown Only):
            For each flight option, format like this:

            **<Airline Name> — Total Price: <price> {currency}**

            ```markdown
            | Segment  | From     | To       | Departure         | Arrival           | Flight Number | Duration | Direct |
            |----------|----------|----------|-------------------|-------------------|----------------|----------|--------|
            | Outbound | <City A> | <City B> | YYYY-MM-DD HH:MM  | YYYY-MM-DD HH:MM  | <Flight No.>   | <4h>     | Yes/No |
            | Return   | <City B> | <City A> | YYYY-MM-DD HH:MM  | YYYY-MM-DD HH:MM  | <Flight No.>   | <4h>     | Yes/No |
            ```

            ---

            ## ⚠️ Notes:
            - Do **not** include commentary, bullet points, or summaries
            - Only return markdown tables (no prose or explanation)
            - Do **not** fabricate or estimate flight info or prices
        """),
        agent=flight_planner_agent,
        expected_output=("Markdown tables for 1-5 round-trip flight options with price, schedule, and flight details."),
    )
