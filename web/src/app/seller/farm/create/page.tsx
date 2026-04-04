import { getAllProvinces } from 'geothai'
import CreateFarmClient from './CreateFarmClient'

export default function CreateFarmPage() {
  const provinces = getAllProvinces().map((p) => ({
    name_th: p.name_th,
    districts: p.districts.map((d) => ({
      name_th: d.name_th,
      subdistricts: d.subdistricts.map((s) => ({ name_th: s.name_th, postal_code: s.postal_code })),
    })),
  }))
  return <CreateFarmClient provinces={provinces} />
}
