
from PIL import Image
import os

source_path = r"C:\Users\fabri\.gemini\antigravity\brain\3c4c9bfc-e1a3-4b30-ac22-c779469cde42\media__1770308922728.jpg"
dest_path = r"c:\Projetos\VOKE\Bingola\V.02bingola PWA\bingola-pwa\resources\icon.png"

try:
    with Image.open(source_path) as img:
        img.save(dest_path, 'PNG')
    print(f"Successfully converted {source_path} to {dest_path}")
except Exception as e:
    print(f"Error converting image: {e}")
