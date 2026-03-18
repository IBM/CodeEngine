"""Travel Recommendations Skill Implementation"""

from langchain_core.tools import tool


@tool
def travel_recommendations(
    preferences: str,
    budget: str = "moderate",
    season: str = "current"
) -> str:
    """Get personalized travel destination recommendations.
    
    Args:
        preferences: Travel preferences (e.g., 'beach vacation', 'cultural sites', 'adventure')
        budget: Budget level - 'budget', 'moderate', or 'luxury' (default: 'moderate')
        season: Preferred season - 'spring', 'summer', 'fall', 'winter', or 'current' (default: 'current')
    
    Returns:
        Formatted travel recommendations with destinations and details
    """
    # Normalize inputs
    budget = budget.lower()
    season = season.lower()
    preferences = preferences.lower()
    
    # Generate recommendations based on preferences
    return _generate_recommendations(preferences, budget, season)


def _generate_recommendations(preferences: str, budget: str, season: str) -> str:
    """Generate travel recommendations based on criteria."""
    
    # Define destination database with various attributes
    destinations = {
        "beach": [
            {
                "name": "Bali, Indonesia",
                "highlights": "Stunning beaches, temples, rice terraces, vibrant culture",
                "activities": ["Surfing", "Temple visits", "Yoga retreats", "Snorkeling"],
                "budget_range": {"budget": "$30-50/day", "moderate": "$60-100/day", "luxury": "$150+/day"},
                "best_season": ["spring", "summer", "fall"]
            },
            {
                "name": "Algarve, Portugal",
                "highlights": "Golden cliffs, pristine beaches, charming villages",
                "activities": ["Beach hopping", "Coastal hiking", "Wine tasting", "Golf"],
                "budget_range": {"budget": "$40-60/day", "moderate": "$80-120/day", "luxury": "$180+/day"},
                "best_season": ["spring", "summer", "fall"]
            },
            {
                "name": "Cancún, Mexico",
                "highlights": "Caribbean beaches, Mayan ruins, vibrant nightlife",
                "activities": ["Snorkeling", "Cenote diving", "Mayan ruins tours", "Beach clubs"],
                "budget_range": {"budget": "$50-70/day", "moderate": "$90-140/day", "luxury": "$200+/day"},
                "best_season": ["winter", "spring"]
            }
        ],
        "culture": [
            {
                "name": "Kyoto, Japan",
                "highlights": "Ancient temples, traditional gardens, geisha culture",
                "activities": ["Temple visits", "Tea ceremonies", "Bamboo forest walks", "Traditional crafts"],
                "budget_range": {"budget": "$60-80/day", "moderate": "$100-150/day", "luxury": "$220+/day"},
                "best_season": ["spring", "fall"]
            },
            {
                "name": "Rome, Italy",
                "highlights": "Ancient ruins, Renaissance art, world-class cuisine",
                "activities": ["Colosseum tours", "Vatican museums", "Food tours", "Historic walks"],
                "budget_range": {"budget": "$50-70/day", "moderate": "$90-130/day", "luxury": "$200+/day"},
                "best_season": ["spring", "fall"]
            },
            {
                "name": "Istanbul, Turkey",
                "highlights": "Byzantine architecture, bazaars, East-meets-West culture",
                "activities": ["Mosque visits", "Bazaar shopping", "Bosphorus cruise", "Turkish baths"],
                "budget_range": {"budget": "$30-50/day", "moderate": "$60-100/day", "luxury": "$150+/day"},
                "best_season": ["spring", "fall"]
            }
        ],
        "adventure": [
            {
                "name": "Queenstown, New Zealand",
                "highlights": "Adventure capital, stunning landscapes, outdoor activities",
                "activities": ["Bungee jumping", "Skiing", "Hiking", "Jet boating"],
                "budget_range": {"budget": "$60-80/day", "moderate": "$110-160/day", "luxury": "$240+/day"},
                "best_season": ["summer", "winter"]
            },
            {
                "name": "Patagonia, Chile/Argentina",
                "highlights": "Dramatic mountains, glaciers, pristine wilderness",
                "activities": ["Trekking", "Glacier hiking", "Wildlife watching", "Kayaking"],
                "budget_range": {"budget": "$50-70/day", "moderate": "$90-140/day", "luxury": "$200+/day"},
                "best_season": ["summer", "fall"]
            },
            {
                "name": "Iceland",
                "highlights": "Volcanoes, waterfalls, Northern Lights, geothermal pools",
                "activities": ["Glacier hiking", "Hot springs", "Northern Lights tours", "Volcano tours"],
                "budget_range": {"budget": "$80-100/day", "moderate": "$130-180/day", "luxury": "$260+/day"},
                "best_season": ["summer", "winter"]
            }
        ]
    }
    
    # Determine which category matches preferences
    selected_destinations = []
    if "beach" in preferences or "ocean" in preferences or "sea" in preferences:
        selected_destinations.extend(destinations["beach"])
    if "culture" in preferences or "history" in preferences or "art" in preferences or "museum" in preferences:
        selected_destinations.extend(destinations["culture"])
    if "adventure" in preferences or "hiking" in preferences or "outdoor" in preferences or "mountain" in preferences:
        selected_destinations.extend(destinations["adventure"])
    
    # If no specific match, provide a mix
    if not selected_destinations:
        selected_destinations = destinations["beach"][:1] + destinations["culture"][:1] + destinations["adventure"][:1]
    
    # Limit to top 3 destinations
    selected_destinations = selected_destinations[:3]
    
    # Build the response
    result = [
        "✈️  Personalized Travel Recommendations",
        "=" * 60,
        "",
        f"📋 Your Preferences: {preferences.title()}",
        f"💰 Budget Level: {budget.title()}",
        f"🌍 Season: {season.title()}",
        "",
        "🎯 Recommended Destinations:",
        ""
    ]
    
    for i, dest in enumerate(selected_destinations, 1):
        budget_info = dest["budget_range"].get(budget, dest["budget_range"]["moderate"])
        
        result.extend([
            f"{i}. {dest['name']}",
            "   " + "-" * 55,
            f"   ✨ Highlights: {dest['highlights']}",
            f"   💵 Estimated Cost: {budget_info}",
            "   🎯 Top Activities:",
        ])
        
        for activity in dest["activities"]:
            result.append(f"      • {activity}")
        
        # Add seasonal note
        if season != "current" and season in dest["best_season"]:
            result.append(f"   ✅ Perfect for {season} travel!")
        elif season != "current":
            result.append(f"   ℹ️  Best visited in: {', '.join(dest['best_season'])}")
        
        result.append("")
    
    result.extend([
        "💡 Travel Tips:",
        "   • Book flights 2-3 months in advance for best prices",
        "   • Consider shoulder season for fewer crowds and better deals",
        "   • Check visa requirements well in advance",
        "   • Get travel insurance for peace of mind",
        "",
        "🔄 Use the currency_converter skill to convert prices to your currency!"
    ])
    
    return "\n".join(result)


# Export the tool
__all__ = ["travel_recommendations"]

# Made with Bob
