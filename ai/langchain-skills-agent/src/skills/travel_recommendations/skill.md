---
name: "Travel Recommendations"
description: "Get personalized travel destination recommendations based on preferences"
version: "1.0.0"
category: "travel"
parameters:
  - name: preferences
    type: string
    required: true
    description: "Travel preferences (e.g., 'beach vacation', 'cultural sites', 'adventure')"
  - name: budget
    type: string
    required: false
    default: "moderate"
    description: "Budget level: 'budget', 'moderate', or 'luxury'"
  - name: season
    type: string
    required: false
    default: "current"
    description: "Preferred travel season or 'current'"
---

# Travel Recommendations Skill

This skill provides personalized travel destination recommendations based on user preferences, budget, and season.

## Features

- Destination suggestions tailored to interests
- Budget-appropriate recommendations
- Seasonal considerations
- Activity suggestions for each destination
- Estimated costs and travel tips
- Cultural highlights and must-see attractions

## Usage

The skill accepts travel preferences, budget level, and preferred season to generate recommendations.

## Example

```python
result = travel_recommendations(
    preferences="beach and culture",
    budget="moderate",
    season="summer"
)
```

## Output Format

Returns a formatted guide with:
- Recommended destinations (3-5 locations)
- Why each destination fits the criteria
- Estimated budget ranges
- Best time to visit
- Top activities and attractions
- Travel tips

## Notes

- Considers current travel trends and seasonal factors
- Provides diverse options across different regions
- Includes practical travel advice
- Budget estimates in USD (can be converted using currency_converter skill)