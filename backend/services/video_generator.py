import fal_client
import os
from dotenv import load_dotenv

load_dotenv()

async def generate_video_from_image(
    image_url: str, 
    prompt: str, 
    ratio: str = "16:9",
    # New Arguments for Camera Control
    zoom: float = 0.0,      # Range: -10 to 10 (Negative = Zoom Out)
    horizontal: float = 0.0, # Range: -10 to 10 (Negative = Pan Left)
    vertical: float = 0.0    # Range: -10 to 10 (Negative = Pan Down)
):
    print(f"🎥 Action! Zoom: {zoom}, Pan X: {horizontal}, Pan Y: {vertical}")

    try:
        handler = await fal_client.submit_async(
            "fal-ai/kling-video/v1.6/standard/image-to-video",
            arguments={
                "prompt": prompt, 
                "image_url": image_url,
                "aspect_ratio": "16:9",
                "duration": "5",
                # The "Director" Object
                "camera_control": {
                    "config": {
                        "horizontal": horizontal,
                        "vertical": vertical,
                        "zoom": zoom,
                        "roll": 0,
                        "tilt": 0
                    }
                }
            },
        )
        result = await handler.get()
        if result and "video" in result:
            return result["video"]["url"]
            
    except Exception as e:
        print(f"Video Error: {e}")
        raise Exception(f"Video Generation Failed: {str(e)}")
    
    raise Exception("Model returned no video.")