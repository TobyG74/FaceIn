import { useState, useEffect, useRef } from 'react'
import { getMahasiswa, tambahMahasiswa, hapusMahasiswa } from '../api'

export default function HalamanDaftarMahasiswa() {
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pesan, setPesan] = useState(null)

  // state form tambah mahasiswa
  const [form, setForm] = useState({ nama: '', npm: '', jabatan: '' })
  const [foto, setFoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef()

  const muat = async () => {
    try {
      const res = await getMahasiswa()
      setMahasiswaList(res.data)
    } catch {
      setPesan({ tipe: 'error', teks: 'Gagal memuat data mahasiswa.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { muat() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!foto) { setPesan({ tipe: 'error', teks: 'Foto wajah wajib diisi.' }); return }

    setSubmitting(true)
    setPesan(null)

    const formData = new FormData()
    formData.append('nama', form.nama)
    formData.append('npm', form.npm)
    formData.append('jabatan', form.jabatan)
    formData.append('foto', foto)

    try {
      await tambahMahasiswa(formData)
      setPesan({ tipe: 'success', teks: 'Mahasiswa berhasil ditambahkan.' })
      setForm({ nama: '', npm: '', jabatan: '' })
      setFoto(null)
      fileRef.current.value = ''
      setShowForm(false)
      muat()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Gagal menambahkan mahasiswa.'
      setPesan({ tipe: 'error', teks: detail })
    } finally {
      setSubmitting(false)
    }
  }

  const handleHapus = async (id, nama) => {
    if (!window.confirm(`Nonaktifkan mahasiswa "${nama}"?`)) return
    try {
      await hapusMahasiswa(id)
      setPesan({ tipe: 'success', teks: `${nama} berhasil dinonaktifkan.` })
      muat()
    } catch {
      setPesan({ tipe: 'error', teks: 'Gagal menghapus mahasiswa.' })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e3a8a' }}><i className="fa-solid fa-users" style={{marginRight:'0.5rem'}}></i>Data Mahasiswa</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm
            ? <><i className="fa-solid fa-xmark" style={{marginRight:'0.4rem'}}></i>Tutup</>
            : <><i className="fa-solid fa-plus" style={{marginRight:'0.4rem'}}></i>Tambah Mahasiswa</>}
        </button>
      </div>

      {pesan && (
        <div className={`alert alert-${pesan.tipe === 'success' ? 'success' : 'error'}`}>
          {pesan.teks}
        </div>
      )}

      {/* form tambah mahasiswa */}
      {showForm && (
        <div className="card">
          <div className="card-title">Tambah Mahasiswa Baru</div>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Nama Lengkap *</label>
                <input
                  className="form-input"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">NPM *</label>
                <input
                  className="form-input"
                  value={form.npm}
                  onChange={(e) => setForm({ ...form, npm: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Program Studi</label>
              <input
                className="form-input"
                value={form.jabatan}
                onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                placeholder="cth: Teknik Informatika"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Foto Wajah * (gunakan foto yang jelas, satu wajah)</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                ref={fileRef}
                onChange={(e) => setFoto(e.target.files[0])}
                required
              />
            </div>
            <button className="btn btn-success" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Mahasiswa'}
            </button>
          </form>
        </div>
      )}

      {/* tabel daftar mahasiswa */}
      <div className="card">
        <div className="card-title">Daftar Mahasiswa Aktif</div>
        {loading ? (
          <div className="spinner" />
        ) : mahasiswaList.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Belum ada data mahasiswa.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Nama</th>
                  <th>NPM</th>
                  <th>Program Studi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mahasiswaList.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.foto_wajah ? (
                        <img
                          src={`/api/${m.foto_wajah}`}
                          alt={m.nama}
                          className="foto-mahasiswa"
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#94a3b8' }}><i className="fa-solid fa-user"></i></div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.nama}</td>
                    <td>{m.npm}</td>
                    <td>{m.jabatan || '-'}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => handleHapus(m.id, m.nama)}
                      >
                        Nonaktifkan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
