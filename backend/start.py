#!/usr/bin/env python3
"""
Startup script for the Trading Assistant Backend
"""

import subprocess
import sys
import os


def check_env():
    """Check if environment variables are set"""
    required_vars = ["ALPACA_API_KEY", "ALPACA_SECRET_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        return False

    return True

def main():
    env_ok = check_env()

    if not env_ok:
        response = input("Environment not configured. Continue anyway? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            sys.exit(1)

    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ])

if __name__ == "__main__":
    main()