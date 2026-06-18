import os
import cv2
import numpy as np
from ultralytics import YOLO
from deepface import DeepFace
from app.config import FACES_DB_DIR, FACE_MATCH_TOLERANCE

_YOLO_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models_yolo", "yolov8n-face.pt")
_yolo_model = None


def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = YOLO(_YOLO_MODEL_PATH)
    return _yolo_model


def deteksi_kotak_wajah(image_array: np.ndarray, conf_min: float = 0.4) -> list:
    """deteksi semua kotak wajah di frame (dipakai buat grid peserta meeting)"""
    model = get_yolo_model()
    hasil = model(image_array, verbose=False, conf=conf_min)[0]
    if len(hasil.boxes) == 0:
        return []
    kotak = []
    for box in hasil.boxes:
        conf = float(box.conf[0])
        if conf < conf_min:
            continue
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        kotak.append({"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1, "conf": round(conf, 2)})
    return kotak


def _crop_box(image_array: np.ndarray, box: dict, pad: int = 12) -> np.ndarray:
    """potong satu wajah dari frame berdasarkan kotak deteksi, dengan sedikit padding"""
    H, W = image_array.shape[:2]
    x1 = max(0, box["x"] - pad)
    y1 = max(0, box["y"] - pad)
    x2 = min(W, box["x"] + box["w"] + pad)
    y2 = min(H, box["y"] + box["h"] + pad)
    return image_array[y1:y2, x1:x2]


def hapus_cache_wajah():
    """hapus cache .pkl DeepFace — dipanggil tiap kali foto mahasiswa berubah"""
    if not os.path.exists(FACES_DB_DIR):
        return
    for nama_file in os.listdir(FACES_DB_DIR):
        if nama_file.endswith(".pkl"):
            os.remove(os.path.join(FACES_DB_DIR, nama_file))


def _ada_wajah_terdaftar() -> bool:
    """cek faces_db punya minimal 1 subfolder mahasiswa"""
    if not os.path.exists(FACES_DB_DIR):
        return False
    return any(
        os.path.isdir(os.path.join(FACES_DB_DIR, d))
        for d in os.listdir(FACES_DB_DIR)
    )


def _kenali_crop(wajah_bgr: np.ndarray) -> tuple[int | None, float | None]:
    """kenali satu crop wajah → (mahasiswa_id, jarak) atau (None, jarak/None)"""
    if wajah_bgr is None or wajah_bgr.size == 0:
        return None, None

    wajah_rgb = cv2.cvtColor(wajah_bgr, cv2.COLOR_BGR2RGB)
    try:
        # detector_backend="skip" karena crop sudah pasti wajah dari YOLO
        hasil = DeepFace.find(
            img_path=wajah_rgb,
            db_path=FACES_DB_DIR,
            model_name="Facenet512",
            detector_backend="skip",
            distance_metric="cosine",
            threshold=1.0,           # ambil semua kandidat, filter manual di bawah
            enforce_detection=False,
            silent=True,
        )
    except Exception:
        return None, None

    if not hasil or hasil[0].empty:
        return None, None

    df = hasil[0]
    col_dist = next((c for c in df.columns if "distance" in c.lower()), df.columns[-1])
    baris = df.sort_values(col_dist).iloc[0]
    jarak = float(baris[col_dist])

    if jarak > FACE_MATCH_TOLERANCE:
        return None, jarak

    rel_path = os.path.relpath(baris["identity"], FACES_DB_DIR)
    mahasiswa_id = int(rel_path.split(os.sep)[0])
    return mahasiswa_id, jarak


def kenali_banyak_wajah(image_bytes: bytes) -> list[dict]:
    """
    deteksi SEMUA wajah di satu frame (grid peserta meeting) lalu kenali tiap wajah.
    return list: [{box, mahasiswa_id, jarak}, ...]
    box yang tak dikenali tetap dikembalikan dengan mahasiswa_id=None.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    gambar_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if gambar_bgr is None:
        return []

    kotak = deteksi_kotak_wajah(gambar_bgr)
    if not kotak:
        return []

    db_siap = _ada_wajah_terdaftar()

    hasil = []
    for box in kotak:
        if db_siap:
            crop = _crop_box(gambar_bgr, box)
            mahasiswa_id, jarak = _kenali_crop(crop)
        else:
            mahasiswa_id, jarak = None, None
        hasil.append({"box": box, "mahasiswa_id": mahasiswa_id, "jarak": jarak})

    dikenali = sum(1 for h in hasil if h["mahasiswa_id"] is not None)
    print(f"[scan] {len(kotak)} wajah terdeteksi, {dikenali} dikenali")
    return hasil
