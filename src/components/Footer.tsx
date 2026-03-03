import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-red-900 text-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <h3 className="font-bold text-yellow-300 mb-2">China Rose</h3>
          <p>Authentic Chinese Cuisine</p>
          <p>San Antonio, TX</p>
        </div>
        <div>
          <h3 className="font-bold text-yellow-300 mb-2">Locations</h3>
          <ul className="space-y-1">
            <li><Link href="/locations/w-military" className="hover:text-yellow-300 transition-colors">W Military Dr</Link></li>
            <li><Link href="/locations/sw-military" className="hover:text-yellow-300 transition-colors">SW Military Dr</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold text-yellow-300 mb-2">Links</h3>
          <ul className="space-y-1">
            <li><Link href="/careers" className="hover:text-yellow-300 transition-colors">Careers</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-red-700 text-center py-3 text-xs text-red-300">
        &copy; {new Date().getFullYear()} China Rose. All rights reserved.
      </div>
    </footer>
  )
}
