from datetime import date, datetime
from typing import Annotated, List

from pydantic import BaseModel, Field, field_validator


class Model(BaseModel):
    base_url: Annotated[str, Field()] | None
    api_key: Annotated[str, Field()] | None = "DEFAULT"
    model: Annotated[str, Field()] | None = "watsonx/ibm/granite-3-3-8b-instruct"
    project_id: Annotated[str, Field()] | None = "DEFAULT"


class CityLocation(BaseModel):
    city: str
    country: str
    not_defined: bool


class CityList(BaseModel):
    cities: List[CityLocation]
    not_defined: bool


class TravelorInterests(BaseModel):
    list: List[str]
    not_defined: bool


class TravelorPreferences(BaseModel):
    list: List[str]
    not_defined: bool


class TravelBuget(BaseModel):
    min: int | float
    max: int | float
    currency: str
    currency_symbol: str
    not_defined: bool


class TravelPeriod(BaseModel):
    from_date: date
    to_date: date
    nights: int
    not_defined: bool

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def ensure_date_format(cls, v):
        if isinstance(v, date):
            return v
        return datetime.strptime(v, "%Y-%m-%d").date()

    def to_dict_formatted(self):
        return {
            "from_date": self.from_date.strftime("%Y-%m-%d"),
            "to_date": self.to_date.strftime("%Y-%m-%d"),
            "nights": self.night,
        }
