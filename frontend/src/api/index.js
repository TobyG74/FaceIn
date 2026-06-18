import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// ---------- Mahasiswa ----------
export const getMahasiswa = () => api.get('/mahasiswa/')
export const getDetailMahasiswa = (id) => api.get(`/mahasiswa/${id}`)

export const tambahMahasiswa = (formData) =>
  api.post('/mahasiswa/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const updateFotoMahasiswa = (id, formData) =>
  api.put(`/mahasiswa/${id}/foto`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const hapusMahasiswa = (id) => api.delete(`/mahasiswa/${id}`)

// ---------- Sesi meeting ----------
export const getSesiList = () => api.get('/sesi/')
export const getSesiDetail = (id) => api.get(`/sesi/${id}`)
export const buatSesi = (data) => api.post('/sesi/', data)
export const hapusSesi = (id) => api.delete(`/sesi/${id}`)
export const getKehadiranSesi = (id) => api.get(`/sesi/${id}/kehadiran`)

export const scanSesi = (sesiId, formData) =>
  api.post(`/sesi/${sesiId}/scan`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ---------- Rekap & statistik ----------
export const getRekapAbsensi = (params) =>
  api.get('/absensi/rekap', { params })

export const getStatistikAbsensi = (params) =>
  api.get('/absensi/statistik', { params })

export const hapusAbsensi = (id) => api.delete(`/absensi/${id}`)
