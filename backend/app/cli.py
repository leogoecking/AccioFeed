import argparse
import asyncio
import sys

from app.core.database import async_session_factory
from app.core.seed import seed_sources
from app.workers.scheduler import IngestionScheduler


def run_seed():
    async def _seed():
        async with async_session_factory() as session:
            sources = await seed_sources(session)
            print(f"Successfully seeded {len(sources)} sources:")
            for s in sources:
                print(f"  - [{s.type}] {s.name} ({s.slug}) -> category: {s.default_category}")

    asyncio.run(_seed())


def run_sync(force: bool = True):
    async def _sync():
        print("========================================")
        print("         Tech News Hub Sync             ")
        print("========================================\n")

        scheduler = IngestionScheduler()
        results = await scheduler.run_single_cycle(force=force)

        success_count = 0
        failed_count = 0
        total_new = 0

        for r in results:
            name = r.get("name", r.get("source", "Unknown"))
            status = r.get("status", "unknown")
            fetched = r.get("fetched", 0)
            new_articles = r.get("new", 0)
            duplicates = r.get("duplicates", 0)
            duration_ms = r.get("duration_ms", 0)

            if status == "success":
                success_count += 1
                total_new += new_articles
                print(f"{name}")
                print(f"  Status: SUCCESS ({duration_ms}ms)")
                print(f"  Fetched: {fetched}")
                print(f"  New: {new_articles}")
                print(f"  Duplicates: {duplicates}\n")
            elif status == "skipped":
                print(f"{name}")
                print("  Status: SKIPPED (poll interval not elapsed)\n")
            else:
                failed_count += 1
                err = r.get("error", "Unknown error")
                print(f"{name}")
                print(f"  Status: FAILED ({duration_ms}ms)")
                print(f"  Error: {err}\n")

        print("----------------------------------------")
        print(f"Sources: {len(results)}")
        print(f"Success: {success_count}")
        print(f"Failed: {failed_count}")
        print(f"New articles: {total_new}")
        print("========================================")

    asyncio.run(_sync())


def main():
    parser = argparse.ArgumentParser(description="Tech News Hub CLI Utility")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # sync command
    sync_parser = subparsers.add_parser("sync", help="Run a manual sync cycle across all sources")
    sync_parser.add_argument(
        "--no-force",
        action="store_true",
        help="Respect poll_interval_minutes and do not force poll if not due",
    )

    # seed command
    subparsers.add_parser("seed", help="Seed default sources into database")

    args = parser.parse_args()

    if args.command == "sync":
        run_sync(force=not args.no_force)
    elif args.command == "seed":
        run_seed()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
