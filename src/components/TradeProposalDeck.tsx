'use client'

import { useState } from 'react'
import { TradeProposal } from '@/lib/api'
import { Play } from 'lucide-react'
import TradeProposalCard from './TradeProposalCard'

interface TradeProposalDeckProps {
  proposals: TradeProposal[]
  onApprove?: (proposalId: string, notes?: string) => Promise<void>
  onReject?: (proposalId: string, notes?: string) => Promise<void>
}

export default function TradeProposalDeck({ proposals, onApprove, onReject }: TradeProposalDeckProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const pendingProposals = proposals.filter(p => p.status === 'PENDING')

  if (pendingProposals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-900/50 rounded-lg border border-neutral-700">
        <div className="text-center text-neutral-400">
          <p className="text-xl">No active proposals</p>
        </div>
      </div>
    )
  }

  const handleNext = () => {
    // Rotate the first card to the back by reordering
    // This would need to be handled by parent component to reorder proposals
    // For now, this is just visual feedback with the button
  }

  return (
    <div className="relative h-full">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-4xl font-light text-white">Trade Proposals</h2>
      </div>

      {/* Card Deck */}
      <div className="relative flex items-start justify-start" style={{ minHeight: '600px' }}>
        {pendingProposals.map((proposal, index) => {
          const isHovered = hoveredIndex === index
          const offset = index * 12 // Stagger cards by 12px
          const hoverOffset = isHovered ? -10 : 0

          return (
            <div
              key={proposal.id}
              className="absolute transition-all duration-300 ease-out"
              style={{
                left: `${offset}px`,
                transform: `translateY(${hoverOffset}px) scale(${isHovered ? 1.02 : 1})`,
                zIndex: isHovered ? 50 : pendingProposals.length - index,
                width: '420px',
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <TradeProposalCard
                proposal={proposal}
                onApprove={onApprove}
                onReject={onReject}
              />
            </div>
          )
        })}

        {/* Play Button - much closer to cards */}
        {pendingProposals.length > 1 && (
          <button
            className="absolute top-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-[100]"
            style={{
              left: `${pendingProposals.length * 12 + 440}px`, // Position right after the last card
            }}
            onClick={handleNext}
          >
            <Play className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  )
}
