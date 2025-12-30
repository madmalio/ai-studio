import os
import fal_client
from dotenv import load_dotenv

load_dotenv()

async def generate_cinematic_image(
    prompt: str,
    camera: str,
    lens: str,
    focal_length: str,
    aspect_ratio: str = "16:9",
    reference_images: list[str] = [],
    image_strength: float = 0.75
):
    """
    Generates an image using Fal.ai.
    - If NO image: Uses Standard Flux Dev.
    - If YES image: Uses Flux PuLID (Face Identity Preservation).
    """

    # Resolution Map
    size_map = {
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
        "1:1": "square_hd",
        "4:3": "landscape_4_3",
        "21:9": {"width": 1680, "height": 720}
    }

    # Construct the technical prompt
    tech_prompt = f"Shot on {camera} with a {lens} {focal_length} lens. Cinematic lighting, photorealistic, 8k, film grain."
    full_prompt = f"{prompt}. {tech_prompt}"

    print(f"🎬 Generating prompt: {full_prompt}")

    # --- LOGIC SPLIT ---

    # CASE 1: FACE IDENTITY (PuLID) - When an image is uploaded
    if reference_images and len(reference_images) > 0:
        model = "fal-ai/flux-pulid"
        print(f"   -> Mode: Face Identity (PuLID) | ID Strength: {image_strength}")
        
        arguments = {
            "prompt": full_prompt,
            "reference_image_url": reference_images[0], 
            "id_weight": image_strength, 
            "image_size": size_map.get(aspect_ratio, "landscape_16_9"), 
            "num_inference_steps": 28, 
            "guidance_scale": 3.0,
            "enable_safety_checker": False,
            "sync_mode": True
        }

    # CASE 2: TEXT-TO-IMAGE (Standard)
    else:
        model = "fal-ai/flux/dev"
        print(f"   -> Mode: Text-to-Image")

        selected_size = size_map.get(aspect_ratio, "landscape_16_9")
        arguments = {
            "prompt": full_prompt,
            "image_size": selected_size, 
            "num_inference_steps": 30,
            "guidance_scale": 3.0,
            "enable_safety_checker": False,
            "sync_mode": True
        }

    # Submit
    try:
        handler = await fal_client.submit_async(
            model,
            arguments=arguments,
        )
        result = await handler.get()

        if result and "images" in result and len(result["images"]) > 0:
            return result["images"][0]["url"]

    except Exception as e:
        print(f"Fal Error: {e}")
        raise Exception(f"Fal Generation Failed: {str(e)}")

    raise Exception("Fal returned no images.")