import asyncio

from dotenv import load_dotenv
from utils.core import chat, config
from utils.design import layout

load_dotenv()


async def main():
    await config.initialize()
    await layout.initialize()
    await chat.initialize()


if __name__ == "__main__":
    asyncio.run(main())
