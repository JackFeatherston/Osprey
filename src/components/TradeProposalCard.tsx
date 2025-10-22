/**
 * Apple Card-inspired Trade Proposal Component
 * Features: Glassmorphism, bold typography, smooth animations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TradeProposal } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Sparkles,
  Loader2
} from 'lucide-react';
import { glassCardVariants, slideUpVariants, staggerContainer, staggerItem } from '@/lib/animations';

interface TradeProposalCardProps {
  proposal: TradeProposal;
  onApprove?: (proposalId: string, notes?: string) => Promise<void>;
  onReject?: (proposalId: string, notes?: string) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

export default function TradeProposalCard({
  proposal,
  onApprove,
  onReject,
  disabled = false,
  compact = false
}: TradeProposalCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState(!compact);

  const handleApprove = async () => {
    if (!onApprove || isProcessing) return;

    setIsProcessing(true);
    await onApprove(proposal.id, notes || undefined);
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!onReject || isProcessing) return;

    setIsProcessing(true);
    await onReject(proposal.id, notes || undefined);
    setIsProcessing(false);
  };


  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = () => {
    if (!proposal.expires_at) return false;
    return new Date(proposal.expires_at) < new Date();
  };

  const canTakeAction = proposal.status === 'PENDING' && !isExpired() && !disabled && !isProcessing;

  const isBuy = proposal.action === 'BUY';
  const actionColor = isBuy ? 'text-green-500' : 'text-red-500';
  const actionBg = isBuy ? 'bg-green-500/10' : 'bg-red-500/10';
  const actionBorder = isBuy ? 'border-green-500/30' : 'border-red-500/30';
  const totalValue = proposal.quantity * proposal.price;

  return (
    <motion.div
      variants={glassCardVariants}
      initial="rest"
      whileHover={canTakeAction ? "hover" : undefined}
      className="relative h-full"
    >
      <Card
        variant="apple-card"
        className={`relative overflow-hidden h-full flex flex-col ${
          isExpired() ? 'opacity-60' : ''
        } ${
          isBuy ? 'border-l-4 border-l-green-500/50' : 'border-l-4 border-l-red-500/50'
        }`}
      >
        {/* Header Section */}
        <div className="pl-6 pr-10 pt-10 pb-8">

          {/* Symbol - Hero Typography */}
          <motion.div
            className="mb-4"
            variants={staggerItem}
          >
            <h2 className="text-6xl font-bold tracking-tighter text-white mb-2">
              {proposal.symbol}
            </h2>
            <div className="flex items-start justify-between mb-8">
            {/* Action Badge */}
            <motion.div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${actionBg} border ${actionBorder}`}
              variants={slideUpVariants}
            >
              {isBuy ? (
                <TrendingUp className={`h-5 w-5 ${actionColor}`} />
              ) : (
                <TrendingDown className={`h-5 w-5 ${actionColor}`} />
              )}
              <span className={`font-bold text-sm ${actionColor}`}>
                {proposal.action}
              </span>
            </motion.div>
          </div>
            <div className="flex items-center gap-3 text-white/60">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-light">{proposal.strategy} Strategy</span>
              <span className="text-sm">•</span>
              <span className="text-sm font-light">{formatDateTime(proposal.timestamp)}</span>
            </div>
          </motion.div>

          {/* Trade Metrics - Bold Data */}
          <motion.div
            className="grid grid-cols-3 gap-6 mt-10"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={staggerItem}>
              <div className="text-white/40 text-xs font-light uppercase tracking-wider mb-1">
                Quantity
              </div>
              <div className="text-white text-3xl font-bold tracking-tight">
                {proposal.quantity.toLocaleString()}
              </div>
              <div className="text-white/60 text-sm mt-0.5">shares</div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <div className="text-white/40 text-xs font-light uppercase tracking-wider mb-1">
                Price
              </div>
              <div className="text-white text-3xl font-bold tracking-tight">
                ${proposal.price.toFixed(2)}
              </div>
              <div className="text-white/60 text-sm mt-0.5">per share</div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <div className="text-white/40 text-xs font-light uppercase tracking-wider mb-1">
                Total Value
              </div>
              <div className="text-white text-3xl font-bold tracking-tight">
                ${totalValue.toLocaleString()}
              </div>
              <div className="text-white/60 text-sm mt-0.5">USD</div>
            </motion.div>
          </motion.div>
        </div>

        {/* AI Analysis Section */}
        <div className="pl-6 pr-10 pb-8 flex-grow flex flex-col">
          <motion.div
            className="glass-subtle rounded-2xl p-5 border border-white/5 flex-grow flex flex-col"
            variants={slideUpVariants}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">
                AI Analysis
              </span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed font-light">
              {proposal.reason}
            </p>
          </motion.div>
        </div>

        {/* Notes Input */}
        <AnimatePresence>
          {canTakeAction && showDetails && (
            <motion.div
              className="pl-6 pr-10 pb-8"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label
                htmlFor={`notes-${proposal.id}`}
                className="text-white/60 text-xs font-light uppercase tracking-wider mb-2 block"
              >
                Decision Notes (Optional)
              </label>
              <textarea
                id={`notes-${proposal.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about your decision..."
                className="w-full px-4 py-3 glass-subtle text-white placeholder-white/30 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/10"
                rows={2}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <AnimatePresence>
          {canTakeAction && (
            <motion.div
              className="pl-6 pr-10 pb-10 pt-0 flex gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                variant="success"
                size="lg"
                className="flex-1"
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                {isProcessing ? 'Processing...' : 'Approve'}
              </Button>

              <Button
                onClick={handleReject}
                disabled={isProcessing}
                variant="danger"
                size="lg"
                className="flex-1"
              >
                <XCircle className="h-5 w-5 mr-2" />
                {isProcessing ? 'Processing...' : 'Reject'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Messages */}
        <AnimatePresence>
          {proposal.status !== 'PENDING' && (
            <motion.div
              className={`ml-6 mr-10 mb-10 p-4 rounded-2xl text-center text-sm ${
                proposal.status === 'APPROVED'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : proposal.status === 'REJECTED'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10'
              }`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {proposal.status === 'APPROVED' && 'This proposal has been approved and submitted for execution.'}
              {proposal.status === 'REJECTED' && 'This proposal has been rejected.'}
              {proposal.status === 'EXPIRED' && 'This proposal has expired and is no longer available.'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expiration Warning */}
        <AnimatePresence>
          {isExpired() && proposal.status === 'PENDING' && (
            <motion.div
              className="ml-6 mr-10 mb-10 p-4 rounded-2xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-center text-sm flex items-center justify-center gap-2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <AlertCircle className="h-4 w-4" />
              This proposal has expired and can no longer be acted upon.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand/Collapse for Compact Mode */}
        {compact && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="absolute top-4 right-4 p-2 glass-subtle rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronRight
              className={`h-5 w-5 text-white/60 transition-transform ${
                showDetails ? 'rotate-90' : ''
              }`}
            />
          </button>
        )}
      </Card>
    </motion.div>
  );
}