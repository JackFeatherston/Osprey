'use client'

import { useState } from 'react'
import { TradeProposal } from '@/lib/api'
import { Play } from 'lucide-react'

interface TradeProposalDeckProps {
  proposals: TradeProposal[]
  onApprove?: (proposalId: string, notes?: string) => Promise<void>
  onReject?: (proposalId: string, notes?: string) => Promise<void>
}

export default function TradeProposalDeck({ proposals, onApprove, onReject }: TradeProposalDeckProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedProposal, setSelectedProposal] = useState<TradeProposal | null>(null)

  const pendingProposals = proposals.filter(p => p.status === 'PENDING')

  if (pendingProposals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-900/50 rounded-lg border border-neutral-700">
        <div className="text-center text-neutral-400">
          <p className="text-xl">No active proposals</p>
          <p className="text-sm mt-2">The AI will display new trade opportunities here</p>
        </div>
      </div>
    )
  }

  const handleCardClick = (proposal: TradeProposal) => {
    setSelectedProposal(proposal)
  }

  const handleApprove = async (proposal: TradeProposal) => {
    if (onApprove) {
      await onApprove(proposal.id)
    }
  }

  const handleReject = async (proposal: TradeProposal) => {
    if (onReject) {
      await onReject(proposal.id)
    }
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % pendingProposals.length)
  }

  return (
    <div className="relative h-full">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-4xl font-light text-white">Trade Proposals</h2>
      </div>

      {/* Card Deck */}
      <div className="relative h-80 flex items-center justify-start">
        {pendingProposals.map((proposal, index) => {
          const isHovered = hoveredIndex === index
          const offset = index * 8 // Stagger cards by 8px
          const hoverOffset = isHovered ? -20 : 0

          return (
            <div
              key={proposal.id}
              className="absolute transition-all duration-300 ease-out cursor-pointer"
              style={{
                left: `${offset}px`,
                transform: `translateY(${hoverOffset}px) scale(${isHovered ? 1.05 : 1})`,
                zIndex: isHovered ? 50 : pendingProposals.length - index,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleCardClick(proposal)}
            >
              <div className="w-[500px] h-80 bg-neutral-800 border border-neutral-700 rounded-lg p-5 shadow-xl hover:shadow-2xl transition-shadow flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-5xl font-bold text-white mb-1">{proposal.symbol}</div>
                    <div className={`text-2xl font-semibold ${proposal.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {proposal.action}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-0.5 mb-2">
                  <div className="text-3xl font-light text-white">
                    ${proposal.price.toFixed(2)}
                  </div>
                  <div className="text-lg text-neutral-300">
                    {proposal.quantity} Shares
                  </div>
                  <div className="text-lg text-neutral-300">
                    ${(proposal.quantity * proposal.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Reasoning - contained with scroll */}
                <div className="flex-1 min-h-0 mb-3 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-neutral-800">
                  <div className="text-sm text-neutral-400 pr-2">
                    [Reasoning. Ex: {proposal.reason}]
                  </div>
                </div>

                {/* Action Buttons - always at bottom */}
                <div className="flex gap-4 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleApprove(proposal)
                    }}
                    className={`flex items-center justify-center w-12 h-12 rounded-full ${
                      proposal.action === 'BUY'
                        ? 'bg-blue-500 hover:bg-blue-400'
                        : 'bg-neutral-600 hover:bg-neutral-500'
                    } transition-colors`}
                  >
                    <div className={`w-6 h-6 rounded-full ${
                      proposal.action === 'BUY' ? 'bg-blue-600' : 'bg-neutral-700'
                    }`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReject(proposal)
                    }}
                    className={`flex items-center justify-center w-12 h-12 rounded-full ${
                      proposal.action === 'SELL'
                        ? 'bg-red-500 hover:bg-red-400'
                        : 'bg-neutral-600 hover:bg-neutral-500'
                    } transition-colors`}
                  >
                    <div className={`w-6 h-6 rounded-full ${
                      proposal.action === 'SELL' ? 'bg-red-600' : 'bg-neutral-700'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Play Button - much closer to cards */}
        {pendingProposals.length > 1 && (
          <button
            className="absolute top-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-[100]"
            style={{
              left: `${pendingProposals.length * 8 + 520}px`, // Position right after the last card
            }}
            onClick={handleNext}
          >
            <Play className="w-8 h-8 text-neutral-900 ml-1" fill="currentColor" />
          </button>
        )}
      </div>

      {/* Modal for selected proposal details */}
      {selectedProposal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => setSelectedProposal(null)}
        >
          <div
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <h3 className="text-3xl font-bold text-white mb-2">{selectedProposal.symbol}</h3>
              <div className={`text-2xl font-semibold ${selectedProposal.action === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                {selectedProposal.action}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <div className="text-sm text-neutral-400">Price</div>
                <div className="text-2xl text-white">${selectedProposal.price.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Quantity</div>
                <div className="text-2xl text-white">{selectedProposal.quantity} shares</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400">Total Value</div>
                <div className="text-2xl text-white">
                  ${(selectedProposal.quantity * selectedProposal.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-400 mb-2">AI Reasoning</div>
                <div className="text-white bg-neutral-900/50 rounded p-4">
                  {selectedProposal.reason}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors"
              >
                Approve Trade
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
