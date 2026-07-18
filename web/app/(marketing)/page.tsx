import type { Metadata } from 'next'
import { HomeExperience } from '@/components/HomeExperience'
import { site } from '@/content/site'

// Server Component: it exists to own the metadata. All the motion lives in
// HomeExperience, which is the client boundary.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description: site.description,
}

export default function Home() {
  return <HomeExperience />
}
