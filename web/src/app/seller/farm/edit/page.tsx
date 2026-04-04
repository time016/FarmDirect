import { getAllProvinces } from 'geothai'
import EditFarmClient from './EditFarmClient'

export default function EditFarmPage() {
  const provinces = getAllProvinces().map((p) => ({
    name_th: p.name_th,
    districts: p.districts.map((d) => ({
      name_th: d.name_th,
      subdistricts: d.subdistricts.map((s) => ({ name_th: s.name_th, postal_code: s.postal_code })),
    })),
  }))
  return <EditFarmClient provinces={provinces} />
}
