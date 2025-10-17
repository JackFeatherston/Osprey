/**
 * Component for displaying individual trade proposals with approve/reject actions
 */

import { useState } from 'react';
import { TradeProposal } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  DollarSign,
  Hash,
  Calendar
} from 'lucide-react';

interface TradeProposalCardProps {
  proposal: TradeProposal;
  onApprove?: (proposalId: string, notes?: string) => Promise<void>;
  onReject?: (proposalId: string, notes?: string) => Promise<void>;
  disabled?: boolean;
}

export default function TradeProposalCard({ 
  proposal, 
  onApprove, 
  onReject, 
  disabled = false 
}: TradeProposalCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState('');

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

  const getStatusBadge = () => {
    switch (proposal.status) {
      case 'PENDING':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-gray-600 border-gray-600"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getActionIcon = () => {
    return proposal.action === 'BUY' ? (
      <TrendingUp className="h-5 w-5 text-green-600" />
    ) : (
      <TrendingDown className="h-5 w-5 text-red-600" />
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = () => {
    if (!proposal.expires_at) return false;
    return new Date(proposal.expires_at) < new Date();
  };

  const canTakeAction = proposal.status === 'PENDING' && !isExpired() && !disabled && !isProcessing;

  return (
    <Card className={`relative ${isExpired() ? 'opacity-75 border-gray-300' : ''} ${
      proposal.status === 'PENDING' ? 'border-l-4 border-l-blue-500' : ''
    }`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getActionIcon()}
            <div>
              <CardTitle className="text-lg">
                {proposal.action} {proposal.symbol}
              </CardTitle>
              <CardDescription>
                {proposal.strategy} Strategy • {formatDateTime(proposal.timestamp)}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Trade Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Hash className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Quantity</div>
                <div className="text-gray-600">{proposal.quantity.toLocaleString()} shares</div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Price</div>
                <div className="text-gray-600">${proposal.price.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Total Value</div>
                <div className="text-gray-600">${(proposal.quantity * proposal.price).toLocaleString()}</div>
              </div>
            </div>
            
            {proposal.expires_at && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium">Expires</div>
                  <div className={`text-sm ${isExpired() ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatDateTime(proposal.expires_at)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Reasoning */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="font-medium text-sm text-gray-700 mb-1">AI Analysis</div>
            <p className="text-sm text-gray-600">{proposal.reason}</p>
          </div>

          {/* Notes Input (for pending proposals) */}
          {canTakeAction && (
            <div className="space-y-2">
              <label htmlFor={`notes-${proposal.id}`} className="text-sm font-medium text-gray-700">
                Decision Notes (Optional)
              </label>
              <textarea
                id={`notes-${proposal.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about your decision..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Action Buttons */}
          {canTakeAction && (
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={() => handleApprove}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Approve Trade'}
              </Button>
              
              <Button 
                onClick={() => handleReject}
                disabled={isProcessing}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Reject'}
              </Button>
            </div>
          )}

          {/* Status Messages */}
          {proposal.status !== 'PENDING' && (
            <div className={`text-center py-2 text-sm rounded-md ${
              proposal.status === 'APPROVED' 
                ? 'bg-green-50 text-green-800' 
                : proposal.status === 'REJECTED'
                ? 'bg-red-50 text-red-800'
                : 'bg-gray-50 text-gray-800'
            }`}>
              {proposal.status === 'APPROVED' && 'This proposal has been approved and submitted for execution.'}
              {proposal.status === 'REJECTED' && 'This proposal has been rejected.'}
              {proposal.status === 'EXPIRED' && 'This proposal has expired and is no longer available.'}
            </div>
          )}

          {isExpired() && proposal.status === 'PENDING' && (
            <div className="text-center py-2 text-sm bg-yellow-50 text-yellow-800 rounded-md">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              This proposal has expired and can no longer be acted upon.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}