'use client'
import { COLORS as C, FONT_BODY } from '@/lib/theme'
import { GENERATOR_CATALOG } from '@/lib/worksheet-generator-catalog'

// Worksheet Generators (Aj, 2026-07-19): "attached to Bundle Generator" --
// every tool here can save its output as a Finished Product (see
// SaveAsProductBar), which is exactly what Bundle Builder assembles
// bundles from. That's the actual attachment: generate here, it shows up
// as something you can add to a bundle.
export default function WorksheetGeneratorsPage() {
  return (
    <div style={{ fontFamily: FONT_BODY, maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h1 style={{ color: C.navy, fontSize: 22, margin: 0 }}>🧮 Worksheet Generators</h1>
        <a href="/dashboard/bundles" style={{ fontSize: 12, color: '#888' }}>Bundles →</a>
      </div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
        Quick tools for building practice worksheets, games, puzzles, and quizzes from your own
        content. Every generator can save its result as a Finished Product, so it's immediately
        available to add into a bundle in Bundle Builder.
      </p>

      {GENERATOR_CATALOG.map((group) => (
        <div key={group.group} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
            {group.icon} {group.group}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {group.tools.map((tool) => {
              const card = (
                <div
                  style={{
                    background: '#fff', border: `1px solid ${tool.status === 'planned' ? '#eee' : C.border}`,
                    borderRadius: 8, padding: 14, height: '100%', boxSizing: 'border-box',
                    opacity: tool.status === 'planned' ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tool.status === 'planned' ? '#999' : C.navy }}>{tool.label}</div>
                    {tool.status === 'planned' && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#a06b1f', background: '#fdf3e0', border: '1px solid #e8d9b0', borderRadius: 10, padding: '1px 8px', whiteSpace: 'nowrap' }}>
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#777', margin: '4px 0 0', lineHeight: 1.4 }}>{tool.desc}</p>
                </div>
              )
              return tool.href ? (
                <a key={tool.key} href={tool.href} style={{ textDecoration: 'none', display: 'block' }}>{card}</a>
              ) : (
                <div key={tool.key}>{card}</div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
