# FaceIn

Project ini dibuat untuk memenuhi tugas mata kuliah **Jaringan Syaraf Komputer** - Universitas Indraprasta PGRI.

Apa itu FaceIn? FaceIn adalah sistem absensi otomatis berbasis pengenalan wajah dan verifikasi ekspresi. Mahasiswa melakukan absensi melalui webcam jadi sistem mendeteksi wajah, mengenali identitas, dan memverifikasi kehadiran dengan meminta senyuman sebelum absensi dicatat.

Sistem mencatat **jam masuk** dan **jam keluar** setiap mahasiswa secara harian.

---

## Daftar Isi

- [Tim Pengembang](#tim-pengembang)
- [Fitur Utama](#fitur-utama)
- [Teknologi & Tools](#teknologi--tools)
- [Model AI yang Digunakan](#model-ai-yang-digunakan)
- [Alur Kerja Absensi](#alur-kerja-absensi)
- [Cara Instalasi](#cara-instalasi)
- [Cara Daftar Mahasiswa Baru](#cara-daftar-mahasiswa-baru)
- [Mengelola faces_db Secara Manual](#mengelola-faces_db-secara-manual)
- [Konfigurasi (.env)](#konfigurasi-env)
- [Struktur Folder](#struktur-folder)

---

## Tim Pengembang

| Nama | NIM | Peran |
|---|---|---|
| Muhammad Iihab Wahyudin | 202243502636 | UI/UX Designer |
| Tobi Saputra | 202243502612 | Machine Learning Engineer |
| Muhammad Zulfahmi | 202243502609 | Database Engineer |

---

## Fitur Utama

- **Deteksi wajah real-time** - bounding box langsung muncul di kamera menggunakan YOLOv8
- **Pengenalan wajah** - identifikasi mahasiswa menggunakan DeepFace (Facenet512)
- **Liveness check / anti-spoofing** - wajib tersenyum sebelum absensi dicatat, mencegah penggunaan foto
- **Absen masuk & keluar** - scan pertama = masuk, scan kedua di hari yang sama = keluar
- **Rekap absensi** - tabel rekap harian dan statistik kehadiran per mahasiswa
- **Manajemen mahasiswa** - tambah, hapus, dan update foto wajah mahasiswa

---

## Teknologi & Tools

### Backend

| Library / Tool | Versi | Fungsi |
|---|---|---|
| Python | 3.13 | Runtime backend |
| FastAPI | ≥0.111.0 | Framework REST API |
| Uvicorn | ≥0.29.0 | ASGI server untuk menjalankan FastAPI |
| SQLAlchemy | ≥2.0.36 | ORM untuk akses database |
| SQLite | bawaan Python | Database penyimpanan mahasiswa & absensi |
| python-multipart | ≥0.0.9 | Parsing `multipart/form-data` (upload foto) |
| Pillow | ≥11.0.0 | Manipulasi gambar |
| NumPy | ≥2.0.0 | Operasi array/matriks gambar |
| OpenCV (`opencv-python`) | ≥4.10.0 | Decode gambar dari bytes, konversi warna |
| Ultralytics (YOLOv8/YOLO11) | ≥8.2.0 | Deteksi wajah & deteksi emosi |
| DeepFace | ≥0.0.93 | Pengenalan wajah (face recognition) |
| TensorFlow + tf-keras | latest | Backend model Facenet512 milik DeepFace |
| python-dotenv | 1.0.1 | Membaca konfigurasi dari file `.env` |
| aiofiles | 23.2.1 | Operasi file async (simpan foto) |

### Frontend

| Library / Tool | Versi | Fungsi |
|---|---|---|
| React | ^18.3.1 | Library UI utama |
| Vite | ^5.3.1 | Build tool & dev server |
| react-webcam | ^7.2.0 | Akses kamera dan screenshot dari browser |
| axios | ^1.7.2 | HTTP client untuk memanggil REST API backend |
| react-router-dom | ^6.23.1 | Routing antar halaman (SPA) |
| date-fns | ^3.6.0 | Format tanggal dan waktu |
| Font Awesome Free | ^7.2.0 | Ikon-ikon UI |

---

## Model AI yang Digunakan

| Model | File | Peran |
|---|---|---|
| YOLOv8n-face | `yolov8n-face.pt` | Deteksi posisi wajah di frame kamera |
| Facenet512 (DeepFace) | diunduh otomatis | Pengenalan & pencocokan identitas wajah |
| YOLO Emotion | `emotion_best.pt` | Deteksi ekspresi wajah untuk liveness check |

**YOLOv8n-face** digunakan untuk mendeteksi wajah secara real-time. Hasilnya berupa bounding box yang ditampilkan di kamera sekaligus digunakan untuk crop area wajah sebelum masuk ke proses pengenalan. Hanya deteksi dengan confidence ≥ 0.5 yang diproses.

**Facenet512** adalah model pengenalan wajah yang mengubah gambar wajah menjadi vektor 512 dimensi (embedding). Vektor ini dibandingkan dengan semua foto di `faces_db/` menggunakan cosine distance - jika jarak terkecil masih di bawah `FACE_MATCH_TOLERANCE` (default `0.45`), wajah dianggap cocok dan identitas mahasiswa dikembalikan.

**YOLO Emotion** (`emotion_best.pt`) digunakan sebagai liveness check agar absensi tidak bisa ditipu dengan foto. Model ini mendeteksi 7 ekspresi (`angry`, `disgust`, `fear`, `happy`, `neutral`, `sad`, `surprise`). Absensi baru dicatat setelah kelas `happy` terdeteksi dengan confidence ≥ 0.80 pada 3 frame berturut-turut (sekitar 0.6 detik).

---

## Alur Kerja Absensi

Berikut adalah penjelasan lengkap apa yang terjadi dari awal hingga absensi berhasil dicatat:

### Langkah 1 - Tekan Tombol "Scan Wajah"

Mahasiswa menekan tombol **Scan Wajah** di halaman absensi. Browser langsung mengambil satu gambar (screenshot) dari webcam dan mengirimkannya ke server.

### Langkah 2 - Pengenalan Wajah

Server menerima gambar tersebut dan mulai memproses:

1. **Deteksi wajah** - Model YOLOv8 mencari posisi wajah dalam gambar dan memotong (crop) area wajah saja, membuang latar belakang.
2. **Pengenalan identitas** - Wajah hasil crop dianalisis oleh Facenet512 untuk menghasilkan "sidik jari digital" wajah (vektor 512 angka). Sidik jari ini lalu dibandingkan dengan semua foto mahasiswa yang sudah terdaftar di database.
3. **Keputusan** - Jika ada kecocokan (jarak cosine ≤ 0.45), server mengembalikan nama dan data mahasiswa yang cocok. Jika tidak ada yang cocok, muncul pesan *"Wajah tidak dikenali"* dan proses berhenti.

### Langkah 3 - Verifikasi Senyum (Liveness Check)

Setelah wajah dikenali, nama mahasiswa ditampilkan di layar dan sistem meminta mahasiswa untuk **tersenyum**. Ini dilakukan untuk memastikan yang absen adalah orang sungguhan, bukan foto.

Kamera terus-menerus mengambil gambar setiap 200ms dan mengirimkannya ke server. Server menggunakan model YOLO Emotion untuk mendeteksi apakah ekspresi yang terdeteksi adalah `happy` (senyum) dengan tingkat keyakinan ≥ 80%. Agar absensi tidak mudah terpicu secara tidak sengaja, sistem membutuhkan **3 frame berturut-turut** yang terdeteksi senyum (sekitar 0.6 detik) sebelum lanjut ke langkah berikutnya.

Jika dalam 30 detik belum ada senyum yang terdeteksi, proses dibatalkan otomatis dan mahasiswa diminta mengulang dari awal.

### Langkah 4 - Pencatatan Absensi

Setelah senyum terverifikasi, sistem mencatat kehadiran ke database:

- **Scan pertama** di hari tersebut → dicatat sebagai **Absen Masuk** beserta jam saat itu
- **Scan kedua** di hari yang sama → dicatat sebagai **Absen Keluar**
- **Scan ketiga** dan seterusnya di hari yang sama → ditolak (sudah absen lengkap)

### Langkah 5 - Hasil & Cooldown

Hasil absensi (nama, jenis absen, jam) ditampilkan di panel kanan. Tombol Scan Wajah nonaktif selama **5 detik** (cooldown) untuk mencegah scan berulang secara tidak sengaja.

---

## Cara Instalasi

### Persyaratan

- Python 3.13+
- Node.js 18+
- Webcam

### 1. Backend

```bash
cd backend

# Buat virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux / Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Jalankan server
python run.py
```

Server berjalan di `http://localhost:8000`  
Dokumentasi API interaktif: `http://localhost:8000/docs`

> **Catatan:** Saat pertama kali dijalankan, model **Facenet512 (~90MB)** akan otomatis diunduh oleh DeepFace. Pastikan koneksi internet tersedia.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplikasi berjalan di `http://localhost:5173`

---

## Cara Daftar Mahasiswa Baru

1. Buka `http://localhost:5173` → menu **Mahasiswa**
2. Klik **+ Tambah Mahasiswa**
3. Isi **Nama**, **NPM**, dan **Program Studi**
4. Upload foto wajah yang jelas
5. Klik **Simpan**

Foto disimpan di `backend/faces_db/<id_mahasiswa>/`

**Tips foto yang baik:**
- Wajah menghadap lurus ke kamera
- Pencahayaan dari depan, tidak backlight
- Satu wajah per foto, resolusi minimal 200×200 px
- Upload beberapa foto dari sudut berbeda untuk akurasi lebih tinggi

---

## Mengelola `faces_db` Secara Manual

`faces_db/` adalah folder tempat foto wajah mahasiswa disimpan. Setiap mahasiswa memiliki subfolder sendiri berdasarkan ID-nya yang dibuat otomatis saat mahasiswa didaftarkan melalui UI.

> **Note penting:** Sistem ini **tidak melatih model AI**. DeepFace Facenet512 adalah model pre-trained yang sudah jadi. Foto yang diupload hanya digunakan sebagai **referensi pencocokan** - semakin banyak foto, semakin banyak referensi yang tersedia, sehingga pengenalan makin akurat. Menambah foto bukan training, melainkan enrollment.

### Struktur folder

```
backend/faces_db/
├── 1/
│   ├── tobi.jpg
│   └── tobi2.jpg
├── 2/
│   └── iihab.jpg
└── 3/
    ├── zulfahmi1.jpg
    ├── zulfahmi2.jpg
    └── zulfahmi3.jpg
```

### Tambah foto secara manual

Selain upload melalui UI, foto juga bisa ditambahkan langsung ke folder. Cukup salin file foto ke subfolder ID mahasiswa yang sesuai:

```bash
# Contoh: tambah foto untuk mahasiswa dengan ID 1
cp foto_baru.jpg backend/faces_db/1/
```

Format yang didukung: `.jpg`, `.jpeg`, `.png`

> **Penting:** Setelah menambah foto secara manual, hapus file cache DeepFace (`.pkl`) di dalam `faces_db/` agar foto baru ikut digunakan saat pengenalan:
> ```bash
> del backend\faces_db\*.pkl
> ```
> Cache ini dibuat otomatis oleh DeepFace dan akan diperbarui pada scan berikutnya. Jika tidak dihapus, foto yang baru ditambahkan secara manual tidak akan dikenali.

### Hapus foto

```bash
# Hapus satu foto
rm backend/faces_db/1/foto_lama.jpg

# Hapus semua foto mahasiswa ID 1 - mahasiswa tidak akan bisa dikenali
rm -rf backend/faces_db/1/
```

> Menghapus folder tidak menghapus data absensi dari database. Rekap tetap tersimpan di `absensi.db`.

### Reset semua data wajah

```bash
rm -rf backend/faces_db/*
```

Setelah reset, daftarkan ulang mahasiswa melalui menu **Mahasiswa** di web.

### Meningkatkan akurasi pengenalan

Disarankan upload minimal **3–5 foto** per mahasiswa dengan variasi sudut dan pencahayaan. Jika pengenalan sering gagal, coba:

1. Tambah lebih banyak foto dari berbagai sudut
2. Naikkan nilai `FACE_MATCH_TOLERANCE` di `.env` (default `0.45`, maksimal sekitar `0.6`)
3. Pastikan foto memiliki wajah yang jelas, tidak blur, dan pencahayaan cukup

---

## Konfigurasi (.env)

File `backend/.env`:

```env
SECRET_KEY=ganti_dengan_secret_key_yang_kuat
DATABASE_URL=sqlite:///./absensi.db
ALLOWED_ORIGINS=http://localhost:5173

# Cosine distance threshold Facenet512
# Makin kecil = makin ketat. Naikkan jika sering gagal dikenali.
FACE_MATCH_TOLERANCE=0.45
```

---

## Struktur Folder

```
sistem-absensi/
├── backend/
│   ├── app/
│   │   ├── main.py               # Entry point FastAPI, CORS config
│   │   ├── config.py             # Baca variabel dari .env
│   │   ├── models/
│   │   │   ├── database.py       # Tabel SQLAlchemy: Mahasiswa, Absensi
│   │   │   └── schemas.py        # Schema Pydantic (request/response)
│   │   ├── routers/
│   │   │   ├── mahasiswa.py      # CRUD mahasiswa + upload/update foto
│   │   │   └── absensi.py        # Endpoint: scan, kenali, cek-senyum, rekap, statistik
│   │   └── services/
│   │       └── face_service.py   # Semua logika AI: YOLO deteksi, DeepFace kenali, YOLO emosi
│   ├── faces_db/                 # Foto wajah per mahasiswa (subfolder per ID)
│   ├── models_yolo/
│   │   ├── yolov8n-face.pt       # Model YOLO deteksi wajah
│   │   └── emotion_best.pt       # Model YOLO deteksi emosi (happy/sad/dll)
│   ├── .env                      # Konfigurasi environment
│   ├── requirements.txt
│   └── run.py                    # Script menjalankan uvicorn
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HalamanAbsensi.jsx          # Halaman scan (webcam + flow absensi)
│   │   │   ├── HalamanDaftarMahasiswa.jsx  # CRUD mahasiswa + upload foto
│   │   │   └── HalamanRekap.jsx            # Rekap harian & statistik kehadiran
│   │   ├── api/index.js          # Semua pemanggilan REST API ke backend
│   │   ├── App.jsx               # Router dan layout utama
│   │   └── index.css             # Styling global
│   └── package.json
│
└── Facial Emotion Detection/
    ├── best.pt                   # Model YOLO emosi (sumber emotion_best.pt)
    └── main.py                   # Script referensi penggunaan model emosi
```
