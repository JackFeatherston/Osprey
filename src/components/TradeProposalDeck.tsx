'use client'

import { useState, useEffect } from 'react'
import { TradeProposal } from '@/lib/api'
import { Play } from 'lucide-react'
import TradeProposalCard from './TradeProposalCard'

interface TradeProposalDeckProps {
  proposals: TradeProposal[]
  onApprove?: (proposalId: string) => Promise<void>
  onReject?: (proposalId: string) => Promise<void>
}

const ROTATE_DURATION_MS = 300
const CARD_OFFSET_PX = 75
const CARD_WIDTH_PX = 420

export default function TradeProposalDeck({ proposals, onApprove, onReject }: TradeProposalDeckProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [rotatedProposals, setRotatedProposals] = useState<TradeProposal[]>([])
  const [isRotating, setIsRotating] = useState(false)

  const pendingProposals = proposals.filter(p => p.status === 'PENDING')

  useEffect(() => {
    setRotatedProposals(pendingProposals)
  }, [pendingProposals.length])

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
    if (isRotating || rotatedProposals.length <= 1) return
    setIsRotating(true)
    setRotatedProposals(prev => {
      const [first, ...rest] = prev
      return [...rest, first]
    })
    setTimeout(() => setIsRotating(false), ROTATE_DURATION_MS)
  }

  return (
    <div className="relative h-full">
      <div className="relative flex items-start justify-start" style={{ minHeight: '600px' }}>
        {rotatedProposals.map((proposal, index) => {
          const isHovered = hoveredIndex === index
          return (
            <div
              key={proposal.id}
              className="absolute transition-all duration-300 ease-out"
              style={{
                left: `${index * CARD_OFFSET_PX}px`,
                transform: `translateY(${isHovered ? -10 : 0}px) scale(${isHovered ? 1.02 : 1})`,
                zIndex: isHovered ? 50 : rotatedProposals.length - index,
                width: `${CARD_WIDTH_PX}px`,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <TradeProposalCard proposal={proposal} onApprove={onApprove} onReject={onReject} />
            </div>
          )
        })}

        {rotatedProposals.length > 1 && (
          <button
            className={`absolute top-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-[100] ${
              isRotating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              left: `${(rotatedProposals.length - 1) * CARD_OFFSET_PX + CARD_WIDTH_PX + 40}px`,
            }}
            onClick={handleNext}
            disabled={isRotating}
          >
            <Play className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" />
          </button>
        )}
      </div>
    </div>
  )
}
