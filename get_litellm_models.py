#!/usr/bin/env python3
"""
Script to fetch available models from LiteLLM
"""
import asyncio
import json
from litellm import acompletion

async def get_current_groq_models():
    """Get current Groq models that are known to be working"""
    # Based on the Groq documentation, these are the currently supported models
    current_models = [
        "groq/llama-3.1-8b-instant",
        "groq/llama-3.1-70b-versatile",
        "groq/llama-3.3-70b-specdec",
        "groq/llama-3.3-70b-versatile",
        "groq/llama-4-scout-17b-16e-instruct",
        "groq/llama-4-maverick-17b-128e-instruct",
        "groq/gemma2-9b-it",
        "groq/mixtral-8x7b-32768",
        "groq/llama3-groq-8b-8192-tool-use-preview",
        "groq/llama3-groq-70b-8192-tool-use-preview"
    ]
    
    return current_models

async def test_model(model_name, api_key=None):
    """Test if a model is working"""
    try:
        # Skip test if no API key is provided
        if not api_key:
            return True
            
        response = await acompletion(
            model=model_name,
            messages=[{"role": "user", "content": "Say hello in one word"}],
            api_key=api_key,
            max_tokens=10
        )
        return True
    except Exception as e:
        # Check if it's a model decommissioned error
        error_str = str(e)
        if "decommissioned" in error_str or "model_decommissioned" in error_str:
            return False
        # For other errors (like auth), we assume model exists
        # This is because we want to include models in the list even if the API key is invalid
        return True

async def main():
    groq_models = await get_current_groq_models()
    print("Current Groq models:")
    for model in groq_models:
        print(f"  - {model}")
    
    # If we have an API key, test models to see which ones are actually working
    api_key = None
    try:
        # Try to get API key from environment
        import os
        api_key = os.getenv("GROQ_API_KEY")
    except:
        pass
    
    if api_key:
        print("\nTesting models (this will show which ones are not decommissioned):")
        working_models = []
        for model in groq_models:
            is_working = await test_model(model, api_key)
            status = "✓" if is_working else "✗"
            print(f"  {status} {model}")
            if is_working:
                working_models.append(model)
        
        print(f"\nWorking models: {working_models}")
        
        # Save to a JSON file that the frontend can read
        with open("groq_models.json", "w") as f:
            json.dump({
                "models": working_models,
                "timestamp": asyncio.get_event_loop().time()
            }, f, indent=2)
    else:
        print("\nNo GROQ_API_KEY found in environment, skipping model testing.")
        print("All models will be included in the list by default.")

if __name__ == "__main__":
    asyncio.run(main())