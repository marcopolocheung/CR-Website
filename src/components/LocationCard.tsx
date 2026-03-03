import Link from 'next/link'

interface LocationCardProps {
  name: string
  address: string
  phone: string
  toastUrl: string
  uberUrl: string
  href: string
}

export default function LocationCard({ name, address, phone, toastUrl, uberUrl, href }: LocationCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-red-800">{name}</h2>
        <p className="text-gray-600 mt-1">{address}</p>
        <a href={`tel:${phone.replace(/\D/g, '')}`} className="text-red-700 font-medium hover:underline mt-1 inline-block">
          {phone}
        </a>
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={toastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-red-700 hover:bg-red-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Pick-Up
        </a>
        <a
          href={uberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          Order Delivery
        </a>
      </div>

      <Link href={href} className="text-center text-red-700 hover:text-red-900 font-medium underline text-sm">
        View Location & Menu →
      </Link>
    </div>
  )
}
