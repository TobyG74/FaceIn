import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

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

export const scanAbsensi = (formData) =>
  api.post('/absensi/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const getAbsensiHariIni = () => api.get('/absensi/hari-ini')

export const getRekapAbsensi = (params) =>
  api.get('/absensi/rekap', { params })

export const getStatistikAbsensi = (params) =>
  api.get('/absensi/statistik', { params })

export const hapusAbsensi = (id) => api.delete(`/absensi/${id}`)

export const kenaliWajah = (formData) =>
  api.post('/absensi/kenali', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const cekSenyum = (formData) =>
  api.post('/absensi/cek-senyum', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
