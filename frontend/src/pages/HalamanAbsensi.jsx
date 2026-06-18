import { useRef, useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
  getSesiList, buatSesi, scanSesi, getKehadiranSesi,
} from '../api'

export default function HalamanAbsensi() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)   // overlay kotak wajah
  const streamRef  = useRef(null)

  const [sesiList,     setSesiList]   = useState([])
  const [sesiId,       setSesiId]     = useState('')
  const [namaSesiBaru, setNamaSesiBaru] = useState('')

  const [berbagi,   setBerbagi]   = useState(false)
  const [scanning,  setScanning]  = useState(false)
  const [hasilScan, setHasilScan] = useState(null)
  const [kehadiran, setKehadiran] = useState([])
  const [pesan,     setPesan]     = useState(null)

  const sesiAktif = sesiList.find(s => String(s.id) === String(sesiId)) || null

  const muatSesi = useCallback(async () => {
    const { data } = await getSesiList()
    setSesiList(data)
    return data
  }, [])

  useEffect(() => { muatSesi() }, [muatSesi])

  // muat daftar hadir tiap ganti sesi
  useEffect(() => {
    if (!sesiId) { setKehadiran([]); return }
    getKehadiranSesi(sesiId).then(({ data }) => setKehadiran(data)).catch(() => {})
  }, [sesiId])

  // bersihkan stream pas unmount
  useEffect(() => () => hentikanBerbagi(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuatSesi = async () => {
    if (!namaSesiBaru.trim()) return
    try {
      const { data } = await buatSesi({ nama: namaSesiBaru.trim() })
      setNamaSesiBaru('')
      await muatSesi()
      setSesiId(String(data.id))
      setHasilScan(null)
    } catch {
      setPesan('Gagal membuat sesi.')
    }
  }

  const mulaiBerbagi = async () => {
    setPesan(null)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      // user menghentikan share lewat UI browser
      stream.getVideoTracks()[0].addEventListener('ended', hentikanBerbagi)
      setBerbagi(true)
    } catch {
      setPesan('Gagal mengakses layar. Pilih window/tab Google Meet atau Zoom saat diminta.')
    }
  }

  const hentikanBerbagi = () => {
    const stream = streamRef.current
    if (stream) stream.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    bersihkanOverlay()
    setBerbagi(false)
  }

  const bersihkanOverlay = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const gambarOverlay = (wajah) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const W = video.videoWidth  || 1280
    const H = video.videoHeight || 720
    if (canvas.width  !== W) canvas.width  = W
    if (canvas.height !== H) canvas.height = H

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    wajah.forEach(w => {
      const { x, y, w: bw, h: bh } = w.box
      const warna = w.dikenali ? (w.baru ? '#22c55e' : '#3b82f6') : '#ef4444'
      const label = w.dikenali ? w.mahasiswa.nama : 'Tidak dikenali'

      ctx.strokeStyle = warna
      ctx.lineWidth   = Math.max(2, Math.round(W / 480))
      ctx.strokeRect(x, y, bw, bh)

      ctx.font = `bold ${Math.max(12, Math.round(W / 70))}px sans-serif`
      const tw = ctx.measureText(label).width
      const th = Math.max(16, Math.round(W / 55))
      ctx.fillStyle = warna
      ctx.fillRect(x, y - th, tw + 10, th)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 5, y - th * 0.25)
    })
  }

  const ambilFrameBlob = () => new Promise((resolve) => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return resolve(null)
    const c = document.createElement('canvas')
    c.width  = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height)
    c.toBlob(blob => resolve(blob), 'image/jpeg', 0.9)
  })

  const handleScan = async () => {
    if (!sesiId) { setPesan('Pilih atau buat sesi dulu.'); return }
    if (!berbagi) { setPesan('Bagikan layar meeting dulu.'); return }
    setPesan(null)
    setScanning(true)
    try {
      const blob = await ambilFrameBlob()
      if (!blob) { setPesan('Frame tidak tersedia, coba lagi.'); return }
      const fd = new FormData()
      fd.append('foto', blob, 'frame.jpg')
      const { data } = await scanSesi(sesiId, fd)
      setHasilScan(data)
      gambarOverlay(data.wajah || [])
      // refresh daftar hadir + counter sesi
      const [{ data: kh }] = await Promise.all([getKehadiranSesi(sesiId)])
      setKehadiran(kh)
      muatSesi()
    } catch {
      setPesan('Gagal melakukan scan. Pastikan backend berjalan.')
    } finally {
      setScanning(false)
    }
  }

  const formatJam = (dt) => dt ? format(new Date(dt), 'HH:mm:ss', { locale: localeId }) : '-'

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem', color: '#1e3a8a' }}>
        <i className="fa-solid fa-camera" style={{ marginRight: '0.5rem' }} />FaceIn — Absensi Meeting
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        Bagikan window Google Meet / Zoom, lalu tekan <b>Scan Kehadiran</b> untuk mengenali semua peserta yang tampil.
      </p>

      {/* pilih / buat sesi */}
      <div className="card">
        <div className="card-title"><i className="fa-solid fa-calendar-check" style={{ marginRight: '0.5rem' }} />Sesi Meeting</div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Pilih Sesi</label>
            <select className="form-input" value={sesiId} onChange={(e) => { setSesiId(e.target.value); setHasilScan(null) }}>
              <option value="">— Pilih sesi —</option>
              {sesiList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nama} ({format(new Date(s.tanggal), 'dd MMM yyyy', { locale: localeId })}) — {s.jumlah_hadir} hadir
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Atau Buat Sesi Baru</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="form-input"
                placeholder="mis. Pertemuan 5 - Basis Data"
                value={namaSesiBaru}
                onChange={(e) => setNamaSesiBaru(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBuatSesi()}
              />
              <button className="btn btn-primary" onClick={handleBuatSesi} style={{ whiteSpace: 'nowrap' }}>
                <i className="fa-solid fa-plus" style={{ marginRight: '0.3rem' }} />Buat
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* panel layar */}
        <div className="card">
          <div className="card-title"><i className="fa-solid fa-display" style={{ marginRight: '0.5rem' }} />Layar Meeting</div>

          <div style={{ position: 'relative', width: '100%', background: '#0f172a', borderRadius: 8, overflow: 'hidden', lineHeight: 0, minHeight: 220 }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
            {!berbagi && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '0.5rem' }}>
                <i className="fa-solid fa-desktop fa-2x" />
                <span style={{ fontSize: '0.85rem' }}>Layar belum dibagikan</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            {!berbagi ? (
              <button className="btn btn-primary" onClick={mulaiBerbagi} style={{ flex: 1, padding: '0.7rem' }}>
                <i className="fa-solid fa-share-from-square" style={{ marginRight: '0.4rem' }} />Bagikan Layar
              </button>
            ) : (
              <button className="btn btn-danger" onClick={hentikanBerbagi} style={{ padding: '0.7rem 1rem' }}>
                <i className="fa-solid fa-stop" style={{ marginRight: '0.4rem' }} />Stop
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={!berbagi || scanning || !sesiId}
              style={{ flex: 1, padding: '0.7rem' }}
            >
              {scanning
                ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Memindai...</>
                : <><i className="fa-solid fa-magnifying-glass" style={{ marginRight: '0.4rem' }} />Scan Kehadiran</>}
            </button>
          </div>

          {pesan && (
            <div className="alert alert-info" style={{ marginTop: '0.75rem' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '0.4rem' }} />{pesan}
            </div>
          )}
        </div>

        {/* panel hasil */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-clipboard-list" style={{ marginRight: '0.5rem' }} />
            Kehadiran {sesiAktif ? `— ${sesiAktif.nama}` : ''}
          </div>

          {hasilScan && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Wajah', val: hasilScan.jumlah_wajah, c: '#e0f2fe', t: '#0369a1' },
                { label: 'Dikenali', val: hasilScan.jumlah_dikenali, c: '#dbeafe', t: '#1d4ed8' },
                { label: 'Hadir baru', val: hasilScan.hadir_baru, c: '#dcfce7', t: '#15803d' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 80, background: s.c, color: s.t, borderRadius: 8, padding: '0.6rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.val}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {!sesiId ? (
            <p style={{ color: '#6b7280' }}>Pilih sesi untuk melihat daftar kehadiran.</p>
          ) : kehadiran.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Belum ada peserta tercatat hadir di sesi ini.</p>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="tabel">
                <thead><tr><th>#</th><th>Nama</th><th>NPM</th><th>Jam Hadir</th></tr></thead>
                <tbody>
                  {kehadiran.map((a, i) => (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{a.mahasiswa.nama}</td>
                      <td>{a.mahasiswa.npm}</td>
                      <td>{formatJam(a.waktu_hadir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
