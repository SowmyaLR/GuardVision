#!/usr/bin/env python3
"""
GuardVision Setup Validation Script
Verifies that all services are running correctly after docker compose up
"""

import sys
import time
import urllib.request
import urllib.error


def check_service(name: str, url: str, timeout: int = 5) -> bool:
    """Check if a service is responding"""
    try:
        print(f"Checking {name}...", end=" ")
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                print("✅ OK")
                return True
            else:
                print(f"❌ FAILED (Status: {response.status})")
                return False
    except urllib.error.URLError as e:
        print(f"❌ FAILED ({str(e)})")
        return False
    except Exception as e:
        print(f"❌ FAILED ({str(e)})")
        return False


def main():
    print("=" * 60)
    print("GuardVision Setup Validation")
    print("=" * 60)
    print()
    
    services = [
        ("Backend API", "http://localhost:9000/health"),
        ("Frontend UI", "http://localhost:3000"),
        ("API Documentation", "http://localhost:9000/docs"),
    ]
    
    print("Waiting for services to start (this may take 30-60 seconds)...")
    print()
    time.sleep(5)  # Give services time to start
    
    results = []
    for name, url in services:
        results.append(check_service(name, url))
    
    print()
    print("=" * 60)
    
    if all(results):
        print("✅ All services are running correctly!")
        print()
        print("Next steps:")
        print("  • Frontend:  http://localhost:3000")
        print("  • Backend:   http://localhost:9000")
        print("  • API Docs:  http://localhost:9000/docs")
        print()
        print("You're ready to start developing! 🚀")
        sys.exit(0)
    else:
        print("❌ Some services failed to start")
        print()
        print("Troubleshooting:")
        print("  1. Check if docker compose is running:")
        print("     docker compose ps")
        print()
        print("  2. View service logs:")
        print("     docker compose logs frontend")
        print("     docker compose logs api")
        print()
        print("  3. Restart services:")
        print("     docker compose restart")
        print()
        print("  4. See troubleshooting guide in README.md")
        sys.exit(1)


if __name__ == "__main__":
    main()
