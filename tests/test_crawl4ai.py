#!/usr/bin/env python3
import asyncio
from crawl4ai import AsyncWebCrawler

async def test_crawl():
    print("Testing Crawl4AI...")
    try:
        async with AsyncWebCrawler(verbose=True) as crawler:
            print("Crawler initialized successfully")
            result = await crawler.arun(url="http://books.toscrape.com/")
            print(f"Success: {result.success}")
            if result.success:
                print(f"Title: {result.metadata.get('title', 'N/A')}")
                print(f"Markdown length: {len(result.markdown) if result.markdown else 0}")
            else:
                print(f"Error: {result.error_message}")
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_crawl())