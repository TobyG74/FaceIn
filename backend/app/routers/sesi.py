from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from app.models.database import get_db, Sesi, Absensi, Mahasiswa
from app.models.schemas import (
    SesiBuat, SesiResponse, AbsensiResponse,
    HasilScan, WajahTerdeteksi, KotakWajah,
)
from app.services.face_service import kenali_banyak_wajah

router = APIRouter(prefix="/sesi", tags=["Sesi"])


def _serialize_sesi(sesi: Sesi, jumlah_hadir: int = 0) -> SesiResponse:
    return SesiResponse(
        id=sesi.id,
        nama=sesi.nama,
        tanggal=sesi.tanggal,
        dibuat_pada=sesi.dibuat_pada,
        jumlah_hadir=jumlah_hadir,
    )


@router.post("/", response_model=SesiResponse)
def buat_sesi(data: SesiBuat, db: Session = Depends(get_db)):
    """buat sesi meeting baru yang akan diabsen"""
    sesi = Sesi(nama=data.nama, tanggal=data.tanggal or date.today())
    db.add(sesi)
    db.commit()
    db.refresh(sesi)
    return _serialize_sesi(sesi, 0)


@router.get("/", response_model=list[SesiResponse])
def daftar_sesi(db: Session = Depends(get_db)):
    """daftar semua sesi + jumlah peserta hadir"""
    rows = (
        db.query(Sesi, func.count(Absensi.id))
        .outerjoin(Absensi, Absensi.sesi_id == Sesi.id)
        .group_by(Sesi.id)
        .order_by(Sesi.tanggal.desc(), Sesi.id.desc())
        .all()
    )
    return [_serialize_sesi(sesi, jumlah or 0) for sesi, jumlah in rows]


@router.get("/{sesi_id}", response_model=SesiResponse)
def detail_sesi(sesi_id: int, db: Session = Depends(get_db)):
    sesi = db.query(Sesi).filter(Sesi.id == sesi_id).first()
    if not sesi:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    jumlah = db.query(func.count(Absensi.id)).filter(Absensi.sesi_id == sesi_id).scalar()
    return _serialize_sesi(sesi, jumlah or 0)


@router.get("/{sesi_id}/kehadiran", response_model=list[AbsensiResponse])
def kehadiran_sesi(sesi_id: int, db: Session = Depends(get_db)):
    """daftar peserta yang sudah tercatat hadir di sebuah sesi"""
    if not db.query(Sesi).filter(Sesi.id == sesi_id).first():
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    return (
        db.query(Absensi)
        .filter(Absensi.sesi_id == sesi_id)
        .order_by(Absensi.waktu_hadir.asc())
        .all()
    )


@router.delete("/{sesi_id}")
def hapus_sesi(sesi_id: int, db: Session = Depends(get_db)):
    sesi = db.query(Sesi).filter(Sesi.id == sesi_id).first()
    if not sesi:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    db.delete(sesi)  # cascade hapus absensi terkait
    db.commit()
    return {"pesan": "Sesi berhasil dihapus"}


@router.post("/{sesi_id}/scan", response_model=HasilScan)
async def scan_sesi(
    sesi_id: int,
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    tangkap satu frame layar meeting → deteksi & kenali SEMUA wajah →
    tandai tiap mahasiswa yang dikenali sebagai hadir di sesi ini.
    """
    sesi = db.query(Sesi).filter(Sesi.id == sesi_id).first()
    if not sesi:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    image_bytes = await foto.read()
    deteksi = kenali_banyak_wajah(image_bytes)

    if not deteksi:
        return HasilScan(
            berhasil=False,
            pesan="Tidak ada wajah terdeteksi di layar. Pastikan grid peserta terlihat.",
        )

    # mahasiswa yang sudah tercatat hadir di sesi ini
    sudah_hadir = {
        a.mahasiswa_id
        for a in db.query(Absensi.mahasiswa_id).filter(Absensi.sesi_id == sesi_id).all()
    }

    sekarang = datetime.now()
    wajah_resp: list[WajahTerdeteksi] = []
    hadir_baru = 0

    for d in deteksi:
        box = KotakWajah(**{k: d["box"][k] for k in ("x", "y", "w", "h")})
        mid = d["mahasiswa_id"]

        if mid is None:
            wajah_resp.append(WajahTerdeteksi(box=box, dikenali=False, jarak=d["jarak"]))
            continue

        mahasiswa = db.query(Mahasiswa).filter(
            Mahasiswa.id == mid, Mahasiswa.is_aktif == True
        ).first()
        if not mahasiswa:
            wajah_resp.append(WajahTerdeteksi(box=box, dikenali=False, jarak=d["jarak"]))
            continue

        baru = False
        if mid not in sudah_hadir:
            db.add(Absensi(
                sesi_id=sesi_id,
                mahasiswa_id=mid,
                waktu_hadir=sekarang,
                status="hadir",
            ))
            sudah_hadir.add(mid)
            hadir_baru += 1
            baru = True

        wajah_resp.append(WajahTerdeteksi(
            box=box, dikenali=True, baru=baru, jarak=d["jarak"], mahasiswa=mahasiswa,
        ))

    if hadir_baru:
        db.commit()

    jumlah_dikenali = sum(1 for w in wajah_resp if w.dikenali)
    return HasilScan(
        berhasil=True,
        pesan=f"{len(deteksi)} wajah terdeteksi, {jumlah_dikenali} dikenali, {hadir_baru} kehadiran baru.",
        jumlah_wajah=len(deteksi),
        jumlah_dikenali=jumlah_dikenali,
        hadir_baru=hadir_baru,
        wajah=wajah_resp,
    )
