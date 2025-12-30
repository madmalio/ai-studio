import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

print("--- YOUR AVAILABLE MODELS ---")
try:
    # This asks Google: "What models can I use?"
    for model in client.models.list():
        # We only care about models that can generate images
        if "vision" in model.name or "image" in model.name or "gemini" in model.name:
            print(f"- {model.name}")
            
    print("\n--- CHECKING METHODS ---")
    # This checks if your library has 'generate_image' or 'generate_images'
    methods = [m for m in dir(client.models) if "generate" in m]
    print(f"Available commands: {methods}")

except Exception as e:
    print(f"Error: {e}")