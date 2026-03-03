'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { LOCATION_CONFIG } from '@/lib/menuUtils'

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then(m => m.QRCodeSVG),
  { ssr: false }
)

export default function QRGenerator() {
  const [location, setLocation] = useState('w-military')
  const [tableStart, setTableStart] = useState(1)
  const [tableEnd, setTableEnd] = useState(10)
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    setBaseUrl(window.location.origin + base)
  }, [])

  const tables: number[] = []
  const start = Math.max(1, tableStart)
  const end = Math.max(start, tableEnd)
  for (let t = start; t <= end; t++) tables.push(t)

  const locationInfo = LOCATION_CONFIG[location]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">QR Code Generator</h1>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="location-select" className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <select
              id="location-select"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {Object.entries(LOCATION_CONFIG).map(([slug, info]) => (
                <option key={slug} value={slug}>{info.display}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="table-start" className="block text-sm font-medium text-gray-700 mb-1">
              Table Start
            </label>
            <input
              id="table-start"
              type="number"
              min={1}
              value={tableStart}
              onChange={e => setTableStart(parseInt(e.target.value, 10) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label htmlFor="table-end" className="block text-sm font-medium text-gray-700 mb-1">
              Table End
            </label>
            <input
              id="table-end"
              type="number"
              min={tableStart}
              value={tableEnd}
              onChange={e => setTableEnd(parseInt(e.target.value, 10) || tableStart)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="bg-red-800 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Print QR Codes
          </button>
          <span className="text-sm text-gray-500">{tables.length} table{tables.length !== 1 ? 's' : ''} selected</span>
        </div>
      </div>

      {/* QR grid */}
      {baseUrl && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {tables.map(table => {
            const url = `${baseUrl}/order?location=${location}&table=${table}`
            return (
              <div
                key={table}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm text-center"
              >
                <QRCodeSVG
                  value={url}
                  size={140}
                  level="M"
                  aria-label={`QR code for ${locationInfo?.display} Table ${table}`}
                />
                <p className="text-xs font-bold text-gray-900 mt-1">China Rose</p>
                <p className="text-xs text-gray-600">{locationInfo?.display}</p>
                <p className="text-sm font-bold text-red-800">Table {table}</p>
                <p className="text-xs text-gray-500">Scan to Order</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
