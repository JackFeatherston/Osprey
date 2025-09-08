/**
 * Container component for displaying a list of trade proposals
 */

import { TradeProposal } from '@/lib/api';
import TradeProposalCard from './TradeProposalCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, TrendingUp } from 'lucide-react';

interface TradeProposalsListProps {
  proposals: TradeProposal[];
  loading: boolean;
  error: string | null;
  onApprove?: (proposalId: string, notes?: string) => Promise<void>;
  onReject?: (proposalId: string, notes?: string) => Promise<void>;
}

export default function TradeProposalsList({
  proposals,
  loading,
  error,
  onApprove,
  onReject
}: TradeProposalsListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trade Proposals
          </CardTitle>
          <CardDescription>
            AI-generated trading opportunities awaiting your decision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading proposals...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trade Proposals
          </CardTitle>
          <CardDescription>
            AI-generated trading opportunities awaiting your decision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-8 w-8" />
            <span className="ml-2">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate pending and non-pending proposals
  const pendingProposals = proposals.filter(p => p.status === 'PENDING');
  const completedProposals = proposals.filter(p => p.status !== 'PENDING');

  return (
    <div className="space-y-6">
      {/* Active Proposals */}
      {pendingProposals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Active Proposals</h2>
            <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
              {pendingProposals.length}
            </span>
          </div>
          <div className="space-y-4">
            {pendingProposals.map((proposal) => (
              <TradeProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Proposals */}
      {completedProposals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">Recent Decisions</h2>
            <span className="bg-gray-100 text-gray-800 text-sm px-2 py-1 rounded-full">
              {completedProposals.length}
            </span>
          </div>
          <div className="space-y-4">
            {completedProposals.slice(0, 5).map((proposal) => (
              <TradeProposalCard
                key={proposal.id}
                proposal={proposal}
                disabled={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {proposals.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trade Proposals
            </CardTitle>
            <CardDescription>
              AI-generated trading opportunities awaiting your decision
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals yet</h3>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}