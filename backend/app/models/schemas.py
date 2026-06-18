from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

# ---------- Mahasiswa ----------
class MahasiswaBase(BaseModel):
    nama: str
    npm: str
    jabatan: Optional[str] = None

class MahasiswaBuat(MahasiswaBase):
    pass

class MahasiswaResponse(MahasiswaBase):
    id: int
    foto_wajah: Optional[str]
    is_aktif: bool
    dibuat_pada: datetime

    class Config:
        from_attributes = True


# ---------- Sesi meeting ----------
class SesiBuat(BaseModel):
    nama: str
    tanggal: Optional[date] = None

class SesiResponse(BaseModel):
    id: int
    nama: str
    tanggal: date
    dibuat_pada: datetime
    jumlah_hadir: int = 0

    class Config:
        from_attributes = True


# ---------- Kehadiran ----------
class AbsensiResponse(BaseModel):
    id: int
    sesi_id: int
    waktu_hadir: Optional[datetime]
    status: str
    keterangan: Optional[str] = None
    mahasiswa: MahasiswaResponse

    class Config:
        from_attributes = True


# ---------- Hasil scan multi-wajah ----------
class KotakWajah(BaseModel):
    x: int
    y: int
    w: int
    h: int

class WajahTerdeteksi(BaseModel):
    box: KotakWajah
    dikenali: bool
    baru: bool = False  # True kalau kehadiran baru tercatat di scan ini
    jarak: Optional[float] = None
    mahasiswa: Optional[MahasiswaResponse] = None

class HasilScan(BaseModel):
    berhasil: bool
    pesan: str
    jumlah_wajah: int = 0
    jumlah_dikenali: int = 0
    hadir_baru: int = 0
    wajah: list[WajahTerdeteksi] = []
