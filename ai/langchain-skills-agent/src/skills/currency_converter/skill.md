---
name: "Currency Converter"
description: "Convert amounts between different currencies with current exchange rates"
version: "1.0.0"
category: "finance"
parameters:
  - name: amount
    type: float
    required: true
    description: "Amount to convert"
  - name: from_currency
    type: string
    required: true
    description: "Source currency code (e.g., 'USD', 'EUR', 'GBP')"
  - name: to_currency
    type: string
    required: true
    description: "Target currency code (e.g., 'USD', 'EUR', 'GBP')"
---

# Currency Converter Skill

This skill converts monetary amounts between different currencies using exchange rates.

## Features

- Convert between major world currencies
- Support for 30+ currency codes
- Real-time exchange rates (when API configured)
- Clear conversion breakdown
- Handles decimal amounts
- Validates currency codes

## Usage

The skill accepts an amount and source/target currency codes.

## Example

```python
result = currency_converter(
    amount=100.0,
    from_currency="USD",
    to_currency="EUR"
)
```

## Supported Currencies

- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- CHF (Swiss Franc)
- CNY (Chinese Yuan)
- And many more...

## Output Format

Returns a formatted string with:
- Original amount and currency
- Converted amount and currency
- Exchange rate used
- Calculation breakdown

## Notes

- Uses demonstration exchange rates by default
- Configure EXCHANGE_RATE_API_KEY for live rates
- Rates are approximate and for informational purposes
- Always verify rates for financial transactions