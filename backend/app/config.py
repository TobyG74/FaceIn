import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "default_secret_key")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./absensi.db")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
FACE_MATCH_TOLERANCE = float(os.getenv("FACE_MATCH_TOLERANCE", "0.5"))

# Folder tempat menyimpan foto wajah mahasiswa
FACES_DB_DIR = os.path.join(os.path.dirname(__file__), "..", "faces_db")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models_yolo")
