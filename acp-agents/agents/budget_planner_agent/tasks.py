import textwrap
from datetime import datetime

from crewai import Task
from pydantic import BaseModel

from agents import budget_planner_agent


class Budget(BaseModel):
    flights: int
    accommodation: int
    activities: int
    food_and_drinks: int
    local_transport: int
    miscellaneous: int
    total: int


def create_budget_task(budget_min, budget_max, currency, period):
    num_days = None

    try:
        if " to " in period:
            start_str, end_str = [p.strip() for p in period.split(" to ")]
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")
            num_days = max((end_date - start_date).days, 1)  # At least 1 day
    except Exception as e:
        print(f"Failed to parse period: {period}, error: {e}")
        num_days = None

    return Task(
        description=textwrap.dedent(f"""
            You are a travel budget planner. Your task is to **allocate the entire travel budget** of {budget_max} {currency} 
            for a trip to **Paris, France**, from {period}. The trip lasts **{num_days} days and {num_days - 1} nights**.

            ✅ You **must use the full {budget_max} {currency}**. Do not leave any part of the budget unallocated.
            ⚠️ **The total budget must not exceed {budget_max} {currency} under any circumstance.** Use 100% of the budget — 
not more, not less.

            ---

            📌 Total budget: **{budget_max} {currency}**
            📌 Trip duration: {num_days} days / {num_days - 1} nights
            🚫 Do NOT exceed the total budget — this will be treated as a failure.

            ✅ You must:
            - Use all of the {budget_max} {currency}
            - Not go over
            - Not underuse
            - Respect category minimum percentages

            🧮 Distribute the budget across the following categories using realistic daily or nightly rates. Scale all per-day costs correctly. 
            Here are **minimum percentage guidelines**:

            - ✈️ **Flights**: ≥20% — assume average round-trip cost to/from Paris is at least **300 {currency}**
            - 🏨 **Accommodation**: ≥25% — use at least **100 {currency}/night** × number of nights (e.g., 5 nights = 500 minimum)
            - 🍽️ **Food & Drink**: ≥15% — estimate at least **30–50 {currency}/day**
            - 🗺️ **Activities**: ≥15% — museums, events, tours — minimum **30 {currency}/day**
            - 🚕 **Local Transport**: ≥5% — metro, taxis, airport transfer
            - 🎁 **Miscellaneous**: ≥5% — tips, shopping, unexpected costs

            🧾 Use **any leftover budget** to enhance quality (e.g., better hotel, more premium meals or excursions). Avoid underestimating. Make the most of the available budget.

            ### Output:
            - A **structured JSON object** with categories and final amounts
            - Include **internal calculations** like `nightly rate × nights` in comments if supported
            - Round totals, and confirm that they add up to **exactly {budget_max} {currency}**

            ⚠️ Do **not** return a budget lower than {budget_max} {currency}.
        """),
        agent=budget_planner_agent,
        output_json=Budget,
        expected_output="A clear, structured JSON object representing the full budget breakdown with consideration for trip duration.",
    )
