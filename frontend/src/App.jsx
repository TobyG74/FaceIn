import { Routes, Route, NavLink } from 'react-router-dom'
import HalamanAbsensi from './pages/HalamanAbsensi'
import HalamanRekap from './pages/HalamanRekap'
import HalamanDaftarMahasiswa from './pages/HalamanDaftarMahasiswa'

export default function App() {
  return (
    <div className="app-wrapper">
      <nav className="navbar">
        <span className="navbar-brand"><i className="fa-solid fa-camera" style={{marginRight:'0.5rem'}}></i>FaceIn</span>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <i className="fa-solid fa-camera" style={{marginRight:'0.4rem'}}></i>Absensi
          </NavLink>
          <NavLink to="/mahasiswa" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <i className="fa-solid fa-users" style={{marginRight:'0.4rem'}}></i>Mahasiswa
          </NavLink>
          <NavLink to="/rekap" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <i className="fa-solid fa-chart-bar" style={{marginRight:'0.4rem'}}></i>Rekap
          </NavLink>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HalamanAbsensi />} />
          <Route path="/mahasiswa" element={<HalamanDaftarMahasiswa />} />
          <Route path="/rekap" element={<HalamanRekap />} />
        </Routes>
      </main>

      <footer style={{
        borderTop: '1px solid #e2e8f0',
        padding: '1.5rem 2rem',
        background: '#f8fafc',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Tim Pengembang
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {[
            { nama: 'Muhammad Iihab Wahyudin', nim: '202243502636', peran: 'UI/UX Designer' },
            { nama: 'Tobi Saputra',            nim: '202243502612', peran: 'Machine Learning Engineer' },
            { nama: 'Muhammad Zulfahmi',        nim: '202243502609', peran: 'Database Engineer' },
          ].map(({ nama, nim, peran }) => (
            <div key={nim} style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>{nama}</div>
              <div style={{ color: '#64748b' }}>{nim}</div>
              <div style={{ color: '#3b82f6', fontSize: '0.75rem' }}>{peran}</div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
