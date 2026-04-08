from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import date, datetime
from app.models.database import get_db, Absensi, Mahasiswa
from app.models.schemas import AbsensiResponse, HasilAbsensi
import cv2
import numpy as np
from app.services.face_service import kenali_wajah, deteksi_kotak_wajah, cek_senyum_debug

router = APIRouter(prefix="/absensi", tags=["Absensi"])


@router.post("/kenali")
async def kenali_saja(
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """identifikasi wajah doang, ga nyimpen ke absensi — dipake sebelum verifikasi senyum"""
    image_bytes = await foto.read()
    mahasiswa_id = kenali_wajah(image_bytes)
    if mahasiswa_id is None:
        return {"dikenali": False, "mahasiswa": None}
    mahasiswa = db.query(Mahasiswa).filter(
        Mahasiswa.id == mahasiswa_id, Mahasiswa.is_aktif == True
    ).first()
    if not mahasiswa:
        return {"dikenali": False, "mahasiswa": None}
    return {
        "dikenali": True,
        "mahasiswa": {"id": mahasiswa.id, "nama": mahasiswa.nama, "npm": mahasiswa.npm, "jabatan": mahasiswa.jabatan},
    }


@router.post("/scan", response_model=HasilAbsensi)
async def scan_absensi(
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """catat absensi. scan pertama = masuk, scan kedua = keluar"""
    image_bytes = await foto.read()

    mahasiswa_id = kenali_wajah(image_bytes)

    if mahasiswa_id is None:
        return HasilAbsensi(berhasil=False, pesan="Wajah tidak dikenali, coba lagi")

    mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id, Mahasiswa.is_aktif == True).first()
    if not mahasiswa:
        return HasilAbsensi(berhasil=False, pesan="Data mahasiswa tidak aktif")

    hari_ini = date.today()
    sekarang = datetime.now()

    # cek udah absen masuk hari ini belum
    absensi_hari_ini = db.query(Absensi).filter(
        and_(Absensi.mahasiswa_id == mahasiswa_id, Absensi.tanggal == hari_ini)
    ).first()

    if absensi_hari_ini is None:
        # belum absen sama sekali → catat masuk
        absensi_baru = Absensi(
            mahasiswa_id=mahasiswa_id,
            tanggal=hari_ini,
            jam_masuk=sekarang,
            status="hadir",
        )
        db.add(absensi_baru)
        db.commit()
        db.refresh(absensi_baru)

        return HasilAbsensi(
            berhasil=True,
            pesan=f"Selamat datang, {mahasiswa.nama}! Absen masuk tercatat.",
            mahasiswa=mahasiswa,
            jam=sekarang,
            tipe="masuk",
        )

    elif absensi_hari_ini.jam_keluar is None:
        # udah masuk, belum keluar → catat keluar
        absensi_hari_ini.jam_keluar = sekarang
        db.commit()
        db.refresh(absensi_hari_ini)

        return HasilAbsensi(
            berhasil=True,
            pesan=f"Sampai jumpa, {mahasiswa.nama}! Absen keluar tercatat.",
            mahasiswa=mahasiswa,
            jam=sekarang,
            tipe="keluar",
        )

    else:
        # udah lengkap masuk + keluar, tolak
        return HasilAbsensi(
            berhasil=False,
            pesan=f"{mahasiswa.nama} sudah absen masuk dan keluar hari ini.",
            mahasiswa=mahasiswa,
            jam=absensi_hari_ini.jam_keluar,
            tipe="sudah_lengkap",
        )


@router.post("/cek-senyum")
async def cek_senyum_endpoint(foto: UploadFile = File(...)):
    """
    cek senyum user.
    returns: {"tersenyum": bool, "debug": {...}}
    """
    image_bytes = await foto.read()
    tersenyum, debug_info = cek_senyum_debug(image_bytes)
    return {"tersenyum": tersenyum, "debug": debug_info}


@router.post("/deteksi")
async def deteksi_wajah_realtime(foto: UploadFile = File(...)):
    """
    deteksi kotak wajah buat live preview kamera, ga ada pengenalan identitas.
    """
    image_bytes = await foto.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    gambar_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if gambar_bgr is None:
        return {"kotak": []}
    kotak = deteksi_kotak_wajah(gambar_bgr)
    return {"kotak": kotak}


@router.get("/hari-ini", response_model=list[AbsensiResponse])
def absensi_hari_ini(db: Session = Depends(get_db)):
    return db.query(Absensi).filter(Absensi.tanggal == date.today()).all()


@router.get("/rekap", response_model=list[AbsensiResponse])
def rekap_absensi(
    tanggal_mulai: date = None,
    tanggal_selesai: date = None,
    mahasiswa_id: int = None,
    db: Session = Depends(get_db),
):
    """ambil rekap absensi, bisa difilter tanggal atau mahasiswa"""
    query = db.query(Absensi)

    if mahasiswa_id:
        query = query.filter(Absensi.mahasiswa_id == mahasiswa_id)
    if tanggal_mulai:
        query = query.filter(Absensi.tanggal >= tanggal_mulai)
    if tanggal_selesai:
        query = query.filter(Absensi.tanggal <= tanggal_selesai)

    return query.order_by(Absensi.tanggal.desc(), Absensi.jam_masuk.desc()).all()


@router.get("/statistik")
def statistik_absensi(bulan: int = None, tahun: int = None, db: Session = Depends(get_db)):
    """Hitung jumlah hadir, izin, sakit, alfa per bulan."""
    from sqlalchemy import extract, func

    query = db.query(Absensi.status, func.count(Absensi.id).label("jumlah"))

    if bulan:
        query = query.filter(extract("month", Absensi.tanggal) == bulan)
    if tahun:
        query = query.filter(extract("year", Absensi.tanggal) == tahun)

    hasil = query.group_by(Absensi.status).all()
    return {row.status: row.jumlah for row in hasil}


@router.delete("/{absensi_id}")
def hapus_absensi(absensi_id: int, db: Session = Depends(get_db)):
    """Hapus satu record absensi berdasarkan ID."""
    absensi = db.query(Absensi).filter(Absensi.id == absensi_id).first()
    if not absensi:
        raise HTTPException(status_code=404, detail="Data absensi tidak ditemukan")
    db.delete(absensi)
    db.commit()
    return {"pesan": "Data absensi berhasil dihapus"}
