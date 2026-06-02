import { useRef, useState, useEffect } from 'react'
import Webcam from 'react-webcam'
import { scanAbsensi, kenaliWajah, cekSenyum } from '../api'
import axios from 'axios'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const API_URL      = 'http://localhost:8000'
const INTERVAL_BOX = 50   // ms polling kotak deteksi
const COOLDOWN_MS  = 5000  // ms cooldown abis absensi

export default function HalamanAbsensi() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)

  const [fase,             setFase]             = useState('idle')
  const [mahasiswaDikenal, setMahasiswaDikenal] = useState(null)
  const [hasil,            setHasil]            = useState(null)
  const [sisaCooldown,     setSisaCooldown]      = useState(0)
  const [pesanGagal,       setPesanGagal]        = useState(null)
  const [tersenyum,        setTersenyum]         = useState(null)
  const [debugInfo,        setDebugInfo]         = useState(null)

  const faseRef          = useRef('idle')
  const sedangSenyum     = useRef(false)
  const screenshotRef    = useRef(null)
  const riwayatSenyum    = useRef([])
  const cooldownHingga   = useRef(null)
  const senyumTimeoutRef = useRef(null)

  useEffect(() => { faseRef.current = fase }, [fase])

  // hitung mundur cooldown
  useEffect(() => {
    const timer = setInterval(() => {
      if (!cooldownHingga.current) return
      const sisa = Math.ceil((cooldownHingga.current - Date.now()) / 1000)
      if (sisa > 0) {
        setSisaCooldown(sisa)
      } else {
        cooldownHingga.current = null
        setSisaCooldown(0)
        setFase('idle')
      }
    }, 200)
    return () => clearInterval(timer)
  }, [])

  // kotak deteksi wajah real-time
  useEffect(() => {
    let busy = false
    const interval = setInterval(async () => {
      if (busy || !webcamRef.current) return
      busy = true
      try {
        const shot = webcamRef.current.getScreenshot()
        if (!shot) return

        const res  = await fetch(shot)
        const blob = await res.blob()
        const fd   = new FormData()
        fd.append('foto', blob, 'frame.jpg')
        const { data } = await axios.post(`${API_URL}/absensi/deteksi`, fd)

        const canvas = canvasRef.current
        if (!canvas) return
        const video = webcamRef.current?.video
        const imgW  = video?.videoWidth  || 640
        const imgH  = video?.videoHeight || 480
        if (canvas.width  !== imgW) canvas.width  = imgW
        if (canvas.height !== imgH) canvas.height = imgH

        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const f = faseRef.current
        const warna = f === 'minta_senyum' ? '#f59e0b'
          : f === 'mencatat'              ? '#3b82f6'
          : '#22c55e'

        data.kotak?.forEach(k => {
          // sedikit padding simetris (5% dari ukuran kotak) biar wajah ga kepotong mepet
          const padX = k.w * 0.05
          const padY = k.h * 0.05
          const bx = k.x - padX
          const by = k.y - padY
          const bw = k.w + padX * 2
          const bh = k.h + padY * 2

          ctx.strokeStyle = warna
          ctx.lineWidth   = 3
          ctx.strokeRect(bx, by, bw, bh)
          ctx.fillStyle   = warna + '15'
          ctx.fillRect(bx, by, bw, bh)

          if (k.conf !== undefined) {
            const label = `Wajah ${Math.round(k.conf * 100)}%`
            ctx.font    = 'bold 13px sans-serif'
            const tw    = ctx.measureText(label).width
            ctx.fillStyle = warna
            ctx.fillRect(bx, by - 20, tw + 8, 20)
            ctx.fillStyle = '#fff'
            ctx.fillText(label, bx + 4, by - 5)
          }
        })
      } catch { /* silent */ } finally { busy = false }
    }, INTERVAL_BOX)
    return () => clearInterval(interval)
  }, [])

  // poll senyum (aktif pas fase minta_senyum, butuh 3 frame berturut-turut)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (faseRef.current !== 'minta_senyum') return
      if (sedangSenyum.current || !webcamRef.current) return

      sedangSenyum.current = true
      try {
        const shot = webcamRef.current.getScreenshot()
        if (!shot) return
        const res  = await fetch(shot)
        const blob = await res.blob()
        const fd   = new FormData()
        fd.append('foto', blob, 'frame.jpg')
        const { data } = await cekSenyum(fd)

        setTersenyum(data.tersenyum)
        setDebugInfo(data.debug)

        riwayatSenyum.current = [...riwayatSenyum.current, data.tersenyum].slice(-5)
        const konsekutif = riwayatSenyum.current.length >= 3 &&
          riwayatSenyum.current.slice(-3).every(v => v === true)

        if (konsekutif) {
          riwayatSenyum.current = []
          clearTimeout(senyumTimeoutRef.current)
          await eksekusiAbsensi()
        }
      } catch { /* silent */ } finally { sedangSenyum.current = false }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const handleScan = async () => {
    if (!webcamRef.current || faseRef.current !== 'idle') return
    setPesanGagal(null)
    setHasil(null)
    setFase('kenali')

    try {
      const shot = webcamRef.current.getScreenshot()
      if (!shot) throw new Error('Kamera tidak tersedia')

      screenshotRef.current = shot

      const res  = await fetch(shot)
      const blob = await res.blob()
      const fd   = new FormData()
      fd.append('foto', blob, 'kenali.jpg')
      const { data } = await kenaliWajah(fd)

      if (!data.dikenali) {
        setPesanGagal('Wajah tidak dikenali. Pastikan wajah terlihat jelas.')
        setFase('idle')
        return
      }

      setMahasiswaDikenal(data.mahasiswa)
      riwayatSenyum.current = []
      setTersenyum(null)
      setFase('minta_senyum')

      // Reset ke idle kalo senyum gak kedeteksi dalam 30 detik
      senyumTimeoutRef.current = setTimeout(() => {
        if (faseRef.current === 'minta_senyum') {
          riwayatSenyum.current = []
          setMahasiswaDikenal(null)
          setTersenyum(null)
          setPesanGagal('Verifikasi senyum habis waktu. Silakan coba lagi.')
          setFase('idle')
        }
      }, 30000)
    } catch {
      setPesanGagal('Terjadi kesalahan, coba lagi.')
      setFase('idle')
    }
  }

  const eksekusiAbsensi = async () => {
    setFase('mencatat')
    try {
      const shot = screenshotRef.current
      if (!shot) throw new Error('Screenshot tidak tersedia')

      const res  = await fetch(shot)
      const blob = await res.blob()
      const fd   = new FormData()
      fd.append('foto', blob, 'absensi.jpg')
      const { data } = await scanAbsensi(fd)
      setHasil(data)
    } catch {
      setHasil({ berhasil: false, pesan: 'Terjadi kesalahan saat mencatat absensi.' })
    } finally {
      setMahasiswaDikenal(null)
      screenshotRef.current = null
      riwayatSenyum.current = []
      cooldownHingga.current = Date.now() + COOLDOWN_MS
      setFase('cooldown')
    }
  }

  const formatJam = (jamStr) => {
    if (!jamStr) return '-'
    return format(new Date(jamStr), 'HH:mm:ss, dd MMMM yyyy', { locale: localeId })
  }

  const tipeBadge = (tipe) => {
    if (tipe === 'masuk')  return 'Absen Masuk'
    if (tipe === 'keluar') return 'Absen Keluar'
    return 'Info'
  }

  const tombolDisabled = fase !== 'idle'

  // render konten panel kanan sesuai fase
  const renderKanan = () => {
    if (fase === 'kenali') return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <i className="fa-solid fa-magnifying-glass fa-2x" style={{ color: '#3b82f6', marginBottom: '1rem' }} />
        <div style={{ fontWeight: 600 }}>Mengenali wajah...</div>
      </div>
    )

    if (fase === 'minta_senyum') return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <i className="fa-solid fa-face-smile fa-2x" style={{ color: '#f59e0b', marginBottom: '1rem' }} />
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
          Tersenyumlah untuk verifikasi
        </div>

        {/* dot status senyum */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: '#f3f4f6', borderRadius: '20px', padding: '0.3rem 0.8rem',
          fontSize: '0.8rem', marginBottom: '0.75rem'
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
            background: tersenyum === null ? '#d1d5db' : tersenyum ? '#22c55e' : '#9ca3af'
          }} />
          {tersenyum === null ? 'Mendeteksi...' : tersenyum ? '✓ Senyum terdeteksi!' : 'Tersenyumlah...'}
        </div>

        {mahasiswaDikenal && (
          <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{mahasiswaDikenal.nama}</div>
            {mahasiswaDikenal.npm && (
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{mahasiswaDikenal.npm}</div>
            )}
          </div>
        )}

        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '1rem' }}>
          <i className="fa-solid fa-circle-info" style={{ marginRight: '0.3rem' }} />
          Tunjukkan senyum lebar ke kamera
        </div>

        <button
          className="btn"
          onClick={() => {
            clearTimeout(senyumTimeoutRef.current)
            riwayatSenyum.current = []
            setMahasiswaDikenal(null)
            setTersenyum(null)
            setFase('idle')
          }}
          style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.4rem 1rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', color: '#6b7280' }}
        >
          <i className="fa-solid fa-xmark" style={{ marginRight: '0.3rem' }} />Batal
        </button>
      </div>
    )

    if (fase === 'mencatat') return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <i className="fa-solid fa-spinner fa-spin fa-2x" style={{ color: '#3b82f6', marginBottom: '1rem' }} />
        <div style={{ fontWeight: 600 }}>Mencatat kehadiran...</div>
      </div>
    )

    if (hasil) return (
      <div className={`result-card ${hasil.berhasil ? 'sukses' : 'gagal'}`}>
        {hasil.tipe && (
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: hasil.tipe === 'masuk' ? '#16a34a' : '#dc2626', marginBottom: '0.5rem' }}>
            {tipeBadge(hasil.tipe)}
          </div>
        )}
        {hasil.mahasiswa && (
          <div className="result-nama">{hasil.mahasiswa.nama}</div>
        )}
        {hasil.mahasiswa?.jabatan && (
          <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{hasil.mahasiswa.jabatan}</div>
        )}
        <div style={{ fontSize: '0.875rem' }}>{hasil.pesan}</div>
        {hasil.jam && (
          <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem' }}>{formatJam(hasil.jam)}</div>
        )}
        {fase === 'cooldown' && sisaCooldown > 0 && (
          <div style={{ color: '#f59e0b', marginTop: '0.75rem', fontSize: '0.8rem' }}>
            Scan berikutnya dalam {sisaCooldown}s
          </div>
        )}
      </div>
    )

    if (pesanGagal) return (
      <div className="result-card gagal">
        <i className="fa-solid fa-circle-xmark" style={{ color: '#dc2626', marginRight: '0.4rem' }} />
        {pesanGagal}
      </div>
    )

    return (
      <div className="alert alert-info">
        <i className="fa-solid fa-lightbulb" style={{ marginRight: '0.4rem' }} />
        Arahkan wajah ke kamera lalu tekan <b>Scan Wajah</b>.
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e3a8a' }}>
        <i className="fa-solid fa-camera" style={{ marginRight: '0.5rem' }} />FaceIn
      </h1>

      <div className="grid-2">
        {/* panel kamera */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-video" style={{ marginRight: '0.5rem' }} />Kamera
          </div>
          <div className="webcam-container">
            <div style={{ position: 'relative', display: 'block', width: '100%', maxWidth: '480px', lineHeight: 0 }}>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="webcam-video"
                mirrored={true}
                forceScreenshotSourceSize={true}
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={tombolDisabled}
              style={{ width: '100%', maxWidth: '480px', padding: '0.75rem', marginTop: '0.75rem' }}
            >
              {fase === 'kenali'   ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Mengenali...</>
              : fase === 'minta_senyum' ? <><i className="fa-solid fa-face-smile" style={{ marginRight: '0.4rem' }} />Menunggu senyuman...</>
              : fase === 'mencatat'    ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Mencatat...</>
              : fase === 'cooldown'    ? <><i className="fa-solid fa-hourglass-half" style={{ marginRight: '0.4rem' }} />Tunggu {sisaCooldown}s...</>
              : <><i className="fa-solid fa-camera" style={{ marginRight: '0.4rem' }} />Scan Wajah</>}
            </button>
          </div>
        </div>

        {/* panel hasil */}
        <div className="card">
          <div className="card-title">
            <i className="fa-solid fa-clipboard-list" style={{ marginRight: '0.5rem' }} />Hasil Absensi
          </div>
          {renderKanan()}
        </div>
      </div>
    </div>
  )
}
