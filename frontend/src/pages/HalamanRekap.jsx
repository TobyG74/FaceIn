import { useState, useEffect } from 'react'
import { getRekapAbsensi, getAbsensiHariIni, getStatistikAbsensi, getMahasiswa, hapusAbsensi } from '../api'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export default function HalamanRekap() {
  const [absensiHariIni, setAbsensiHariIni] = useState([])
  const [rekap, setRekap] = useState([])
  const [statistik, setStatistik] = useState({})
  const [mahasiswaList, setMahasiswaList] = useState([])
  const [loading, setLoading] = useState(false)

  // state filter rekap
  const [filter, setFilter] = useState({
    tanggal_mulai: '',
    tanggal_selesai: '',
    mahasiswa_id: '',
    bulan: new Date().getMonth() + 1,
    tahun: new Date().getFullYear(),
  })

  // load absensi hari ini + statistik pas halaman dibuka
  useEffect(() => {
    const init = async () => {
      const [hariIniRes, statsRes, mahRes] = await Promise.all([
        getAbsensiHariIni(),
        getStatistikAbsensi({ bulan: filter.bulan, tahun: filter.tahun }),
        getMahasiswa(),
      ])
      setAbsensiHariIni(hariIniRes.data)
      setStatistik(statsRes.data)
      setMahasiswaList(mahRes.data)
    }
    init()
  }, [])

  const handleHapusAbsensi = async (id) => {
    if (!window.confirm('Hapus data absensi ini?')) return
    try {
      await hapusAbsensi(id)
      setAbsensiHariIni(prev => prev.filter(a => a.id !== id))
      setRekap(prev => prev.filter(a => a.id !== id))
    } catch {
      alert('Gagal menghapus data absensi.')
    }
  }

  const cariRekap = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filter.tanggal_mulai) params.tanggal_mulai = filter.tanggal_mulai
      if (filter.tanggal_selesai) params.tanggal_selesai = filter.tanggal_selesai
      if (filter.mahasiswa_id) params.mahasiswa_id = filter.mahasiswa_id

      const res = await getRekapAbsensi(params)
      setRekap(res.data)
    } finally {
      setLoading(false)
    }
  }

  const formatWaktu = (dt) => {
    if (!dt) return '-'
    return format(new Date(dt), 'HH:mm', { locale: localeId })
  }

  const formatTanggal = (tgl) => {
    if (!tgl) return '-'
    return format(new Date(tgl), 'dd MMM yyyy', { locale: localeId })
  }

  // hitung durasi dari jam masuk sampe keluar
  const hitungDurasi = (masuk, keluar) => {
    if (!masuk || !keluar) return '-'
    const selisihMs = new Date(keluar) - new Date(masuk)
    const jam = Math.floor(selisihMs / 3600000)
    const menit = Math.floor((selisihMs % 3600000) / 60000)
    return `${jam}j ${menit}m`
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e3a8a' }}>
        <i className="fa-solid fa-chart-bar" style={{marginRight:'0.5rem'}}></i>Rekap &amp; Statistik Absensi
      </h1>

      {/* statistik bulan ini */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-chart-pie" style={{marginRight:'0.5rem'}}></i>Statistik Bulan Ini</div>
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

      {/* absensi hari ini */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-calendar-day" style={{marginRight:'0.5rem'}}></i>Absensi Hari Ini ({format(new Date(), 'dd MMMM yyyy', { locale: localeId })})</div>
        {absensiHariIni.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Belum ada yang absen hari ini.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NPM</th>
                  <th>Jam Masuk</th>
                  <th>Jam Keluar</th>
                  <th>Durasi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {absensiHariIni.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.mahasiswa.nama}</td>
                    <td>{a.mahasiswa.npm}</td>
                    <td>{formatWaktu(a.jam_masuk)}</td>
                    <td>{formatWaktu(a.jam_keluar)}</td>
                    <td>{hitungDurasi(a.jam_masuk, a.jam_keluar)}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td>
                      <button className="btn btn-danger" style={{padding:'0.25rem 0.6rem',fontSize:'0.8rem'}} onClick={() => handleHapusAbsensi(a.id)}>
                        <i className="fa-solid fa-trash"></i>
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
        <div className="card-title"><i className="fa-solid fa-filter" style={{marginRight:'0.5rem'}}></i>Cari Rekap</div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Tanggal Mulai</label>
            <input
              type="date"
              className="form-input"
              value={filter.tanggal_mulai}
              onChange={(e) => setFilter({ ...filter, tanggal_mulai: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tanggal Selesai</label>
            <input
              type="date"
              className="form-input"
              value={filter.tanggal_selesai}
              onChange={(e) => setFilter({ ...filter, tanggal_selesai: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Filter Mahasiswa</label>
          <select
            className="form-input"
            value={filter.mahasiswa_id}
            onChange={(e) => setFilter({ ...filter, mahasiswa_id: e.target.value })}
          >
            <option value="">Semua Mahasiswa</option>
            {mahasiswaList.map((m) => (
              <option key={m.id} value={m.id}>{m.nama} — {m.npm}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={cariRekap} disabled={loading}>
          {loading ? <><i className="fa-solid fa-spinner fa-spin" style={{marginRight:'0.4rem'}}></i>Memuat...</> : <><i className="fa-solid fa-magnifying-glass" style={{marginRight:'0.4rem'}}></i>Cari</>}
        </button>
      </div>

      {/* hasil rekap */}
      {rekap.length > 0 && (
        <div className="card">
          <div className="card-title">Hasil Rekap ({rekap.length} data)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabel">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>NPM</th>
                  <th>Masuk</th>
                  <th>Keluar</th>
                  <th>Durasi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rekap.map((a) => (
                  <tr key={a.id}>
                    <td>{formatTanggal(a.tanggal)}</td>
                    <td style={{ fontWeight: 600 }}>{a.mahasiswa.nama}</td>
                    <td>{a.mahasiswa.npm}</td>
                    <td>{formatWaktu(a.jam_masuk)}</td>
                    <td>{formatWaktu(a.jam_keluar)}</td>
                    <td>{hitungDurasi(a.jam_masuk, a.jam_keluar)}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td>
                      <button className="btn btn-danger" style={{padding:'0.25rem 0.6rem',fontSize:'0.8rem'}} onClick={() => handleHapusAbsensi(a.id)}>
                        <i className="fa-solid fa-trash"></i>
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
