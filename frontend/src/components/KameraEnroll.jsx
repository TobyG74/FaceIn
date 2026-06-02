import { useRef, useState, useEffect, useCallback } from 'react'
import Webcam from 'react-webcam'
import axios from 'axios'

const API_URL  = '/api'
const POLL_MS  = 150     // jeda polling deteksi wajah
const STABIL_DIBUTUHKAN = 6    // jumlah frame "pas" berturut-turut sebelum auto-jepret
const JEDA_ANTAR_STEP   = 1000 // ms jeda biar user lihat hasil sebelum lanjut tahap berikutnya
const TOLERANSI_TENGAH  = 0.10 // toleransi titik tengah wajah (10% dari ukuran frame)

// 3 tahap pengambilan — dibedakan oleh rasio lebar wajah terhadap lebar frame.
// Wajah kecil = jauh, wajah besar = dekat. Nilai bisa disesuaikan kalau kamera beda.
const TAHAP = [
  { key: 'jauh',   label: 'Jarak Jauh',   min: 0.14, max: 0.24 },
  { key: 'sedang', label: 'Jarak Sedang', min: 0.28, max: 0.40 },
  { key: 'dekat',  label: 'Jarak Dekat',  min: 0.44, max: 0.60 },
]

export default function KameraEnroll({ onChange }) {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)

  const [mulai,    setMulai]    = useState(false)
  const [stepIdx,  setStepIdx]  = useState(0)
  const [captured, setCaptured] = useState([])   // [{ url, blob }]
  const [status,   setStatus]   = useState('mencari') // mencari|kiri|kanan|atas|bawah|jauh|dekat|pas|selesai
  const [progress, setProgress] = useState(0)         // 0..1 stabilitas "pas"

  const stepIdxRef   = useRef(0)
  const capturedRef  = useRef([])
  const stabilRef    = useRef(0)
  const busyRef      = useRef(false)   // ada request deteksi yang lagi jalan
  const menangkapRef = useRef(false)   // lagi proses jepret / jeda antar step
  const onChangeRef  = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { stepIdxRef.current = stepIdx }, [stepIdx])

  // bersihkan object URL pas unmount
  useEffect(() => () => {
    capturedRef.current.forEach(c => URL.revokeObjectURL(c.url))
  }, [])

  const tangkapFoto = useCallback(async (shotDataUrl) => {
    const res  = await fetch(shotDataUrl)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)

    capturedRef.current = [...capturedRef.current, { url, blob }]
    setCaptured(capturedRef.current)

    const jumlah = capturedRef.current.length
    if (jumlah >= TAHAP.length) {
      setStatus('selesai')
      onChangeRef.current?.(capturedRef.current.map(c => c.blob))
      // menangkapRef tetap true → polling berhenti menjepret lagi
    } else {
      setStatus('pas')
      setTimeout(() => {
        stepIdxRef.current = jumlah
        setStepIdx(jumlah)
        stabilRef.current = 0
        setProgress(0)
        menangkapRef.current = false
      }, JEDA_ANTAR_STEP)
    }
  }, [])

  const ulangi = () => {
    capturedRef.current.forEach(c => URL.revokeObjectURL(c.url))
    capturedRef.current = []
    setCaptured([])
    stepIdxRef.current = 0
    setStepIdx(0)
    stabilRef.current = 0
    setProgress(0)
    menangkapRef.current = false
    setStatus('mencari')
    onChangeRef.current?.([])
  }

  // loop deteksi wajah + estimasi jarak + cek posisi tengah
  useEffect(() => {
    if (!mulai) return
    const interval = setInterval(async () => {
      if (busyRef.current || menangkapRef.current) return
      const cam = webcamRef.current
      if (!cam) return
      busyRef.current = true
      try {
        const shot = cam.getScreenshot()
        if (!shot) return

        const res  = await fetch(shot)
        const blob = await res.blob()
        const fd   = new FormData()
        fd.append('foto', blob, 'frame.jpg')
        const { data } = await axios.post(`${API_URL}/absensi/deteksi`, fd)

        const canvas = canvasRef.current
        if (!canvas) return
        const video = cam.video
        const imgW  = video?.videoWidth  || 640
        const imgH  = video?.videoHeight || 480
        if (canvas.width  !== imgW) canvas.width  = imgW
        if (canvas.height !== imgH) canvas.height = imgH
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // panduan titik tengah (crosshair + zona toleransi)
        const cxF = imgW / 2, cyF = imgH / 2
        const zonaX = imgW * TOLERANSI_TENGAH
        const zonaY = imgH * TOLERANSI_TENGAH
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 2
        ctx.strokeRect(cxF - zonaX, cyF - zonaY, zonaX * 2, zonaY * 2)
        ctx.setLineDash([])

        const tahap = TAHAP[stepIdxRef.current]
        const kotak = data.kotak || []
        // ambil wajah terbesar kalau kedeteksi banyak
        const k = kotak.length
          ? kotak.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a))
          : null

        let st = 'mencari'
        if (k) {
          const cx = k.x + k.w / 2
          const cy = k.y + k.h / 2
          const dx = (cx - cxF) / imgW   // + = wajah di kanan layar
          const dy = (cy - cyF) / imgH   // + = wajah di bawah layar
          const rasio = k.w / imgW

          const diTengah = Math.abs(dx) <= TOLERANSI_TENGAH && Math.abs(dy) <= TOLERANSI_TENGAH

          if (!diTengah) {
            // arahkan ke sumbu dengan simpangan terbesar
            if (Math.abs(dx) >= Math.abs(dy)) st = dx > 0 ? 'kiri' : 'kanan'
            else                              st = dy > 0 ? 'atas' : 'bawah'
          } else if (rasio < tahap.min) st = 'jauh'   // wajah terlalu kecil → terlalu jauh
          else if (rasio > tahap.max)   st = 'dekat'  // wajah terlalu besar → terlalu dekat
          else                          st = 'pas'

          const warna = st === 'pas' ? '#22c55e' : '#f59e0b'
          const padX  = k.w * 0.05
          const padY  = k.h * 0.05
          ctx.strokeStyle = warna
          ctx.lineWidth   = 3
          ctx.strokeRect(k.x - padX, k.y - padY, k.w + padX * 2, k.h + padY * 2)
          ctx.fillStyle = warna + '22'
          ctx.fillRect(k.x - padX, k.y - padY, k.w + padX * 2, k.h + padY * 2)
        }

        if (st === 'pas') stabilRef.current += 1
        else              stabilRef.current = 0

        setStatus(st)
        setProgress(Math.min(1, stabilRef.current / STABIL_DIBUTUHKAN))

        if (stabilRef.current >= STABIL_DIBUTUHKAN) {
          menangkapRef.current = true
          stabilRef.current = 0
          await tangkapFoto(shot)
        }
      } catch { /* silent */ } finally { busyRef.current = false }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [mulai, tangkapFoto])

  const selesai = captured.length >= TAHAP.length
  const tahapAktif = TAHAP[Math.min(stepIdx, TAHAP.length - 1)]

  const pesanStatus = selesai
    ? '✓ Semua foto berhasil diambil!'
    : status === 'mencari' ? 'Wajah tidak terdeteksi — hadapkan wajah ke kamera'
    : status === 'kiri'    ? 'Geser wajah ke kiri'
    : status === 'kanan'   ? 'Geser wajah ke kanan'
    : status === 'atas'    ? 'Geser wajah ke atas'
    : status === 'bawah'   ? 'Geser wajah ke bawah'
    : status === 'jauh'    ? `Terlalu jauh — maju mendekat ke kamera`
    : status === 'dekat'   ? `Terlalu dekat — mundur sedikit`
    : 'Posisi pas & di tengah! Tahan sebentar...'

  const warnaStatus = (selesai || status === 'pas') ? '#16a34a'
    : status === 'mencari' ? '#6b7280'
    : '#d97706'

  const ikonStatus = status === 'pas' || selesai ? 'fa-circle-check'
    : status === 'kiri'  ? 'fa-arrow-left'
    : status === 'kanan' ? 'fa-arrow-right'
    : status === 'atas'  ? 'fa-arrow-up'
    : status === 'bawah' ? 'fa-arrow-down'
    : 'fa-arrows-up-down-left-right'

  // tampilan awal: tombol mulai
  if (!mulai) {
    return (
      <div style={{
        textAlign: 'center', padding: '2rem 1rem', border: '2px dashed #cbd5e1',
        borderRadius: '12px', background: '#f8fafc',
      }}>
        <i className="fa-solid fa-camera-retro fa-2x" style={{ color: '#3b82f6', marginBottom: '0.75rem' }} />
        <div style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Sistem akan mengambil {TAHAP.length} foto otomatis (jauh, sedang, dekat).<br />
          Posisikan wajah di tengah, foto dijepret sendiri saat posisi sudah pas.
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setMulai(true)}>
          <i className="fa-solid fa-play" style={{ marginRight: '0.4rem' }} />
          Mulai Pengambilan Wajah
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* indikator langkah */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {TAHAP.map((t, i) => {
          const sudah = i < captured.length
          const aktif = i === stepIdx && !selesai
          return (
            <div key={t.key} style={{
              flex: 1, textAlign: 'center', padding: '0.5rem',
              borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
              border: `2px solid ${sudah ? '#22c55e' : aktif ? '#3b82f6' : '#e2e8f0'}`,
              background: sudah ? '#f0fdf4' : aktif ? '#eff6ff' : '#f8fafc',
              color: sudah ? '#16a34a' : aktif ? '#1d4ed8' : '#94a3b8',
            }}>
              {sudah ? <i className="fa-solid fa-check" style={{ marginRight: '0.3rem' }} /> : `${i + 1}. `}
              {t.label}
            </div>
          )
        })}
      </div>

      {!selesai && (
        <>
          <div style={{ position: 'relative', display: 'block', width: '100%', maxWidth: '480px', margin: '0 auto', lineHeight: 0 }}>
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="webcam-video"
              mirrored={true}
              forceScreenshotSourceSize={true}
              style={{ width: '100%' }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
          </div>

          {/* banner status + bar stabilitas */}
          <div style={{
            maxWidth: '480px', margin: '0.75rem auto 0', textAlign: 'center',
            color: warnaStatus, fontWeight: 600, fontSize: '0.95rem',
          }}>
            <i className={`fa-solid ${ikonStatus}`} style={{ marginRight: '0.4rem' }} />
            {pesanStatus}
          </div>
          <div style={{ maxWidth: '480px', margin: '0.5rem auto 0', height: 6, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: '#22c55e', transition: 'width 0.15s' }} />
          </div>
        </>
      )}

      {/* thumbnail hasil */}
      {captured.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.9rem', flexWrap: 'wrap' }}>
          {captured.map((c, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <img src={c.url} alt={TAHAP[i]?.label} style={{ width: 90, height: 68, objectFit: 'cover', borderRadius: 8, border: '2px solid #22c55e' }} />
              <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: 2 }}>{TAHAP[i]?.label}</div>
            </div>
          ))}
        </div>
      )}

      {captured.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <button type="button" onClick={ulangi}
            style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', color: '#6b7280' }}>
            <i className="fa-solid fa-rotate-left" style={{ marginRight: '0.3rem' }} />Ulangi Pengambilan
          </button>
        </div>
      )}
    </div>
  )
}
