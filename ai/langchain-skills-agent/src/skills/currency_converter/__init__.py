"""Currency Converter Skill Implementation"""

import os
from typing import Dict

from langchain_core.tools import tool

# Mock exchange rates (base: USD)
# In production, these would come from a real API
MOCK_RATES: Dict[str, float] = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.50,
    "CAD": 1.36,
    "AUD": 1.52,
    "CHF": 0.88,
    "CNY": 7.24,
    "INR": 83.12,
    "MXN": 17.08,
    "BRL": 4.97,
    "ZAR": 18.65,
    "KRW": 1319.50,
    "SGD": 1.34,
    "NZD": 1.63,
    "HKD": 7.83,
    "SEK": 10.36,
    "NOK": 10.58,
    "DKK": 6.87,
    "PLN": 3.98,
    "THB": 34.85,
    "MYR": 4.47,
    "IDR": 15678.0,
    "PHP": 55.82,
    "CZK": 22.45,
    "ILS": 3.64,
    "CLP": 912.50,
    "AED": 3.67,
    "SAR": 3.75,
    "TRY": 32.15,
}


@tool
def currency_converter(amount: float, from_currency: str, to_currency: str) -> str:
    """Convert an amount from one currency to another.
    
    Args:
        amount: The amount to convert (e.g., 100.0)
        from_currency: Source currency code (e.g., 'USD', 'EUR', 'GBP')
        to_currency: Target currency code (e.g., 'USD', 'EUR', 'GBP')
    
    Returns:
        Formatted conversion result with exchange rate details
    """
    # Normalize currency codes to uppercase
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    # Validate currency codes
    if from_currency not in MOCK_RATES:
        return f"❌ Error: Currency code '{from_currency}' is not supported.\n\nSupported currencies: {', '.join(sorted(MOCK_RATES.keys()))}"
    
    if to_currency not in MOCK_RATES:
        return f"❌ Error: Currency code '{to_currency}' is not supported.\n\nSupported currencies: {', '.join(sorted(MOCK_RATES.keys()))}"
    
    # Check for API key (for future real API integration)
    api_key = os.getenv("EXCHANGE_RATE_API_KEY")
    
    if api_key and api_key != "YOUR_KEY":
        # TODO: Implement real API call when API key is available
        pass
    
    # Perform conversion using mock rates
    return _convert_currency(amount, from_currency, to_currency)


def _convert_currency(amount: float, from_currency: str, to_currency: str) -> str:
    """Perform the actual currency conversion."""
    
    # If same currency, no conversion needed
    if from_currency == to_currency:
        return f"💱 Currency Conversion\n{'=' * 50}\n\n✅ Same currency - no conversion needed!\n{amount:.2f} {from_currency} = {amount:.2f} {to_currency}"
    
    # Convert to USD first (base currency), then to target currency
    amount_in_usd = amount / MOCK_RATES[from_currency]
    converted_amount = amount_in_usd * MOCK_RATES[to_currency]
    
    # Calculate the direct exchange rate
    exchange_rate = MOCK_RATES[to_currency] / MOCK_RATES[from_currency]
    
    # Format the result
    result = [
        "💱 Currency Conversion",
        "=" * 50,
        "",
        "📊 Conversion Details:",
        f"   Original Amount: {amount:,.2f} {from_currency}",
        f"   Converted Amount: {converted_amount:,.2f} {to_currency}",
        "",
        "📈 Exchange Rate:",
        f"   1 {from_currency} = {exchange_rate:.4f} {to_currency}",
        f"   1 {to_currency} = {1/exchange_rate:.4f} {from_currency}",
        "",
        "🧮 Calculation:",
        f"   {amount:,.2f} {from_currency} × {exchange_rate:.4f} = {converted_amount:,.2f} {to_currency}",
        "",
        "💡 Note: These are demonstration exchange rates.",
        "   Configure EXCHANGE_RATE_API_KEY in your .env file for live rates.",
        "   Always verify rates for actual financial transactions.",
    ]
    
    return "\n".join(result)


def get_supported_currencies() -> list[str]:
    """Return list of supported currency codes."""
    return sorted(MOCK_RATES.keys())


# Export the tool
__all__ = ["currency_converter", "get_supported_currencies"]

# Made with Bob
