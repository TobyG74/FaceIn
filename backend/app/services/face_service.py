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


def deteksi_kotak_wajah(image_array: np.ndarray) -> list:
    model = get_yolo_model()
    hasil = model(image_array, verbose=False, conf=0.5)[0]
    if len(hasil.boxes) == 0:
        return []
    kotak = []
    for box in hasil.boxes:
        conf = float(box.conf[0])
        if conf < 0.5:
            continue
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        kotak.append({"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1, "conf": round(conf, 2)})
    return kotak


def deteksi_dan_crop_wajah(image_array: np.ndarray) -> np.ndarray:
    kotak = deteksi_kotak_wajah(image_array)
    if not kotak:
        return image_array

    k = max(kotak, key=lambda c: c["w"] * c["h"])
    H, W = image_array.shape[:2]
    pad = 20
    x1 = max(0, k["x"] - pad)
    y1 = max(0, k["y"] - pad)
    x2 = min(W, k["x"] + k["w"] + pad)
    y2 = min(H, k["y"] + k["h"] + pad)

    return image_array[y1:y2, x1:x2]


def hapus_cache_wajah():
    """hapus cache .pkl DeepFace — dipanggil tiap kali foto mahasiswa berubah"""
    if not os.path.exists(FACES_DB_DIR):
        return
    for nama_file in os.listdir(FACES_DB_DIR):
        if nama_file.endswith(".pkl"):
            os.remove(os.path.join(FACES_DB_DIR, nama_file))


_EMOTION_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models_yolo", "emotion_best.pt")
_emotion_model = None
_EMOTION_HAPPY_IDX = 3   # {0:angry, 1:disgust, 2:fear, 3:happy, 4:neutral, 5:sad, 6:surprise}
_EMOTION_CONF_THRESHOLD = 0.80


def _get_emotion_model():
    global _emotion_model
    if _emotion_model is None:
        _emotion_model = YOLO(_EMOTION_MODEL_PATH)
    return _emotion_model


def cek_senyum(image_bytes: bytes) -> bool:
    tersenyum, _ = cek_senyum_debug(image_bytes)
    return tersenyum


def cek_senyum_debug(image_bytes: bytes) -> tuple[bool, dict]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    gambar_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if gambar_bgr is None:
        return False, {"error": "decode gagal"}

    hasil = _get_emotion_model()(gambar_bgr, verbose=False, conf=0.3)[0]

    happy_conf = 0.0
    all_detections = []

    for box in hasil.boxes:
        cls_id = int(box.cls[0])
        conf   = float(box.conf[0])
        all_detections.append({"cls": cls_id, "conf": round(conf, 3)})
        if cls_id == _EMOTION_HAPPY_IDX:
            happy_conf = max(happy_conf, conf)

    tersenyum = happy_conf >= _EMOTION_CONF_THRESHOLD
    print(f"[senyum-yolo] happy_conf={happy_conf:.3f} threshold={_EMOTION_CONF_THRESHOLD} tersenyum={tersenyum} detections={all_detections}")
    return tersenyum, {
        "method": "yolo_emotion",
        "happy_conf": round(happy_conf, 3),
        "threshold": _EMOTION_CONF_THRESHOLD,
        "tersenyum": tersenyum,
    }



def kenali_wajah(image_bytes: bytes) -> int | None:
    """kenali wajah dari bytes gambar, balikin ID mahasiswa atau None kalo ga ketemu"""
    nparr = np.frombuffer(image_bytes, np.uint8)
    gambar_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if gambar_bgr is None:
        return None

    wajah_crop = deteksi_dan_crop_wajah(gambar_bgr)

    if wajah_crop.size == 0:
        return None

    # pastikan faces_db ada dan punya minimal 1 subfolder mahasiswa
    if not os.path.exists(FACES_DB_DIR):
        return None
    ada_folder = any(
        os.path.isdir(os.path.join(FACES_DB_DIR, d))
        for d in os.listdir(FACES_DB_DIR)
    )
    if not ada_folder:
        return None

    gambar_rgb = cv2.cvtColor(gambar_bgr, cv2.COLOR_BGR2RGB)

    try:
        # threshold=1.0 biar semua kandidat keluar, nanti kita filter sendiri
        hasil = DeepFace.find(
            img_path=gambar_rgb,
            db_path=FACES_DB_DIR,
            model_name="Facenet512",
            detector_backend="opencv",
            distance_metric="cosine",
            threshold=1.0,
            enforce_detection=False,
            silent=True,
        )

        if not hasil or hasil[0].empty:
            print("[kenali] DeepFace.find() kosong — tidak ada kandidat")
            return None

        df = hasil[0]
        col_dist = next((c for c in df.columns if "distance" in c.lower()), df.columns[-1])
        df = df.sort_values(col_dist)

        baris_terbaik = df.iloc[0]
        jarak_terbaik = float(baris_terbaik[col_dist])
        path_cocok    = baris_terbaik["identity"]

        print(f"[kenali] jarak terbaik = {jarak_terbaik:.4f} (tolerance = {FACE_MATCH_TOLERANCE}) — {path_cocok}")

        if jarak_terbaik > FACE_MATCH_TOLERANCE:
            print(f"[kenali] TOLAK — jarak {jarak_terbaik:.4f} > {FACE_MATCH_TOLERANCE}")
            return None

        path_cocok = baris_terbaik["identity"]
        rel_path = os.path.relpath(path_cocok, FACES_DB_DIR)
        mahasiswa_id = int(rel_path.split(os.sep)[0])
        return mahasiswa_id

    except Exception:
        return None
