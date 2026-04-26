"""PostgreSQL database connection handling."""

import os
import json
import base64
import logging
from typing import Optional
import asyncpg

logger = logging.getLogger(__name__)

_db_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> Optional[asyncpg.Pool]:
    """Get or create a PostgreSQL connection pool."""
    global _db_pool
    
    if _db_pool is not None:
        return _db_pool
    
    pg_credentials = os.getenv("DATABASES_FOR_POSTGRESQL_CONNECTION")
    if not pg_credentials:
        return None
    
    logger.info("Connecting to PostgreSQL instance...")
    
    try:
        # Parse credentials
        creds = json.loads(pg_credentials)
        
        # Extract connection details
        username = creds["postgres"]["authentication"]["username"]
        password = creds["cli"]["environment"]["PGPASSWORD"]
        hostname = creds["postgres"]["hosts"][0]["hostname"]
        port = creds["postgres"]["hosts"][0]["port"]
        database = creds["postgres"]["database"]
        
        # Decode certificate
        cert_base64 = creds["postgres"]["certificate"]["certificate_base64"]
        cert = base64.b64decode(cert_base64).decode("utf-8")
        
        # Create connection pool with SSL
        _db_pool = await asyncpg.create_pool(
            user=username,
            password=password,
            host=hostname,
            port=port,
            database=database,
            ssl="require",
            server_settings={
                "application_name": "metrics-example-app"
            },
            min_size=2,
            max_size=10,
            command_timeout=15,
            timeout=15
        )
        
        logger.info("Successfully connected to PostgreSQL")
        return _db_pool
        
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        raise


async def execute_query(query: str):
    """Execute a query and return results."""
    if _db_pool is None:
        raise RuntimeError("Database pool not initialized")
    
    async with _db_pool.acquire() as conn:
        return await conn.fetch(query)


async def close_db_pool():
    """Close the database connection pool."""
    global _db_pool
    if _db_pool is not None:
        await _db_pool.close()
        _db_pool = None
        logger.info("DB connection closed")

# Made with Bob
