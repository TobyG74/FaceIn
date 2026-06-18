# FaceIn

Project ini dibuat untuk memenuhi tugas mata kuliah **Jaringan Syaraf Komputer** - Universitas Indraprasta PGRI.

Apa itu FaceIn? FaceIn adalah sistem absensi otomatis untuk **meeting online (Google Meet / Zoom)**. Dosen/operator membagikan layar window meeting, lalu sistem mendeteksi **semua wajah peserta yang tampil di grid sekaligus** dalam satu kali scan, mengenali identitas tiap wajah menggunakan pengenalan wajah, dan menandai mereka **hadir** pada sesi meeting tersebut.

Berbeda dari kiosk yang memindai satu orang per scan, FaceIn versi ini memproses **banyak wajah dalam satu frame** — cocok untuk mengecek kehadiran kelas online dengan cepat.

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

- **Capture layar meeting** - bagikan window Google Meet / Zoom langsung dari browser (`getDisplayMedia`)
- **Deteksi banyak wajah sekaligus** - YOLOv8 mendeteksi seluruh wajah pada grid peserta dalam satu frame
- **Pengenalan wajah massal** - tiap wajah dicocokkan ke mahasiswa terdaftar menggunakan DeepFace (Facenet512)
- **Absensi per sesi meeting** - buat sesi (mis. "Pertemuan 5"), tiap peserta dikenali ditandai hadir sekali untuk sesi itu
- **Overlay nama real-time** - kotak + nama digambar di atas tiap wajah hasil scan (hijau = baru hadir, biru = sudah, merah = tidak dikenali)
- **Rekap & statistik** - rekap kehadiran per sesi/mahasiswa dan statistik bulanan
- **Manajemen mahasiswa** - tambah, hapus, dan update foto wajah mahasiswa (enrollment)

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
| react-webcam | ^7.2.0 | Akses kamera saat enrollment foto mahasiswa |
| `getDisplayMedia` (Web API) | bawaan browser | Tangkap layar/window meeting untuk discan |
| axios | ^1.7.2 | HTTP client untuk memanggil REST API backend |
| react-router-dom | ^6.23.1 | Routing antar halaman (SPA) |
| date-fns | ^3.6.0 | Format tanggal dan waktu |
| Font Awesome Free | ^7.2.0 | Ikon-ikon UI |

---

## Model AI yang Digunakan

| Model | File | Peran |
|---|---|---|
| YOLOv8n-face | `yolov8n-face.pt` | Deteksi posisi **semua** wajah pada grid peserta |
| Facenet512 (DeepFace) | diunduh otomatis | Pengenalan & pencocokan identitas tiap wajah |

**YOLOv8n-face** digunakan untuk mendeteksi seluruh wajah dalam satu frame layar meeting. Hasilnya berupa banyak bounding box; tiap box di-crop dan dikirim ke proses pengenalan. Hanya deteksi dengan confidence ≥ 0.4 yang diproses (grid peserta cenderung kecil, jadi ambang sengaja diturunkan).

**Facenet512** mengubah tiap crop wajah menjadi vektor 512 dimensi (embedding) lalu membandingkannya dengan semua foto di `faces_db/` menggunakan cosine distance. Jika jarak terkecil masih di bawah `FACE_MATCH_TOLERANCE` (default `0.35`), wajah dianggap cocok dan mahasiswa ditandai hadir. Pencocokan dilakukan per-wajah, sehingga satu scan bisa menandai banyak peserta sekaligus.

> Verifikasi senyum (anti-spoofing) dari versi kiosk **dihapus** karena tidak praktis untuk banyak wajah sekaligus. File `emotion_best.pt` tidak lagi dipakai.

---

## Alur Kerja Absensi

### Langkah 1 - Buat / Pilih Sesi Meeting

Di halaman **Absensi**, operator membuat sesi baru (mis. *"Pertemuan 5 - Basis Data"*) atau memilih sesi yang sudah ada. Semua kehadiran dari scan akan dicatat ke sesi yang aktif ini.

### Langkah 2 - Bagikan Layar Meeting

Operator menekan **Bagikan Layar**, lalu memilih window Google Meet / Zoom (atau tab/seluruh layar) saat browser meminta. Stream layar tampil sebagai preview di panel kiri. Pastikan **tampilan grid peserta** (galeri) aktif agar banyak wajah terlihat.

### Langkah 3 - Tekan "Scan Kehadiran"

Browser mengambil satu frame dari stream layar (resolusi penuh) dan mengirimkannya ke server. Di server:

1. **Deteksi semua wajah** - YOLOv8 menemukan posisi seluruh wajah di frame dan meng-crop tiap area wajah.
2. **Pengenalan per wajah** - tiap crop diubah Facenet512 menjadi embedding, lalu dibandingkan ke `faces_db/`. Wajah dengan jarak cosine ≤ `FACE_MATCH_TOLERANCE` dianggap cocok.
3. **Pencatatan kehadiran** - tiap mahasiswa yang dikenali dan **belum** tercatat di sesi ini ditambahkan sebagai **hadir** (sekali per sesi). Wajah yang sudah hadir atau tidak dikenali tidak menambah data baru.

### Langkah 4 - Hasil & Overlay

Server mengembalikan daftar wajah beserta koordinat kotak dan nama. Frontend menggambar overlay di atas preview:

- 🟢 **Hijau** - mahasiswa baru saja ditandai hadir di scan ini
- 🔵 **Biru** - mahasiswa dikenali tapi sudah tercatat hadir sebelumnya
- 🔴 **Merah** - wajah terdeteksi tapi tidak dikenali (belum terdaftar)

Panel kanan menampilkan ringkasan (jumlah wajah, dikenali, hadir baru) dan daftar peserta yang sudah hadir di sesi. Operator bisa menekan **Scan Kehadiran** berkali-kali selama meeting untuk menjaring peserta yang masuk belakangan.

---

## Cara Instalasi

### Persyaratan

- Python 3.13+
- Node.js 18+
- Browser modern (Chrome/Edge) yang mendukung screen sharing (`getDisplayMedia`)
- Sesi Google Meet / Zoom yang sedang berjalan (untuk dibagikan layarnya)

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
2. Naikkan nilai `FACE_MATCH_TOLERANCE` di `.env` (default `0.35`, maksimal sekitar `0.6`) — berguna karena wajah di grid meeting kecil/blur
3. Gunakan tampilan **galeri/grid** di meeting agar wajah lebih besar dan jelas

---

## Konfigurasi (.env)

File `backend/.env`:

```env
SECRET_KEY=ganti_dengan_secret_key_yang_kuat
DATABASE_URL=sqlite:///./absensi.db
ALLOWED_ORIGINS=http://localhost:5173

# Cosine distance threshold Facenet512
# Makin kecil = makin ketat. Naikkan jika wajah grid meeting sering gagal dikenali.
FACE_MATCH_TOLERANCE=0.35
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
│   │   │   ├── database.py       # Tabel SQLAlchemy: Mahasiswa, Sesi, Absensi
│   │   │   └── schemas.py        # Schema Pydantic (request/response)
│   │   ├── routers/
│   │   │   ├── mahasiswa.py      # CRUD mahasiswa + upload/update foto
│   │   │   ├── sesi.py           # CRUD sesi meeting + scan multi-wajah + kehadiran
│   │   │   └── absensi.py        # Endpoint: rekap, statistik, hapus kehadiran
│   │   └── services/
│   │       └── face_service.py   # Logika AI: YOLO deteksi banyak wajah, DeepFace kenali per wajah
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
│   │   │   ├── HalamanAbsensi.jsx          # Pilih sesi + share layar meeting + scan multi-wajah
│   │   │   ├── HalamanDaftarMahasiswa.jsx  # CRUD mahasiswa + upload foto (enrollment)
│   │   │   └── HalamanRekap.jsx            # Daftar sesi, rekap kehadiran & statistik
│   │   ├── api/index.js          # Semua pemanggilan REST API ke backend
│   │   ├── App.jsx               # Router dan layout utama
│   │   └── index.css             # Styling global
│   └── package.json
│
└── Facial Emotion Detection/
    ├── best.pt                   # Model YOLO emosi (sumber emotion_best.pt)
    └── main.py                   # Script referensi penggunaan model emosi
```
