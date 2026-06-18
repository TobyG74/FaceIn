import { useState, useEffect } from 'react'
import {
  getRekapAbsensi, getStatistikAbsensi, getMahasiswa,
  getSesiList, hapusAbsensi, hapusSesi,
} from '../api'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export default function HalamanRekap() {
  const [statistik,    setStatistik]    = useState({})
  const [sesiList,     setSesiList]      = useState([])
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [rekap,        setRekap]         = useState([])
  const [loading,      setLoading]       = useState(false)

  const [filter, setFilter] = useState({
    sesi_id: '',
    mahasiswa_id: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
  })

  const muatAwal = async () => {
    const [statsRes, sesiRes, mahRes] = await Promise.all([
      getStatistikAbsensi({ bulan: filter.bulan, tahun: filter.tahun }),
      getSesiList(),
      getMahasiswa(),
    ])
    setStatistik(statsRes.data)
    setSesiList(sesiRes.data)
    setMahasiswaList(mahRes.data)
  }

  useEffect(() => { muatAwal() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cariRekap = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter.sesi_id) params.sesi_id = filter.sesi_id
      if (filter.mahasiswa_id) params.mahasiswa_id = filter.mahasiswa_id
      if (filter.tanggal_mulai) params.tanggal_mulai = filter.tanggal_mulai
      if (filter.tanggal_selesai) params.tanggal_selesai = filter.tanggal_selesai
      const res = await getRekapAbsensi(params)
      setRekap(res.data)
    } finally {
      setLoading(false)
    }
  }

  const handleHapusAbsensi = async (id) => {
    if (!window.confirm('Hapus data kehadiran ini?')) return
    try {
      await hapusAbsensi(id)
      setRekap(prev => prev.filter(a => a.id !== id))
    } catch {
      alert('Gagal menghapus data kehadiran.')
    }
  }

  const handleHapusSesi = async (id) => {
    if (!window.confirm('Hapus sesi ini beserta semua data kehadirannya?')) return
    try {
      await hapusSesi(id)
      setSesiList(prev => prev.filter(s => s.id !== id))
      setRekap(prev => prev.filter(a => a.sesi_id !== id))
    } catch {
      alert('Gagal menghapus sesi.')
    }
  }

  const formatWaktu   = (dt) => dt ? format(new Date(dt), 'HH:mm', { locale: localeId }) : '-'
  const formatTanggal = (dt) => dt ? format(new Date(dt), 'dd MMM yyyy', { locale: localeId }) : '-'
  const namaSesi      = (id) => sesiList.find(s => s.id === id)?.nama || `Sesi #${id}`

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e3a8a' }}>
        <i className="fa-solid fa-chart-bar" style={{ marginRight: '0.5rem' }} />Rekap &amp; Statistik Kehadiran
      </h1>

      {/* statistik */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-chart-pie" style={{ marginRight: '0.5rem' }} />Statistik Bulan Ini</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Hadir', key: 'hadir', color: '#dcfce7', text: '#15803d' },
            { label: 'Izin',  key: 'izin',  color: '#fef9c3', text: '#854d0e' },
            { label: 'Sakit', key: 'sakit', color: '#fee2e2', text: '#b91c1c' },
            { label: 'Alfa',  key: 'alfa',  color: '#f3f4f6', text: '#6b7280' },
          ].map(({ label, key, color, text }) => (
            <div key={key} style={{ background: color, color: text, borderRadius: 10, padding: '1rem 1.5rem', minWidth: 100, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{statistik[key] || 0}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* daftar sesi */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-calendar-days" style={{ marginRight: '0.5rem' }} />Daftar Sesi Meeting</div>
        {sesiList.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Belum ada sesi. Buat sesi di halaman Absensi.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabel">
              <thead><tr><th>Nama Sesi</th><th>Tanggal</th><th>Jumlah Hadir</th><th>Aksi</th></tr></thead>
              <tbody>
                {sesiList.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.nama}</td>
                    <td>{formatTanggal(s.tanggal)}</td>
                    <td><span className="badge badge-hadir">{s.jumlah_hadir} hadir</span></td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', border: '1px solid #d1d5db' }}
                        onClick={() => { setFilter(f => ({ ...f, sesi_id: String(s.id) })); }}>
                        <i className="fa-solid fa-filter" />
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => handleHapusSesi(s.id)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* filter rekap */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-filter" style={{ marginRight: '0.5rem' }} />Cari Rekap Kehadiran</div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Sesi</label>
            <select className="form-input" value={filter.sesi_id} onChange={(e) => setFilter({ ...filter, sesi_id: e.target.value })}>
              <option value="">Semua Sesi</option>
              {sesiList.map(s => <option key={s.id} value={s.id}>{s.nama} — {formatTanggal(s.tanggal)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mahasiswa</label>
            <select className="form-input" value={filter.mahasiswa_id} onChange={(e) => setFilter({ ...filter, mahasiswa_id: e.target.value })}>
              <option value="">Semua Mahasiswa</option>
              {mahasiswaList.map(m => <option key={m.id} value={m.id}>{m.nama} — {m.npm}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Tanggal Mulai</label>
            <input type="date" className="form-input" value={filter.tanggal_mulai} onChange={(e) => setFilter({ ...filter, tanggal_mulai: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tanggal Selesai</label>
            <input type="date" className="form-input" value={filter.tanggal_selesai} onChange={(e) => setFilter({ ...filter, tanggal_selesai: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={cariRekap} disabled={loading}>
          {loading ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Memuat...</> : <><i className="fa-solid fa-magnifying-glass" style={{ marginRight: '0.4rem' }} />Cari</>}
        </button>
      </div>

      {/* hasil rekap */}
      {rekap.length > 0 && (
        <div className="card">
          <div className="card-title">Hasil Rekap ({rekap.length} data)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabel">
              <thead><tr><th>Sesi</th><th>Nama</th><th>NPM</th><th>Waktu Hadir</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {rekap.map(a => (
                  <tr key={a.id}>
                    <td>{namaSesi(a.sesi_id)}</td>
                    <td style={{ fontWeight: 600 }}>{a.mahasiswa.nama}</td>
                    <td>{a.mahasiswa.npm}</td>
                    <td>{formatTanggal(a.waktu_hadir)} {formatWaktu(a.waktu_hadir)}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleHapusAbsensi(a.id)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
