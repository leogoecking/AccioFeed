import argparse
import asyncio

from app.workers.scheduler import IngestionScheduler


def main():
    parser = argparse.ArgumentParser(description="Tech News Hub Ingestion Worker")
    parser.add_argument(
        "--run-once",
        action="store_true",
        help="Run collection cycle once and exit",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Polling interval in seconds",
    )
    args = parser.parse_args()

    scheduler = IngestionScheduler(interval_seconds=args.interval)
    asyncio.run(scheduler.start(run_once=args.run_once))


if __name__ == "__main__":
    main()
