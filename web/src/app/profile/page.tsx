import { Suspense } from 'react'
import { getAllProvinces } from 'geothai'
import ProfileClient from './ProfileClient'

export default function ProfilePage() {
  const raw = getAllProvinces()
  const provinces = raw.map((p) => ({
    name_th: p.name_th,
    districts: p.districts.map((d) => ({
      name_th: d.name_th,
      subdistricts: d.subdistricts.map((s) => ({
        name_th: s.name_th,
        postal_code: s.postal_code,
      })),
    })),
  }))

  return (
    <Suspense>
      <ProfileClient provinces={provinces} />
    </Suspense>
  )
}
