from typing import Annotated

from pydantic import BaseModel, Field


class Model(BaseModel):
    base_url: Annotated[str, Field()] | None
    api_key: Annotated[str, Field()] | None = "DEFAULT"
    model: Annotated[str, Field()] | None = "watsonx/ibm/granite-3-3-8b-instruct"
    project_id: Annotated[str, Field()] | None = "DEFAULT"


class CityLocation(BaseModel):
    city: str
    country: str
