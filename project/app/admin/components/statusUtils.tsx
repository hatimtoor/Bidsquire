'use client';

import { RefreshCw, FileText, Award, Camera, Users, Tag } from 'lucide-react';

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'processing': return 'bg-yellow-100 text-yellow-800 animate-pulse';
    case 'research': return 'bg-blue-100 text-blue-800';
    case 'winning': return 'bg-green-100 text-green-800';
    case 'photography': return 'bg-purple-100 text-purple-800';
    case 'research2': return 'bg-orange-100 text-orange-800';
    case 'finalized': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing': return <RefreshCw className="h-4 w-4 animate-spin" />;
    case 'research': return <FileText className="h-4 w-4" />;
    case 'winning': return <Award className="h-4 w-4" />;
    case 'photography': return <Camera className="h-4 w-4" />;
    case 'research2': return <Users className="h-4 w-4" />;
    case 'finalized': return <Tag className="h-4 w-4" />;
    default: return <Tag className="h-4 w-4" />;
  }
};
