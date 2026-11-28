import type { Metadata } from 'next'
import { InternalTheme } from '@/components/internal/ui/Theme'
import PrimitiveGallery from '@/components/internal/ui/PrimitiveGallery'

export const metadata: Metadata = { title: 'Internal component gallery', robots: { index: false, follow: false } }

export default function GalleryPage() {
  return <InternalTheme><PrimitiveGallery /></InternalTheme>
}
