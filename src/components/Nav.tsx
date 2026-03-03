'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)

  return (
    <nav className="bg-red-800 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-wide hover:text-yellow-300 transition-colors">
          China Rose
        </Link>

        {/* desktop nav links only shows on wider screeen sizes */}
        <ul className="hidden md:flex gap-6 text-sm font-medium">
          <li><Link href="/" className="hover:text-yellow-300 transition-colors">Home</Link></li>

          {/* dropdown is state driven because hovering the child list was closing it without that */}
          <li
            className="relative"
            onMouseEnter={() => setLocOpen(true)}
            onMouseLeave={() => setLocOpen(false)}
          >
            <span className="cursor-pointer hover:text-yellow-300 transition-colors select-none">
              Locations ▾
            </span>
            {locOpen && (
              <ul className="absolute left-0 top-full bg-red-900 rounded shadow-lg min-w-[180px] z-50">
                <li>
                  <Link
                    href="/locations/w-military"
                    className="block px-4 py-3 hover:bg-red-700 transition-colors"
                    onClick={() => setLocOpen(false)}
                  >
                    W Military Dr
                  </Link>
                </li>
                <li>
                  <Link
                    href="/locations/sw-military"
                    className="block px-4 py-3 hover:bg-red-700 transition-colors"
                    onClick={() => setLocOpen(false)}
                  >
                    SW Military Dr
                  </Link>
                </li>
              </ul>
            )}
          </li>

          <li><Link href="/menu" className="hover:text-yellow-300 transition-colors">Menu</Link></li>
          <li><Link href="/careers" className="hover:text-yellow-300 transition-colors">Careers</Link></li>
        </ul>

        {/* hamburrger button toggles the mobile nav */}
        <button
          className="md:hidden flex flex-col gap-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className="w-6 h-0.5 bg-white block" />
          <span className="w-6 h-0.5 bg-white block" />
          <span className="w-6 h-0.5 bg-white block" />
        </button>
      </div>

      {/* mobile nav links that show upp when the hamburger is tapped */}
      {mobileOpen && (
        <ul className="md:hidden bg-red-900 px-4 pb-4 flex flex-col gap-2 text-sm font-medium">
          <li><Link href="/" className="block py-2 hover:text-yellow-300" onClick={() => setMobileOpen(false)}>Home</Link></li>
          <li><Link href="/locations/w-military" className="block py-2 hover:text-yellow-300" onClick={() => setMobileOpen(false)}>W Military Dr</Link></li>
          <li><Link href="/locations/sw-military" className="block py-2 hover:text-yellow-300" onClick={() => setMobileOpen(false)}>SW Military Dr</Link></li>
          <li><Link href="/menu" className="block py-2 hover:text-yellow-300" onClick={() => setMobileOpen(false)}>Menu</Link></li>
          <li><Link href="/careers" className="block py-2 hover:text-yellow-300" onClick={() => setMobileOpen(false)}>Careers</Link></li>
        </ul>
      )}
    </nav>
  )
}
