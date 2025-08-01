import asyncio
import logging


async def safe_kickoff(crew, retries=2, delay=1):
    for attempt in range(retries + 1):
        try:
            return await crew.kickoff_async()
        except Exception as e:
            if attempt < retries:
                logging.warning(f"kickoff_async failed (attempt {attempt + 1}): {e}, retrying...")
                await asyncio.sleep(delay)
            else:
                logging.error(f"kickoff_async failed after {retries + 1} attempts: {e}")
                raise
