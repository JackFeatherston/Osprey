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
    missing = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        print("💡 Create a .env file with your Alpaca credentials")
        print("💡 Use .env.example as a template")
        return False
    
    print("✅ Environment variables configured")
    return True

def main():
    print("🚀 Starting Trading Assistant Backend...")
    
    # Check prerequisites
    env_ok = check_env()
    
    if not env_ok:
        print("\n⚠️  Environment not properly configured. Backend will run but AI engine will be disabled.")
        response = input("Continue anyway? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            sys.exit(1)
    
    print("\n🎯 Starting FastAPI server...")
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()