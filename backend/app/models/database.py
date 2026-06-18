from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Date, ForeignKey,
    Boolean, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker
from datetime import datetime, date
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

# tabel mahasiswa — nyimpen data dasar & path foto wajah
class Mahasiswa(Base):
    __tablename__ = "mahasiswa"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(100), nullable=False)
    npm = Column(String(50), unique=True, nullable=False)
    jabatan = Column(String(100))
    foto_wajah = Column(String(255))  # path relatif foto
    is_aktif = Column(Boolean, default=True)
    dibuat_pada = Column(DateTime, default=datetime.now)

    absensi = relationship("Absensi", back_populates="mahasiswa")


# tabel sesi meeting — satu pertemuan Google Meet/Zoom yang diabsen
class Sesi(Base):
    __tablename__ = "sesi"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(150), nullable=False)       # mis. "Pertemuan 5 - Basis Data"
    tanggal = Column(Date, nullable=False, default=date.today)
    dibuat_pada = Column(DateTime, default=datetime.now)

    absensi = relationship("Absensi", back_populates="sesi", cascade="all, delete-orphan")


# tabel kehadiran — tiap mahasiswa yang terdeteksi hadir di sebuah sesi
class Absensi(Base):
    __tablename__ = "absensi"
    __table_args__ = (
        # tiap mahasiswa cuma boleh tercatat sekali per sesi
        UniqueConstraint("sesi_id", "mahasiswa_id", name="uq_sesi_mahasiswa"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sesi_id = Column(Integer, ForeignKey("sesi.id"), nullable=False, index=True)
    mahasiswa_id = Column(Integer, ForeignKey("mahasiswa.id"), nullable=False)
    waktu_hadir = Column(DateTime, default=datetime.now)
    status = Column(String(20), default="hadir")  # hadir, izin, sakit, alfa
    keterangan = Column(String(255))

    sesi = relationship("Sesi", back_populates="absensi")
    mahasiswa = relationship("Mahasiswa", back_populates="absensi")


def init_db():
    Base.metadata.create_all(bind=engine)


# dependency buat dapetin session db di tiap request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
