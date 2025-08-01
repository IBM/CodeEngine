import asyncio
import json

from acp_sdk.client import Client
from acp_sdk.models import Message

travel_guide = """
    # Oslo, Norway: The Ultimate Travel Guide for an Unforgettable Experience

    ## 🌆 Key Attractions: Must-Visit Landmarks
    - **Oslo Opera House** (Norwegian: Oslo Operaen): Iconic architecture with panoramic views of the city. Free guided tours available. Admission to the concert hall: ~150 NOK.
    - **Viking Ship Museum** (Vikingeskibsmuseet): Home to the Oseberg and Gokstad ships. Interactive exhibits and a reconstructed Viking village. Admission: ~120 NOK.
    - **Royal Palace (Kongehuset)**: Explore the official residence of the King of Norway. Free entry, but book tickets for the Crown Prince's Apartment (150 NOK).
    - **Bygdøy Archipelago**: A UNESCO World Heritage Site with museums like the Norwegian Museum of Cultural History and the Fram Museum (Polar exploration history). Boat tours from Oslo harbor: ~300 NOK.

    ## 🌿 Hidden Gems: Off-the-Beaten-Path Experiences
    - **Vigeland Sculpture Park** (Vigelandsparken): Wander through 212 sculptures by Gustav Vigeland. Free entry, but timed tickets required (book in advance).
    - **Oslo Spektrum**: A cultural hub with the Oslo Philharmonic Orchestra, the Oslo Cathedral, and the Oslo City Library. Free to explore the library's architecture.
    - **Grünerløkka**: A bohemian neighborhood with indie cafes, vintage shops, and the Oslo Jazz House (host to local musicians). Try *Kafféhuset* for a cozy coffee spot.
    - **Holtet**: A hidden garden in the heart of Oslo with seasonal events like the *Holtet Summer Festival* (June).

    ## 🎨 Cultural Hotspots: Art & History
    - **Munch Museum** (Munchmuseet): Home to *The Scream* and Edvard Munch's works. Admission: ~150 NOK. Book tickets online to avoid long lines.
    - **Norwegian National Gallery** (Nasjonalgalleriet): Free entry to the main building, but pay for the *Munch Museum* (see above).
    - **The Oslo Cathedral** (Oslo Domkirke): A stunning example of medieval architecture. Free entry, but climb the tower for views (100 NOK).
    - **The Oslo City Hall** (Rådhuset): Iconic architecture with a rotating sculpture garden. Free to visit.

    ## 🎉 Special Events & Festivals
    - **Oslo Jazz Festival** (June): World-class jazz performances in venues like the *Cullman Hall* and *Oslo Spektrum*.
    - **Oslo International Film Festival** (February): A hub for Nordic cinema and global indie films.
    - **Northern Lights (December-February)**: Take a fjord cruise or hike to remote spots like *Svelvik* for aurora viewing. Tours start at ~1,500 NOK.
    - **Constitution Day (May 17)**: Celebrate Norway's independence with parades, fireworks, and the *King's Speech* at the Royal Palace.

    ## 🍽️ Dining: Local Flavors & Hidden Restaurants
    - **Smørbrød & Lutefisk**: Try *Smørbrød & Lutefisk* in the *Oslo Fish Market* for traditional dishes. Prices: ~200-300 NOK per meal.
    - **Rakfisk & Skaldur**: A modern take on Nordic cuisine at *Rakfisk & Skaldur* in Grünerløkka. Reservations recommended.
    - **Cafés & Bakeries**: *Kafféhuset* (Grünerløkka) for coffee, *Bakken* (city center) for pastries, and *Kveldskafe* (Norwegian for "evening café") for a cozy vibe.
    - **Street Food**: *Fisketorget* (Oslo Fish Market) offers fresh seafood and grilled salmon. Prices: ~150-250 NOK.

    ## 🚇 Transport & Practical Tips
    - **Public Transport**: Oslo's buses, trams, and metro are efficient. Purchase an *Oslo Pass* (1,200 NOK for 3 days) for unlimited travel.
    - **Biking**: Rent a bike from *Oslo Bycykling* (150 NOK/day) and explore the city's bike paths.
    - **Safety**: Oslo is very safe, but keep valuables secure. Avoid walking alone in isolated areas at night.
    - **Budgeting**: Average daily cost: ~1,500-2,500 NOK (accommodation, meals, and activities).

    ## 🏨 Accommodation: Where to Stay
    - **Budget**: *Hostel Oslo* (city center, ~500 NOK/night) or *Huset i Oslo* (hostel with a rooftop bar).
    - **Mid-Range**: *Hotel Grand Continental* (historic hotel near the Royal Palace, ~1,200 NOK/night) or *Scandic Oslo City* (modern design, ~1,500 NOK/night).
    - **Luxury**: *Hotel Radisson Blu Oslo* (waterfront view, ~2,500 NOK/night) or *The Grand Hotel* (historic elegance, ~3,000 NOK/night).

    ## 🌡️ Weather & Seasonal Tips
    - **Summer (June-August)**: Mild weather (15-25°C). Ideal for hiking in the *Oslofjord* or visiting the *Vigeland Park*.
    - **Winter (December-February)**: Cold (-5°C to 0°C). Perfect for Northern Lights tours or skiing in *Hemsedal* (book trips in advance).
    - **Spring/Fall**: Variable weather. Pack layers and visit during the *Oslo Jazz Festival* (June) or *Oslo International Film Festival* (February).

    ## 📌 Final Tips
    - **Etiquette**: Greet with a handshake or a nod. Avoid loud conversations in public spaces.
    - **Tipping**: Not common, but round up bills for small services (e.g., 100 NOK instead of 95 NOK).
    - **Language**: Norwegian is spoken, but English is widely understood in tourist areas.

    Oslo is a city of contrasts—where modern architecture meets nature, and history blends with innovation. With this guide, you'll uncover its hidden stories, savor its flavors, and experience the soul of Norway's capital. Safe travels! 🌍✨
"""

hotel_options = """
| Hotel Name       | Price Range  | Location             | Rating   |
|------------------|--------------|----------------------|----------|
| The Bo Hotel     | €58 per night| Vasastan, Stockholm  | 4.4/5    |
| Hotel At Six     | €58 per night| Stockholm            | 4.5/5    |
| Scandic 53       | €65 per night| Stockholm            | 4.3/5    |
"""

flight_options = """
**Lufthansa - Total Price: 398 EUR**

| Segment  | From       | To         | Departure         | Arrival           | Flight Number | Duration | Direct |
|----------|------------|------------|-------------------|-------------------|----------------|----------|--------|
| Outbound | Stuttgart  | Stockholm  | 2025-08-10 08:30 | 2025-08-10 11:30 | LH1234         | 3h00m    | Yes    |
| Return   | Stockholm  | Stuttgart  | 2025-08-16 17:15 | 2025-08-16 20:15 | LH5678         | 3h00m    | Yes    |

**Air France - Total Price: 405 EUR**

| Segment  | From       | To         | Departure         | Arrival           | Flight Number | Duration | Direct |
|----------|------------|------------|-------------------|-------------------|----------------|----------|--------|
| Outbound | Stuttgart  | Stockholm  | 2025-08-10 12:15 | 2025-08-10 15:15 | AF9876         | 3h00m    | Yes    |
| Return   | Stockholm  | Stuttgart  | 2025-08-16 14:50 | 2025-08-16 17:50 | AF1234         | 3h00m    | Yes    |

**SAS - Total Price: 402 EUR**

| Segment  | From       | To         | Departure         | Arrival           | Flight Number | Duration | Direct |
|----------|------------|------------|-------------------|-------------------|----------------|----------|--------|
| Outbound | Stuttgart  | Stockholm  | 2025-08-10 14:00 | 2025-08-10 17:00 | SK5555         | 3h00m    | Yes    |
| Return   | Stockholm  | Stuttgart  | 2025-08-16 10:30 | 2025-08-16 13:30 | SK6677         | 3h00m    | Yes    |

**Swiss International Air Lines - Total Price: 410 EUR**

| Segment  | From       | To         | Departure         | Arrival           | Flight Number | Duration | Direct |
|----------|------------|------------|-------------------|-------------------|----------------|----------|--------|
| Outbound | Stuttgart  | Stockholm  | 2025-08-10 09:45 | 2025-08-10 12:45 | LX8888         | 3h00m    | Yes    |
| Return   | Stockholm  | Stuttgart  | 2025-08-16 16:20 | 2025-08-16 19:20 | LX7777         | 3h00m    | Yes    |

**Ryanair - Total Price: 385 EUR**

| Segment  | From       | To         | Departure         | Arrival           | Flight Number | Duration | Direct |
|----------|------------|------------|-------------------|-------------------|----------------|----------|--------|
| Outbound | Stuttgart  | Stockholm  | 2025-08-10 10:00 | 2025-08-10 13:00 | FR1111         | 3h00m    | Yes    |
| Return   | Stockholm  | Stuttgart  | 2025-08-16 15:45 | 2025-08-16 18:45 | FR2222         | 3h00m    | Yes    |
"""


async def main() -> None:
    async with Client(
        base_url="http://0.0.0.0:5660",
        headers={},
    ) as client:
        async for event in client.run_stream(
            agent="Itinerary_Planner",
            input=[
                Message(
                    parts=[
                        {
                            "content_type": "application/json",
                            "content": json.dumps(
                                {
                                    "travel_guide": travel_guide,
                                    "hotel_options": hotel_options,
                                    "flight_options": flight_options,
                                }
                            ),
                        },
                    ]
                )
            ],
        ):
            try:
                print(event.part.content, end="", flush=True)
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(main())
