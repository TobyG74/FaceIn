from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import ALLOWED_ORIGINS, FACES_DB_DIR
from app.models.database import init_db
from app.routers import mahasiswa, absensi

app = FastAPI(
    title="FaceIn",
    description="Absensi otomatis menggunakan YOLO + face recognition",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(FACES_DB_DIR, exist_ok=True)
app.mount("/faces_db", StaticFiles(directory=FACES_DB_DIR), name="faces_db")

app.include_router(mahasiswa.router)
app.include_router(absensi.router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"pesan": "Server FaceIn berjalan"}
