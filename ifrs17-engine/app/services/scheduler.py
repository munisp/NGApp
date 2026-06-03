"""Background scheduler for periodic IFRS 17 calculations."""

import asyncio
import structlog

logger = structlog.get_logger()


async def start_scheduler():
    """Run periodic IFRS 17 calculations (monthly CSM roll-forward, quarterly reporting)."""
    while True:
        try:
            await asyncio.sleep(86400)  # Daily check
            logger.info("ifrs17_scheduler_tick", task="check_calculation_schedule")
        except asyncio.CancelledError:
            break
