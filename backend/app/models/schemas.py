from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

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

class AbsensiBase(BaseModel):
    mahasiswa_id: int
    tanggal: date
    status: Optional[str] = "hadir"
    keterangan: Optional[str] = None

class AbsensiResponse(AbsensiBase):
    id: int
    jam_masuk: Optional[datetime]
    jam_keluar: Optional[datetime]
    mahasiswa: MahasiswaResponse

    class Config:
        from_attributes = True

class HasilAbsensi(BaseModel):
    berhasil: bool
    pesan: str
    mahasiswa: Optional[MahasiswaResponse] = None
    jam: Optional[datetime] = None
    tipe: Optional[str] = None  # "masuk" atau "keluar"
