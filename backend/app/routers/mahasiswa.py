import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.models.database import get_db, Mahasiswa, Absensi
from app.models.schemas import MahasiswaBuat, MahasiswaResponse
from app.config import FACES_DB_DIR
from app.services.face_service import hapus_cache_wajah

router = APIRouter(prefix="/mahasiswa", tags=["Mahasiswa"])


@router.get("/", response_model=list[MahasiswaResponse])
def daftar_mahasiswa(db: Session = Depends(get_db)):
    return db.query(Mahasiswa).filter(Mahasiswa.is_aktif == True).all()


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def detail_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db)):
    mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return mahasiswa


@router.post("/", response_model=MahasiswaResponse)
def tambah_mahasiswa(
    nama: str = Form(...),
    npm: str = Form(...),
    jabatan: str = Form(None),
    foto: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if db.query(Mahasiswa).filter(Mahasiswa.npm == npm).first():
        raise HTTPException(status_code=400, detail="NPM sudah terdaftar")

    if not foto:
        raise HTTPException(status_code=400, detail="Minimal satu foto wajah wajib diunggah")

    mahasiswa = Mahasiswa(nama=nama, npm=npm, jabatan=jabatan)
    db.add(mahasiswa)
    db.commit()
    db.refresh(mahasiswa)

    # simpan semua foto ke faces_db/<id>/ — banyak foto (beda jarak) bikin pengenalan lebih akurat
    folder_wajah = os.path.join(FACES_DB_DIR, str(mahasiswa.id))
    os.makedirs(folder_wajah, exist_ok=True)

    nama_file_pertama = None
    for idx, f in enumerate(foto):
        ext = os.path.splitext(f.filename or "")[1] or ".jpg"
        nama_simpan = f"wajah_{idx + 1}{ext}"
        path_foto = os.path.join(folder_wajah, nama_simpan)
        with open(path_foto, "wb") as out:
            shutil.copyfileobj(f.file, out)
        if nama_file_pertama is None:
            nama_file_pertama = nama_simpan

    mahasiswa.foto_wajah = f"faces_db/{mahasiswa.id}/{nama_file_pertama}"
    db.commit()
    db.refresh(mahasiswa)

    hapus_cache_wajah()
    return mahasiswa


@router.put("/{mahasiswa_id}/foto", response_model=MahasiswaResponse)
def update_foto_mahasiswa(
    mahasiswa_id: int,
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
):

    mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")

    folder_wajah = os.path.join(FACES_DB_DIR, str(mahasiswa_id))
    if os.path.exists(folder_wajah):
        shutil.rmtree(folder_wajah)
    os.makedirs(folder_wajah, exist_ok=True)

    path_foto = os.path.join(folder_wajah, foto.filename)
    with open(path_foto, "wb") as f:
        shutil.copyfileobj(foto.file, f)

    mahasiswa.foto_wajah = f"faces_db/{mahasiswa_id}/{foto.filename}"
    db.commit()
    db.refresh(mahasiswa)

    hapus_cache_wajah()
    return mahasiswa


@router.delete("/{mahasiswa_id}")
def hapus_mahasiswa(mahasiswa_id: int, db: Session = Depends(get_db)):
    mahasiswa = db.query(Mahasiswa).filter(Mahasiswa.id == mahasiswa_id).first()
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")

    # hard delete: hapus absensi terkait dan folder foto wajah
    db.query(Absensi).filter(Absensi.mahasiswa_id == mahasiswa_id).delete(synchronize_session=False)

    folder_wajah = os.path.join(FACES_DB_DIR, str(mahasiswa_id))
    if os.path.exists(folder_wajah):
        shutil.rmtree(folder_wajah)

    db.delete(mahasiswa)
    db.commit()

    hapus_cache_wajah()
    return {"pesan": "Mahasiswa berhasil dihapus"}