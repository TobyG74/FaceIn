from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from app.models.database import get_db, Absensi, Sesi
from app.models.schemas import AbsensiResponse

router = APIRouter(prefix="/absensi", tags=["Absensi"])


@router.get("/rekap", response_model=list[AbsensiResponse])
def rekap_absensi(
    sesi_id: int = None,
    mahasiswa_id: int = None,
    tanggal_mulai: date = None,
    tanggal_selesai: date = None,
    db: Session = Depends(get_db),
):
    """rekap kehadiran lintas sesi, bisa difilter sesi/mahasiswa/rentang tanggal"""
    query = db.query(Absensi).join(Sesi, Absensi.sesi_id == Sesi.id)

    if sesi_id:
        query = query.filter(Absensi.sesi_id == sesi_id)
    if mahasiswa_id:
        query = query.filter(Absensi.mahasiswa_id == mahasiswa_id)
    if tanggal_mulai:
        query = query.filter(Sesi.tanggal >= tanggal_mulai)
    if tanggal_selesai:
        query = query.filter(Sesi.tanggal <= tanggal_selesai)

    return query.order_by(Sesi.tanggal.desc(), Absensi.waktu_hadir.desc()).all()


@router.get("/statistik")
def statistik_absensi(bulan: int = None, tahun: int = None, db: Session = Depends(get_db)):
    """jumlah kehadiran per status, opsional difilter bulan/tahun sesi"""
    from sqlalchemy import extract

    query = (
        db.query(Absensi.status, func.count(Absensi.id).label("jumlah"))
        .join(Sesi, Absensi.sesi_id == Sesi.id)
    )

    if bulan:
        query = query.filter(extract("month", Sesi.tanggal) == bulan)
    if tahun:
        query = query.filter(extract("year", Sesi.tanggal) == tahun)

    hasil = query.group_by(Absensi.status).all()
    return {row.status: row.jumlah for row in hasil}


@router.delete("/{absensi_id}")
def hapus_absensi(absensi_id: int, db: Session = Depends(get_db)):
    """hapus satu record kehadiran"""
    absensi = db.query(Absensi).filter(Absensi.id == absensi_id).first()
    if not absensi:
        raise HTTPException(status_code=404, detail="Data kehadiran tidak ditemukan")
    db.delete(absensi)
    db.commit()
    return {"pesan": "Data kehadiran berhasil dihapus"}
